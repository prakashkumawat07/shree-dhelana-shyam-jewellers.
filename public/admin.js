const A={key:localStorage.getItem("sgj_admin_key")||"",userId:localStorage.getItem("sgj_admin_userid")||""};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN");
async function api(url,opt={}) {
  const res=await fetch(url,{...opt,headers:{"Content-Type":"application/json","x-admin-key":A.key,...(opt.headers||{})}});
  const data=await res.json().catch(()=>({message:"Request failed"}));
  if(!res.ok) throw new Error(data.message||"Request failed"); return data;
}
function toast(m){const t=$("#adminToast");t.textContent=m;t.classList.add("show");clearTimeout(window.tt);window.tt=setTimeout(()=>t.classList.remove("show"),2200)}
function modal(id,open=true){$("#"+id).classList.toggle("open",open)}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

async function boot(){
  if(!A.key){$("#loginScreen").style.display="flex";return}
  try{await api("/api/admin/stats");showApp();loadAll()}catch{localStorage.removeItem("sgj_admin_key");$("#loginScreen").style.display="flex"}
}
function showApp(){$("#loginScreen").style.display="none";$("#adminApp").style.display="grid";$("#adminEmail").textContent="Admin: "+A.userId}

$("#adminLoginForm").onsubmit=async e=>{
  e.preventDefault();const fd=Object.fromEntries(new FormData(e.target));
  try{const d=await api("/api/admin/login",{method:"POST",headers:{},body:JSON.stringify(fd)});A.key=d.key;A.userId=d.admin.userId;localStorage.setItem("sgj_admin_key",A.key);localStorage.setItem("sgj_admin_userid",A.userId);showApp();loadAll()}
  catch(err){$("#loginError").textContent=err.message}
};
$("#logout").onclick=()=>{localStorage.removeItem("sgj_admin_key");localStorage.removeItem("sgj_admin_userid");location.reload()};

$$(".side-nav [data-page]").forEach(b=>b.onclick=()=>openPage(b.dataset.page));
$$("[data-page-jump]").forEach(b=>b.onclick=()=>openPage(b.dataset.pageJump));
function openPage(name){
  $$(".page").forEach(p=>p.classList.remove("active"));$("#page-"+name).classList.add("active");
  $$(".side-nav [data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  $("#topTitle").textContent=name[0].toUpperCase()+name.slice(1);
  if(name==="dashboard")loadDashboard();if(name==="products")loadProducts();if(name==="orders")loadOrders();if(name==="customers")loadCustomers();if(name==="offers")loadOffers();if(name==="messages")loadMessages();
}
async function loadAll(){loadDashboard();loadProducts();loadOrders();loadCustomers();loadOffers();loadMessages()}

async function loadDashboard(){
  const d=await api("/api/admin/stats");
  $("#statProducts").textContent=d.products;$("#statOrders").textContent=d.orders;$("#statCustomers").textContent=d.customers;$("#statMessages").textContent=d.messages;$("#statRevenue").textContent=money(d.revenue);
  const orders=await api("/api/admin/orders");
  $("#recentOrders").innerHTML=orders.slice(0,5).length?tableOrders(orders.slice(0,5),false):'<div class="empty">No orders yet.</div>';
}
function tableOrders(list,full=true){
 return `<table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th>${full?"<th>Items</th>":""}${full?"<th>Update</th>":""}</tr></thead><tbody>${list.map(o=>`<tr><td><strong>${esc(o.id)}</strong><br><span class="muted">${new Date(o.createdAt).toLocaleString()}</span></td><td>${esc(o.user.name)}<br><span class="muted">${esc(o.user.email)}</span></td><td>${money(o.total)}</td><td><span class="status ${esc(o.status)}">${esc(o.status)}</span></td>${full?`<td>${o.items.map(i=>esc(i.name)+" × "+i.qty).join("<br>")}</td><td><select data-status="${esc(o.id)}"><option ${o.status==="Confirmed"?"selected":""}>Confirmed</option><option ${o.status==="Processing"?"selected":""}>Processing</option><option ${o.status==="Shipped"?"selected":""}>Shipped</option><option ${o.status==="Delivered"?"selected":""}>Delivered</option><option ${o.status==="Cancelled"?"selected":""}>Cancelled</option></select></td>`:""}</tr>`).join("")}</tbody></table>`;
}
async function loadProducts(){
 const ps=await api("/api/admin/products");
 $("#productsTable").innerHTML=ps.length?`<table class="table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Discount</th><th>Purity</th><th>Actions</th></tr></thead><tbody>${ps.map(p=>`<tr><td><div class="admin-product-cell">${p.image?`<img src="${p.image}" alt="">`:""}<div><strong>${esc(p.name)}</strong><br><span class="muted">${esc(p.badge||"")}</span></div></div></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${Number(p.discount||0)}%</td><td>${esc(p.purity)}</td><td><button class="btn btn-small btn-gold" data-edit-product="${p.id}">Edit</button> <button class="btn btn-small btn-danger" data-delete-product="${p.id}">Delete</button></td></tr>`).join("")}</tbody></table>`:'<div class="empty">No products.</div>';
 $$("[data-edit-product]").forEach(b=>b.onclick=async()=>editProduct(b.dataset.editProduct));
 $$("[data-delete-product]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this product?"))return;try{await api("/api/admin/products/"+b.dataset.deleteProduct,{method:"DELETE"});toast("Product deleted");loadProducts();loadDashboard()}catch(e){toast(e.message)}});
}
const productImageFile=$("#productImageFile"), productImageData=$("#productImageData"), productImagePreview=$("#productImagePreview"), removeProductImage=$("#removeProductImage");
function showProductImage(src=""){
  productImageData.value=src;
  productImagePreview.innerHTML=src?`<img src="${src}" alt="Product photo preview">`:"<span>No photo selected</span>";
  removeProductImage.classList.toggle("hidden",!src);
}
function resizeProductImage(file){
  return new Promise((resolve,reject)=>{
    if(!file.type.match(/^image\/(jpeg|png|webp)$/))return reject(new Error("Please select a JPG, PNG or WebP image."));
    if(file.size>5*1024*1024)return reject(new Error("Photo must be smaller than 5 MB."));
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("Could not read the selected photo."));
    reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error("Invalid image file."));img.onload=()=>{
      const max=1200,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement("canvas");
      canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
      canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
      resolve(canvas.toDataURL("image/jpeg",.82));
    };img.src=reader.result};reader.readAsDataURL(file);
  });
}
productImageFile.onchange=async()=>{const file=productImageFile.files[0];if(!file)return;try{showProductImage(await resizeProductImage(file))}catch(err){productImageFile.value="";toast(err.message)}};
removeProductImage.onclick=()=>{productImageFile.value="";showProductImage("")};
$("#addProductBtn").onclick=()=>{ $("#productForm").reset();$("#productForm [name=id]").value="";showProductImage("");$("#productModalTitle").textContent="Add Product";modal("productModal") };
async function editProduct(id){const ps=await api("/api/admin/products");const p=ps.find(x=>x.id===id);if(!p)return;const f=$("#productForm");f.reset();Object.keys(p).forEach(k=>{if(f.elements[k])f.elements[k].value=p[k]});showProductImage(p.image||"");$("#productModalTitle").textContent="Update Product";modal("productModal")}
$("#productForm").onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{const id=f.id;delete f.id;await api(id?"/api/admin/products/"+id:"/api/admin/products",{method:id?"PUT":"POST",body:JSON.stringify(f)});modal("productModal",false);toast(id?"Product updated":"Product added");loadProducts();loadDashboard()}catch(err){toast(err.message)}};

async function loadOrders(){const os=await api("/api/admin/orders");$("#ordersTable").innerHTML=os.length?tableOrders(os,true):'<div class="empty">No orders yet.</div>';$$("[data-status]").forEach(s=>s.onchange=async()=>{try{await api("/api/admin/orders/"+s.dataset.status+"/status",{method:"PUT",body:JSON.stringify({status:s.value})});toast("Order status updated");loadOrders();loadDashboard()}catch(e){toast(e.message)}})}
async function loadCustomers(){const cs=await api("/api/admin/customers");$("#customersTable").innerHTML=cs.length?`<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Registered</th></tr></thead><tbody>${cs.map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.email)}</td><td>${esc(c.phone||"-")}</td><td>${new Date(c.createdAt).toLocaleDateString()}</td></tr>`).join("")}</tbody></table>`:'<div class="empty">No registered customers yet.</div>'}
async function loadMessages(){const ms=await api("/api/admin/messages");$("#messagesTable").innerHTML=ms.length?`<table class="table"><thead><tr><th>From</th><th>Phone</th><th>Message</th><th>Date</th><th></th></tr></thead><tbody>${ms.map(m=>`<tr><td><strong>${esc(m.name)}</strong><br>${esc(m.email)}</td><td>${esc(m.phone||"-")}</td><td>${esc(m.message)}</td><td>${new Date(m.createdAt).toLocaleString()}</td><td><button class="btn btn-small btn-danger" data-delete-message="${m.id}">Delete</button></td></tr>`).join("")}</tbody></table>`:'<div class="empty">No messages yet.</div>';
 $$("[data-delete-message]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete message?"))return;await api("/api/admin/messages/"+b.dataset.deleteMessage,{method:"DELETE"});loadMessages();loadDashboard();toast("Message deleted")});
}
async function loadOffers(){const os=await api("/api/admin/offers");$("#offersList").innerHTML=os.length?`<div class="offer-list">${os.map(o=>`<div class="offer-card"><div><h4>${esc(o.title)} ${o.active?'<span class="status Delivered">ACTIVE</span>':'<span class="status Cancelled">OFF</span>'}</h4><p>${esc(o.subtitle)} • ${o.discount}% OFF ${o.code?"• Code: "+esc(o.code):""}</p></div><div class="offer-actions"><button class="btn btn-small btn-gold" data-toggle-offer="${o.id}" data-active="${o.active}">${o.active?"Disable":"Enable"}</button><button class="btn btn-small btn-danger" data-delete-offer="${o.id}">Delete</button></div></div>`).join("")}</div>`:'<div class="empty">No offers created.</div>';
 $$("[data-delete-offer]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete offer?"))return;await api("/api/admin/offers/"+b.dataset.deleteOffer,{method:"DELETE"});loadOffers();loadDashboard();toast("Offer deleted")});
 $$("[data-toggle-offer]").forEach(b=>b.onclick=async()=>{await api("/api/admin/offers/"+b.dataset.toggleOffer,{method:"PUT",body:JSON.stringify({active:b.dataset.active!=="true"})});loadOffers();toast("Offer status updated")});
}
$("#addOfferBtn").onclick=()=>{ $("#offerForm").reset();modal("offerModal") };
$("#offerForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/admin/offers",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});modal("offerModal",false);loadOffers();loadDashboard();toast("Offer published")}catch(err){toast(err.message)}};
$$("[data-modal]").forEach(b=>b.onclick=()=>modal(b.dataset.modal,false));
boot();

$("#forgotCredentialsBtn").onclick=()=>modal("recoveryModal",true);
$$("[data-recovery-tab]").forEach(b=>b.onclick=()=>{$$("[data-recovery-tab]").forEach(x=>x.classList.remove("active"));b.classList.add("active");const u=b.dataset.recoveryTab==="userid";$("#recoverUserIdForm").classList.toggle("hidden",!u);$("#resetPasswordForm").classList.toggle("hidden",u);$("#recoveryMsg").textContent=""});
$("#recoverUserIdForm").onsubmit=async e=>{e.preventDefault();try{const d=await api("/api/admin/recover-user-id",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});$("#recoveryMsg").innerHTML="Your User ID is: <strong>"+esc(d.userId)+"</strong>"}catch(err){$("#recoveryMsg").textContent=err.message}};
$("#resetPasswordForm").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));if(b.newPassword!==b.confirmPassword){$("#recoveryMsg").textContent="Passwords do not match.";return}delete b.confirmPassword;try{const d=await api("/api/admin/reset-password",{method:"POST",body:JSON.stringify(b)});$("#recoveryMsg").textContent=d.message;e.target.reset()}catch(err){$("#recoveryMsg").textContent=err.message}};
$("#changeCredentialsForm").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));if(b.newPassword&&b.newPassword!==b.confirmPassword){$("#settingsMsg").textContent="Passwords do not match.";return}delete b.confirmPassword;if(!b.newUserId)delete b.newUserId;if(!b.newPassword)delete b.newPassword;if(!b.newRecoveryCode)delete b.newRecoveryCode;try{const d=await api("/api/admin/change-credentials",{method:"PUT",body:JSON.stringify(b)});A.userId=d.admin.userId;localStorage.setItem("sgj_admin_userid",A.userId);$("#adminEmail").textContent="Admin: "+A.userId;$("#settingsMsg").textContent=d.message;e.target.reset();toast("Credentials updated")}catch(err){$("#settingsMsg").textContent=err.message}};
