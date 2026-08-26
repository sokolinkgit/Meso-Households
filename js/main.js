/* ============================================================
   MESO HOUSEHOLDS — One-Stop Household Solution
   Pure JavaScript (no libraries)
   ============================================================ */

const SHOP_PHONE_DISPLAY = "0742 005 725";
const WHATSAPP_NUMBER = "254742005725";

/* ---------- Product catalogue ---------- */
const PRODUCTS = [
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

function renderProducts(filter = "all") {
  productsGrid.innerHTML = "";
  const list = filter === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter);

  list.forEach((p, i) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.style.animationDelay = i * 0.06 + "s";
    card.innerHTML = `
      <div class="product-media">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
        ${p.tag ? `<span class="product-tag ${p.tag === "Hot" ? "hot" : ""}">${p.tag}</span>` : ""}
      </div>
      <div class="product-body">
        <span class="product-cat">${p.categoryLabel}</span>
        <h3>${p.name}</h3>
        <p class="product-desc">${p.desc}</p>
        <div class="product-foot">
          <span class="product-price">${formatKES(p.price)}</span>
          <button class="add-btn" data-id="${p.id}" aria-label="Add ${p.name} to cart">
            <svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Add
          </button>
        </div>
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
const sections = ["home", "about", "products", "why", "visit"].map((id) => $("#" + id));
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

/* ---------- Init ---------- */
$("#year").textContent = new Date().getFullYear();
renderProducts();
renderCart();
