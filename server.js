const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "store.json");
let mongoClient = null;
let mongoStore = null;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultData = {
  users: [],
  orders: [],
  messages: [],
  offers: [],
  coupons: [],
  reviews: [],
  appointments: [],
  customRequests: [],
  rates: { gold22k: 0, gold24k: 0, silver: 0, updatedAt: null },
  products: [
    { id: "gold-necklace", name: "Royal Gold Necklace", category: "Gold", price: 89999, purity: "22K", badge: "Bestseller", icon: "necklace" },
    { id: "bridal-set", name: "Bridal Heritage Set", category: "Gold", price: 129999, purity: "22K", badge: "New", icon: "bridal" },
    { id: "gold-bangles", name: "Classic Gold Bangles", category: "Gold", price: 54999, purity: "22K", badge: "Popular", icon: "bangles" },
    { id: "silver-set", name: "Italian Silver Set", category: "Silver", price: 15999, purity: "92.5", badge: "92.5 Silver", icon: "silver" },
    { id: "gold-ring", name: "Elegant Gold Ring", category: "Gold", price: 28999, purity: "18K", badge: "Trending", icon: "ring" },
    { id: "gold-earrings", name: "Temple Jhumka Earrings", category: "Gold", price: 35999, purity: "22K", badge: "Festive", icon: "earrings" }
  ]
};

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
}

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    ["offers","coupons","reviews","appointments","customRequests"].forEach(k => { if (!Array.isArray(data[k])) data[k] = []; });
    if (!data.rates) data.rates = { gold22k: 0, gold24k: 0, silver: 0, updatedAt: null };
    data.products = (data.products || []).map(p => ({ stock: 10, weight: 0, makingCharges: 0, description: "", sizes: [], images: p.image ? [p.image] : [], active: true, ...p }));
    return data;
  } catch { return JSON.parse(JSON.stringify(defaultData)); }
}
function writeData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  if (mongoStore) mongoStore.replaceOne({ _id: "main" }, { ...data, _id: "main" }, { upsert: true }).catch(err => console.error("MongoDB write failed:", err.message));
}

async function initPersistence() {
  if (!process.env.MONGODB_URI) return console.log("Using JSON data fallback. Set MONGODB_URI for durable production storage.");
  try {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    mongoStore = mongoClient.db(process.env.MONGODB_DB || "shree_dhelana_shyam").collection("store");
    const remote = await mongoStore.findOne({ _id: "main" });
    if (remote) { delete remote._id; fs.writeFileSync(DB_FILE, JSON.stringify(remote, null, 2)); }
    else { const local = readData(); await mongoStore.replaceOne({ _id: "main" }, { ...local, _id: "main" }, { upsert: true }); }
    console.log("MongoDB connected.");
  } catch (err) { mongoStore = null; console.error("MongoDB connection failed; using JSON fallback:", err.message); }
}
function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, addresses: user.addresses || [], wishlist: user.wishlist || [] };
}

const ADMIN_FILE = path.join(DATA_DIR, "admin.json");
const SESSION_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");

function ensureAdminFile() {
  if (!fs.existsSync(ADMIN_FILE)) {
    if (!process.env.ADMIN_USER_ID || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_RECOVERY_CODE) {
      throw new Error("Admin credentials are not configured. Set ADMIN_USER_ID, ADMIN_PASSWORD and ADMIN_RECOVERY_CODE.");
    }
    const initialAdmin = {
      userId: process.env.ADMIN_USER_ID,
      passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10),
      recoveryCodeHash: bcrypt.hashSync(process.env.ADMIN_RECOVERY_CODE, 10),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(initialAdmin, null, 2));
  }
}
function readAdmin() { ensureAdminFile(); return JSON.parse(fs.readFileSync(ADMIN_FILE, "utf8")); }
function writeAdmin(admin) { fs.writeFileSync(ADMIN_FILE, JSON.stringify(admin, null, 2)); }
function isAdmin(req) { return Boolean(process.env.ADMIN_KEY) && req.headers["x-admin-key"] === process.env.ADMIN_KEY; }
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ message: "Admin access required." });
  next();
}
function signUserToken(user) { const body=Buffer.from(JSON.stringify({id:user.id,email:user.email,exp:Date.now()+7*86400000})).toString("base64url");return body+"."+crypto.createHmac("sha256",SESSION_SECRET).update(body).digest("base64url"); }
function requireUser(req,res,next){try{const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,""),[body,sig]=token.split("."),expected=crypto.createHmac("sha256",SESSION_SECRET).update(body).digest("base64url");if(!sig||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))throw 0;const payload=JSON.parse(Buffer.from(body,"base64url"));if(payload.exp<Date.now())throw 0;req.userAuth=payload;next()}catch{return res.status(401).json({message:"Please login again."})}}

app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/products", (req, res) => {
  const data = readData();
  res.json(data.products);
});

app.post("/api/register", async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });

  const data = readData();
  const normalized = email.trim().toLowerCase();
  if (data.users.some(u => u.email === normalized)) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalized,
    phone: (phone || "").trim(),
    passwordHash: await bcrypt.hash(password, 10),
    addresses: [], wishlist: [], blocked: false,
    createdAt: new Date().toISOString()
  };
  data.users.push(user);
  writeData(data);

  res.status(201).json({ message: "Registration successful.", user: safeUser(user), token: signUserToken(user) });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const data = readData();
  const user = data.users.find(u => u.email === String(email || "").trim().toLowerCase());

  if (!user || user.blocked || !(await bcrypt.compare(password || "", user.passwordHash))) {
    if (user?.blocked) return res.status(403).json({ message: "Your account has been blocked. Please contact the store." });
    return res.status(401).json({ message: "Invalid email or password." });
  }
  res.json({ message: "Login successful.", user: safeUser(user), token: signUserToken(user) });
});

app.post("/api/orders", requireUser, (req, res) => {
  const { user, items, total, address } = req.body;
  if (!user || !items || !items.length || !address) {
    return res.status(400).json({ message: "Please provide customer, items and delivery address." });
  }

  if (req.body.paymentMethod === "Online") {
    if (!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: "Online payment is not configured." });
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(String(req.body.razorpayOrderId||"")+"|"+String(req.body.paymentId||"")).digest("hex");
    if (expected !== req.body.paymentSignature) return res.status(400).json({ message: "Payment verification failed." });
  }
  const data = readData();
  if (user.id !== req.userAuth.id || user.email !== req.userAuth.email) return res.status(403).json({ message: "Customer identity does not match." });
  for (const item of items) {
    const product = data.products.find(p => p.id === item.id);
    if (!product) return res.status(404).json({ message: "A product in your bag is no longer available." });
    if (Number(product.stock || 0) < Number(item.qty || 1)) return res.status(409).json({ message: `Insufficient stock for ${product.name}.` });
  }
  let finalTotal = items.reduce((sum,item) => { const p=data.products.find(x=>x.id===item.id); return sum + Number(p.price)*Number(item.qty||1); }, 0);
  const coupon = data.coupons.find(c => c.active && c.code === String(req.body.coupon||"").toUpperCase() && (!c.expiresAt || new Date(c.expiresAt) >= new Date()));
  if (coupon) finalTotal = Math.max(0, finalTotal - (coupon.type === "flat" ? coupon.value : finalTotal * coupon.value / 100));
  items.forEach(item => { const product = data.products.find(p => p.id === item.id); if (product) product.stock = Math.max(0, Number(product.stock || 0) - Number(item.qty || 1)); });
  const order = {
    id: "SGJ-" + Date.now().toString().slice(-8),
    user: { id: user.id, name: user.name, email: user.email },
    items,
    total: Math.round(finalTotal),
    address: String(address).trim(),
    status: "Confirmed",
    payment: { method: req.body.paymentMethod || "COD", status: req.body.paymentMethod === "Online" ? "Paid" : "Pending", paymentId: req.body.paymentId || "" },
    coupon: req.body.coupon || "",
    tracking: [{ status: "Confirmed", at: new Date().toISOString() }],
    createdAt: new Date().toISOString()
  };
  data.orders.unshift(order);
  writeData(data);
  res.status(201).json({ message: "Order placed successfully.", order });
});

app.get("/api/orders/:email", requireUser, (req, res) => {
  const data = readData();
  const email = String(req.params.email).toLowerCase();
  if (email !== req.userAuth.email) return res.status(403).json({ message: "Access denied." });
  res.json(data.orders.filter(o => o.user.email === email));
});

app.put("/api/account/:email", requireUser, async (req, res) => {
  const data = readData(), user = data.users.find(u => u.email === String(req.params.email).toLowerCase());
  if (!user || user.id !== req.userAuth.id) return res.status(403).json({ message: "Access denied." });
  if (req.body.name) user.name = String(req.body.name).trim();
  if (req.body.phone !== undefined) user.phone = String(req.body.phone).trim();
  if (Array.isArray(req.body.addresses)) user.addresses = req.body.addresses.slice(0, 5);
  writeData(data); res.json(safeUser(user));
});

app.post("/api/account/:email/wishlist/:productId", requireUser, (req, res) => {
  const data = readData(), user = data.users.find(u => u.email === String(req.params.email).toLowerCase());
  if (!user || user.id !== req.userAuth.id) return res.status(403).json({ message: "Access denied." });
  user.wishlist = user.wishlist || []; const pid = req.params.productId;
  user.wishlist = user.wishlist.includes(pid) ? user.wishlist.filter(x => x !== pid) : [...user.wishlist, pid];
  writeData(data); res.json({ wishlist: user.wishlist });
});

app.post("/api/orders/:id/cancel", requireUser, (req, res) => {
  const data = readData(), order = data.orders.find(o => o.id === req.params.id && o.user.id === req.userAuth.id);
  if (!order || !["Confirmed","Processing"].includes(order.status)) return res.status(400).json({ message: "Order cannot be cancelled." });
  order.status = "Cancelled"; order.updatedAt = new Date().toISOString();
  order.items.forEach(item => { const p = data.products.find(x => x.id === item.id); if (p) p.stock = Number(p.stock || 0) + Number(item.qty || 1); });
  writeData(data); res.json(order);
});

app.post("/api/contact", (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ message: "Please fill all required fields." });

  const data = readData();
  data.messages.unshift({
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone || "").trim(),
    message: String(message).trim(),
    createdAt: new Date().toISOString()
  });
  writeData(data);
  res.status(201).json({ message: "Thank you! Your message has been received." });
});


// ---------------------------
// Admin authentication
// ---------------------------
app.post("/api/admin/login", async (req, res) => {
  const { userId, email, password } = req.body;
  const admin = readAdmin();
  const suppliedId = String(userId || email || "").trim();
  if (suppliedId !== admin.userId || !(await bcrypt.compare(String(password || ""), admin.passwordHash))) {
    return res.status(401).json({ message: "Invalid admin User ID or password." });
  }
  if (!process.env.ADMIN_KEY) return res.status(503).json({ message: "ADMIN_KEY is not configured on the server." });
  res.json({ message: "Admin login successful.", admin: { userId: admin.userId }, key: process.env.ADMIN_KEY });
});

// ---------------------------
// Admin dashboard overview
// ---------------------------

app.post("/api/admin/recover-user-id", async (req, res) => {
  const admin = readAdmin();
  if (!(await bcrypt.compare(String(req.body.recoveryCode || ""), admin.recoveryCodeHash))) {
    return res.status(401).json({ message: "Invalid recovery code." });
  }
  res.json({ userId: admin.userId });
});

app.post("/api/admin/reset-password", async (req, res) => {
  const admin = readAdmin();
  if (String(req.body.userId || "").trim() !== admin.userId) return res.status(401).json({ message: "User ID does not match." });
  if (!(await bcrypt.compare(String(req.body.recoveryCode || ""), admin.recoveryCodeHash))) return res.status(401).json({ message: "Invalid recovery code." });
  if (String(req.body.newPassword || "").length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
  admin.passwordHash = await bcrypt.hash(String(req.body.newPassword), 10);
  admin.updatedAt = new Date().toISOString();
  writeAdmin(admin);
  res.json({ message: "Password reset successfully." });
});

app.put("/api/admin/change-credentials", requireAdmin, async (req, res) => {
  const admin = readAdmin();
  if (!(await bcrypt.compare(String(req.body.currentPassword || ""), admin.passwordHash))) {
    return res.status(401).json({ message: "Current password is incorrect." });
  }
  if (req.body.newUserId) admin.userId = String(req.body.newUserId).trim();
  if (req.body.newPassword) {
    if (String(req.body.newPassword).length < 8) return res.status(400).json({ message: "New password must be at least 8 characters." });
    admin.passwordHash = await bcrypt.hash(String(req.body.newPassword), 10);
  }
  if (req.body.newRecoveryCode) {
    if (String(req.body.newRecoveryCode).length < 8) return res.status(400).json({ message: "Recovery code must be at least 8 characters." });
    admin.recoveryCodeHash = await bcrypt.hash(String(req.body.newRecoveryCode), 10);
  }
  admin.updatedAt = new Date().toISOString();
  writeAdmin(admin);
  res.json({ message: "Admin credentials updated successfully.", admin: { userId: admin.userId } });
});

app.get("/api/admin/stats", requireAdmin, (req, res) => {
  const data = readData();
  const revenue = data.orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  res.json({
    products: data.products.length,
    customers: data.users.length,
    orders: data.orders.length,
    messages: data.messages.length,
    offers: data.offers.length,
    revenue,
    lowStock: data.products.filter(p => Number(p.stock || 0) <= 3).length,
    appointments: data.appointments.length,
    customRequests: data.customRequests.length,
    storage: process.env.MONGODB_URI ? "MongoDB configured" : "JSON fallback"
  });
});

app.get("/api/admin/products", requireAdmin, (req, res) => {
  res.json(readData().products);
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const { name, category, price, oldPrice, purity, badge, icon, discount, image, stock, weight, makingCharges, description, sizes, active } = req.body;
  if (!name || !category || !price) return res.status(400).json({ message: "Name, category and price are required." });
  const data = readData();
  const product = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    category: String(category),
    price: Number(price),
    purity: String(purity || ""),
    badge: String(badge || "New"),
    icon: String(icon || "ring"),
    discount: Number(discount || 0),
    image: typeof image === "string" && (/^data:image\/(jpeg|png|webp);base64,/.test(image) || /^https:\/\//.test(image)) ? image : "",
    oldPrice: Number(oldPrice || 0), stock: Number(stock || 0), weight: Number(weight || 0), makingCharges: Number(makingCharges || 0),
    description: String(description || ""), sizes: String(sizes || "").split(",").map(s => s.trim()).filter(Boolean), active: active !== "false"
  };
  data.products.unshift(product);
  writeData(data);
  res.status(201).json(product);
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const data = readData();
  const product = data.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found." });

  const allowed = ["name","category","price","oldPrice","purity","badge","icon","discount","image","stock","weight","makingCharges","description","active"];
  allowed.forEach(k => {
    if (req.body[k] !== undefined) product[k] = ["price","oldPrice","discount","stock","weight","makingCharges"].includes(k) ? Number(req.body[k]) : k === "active" ? req.body[k] !== "false" : String(req.body[k]);
  });
  if (req.body.sizes !== undefined) product.sizes = String(req.body.sizes).split(",").map(s => s.trim()).filter(Boolean);
  writeData(data);
  res.json(product);
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const data = readData();
  const before = data.products.length;
  data.products = data.products.filter(p => p.id !== req.params.id);
  if (data.products.length === before) return res.status(404).json({ message: "Product not found." });
  writeData(data);
  res.json({ message: "Product deleted." });
});

app.post("/api/admin/images", requireAdmin, async (req, res) => {
  const image = String(req.body.image || "");
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image)) return res.status(400).json({ message: "Valid image required." });
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.json({ url: image, storage: "database" });
  try {
    const timestamp = Math.floor(Date.now()/1000), folder = "shree-dhelana-shyam";
    const signature = crypto.createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`).digest("hex");
    const form = new FormData(); form.append("file", image); form.append("api_key", process.env.CLOUDINARY_API_KEY); form.append("timestamp", String(timestamp)); form.append("folder", folder); form.append("signature", signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method:"POST", body:form });
    const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || "Cloudinary upload failed.");
    res.json({ url: result.secure_url, storage: "cloudinary" });
  } catch (err) { res.status(502).json({ message: err.message }); }
});

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  res.json(readData().orders);
});

app.put("/api/admin/orders/:id/status", requireAdmin, (req, res) => {
  const allowed = ["Confirmed","Processing","Shipped","Delivered","Cancelled"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: "Invalid order status." });
  const data = readData();
  const order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found." });
  order.status = req.body.status;
  order.tracking = order.tracking || [];
  order.tracking.push({ status: order.status, note: String(req.body.note || ""), at: new Date().toISOString() });
  order.updatedAt = new Date().toISOString();
  writeData(data);
  res.json(order);
});

app.get("/api/admin/customers", requireAdmin, (req, res) => {
  const data = readData();
  res.json(data.users.map(u => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone, blocked: !!u.blocked, createdAt: u.createdAt
  })));
});

app.put("/api/admin/customers/:id/block", requireAdmin, (req, res) => {
  const data = readData(); const user = data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: "Customer not found." });
  user.blocked = Boolean(req.body.blocked); writeData(data); res.json({ message: user.blocked ? "Customer blocked." : "Customer unblocked." });
});

app.get("/api/admin/messages", requireAdmin, (req, res) => {
  res.json(readData().messages);
});

app.delete("/api/admin/messages/:id", requireAdmin, (req, res) => {
  const data = readData();
  data.messages = data.messages.filter(m => m.id !== req.params.id);
  writeData(data);
  res.json({ message: "Message deleted." });
});

// ---------------------------
// Offers / promotional banners
// ---------------------------
app.get("/api/offers", (req, res) => {
  res.json(readData().offers);
});

app.get("/api/admin/offers", requireAdmin, (req, res) => {
  res.json(readData().offers);
});

app.post("/api/admin/offers", requireAdmin, (req, res) => {
  const { title, subtitle, discount, code, active } = req.body;
  if (!title) return res.status(400).json({ message: "Offer title is required." });
  const data = readData();
  const offer = {
    id: crypto.randomUUID(),
    title: String(title).trim(),
    subtitle: String(subtitle || "").trim(),
    discount: Number(discount || 0),
    code: String(code || "").trim().toUpperCase(),
    active: active !== false,
    createdAt: new Date().toISOString()
  };
  data.offers.unshift(offer);
  writeData(data);
  res.status(201).json(offer);
});

app.put("/api/admin/offers/:id", requireAdmin, (req, res) => {
  const data = readData();
  const offer = data.offers.find(o => o.id === req.params.id);
  if (!offer) return res.status(404).json({ message: "Offer not found." });
  ["title","subtitle","code"].forEach(k => { if (req.body[k] !== undefined) offer[k] = String(req.body[k]); });
  if (req.body.discount !== undefined) offer.discount = Number(req.body.discount);
  if (req.body.active !== undefined) offer.active = Boolean(req.body.active);
  writeData(data);
  res.json(offer);
});

app.delete("/api/admin/offers/:id", requireAdmin, (req, res) => {
  const data = readData();
  data.offers = data.offers.filter(o => o.id !== req.params.id);
  writeData(data);
  res.json({ message: "Offer deleted." });
});

// Rates, coupons, reviews, appointments and custom jewellery requests
app.get("/api/rates", (req, res) => res.json(readData().rates));
app.get("/api/reviews", (req, res) => res.json(readData().reviews.filter(r => r.approved)));
app.post("/api/reviews", (req, res) => { const data=readData(); data.reviews.unshift({id:crypto.randomUUID(),name:String(req.body.name||"Customer"),rating:Math.min(5,Math.max(1,Number(req.body.rating)||5)),comment:String(req.body.comment||""),approved:false,createdAt:new Date().toISOString()});writeData(data);res.status(201).json({message:"Review submitted for approval."}) });
app.post("/api/appointments", (req, res) => { const data=readData();data.appointments.unshift({id:"APT-"+Date.now(),...req.body,status:"Requested",createdAt:new Date().toISOString()});writeData(data);res.status(201).json({message:"Appointment requested successfully."}) });
app.post("/api/custom-requests", (req, res) => { const data=readData();data.customRequests.unshift({id:"CUSTOM-"+Date.now(),...req.body,status:"New",createdAt:new Date().toISOString()});writeData(data);res.status(201).json({message:"Custom jewellery request received."}) });

app.get("/api/admin/rates", requireAdmin, (req,res)=>res.json(readData().rates));
app.put("/api/admin/rates", requireAdmin, (req,res)=>{const data=readData();data.rates={gold22k:Number(req.body.gold22k||0),gold24k:Number(req.body.gold24k||0),silver:Number(req.body.silver||0),updatedAt:new Date().toISOString()};writeData(data);res.json(data.rates)});
app.get("/api/admin/coupons", requireAdmin, (req,res)=>res.json(readData().coupons));
app.post("/api/admin/coupons", requireAdmin, (req,res)=>{const data=readData(),coupon={id:crypto.randomUUID(),code:String(req.body.code||"").toUpperCase(),type:req.body.type||"percent",value:Number(req.body.value||0),expiresAt:req.body.expiresAt||"",active:true};data.coupons.unshift(coupon);writeData(data);res.status(201).json(coupon)});
app.delete("/api/admin/coupons/:id", requireAdmin, (req,res)=>{const data=readData();data.coupons=data.coupons.filter(c=>c.id!==req.params.id);writeData(data);res.json({message:"Coupon deleted."})});
app.get("/api/admin/business", requireAdmin, (req,res)=>{const d=readData();res.json({reviews:d.reviews,appointments:d.appointments,customRequests:d.customRequests})});
app.put("/api/admin/reviews/:id", requireAdmin, (req,res)=>{const d=readData(),review=d.reviews.find(r=>r.id===req.params.id);if(!review)return res.status(404).json({message:"Review not found."});review.approved=Boolean(req.body.approved);writeData(d);res.json(review)});
app.get("/api/admin/reports", requireAdmin, (req,res)=>{const d=readData(),daily={},sales={};d.orders.filter(o=>o.status!=="Cancelled").forEach(o=>{const day=String(o.createdAt).slice(0,10);daily[day]=(daily[day]||0)+Number(o.total||0);o.items.forEach(i=>sales[i.name]=(sales[i.name]||0)+Number(i.qty||1))});res.json({daily:Object.entries(daily).map(([date,revenue])=>({date,revenue})).slice(-30),bestSellers:Object.entries(sales).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,qty])=>({name,qty})),lowStock:d.products.filter(p=>Number(p.stock||0)<=3)})});
app.get("/api/admin/export/:type", requireAdmin, (req,res)=>{const rows=readData()[req.params.type];if(!Array.isArray(rows))return res.status(404).end();const flat=rows.map(x=>({id:x.id||"",name:x.name||x.user?.name||"",email:x.email||x.user?.email||"",total:x.total||"",status:x.status||"",createdAt:x.createdAt||""})),keys=["id","name","email","total","status","createdAt"];res.type("text/csv").send([keys.join(","),...flat.map(r=>keys.map(k=>JSON.stringify(r[k]??"")).join(","))].join("\n"))});

app.post("/api/payments/create", requireUser, async (req,res)=>{
  if(!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({message:"Razorpay is not configured. Use Cash on Delivery."});
  try {
    const data=readData();let payable=(req.body.items||[]).reduce((sum,item)=>{const p=data.products.find(x=>x.id===item.id);return sum+(p?Number(p.price)*Number(item.qty||1):0)},0);const coupon=data.coupons.find(c=>c.active&&c.code===String(req.body.coupon||"").toUpperCase()&&(!c.expiresAt||new Date(c.expiresAt)>=new Date()));if(coupon)payable=Math.max(0,payable-(coupon.type==="flat"?coupon.value:payable*coupon.value/100));
    const auth=Buffer.from(process.env.RAZORPAY_KEY_ID+":"+process.env.RAZORPAY_KEY_SECRET).toString("base64");
    const response=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Basic "+auth},body:JSON.stringify({amount:Math.round(payable*100),currency:"INR",receipt:"SGJ-"+Date.now()})});
    const order=await response.json();if(!response.ok)throw new Error(order.error?.description||"Razorpay order failed.");res.json({...order,keyId:process.env.RAZORPAY_KEY_ID});
  } catch(err){res.status(502).json({message:err.message})}
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

initPersistence().finally(() => app.listen(PORT, () => {
  console.log(`Shree Dhelana Shyam Jewellers running at http://localhost:${PORT}`);
}));
