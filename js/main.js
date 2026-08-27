/* ============================================================
   MESO HOUSEHOLDS — page controller (visitor experience + render loop)
   The catalogue, hero slider, cart, nav and WhatsApp checkout.
   ============================================================ */

const WHATSAPP_NUMBER = "254742005725"; // shop line, also used for order messages

(function (global) {
  'use strict';

  const U = global.MesoUtil;
  const db = global.MesoDB;
  const R = global.MesoRender;
  const $ = U.$;
  const $$ = U.$$;

  const site = {
    filter: "all",
    isAdmin: false,
    editMode: false,
    cart: [],
  };

  /* ============================================================
     catalogue rendering
     ============================================================ */
  const catalogRoot = () => $("#catalog");
  const filterBar = () => $("#filterBar");

  /* ---- caret safety: a repaint must never eat what the admin is typing ---- */
  function caretAt(el) {
    const sel = global.getSelection && global.getSelection();
    if (!sel || !sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.endContainer, range.endOffset);
    return pre.toString().length;
  }
  function setCaret(el, pos) {
    const sel = global.getSelection && global.getSelection();
    if (!sel || !document.createRange) return;
    const range = document.createRange();
    const walker = document.createTreeWalker(el, global.NodeFilter ? global.NodeFilter.SHOW_TEXT : 4);
    let remaining = pos;
    let node;
    while ((node = walker.nextNode())) {
      const len = node.textContent.length;
      if (remaining <= len) {
        range.setStart(node, remaining);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    }
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function captureTyping() {
    const el = document.activeElement;
    if (!el || !el.matches || !el.matches("[data-edit],[data-cat-edit]")) return null;
    const isProduct = !!el.dataset.edit;
    const field = isProduct ? el.dataset.edit : el.dataset.catEdit;
    const attr = isProduct ? "data-edit" : "data-cat-edit";
    const id = String(el.dataset.id || "").replace(/["\\]/g, "\\$&");
    const info = {
      selector: `[${attr}="${field}"][data-id="${id}"]`,
      value: el.textContent,
      before: el.dataset.before,
      caret: caretAt(el),
      unlock: el._unlock || null,
      inCatalog: !!(catalogRoot() && catalogRoot().contains(el)) || !!$("#heroTrack").contains(el),
    };
    el._unlock = null; // handed over to the replacement node below
    return info;
  }

  function renderFooterCats() {
    const host = $("#footerCategories");
    if (!host) return;
    const cats = db.state.categories.slice(0, 6);
    if (!cats.length) return;
    host.innerHTML = cats
      .map(
        (c) =>
          `<li><a href="#products" data-footer-filter="${U.escapeHtml(c.slug)}">${U.escapeHtml((c.emoji ? c.emoji + " " : "") + c.name)}</a></li>`
      )
      .join("");
  }

  function renderCatalog(opts = {}) {
    const root = catalogRoot();
    if (!root) return;
    const typing = opts.ignoreTyping ? null : captureTyping();
    const admin = site.editMode;
    root.innerHTML = R.catalogHTML({ admin, filter: site.filter });
    root.dataset.admin = admin ? "1" : "0";
    const bar = filterBar();
    if (bar) {
      bar.innerHTML = R.filterBarHTML(site.filter, { admin });
      bar.dataset.admin = admin ? "1" : "0";
    }
    renderFooterCats();
    restoreTyping(typing, root);
  }

  function restoreTyping(typing, root) {
    if (!typing || !typing.inCatalog) {
      if (typing && typing.unlock) typing.unlock();
      return;
    }
    const el = root.querySelector(typing.selector);
    if (!el) {
      if (typing.unlock) typing.unlock();
      return;
    }
    if (el.textContent !== typing.value) el.textContent = typing.value;
    // keep the "don't disturb me" lock alive on the fresh node
    el._unlock = typing.unlock || null;
    el.dataset.before = typing.before == null ? "" : typing.before;
    // focus() on the replacement node makes the browser blur the old one; mark the
    // node so that echo blur is ignored (cleared in a microtask, before any real blur)
    el.dataset.restored = "1";
    el.focus();
    setCaret(el, typing.caret);
    (global.queueMicrotask || ((fn) => Promise.resolve().then(fn)))(() => delete el.dataset.restored);
  }

  /* Repaints are postponed while the admin types inside a field, but never for
     long — a lock held by an open editor must not freeze the shop. */
  let deferredReason = null;
  let deferTimer = null;
  const DEFER_MS = 600;

  function paint(reason) {
    deferredReason = null;
    clearTimeout(deferTimer);
    deferTimer = null;
    if (reason === "hero" || reason === "remote:hero_slides") {
      renderHero();
      return;
    }
    renderCatalog();
    syncCart();
  }

  function scheduleRender(reason) {
    if (U.rendersLocked()) {
      deferredReason = reason || "queued";
      if (!deferTimer) deferTimer = setTimeout(() => paint(deferredReason), DEFER_MS);
      return;
    }
    paint(reason);
  }

  U.onUnlock(() => {
    if (deferredReason) paint(deferredReason);
  });

  /* ============================================================
     hero slideshow (works with static markup and with Supabase slides)
     ============================================================ */
  let slider = { slides: [], dots: [], idx: 0, timer: null };

  function renderHero() {
    const track = $("#heroTrack");
    if (!track) return;
    const all = db.state.heroSlides || [];
    const admin = site.editMode;
    const slides = admin ? all : all.filter((s) => s.active !== false);
    const typing = captureTyping();
    if (all.length && slides.length) {
      track.innerHTML = R.heroHTML(slides, { admin });
      track.removeAttribute("data-static");
      restoreTyping(typing, track);
    } else if (all.length && !slides.length) {
      track.innerHTML = admin ? `<div class="hero-empty-admin">All hero photos are switched off — visitors see the fallback photo below.</div>` + track.innerHTML : track.innerHTML;
      track.dataset.static = "1";
    } else {
      track.dataset.static = "1";
    }
    initSlider();
  }

  function initSlider() {
    const box = $("#heroSlideshow");
    if (!box) return;
    clearInterval(slider.timer);
    slider.slides = $$(".hero-slide", box);
    const dotHost = $("#sliderDots");
    if (!dotHost) return;
    dotHost.innerHTML = "";
    slider.dots = [];

    if (slider.slides.length > 1) {
      slider.slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.className = "slider-dot" + (i === 0 ? " active" : "");
        dot.setAttribute("aria-label", `Show photo ${i + 1}`);
        dot.addEventListener("click", () => goTo(i, true));
        dotHost.appendChild(dot);
        slider.dots.push(dot);
      });
    }
    goTo(Math.min(slider.idx, Math.max(0, slider.slides.length - 1)));
    if (slider.slides.length > 1) restart();
  }

  function goTo(i, manual = false) {
    const total = slider.slides.length;
    if (!total) return;
    slider.idx = ((i % total) + total) % total;
    slider.slides.forEach((s, idx) => s.classList.toggle("active", idx === slider.idx));
    slider.dots.forEach((d, idx) => d.classList.toggle("active", idx === slider.idx));
    if (manual) restart();
    const counter = $("#slideCounter");
    if (counter) counter.textContent = slider.idx + 1 + " / " + total;
  }

  function restart() {
    clearInterval(slider.timer);
    slider.timer = setInterval(() => goTo(slider.idx + 1), 4500);
  }

  $("#slidePrev") && $("#slidePrev").addEventListener("click", () => goTo(slider.idx - 1, true));
  $("#slideNext") && $("#slideNext").addEventListener("click", () => goTo(slider.idx + 1, true));
  const heroBox = $("#heroSlideshow");
  if (heroBox) {
    heroBox.addEventListener("mouseenter", () => clearInterval(slider.timer));
    heroBox.addEventListener("mouseleave", () => slider.slides.length > 1 && restart());
  }

  /* ============================================================
     filters (delegated — survives every re-render)
     ============================================================ */
  document.addEventListener("click", (e) => {
    const foot = e.target.closest("[data-footer-filter]");
    if (foot) {
      e.preventDefault();
      site.filter = foot.dataset.footerFilter;
      renderCatalog();
      $("#products") && $("#products").scrollIntoView({ behavior: "smooth" });
      return;
    }
    const btn = e.target.closest(".filter-btn");
    if (!btn || !filterBar() || !filterBar().contains(btn)) return;
    if (btn.dataset.act === "add-category") return; // handled by admin.js
    site.filter = btn.dataset.filter || "all";
    renderCatalog();
  });

  /* ============================================================
     cart
     ============================================================ */
  function cartEls() {
    return {
      btn: $("#cartBtn"),
      drawer: $("#cartDrawer"),
      overlay: $("#cartOverlay"),
      count: $("#cartCount"),
      headCount: $("#cartHeadCount"),
      items: $("#cartItems"),
      empty: $("#cartEmpty"),
      foot: $("#cartFoot"),
      total: $("#cartTotal"),
      close: $("#cartClose"),
    };
  }

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem("mesoCart"));
      site.cart = Array.isArray(raw) ? raw.filter((it) => it && it.id != null) : [];
    } catch (err) {
      site.cart = [];
    }
  }
  function saveCart() {
    try {
      localStorage.setItem("mesoCart", JSON.stringify(site.cart));
    } catch (err) {
      console.warn(err);
    }
  }

  /** Keep cart lines in step with live prices / names / photos, drop deleted items. */
  function syncCart() {
    const before = site.cart.length;
    const dropped = [];
    site.cart = site.cart
      .map((line) => {
        const product = db.productById(line.id);
        if (!product) {
          dropped.push(line.name || "An item");
          return null;
        }
        return Object.assign({}, line, {
          name: product.name,
          price: product.price,
          image: db.resolveImage(product.image) || line.image,
        });
      })
      .filter(Boolean);
    renderCart();
    if (dropped.length && before !== site.cart.length) {
      U.toast(`${dropped.join(", ")} ${dropped.length > 1 ? "were" : "was"} removed from your order — no longer listed`, "error", 4200);
      saveCart();
    }
  }

  function renderCart() {
    const el = cartEls();
    if (!el.items) return;
    const count = site.cart.reduce((s, it) => s + it.qty, 0);
    el.count.textContent = count;
    el.headCount.textContent = count ? `(${count} item${count > 1 ? "s" : ""})` : "";
    el.count.classList.remove("bump");
    void el.count.offsetWidth;
    if (count) el.count.classList.add("bump");

    el.empty.style.display = site.cart.length ? "none" : "flex";
    el.foot.classList.toggle("visible", site.cart.length > 0);
    el.items.innerHTML = "";

    site.cart.forEach((item, i) => {
      const line = document.createElement("div");
      line.className = "cart-line";
      line.style.animationDelay = i * 0.04 + "s";
      line.innerHTML = `
        <img src="${U.escapeHtml(item.image || "")}" alt="${U.escapeHtml(item.name)}" />
        <div class="cart-line-info">
          <span class="cart-line-name">${U.escapeHtml(item.name)}</span>
          <span class="cart-line-price">${U.formatKES(item.price)} each</span>
          <div class="cart-line-controls">
            <button class="qty-btn minus" data-cart-act="minus" data-id="${U.escapeHtml(String(item.id))}" aria-label="Decrease quantity">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn plus" data-cart-act="plus" data-id="${U.escapeHtml(String(item.id))}" aria-label="Increase quantity">+</button>
            <button class="cart-line-remove" data-cart-act="remove" data-id="${U.escapeHtml(String(item.id))}">Remove</button>
          </div>
        </div>
        <span class="cart-line-total">${U.formatKES(item.price * item.qty)}</span>`;
      el.items.appendChild(line);
    });

    const total = site.cart.reduce((s, it) => s + it.price * it.qty, 0);
    el.total.textContent = U.formatKES(total);
  }

  function addToCart(id) {
    const product = db.productById(id);
    if (!product) return;
    const existing = site.cart.find((it) => String(it.id) === String(id));
    if (existing) existing.qty += 1;
    else
      site.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: db.resolveImage(product.image),
        qty: 1,
      });
    saveCart();
    renderCart();
    U.toast(`✔ ${product.name} added to your order`, "ok");
  }

  function changeQty(id, delta) {
    const item = site.cart.find((it) => String(it.id) === String(id));
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) site.cart = site.cart.filter((it) => String(it.id) !== String(id));
    saveCart();
    renderCart();
  }

  function openCart() {
    const el = cartEls();
    el.drawer.classList.add("open");
    el.overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  }
  function closeCart() {
    const el = cartEls();
    el.drawer.classList.remove("open");
    el.overlay.classList.remove("show");
    document.body.style.overflow = "";
  }

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add && catalogRoot() && catalogRoot().contains(add)) {
      e.preventDefault();
      addToCart(add.dataset.add);
      return;
    }
    const cartBtn = e.target.closest("[data-cart-act]");
    if (cartBtn) {
      const act = cartBtn.dataset.cartAct;
      if (act === "plus") changeQty(cartBtn.dataset.id, 1);
      if (act === "minus") changeQty(cartBtn.dataset.id, -1);
      if (act === "remove") {
        site.cart = site.cart.filter((it) => String(it.id) !== String(cartBtn.dataset.id));
        saveCart();
        renderCart();
        U.toast("Item removed from your order");
      }
    }
  });

  /* ============================================================
     nav / scroll chrome
     ============================================================ */
  function initChrome() {
    const navbar = $("#navbar");
    const hamburger = $("#hamburger");
    const navLinks = $("#navLinks");
    if (hamburger && navLinks) {
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
    }

    const sections = ["home", "products", "about", "why", "visit"].map((id) => $("#" + id)).filter(Boolean);
    function highlightNav() {
      const pos = window.scrollY + 150;
      let current = "home";
      sections.forEach((sec) => {
        if (sec.offsetTop <= pos) current = sec.id;
      });
      $$(".nav-link").forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + current));
    }
    const onScroll = () => {
      if (navbar) navbar.classList.toggle("scrolled", window.scrollY > 10);
      const back = $("#backTop");
      if (back) back.classList.toggle("show", window.scrollY > 500);
      highlightNav();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const back = $("#backTop");
    back && back.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

    const revealEls = $$(".about-inner, .section-head, .why-card, .testi-card, .visit-card, .map-wrap, .feature, .cta-inner");
    if ("IntersectionObserver" in window) {
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
    }
  }

  /* ============================================================
     WhatsApp checkout
     ============================================================ */
  $("#checkoutBtn") &&
    $("#checkoutBtn").addEventListener("click", () => {
      if (!site.cart.length) return;
      const lines = site.cart.map((it) => `• ${it.name} × ${it.qty} — ${U.formatKES(it.price * it.qty)}`);
      const total = site.cart.reduce((s, it) => s + it.price * it.qty, 0);
      const msg =
        `Hello Meso Households! 🏠\n\n` +
        `I'd like to place this order:\n${lines.join("\n")}\n\n` +
        `*TOTAL: ${U.formatKES(total)}*\n\n` +
        `Name: \nDelivery/Pickup: \n\nThank you!`;
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    });

  $("#cartEmptyBrowse") &&
    $("#cartEmptyBrowse").addEventListener("click", () => {
      closeCart();
      $("#products") && $("#products").scrollIntoView({ behavior: "smooth" });
    });
  $("#clearCartBtn") &&
    $("#clearCartBtn").addEventListener("click", () => {
      if (!site.cart.length) return;
      site.cart = [];
      saveCart();
      renderCart();
      U.toast("Cart cleared");
    });
  $("#cartClose") && $("#cartClose").addEventListener("click", closeCart);
  $("#cartOverlay") && $("#cartOverlay").addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCart();
  });

  /* ============================================================
     mode switching (used by the admin studio)
     ============================================================ */
  function setEditMode(on, persist = true) {
    site.editMode = !!on;
    document.body.classList.toggle("admin-edit", site.editMode);
    document.body.classList.toggle("admin-live", site.isAdmin && !site.editMode);
    if (site.isAdmin && persist) {
      try {
        localStorage.setItem("mesoEditMode", site.editMode ? "1" : "0");
      } catch (err) {}
    }
    renderCatalog();
    renderHero();
  }
  function setAdmin(isAdmin) {
    const changed = site.isAdmin !== !!isAdmin;
    site.isAdmin = !!isAdmin;
    document.body.classList.toggle("is-admin", site.isAdmin);
    if (!site.isAdmin) {
      setEditMode(false, false);
      return;
    }
    // signing in means they came to edit — always start in edit mode;
    // a returning admin gets back whatever switch position they left.
    let remembered = false;
    if (!changed) {
      try {
        remembered = localStorage.getItem("mesoEditMode") !== "0";
      } catch (err) {
        remembered = true;
      }
    }
    setEditMode(changed ? true : remembered);
    const toggle = $("#editModeToggle");
    if (toggle) toggle.checked = site.editMode;
  }

  /* ============================================================
     boot
     ============================================================ */
  async function boot() {
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();

    loadCart();
    renderCart();
    initChrome();

    try {
      await db.load();
    } catch (err) {
      console.error("[meso] boot load failed", err);
    }
    if (db.state.mode === "preview" && db.state.offline) {
      U.toast("Preview mode — Supabase unreachable, so edits are saved in this browser only", "info", 5200);
    } else if (db.state.capabilities.catalogue === "missing") {
      U.toast("The Supabase catalogue tables were not found — run supabase-schema.sql to go live", "error", 7000);
    }

    db.subscribe((s, reason) => {
      scheduleRender(reason);
    });
    await db.refreshAdmin();
    renderCatalog();
    renderHero();
    if (global.MesoAdmin) global.MesoAdmin.attach();
  }

  global.MesoSite = {
    state: site,
    renderCatalog,
    renderHero,
    scheduleRender,
    setEditMode,
    setAdmin,
    syncCart,
    initSlider,
    goToSlide: goTo,
    get cart() {
      return site.cart;
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
