const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "store.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultData = {
  users: [],
  orders: [],
  messages: [],
  offers: [],
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
    if (!Array.isArray(data.offers)) data.offers = [];
    return data;
  } catch { return JSON.parse(JSON.stringify(defaultData)); }
}
function writeData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone };
}

const ADMIN_FILE = path.join(DATA_DIR, "admin.json");

function ensureAdminFile() {
  if (!fs.existsSync(ADMIN_FILE)) {
    const initialAdmin = {
      userId: "Prakash@9116",
      passwordHash: bcrypt.hashSync("Kumawat@916", 10),
      recoveryCodeHash: bcrypt.hashSync("Prakash-Recovery@916", 10),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(initialAdmin, null, 2));
  }
}
function readAdmin() { ensureAdminFile(); return JSON.parse(fs.readFileSync(ADMIN_FILE, "utf8")); }
function writeAdmin(admin) { fs.writeFileSync(ADMIN_FILE, JSON.stringify(admin, null, 2)); }
function isAdmin(req) { return req.headers["x-admin-key"] === (process.env.ADMIN_KEY || "shree-gelam-admin"); }
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ message: "Admin access required." });
  next();
}

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
    createdAt: new Date().toISOString()
  };
  data.users.push(user);
  writeData(data);

  res.status(201).json({ message: "Registration successful.", user: safeUser(user) });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const data = readData();
  const user = data.users.find(u => u.email === String(email || "").trim().toLowerCase());

  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  res.json({ message: "Login successful.", user: safeUser(user) });
});

app.post("/api/orders", (req, res) => {
  const { user, items, total, address } = req.body;
  if (!user || !items || !items.length || !address) {
    return res.status(400).json({ message: "Please provide customer, items and delivery address." });
  }

  const data = readData();
  const order = {
    id: "SGJ-" + Date.now().toString().slice(-8),
    user: { id: user.id, name: user.name, email: user.email },
    items,
    total: Number(total || 0),
    address: String(address).trim(),
    status: "Confirmed",
    createdAt: new Date().toISOString()
  };
  data.orders.unshift(order);
  writeData(data);
  res.status(201).json({ message: "Order placed successfully.", order });
});

app.get("/api/orders/:email", (req, res) => {
  const data = readData();
  const email = String(req.params.email).toLowerCase();
  res.json(data.orders.filter(o => o.user.email === email));
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
  res.json({ message: "Admin login successful.", admin: { userId: admin.userId }, key: process.env.ADMIN_KEY || "shree-gelam-admin" });
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
    revenue
  });
});

app.get("/api/admin/products", requireAdmin, (req, res) => {
  res.json(readData().products);
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const { name, category, price, purity, badge, icon, discount, image } = req.body;
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
    image: typeof image === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(image) ? image : ""
  };
  data.products.unshift(product);
  writeData(data);
  res.status(201).json(product);
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const data = readData();
  const product = data.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found." });

  const allowed = ["name","category","price","purity","badge","icon","discount","image"];
  allowed.forEach(k => {
    if (req.body[k] !== undefined) product[k] = k === "price" || k === "discount" ? Number(req.body[k]) : String(req.body[k]);
  });
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
  order.updatedAt = new Date().toISOString();
  writeData(data);
  res.json(order);
});

app.get("/api/admin/customers", requireAdmin, (req, res) => {
  const data = readData();
  res.json(data.users.map(u => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone, createdAt: u.createdAt
  })));
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

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Shree Dhelana Shyam Jewellers running at http://localhost:${PORT}`);
});