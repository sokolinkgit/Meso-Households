/* ============================================================
   MESO HOUSEHOLDS — data layer (window.MesoDB)

   Everything the site reads or writes goes through here:
     • Supabase Postgres (categories / products / hero_slides)
     • Supabase Storage  (product-images bucket: upload / list / delete)
     • Supabase Auth     (admin session + admin_users whitelist)
     • Realtime          (visitors see edits without refreshing)

   When Supabase is not configured or unreachable the exact same API
   is served from localStorage ("preview mode") so the site — and the
   whole admin studio — still works when you open index.html locally.
   ============================================================ */
(function (global) {
  'use strict';

  const U = global.MesoUtil;
  const BUCKET = global.SUPABASE_BUCKET || "product-images";
  const LS_CATALOGUE = "mesoCatalogue.v1";
  const LS_DEMO_ADMIN = "mesoPreviewAdmin";
  const MAX_UPLOAD_EDGE = 1400;

  const URL_BASE = global.SUPABASE_URL || "";
  const ANON_KEY = global.SUPABASE_ANON_KEY || "";
  const canReachSupabase = !!(global.supabase && URL_BASE && ANON_KEY);

  let sb = null;
  if (canReachSupabase) {
    try {
      const timedFetch = (input, init) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        return global.fetch(input, Object.assign({}, init, { signal: ctrl.signal })).finally(() => clearTimeout(timer));
      };
      sb = global.supabase.createClient(URL_BASE, ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        global: { fetch: timedFetch },
      });
    } catch (err) {
      console.warn("[meso] Supabase client failed to start — using preview mode.", err);
      sb = null;
    }
  }

  /* ============================================================
     state
     ============================================================ */
  const state = {
    ready: false,
    mode: sb ? "live" : "preview", // 'live' = Supabase, 'preview' = localStorage
    offline: false, // Supabase configured but not reachable
    error: null,
    isAdmin: false,
    user: null,
    categories: [],
    products: [],
    heroSlides: [],
    capabilities: { catalogue: "off", storage: "off", hero: "off", auth: sb ? "off" : "preview" },
  };

  const listeners = new Set();
  function emit(reason) {
    listeners.forEach((fn) => {
      try {
        fn(state, reason);
      } catch (err) {
        console.error(err);
      }
    });
  }
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /* Local writes we made ourselves — realtime echoes of those are ignored. */
  const ownWrites = new Map();
  function markOwn(table, id) {
    if (id == null) return;
    const now = Date.now();
    ownWrites.set(table + ":" + id, now);
    if (ownWrites.size > 80) {
      for (const [key, at] of ownWrites) if (now - at > 6000) ownWrites.delete(key);
    }
  }
  function isOwnWrite(table, id) {
    const at = ownWrites.get(table + ":" + id);
    return !!at && Date.now() - at < 1500;
  }

  /* ============================================================
     normalisers
     ============================================================ */
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

  function mapCategory(row) {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      emoji: row.emoji || "",
      banner: row.banner_url || "",
      sortOrder: num(row.sort_order),
    };
  }

  function mapProduct(row) {
    return {
      id: row.id,
      name: row.name,
      categoryId: row.category_id,
      price: num(row.price),
      image: row.image_url || "",
      tag: row.tag || "",
      desc: row.description || "",
      sortOrder: num(row.sort_order),
      // kept for resilient rendering if the category row ever goes missing
      categorySlug: (row.categories && row.categories.slug) || "",
    };
  }

  function mapHero(row) {
    return {
      id: row.id,
      image: row.image_url || "",
      title: row.title || "",
      subtitle: row.subtitle || "",
      caption: row.caption || "",
      sortOrder: num(row.sort_order),
      active: row.is_active !== false,
    };
  }

  /* localStorage keeps rows in the app's own shape; accept either shape so a
     reload of preview data never loses a product's category or a photo. */
  function localCategory(r) {
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      emoji: r.emoji || "",
      banner: r.banner != null ? r.banner : r.banner_url || "",
      sortOrder: num(r.sortOrder != null ? r.sortOrder : r.sort_order),
    };
  }
  function localProduct(r) {
    return {
      id: r.id,
      name: r.name,
      categoryId: r.categoryId != null ? r.categoryId : r.category_id,
      price: num(r.price),
      image: (r.image != null ? r.image : r.image_url) || "",
      tag: r.tag || "",
      desc: r.desc != null ? r.desc : r.description || "",
      sortOrder: num(r.sortOrder != null ? r.sortOrder : r.sort_order),
      categorySlug: r.categorySlug || (r.categories && r.categories.slug) || "",
    };
  }
  function localHero(r) {
    return {
      id: r.id,
      image: (r.image != null ? r.image : r.image_url) || "",
      title: r.title || "",
      subtitle: r.subtitle || "",
      caption: r.caption || "",
      sortOrder: num(r.sortOrder != null ? r.sortOrder : r.sort_order),
      active: (r.active != null ? r.active : r.is_active) !== false,
    };
  }

  function sortCategories(list) {
    return list.slice().sort((a, b) => a.sortOrder - b.sortOrder || String(a.name).localeCompare(String(b.name)));
  }
  function sortProducts(list) {
    return list.slice().sort((a, b) => a.sortOrder - b.sortOrder || String(a.name).localeCompare(String(b.name)));
  }
  function sortHero(list) {
    return list.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /* ============================================================
     reads
     ============================================================ */
  function categoryById(id) {
    if (id == null) return null;
    return state.categories.find((c) => String(c.id) === String(id)) || null;
  }
  function categoryBySlug(slug) {
    return state.categories.find((c) => c.slug === slug) || null;
  }
  function productById(id) {
    return state.products.find((p) => String(p.id) === String(id)) || null;
  }
  function categoryLabelOf(product) {
    const cat = categoryById(product.categoryId);
    if (cat) return cat.name;
    const bySlug = categoryBySlug(product.categorySlug);
    return bySlug ? bySlug.name : "Uncategorised";
  }
  function productsOf(categoryId) {
    return state.products.filter((p) => String(p.categoryId) === String(categoryId));
  }
  function nextSortOrder(list) {
    return list.reduce((max, item) => Math.max(max, num(item.sortOrder)), 0) + 1;
  }

  /* ============================================================
     preview-mode storage (localStorage)
     ============================================================ */
  function seedCatalogue() {
    const cats = [
      { name: "Kitchen Appliances", slug: "appliances", emoji: "🍳", sortOrder: 1 },
      { name: "Flasks & Thermos", slug: "flasks", emoji: "🧴", sortOrder: 2 },
      { name: "Dining", slug: "dining", emoji: "🍽️", sortOrder: 3 },
      { name: "Cookware", slug: "cookware", emoji: "🥘", sortOrder: 4 },
    ].map((c) => Object.assign({ id: c.slug }, c));

    const P = (name, slug, price, image, tag, desc, sortOrder) => ({
      id: U.uid(),
      name,
      categoryId: slug,
      price,
      image,
      tag: tag || "",
      desc,
      sortOrder,
      categorySlug: slug,
    });
    const products = [
      P("Stainless Steel Vacuum Flask", "flasks", 1500, "images/flask.jpg", "Best Seller", "1.5L food-grade flask that keeps drinks hot or cold for 12+ hours.", 1),
      P("Electric Kettle", "appliances", 2200, "images/kettle.jpg", "Hot", "Fast-boiling 1.7L stainless steel kettle with auto shut-off safety.", 2),
      P("Heavy-Duty Blender", "appliances", 4500, "images/blender.jpg", "", "Powerful glass-jug blender for smoothies, juices and soft foods.", 3),
      P("Premium Vacuum Thermos", "flasks", 1800, "images/thermos.jpg", "", "Sleek matte thermos with cup lid — perfect for office, travel and home.", 4),
      P("Ceramic Dinner Plates (Set of 6)", "dining", 2500, "images/plates.jpg", "", "Elegant white ceramic plates — durable, chip-resistant, easy to clean.", 5),
      P("Stainless Water Bottles", "flasks", 850, "images/bottles.jpg", "", "Leak-proof reusable bottles in assorted colours. Great for kids & gym.", 6),
      P("Cooking Pots Set (3 pcs)", "cookware", 5500, "images/pots.jpg", "Best Seller", "Gleaming stainless steel sufuria set with glass lids — a kitchen must-have.", 7),
      P("Cutlery Set (24 pcs)", "dining", 1200, "images/cutlery.jpg", "", "Complete fork, knife and spoon set for 6 — polished stainless steel.", 8),
      P("Ceramic Mugs (Set of 4)", "dining", 1000, "images/mugs.jpg", "", "Stylish warm-coloured mugs for tea, coffee and cocoa moments.", 9),
    ];
    const hero = [
      { title: "Vacuum Flask", subtitle: "KES 1,500 • Another happy customer", image: "images/slide-1.jpg" },
      { title: "Heavy-Duty Blender", subtitle: "KES 4,500 • Another happy customer", image: "images/slide-2.jpg" },
      { title: "Plates & Mugs", subtitle: "KES 1,000+ • Another happy customer", image: "images/slide-3.jpg" },
      { title: "Cooking Pots Set", subtitle: "KES 5,500 • Another happy customer", image: "images/slide-4.jpg" },
      { title: "Electric Kettle", subtitle: "KES 2,200 • Another happy customer", image: "images/slide-5.jpg" },
    ].map((h, i) => Object.assign({ id: U.uid(), caption: "", sortOrder: i + 1, active: true }, h));
    return { categories: cats, products, heroSlides: hero };
  }

  function readLocal() {
    try {
      const raw = global.localStorage.getItem(LS_CATALOGUE);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.products)) return null;
      return parsed;
    } catch (err) {
      console.warn("[meso] could not read local catalogue", err);
      return null;
    }
  }
  function writeLocal() {
    if (state.mode !== "preview") return;
    try {
      global.localStorage.setItem(
        LS_CATALOGUE,
        JSON.stringify({ categories: state.categories, products: state.products, heroSlides: state.heroSlides })
      );
    } catch (err) {
      // Most likely the quota filled up with data-URL images — keep going in memory.
      console.warn("[meso] local save skipped", err);
      U.toast("Browser storage is full — this change lives in memory only until you refresh.", "error", 5000);
    }
  }

  /* ============================================================
     error translation — admins should never see raw Postgres noise
     ============================================================ */
  function readableError(err) {
    if (!err) return "Something went wrong.";
    const code = err.code || (err.error && err.error.code) || "";
    const raw = err.message || err.text || String(err);
    const table = {
      "23505": "That value is already taken — try a different slug or name.",
      "23503": "Still in use by something else, so it could not be deleted.",
      "23514": "One of the values did not pass validation (check price/slug).",
      "23502": "A required field is empty.",
      "42501": "Permission denied by Supabase (RLS). Sign in with an admin account and make sure the schema SQL has been run.",
      "42P01": "The table is missing — run supabase-schema.sql in the Supabase SQL editor.",
      "PGRST205": "That table is not available yet — run supabase-schema.sql in the Supabase SQL editor.",
    };
    if (table[code]) return table[code];
    if (/Bucket not found/i.test(raw)) return `The storage bucket "${BUCKET}" does not exist yet — run the storage section of supabase-schema.sql.`;
    if (/row-level security|row level security|not allowed to (insert|update|delete|select)/i.test(raw))
      return "Supabase blocked that write (row level security). Sign in with an admin account, and re-run supabase-schema.sql if the problem stays.";
    if (/already exists/i.test(raw) && /policy|bucket|duplicate/i.test(raw))
      return "That entry already exists — the change was applied once already.";
    if (/The resource never exists|not_found/i.test(raw)) return "Supabase could not find that record — it may have been deleted; refresh the page.";
    if (/banner_url/i.test(raw) && /column|does not exist/i.test(raw)) return "Category banners need the banner_url column — run supabase-schema.sql in the SQL editor once to add it.";
    if (/hero_slides/i.test(raw) && /does not exist|relation/i.test(raw)) return "The hero_slides table is missing — run supabase-schema.sql to enable hero editing.";
    if (/relation .* does not exist/i.test(raw)) return "A table is missing — run supabase-schema.sql in the Supabase SQL editor.";
    if (/failed to fetch|NetworkError|aborted|Timeout/i.test(raw)) return "Could not reach Supabase — check your connection.";
    return raw;
  }
  function isNetworkFailure(err) {
    const raw = (err && (err.message || err.text)) || String(err || "");
    return /failed to fetch|networkerror|aborted|ERR_NETWORK|Could not reach/i.test(raw);
  }

  /* ============================================================
     load
     ============================================================ */
  async function load() {
    if (!sb) {
      adoptPreview("Supabase is not configured for this site");
      state.ready = true;
      emit("load");
      return state;
    }
    try {
      const [cats, prods, hero] = await Promise.all([
        sb.from("categories").select("*").order("sort_order", { ascending: true }).order("name"),
        sb.from("products").select("*, categories(slug, name)").order("sort_order", { ascending: true }).order("name"),
        sb.from("hero_slides").select("*").order("sort_order", { ascending: true }),
      ]);

      if (cats.error && isNetworkFailure(cats.error)) {
        adoptPreview("Supabase could not be reached from this browser.");
        state.capabilities = { catalogue: "offline", storage: "off", hero: "offline", auth: "offline" };
        state.ready = true;
        emit("load");
        return state;
      }
      if (cats.error || (prods.error && !isMissingTableError(prods.error))) {
        if (isMissingTableError(cats.error)) {
          adoptPreview("The categories/products tables are not in Supabase yet — run supabase-schema.sql.");
          state.capabilities = { catalogue: "missing", storage: "off", hero: "missing", auth: "off" };
          state.ready = true;
          emit("load");
          return state;
        }
        throw new Error(readableError(cats.error || prods.error));
      }

      state.categories = sortCategories((cats.data || []).map(mapCategory));
      state.products = sortProducts((prods.data || []).map(mapProduct));
      state.capabilities.catalogue = "ok";
      if (prods.error) state.capabilities.catalogueMessage = readableError(prods.error);

      if (hero.error && isMissingTableError(hero.error)) {
        state.capabilities.hero = "missing";
        state.heroSlides = [];
      } else if (hero.error) {
        state.capabilities.hero = "error";
        state.capabilities.heroMessage = readableError(hero.error);
        state.heroSlides = [];
      } else {
        state.heroSlides = sortHero((hero.data || []).map(mapHero));
        state.capabilities.hero = (hero.data || []).length ? "ok" : "empty";
      }

      await probeStorage();
      startRealtime();
    } catch (err) {
      if (isNetworkFailure(err)) {
        adoptPreview("Supabase could not be reached from this browser.");
        state.capabilities = { catalogue: "offline", storage: "off", hero: "offline", auth: "offline" };
      } else {
        state.error = err.message || String(err);
        console.error("[meso] catalogue load failed:", err);
      }
    }
    state.ready = true;
    emit("load");
    return state;
  }

  function isMissingTableError(error) {
    if (!error) return false;
    const message = String(error.message || error.code || "");
    return error.code === "42P01" || /relation .* does not exist|does not exist/i.test(message);
  }

  function adoptPreview(reason) {
    state.mode = "preview";
    state.offline = !!sb;
    state.error = reason;
    const local = readLocal() || seedCatalogue();
    const seeded = local.categories.length ? local : seedCatalogue();
    state.categories = sortCategories(seeded.categories.map(localCategory));
    state.products = sortProducts((seeded.products || []).map(localProduct));
    state.heroSlides = sortHero((seeded.heroSlides && seeded.heroSlides.length ? seeded.heroSlides : seedCatalogue().heroSlides).map(localHero));
    state.capabilities = Object.assign({}, state.capabilities, {
      catalogue: "ok",
      storage: "preview",
      hero: "ok",
      auth: "preview",
    });
    global.localStorage.setItem(LS_CATALOGUE, JSON.stringify({ categories: state.categories, products: state.products, heroSlides: state.heroSlides }));
    console.info("[meso] preview mode:", reason);
  }

  async function reload() {
    state.ready = false;
    await load();
    return state;
  }

  /* ============================================================
     categories — CRUD
     ============================================================ */
  function uniqueSlug(slug, ignoreId) {
    let candidate = slug;
    let n = 2;
    const taken = (value) =>
      state.categories.some((c) => c.slug === value && String(c.id) !== String(ignoreId));
    while (taken(candidate)) candidate = `${slug}-${n++}`;
    return candidate;
  }

  /** upsertCategory({ id?, name, slug?, emoji?, banner?, sortOrder? }) */
  async function upsertCategory(input) {
    const patch = {};
    if (input.name != null) patch.name = String(input.name).trim();
    if (input.slug != null) patch.slug = uniqueSlug(U.slugify(input.slug || input.name), input.id);
    if (input.emoji != null) patch.emoji = String(input.emoji).trim();
    if (input.banner != null) patch.banner_url = String(input.banner).trim();
    if (input.sortOrder != null) patch.sort_order = num(input.sortOrder);
    if (patch.name && !patch.slug) patch.slug = uniqueSlug(U.slugify(patch.name), input.id);

    if (state.mode !== "live") {
      const row = saveCategoryLocal(input.id, patch);
      emit("category");
      return row;
    }
    if (!patch.name || !patch.slug) throw new Error("A category needs a name.");

    const res = input.id
      ? await sb.from("categories").update(patch).eq("id", input.id).select().maybeSingle()
      : await sb.from("categories").insert(Object.assign({ sort_order: nextSortOrder(state.categories) }, patch)).select().single();
    if (res.error) throw new Error(readableError(res.error));
    markOwn("categories", res.data.id);
    const mapped = mapCategory(res.data);
    mergeCategory(mapped);
    writeLocal();
    emit("category");
    return mapped;
  }

  function saveCategoryLocal(id, patch) {
    let saved = null;
    if (id != null) {
      const idx = state.categories.findIndex((c) => String(c.id) === String(id));
      if (idx < 0) throw new Error("Category not found.");
      const current = state.categories[idx];
      saved = Object.assign({}, current, {
        name: patch.name != null ? patch.name : current.name,
        slug: patch.slug || current.slug,
        emoji: patch.emoji != null ? patch.emoji : current.emoji,
        banner: patch.banner_url != null ? patch.banner_url : current.banner,
        sortOrder: patch.sort_order != null ? patch.sort_order : current.sortOrder,
      });
      state.categories[idx] = saved;
    } else {
      saved = {
        id: U.uid(),
        name: patch.name,
        slug: patch.slug,
        emoji: patch.emoji || "",
        banner: patch.banner_url || "",
        sortOrder: patch.sort_order != null ? patch.sort_order : nextSortOrder(state.categories),
      };
      state.categories.push(saved);
    }
    state.categories = sortCategories(state.categories);
    writeLocal();
    return saved;
  }

  function mergeCategory(mapped) {
    const idx = state.categories.findIndex((c) => String(c.id) === String(mapped.id));
    if (idx >= 0) state.categories[idx] = Object.assign({}, state.categories[idx], mapped);
    else state.categories.push(mapped);
    state.categories = sortCategories(state.categories);
  }

  async function removeCategory(id, options = {}) {
    const moveMode = options.moveTo === "delete" ? "delete" : options.moveTo ? "move" : "block";
    const kids = productsOf(id);
    if (kids.length && moveMode === "block") {
      const err = new Error(`This category still holds ${kids.length} product${kids.length > 1 ? "s" : ""}. Choose where they should go.`);
      err.code = "HAS_PRODUCTS";
      throw err;
    }
    if (kids.length) {
      if (moveMode === "delete") {
        if (options.deleteImages) await deleteStoredImages(kids.map((p) => p.image), { force: true });
        if (state.mode === "live") {
          const res = await sb.from("products").delete().in("id", kids.map((p) => p.id));
          if (res.error) throw new Error(readableError(res.error));
          kids.forEach((p) => markOwn("products", p.id));
        }
        kids.forEach((p) => dropProductLocally(p.id));
      } else {
        if (state.mode === "live") {
          const res = await sb.from("products").update({ category_id: options.moveTo }).eq("category_id", id);
          if (res.error) throw new Error(readableError(res.error));
          kids.forEach((p) => markOwn("products", p.id));
        }
        state.products = state.products.map((p) =>
          String(p.categoryId) === String(id) ? Object.assign({}, p, { categoryId: options.moveTo }) : p
        );
      }
    }
    if (state.mode === "live") {
      const res = await sb.from("categories").delete().eq("id", id);
      if (res.error) throw new Error(readableError(res.error));
      markOwn("categories", id);
    }
    state.categories = state.categories.filter((c) => String(c.id) !== String(id));
    writeLocal();
    emit("category");
    return true;
  }

  /** Move whole categories around with the ↑↓ controls. */
  async function reorderCategories(orderedIds) {
    const before = state.categories.slice();
    const byId = new Map(before.map((c) => [String(c.id), c]));
    const patched = orderedIds.map((id, i) => Object.assign({}, byId.get(String(id)), { sortOrder: i + 1 })).filter(Boolean);
    state.categories = sortCategories(patched);
    emit("category-reorder");
    if (state.mode !== "live") {
      writeLocal();
      return true;
    }
    try {
      await Promise.all(
        patched.map((c) => {
          markOwn("categories", c.id);
          return sb.from("categories").update({ sort_order: c.sortOrder }).eq("id", c.id);
        })
      );
      writeLocal();
    } catch (err) {
      state.categories = before;
      emit("category-reorder");
      throw new Error(readableError(err));
    }
    return true;
  }

  async function moveAllProducts(fromId, toId) {
    const kids = productsOf(fromId);
    if (!kids.length) return 0;
    kids.forEach((p) => markOwn("products", p.id));
    state.products = state.products.map((p) =>
      String(p.categoryId) === String(fromId) ? Object.assign({}, p, { categoryId: toId }) : p
    );
    emit("product");
    if (state.mode !== "live") {
      writeLocal();
      return kids.length;
    }
    const res = await sb.from("products").update({ category_id: toId }).eq("category_id", fromId);
    if (res.error) {
      await load();
      emit("product");
      throw new Error(readableError(res.error));
    }
    writeLocal();
    return kids.length;
  }

  /* ============================================================
     products — CRUD
     ============================================================ */
  function toProductRow(input, { full = false } = {}) {
    const row = {};
    if (input.name != null) row.name = String(input.name).trim();
    if (input.categoryId != null) row.category_id = input.categoryId;
    if (input.price != null) row.price = U.parsePrice(input.price);
    if (input.image != null) row.image_url = String(input.image).trim();
    if (input.tag != null) row.tag = String(input.tag).trim() || null;
    if (input.desc != null) row.description = String(input.desc).trim();
    if (input.sortOrder != null) row.sort_order = num(input.sortOrder);
    if (full) {
      if (row.name == null) throw new Error("A product needs a name.");
      if (row.category_id == null) throw new Error("Pick a category for this product.");
      if (row.price == null) row.price = 0;
      if (row.image_url == null) row.image_url = "";
      if (row.description == null) row.description = "";
      if (row.sort_order == null) row.sort_order = nextSortOrder(state.products);
    }
    return row;
  }

  /** upsertProduct({ id?, name, categoryId, price, image, tag, desc, sortOrder }) */
  async function upsertProduct(input) {
    const updating = input.id != null && input.id !== "";
    const existing = updating ? productById(input.id) : null;
    if (updating && !existing) throw new Error("That product could not be found any more — refresh and try again.");
    const row = toProductRow(Object.assign({}, existing || {}, input), { full: !updating });

    if (state.mode !== "live") {
      const saved = saveProductLocal(updating ? input.id : null, row);
      emit("product");
      return saved;
    }

    const res = updating
      ? await sb.from("products").update(row).eq("id", input.id).select("*, categories(slug, name)").maybeSingle()
      : await sb.from("products").insert(row).select("*, categories(slug, name)").single();
    if (res.error) throw new Error(readableError(res.error));
    if (updating && !res.data) throw new Error("That product was deleted by someone else.");
    const mapped = mapProduct(res.data);
    markOwn("products", mapped.id);
    mergeProduct(mapped);
    writeLocal();
    emit("product");
    return mapped;
  }

  function mergeProduct(mapped) {
    const idx = state.products.findIndex((p) => String(p.id) === String(mapped.id));
    if (idx >= 0) state.products[idx] = Object.assign({}, state.products[idx], mapped);
    else state.products.push(mapped);
    state.products = sortProducts(state.products);
  }
  function dropProductLocally(id) {
    state.products = state.products.filter((p) => String(p.id) !== String(id));
  }

  function saveProductLocal(id, row) {
    const shape = {
      id: id != null ? id : U.uid(),
      name: row.name,
      categoryId: row.category_id,
      price: row.price,
      image: row.image_url,
      tag: row.tag || "",
      desc: row.description,
      sortOrder: row.sort_order,
      categorySlug: (categoryById(row.category_id) || {}).slug || "",
    };
    if (id != null) {
      const idx = state.products.findIndex((p) => String(p.id) === String(id));
      if (idx < 0) throw new Error("Product not found.");
      state.products[idx] = Object.assign({}, state.products[idx], shape);
    } else {
      state.products.push(shape);
    }
    state.products = sortProducts(state.products);
    writeLocal();
    return shape;
  }

  async function removeProduct(id, options = {}) {
    const product = productById(id);
    if (!product) throw new Error("That product is already gone.");
    if (state.mode === "live") {
      if (options.deleteImages) await deleteStoredImages([product.image], { force: true });
      const res = await sb.from("products").delete().eq("id", id);
      if (res.error) throw new Error(readableError(res.error));
      markOwn("products", id);
    }
    dropProductLocally(id);
    writeLocal();
    emit("product");
    return true;
  }

  /** Swap a product's image immediately (used by upload / pick / remove). */
  async function setProductImage(id, url) {
    return upsertProduct({ id, image: url || "" });
  }

  /* ============================================================
     hero slides — CRUD (optional table, degrades quietly)
     ============================================================ */
  async function upsertHeroSlide(input) {
    const row = {
      image_url: String(input.image == null ? "" : input.image).trim(),
      title: String(input.title || "").trim(),
      subtitle: String(input.subtitle || "").trim(),
      caption: String(input.caption || "").trim(),
      is_active: input.active !== false,
      sort_order: num(input.sortOrder, nextSortOrder(state.heroSlides)),
    };
    if (state.mode !== "live") {
      const id = input.id != null ? input.id : U.uid();
      const idx = state.heroSlides.findIndex((h) => String(h.id) === String(id));
      const shape = { id, image: row.image_url, title: row.title, subtitle: row.subtitle, caption: row.caption, sortOrder: row.sort_order, active: row.is_active };
      if (idx >= 0) state.heroSlides[idx] = shape;
      else state.heroSlides.push(shape);
      state.heroSlides = sortHero(state.heroSlides);
      writeLocal();
      emit("hero");
      return shape;
    }
    if (state.capabilities.hero === "missing") throw new Error("The hero_slides table is not in Supabase yet — run supabase-schema.sql to enable hero editing.");
    const res = input.id
      ? await sb.from("hero_slides").update(row).eq("id", input.id).select().maybeSingle()
      : await sb.from("hero_slides").insert(row).select().single();
    if (res.error) throw new Error(readableError(res.error));
    const mapped = mapHero(res.data);
    markOwn("hero_slides", mapped.id);
    const idx = state.heroSlides.findIndex((h) => String(h.id) === String(mapped.id));
    if (idx >= 0) state.heroSlides[idx] = mapped;
    else state.heroSlides.push(mapped);
    state.heroSlides = sortHero(state.heroSlides);
    if (state.capabilities.hero !== "ok") state.capabilities.hero = "ok";
    writeLocal();
    emit("hero");
    return mapped;
  }

  async function removeHeroSlide(id) {
    if (state.mode === "live") {
      const res = await sb.from("hero_slides").delete().eq("id", id);
      if (res.error) throw new Error(readableError(res.error));
      markOwn("hero_slides", id);
    }
    state.heroSlides = state.heroSlides.filter((h) => String(h.id) !== String(id));
    writeLocal();
    emit("hero");
    return true;
  }

  /* ============================================================
     images — Supabase Storage
     ============================================================ */
  const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
  const signedUrlCache = new Map();

  /** Relative repo paths and http(s) URLs pass through untouched. */
  function resolveImage(url) {
    if (!url) return "";
    const value = String(url).trim();
    if (/^(https?:|data:|blob:|\/\/)/i.test(value)) return value;
    return value.replace(/^\.?\//, "");
  }
  function isStoredHere(url) {
    return !!url && url.indexOf(`/object/public/${BUCKET}/`) >= 0;
  }
  function pathOfStored(url) {
    if (!isStoredHere(url)) return null;
    const marker = `/object/public/${BUCKET}/`;
    const cut = url.indexOf(marker) + marker.length;
    return decodeURIComponent(url.slice(cut).split("?")[0].split("#")[0]);
  }

  async function probeStorage() {
    if (state.mode !== "live") {
      state.capabilities.storage = "preview";
      return state.capabilities.storage;
    }
    try {
      const res = await sb.storage.from(BUCKET).list("", { limit: 1 });
      if (res.error) {
        state.capabilities.storage = /not found|Bucket/i.test(res.error.message || "") ? "missing" : "blocked";
        state.capabilities.storageMessage = readableError(res.error);
      } else {
        state.capabilities.storage = "ok";
      }
    } catch (err) {
      state.capabilities.storage = "offline";
      state.capabilities.storageMessage = readableError(err);
    }
    return state.capabilities.storage;
  }

  /** Downscale + recompress in the browser so uploads stay light. */
  async function optimiseImage(file, { maxEdge = MAX_UPLOAD_EDGE, quality = 0.86, type = "image/webp" } = {}) {
    if (!file) throw new Error("No file selected.");
    if (!/^image\//.test(file.type || "")) throw new Error("Please choose an image file (JPG, PNG, WebP, GIF…).");
    // never rasterise animations or vectors — re-encoding would flatten them
    if (/gif|svg/i.test(file.type || "")) return { blob: file, width: 0, height: 0 };
    if (!global.createImageBitmap || !global.OffscreenCanvas) return { blob: file, width: 0, height: 0 };
    try {
      const bitmap = await global.createImageBitmap(file);
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = new global.OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close && bitmap.close();
      const blob = await canvas.convertToBlob({ type, quality });
      // Never let a re-encode make a tiny file huge.
      if (blob.size >= file.size * 0.98) return { blob: file, width: bitmap.width, height: bitmap.height };
      return { blob, width, height };
    } catch (err) {
      console.warn("[meso] image optimisation skipped", err);
      return { blob: file, width: 0, height: 0 };
    }
  }

  /** uploadImage(file) → { url, path, bytes } */
  async function uploadImage(file, opts = {}) {
    const { blob } = await optimiseImage(file, opts);
    const stamp = new Date().toISOString().slice(0, 10);
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : blob.type === "image/gif" ? "gif" : "jpg";
    const path = `products/${stamp}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

    if (state.mode !== "live") {
      const url = await dataUrl(blob);
      return { url, path: "preview:" + path, bytes: blob.size, preview: true };
    }
    const res = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
    if (res.error) throw new Error(readableError(res.error));
    const url = `${URL_BASE}${PUBLIC_MARKER}${encodeURI(res.data.path)}`;
    state.capabilities.storage = "ok";
    return { url, path: res.data.path, bytes: blob.size };
  }

  function dataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new global.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read that image."));
      reader.readAsDataURL(blob);
    });
  }

  /** listImages() → [{ url, path, name, size, modified }] */
  async function listImages(prefix = "products") {
    if (state.mode !== "live") {
      // collect preview data-URLs already referenced by products/hero slides
      const seen = new Map();
      state.products.forEach((p) => {
        if (/^data:/i.test(p.image)) seen.set(p.image, { name: p.name + " (upload)", size: Math.round(p.image.length * 0.75), modified: "" });
      });
      return Array.from(seen, ([url, meta]) => ({ url, path: url, name: meta.name, size: meta.size, modified: meta.modified }));
    }
    const out = [];
    const walk = async (folder, depth) => {
      const res = await sb.storage.from(BUCKET).list(folder, { limit: 200, sortBy: { field: "created_at", order: "desc" }, offset: out.length });
      if (res.error) throw new Error(readableError(res.error));
      for (const item of res.data || []) {
        const rel = (folder ? folder + "/" : "") + item.name;
        const isFolder = !item.metadata && !/\.[a-z0-9]{2,5}$/i.test(item.name);
        if (isFolder && depth < 2) {
          await walk(rel, depth + 1);
        } else {
          out.push({
            url: `${URL_BASE}${PUBLIC_MARKER}${encodeURI(rel)}`,
            path: rel,
            name: item.name,
            size: (item.metadata && item.metadata.size) || 0,
            modified: item.updated_at || item.created_at || "",
          });
        }
      }
    };
    await walk(prefix, 0);
    return out;
  }

  /** Which products / hero slides still point at a given image. */
  function imagesInUse(url) {
    const path = pathForCompare(url);
    if (!path) return [];
    const rows = state.products
      .map((p) => ({ kind: "product", name: p.name, id: p.id, image: p.image }))
      .concat(state.heroSlides.map((h, i) => ({ kind: "hero slide", name: h.title || "photo " + (i + 1), id: h.id, image: h.image })));
    return rows.filter((row) => pathForCompare(row.image) === path);
  }

  function pathForCompare(url) {
    if (!url) return "";
    return isStoredHere(url) ? pathOfStored(url) || "" : String(url).trim();
  }

  async function deleteStoredImages(urls, options = {}) {
    const targets = (Array.isArray(urls) ? urls : [urls]).filter((u) => isStoredHere(u));
    if (!targets.length || state.mode !== "live") return 0;
    const paths = targets.map((u) => pathOfStored(u)).filter(Boolean);
    // never delete a file another row is still showing, unless explicitly forced
    const usedPaths = new Set();
    if (!options.force) {
      state.products
        .concat(state.heroSlides)
        .forEach((row) => {
          if (row.image && isStoredHere(row.image)) {
            const used = pathOfStored(row.image);
            if (used) usedPaths.add(used);
          }
        });
    }
    const safe = paths.filter((p) => !usedPaths.has(p));
    if (!safe.length) return 0;
    const res = await sb.storage.from(BUCKET).remove(safe);
    if (res.error) throw new Error(readableError(res.error));
    return safe.length;
  }

  /* ============================================================
     auth
     ============================================================ */
  async function refreshAdmin() {
    if (state.mode !== "live") {
      state.isAdmin = global.localStorage.getItem(LS_DEMO_ADMIN) === "1";
      state.user = state.isAdmin ? { email: global.localStorage.getItem(LS_DEMO_ADMIN + ".email") || "preview-admin@local" } : null;
      emit("auth");
      return state.isAdmin;
    }
    try {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session) {
        state.isAdmin = false;
        state.user = null;
        emit("auth");
        return false;
      }
      state.user = { email: session.user.email };
      const { data, error } = await sb.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (error) {
        state.adminError = readableError(error);
        state.isAdmin = false;
      } else {
        state.adminError = null;
        state.isAdmin = !!data;
      }
      startRealtime();
      emit("auth");
      return state.isAdmin;
    } catch (err) {
      state.error = readableError(err);
      emit("auth");
      return false;
    }
  }

  async function signIn(email, password) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (state.mode !== "live") {
      if (!cleanEmail || !password) throw new Error("Enter an email and a password.");
      global.localStorage.setItem(LS_DEMO_ADMIN, "1");
      global.localStorage.setItem(LS_DEMO_ADMIN + ".email", cleanEmail);
      await refreshAdmin();
      return { demo: true };
    }
    const res = await sb.auth.signInWithPassword({ email: cleanEmail, password });
    if (res.error) throw new Error(readableError(res.error));
    await refreshAdmin();
    if (!state.isAdmin) {
      const err = new Error("Signed in, but this account is not on the admin list yet. Add its user id to public.admin_users.");
      err.code = "NOT_ADMIN";
      throw err;
    }
    return res.data;
  }

  async function signOut() {
    if (state.mode === "live") {
      try {
        await sb.auth.signOut();
      } catch (err) {
        console.warn(err);
      }
    }
    global.localStorage.removeItem(LS_DEMO_ADMIN);
    global.localStorage.removeItem(LS_DEMO_ADMIN + ".email");
    state.isAdmin = false;
    state.user = null;
    emit("auth");
    return true;
  }

  function onAuthChange(cb) {
    if (state.mode !== "live" || !sb) return () => {};
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(() => {
      refreshAdmin();
      if (typeof cb === "function") cb();
    });
    return () => subscription && subscription.unsubscribe && subscription.unsubscribe();
  }

  /* ============================================================
     realtime — visitors and other admins get edits instantly
     ============================================================ */
  let channel = null;
  function startRealtime() {
    if (state.mode !== "live" || !sb || channel) return;
    try {
      channel = sb
        .channel("meso-households-catalogue")
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (payload) => handleRemote("products", payload))
        .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, (payload) => handleRemote("categories", payload))
        .on("postgres_changes", { event: "*", schema: "public", table: "hero_slides" }, (payload) => handleRemote("hero_slides", payload))
        .subscribe((status) => {
          state.realtimeStatus = status;
          emit("realtime");
        });
    } catch (err) {
      console.warn("[meso] realtime unavailable", err);
    }
  }

  function handleRemote(table, payload) {
    const row = payload.new || payload.old || {};
    if (isOwnWrite(table, row.id)) return;
    if (payload.eventType === "DELETE") {
      if (table === "products") dropProductLocally(row.id);
      if (table === "categories") state.categories = state.categories.filter((c) => String(c.id) !== String(row.id));
      if (table === "hero_slides") state.heroSlides = state.heroSlides.filter((h) => String(h.id) !== String(row.id));
    } else if (table === "products") {
      mergeProduct(mapProduct(row));
    } else if (table === "categories") {
      mergeCategory(mapCategory(row));
    } else if (table === "hero_slides") {
      const mapped = mapHero(row);
      const idx = state.heroSlides.findIndex((h) => String(h.id) === String(mapped.id));
      if (idx >= 0) state.heroSlides[idx] = mapped;
      else state.heroSlides.push(mapped);
      state.heroSlides = sortHero(state.heroSlides);
      state.capabilities.hero = "ok";
    }
    writeLocal();
    emit("remote:" + table);
  }

  /* ============================================================
     public API
     ============================================================ */
  global.MesoDB = {
    state,
    subscribe,
    emit,
    load,
    reload,
    // lookups
    categoryById,
    categoryBySlug,
    categoryLabelOf,
    productById,
    productsOf,
    nextSortOrder,
    // catalogue mutations
    upsertCategory,
    removeCategory,
    reorderCategories,
    moveAllProducts,
    upsertProduct,
    removeProduct,
    setProductImage,
    upsertHeroSlide,
    removeHeroSlide,
    // images
    uploadImage,
    listImages,
    imagesInUse,
    deleteStoredImages,
    resolveImage,
    isStoredHere,
    pathOfStored,
    probeStorage,
    BUCKET,
    // auth
    refreshAdmin,
    signIn,
    signOut,
    onAuthChange,
    // helpers used by the UI
    readableError,
    optimiseImage,
  };
})(window);
