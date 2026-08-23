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
    <span class="badge">${p.badge}</span><button class="heart" aria-label="Wishlist">♡</button>
    ${p.image?`<img class="product-photo" src="${p.image}" alt="${p.name}">`:`<div class="${shape}"></div>`}
  </div>`;
}

function renderProducts(filter="All") {
  const list = state.products.filter(p => filter === "All" || p.category === filter);
  $("#productGrid").innerHTML = list.map(p => `
    <article class="product-card">
      ${productVisual(p)}
      <div class="product-info">
        <small>${p.purity} • ${p.category.toUpperCase()}</small>
        <h3>${p.name}</h3>
        <div class="price-row"><span class="price">${money(p.price)}</span><button class="add-btn" data-add="${p.id}">ADD TO BAG +</button></div>
      </div>
    </article>`).join("");
  $$("#productGrid [data-add]").forEach(btn => btn.addEventListener("click", () => addToCart(btn.dataset.add)));
}

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
  const res = await fetch(url,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data = await res.json().catch(()=>({message:"Something went wrong."}));
  if(!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function loadProducts() {
  try { state.products = await api("/api/products"); renderProducts(); }
  catch(e){ toast(e.message); }
}

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
  const address=new FormData(e.target).get("address");
  const total=state.cart.reduce((sum,x)=>sum+x.price*x.qty,0);
  try {
    const data=await api("/api/orders",{method:"POST",body:JSON.stringify({user:state.user,items:state.cart,total,address})});
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
updateCartCount();loadProducts();