/* ============================================================
   MESO HOUSEHOLDS — One-Stop Household Solution
   Pure JavaScript (no libraries)
   ============================================================ */

const SHOP_PHONE_DISPLAY = "0742 005 725";
const WHATSAPP_NUMBER = "254742005725";
const PRODUCT_IMAGE_BUCKET = "product-images";
const supabaseClient = window.supabase?.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let CATEGORIES = [
  { id: "appliances", slug: "appliances", name: "Kitchen Appliances", emoji: "🍳", image_url: "" },
  { id: "flasks", slug: "flasks", name: "Flasks & Thermos", emoji: "🧴", image_url: "" },
  { id: "dining", slug: "dining", name: "Dining", emoji: "🍽️", image_url: "" },
  { id: "cookware", slug: "cookware", name: "Cookware", emoji: "🥘", image_url: "" },
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
function slugify(str) {
  return (
    String(str || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "") || "category"
  );
}
function categoryChipIcon(cat) {
  if (cat?.image_url) return `<img class="filter-chip-img" src="${escapeHtml(cat.image_url)}" alt="" />`;
  return cat?.emoji ? `${escapeHtml(cat.emoji)} ` : "";
}
function productImages(p) {
  if (p?.images && p.images.length) return p.images;
  return p?.image ? [p.image] : [];
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
    card.className = "product-card" + (isAdmin ? " is-admin" : "");
    card.style.animationDelay = i * 0.06 + "s";
    card.innerHTML = `
      <div class="product-media">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
        ${p.tag ? `<span class="product-tag ${p.tag === "Hot" ? "hot" : ""}">${p.tag}</span>` : ""}
        ${isAdmin ? `
          <div class="admin-overlay">
            <button class="admin-overlay-btn edit-product-quick" data-id="${p.id}" type="button" aria-label="Edit ${escapeHtml(p.name)}" title="Edit">✎</button>
            <button class="admin-overlay-btn delete-product-quick" data-id="${p.id}" type="button" aria-label="Delete ${escapeHtml(p.name)}" title="Delete">🗑</button>
          </div>` : ""}
      </div>
      <div class="product-body">
        <span class="product-cat">${escapeHtml(categoryLabel(p.category))}</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="product-desc">${escapeHtml(p.desc)}</p>
        ${isAdmin ? `
          <label class="admin-quick-move">Move to category
            <select class="quick-category-select" data-id="${p.id}">
              ${CATEGORIES.map((c) => `<option value="${escapeHtml(c.slug)}" ${c.slug === p.category ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
            </select>
          </label>` : ""}
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

  if (isAdmin) {
    const addCard = document.createElement("button");
    addCard.type = "button";
    addCard.id = "addProductGhostCard";
    addCard.className = "product-card add-product-card";
    addCard.innerHTML = `<span class="add-product-plus">+</span><span>Add product${filter !== "all" ? ` to ${escapeHtml(categoryLabel(filter))}` : ""}</span>`;
    productsGrid.appendChild(addCard);
  }
}

/* ---------- Filters ---------- */
const filterBar = $("#filterBar");
filterBar.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".filter-chip-edit");
  const addBtn = e.target.closest("#addCategoryChipBtn");
  const btn = e.target.closest(".filter-btn");
  if (editBtn) return openCategoryDialog(CATEGORIES.find((c) => String(c.id) === String(editBtn.dataset.id)));
  if (addBtn) return openCategoryDialog();
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
  const edit = e.target.closest(".edit-product-quick");
  const del = e.target.closest(".delete-product-quick");
  const addGhost = e.target.closest("#addProductGhostCard");
  if (btn) addToCart(btn.dataset.id);
  if (edit) openProductDialog(PRODUCTS.find((p) => String(p.id) === String(edit.dataset.id)));
  if (del) deleteProductQuick(del.dataset.id);
  if (addGhost) openProductDialog();
});
productsGrid.addEventListener("change", (e) => {
  const sel = e.target.closest(".quick-category-select");
  if (sel) moveProductToCategory(sel.dataset.id, sel.value);
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
  if (!productError && rows?.length) PRODUCTS = rows.map((p) => ({ id: p.id, name: p.name, category: p.categories?.slug, categoryLabel: p.categories?.name, price: Number(p.price), image: p.image_url, images: p.images || [], tag: p.tag, desc: p.description }));
  renderFilterBar();
  renderProducts($(".filter-btn.active")?.dataset.filter || "all");
  if ($("#manageDialog").open) renderManageList();
}

function renderFilterBar() {
  const activeSlug = $(".filter-btn.active")?.dataset.filter || "all";
  filterBar.innerHTML =
    `<button class="filter-btn ${activeSlug === "all" ? "active" : ""}" data-filter="all">All Items</button>` +
    CATEGORIES.map(
      (c) => `
      <span class="filter-chip-wrap">
        <button class="filter-btn ${activeSlug === c.slug ? "active" : ""}" data-filter="${escapeHtml(c.slug)}">${categoryChipIcon(c)}${escapeHtml(c.name)}</button>
        ${isAdmin ? `<button class="filter-chip-edit" type="button" data-id="${c.id}" aria-label="Edit ${escapeHtml(c.name)}" title="Edit category">✎</button>` : ""}
      </span>`
    ).join("") +
    (isAdmin ? `<button class="filter-btn filter-btn-add" type="button" id="addCategoryChipBtn">+ Category</button>` : "");
}

/* ---------- Admin mode toggle ---------- */
function applyAdminUI() {
  document.body.classList.toggle("is-admin", isAdmin);
  $("#adminToolbar").hidden = !isAdmin;
  renderFilterBar();
  renderProducts($(".filter-btn.active")?.dataset.filter || "all");
}

async function refreshAdmin() {
  await loadCatalogue();
}

async function checkAdminSession(sessionArg) {
  if (!supabaseClient) return;
  let session = sessionArg;
  if (session === undefined) {
    const { data } = await supabaseClient.auth.getSession();
    session = data.session;
  }
  isAdmin = false;
  if (session) {
    const { data } = await supabaseClient.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
    isAdmin = !!data;
  }
  applyAdminUI();
}

/* ---------- Image uploads (Supabase Storage) — used for both product photos and category images ---------- */
async function uploadImage(file) {
  const extMatch = /\.([a-z0-9]+)$/i.exec(file.name || "");
  const ext = (extMatch ? extMatch[1] : "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabaseClient.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabaseClient.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
async function deleteUploadedImage(url) {
  if (!url) return;
  const marker = `/object/public/${PRODUCT_IMAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return; // not an uploaded image (e.g. a bundled local placeholder) — leave it alone
  const path = url.slice(idx + marker.length);
  try { await supabaseClient.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]); } catch { /* best-effort */ }
}

/* ---------- Category dialog ---------- */
let categoryReturnToProduct = false;
let pendingCategoryImageFile = null;
function setCategoryImagePreview(url) {
  const img = $("#categoryImagePreview");
  const empty = $("#categoryImageEmpty");
  const removeBtn = $("#removeCategoryImageBtn");
  if (url) { img.src = url; img.hidden = false; empty.hidden = true; removeBtn.hidden = false; }
  else { img.hidden = true; img.removeAttribute("src"); empty.hidden = false; removeBtn.hidden = true; }
}
function openCategoryDialog(cat = null) {
  $("#categoryForm").reset();
  $("#categoryError").textContent = "";
  pendingCategoryImageFile = null;
  if (cat) {
    $("#categoryId").value = cat.id;
    $("#categoryExistingImage").value = cat.image_url || "";
    $("#categoryName").value = cat.name;
    $("#categoryFormTitle").textContent = "Edit category";
    $("#deleteCategoryBtn").hidden = false;
    setCategoryImagePreview(cat.image_url || "");
  } else {
    $("#categoryId").value = "";
    $("#categoryExistingImage").value = "";
    $("#categoryFormTitle").textContent = "Add category";
    $("#deleteCategoryBtn").hidden = true;
    setCategoryImagePreview("");
  }
  $("#categoryDialog").showModal();
}
$("#categoryDialogClose").addEventListener("click", () => { categoryReturnToProduct = false; $("#categoryDialog").close(); });
$("#categoryImageFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pendingCategoryImageFile = file;
  const reader = new FileReader();
  reader.onload = () => setCategoryImagePreview(reader.result);
  reader.readAsDataURL(file);
});
$("#removeCategoryImageBtn").addEventListener("click", () => {
  $("#categoryExistingImage").value = "";
  pendingCategoryImageFile = null;
  $("#categoryImageFile").value = "";
  setCategoryImagePreview("");
});
async function saveCategoryRow(id, baseSlug, rest) {
  let attempt = 0;
  let slug = baseSlug;
  while (true) {
    const body = { ...rest, slug };
    const result = id
      ? await supabaseClient.from("categories").update(body).eq("id", id).select().single()
      : await supabaseClient.from("categories").insert(body).select().single();
    if (!result.error || result.error.code !== "23505" || attempt >= 4) return result;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
}
$("#categoryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin) return;
  const saveBtn = event.submitter || $("#categoryForm button[type=submit]");
  const originalLabel = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  try {
    const id = $("#categoryId").value;
    const oldImage = $("#categoryExistingImage").value;
    let imageUrl = oldImage;
    if (pendingCategoryImageFile) imageUrl = await uploadImage(pendingCategoryImageFile);
    const name = $("#categoryName").value.trim();
    const result = await saveCategoryRow(id || null, slugify(name), { name, image_url: imageUrl || "" });
    if (result.error) throw result.error;
    if (pendingCategoryImageFile && oldImage) await deleteUploadedImage(oldImage);
    $("#categoryDialog").close();
    await refreshAdmin();
    if (categoryReturnToProduct && $("#productDialog").open) {
      populateProductCategorySelect();
      $("#productCategory").value = result.data.slug;
    }
    showToast("Category saved");
  } catch (err) {
    $("#categoryError").textContent = err.message || "Something went wrong";
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
    categoryReturnToProduct = false;
  }
});
async function deleteCategoryQuick(id) {
  const cat = CATEGORIES.find((c) => String(c.id) === String(id));
  if (!confirm(`Delete category "${cat?.name || ""}"? It must have no products left in it.`)) return;
  const r = await supabaseClient.from("categories").delete().eq("id", id);
  if (r.error) return showToast(r.error.message);
  if (cat?.image_url) await deleteUploadedImage(cat.image_url);
  await refreshAdmin();
  showToast("Category deleted");
}
$("#deleteCategoryBtn").addEventListener("click", async () => {
  const id = $("#categoryId").value;
  if (!id) return;
  const cat = CATEGORIES.find((c) => String(c.id) === String(id));
  if (!confirm(`Delete category "${cat?.name || ""}"? It must have no products left in it.`)) return;
  const r = await supabaseClient.from("categories").delete().eq("id", id);
  if (r.error) return ($("#categoryError").textContent = r.error.message);
  if (cat?.image_url) await deleteUploadedImage(cat.image_url);
  $("#categoryDialog").close();
  await refreshAdmin();
  showToast("Category deleted");
});

/* ---------- Product dialog ---------- */
let productPhotos = []; // ordered list of { url, file } — url is a preview (existing URL or data: preview), file is set for new/unsaved uploads
function populateProductCategorySelect() {
  const current = $("#productCategory").value;
  $("#productCategory").innerHTML = CATEGORIES.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("");
  if (current && CATEGORIES.some((c) => c.slug === current)) $("#productCategory").value = current;
}
function renderProductPhotoGallery() {
  const gallery = $("#productPhotoGallery");
  const empty = $("#productImageEmpty");
  empty.hidden = productPhotos.length > 0;
  gallery.innerHTML = productPhotos
    .map(
      (p, i) => `
    <div class="photo-thumb${i === 0 ? " is-cover" : ""}" data-index="${i}">
      <img src="${p.url}" alt="Product photo ${i + 1}" />
      ${i === 0 ? `<span class="photo-thumb-cover-tag">Cover</span>` : ""}
      <button type="button" class="photo-thumb-remove" data-index="${i}" aria-label="Remove photo ${i + 1}" title="Remove">&times;</button>
    </div>`
    )
    .join("");
}
$("#productPhotoGallery").addEventListener("click", async (e) => {
  const removeBtn = e.target.closest(".photo-thumb-remove");
  const thumb = e.target.closest(".photo-thumb");
  if (removeBtn) {
    const i = Number(removeBtn.dataset.index);
    const [removed] = productPhotos.splice(i, 1);
    if (removed && !removed.file) await deleteUploadedImage(removed.url);
    renderProductPhotoGallery();
    return;
  }
  if (thumb) {
    const i = Number(thumb.dataset.index);
    if (i > 0) {
      const [chosen] = productPhotos.splice(i, 1);
      productPhotos.unshift(chosen);
      renderProductPhotoGallery();
    }
  }
});
function openProductDialog(product = null) {
  $("#productForm").reset();
  $("#productError").textContent = "";
  populateProductCategorySelect();
  if (product) {
    productPhotos = productImages(product).map((url) => ({ url, file: null }));
    $("#productId").value = product.id;
    $("#productExistingImage").value = product.image || "";
    $("#productName").value = product.name;
    $("#productCategory").value = product.category;
    $("#productPrice").value = product.price;
    $("#productTag").value = product.tag || "";
    $("#productDescription").value = product.desc || "";
    $("#productFormTitle").textContent = "Edit product";
    $("#deleteProductBtn").hidden = false;
  } else {
    productPhotos = [];
    $("#productId").value = "";
    $("#productExistingImage").value = "";
    $("#productFormTitle").textContent = "Add product";
    $("#deleteProductBtn").hidden = true;
    const activeSlug = $(".filter-btn.active")?.dataset.filter;
    if (activeSlug && activeSlug !== "all") $("#productCategory").value = activeSlug;
  }
  renderProductPhotoGallery();
  $("#productDialog").showModal();
}
$("#productDialogClose").addEventListener("click", () => $("#productDialog").close());
$("#productCategoryAddBtn").addEventListener("click", () => {
  categoryReturnToProduct = true;
  openCategoryDialog();
});
$("#productCategoryEditBtn").addEventListener("click", () => {
  const cat = CATEGORIES.find((c) => c.slug === $("#productCategory").value);
  if (!cat) return showToast("Pick a category first");
  categoryReturnToProduct = true;
  openCategoryDialog(cat);
});
$("#productImageFile").addEventListener("change", (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      productPhotos.push({ url: reader.result, file });
      renderProductPhotoGallery();
    };
    reader.readAsDataURL(file);
  });
  e.target.value = "";
});
$("#productForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin) return;
  const saveBtn = $("#productSaveBtn");
  saveBtn.disabled = true;
  const originalLabel = saveBtn.textContent;
  saveBtn.textContent = "Saving…";
  try {
    const id = $("#productId").value;
    const category = CATEGORIES.find((c) => c.slug === $("#productCategory").value);
    if (!category) throw new Error("Please pick a category");
    const images = [];
    for (const p of productPhotos) images.push(p.file ? await uploadImage(p.file) : p.url);
    const payload = {
      name: $("#productName").value.trim(),
      category_id: category.id,
      price: Number($("#productPrice").value),
      image_url: images[0] || "",
      images,
      tag: $("#productTag").value.trim() || null,
      description: $("#productDescription").value.trim(),
    };
    const result = id ? await supabaseClient.from("products").update(payload).eq("id", id) : await supabaseClient.from("products").insert(payload);
    if (result.error) throw result.error;
    $("#productDialog").close();
    await refreshAdmin();
    showToast("Product saved");
  } catch (err) {
    $("#productError").textContent = err.message || "Something went wrong";
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
  }
});
async function deleteAllProductImages(product) {
  const urls = productImages(product);
  for (const url of urls) await deleteUploadedImage(url);
}
async function deleteProductQuick(id) {
  const product = PRODUCTS.find((p) => String(p.id) === String(id));
  if (!confirm(`Delete "${product?.name || "this product"}"? This cannot be undone.`)) return;
  const r = await supabaseClient.from("products").delete().eq("id", id);
  if (r.error) return showToast(r.error.message);
  if (product) await deleteAllProductImages(product);
  await refreshAdmin();
  showToast("Product deleted");
}
$("#deleteProductBtn").addEventListener("click", async () => {
  const id = $("#productId").value;
  if (!id) return;
  const product = PRODUCTS.find((p) => String(p.id) === String(id));
  if (!confirm(`Delete "${product?.name || "this product"}"? This cannot be undone.`)) return;
  const r = await supabaseClient.from("products").delete().eq("id", id);
  if (r.error) return ($("#productError").textContent = r.error.message);
  if (product) await deleteAllProductImages(product);
  $("#productDialog").close();
  await refreshAdmin();
  showToast("Product deleted");
});
async function moveProductToCategory(productId, newSlug) {
  const category = CATEGORIES.find((c) => c.slug === newSlug);
  if (!category) return;
  const r = await supabaseClient.from("products").update({ category_id: category.id }).eq("id", productId);
  if (r.error) return showToast(r.error.message);
  await refreshAdmin();
  showToast("Product moved");
}

/* ---------- Manage-all catalogue overview ---------- */
function renderManageList() {
  $("#manageList").innerHTML = CATEGORIES.map((c) => {
    const items = PRODUCTS.filter((p) => p.category === c.slug);
    return `
    <details class="manage-cat-group" open>
      <summary>
        <span>${c.image_url ? `<img class="manage-cat-thumb" src="${escapeHtml(c.image_url)}" alt="" />` : escapeHtml(c.emoji || "") + " "}<strong>${escapeHtml(c.name)}</strong><small>${items.length} product${items.length === 1 ? "" : "s"}</small></span>
        <span class="manage-cat-actions">
          <button class="btn-text manage-edit-category" type="button" data-id="${c.id}">Edit</button>
          <button class="btn-text manage-delete-category" type="button" data-id="${c.id}">Delete</button>
        </span>
      </summary>
      <div class="manage-products">
        ${
          items.length
            ? items
                .map(
                  (p) => `
          <div class="manage-product-row" data-id="${p.id}">
            <img src="${escapeHtml(p.image || "")}" alt="" />
            <div class="manage-product-info"><strong>${escapeHtml(p.name)}</strong><small>${formatKES(p.price)}</small></div>
            <select class="manage-category-select" data-id="${p.id}">
              ${CATEGORIES.map((cc) => `<option value="${escapeHtml(cc.slug)}" ${cc.slug === p.category ? "selected" : ""}>${escapeHtml(cc.name)}</option>`).join("")}
            </select>
            <button class="btn-text manage-edit-product" type="button" data-id="${p.id}">Edit</button>
            <button class="btn-text manage-delete-product" type="button" data-id="${p.id}">Delete</button>
          </div>`
                )
                .join("")
            : `<p class="admin-help">No products in this category yet.</p>`
        }
      </div>
    </details>`;
  }).join("");
}
$("#manageDialogClose").addEventListener("click", () => $("#manageDialog").close());
$("#manageCatalogueBtn").addEventListener("click", () => { renderManageList(); $("#manageDialog").showModal(); });
$("#manageAddCategoryBtn").addEventListener("click", () => { $("#manageDialog").close(); openCategoryDialog(); });
$("#manageAddProductBtn").addEventListener("click", () => { $("#manageDialog").close(); openProductDialog(); });
$("#manageList").addEventListener("click", (e) => {
  const editCat = e.target.closest(".manage-edit-category");
  const delCat = e.target.closest(".manage-delete-category");
  const editProd = e.target.closest(".manage-edit-product");
  const delProd = e.target.closest(".manage-delete-product");
  if (editCat) { $("#manageDialog").close(); openCategoryDialog(CATEGORIES.find((c) => String(c.id) === String(editCat.dataset.id))); }
  if (delCat) deleteCategoryQuick(delCat.dataset.id);
  if (editProd) { $("#manageDialog").close(); openProductDialog(PRODUCTS.find((p) => String(p.id) === String(editProd.dataset.id))); }
  if (delProd) deleteProductQuick(delProd.dataset.id);
});
$("#manageList").addEventListener("change", (e) => {
  const sel = e.target.closest(".manage-category-select");
  if (sel) moveProductToCategory(sel.dataset.id, sel.value);
});

/* ---------- Admin toolbar + login/logout ---------- */
$("#addCategoryBtn").addEventListener("click", () => openCategoryDialog());
$("#addProductBtn").addEventListener("click", () => openProductDialog());
$("#logoutBtn").addEventListener("click", async () => {
  // Flip the UI back to visitor mode right away — don't wait on the network
  // round-trip, so the admin toolbar disappears instantly instead of needing
  // a manual page refresh.
  isAdmin = false;
  applyAdminUI();
  showToast("Signed out");
  await supabaseClient?.auth.signOut();
});

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
  const submitBtn = event.submitter || $("#loginForm button[type=submit]");
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Signing in…";
  // Use the session returned directly by signInWithPassword instead of a
  // separate getSession() round-trip — this is what makes sign-in feel
  // instant instead of waiting on a second network call.
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: $("#loginEmail").value.trim(), password: $("#loginPassword").value });
  submitBtn.disabled = false;
  submitBtn.textContent = originalLabel;
  if (error) { $("#loginError").textContent = error.message; return; }
  $("#loginError").textContent = "";
  $("#adminDialog").close();
  await checkAdminSession(data.session);
  if (isAdmin) { showToast("Welcome back — admin mode is on"); $("#products").scrollIntoView({ behavior: "smooth" }); }
  else showToast("Signed in, but this account is not an admin");
});

/* ---------- Init ---------- */
$("#year").textContent = new Date().getFullYear();
renderFilterBar();
renderProducts();
renderCart();
loadCatalogue();
checkAdminSession();
// React to the event/session Supabase gives us directly rather than
// re-querying getSession() (which can race with an in-flight sign-out and
// leave the UI showing stale admin state until a manual refresh).
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") { isAdmin = false; applyAdminUI(); return; }
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
      checkAdminSession(session);
    }
  });
}