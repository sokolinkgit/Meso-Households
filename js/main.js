/* ============================================================
   MESO HOUSEHOLDS — One-Stop Household Solution
   Pure JavaScript (no libraries)
   ============================================================ */

const SHOP_PHONE_DISPLAY = "0742 005 725";
const WHATSAPP_NUMBER = "254742005725";
const supabaseClient = window.supabase?.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let CATEGORIES = [
  { id: "appliances", slug: "appliances", name: "Kitchen Appliances", emoji: "🍳" },
  { id: "flasks", slug: "flasks", name: "Flasks & Thermos", emoji: "🧴" },
  { id: "dining", slug: "dining", name: "Dining", emoji: "🍽️" },
  { id: "cookware", slug: "cookware", name: "Cookware", emoji: "🥘" },
];
let isAdmin = false;

/* ---------- Product catalogue ---------- */
let PRODUCTS = [
  {
    id: "flask",
    name: "Stainless Steel Vacuum Flask",
    category: "flasks",
    categoryLabel: "Flasks & Thermos",
    price: 1500,
    image: "images/flask.jpg",
    tag: "Best Seller",
    desc: "1.5L food-grade flask that keeps drinks hot or cold for 12+ hours.",
  },
  {
    id: "kettle",
    name: "Electric Kettle",
    category: "appliances",
    categoryLabel: "Kitchen Appliances",
    price: 2200,
    image: "images/kettle.jpg",
    tag: "Hot",
    desc: "Fast-boiling 1.7L stainless steel kettle with auto shut-off safety.",
  },
  {
    id: "blender",
    name: "Heavy-Duty Blender",
    category: "appliances",
    categoryLabel: "Kitchen Appliances",
    price: 4500,
    image: "images/blender.jpg",
    tag: null,
    desc: "Powerful glass-jug blender for smoothies, juices and soft foods.",
  },
  {
    id: "thermos",
    name: "Premium Vacuum Thermos",
    category: "flasks",
    categoryLabel: "Flasks & Thermos",
    price: 1800,
    image: "images/thermos.jpg",
    tag: null,
    desc: "Sleek matte thermos with cup lid — perfect for office, travel and home.",
  },
  {
    id: "plates",
    name: "Ceramic Dinner Plates (Set of 6)",
    category: "dining",
    categoryLabel: "Dining",
    price: 2500,
    image: "images/plates.jpg",
    tag: null,
    desc: "Elegant white ceramic plates — durable, chip-resistant, easy to clean.",
  },
  {
    id: "bottles",
    name: "Stainless Water Bottles",
    category: "flasks",
    categoryLabel: "Flasks & Thermos",
    price: 850,
    image: "images/bottles.jpg",
    tag: null,
    desc: "Leak-proof reusable bottles in assorted colours. Great for kids & gym.",
  },
  {
    id: "pots",
    name: "Cooking Pots Set (3 pcs)",
    category: "cookware",
    categoryLabel: "Cookware",
    price: 5500,
    image: "images/pots.jpg",
    tag: "Best Seller",
    desc: "Gleaming stainless steel sufuria set with glass lids — a kitchen must-have.",
  },
  {
    id: "cutlery",
    name: "Cutlery Set (24 pcs)",
    category: "dining",
    categoryLabel: "Dining",
    price: 1200,
    image: "images/cutlery.jpg",
    tag: null,
    desc: "Complete fork, knife and spoon set for 6 — polished stainless steel.",
  },
  {
    id: "mugs",
    name: "Ceramic Mugs (Set of 4)",
    category: "dining",
    categoryLabel: "Dining",
    price: 1000,
    image: "images/mugs.jpg",
    tag: null,
    desc: "Stylish warm-coloured mugs for tea, coffee and cocoa moments.",
  },
];

/* ---------- Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function formatKES(n) {
  return "KES " + n.toLocaleString("en-KE");
}

function showToast(msg) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

/* ---------- Render products ---------- */
const productsGrid = $("#productsGrid");
const escapeHtml = (value = "") => String(value).replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#039;" }[c]));
function categoryLabel(slug) {
  return CATEGORIES.find((c) => c.slug === slug)?.name || slug;
}

function renderProducts(filter = "all") {
  productsGrid.innerHTML = "";
  const list = filter === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter);

  list.forEach((p, i) => {
    const waText = encodeURIComponent(
      `Hello Meso Households! \n\n` +
        `I'd like to order:\n• ${p.name} — ${formatKES(p.price)}\n\n` +
        `Please confirm availability and delivery details.\n\n` +
        `Thank you!`
    );
    const card = document.createElement("article");
    card.className = "product-card";
    card.style.animationDelay = i * 0.06 + "s";
    card.innerHTML = `
      <div class="product-media">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
        ${p.tag ? `<span class="product-tag ${p.tag === "Hot" ? "hot" : ""}">${p.tag}</span>` : ""}
      </div>
      <div class="product-body">
        <span class="product-cat">${escapeHtml(categoryLabel(p.category))}</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="product-desc">${escapeHtml(p.desc)}</p>
        <div class="product-foot">
          <span class="product-price">${formatKES(p.price)}</span>
          <button class="add-btn" data-id="${p.id}" aria-label="Add ${p.name} to cart">
            <svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Add
          </button>
        </div>
        <a class="wa-order-btn" href="https://wa.me/${WHATSAPP_NUMBER}?text=${waText}" target="_blank" rel="noopener" aria-label="Order ${p.name} on WhatsApp">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.11 3.22 5.11 4.51.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zm-5.45 7.23a8.3 8.3 0 0 1-4.23-1.16l-.3-.18-3.14.82.84-3.06-.2-.31a8.3 8.3 0 0 1-1.28-4.44c0-4.6 3.75-8.35 8.37-8.35a8.3 8.3 0 0 1 8.35 8.37c0 4.6-3.76 8.34-8.41 8.34zm8.42-18.37C18.85 1.75 17.06 1 15.1 1h-.07A11.11 11.11 0 0 0 3.94 12.14c0 1.96.51 3.87 1.49 5.56L3.85 23l5.44-1.42a11.05 11.05 0 0 0 5.3 1.35h.01c6.15 0 11.15-5 11.16-11.14 0-2.97-1.16-5.77-3.27-7.87z"/></svg>
          Order on WhatsApp
        </a>
      </div>`;
    productsGrid.appendChild(card);
  });
}

/* ---------- Filters ---------- */
const filterBar = $("#filterBar");
filterBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  $$(".filter-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderProducts(btn.dataset.filter);
});

/* ---------- Cart ---------- */
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem("mesoCart")) || [];
} catch {
  cart = [];
}

const cartBtn = $("#cartBtn");
const cartDrawer = $("#cartDrawer");
const cartOverlay = $("#cartOverlay");
const cartCount = $("#cartCount");
const cartHeadCount = $("#cartHeadCount");
const cartItems = $("#cartItems");
const cartEmpty = $("#cartEmpty");
const cartFoot = $("#cartFoot");
const cartTotal = $("#cartTotal");
const cartClose = $("#cartClose");

function saveCart() {
  localStorage.setItem("mesoCart", JSON.stringify(cart));
}

function renderCart() {
  const count = cart.reduce((s, it) => s + it.qty, 0);
  cartCount.textContent = count;
  cartHeadCount.textContent = count ? `(${count} item${count > 1 ? "s" : ""})` : "";
  cartCount.classList.remove("bump");
  void cartCount.offsetWidth;
  if (count) cartCount.classList.add("bump");

  const isEmpty = cart.length === 0;
  cartEmpty.style.display = isEmpty ? "flex" : "none";
  cartFoot.classList.toggle("visible", !isEmpty);
  cartItems.innerHTML = "";

  cart.forEach((item) => {
    const line = document.createElement("div");
    line.className = "cart-line";
    line.innerHTML = `
      <img src="${item.image}" alt="${item.name}" />
      <div class="cart-line-info">
        <span class="cart-line-name">${item.name}</span>
        <span class="cart-line-price">${formatKES(item.price)} each</span>
        <div class="cart-line-controls">
          <button class="qty-btn minus" data-id="${item.id}" aria-label="Decrease quantity">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn plus" data-id="${item.id}" aria-label="Increase quantity">+</button>
          <button class="cart-line-remove" data-id="${item.id}">Remove</button>
        </div>
      </div>
      <span class="cart-line-total">${formatKES(item.price * item.qty)}</span>`;
    cartItems.appendChild(line);
  });

  const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
  cartTotal.textContent = formatKES(total);
}

function addToCart(id) {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return;
  const existing = cart.find((it) => it.id === id);
  if (existing) existing.qty += 1;
  else cart.push({ id, name: product.name, price: product.price, image: product.image, qty: 1 });
  saveCart();
  renderCart();
  showToast(`✔ ${product.name} added to your order`);
}

function changeQty(id, delta) {
  const item = cart.find((it) => it.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((it) => it.id !== id);
  saveCart();
  renderCart();
}

function removeItem(id) {
  cart = cart.filter((it) => it.id !== id);
  saveCart();
  renderCart();
  showToast("Item removed from your order");
}

function openCart() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeCart() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("show");
  document.body.style.overflow = "";
}

productsGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-btn");
  if (btn) addToCart(btn.dataset.id);
});

cartItems.addEventListener("click", (e) => {
  const plus = e.target.closest(".plus");
  const minus = e.target.closest(".minus");
  const remove = e.target.closest(".cart-line-remove");
  if (plus) changeQty(plus.dataset.id, 1);
  if (minus) changeQty(minus.dataset.id, -1);
  if (remove) removeItem(remove.dataset.id);
});

cartBtn.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);
$("#cartEmptyBrowse").addEventListener("click", () => {
  closeCart();
  $("#products").scrollIntoView({ behavior: "smooth" });
});
$("#clearCartBtn").addEventListener("click", () => {
  if (!cart.length) return;
  cart = [];
  saveCart();
  renderCart();
  showToast("Cart cleared");
});

/* ---------- WhatsApp checkout ---------- */
$("#checkoutBtn").addEventListener("click", () => {
  if (!cart.length) return;
  const lines = cart.map(
    (it) => `• ${it.name} × ${it.qty} — ${formatKES(it.price * it.qty)}`
  );
  const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const msg =
    `Hello Meso Households! 🏠\n\n` +
    `I'd like to place this order:\n${lines.join("\n")}\n\n` +
    `*TOTAL: ${formatKES(total)}*\n\n` +
    `Name: \nDelivery/Pickup: \n\nThank you!`;
  window.open(
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,
    "_blank",
    "noopener"
  );
});

/* ---------- Hero slideshow ---------- */
const heroSlides = $$(".hero-slide");
const sliderDots = $("#sliderDots");
let slideIdx = 0;
let slideTimer = null;

if (heroSlides.length > 1 && sliderDots) {
  heroSlides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "slider-dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Show photo ${i + 1}`);
    dot.addEventListener("click", () => goToSlide(i, true));
    sliderDots.appendChild(dot);
  });

  const dots = $$(".slider-dot", sliderDots);

  function goToSlide(i, manual = false) {
    slideIdx = (i + heroSlides.length) % heroSlides.length;
    heroSlides.forEach((s, idx) => s.classList.toggle("active", idx === slideIdx));
    dots.forEach((d, idx) => d.classList.toggle("active", idx === slideIdx));
    if (manual) restartTimer();
  }

  function restartTimer() {
    clearInterval(slideTimer);
    slideTimer = setInterval(() => goToSlide(slideIdx + 1), 4500);
  }

  $("#slidePrev").addEventListener("click", () => goToSlide(slideIdx - 1, true));
  $("#slideNext").addEventListener("click", () => goToSlide(slideIdx + 1, true));

  const slideshowBox = $("#heroSlideshow");
  slideshowBox.addEventListener("mouseenter", () => clearInterval(slideTimer));
  slideshowBox.addEventListener("mouseleave", restartTimer);

  restartTimer();
}

/* ---------- Navbar ---------- */
const navbar = $("#navbar");
const hamburger = $("#hamburger");
const navLinks = $("#navLinks");

hamburger.addEventListener("click", () => {
  hamburger.classList.toggle("open");
  navLinks.classList.toggle("open");
});

$$(".nav-link", navLinks).forEach((link) =>
  link.addEventListener("click", () => {
    hamburger.classList.remove("open");
    navLinks.classList.remove("open");
  })
);

window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 10);
  $("#backTop").classList.toggle("show", window.scrollY > 500);
  highlightNav();
});

/* ---------- Active nav link on scroll ---------- */
const sections = ["home", "products", "about", "why", "visit"].map((id) => $("#" + id));
function highlightNav() {
  const pos = window.scrollY + 140;
  let current = "home";
  sections.forEach((sec) => {
    if (sec && sec.offsetTop <= pos) current = sec.id;
  });
  $$(".nav-link").forEach((l) =>
    l.classList.toggle("active", l.getAttribute("href") === "#" + current)
  );
}

/* ---------- Back to top ---------- */
$("#backTop").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ---------- Scroll reveal ---------- */
const revealEls = $$(
  ".about-inner, .section-head, .why-card, .testi-card, .visit-card, .map-wrap, .feature, .cta-inner"
);
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
revealEls.forEach((el) => {
  el.classList.add("reveal");
  observer.observe(el);
});

/* ---------- Supabase catalogue + admin ---------- */
async function loadCatalogue() {
  if (!supabaseClient) return;
  const [{ data: cats, error: catError }, { data: rows, error: productError }] = await Promise.all([
    supabaseClient.from("categories").select("*").order("sort_order"),
    supabaseClient.from("products").select("*, categories(slug, name)").order("sort_order"),
  ]);
  if (!catError && cats?.length) CATEGORIES = cats;
  if (!productError && rows?.length) PRODUCTS = rows.map((p) => ({ id: p.id, name: p.name, category: p.categories?.slug, categoryLabel: p.categories?.name, price: Number(p.price), image: p.image_url, tag: p.tag, desc: p.description }));
  renderFilterBar();
  renderProducts($(".filter-btn.active")?.dataset.filter || "all");
}
function renderFilterBar() {
  filterBar.innerHTML = `<button class="filter-btn active" data-filter="all">All Items</button>` + CATEGORIES.map((c) => `<button class="filter-btn" data-filter="${escapeHtml(c.slug)}">${escapeHtml(c.emoji || "")} ${escapeHtml(c.name)}</button>`).join("");
}
function renderAdminTables() {
  $("#categoryRows").innerHTML = CATEGORIES.map((c) => `<div class="admin-row"><span>${escapeHtml(c.emoji || "")} <strong>${escapeHtml(c.name)}</strong> <small>${escapeHtml(c.slug)}</small></span><span><button class="btn-text edit-category" data-id="${c.id}">Edit</button><button class="btn-text delete-category" data-id="${c.id}">Delete</button></span></div>`).join("");
  $("#productRows").innerHTML = PRODUCTS.map((p) => `<div class="admin-row"><span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(categoryLabel(p.category))} · ${formatKES(p.price)}</small></span><span><button class="btn-text edit-product" data-id="${p.id}">Edit</button><button class="btn-text delete-product" data-id="${p.id}">Delete</button></span></div>`).join("");
  $("#productCategory").innerHTML = CATEGORIES.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("");
}
function resetForms() { $("#categoryForm").reset(); $("#productForm").reset(); $("#categoryId").value = ""; $("#productId").value = ""; $("#categoryFormTitle").textContent = "Add category"; $("#productFormTitle").textContent = "Add product"; }
function openAdmin() { $("#adminPanel").hidden = false; renderAdminTables(); $("#adminPanel").scrollIntoView({ behavior: "smooth" }); }
async function refreshAdmin() { await loadCatalogue(); renderAdminTables(); }
async function checkAdminSession() {
  if (!supabaseClient) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    const { data } = await supabaseClient.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
    isAdmin = !!data;
  }
  $("#adminPanel").hidden = !isAdmin;
  if (isAdmin) openAdmin();
}

$("#homeIcon").addEventListener("click", (event) => {
  const now = Date.now();
  const clicks = Number($("#homeIcon").dataset.secretClicks || 0);
  const started = Number($("#homeIcon").dataset.secretStarted || now);
  const next = now - started <= 30000 ? clicks + 1 : 1;
  $("#homeIcon").dataset.secretClicks = next;
  $("#homeIcon").dataset.secretStarted = next === 1 ? now : started;
  if (next >= 5) { event.preventDefault(); $("#adminDialog").showModal(); $("#loginEmail").focus(); $("#homeIcon").dataset.secretClicks = 0; }
});
$("#loginClose").addEventListener("click", () => $("#adminDialog").close());
$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signInWithPassword({ email: $("#loginEmail").value.trim(), password: $("#loginPassword").value });
  if (error) { $("#loginError").textContent = error.message; return; }
  $("#loginError").textContent = ""; $("#adminDialog").close(); await checkAdminSession();
  if (!isAdmin) showToast("Signed in, but this account is not an admin");
});
$("#logoutBtn").addEventListener("click", async () => { await supabaseClient?.auth.signOut(); isAdmin = false; $("#adminPanel").hidden = true; renderProducts(); showToast("Signed out"); });
$("#categoryForm").addEventListener("submit", async (event) => { event.preventDefault(); if (!isAdmin) return; const id = $("#categoryId").value; const payload = { name: $("#categoryName").value.trim(), slug: $("#categorySlug").value.trim().toLowerCase(), emoji: $("#categoryEmoji").value.trim() }; const result = id ? await supabaseClient.from("categories").update(payload).eq("id", id) : await supabaseClient.from("categories").insert(payload); if (result.error) return showToast(result.error.message); resetForms(); await refreshAdmin(); showToast("Category saved"); });
$("#productForm").addEventListener("submit", async (event) => { event.preventDefault(); if (!isAdmin) return; const id = $("#productId").value; const category = CATEGORIES.find((c) => c.slug === $("#productCategory").value); const payload = { name: $("#productName").value.trim(), category_id: category.id, price: Number($("#productPrice").value), image_url: $("#productImage").value.trim(), tag: $("#productTag").value.trim() || null, description: $("#productDescription").value.trim() }; const result = id ? await supabaseClient.from("products").update(payload).eq("id", id) : await supabaseClient.from("products").insert(payload); if (result.error) return showToast(result.error.message); resetForms(); await refreshAdmin(); showToast("Product saved"); });
$("#cancelCategory").addEventListener("click", resetForms); $("#cancelProduct").addEventListener("click", resetForms);
$("#adminPanel").addEventListener("click", async (event) => { const editCat = event.target.closest(".edit-category"); const delCat = event.target.closest(".delete-category"); const edit = event.target.closest(".edit-product"); const del = event.target.closest(".delete-product"); if (editCat) { const c = CATEGORIES.find((x) => String(x.id) === editCat.dataset.id); $("#categoryId").value = c.id; $("#categoryName").value = c.name; $("#categorySlug").value = c.slug; $("#categoryEmoji").value = c.emoji || ""; $("#categoryFormTitle").textContent = "Edit category"; } if (delCat && confirm("Delete this category? It must have no products.")) { const r = await supabaseClient.from("categories").delete().eq("id", delCat.dataset.id); if (r.error) showToast(r.error.message); else await refreshAdmin(); } if (edit) { const p = PRODUCTS.find((x) => String(x.id) === edit.dataset.id); $("#productId").value = p.id; $("#productName").value = p.name; $("#productCategory").value = p.category; $("#productPrice").value = p.price; $("#productImage").value = p.image; $("#productTag").value = p.tag || ""; $("#productDescription").value = p.desc; $("#productFormTitle").textContent = "Edit product"; } if (del && confirm("Delete this product?")) { const r = await supabaseClient.from("products").delete().eq("id", del.dataset.id); if (r.error) showToast(r.error.message); else await refreshAdmin(); } });

/* ---------- Init ---------- */
$("#year").textContent = new Date().getFullYear();
renderFilterBar();
renderProducts();
renderCart();
loadCatalogue();
checkAdminSession();
if (supabaseClient) supabaseClient.auth.onAuthStateChange(() => checkAdminSession());
