/* ============================================================
   MESO HOUSEHOLDS — Admin Studio (window.MesoAdmin)

   There is no separate "admin page" to maintain: the admin signs in and
   edits the real page. Categories show every product underneath them,
   text is click-to-edit, dropdowns move products between categories,
   photos upload straight into Supabase Storage — and each change is
   written the moment it is made (optimistic UI, rollback on failure).
   ============================================================ */
(function (global) {
  'use strict';

  const U = global.MesoUtil;
  const db = global.MesoDB;
  const $ = U.$;
  const $$ = U.$$;

  const IMG_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml";
  let attached = false;
  let loginClicks = 0;
  let loginStamp = 0;
  let mediaCache = null;
  let productCtx = null; // { id, imageField }
  let categoryCtx = null; // { id, banner }
  let heroCtx = null;
  let slugTouched = false;

  /** in-flight saves per row id, so a dialog never reads stale values */
  const pendingEdits = new Map();
  const key = (id) => String(id);

  /* Writes are serialised per editor session. Without this, two quick `change`
     events on a brand-new product would both take the insert branch and create
     a duplicate row. */
  const queues = new Map();
  function queued(queueKey, job) {
    const prev = queues.get(queueKey) || Promise.resolve();
    const next = prev.then(job, job);
    queues.set(
      queueKey,
      next.then(
        () => undefined,
        () => undefined
      )
    );
    return next;
  }

  function run(fn, productId) {
    const work = (async () => {
      if (productId != null) flag(productId, "saving");
      try {
        const out = await fn();
        if (productId != null) flag(productId, "saved");
        return out;
      } catch (err) {
        if (productId != null) flag(productId, "error");
        U.toast(err.message || "Could not save that change", "error", 5200);
        throw err;
      }
    })();
    if (productId != null) {
      pendingEdits.set(key(productId), work);
      work.catch(() => {}).then(() => pendingEdits.delete(key(productId)));
    }
    return work;
  }
  async function flushEdits(id) {
    if (id == null) return;
    const inFlight = pendingEdits.get(key(id));
    if (inFlight) {
      try {
        await inFlight;
      } catch (err) {
        /* already reported */
      }
    }
  }

  function site() {
    return global.MesoSite;
  }
  function render(force) {
    const S = site();
    S && S.renderCatalog(force ? { ignoreTyping: true } : undefined);
  }
  function renderHero() {
    const S = site();
    S && S.renderHero();
    if (S && S.initSlider) S.initSlider();
  }
  const editOn = () => db.state.isAdmin && site() && site().state.editMode;

  /* ============================================================
     attach
     ============================================================ */
  function attach() {
    if (attached) return;
    attached = true;
    wireEntryPoints();
    wireAdminBar();
    wireCatalogActions();
    wireInlineText();
    wireDialogs();
    wireHero();
    wireLogin();
    db.subscribe(onStateChange);
    db.onAuthChange(syncChrome);
    syncChrome();
  }

  function onStateChange(s, reason) {
    if (reason === "auth" || reason === "load" || reason === "realtime") syncChrome();
    if (reason === "category" || reason === "category-reorder") refreshOpenForms();
    const bar = $("#heroAdminBar");
    if (bar) renderHeroBar(bar);
  }

  /* ============================================================
     admin bar + status chip
     ============================================================ */
  function syncChrome() {
    const isAdmin = !!db.state.isAdmin;
    const bar = $("#adminBar");
    if (bar) bar.hidden = !isAdmin;
    document.body.classList.toggle("has-admin-bar", isAdmin);
    const S = site();
    if (S) S.setAdmin(isAdmin);

    const email = $("#adminUserEmail");
    if (email) email.textContent = isAdmin && db.state.user ? db.state.user.email : "";
    const toggle = $("#editModeToggle");
    if (toggle) toggle.checked = !!(S && S.state.editMode);

    const counts = $("#adminCounts");
    if (counts)
      counts.innerHTML =
        `<b>${db.state.products.length}</b> products<span class="dot">·</span>` +
        `<b>${db.state.categories.length}</b> categories<span class="dot">·</span>` +
        `<b>${db.state.heroSlides.length}</b> hero photos`;

    const chip = $("#adminStatus");
    if (chip) {
      const caps = db.state.capabilities;
      const problems = [];
      if (caps.catalogue !== "ok") problems.push("catalogue tables");
      if (caps.storage === "missing" || caps.storage === "blocked") problems.push("image uploads");
      chip.classList.remove("chip--ok", "chip--warn", "chip--bad");
      if (db.state.mode !== "live") {
        chip.classList.add("chip--warn");
        chip.innerHTML = `<span class="chip__dot"></span>Preview data · saved in this browser`;
      } else if (problems.length) {
        chip.classList.add("chip--bad");
        chip.innerHTML = `<span class="chip__dot"></span>Setup needed: ${U.escapeHtml(problems.join(", "))}`;
      } else {
        chip.classList.add("chip--ok");
        chip.innerHTML =
          `<span class="chip__dot"></span>Live on Supabase${db.state.realtimeStatus === "SUBSCRIBED" ? " · realtime on" : ""}`;
      }
    }
    if (bar) renderHeroBar($("#heroAdminBar"));
    if (isAdmin) syncSetupNudges();
  }

  let nudgedStorage = false;
  function syncSetupNudges() {
    if (!nudgedStorage && db.state.capabilities.storage === "missing") {
      nudgedStorage = true;
      U.toast("Photo uploads need the storage bucket — click the status pill for the one-line fix", "error", 7000);
    }
  }

  function wireAdminBar() {
    const toggle = $("#editModeToggle");
    toggle &&
      toggle.addEventListener("change", () => {
        site().setEditMode(toggle.checked);
        U.toast(
          toggle.checked ? "Edit mode on — click any text, photo or dropdown to change it" : "Now viewing exactly what a visitor sees",
          "ok",
          2600
        );
      });
    $("#adminAddProduct") && $("#adminAddProduct").addEventListener("click", () => openProductDialog(null));
    $("#adminAddCategory") && $("#adminAddCategory").addEventListener("click", () => openCategoryDialog(null));
    $("#adminMediaBtn") && $("#adminMediaBtn").addEventListener("click", () => openMediaDialog());
    $("#adminStatus") && $("#adminStatus").addEventListener("click", openSetupDialog);
    $("#adminSignOut") &&
      $("#adminSignOut").addEventListener("click", async () => {
        await db.signOut();
        U.toast("Signed out of the admin studio", "ok");
      });
    $$("[data-admin-preview]").forEach((btn) =>
      btn.addEventListener("click", () => {
        site().setEditMode(false);
        const t = $("#editModeToggle");
        if (t) t.checked = false;
        U.toast("Previewing as a visitor — flip the switch to keep editing", "info", 2600);
      })
    );
  }

  /* ============================================================
     entry points / login
     ============================================================ */
  function wireEntryPoints() {
    const brand = $("#homeIcon");
    brand &&
      brand.addEventListener("click", (e) => {
        if (db.state.isAdmin) return;
        const now = Date.now();
        if (now - loginStamp > 30000) loginClicks = 0;
        loginStamp = now;
        loginClicks += 1;
        if (loginClicks >= 5) {
          loginClicks = 0;
          e.preventDefault();
          openLogin();
        } else if (loginClicks === 3) {
          U.toast("Almost there…", "info", 1200);
        }
      });
    $$("[data-open-login]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        if (db.state.isAdmin) {
          $("#products") && $("#products").scrollIntoView({ behavior: "smooth" });
        } else openLogin();
      })
    );
    if (location.hash === "#admin" || location.hash === "#manage") {
      history.replaceState(null, "", location.pathname + location.search);
      if (!db.state.isAdmin) openLogin();
    }
  }

  function openLogin() {
    const dlg = $("#adminDialog");
    if (!dlg) return;
    const err = $("#loginError");
    if (err) err.textContent = "";
    const hint = $("#loginModeHint");
    if (hint)
      hint.textContent =
        db.state.mode === "live"
          ? "Uses your Supabase Authentication account (must be listed in public.admin_users)."
          : "Supabase is not reachable from here, so any email + password opens the studio in preview mode — perfect for trying it out.";
    U.openDialog(dlg);
    setTimeout(() => $("#loginEmail") && $("#loginEmail").focus(), 60);
  }

  function wireLogin() {
    const form = $("#loginForm");
    form &&
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = $("#loginError");
        const btn = $("#loginSubmit");
        if (err) err.textContent = "";
        btn && btn.classList.add("is-busy");
        try {
          await db.signIn($("#loginEmail").value, $("#loginPassword").value);
          U.closeDialog($("#adminDialog"));
          const pw = $("#loginPassword");
          if (pw) pw.value = "";
          U.toast("Welcome back — edit mode is on. Click any text, photo or dropdown to change the page.", "ok", 4600);
          syncChrome();
        } catch (error) {
          if (err) err.textContent = error.message;
        } finally {
          btn && btn.classList.remove("is-busy");
        }
      });
    $$("[data-close]").forEach((el) => el.addEventListener("click", () => U.closeDialog(el.closest("dialog"))));
  }

  /* ============================================================
     catalogue actions (buttons + dropdowns), all delegated
     ============================================================ */
  function wireCatalogActions() {
    document.addEventListener("click", async (e) => {
      const trigger = e.target.closest("[data-act]");
      if (!trigger || !editOn()) return;
      if (trigger.closest("dialog")) return; // dialogs wire their own buttons
      const act = trigger.dataset.act;
      const id = trigger.dataset.id;

      if (act === "edit") {
        e.preventDefault();
        openProductDialog(id);
      } else if (act === "image") {
        e.preventDefault();
        openImageDialogFor(id);
      } else if (act === "del") {
        e.preventDefault();
        deleteProduct(id);
      } else if (act === "dup") {
        e.preventDefault();
        duplicateProduct(id);
      } else if (act === "add-tag") {
        e.preventDefault();
        openProductDialog(id).then(() => {
          const tag = $("#pfTag");
          tag && tag.focus();
        });
      } else if (act === "add-product") {
        e.preventDefault();
        openProductDialog(null);
      } else if (act === "add-category") {
        e.preventDefault();
        openCategoryDialog(null);
      } else if (act === "cat-edit") {
        e.preventDefault();
        openCategoryDialog(id);
      } else if (act === "cat-add") {
        e.preventDefault();
        openProductDialog(null, { categoryId: id });
      } else if (act === "cat-del") {
        e.preventDefault();
        deleteCategory(id);
      } else if (act === "cat-banner-off") {
        e.preventDefault();
        try {
          await run(() => db.upsertCategory({ id, banner: "" }));
          U.toast("Banner removed", "ok", 2000);
          render();
        } catch (err) {
          U.toast(err.message, "error", 5000);
        }
      } else if (act === "cat-up" || act === "cat-down") {
        e.preventDefault();
        moveCategory(id, act === "cat-up" ? -1 : 1);
      }
    });

    document.addEventListener("change", async (e) => {
      if (!editOn()) return;
      const el = e.target;

      /* the "In <category>" dropdown on a product card — moves it instantly */
      if (el.matches('[data-act="move"]')) {
        const id = el.dataset.id;
        await flushEdits(id);
        const product = db.productById(id);
        const to = el.value;
        if (!product || !to || String(to) === String(product.categoryId)) return;
        const target = db.categoryById(to);
        try {
          await run(() => db.upsertProduct({ id: product.id, categoryId: to }), product.id);
          U.toast(`Moved to ${target.emoji || ""} ${target.name}`, "ok", 2400);
        } catch (err) {
          /* the card reverted itself */
        }
        render();
      }

      /* "Move all ▸" on a category header */
      if (el.matches('[data-act="cat-moveall"]')) {
        const fromId = el.dataset.id;
        const toId = el.value;
        el.value = "";
        if (!toId) return;
        const from = db.categoryById(fromId);
        const to = db.categoryById(toId);
        try {
          const n = await run(() => db.moveAllProducts(fromId, toId));
          U.toast(`${n} product${n === 1 ? "" : "s"} moved from ${from.name} to ${to.name}`, "ok", 3200);
        } catch (err) {
          U.toast(err.message, "error", 5200);
        }
        render();
      }
    });
  }

  async function moveCategory(id, delta) {
    const ids = db.state.categories.map((c) => c.id);
    const idx = ids.findIndex((x) => String(x) === String(id));
    const swap = idx + delta;
    if (idx < 0 || swap < 0 || swap >= ids.length) return;
    const next = ids.slice();
    [next[idx], next[swap]] = [next[swap], next[idx]];
    try {
      await db.reorderCategories(next);
      render();
    } catch (err) {
      U.toast(err.message, "error", 5000);
    }
  }

  function flag(productId, kind, text) {
    if (productId == null) return;
    const card = $(`#catalog .product-card[data-id="${cssEscape(productId)}"]`);
    const host = card && card.querySelector('[data-role="flag"]');
    if (!host) return;
    host.hidden = false;
    host.className = "pc-flag pc-flag--" + kind;
    host.textContent =
      text || (kind === "saving" ? "Saving…" : kind === "saved" ? "Saved ✓" : "Save failed — reverted");
    clearTimeout(host._t);
    host._t = setTimeout(() => {
      host.hidden = true;
      host.textContent = "";
    }, kind === "error" ? 4200 : 1500);
  }
  const cssEscape = (value) =>
    global.CSS && global.CSS.escape ? global.CSS.escape(String(value)) : String(value).replace(/["\\]/g, "\\$&");

  /* ============================================================
     click-to-edit text on the live page
     ============================================================ */
  function wireInlineText() {
    document.addEventListener("focusin", (e) => {
      const el = e.target.closest("[data-edit],[data-cat-edit]");
      if (!el || !editOn()) return;
      // focus restored by a repaint right after a save: keep the existing lock & value
      if (el.dataset.restored) {
        delete el.dataset.restored;
        return;
      }
      el.dataset.before = el.textContent;
      if (!el._unlock) el._unlock = U.lockRender("inline-edit");
    });

    document.addEventListener("focusout", (e) => {
      const el = e.target.closest("[data-edit],[data-cat-edit]");
      if (!el) return;
      // A repaint can hand focus to the replacement node, which makes the browser
      // blur it again immediately. Swallow only that echo (never a real blur), so
      // what the admin typed stays put and still saves on the next blur.
      if (!el.isConnected) return;
      if (el.dataset.restoredAt && Date.now() - Number(el.dataset.restoredAt) < 500) {
        delete el.dataset.restoredAt;
        return;
      }
      const before = (el.dataset.before || "").replace(/\s+/g, " ").trim();
      const next = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (el._unlock) {
        el._unlock();
        el._unlock = null;
      }
      if (next === before) return;
      commitInline(el, next, el.dataset.before || "");
    });

    document.addEventListener("keydown", (e) => {
      const el = e.target.closest("[data-edit],[data-cat-edit]");
      if (!el) return;
      if (e.key === "Enter") {
        e.preventDefault();
        el.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        el.textContent = el.dataset.before || "";
        el.blur();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        el.blur();
      }
    });

    // never let stray markup into the page
    document.addEventListener("paste", (e) => {
      const el = e.target.closest("[data-edit],[data-cat-edit]");
      if (!el) return;
      e.preventDefault();
      const text = ((e.clipboardData || global.clipboardData) && (e.clipboardData || global.clipboardData).getData("text/plain")) || "";
      el.textContent = text.replace(/\s+/g, " ").trim();
    });
  }

  async function commitInline(el, value, before) {
    const field = el.dataset.edit;
    const catField = el.dataset.catEdit;
    const id = el.dataset.id;
    const revert = (msg) => {
      // rebuild from the data layer: the card always ends up showing what is really saved
      render(true);
      if (msg) U.toast(msg, "error", 4200);
    };

    if (field) {
      const product = db.productById(id);
      if (!product) return revert("That product is gone — refresh the page.");
      await flushEdits(id);
      if (!value && field !== "desc" && field !== "tag") return revert(`${labelOf(field)} can't be empty.`);
      try {
        if (field === "price") {
          if (!/\d/.test(value)) return revert("Enter a price, e.g. 1500");
          const price = U.parsePrice(value);
          el.textContent = MesoRender.formatPriceNumber(price);
          await queued("product:" + key(id), () => run(() => db.upsertProduct({ id, price }), id));
          U.toast(`New price saved — ${U.formatKES(price)}`, "ok", 2200);
        } else {
          const patch = {};
          if (field === "name") patch.name = value;
          if (field === "desc") patch.desc = value;
          if (field === "tag") patch.tag = value;
          await queued("product:" + key(id), () => run(() => db.upsertProduct(Object.assign({ id }, patch)), id));
          U.toast(
            field === "name" ? "Name updated everywhere it appears" : field === "tag" ? (value ? "Badge saved" : "Badge removed") : "Description saved",
            "ok",
            2000
          );
        }
        render();
      } catch (err) {
        render(true); // failed write → snap the card back to the stored values
      }
      return;
    }

    if (catField) {
      const category = db.categoryById(id);
      if (!category) return revert("That category is gone — refresh the page.");
      if (!value && catField === "name") return revert("A category needs a name.");
      const patch = catField === "name" ? { name: value } : { emoji: value };
      try {
        await queued("category:" + key(id), () => run(() => db.upsertCategory(Object.assign({ id }, patch))));
        U.toast(catField === "name" ? "Category renamed everywhere" : "Icon updated", "ok", 2000);
      } catch (err) {
        el.textContent = before;
      }
      render();
    }
  }
  const labelOf = (field) => ({ name: "Name", desc: "Description", tag: "Badge", price: "Price" }[field] || "That field");

  /* ============================================================
     dialog plumbing
     ============================================================ */
  function wireDialogs() {
    $$("dialog.sheet").forEach((dlg) => {
      dlg.addEventListener("click", (e) => {
        if (e.target === dlg) U.closeDialog(dlg);
      });
      dlg.addEventListener("close", () => {
        if (dlg._unlock) {
          dlg._unlock();
          dlg._unlock = null;
        }
        if (dlg.id === "productDialog" || dlg.id === "categoryDialog" || dlg.id === "imageDialog") render();
        if (dlg.id === "heroDialog") renderHero();
      });
      dlg.addEventListener("cancel", (e) => {
        e.preventDefault();
        U.closeDialog(dlg);
      });
      // Enter inside a text input submits that dialog's form
      dlg.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.matches("input[type=text],input[type=number],input:not([type])")) {
          e.preventDefault();
          const form = e.target.closest("form");
          if (form && form.requestSubmit) form.requestSubmit();
        }
      });
    });
    ["#productForm", "#categoryForm", "#heroForm"].forEach((sel) => {
      const form = $(sel);
      form && form.addEventListener("submit", (e) => e.preventDefault());
    });
  }

  function mount(dlg) {
    if (!dlg) return null;
    U.openDialog(dlg);
    if (dlg._unlock) dlg._unlock();
    dlg._unlock = U.lockRender("dialog:" + dlg.id);
    return dlg;
  }
  function unmount(dlg) {
    U.closeDialog(dlg);
  }

  function setStatus(dialog, text, kind = "") {
    const el = dialog && dialog.querySelector('[data-role="status"]');
    if (!el) return;
    el.textContent = text || "";
    el.className = "autosave " + kind;
  }

  /* ============================================================
     product dialog
     ============================================================ */
  function categoryOptions(selected) {
    return db.state.categories
      .map(
        (c) =>
          `<option value="${U.escapeHtml(c.id)}"${String(c.id) === String(selected) ? " selected" : ""}>${U.escapeHtml(
            (c.emoji ? c.emoji + " " : "") + c.name
          )}</option>`
      )
      .join("");
  }

  async function openProductDialog(idOrProduct, opts = {}) {
    const dlg = $("#productDialog");
    if (!dlg) return;
    let product = null;
    if (idOrProduct != null && typeof idOrProduct === "object") product = idOrProduct;
    else if (idOrProduct != null) {
      await flushEdits(idOrProduct);
      product = db.productById(idOrProduct);
    }
    const isNew = !product;
    productCtx = { id: product ? product.id : null, draft: U.uid() };

    $("#productKicker").textContent = isNew ? "New product" : "Edit product";
    $("#productDialogTitle").textContent = isNew ? "Add a product to the shop" : product.name;
    $("#pfName").value = product ? product.name : "";
    $("#pfCategory").innerHTML = categoryOptions(product ? product.categoryId : opts.categoryId || (db.state.categories[0] || {}).id);
    $("#pfPrice").value = product ? product.price : "";
    $("#pfTag").value = product ? product.tag || "" : "";
    $("#pfDesc").value = product ? product.desc || "" : "";
    $("#pfSort").value = product ? product.sortOrder : db.nextSortOrder(db.state.products);
    $("#pfDelete").hidden = isNew;
    setStatus(dlg, isNew ? "Upload the photo, then Save — it appears on the page instantly" : "Edits save the moment you leave a field");

    productCtx.imageField = mountImageField($("#pfImage"), {
      value: product ? product.image : "",
      label: "Product photo",
      onChange: (url) => applyProductPatch({ image: url }, { quiet: true, what: "photo" }),
    });

    ["#pfName", "#pfCategory", "#pfPrice", "#pfTag", "#pfDesc", "#pfSort"].forEach((sel) => {
      const el = $(sel);
      if (el) el.onchange = () => saveFromDialog(dlg, { quiet: true });
    });
    $("#pfSave").onclick = () => saveFromDialog(dlg, { close: true });
    $("#pfSaveNew").onclick = async () => {
      const ok = await saveFromDialog(dlg, { keepOpen: true });
      if (!ok) return;
      productCtx = { id: null, draft: U.uid(), imageField: productCtx.imageField };
      $("#pfDelete").hidden = true;
      $("#pfName").value = "";
      $("#pfPrice").value = "";
      $("#pfTag").value = "";
      $("#pfDesc").value = "";
      $("#pfSort").value = db.nextSortOrder(db.state.products);
      if (productCtx.imageField) productCtx.imageField.set("", { apply: false });
      $("#productKicker").textContent = "New product";
      $("#productDialogTitle").textContent = "Add another product";
      $("#pfName").focus();
      setStatus(dlg, "Saved ✓ — enter the next product", "ok");
    };
    $("#pfDelete").onclick = () => {
      // the row may have been created *inside* this dialog, so trust productCtx
      const id = product && product.id != null ? product.id : productCtx && productCtx.id;
      if (id == null) return;
      deleteProduct(id).then(() => unmount(dlg));
    };
    $$("[data-tag-preset]", dlg).forEach((chip) =>
      chip.addEventListener("click", () => {
        const input = $("#pfTag");
        input.value = chip.dataset.tagPreset === "none" ? "" : chip.dataset.tagPreset;
        saveFromDialog(dlg, { quiet: true });
      })
    );

    mount(dlg);
    setTimeout(() => $("#pfName") && !isNew && $("#pfName").focus(), 60);
  }

  async function saveFromDialog(dlg, opts = {}) {
    if (!productCtx) return false;
    const patch = readProductPatch();
    if (patch === null) return false;
    const ok = await applyProductPatch(patch, opts);
    if (ok && opts.close) unmount(dlg);
    return ok;
  }

  function readProductPatch() {
    const name = $("#pfName").value.trim();
    if (!name) {
      $("#pfName").focus();
      U.toast("A product needs a name", "error", 2600);
      return null;
    }
    return {
      name,
      categoryId: $("#pfCategory").value,
      price: U.parsePrice($("#pfPrice").value),
      tag: $("#pfTag").value.trim(),
      desc: $("#pfDesc").value.trim(),
      sortOrder: U.parsePrice($("#pfSort").value) || 0,
    };
  }

  async function applyProductPatch(patch, opts = {}) {
    if (!productCtx) return false;
    const dlg = $("#productDialog");
    try {
      const wasNew = productCtx.id == null;
      const queueKey = "product:" + (productCtx.id != null ? key(productCtx.id) : "draft-" + productCtx.draft);
      const saved = await queued(queueKey, () => run(() => db.upsertProduct(Object.assign({ id: productCtx.id }, patch)), productCtx.id));
      productCtx.id = saved.id;
      if (wasNew) {
        // it exists now — offer the rest of the row actions without closing the dialog
        $("#pfDelete").hidden = false;
        $("#productKicker").textContent = "Edit product";
        $("#productDialogTitle").textContent = saved.name;
      }
      setStatus(dlg, opts.what === "photo" ? "Photo saved ✓" : opts.quiet ? "Saved ✓" : "Saved to Supabase ✓", "ok");
      render();
      return true;
    } catch (err) {
      setStatus(dlg, err.message, "bad");
      return false;
    }
  }

  function refreshOpenForms() {
    const dlg = $("#productDialog");
    if (dlg && dlg.open && productCtx) {
      const sel = $("#pfCategory");
      sel.innerHTML = categoryOptions(sel.value);
    }
    const catDlg = $("#categoryDialog");
    if (catDlg && catDlg.open && categoryCtx && categoryCtx.id) {
      const kids = db.productsOf(categoryCtx.id).length;
      const note = $("#cfProductCount");
      if (note) note.textContent = kids ? `${kids} product${kids === 1 ? "" : "s"} currently in this category` : "No products in here yet";
    }
  }

  /* ============================================================
     category dialog
     ============================================================ */
  function openCategoryDialog(idOrCategory) {
    const dlg = $("#categoryDialog");
    if (!dlg) return;
    const category =
      idOrCategory != null && typeof idOrCategory === "object" ? idOrCategory : idOrCategory != null ? db.categoryById(idOrCategory) : null;
    const isNew = !category;
    categoryCtx = { id: category ? category.id : null, banner: "", draft: U.uid() };
    slugTouched = !isNew;

    $("#categoryKicker").textContent = isNew ? "New category" : "Edit category";
    $("#categoryDialogTitle").textContent = isNew ? "Add a category" : category.name;
    $("#cfName").value = category ? category.name : "";
    $("#cfSlug").value = category ? category.slug : "";
    $("#cfEmoji").value = category ? category.emoji || "" : "";
    $("#cfSort").value = category ? category.sortOrder : db.nextSortOrder(db.state.categories);

    const kids = category ? db.productsOf(category.id).length : 0;
    $("#cfProducts").hidden = isNew;
    $("#cfProductCount").textContent = kids
      ? `${kids} product${kids === 1 ? "" : "s"} in this category right now`
      : "No products in here yet — add one from the page and it appears instantly";
    $("#cfDelete").hidden = isNew;
    $("#cfMoveAllWrap").hidden = isNew || !kids;
    const mover = $("#cfMoveAll");
    if (mover) {
      mover.innerHTML =
        `<option value="">Move all ${kids} to…</option>` +
        db.state.categories
          .filter((c) => String(c.id) !== String(category && category.id))
          .map((c) => `<option value="${U.escapeHtml(c.id)}">${U.escapeHtml((c.emoji ? c.emoji + " " : "") + c.name)}</option>`)
          .join("");
      mover.onchange = async () => {
        if (!mover.value) return;
        const to = db.categoryById(mover.value);
        try {
          const n = await run(() => db.moveAllProducts(category.id, mover.value));
          U.toast(`${n} product${n === 1 ? "" : "s"} moved to ${to.name}`, "ok");
        } catch (err) {
          U.toast(err.message, "error", 5200);
        }
        mover.value = "";
        render();
      };
    }

    mountImageField($("#cfImage"), {
      value: category ? category.banner || "" : "",
      label: "Category banner (optional)",
      optional: true,
      note: "Sits above the category's products on the page. Leave empty for a clean text header.",
      onChange: (url) => applyCategoryPatch({ banner: url }, { quiet: true }),
    });

    $("#cfName").oninput = () => {
      if (!slugTouched) $("#cfSlug").value = U.slugify($("#cfName").value);
    };
    $("#cfSlug").oninput = () => (slugTouched = true);
    ["#cfName", "#cfSlug", "#cfEmoji", "#cfSort"].forEach((sel) => {
      const el = $(sel);
      if (el) el.onchange = () => saveCategoryFromDialog(dlg, { quiet: true });
    });
    $("#cfSave").onclick = () => saveCategoryFromDialog(dlg, { close: true });
    $("#cfDelete").onclick = () => {
      const id = category && category.id != null ? category.id : categoryCtx && categoryCtx.id;
      if (id == null) return;
      deleteCategory(id).then(() => unmount(dlg));
    };
    $$("[data-emoji-preset]", dlg).forEach((chip) =>
      chip.addEventListener("click", () => {
        $("#cfEmoji").value = chip.dataset.emojiPreset;
        saveCategoryFromDialog(dlg, { quiet: true });
      })
    );

    mount(dlg);
    setTimeout(() => $("#cfName") && $("#cfName").focus(), 60);
  }

  async function saveCategoryFromDialog(dlg, opts = {}) {
    if (!categoryCtx) return false;
    const name = $("#cfName").value.trim();
    if (!name) {
      $("#cfName").focus();
      U.toast("A category needs a name", "error", 2600);
      return false;
    }
    const patch = {
      name,
      slug: U.slugify($("#cfSlug").value || name),
      emoji: $("#cfEmoji").value.trim(),
      sortOrder: U.parsePrice($("#cfSort").value) || 0,
    };
    if (!categoryCtx.id && categoryCtx.banner) patch.banner = categoryCtx.banner;
    try {
      const saved = await queued("category:" + (categoryCtx.id != null ? key(categoryCtx.id) : "draft-" + categoryCtx.draft), () =>
        run(() => db.upsertCategory(Object.assign({ id: categoryCtx.id }, patch)))
      );
      categoryCtx.id = saved.id;
      setStatus(dlg, "Saved to Supabase ✓", "ok");
      render();
      if (!opts.quiet) U.toast(opts.close ? "Category saved" : "Category updated", "ok", 2000);
      if (opts.close) unmount(dlg);
      return true;
    } catch (err) {
      setStatus(dlg, err.message, "bad");
      return false;
    }
  }

  function applyCategoryPatch(patch, opts = {}) {
    if (!categoryCtx) return false;
    if (!categoryCtx.id) {
      // new category — remember the banner and save it together with the first Save
      if (patch.banner != null) categoryCtx.banner = patch.banner;
      U.toast("Banner ready — press Save to create the category", "info", 2600);
      return false;
    }
    return run(() => db.upsertCategory(Object.assign({ id: categoryCtx.id }, patch)))
      .then(() => {
        render();
        if (!opts.quiet) U.toast("Banner saved ✓", "ok", 1800);
        return true;
      })
      .catch(() => false);
  }

  async function deleteCategory(id) {
    const cat = db.categoryById(id);
    if (!cat) return;
    const kids = db.productsOf(id).length;
    const others = db.state.categories.filter((c) => String(c.id) !== String(cat.id));
    const options = kids
      ? [{ value: "__delete", label: `Delete all ${kids} product${kids === 1 ? "" : "s"} as well` }].concat(
          others.map((c) => ({ value: c.id, label: `Move them to ${(c.emoji ? c.emoji + " " : "") + c.name}` }))
        )
      : [];
    const answer = await askConfirm({
      title: `Delete “${cat.name}”?`,
      text: kids
        ? `This category holds ${kids} product${kids === 1 ? "" : "s"}. Choose what happens to them — nothing is removed unless you confirm.`
        : "This category is empty, so nothing else is affected.",
      ok: "Delete category",
      select: options.length ? { label: "Its products", options, required: true } : null,
      checkbox: kids ? { label: "Also delete uploaded photos from Supabase Storage", checked: false } : null,
    });
    if (!answer) return;
    try {
      await run(async () => {
        await db.removeCategory(id, {
          moveTo: !options.length ? null : answer.value === "__delete" ? "delete" : answer.value,
          deleteImages: !!answer.checked,
        });
        U.toast(`Category “${cat.name}” deleted`, "ok");
      });
      render();
    } catch (err) {
      U.toast(err.message, "error", 6000);
    }
  }

  /* ============================================================
     product delete / duplicate
     ============================================================ */
  async function deleteProduct(id) {
    await flushEdits(id);
    const product = db.productById(id);
    if (!product) return;
    const stored = db.isStoredHere(product.image);
    const answer = await askConfirm({
      title: `Delete “${product.name}”?`,
      text: stored
        ? "It disappears from the shop instantly. Tick the box to delete the uploaded file from Supabase Storage as well."
        : product.image
          ? "It disappears from the shop instantly. The photo itself is left where its URL points (images/ or an external host)."
          : "This product has no photo, so nothing else is affected.",
      ok: "Delete product",
      checkbox: stored ? { label: "Also delete the uploaded image file", checked: true } : null,
    });
    if (!answer) return;
    try {
      await run(() => db.removeProduct(id, { deleteImages: !!answer.checked }));
      unmount($("#productDialog"));
      unmount($("#imageDialog"));
      U.toast(`“${product.name}” deleted${answer.checked && stored ? " — photo removed from storage" : ""}`, "ok", 3400);
      render();
    } catch (err) {
      U.toast(err.message, "error", 6000);
    }
  }

  async function duplicateProduct(id) {
    await flushEdits(id);
    const product = db.productById(id);
    if (!product) return;
    try {
      const copy = await run(() =>
        db.upsertProduct({
          name: product.name + " (copy)",
          categoryId: product.categoryId,
          price: product.price,
          image: product.image,
          tag: product.tag,
          desc: product.desc,
          sortOrder: product.sortOrder,
        })
      );
      U.toast("Duplicated — tweak the copy to make it different", "ok", 2600);
      render();
      openProductDialog(copy.id);
    } catch (err) {
      U.toast(err.message, "error", 5200);
    }
  }

  /* ============================================================
     image field — upload · paste URL · pick from library · remove
     ============================================================ */
  function mountImageField(host, opts = {}) {
    if (!host) return null;
    const local = { value: opts.value || "" };
    host.className = "imgfield";
    host.innerHTML = `
      <div class="imgfield__head">
        <span class="imgfield__label">${U.escapeHtml(opts.label || "Image")}</span>
        <button type="button" class="linkbtn" data-img="library">Choose from library</button>
      </div>
      <div class="imgfield__body">
        <div class="imgfield__preview" data-img="preview"></div>
        <div class="imgfield__tools">
          <label class="dropzone" data-img="drop">
            <input type="file" accept="${IMG_ACCEPT}" multiple hidden data-img="file" />
            <span class="dropzone__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 7.9 7.6l1.4 1.4L11 7.3V15h2V7.3l1.7 1.7 1.4-1.4L12 3.5Z"/><path d="M5 17h14v2H5v-2Z"/></svg></span>
            <span class="dropzone__main">Drop images here, or <u>choose a file</u> — you can also paste (⌘/Ctrl+V)</span>
            <span class="dropzone__sub">JPG · PNG · WebP · GIF — auto-resized to 1400px and saved into Supabase Storage</span>
          </label>
          <div class="imgfield__url">
            <label class="field field--tight"><span>…or point to an image URL</span>
              <input type="text" data-img="url" placeholder="https://… or images/product.jpg" value="${U.escapeHtml(local.value)}" />
            </label>
            <button type="button" class="btn btn-xs btn-primary" data-img="use-url">Use URL</button>
            <button type="button" class="btn btn-xs btn-danger-ghost" data-img="remove"${local.value ? "" : " disabled"}>Remove image</button>
          </div>
          <p class="imgfield__status" data-img="msg" hidden></p>
          <div class="library" data-img="library" hidden></div>
        </div>
      </div>
      ${opts.note ? `<p class="imgfield__note">${U.escapeHtml(opts.note)}</p>` : ""}
    `;

    const preview = host.querySelector('[data-img="preview"]');
    const msg = host.querySelector('[data-img="msg"]');
    const urlInput = host.querySelector('[data-img="url"]');
    const fileInput = host.querySelector('[data-img="file"]');
    const drop = host.querySelector('[data-img="drop"]');
    const lib = host.querySelector('[data-img="library"]');
    const removeBtn = host.querySelector('[data-img="remove"]');

    const say = (text, kind = "") => {
      if (!msg) return;
      msg.hidden = !text;
      msg.textContent = text || "";
      msg.className = "imgfield__status " + kind;
    };

    function paint() {
      const url = db.resolveImage(local.value);
      removeBtn.disabled = !local.value;
      if (url) {
        preview.innerHTML = `<img src="${U.escapeHtml(url)}" alt="" data-img="img" />
          <div class="imgfield__actions">
            <button type="button" class="pcbtn" data-img="zoom" title="Open full size"><svg viewBox="0 0 24 24"><path d="M4 4h7v2H6v5H4V4Zm16 16h-7v-2h5v-5h2v7Z"/></svg></button>
            <button type="button" class="pcbtn" data-img="copy" title="Copy the image URL"><svg viewBox="0 0 24 24"><path d="M8 3h9a2 2 0 0 1 2 2v11h-2V5H8V3Zm-2 4h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v10h9V9H6Z"/></svg></button>
            <button type="button" class="pcbtn pcbtn--danger" data-img="remove" title="Remove this image"><svg viewBox="0 0 24 24"><path d="M7 21a2 2 0 0 1-2-2V6H5V4h4V3h6v1h4v2h-.5l.5 13a2 2 0 0 1-2 2H7Zm2-4h1.5V8H9v9Zm4 0h1.5V8H13v9Z"/></svg></button>
          </div>
          <p class="imgfield__path" title="${U.escapeHtml(local.value)}">${U.escapeHtml(shortPath(local.value))}</p>`;
        const img = preview.querySelector('[data-img="img"]');
        img.addEventListener("error", () => {
          preview.classList.add("is-broken");
          say("That URL could not be loaded — check the link or upload a file instead.", "bad");
        });
      } else {
        preview.innerHTML = `<div class="imgfield__none"><svg viewBox="0 0 24 24"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 11.5 4-4.5 3 3.4 4-4.9 3 3.8V7H5v9.5Z"/></svg><span>No image${opts.optional ? " (optional)" : ""}</span></div>`;
      }
      preview.classList.remove("is-broken");
      if (urlInput.value !== local.value) urlInput.value = local.value;
    }

    function shortPath(url) {
      const value = String(url || "");
      if (db.isStoredHere(value)) return "Supabase · " + (db.pathOfStored(value) || "");
      return value.length > 46 ? "…" + value.slice(-44) : value;
    }

    async function set(url, { apply = true } = {}) {
      local.value = url || "";
      paint();
      if (apply && typeof opts.onChange === "function") await opts.onChange(local.value);
    }

    async function handleFiles(files) {
      const list = Array.from(files || []).filter((f) => /^image\//.test(f.type || ""));
      if (!list.length) {
        say("Those files were not images.", "bad");
        return;
      }
      drop.classList.add("is-busy");
      say(`Uploading ${list.length} image${list.length > 1 ? "s" : ""} to Supabase Storage…`);
      let first = null;
      let failed = null;
      for (const file of list) {
        try {
          const out = await db.uploadImage(file);
          if (!first) first = out;
          mediaCache = null;
        } catch (err) {
          failed = err;
        }
      }
      drop.classList.remove("is-busy");
      if (first) {
        say(`Uploaded ${(first.bytes / 1024).toFixed(0)} KB · now shown on the page ✓`, "ok");
        await set(first.url);
        U.toast("Photo uploaded and saved on the product", "ok", 2600);
      }
      if (failed) {
        say(failed.message, "bad");
        U.toast(failed.message, "error", 6000);
      }
      if (list.length > 1) render();
      if (lib && !lib.hidden) renderLibrary(lib, { onSelect: pickInto(local) });
    }

    host.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-img]");
      if (!btn || !host.contains(btn)) return;
      const act = btn.dataset.img;
      if (act === "use-url") {
        const value = (urlInput.value || "").trim();
        await set(value);
        say(value ? "Image URL saved ✓" : "Image cleared ✓", "ok");
        render();
      } else if (act === "remove") {
        await removeImage();
      } else if (act === "library") {
        if (!lib.hidden) {
          lib.hidden = true;
          return;
        }
        lib.hidden = false;
        await renderLibrary(lib, { onSelect: pickInto(local) });
      } else if (act === "copy") {
        copyText(local.value);
      } else if (act === "zoom") {
        global.open(db.resolveImage(local.value), "_blank", "noopener");
      }
    });

    async function removeImage() {
      const stored = db.isStoredHere(local.value);
      const users = stored ? db.imagesInUse(local.value) : [];
      const answer = await askConfirm({
        title: "Remove this image?",
        text: stored
          ? `The photo lives in your Supabase Storage bucket${users.length > 1 ? ` and is also used by ${users.length - 1} other item${users.length === 2 ? "" : "s"}` : ""}. Deleting the file frees the space; unticking only unlinks it from here.`
          : "The link is taken off this item. Files hosted elsewhere (images/ or another site) are not touched.",
        ok: stored ? "Remove image" : "Unlink image",
        checkbox: stored ? { label: "Also delete the file from Supabase Storage", checked: users.length <= 1 } : null,
      });
      if (!answer) return;
      try {
        if (stored && answer.checked) await db.deleteStoredImages([local.value], { force: true });
        await set("");
        mediaCache = null;
        say(stored && answer.checked ? "File deleted from storage and unlinked ✓" : "Image unlinked ✓", "ok");
        U.toast(stored && answer.checked ? "Image deleted from Supabase Storage" : "Image removed from this item", "ok", 3000);
        render();
      } catch (err) {
        say(err.message, "bad");
        U.toast(err.message, "error", 6000);
      }
    }

    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        set((urlInput.value || "").trim()).then(() => render());
      }
    });
    urlInput.addEventListener("change", () => set((urlInput.value || "").trim()).then(() => render()));
    fileInput.addEventListener("change", () => handleFiles(fileInput.files));
    ["dragenter", "dragover"].forEach((type) =>
      drop.addEventListener(type, (e) => {
        e.preventDefault();
        drop.classList.add("is-drag");
      })
    );
    ["dragleave", "dragend"].forEach((type) =>
      drop.addEventListener(type, () => drop.classList.remove("is-drag"))
    );
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("is-drag");
      handleFiles(e.dataTransfer.files);
    });

    // ⌘/Ctrl+V an image from the clipboard while this dialog is open
    if (host._pasteHandler) document.removeEventListener("paste", host._pasteHandler);
    host._pasteHandler = (e) => {
      const ownerDialog = host.closest("dialog");
      if (!host.isConnected || !ownerDialog || !ownerDialog.open) return;
      const items = (e.clipboardData && e.clipboardData.items) || [];
      const item = Array.from(items).find((i) => i.type && i.type.indexOf("image/") === 0);
      if (!item) return;
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        handleFiles([file]);
      }
    };
    document.addEventListener("paste", host._pasteHandler);

    function pickInto(ref) {
      return async (item) => {
        ref.value = item.url;
        paint();
        lib.hidden = true;
        await opts.onChange && opts.onChange(item.url);
        U.toast("Photo set ✓", "ok", 1800);
        render();
      };
    }

    paint();
    return {
      get value() {
        return local.value;
      },
      set,
      refresh: paint,
    };
  }

  /* ---------- shared library browser ---------- */
  async function renderLibrary(host, { onSelect }) {
    host.innerHTML = `<div class="library__bar"><span class="library__spin">Loading your uploads…</span></div>`;
    let items = [];
    try {
      if (!mediaCache) mediaCache = await db.listImages("products");
      items = mediaCache;
    } catch (err) {
      host.innerHTML = `<div class="library__bar library__bar--bad">${U.escapeHtml(err.message)}</div>`;
      return;
    }
    if (!items.length) {
      host.innerHTML = `<div class="library__bar">Nothing in the <code>${U.escapeHtml(
        db.BUCKET
      )}</code> bucket yet — drop a file above and it shows up here.</div>`;
      return;
    }
    host.innerHTML = `<div class="library__bar"><span>${items.length} uploaded image${items.length === 1 ? "" : "s"}</span><button type="button" class="linkbtn" data-lib="refresh">Refresh</button></div><div class="library__grid"></div>`;
    host.querySelector('[data-lib="refresh"]').onclick = () => {
      mediaCache = null;
      renderLibrary(host, { onSelect });
    };
    const grid = host.querySelector(".library__grid");
    items.forEach((item) => {
      const used = db.imagesInUse(item.url);
      const cell = document.createElement("div");
      cell.className = "lib-cell";
      cell.innerHTML = `
        <img src="${U.escapeHtml(item.url)}" alt="" loading="lazy" />
        <div class="lib-cell__meta"><span title="${U.escapeHtml(item.name)}">${U.escapeHtml(item.name)}</span><small>${U.bytes(item.size)}${used.length ? ` · in use by ${used.length}` : " · unused"}</small></div>
        <div class="lib-cell__acts">
          <button type="button" class="btn btn-xs btn-primary" data-lib="use">Use</button>
          <button type="button" class="btn btn-xs btn-ghost" data-lib="copy">Copy URL</button>
          <button type="button" class="btn btn-xs btn-danger-ghost" data-lib="del">Delete</button>
        </div>`;
      cell.querySelector('[data-lib="use"]').onclick = () => onSelect(item);
      cell.querySelector('[data-lib="copy"]').onclick = () => copyText(item.url);
      cell.querySelector('[data-lib="del"]').onclick = async () => {
        if (used.length) {
          U.toast(`Still used by ${used.map((u) => u.name).join(", ")} — remove it there first`, "error", 5200);
          return;
        }
        const answer = await askConfirm({
          title: "Delete this uploaded file?",
          text: `“${item.name}” will be permanently removed from the ${db.BUCKET} bucket (${U.bytes(item.size)}). Nothing else uses it.`,
          ok: "Delete file",
        });
        if (!answer) return;
        try {
          await db.deleteStoredImages([item.url], { force: true });
          mediaCache = (mediaCache || []).filter((x) => x !== item);
          U.toast("File deleted from storage", "ok");
          renderLibrary(host, { onSelect });
          render();
        } catch (err) {
          U.toast(err.message, "error", 6000);
        }
      };
      grid.appendChild(cell);
    });
  }

  function copyText(text) {
    const value = String(text || "");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(
        () => U.toast("Image URL copied", "ok", 1800),
        () => global.prompt("Copy this URL:", value)
      );
    } else global.prompt("Copy this URL:", value);
  }

  /* ============================================================
     standalone photo dialog (card's 🖼 button)
     ============================================================ */
  async function openImageDialogFor(idOrProduct) {
    let product = idOrProduct != null && typeof idOrProduct === "object" ? idOrProduct : null;
    if (!product && idOrProduct != null) {
      await flushEdits(idOrProduct);
      product = db.productById(idOrProduct);
    }
    if (!product) return;
    const dlg = $("#imageDialog");
    productCtx = { id: product.id };
    $("#imageDialogTitle").textContent = "Photo for " + product.name;
    const field = mountImageField($("#ifImage"), {
      value: product.image,
      label: "Product photo",
      onChange: (url) =>
        queued("product:" + key(product.id), () => run(() => db.setProductImage(product.id, url), product.id)).then(() => {
          U.toast("Photo updated on the page ✓", "ok", 2200);
          render();
        }),
    });
    productCtx.imageField = field;
    mount(dlg);
  }

  /* ============================================================
     media library (admin bar button)
     ============================================================ */
  function openMediaDialog() {
    const dlg = $("#mediaDialog");
    if (!dlg) return;
    mount(dlg);
    const host = $("#mediaGridHost");
    const fileInput = $("#mediaUploadInput");
    $("#mediaUploadBtn").onclick = () => fileInput && fileInput.click();
    if (fileInput)
      fileInput.onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        let ok = 0;
        for (const file of files) {
          try {
            await db.uploadImage(file);
            ok += 1;
          } catch (err) {
            U.toast(err.message, "error", 6000);
          }
        }
        if (ok) {
          mediaCache = null;
          U.toast(`${ok} photo${ok === 1 ? "" : "s"} uploaded to Supabase Storage`, "ok", 3000);
          render();
        }
        fileInput.value = "";
        renderLibrary(host, { onSelect: (item) => U.toast(`Copy its URL and paste it on a product, or use “🖼” on the card`, "info", 3200) });
      };
    renderLibrary(host, {
      onSelect: (item) => U.toast("Open a product's 🖼 button to set that photo on it", "info", 3200),
    });
  }

  /* ============================================================
     hero slides (homepage slideshow) — same studio, same feel
     ============================================================ */
  function wireHero() {
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-hero-act]");
      if (!btn || !editOn()) return;
      const act = btn.dataset.heroAct;
      const id = btn.dataset.id;
      if (act === "edit") openHeroDialog(id);
      else if (act === "add") openHeroDialog(null);
      else if (act === "import") importStaticSlides();
      else if (act === "sql") copyHeroSql();
      else if (act === "del") {
        const slide = db.state.heroSlides.find((s) => String(s.id) === String(id));
        const answer = await askConfirm({
          title: "Remove this hero photo?",
          text: `“${(slide && slide.title) || "This slide"}” disappears from the homepage slideshow right away.`,
          ok: "Remove slide",
          checkbox: slide && db.isStoredHere(slide.image) ? { label: "Also delete the uploaded file", checked: false } : null,
        });
        if (!answer) return;
        try {
          if (answer.checked && slide) await db.deleteStoredImages([slide.image], { force: true });
          await db.removeHeroSlide(id);
          renderHero();
          U.toast("Hero photo removed", "ok");
        } catch (err) {
          U.toast(err.message, "error", 6000);
        }
      }
    });
    renderHeroBar($("#heroAdminBar"));
  }

  function renderHeroBar(bar) {
    if (!bar) return;
    const canEdit = editOn();
    bar.hidden = !canEdit;
    if (!canEdit) return;
    const caps = db.state.capabilities.hero;
    if (db.state.mode === "live" && (caps === "missing" || caps === "error")) {
      bar.innerHTML = `<span class="herobar__note">The homepage photos come from a <code>hero_slides</code> table, so you can change them without touching code.</span>
        <button class="btn btn-xs btn-primary" data-hero-act="sql">Copy the SQL that creates it</button>
        <span class="herobar__hint">paste it into Supabase → SQL Editor, run once</span>`;
      return;
    }
    const n = db.state.heroSlides.length;
    bar.innerHTML = `<span class="herobar__note"><b>${n}</b> photo${n === 1 ? "" : "s"} in the homepage slideshow — use ✏️ on a photo to swap its picture or caption</span>
      <button class="btn btn-xs btn-primary" data-hero-act="add">Add a hero photo</button>
      ${caps === "empty" ? '<button class="btn btn-xs btn-outline" data-hero-act="import">Import the 5 photos now on the page</button>' : ""}`;
  }

  function copyHeroSql() {
    copyText(
      "create table if not exists public.hero_slides (\n" +
        "  id uuid primary key default gen_random_uuid(),\n" +
        "  image_url text not null default '',\n" +
        "  title text not null default '',\n" +
        "  subtitle text not null default '',\n" +
        "  caption text not null default '',\n" +
        "  sort_order integer not null default 0,\n" +
        "  is_active boolean not null default true,\n" +
        "  created_at timestamptz not null default now(),\n" +
        "  updated_at timestamptz not null default now()\n" +
        ");\n" +
        "alter table public.hero_slides enable row level security;\n" +
        "create policy \"Public can read hero slides\" on public.hero_slides for select using (true);\n" +
        "create policy \"Admins manage hero slides\" on public.hero_slides for all to authenticated\n" +
        "  using (public.is_admin()) with check (public.is_admin());"
    );
  }

  async function importStaticSlides() {
    const figures = $$("#heroTrack .hero-slide");
    try {
      for (const [i, fig] of figures.entries()) {
        const img = fig.querySelector("img");
        const strong = fig.querySelector("figcaption strong");
        const span = fig.querySelector("figcaption span");
        await db.upsertHeroSlide({
          image: img ? img.getAttribute("src") : "",
          title: strong ? strong.textContent.trim() : "",
          subtitle: span ? span.textContent.trim() : "",
          sortOrder: i + 1,
          active: true,
        });
      }
      U.toast("Hero photos are now editable right on the page", "ok", 3600);
      await db.reload();
      renderHero();
      renderHeroBar($("#heroAdminBar"));
    } catch (err) {
      U.toast(err.message, "error", 6000);
    }
  }

  function openHeroDialog(id) {
    const dlg = $("#heroDialog");
    if (!dlg) return;
    const slide = id ? db.state.heroSlides.find((s) => String(s.id) === String(id)) : null;
    heroCtx = { id: slide ? slide.id : null, draft: U.uid() };
    $("#heroKicker").textContent = slide ? "Edit hero photo" : "New hero photo";
    $("#heroDialogTitle").textContent = slide ? slide.title || "Untitled photo" : "Add a homepage photo";
    $("#hfTitle").value = slide ? slide.title : "";
    $("#hfSubtitle").value = slide ? slide.subtitle : "";
    $("#hfSort").value = slide ? slide.sortOrder : db.nextSortOrder(db.state.heroSlides);
    $("#hfActive").checked = slide ? slide.active !== false : true;
    $("#hfDelete").hidden = !slide;
    setStatus(dlg, "The slider picks up changes instantly");
    mountImageField($("#hfImage"), {
      value: slide ? slide.image : "",
      label: "Photo",
      onChange: (url) => saveHero({ image: url }, { quiet: true }),
    });
    ["#hfTitle", "#hfSubtitle", "#hfSort", "#hfActive"].forEach((sel) => {
      const el = $(sel);
      if (el) el.onchange = () => saveHero(readHero(), { quiet: true });
    });
    $("#hfSave").onclick = () => saveHero(readHero()).then((ok) => ok && unmount(dlg));
    $("#hfDelete").onclick = async () => {
      if (!slide) return;
      const answer = await askConfirm({ title: "Remove this hero photo?", text: "It disappears from the homepage instantly.", ok: "Remove slide" });
      if (!answer) return;
      try {
        if (db.isStoredHere(slide.image)) await db.deleteStoredImages([slide.image], { force: true });
        await db.removeHeroSlide(slide.id);
        unmount(dlg);
        renderHero();
        U.toast("Hero photo removed", "ok");
      } catch (err) {
        U.toast(err.message, "error", 6000);
      }
    };
    mount(dlg);
  }

  function readHero() {
    return {
      title: $("#hfTitle").value.trim(),
      subtitle: $("#hfSubtitle").value.trim(),
      sortOrder: U.parsePrice($("#hfSort").value) || 0,
      active: $("#hfActive").checked,
    };
  }

  async function saveHero(patch, opts = {}) {
    if (!heroCtx) return false;
    const dlg = $("#heroDialog");
    try {
      await queued("hero:" + (heroCtx.id != null ? key(heroCtx.id) : "draft-" + heroCtx.draft), () =>
        run(() => db.upsertHeroSlide(Object.assign({ id: heroCtx.id }, patch)))
      );
      setStatus(dlg, "Saved to Supabase ✓", "ok");
      renderHero();
      if (!opts.quiet) U.toast("Hero slide saved", "ok", 1800);
      return true;
    } catch (err) {
      setStatus(dlg, err.message, "bad");
      U.toast(err.message, "error", 6000);
      return false;
    }
  }

  /* ============================================================
     confirm dialog (replaces native window.confirm)
     ============================================================ */
  function askConfirm({ title, text, ok = "Confirm", select, checkbox }) {
    const dlg = $("#confirmDialog");
    if (!dlg) {
      const passed = global.confirm(`${title}\n${text || ""}`);
      return Promise.resolve(passed ? { confirmed: true, value: "", checked: false } : null);
    }
    $("#confirmTitle").textContent = title || "Are you sure?";
    $("#confirmText").textContent = text || "";
    const go = $("#confirmGo");
    go.textContent = ok;
    go.classList.toggle("btn-danger", true);

    const selWrap = $("#confirmSelectWrap");
    const sel = $("#confirmSelect");
    if (select && select.options && select.options.length) {
      selWrap.hidden = false;
      $("#confirmSelectLabel").textContent = select.label || "Choose";
      sel.innerHTML =
        (select.required ? '<option value="">Pick one…</option>' : "") +
        select.options
          .map((o) => `<option value="${U.escapeHtml(o.value)}">${U.escapeHtml(o.label)}</option>`)
          .join("");
      if (!select.required) sel.value = select.options[0].value;
    } else {
      selWrap.hidden = true;
      sel.innerHTML = "";
      sel.value = "";
    }

    const chkWrap = $("#confirmCheckWrap");
    const chk = $("#confirmCheck");
    if (checkbox) {
      chkWrap.hidden = false;
      $("#confirmCheckLabel").textContent = checkbox.label;
      chk.checked = !!checkbox.checked;
    } else {
      chkWrap.hidden = true;
      chk.checked = false;
    }

    return new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        go.onclick = null;
        dlg.removeEventListener("close", onCancel);
        if (value) U.closeDialog(dlg);
        resolve(value);
      };
      const onCancel = () => settle(null);
      dlg.addEventListener("close", onCancel);
      go.onclick = () => {
        if (select && select.required && !sel.value) {
          U.toast("Choose what should happen to those products first", "error", 3400);
          sel.focus();
          return;
        }
        dlg.removeEventListener("close", onCancel);
        const out = { confirmed: true, value: sel.value, checked: chk.checked };
        U.closeDialog(dlg);
        settle(out);
      };
      mount(dlg);
      setTimeout(() => go.focus(), 50);
    });
  }

  /* ============================================================
     setup / status dialog — so "does it really save?" is answerable
     ============================================================ */
  function openSetupDialog() {
    const dlg = $("#setupDialog");
    if (!dlg) return;
    const caps = db.state.capabilities;
    const row = (label, status, note) => {
      const cls =
        status === "ok" ? "ok" : status === "empty" || status === "preview" || status === "warn" ? "warn" : status === "off" ? "warn" : "bad";
      const text =
        { ok: "Working", preview: "Local only", empty: "Ready (empty)", warn: "Not connected", missing: "Missing", blocked: "Blocked by policy", offline: "Unreachable", off: "Idle" }[status] || "Idle";
      return `<div class="setup-row setup-row--${cls}">
          <span class="setup-row__dot"></span>
          <div class="setup-row__body"><strong>${U.escapeHtml(label)}</strong><p>${U.escapeHtml(note || "")}</p></div>
          <span class="setup-row__state">${text}</span>
        </div>`;
    };
    $("#setupRows").innerHTML = [
      row(
        "Catalogue tables · products + categories",
        caps.catalogue,
        caps.catalogue === "ok"
          ? "Read and written through PostgREST with row level security (admins only for writes)."
          : caps.catalogueMessage || "Create them with supabase-schema.sql in the SQL editor."
      ),
      row(
        `Image uploads · storage bucket "${db.BUCKET}"`,
        caps.storage,
        caps.storageMessage ||
          (caps.storage === "ok"
            ? "Admins upload, list and delete; photos are served on public URLs."
            : "Uploads need the bucket plus the storage policies in supabase-schema.sql.")
      ),
      row(
        "Homepage slideshow · hero_slides",
        caps.hero,
        caps.heroMessage || (caps.hero === "ok" || caps.hero === "empty" ? "Editable from the hero on the page." : "Optional — create the table to change hero photos without code.")
      ),
      row("Realtime sync", db.state.realtimeStatus === "SUBSCRIBED" ? "ok" : db.state.mode === "live" ? "warn" : "off", "Visitors see edits without refreshing once this is connected."),
      row("Admin sign-in", caps.auth === "preview" ? "preview" : db.state.isAdmin ? "ok" : "off", db.state.isAdmin ? `Signed in as ${((db.state.user || {}).email || "admin")}` : "Sign in with a Supabase auth user listed in public.admin_users."),
    ].join("");

    const mode = $("#setupMode");
    mode.textContent =
      db.state.mode === "live"
        ? `Live · Supabase project “${projectRef()}”`
        : "Preview mode · changes are stored in this browser only";
    mode.className = "setup__mode " + (db.state.mode === "live" ? "is-live" : "is-preview");

    $("#setupSqlBtn").onclick = () =>
      copyText(
        "Run supabase-schema.sql in the Supabase SQL editor. It creates the tables, the product-images bucket, the admin-only RLS policies and the hero_slides table — existing rows are kept."
      );
    $("#setupStorageBtn").onclick = () =>
      copyText(storageSql());
    const recheck = $("#setupRecheck");
    recheck.onclick = async () => {
      recheck.classList.add("is-busy");
      try {
        await db.probeStorage();
        await db.reload();
        openSetupDialog();
        U.toast("Checked again", "ok", 1600);
      } catch (err) {
        U.toast(err.message, "error", 5000);
      } finally {
        recheck.classList.remove("is-busy");
      }
    };
    $$("[data-recheck]", dlg).forEach((b) => (b.onclick = recheck.onclick));
    mount(dlg);
  }

  function storageSql() {
    return `-- Meso Households: photo uploads (run once in the Supabase SQL editor)
insert into storage.buckets (id, name, public)
values ('${db.BUCKET}', '${db.BUCKET}', true)
on conflict (id) do update set public = true;

drop policy if exists "meso admins manage product images" on storage.objects;
create policy "meso admins manage product images" on storage.objects
  for all to authenticated
  using (bucket_id = '${db.BUCKET}' and public.is_admin())
  with check (bucket_id = '${db.BUCKET}' and public.is_admin());`;
  }

  function projectRef() {
    try {
      return new URL(global.SUPABASE_URL).host.split(".")[0];
    } catch (err) {
      return "—";
    }
  }

  global.MesoAdmin = {
    attach,
    openLogin,
    openProductDialog,
    openCategoryDialog,
    openImageDialogFor,
    openMediaDialog,
    openHeroDialog,
    openSetupDialog,
    deleteProduct,
    deleteCategory,
    run,
    flag,
    askConfirm,
    get pendingEdits() {
      return pendingEdits;
    },
  };
})(window);
