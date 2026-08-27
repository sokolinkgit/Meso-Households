/* ============================================================
   MESO HOUSEHOLDS — markup builders (window.MesoRender)

   ONE source of truth for the catalogue markup. Visitors and the
   admin see the exact same HTML; in edit mode the admin additionally
   gets inline affordances (toolbar, dropdowns, contenteditable text)
   layered on top of the very same card.
   ============================================================ */
(function (global) {
  'use strict';

  const U = global.MesoUtil;
  const db = () => global.MesoDB;
  const esc = U.escapeHtml;

  /* ---------- icons ---------- */
  const ICON = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.2 14.8 6.4l2.8 2.8L6.8 20H4v-2.8Z"/><path d="M16.4 4.8 19.2 2l2.8 2.8-2.8 2.8-2.8-2.8Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21a2 2 0 0 1-2-2V6H5V4h4V3h6v1h4v2h-.5l.5 13a2 2 0 0 1-2 2H7Zm2-4h1.5V8H9v9Zm4 0h1.5V8H13v9Z"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 11.5 4-4.5 3 3.4 4-4.9 3 3.8V7H5v9.5Z"/><circle cx="9" cy="10" r="1.6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h9a2 2 0 0 1 2 2v11h-2V5H8V3Zm-2 4h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v10h9V9H6Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.5 5 13h14l-7-7.5Z"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18.5 5 11h14l-7 7.5Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 17.6 4.8 12.9l1.6-1.6 3.1 3.1 7-7 1.6 1.6-8.6 8.6Z"/></svg>',
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 7.9 7.6l1.4 1.4L11 7.3V15h2V7.3l1.7 1.7 1.4-1.4L12 3.5Z"/><path d="M5 17h14v2H5v-2Z"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a1 1 0 0 0 1.4 0l4.2-4.2a3 3 0 0 0-4.2-4.2l-1.4 1.4 1.4 1.4 1.4-1.4a1 1 0 0 1 1.4 1.4l-4.2 4.2-1.4-1.4-1.4 1.4Zm2.8-2.8a1 1 0 0 0-1.4 0L7.8 14.8a3 3 0 0 0 4.2 4.2l1.4-1.4-1.4-1.4-1.4 1.4a1 1 0 0 1-1.4-1.4l4.2-4.2 1.4 1.4 1.4-1.4-1.4-1.4-1.4 1.4Z"/></svg>',
    drag: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  };

  const WHATSAPP_NUMBER = "254742005725";

  function icon(name, label) {
    return `<span class="ico">${ICON[name] || ""}</span>${label ? `<span>${esc(label)}</span>` : ""}`;
  }

  /* ---------- product card ---------- */
  function imageMarkup(product, admin) {
    const url = db().resolveImage(product.image);
    if (!url) {
      return `<div class="pmedia__empty" data-role="no-image">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 11.5 4-4.5 3 3.4 4-4.9 3 3.8V7H5v9.5Z"/></svg>
          <span>No photo yet</span>
          ${admin ? `<button class="btn btn-primary btn-xs" data-act="image" data-id="${esc(product.id)}">Upload a photo</button>` : ""}
        </div>`;
    }
    return `<img src="${esc(url)}" alt="${esc(product.name)}" loading="lazy" onerror="this.closest('.pmedia').dataset.broken='1'" />`;
  }

  /** the options of the per-card "move to another category" dropdown */
  function catOptionsFor(product) {
    return db()
      .state.categories.map(
        (c) =>
          `<option value="${esc(c.id)}"${String(c.id) === String(product.categoryId) ? " selected" : ""}>${esc((c.emoji ? c.emoji + " " : "") + c.name)}</option>`
      )
      .join("");
  }

  function categoryLine(product, label, admin) {
    if (!admin) return `<span class="product-cat">${esc(label)}</span>`;
    return `<label class="pc-move" title="Move this product to another category — saves instantly">
        <span class="pc-move__label">In</span>
        <select class="pc-move__select" data-act="move" data-id="${esc(product.id)}" aria-label="Move ${esc(product.name)} to another category">
          <option value=""${product.categoryId ? " disabled" : " selected"}>Not categorised…</option>${catOptionsFor(product)}
        </select>
      </label>`;
  }

  function cardToolbar(product, admin) {
    if (!admin) return "";
    return `<div class="pc-admin" data-role="card-admin">
        <button class="pcbtn pcbtn--edit" data-act="edit" data-id="${esc(product.id)}" title="Edit all details">${icon("edit")}</button>
        <button class="pcbtn" data-act="image" data-id="${esc(product.id)}" title="Upload / replace / remove photo">${icon("image")}</button>
        <button class="pcbtn" data-act="dup" data-id="${esc(product.id)}" title="Duplicate">${icon("copy")}</button>
        <button class="pcbtn pcbtn--danger" data-act="del" data-id="${esc(product.id)}" title="Delete product">${icon("trash")}</button>
      </div>`;
  }

  function productCard(product, { admin, index = 0 }) {
    const label = db().categoryLabelOf(product);
    const wa = encodeURIComponent(
      `Hello Meso Households! \n\nI'd like to order:\n• ${product.name} — ${U.formatKES(product.price)}\n\nPlease confirm availability and delivery details.\n\nThank you!`
    );
    const editable = (field, value, tag, cls, attrs = "") =>
      admin
        ? `<${tag} class="${cls} editable" contenteditable="true" spellcheck="false" data-edit="${field}" data-id="${esc(product.id)}"${attrs}>${esc(value)}</${tag}>`
        : `<${tag} class="${cls}">${esc(value)}</${tag}>`;

    return `<article class="product-card"${admin ? ' data-admin="1"' : ""} data-id="${esc(product.id)}" style="animation-delay:${(index % 12) * 0.05}s">
      <div class="product-media pmedia">
        ${imageMarkup(product, admin)}
        ${product.tag ? `<span class="product-tag${admin ? " editable" : ""}"${admin ? ` contenteditable="true" spellcheck="false" data-edit="tag" data-id="${esc(product.id)}"` : ""}>${esc(product.tag)}</span>` : ""}
        ${admin && !product.tag ? `<button class="tag-add" data-act="add-tag" data-id="${esc(product.id)}">+ tag</button>` : ""}
        ${cardToolbar(product, admin)}
        ${admin ? `<span class="pc-flag" data-role="flag"></span><span class="pc-broken">Photo URL not found</span>` : ""}
      </div>
      <div class="product-body">
        ${categoryLine(product, label, admin)}
        ${editable("name", product.name, "h3", "product-name")}
        <p class="product-desc">${admin ? `<span class="editable" contenteditable="true" spellcheck="false" data-edit="desc" data-id="${esc(product.id)}">${esc(product.desc)}</span>` : esc(product.desc)}</p>
        <div class="product-foot">
          <span class="product-price">KES&nbsp;${
            admin
              ? `<span class="editable" contenteditable="true" spellcheck="false" inputmode="decimal" data-edit="price" data-id="${esc(product.id)}">${esc(formatPriceNumber(product.price))}</span>`
              : esc(formatPriceNumber(product.price))
          }</span>
          <button class="add-btn" data-add="${esc(product.id)}" aria-label="Add ${esc(product.name)} to cart">
            <svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Add
          </button>
        </div>
        <a class="wa-order-btn" href="https://wa.me/${WHATSAPP_NUMBER}?text=${wa}" target="_blank" rel="noopener" aria-label="Order ${esc(product.name)} on WhatsApp">
          ${WA_SVG} Order on WhatsApp
        </a>
      </div>
    </article>`;
  }

  function formatPriceNumber(price) {
    const n = Number(price) || 0;
    return n.toLocaleString("en-KE", { maximumFractionDigits: n % 1 ? 2 : 0 });
  }

  const WA_SVG =
    '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.11 3.22 5.11 4.51.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zm-5.45 7.23a8.3 8.3 0 0 1-4.23-1.16l-.3-.18-3.14.82.84-3.06-.2-.31a8.3 8.3 0 0 1-1.28-4.44c0-4.6 3.75-8.35 8.37-8.35a8.3 8.3 0 0 1 8.35 8.37c0 4.6-3.76 8.34-8.41 8.34zm8.42-18.37C18.85 1.75 17.06 1 15.1 1h-.07A11.11 11.11 0 0 0 3.94 12.14c0 1.96.51 3.87 1.49 5.56L3.85 23l5.44-1.42a11.05 11.05 0 0 0 5.3 1.35h.01c6.15 0 11.15-5 11.16-11.14 0-2.97-1.16-5.77-3.27-7.87z"/></svg>';

  /* ---------- category block ---------- */
  function categoryBlock(category, products, { admin }) {
    const count = products.length;
    const otherCats = db().state.categories.filter((c) => String(c.id) !== String(category.id));
    const head = admin
      ? `<header class="cat-head cat-head--admin">
          <div class="cat-head__left">
            <span class="cat-emoji editable" contenteditable="true" spellcheck="false" data-cat-edit="emoji" data-id="${esc(category.id)}" title="Click to change the icon">${esc(category.emoji || "🏷️")}</span>
            <h3 class="cat-name editable" contenteditable="true" spellcheck="false" data-cat-edit="name" data-id="${esc(category.id)}" title="Click to rename the category">${esc(category.name)}</h3>
            <span class="cat-count" data-role="count">${count} item${count === 1 ? "" : "s"}</span>
            <span class="cat-slug">/${esc(category.slug)}</span>
          </div>
          <div class="cat-head__actions">
            <label class="cat-merge" title="Move every product in this category somewhere else — saves instantly">
              <span>Move all ▸</span>
              <select data-act="cat-moveall" data-id="${esc(category.id)}" ${otherCats.length ? "" : "disabled"}>
                <option value="">${otherCats.length ? "to category…" : "no other category"}</option>
                ${otherCats.map((c) => `<option value="${esc(c.id)}">${esc(c.emoji ? c.emoji + " " : "")}${esc(c.name)}</option>`).join("")}
              </select>
            </label>
            <div class="cat-order" role="group" aria-label="Reorder category">
              <button class="pcbtn" data-act="cat-up" data-id="${esc(category.id)}" title="Move category up">${icon("up")}</button>
              <button class="pcbtn" data-act="cat-down" data-id="${esc(category.id)}" title="Move category down">${icon("down")}</button>
            </div>
            <button class="btn btn-xs btn-primary" data-act="cat-add" data-id="${esc(category.id)}">${icon("plus", "Add product")}</button>
            <button class="btn btn-xs btn-outline" data-act="cat-edit" data-id="${esc(category.id)}">${icon("edit", "Edit")}</button>
            <button class="btn btn-xs btn-danger-ghost" data-act="cat-del" data-id="${esc(category.id)}">${icon("trash", "Delete")}</button>
          </div>
        </header>`
      : `<header class="cat-head"><div class="cat-head__left">
          <span class="cat-emoji">${esc(category.emoji || "🏷️")}</span>
          <h3 class="cat-name">${esc(category.name)}</h3>
          <span class="cat-count">${count} item${count === 1 ? "" : "s"}</span>
        </div></header>`;

    const banner = category.banner
      ? `<div class="cat-banner"><img src="${esc(db().resolveImage(category.banner))}" alt="" loading="lazy" />${
          admin ? `<button class="pcbtn pcbtn--danger cat-banner__x" data-act="cat-banner-off" data-id="${esc(category.id)}" title="Remove banner">${ICON.trash}</button>` : ""
        }</div>`
      : "";

    const grid = count
      ? `<div class="products-grid">${products.map((p, i) => productCard(p, { admin, index: i })).join("")}</div>`
      : admin
        ? `<div class="cat-empty">
            <p>No products in <strong>${esc(category.name)}</strong> yet.</p>
            <button class="btn btn-sm btn-primary" data-act="cat-add" data-id="${esc(category.id)}">${icon("plus", "Add the first product")}</button>
          </div>`
        : "";

    return `<section class="cat-block" data-cat-id="${esc(category.id)}">${head}${banner}${grid}</section>`;
  }

  /** Whole catalogue, grouped by category (this is what both visitors and admins see). */
  function catalogHTML({ admin, filter = "all" }) {
    const D = db();
    const cats = D.state.categories.filter((c) => filter === "all" || c.slug === filter);
    const blocks = cats.map((c) => categoryBlock(c, D.productsOf(c.id), { admin, filter }));

    // Products whose category vanished (or was never set) stay visible & fixable.
    const known = new Set(D.state.categories.map((c) => String(c.id)));
    const orphans = D.state.products.filter((p) => !known.has(String(p.categoryId)));
    if (orphans.length && (filter === "all" || !cats.length)) {
      blocks.push(
        `<section class="cat-block cat-block--orphan" data-cat-id="">
          <header class="cat-head"><div class="cat-head__left"><span class="cat-emoji">⚠️</span><h3 class="cat-name">Needs a category</h3><span class="cat-count">${orphans.length} item${orphans.length === 1 ? "" : "s"}</span></div></header>
          <div class="products-grid">${orphans.map((p, i) => productCard(p, { admin, index: i })).join("")}</div>
        </section>`
      );
    }

    if (!blocks.length) {
      return `<div class="catalog-empty">
        <p>${admin ? "No products match this filter." : "We're restocking this category — check back shortly."}</p>
        ${admin ? '<button class="btn btn-sm btn-primary" data-act="add-product">Add a product</button>' : ""}
      </div>`;
    }
    return blocks.join("");
  }

  /* ---------- filter bar ---------- */
  function filterBarHTML(active, { admin }) {
    const cats = db().state.categories;
    const chip = (slug, label, count) =>
      `<button class="filter-btn${slug === active ? " active" : ""}" data-filter="${esc(slug)}">${esc(label)}${count != null ? `<span class="filter-count">${count}</span>` : ""}</button>`;
    const D = db();
    return (
      chip("all", "All Items", admin ? D.state.products.length : null) +
      cats.map((c) => chip(c.slug, (c.emoji ? c.emoji + " " : "") + c.name, admin ? D.productsOf(c.id).length : null)).join("") +
      (admin ? `<button class="filter-btn filter-btn--add" data-act="add-category">${ICON.plus}<span>New category</span></button>` : "")
    );
  }

  /* ---------- hero slideshow ---------- */
  function heroHTML(slides, { admin }) {
    return slides
      .map((slide, i) => {
        const url = db().resolveImage(slide.image);
        return `<figure class="hero-slide${i === 0 ? " active" : ""}${slide.active ? "" : " hero-slide--off"}" data-hero-id="${esc(slide.id)}">
          ${url ? `<img src="${esc(url)}" alt="${esc(slide.title || "Meso Households product")}" />` : `<div class="hero-noimage">No photo</div>`}
          <figcaption class="slide-caption"><strong>${esc(slide.title || "")}</strong><span>${esc(slide.subtitle || "")}</span></figcaption>
          ${admin ? `<div class="slide-admin"><button class="pcbtn" data-hero-act="edit" data-id="${esc(slide.id)}" title="Edit this photo & caption">${ICON.edit}</button><button class="pcbtn pcbtn--danger" data-hero-act="del" data-id="${esc(slide.id)}" title="Delete this slide">${ICON.trash}</button></div>` : ""}
        </figure>`;
      })
      .join("");
  }

  global.MesoRender = {
    ICON,
    icon,
    formatPriceNumber,
    productCard,
    categoryBlock,
    catalogHTML,
    filterBarHTML,
    heroHTML,
  };
})(window);
