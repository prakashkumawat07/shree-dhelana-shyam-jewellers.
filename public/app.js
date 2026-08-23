const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem("sgj_cart") || "[]"),
  user: JSON.parse(localStorage.getItem("sgj_user") || "null")
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const money = (n) => "₹" + Number(n).toLocaleString("en-IN");

function saveCart() {
  localStorage.setItem("sgj_cart", JSON.stringify(state.cart));
  updateCartCount();
}
function updateCartCount() {
  $("#cartCount").textContent = state.cart.reduce((sum, x) => sum + x.qty, 0);
}
function toast(message) {
  const t = $("#toast"); t.textContent = message; t.classList.add("show");
  clearTimeout(window.__toast); window.__toast = setTimeout(() => t.classList.remove("show"), 2500);
}
function openModal(id){ $("#" + id).classList.add("open"); document.body.style.overflow="hidden"; }
function closeModal(id){ $("#" + id).classList.remove("open"); document.body.style.overflow=""; }
function openAccount(){ openModal("accountModal"); }
function openContact(){ document.querySelector("#contact").scrollIntoView({behavior:"smooth"}); }
window.openAccount = openAccount; window.openContact = openContact;

function productVisual(p) {
  const cls = p.category === "Silver" ? "silver-v" : "";
  let shape = "jewel-shape";
  if (p.icon === "ring") shape += " ring-shape";
  if (p.icon === "earrings") shape += " earring-shape";
  if (p.category === "Silver") shape += " silver-shape";
  return `<div class="product-visual ${cls}">
    <span class="badge">${p.badge}</span><button class="heart" data-wishlist="${p.id}" aria-label="Wishlist">${state.user?.wishlist?.includes(p.id)?"♥":"♡"}</button>
    ${p.image?`<img class="product-photo" src="${p.image}" alt="${p.name}">`:`<div class="${shape}"></div>`}
  </div>`;
}

function renderProducts(filter="All") {
  const list = state.products.filter(p => filter === "All" || p.category === filter);
  $("#productGrid").innerHTML = list.map(p => `
    <article class="product-card">
      ${productVisual(p)}
      <div class="product-info">
        <small>${p.purity} • ${p.category.toUpperCase()}${p.weight?` • ${p.weight}g`:""}</small>
        <h3>${p.name}</h3>
        <p class="product-description">${p.description||""}</p>
        <div class="stock-line ${Number(p.stock||0)<=3?"low-stock":""}">${Number(p.stock||0)>0?(Number(p.stock)<=3?`Only ${p.stock} left`:`In stock: ${p.stock}`):"Out of stock"}</div>
        <div class="price-row"><span class="price">${money(p.price)}${p.oldPrice?` <s>${money(p.oldPrice)}</s>`:""}</span><button class="add-btn" data-add="${p.id}" ${Number(p.stock||0)<=0?"disabled":""}>${Number(p.stock||0)>0?"ADD TO BAG +":"OUT OF STOCK"}</button></div>
      </div>
    </article>`).join("");
  $$("#productGrid [data-add]").forEach(btn => btn.addEventListener("click", () => addToCart(btn.dataset.add)));
  $$("#productGrid [data-wishlist]").forEach(btn => btn.addEventListener("click", () => toggleWishlist(btn.dataset.wishlist)));
}

async function toggleWishlist(id){if(!state.user){openAccount();toast("Please login to use wishlist.");return}try{const d=await api(`/api/account/${encodeURIComponent(state.user.email)}/wishlist/${id}`,{method:"POST"});state.user.wishlist=d.wishlist;localStorage.setItem("sgj_user",JSON.stringify(state.user));renderProducts();toast("Wishlist updated.")}catch(e){toast(e.message)}}

function addToCart(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  const existing = state.cart.find(x => x.id === id);
  if (existing) existing.qty++;
  else state.cart.push({ id, name: product.name, price: product.price, qty: 1 });
  saveCart(); toast(`${product.name} added to your bag.`);
}

function renderCart() {
  if (!state.cart.length) {
    $("#cartItems").innerHTML = `<div style="padding:25px 0;text-align:center;color:#8c7c7c;font-size:12px">Your bag is empty.<br><br><a href="#products" onclick="closeModal('cartModal')" style="color:#946b20;font-weight:800">Explore collection →</a></div>`;
  } else {
    $("#cartItems").innerHTML = state.cart.map(x => `
      <div class="cart-item">
        <div><h4>${x.name}</h4><small>${money(x.price)} each</small></div>
        <div class="cart-item-actions">
          <button class="mini" data-minus="${x.id}">−</button><b>${x.qty}</b><button class="mini" data-plus="${x.id}">+</button>
          <button class="mini" data-remove="${x.id}">×</button>
        </div>
      </div>`).join("");
  }
  const total = state.cart.reduce((sum,x)=>sum+x.price*x.qty,0);
  $("#cartTotal").textContent = money(total);
  $$("#cartItems [data-minus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.minus,-1));
  $$("#cartItems [data-plus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.plus,1));
  $$("#cartItems [data-remove]").forEach(b=>b.onclick=()=>removeItem(b.dataset.remove));
}
function changeQty(id, delta) {
  const x=state.cart.find(i=>i.id===id); if(!x)return;
  x.qty += delta; if(x.qty<=0) state.cart=state.cart.filter(i=>i.id!==id);
  saveCart(); renderCart();
}
function removeItem(id){state.cart=state.cart.filter(i=>i.id!==id);saveCart();renderCart();}

async function api(url, options={}) {
  const res = await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data = await res.json().catch(()=>({message:"Something went wrong."}));
  if(!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function loadProducts() {
  try { state.products = await api("/api/products"); renderProducts(); }
  catch(e){ toast(e.message); }
}

async function loadRates(){try{const r=await api("/api/rates");$("#metalRates").innerHTML=r.updatedAt?`आज का भाव • 22K Gold: <b>${money(r.gold22k)}/10g</b> • 24K Gold: <b>${money(r.gold24k)}/10g</b> • Silver: <b>${money(r.silver)}/kg</b>`:"आज का Gold & Silver भाव जल्द अपडेट होगा।"}catch{}}
async function loadReviews(){try{const rs=await api("/api/reviews");$("#reviewsGrid").innerHTML=rs.slice(0,6).map(r=>`<article class="review-card"><div>${"★".repeat(r.rating)}</div><p>${r.comment}</p><b>${r.name}</b></article>`).join("")}catch{}}
function businessForm(id,url){$(id).onsubmit=async e=>{e.preventDefault();const msg=e.target.querySelector(".form-msg");try{const d=await api(url,{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});msg.textContent=d.message;e.target.reset();toast(d.message)}catch(err){msg.textContent=err.message}}}

function switchAuth(mode){
  const login = mode==="login";
  $("#loginTab").classList.toggle("active",login); $("#registerTab").classList.toggle("active",!login);
  $("#loginForm").classList.toggle("hidden",!login); $("#registerForm").classList.toggle("hidden",login);
  $("#accountTitle").textContent = login ? "Welcome back" : "Create your account";
  $("#accountSub").textContent = login ? "Login to manage your orders and account." : "Join us for a more personal jewellery experience.";
  $("#authMsg").textContent="";
}

$("#accountBtn").onclick=openAccount;
$("#loginTab").onclick=()=>switchAuth("login");
$("#registerTab").onclick=()=>switchAuth("register");
$("#cartBtn").onclick=()=>{renderCart();openModal("cartModal")};
$$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$$(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));

$("#loginForm").addEventListener("submit", async e=>{
  e.preventDefault(); const fd=new FormData(e.target); const msg=$("#authMsg");
  try {
    const data=await api("/api/login",{method:"POST",body:JSON.stringify(Object.fromEntries(fd))});
    state.user=data.user; localStorage.setItem("sgj_user",JSON.stringify(data.user));
    $("#accountBtn").textContent="Account"; msg.textContent="Login successful."; toast("Welcome back, "+data.user.name+"!");
    setTimeout(()=>closeModal("accountModal"),700);
  } catch(err){msg.textContent=err.message}
});
$("#registerForm").addEventListener("submit", async e=>{
  e.preventDefault(); const fd=new FormData(e.target); const msg=$("#authMsg");
  try {
    const data=await api("/api/register",{method:"POST",body:JSON.stringify(Object.fromEntries(fd))});
    state.user=data.user; localStorage.setItem("sgj_user",JSON.stringify(data.user));
    $("#accountBtn").textContent="Account"; msg.textContent="Account created successfully."; toast("Welcome to Shree Dhelana Shyam Jewellers!");
    setTimeout(()=>closeModal("accountModal"),700);
  } catch(err){msg.textContent=err.message}
});

$("#orderForm").addEventListener("submit", async e=>{
  e.preventDefault();
  if(!state.user){closeModal("cartModal");openModal("accountModal");switchAuth("login");toast("Please login before placing an order.");return;}
  if(!state.cart.length){toast("Your bag is empty.");return;}
  const orderData=Object.fromEntries(new FormData(e.target));const address=orderData.address;
  const total=state.cart.reduce((sum,x)=>sum+x.price*x.qty,0);
  try {
    let payment={};
    if(orderData.paymentMethod==="Online"){
      const ro=await api("/api/payments/create",{method:"POST",body:JSON.stringify({items:state.cart,coupon:orderData.coupon})});
      payment=await new Promise((resolve,reject)=>{if(!window.Razorpay)return reject(new Error("Payment checkout could not load."));const checkout=new Razorpay({key:ro.keyId,amount:ro.amount,currency:"INR",name:"Shree Dhelana Shyam Jewellers",description:"Jewellery order",order_id:ro.id,prefill:{name:state.user.name,email:state.user.email,contact:state.user.phone},handler:r=>resolve({razorpayOrderId:r.razorpay_order_id,paymentId:r.razorpay_payment_id,paymentSignature:r.razorpay_signature}),modal:{ondismiss:()=>reject(new Error("Payment cancelled."))}});checkout.open()});
    }
    const data=await api("/api/orders",{method:"POST",body:JSON.stringify({user:state.user,items:state.cart,total,address,coupon:orderData.coupon,paymentMethod:orderData.paymentMethod,...payment})});
    state.cart=[];saveCart();renderCart();e.target.reset();
    $("#orderMsg").textContent=`Order ${data.order.id} confirmed!`;
    toast("Order placed successfully.");
  } catch(err){$("#orderMsg").textContent=err.message}
});

$("#contactForm").addEventListener("submit",async e=>{
  e.preventDefault();const msg=$("#contactMsg");
  try{const data=await api("/api/contact",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});msg.textContent=data.message;e.target.reset();toast("Message sent.");}
  catch(err){msg.textContent=err.message}
});

$$("[data-product-filter]").forEach(b=>b.onclick=()=>{
  $$(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderProducts(b.dataset.productFilter);
});
$$("[data-filter]").forEach(b=>b.onclick=()=>{document.querySelector("#products").scrollIntoView({behavior:"smooth"});const f=b.dataset.filter;setTimeout(()=>{const target=$(`[data-product-filter="${f}"]`);target.click()},350)});

$("#searchBtn").onclick=()=>{
  const q=prompt("Search jewellery");
  if(!q)return;
  const match=state.products.find(p=>p.name.toLowerCase().includes(q.toLowerCase())||p.category.toLowerCase().includes(q.toLowerCase()));
  if(match){document.querySelector("#products").scrollIntoView({behavior:"smooth"});toast(match.name+" found in our collection.");}
  else toast("No matching jewellery found.");
};

if(state.user) $("#accountBtn").textContent="Account";
businessForm("#appointmentForm","/api/appointments");businessForm("#customRequestForm","/api/custom-requests");businessForm("#reviewForm","/api/reviews");
updateCartCount();loadProducts();loadRates();loadReviews();
