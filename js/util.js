/* ============================================================
   MESO HOUSEHOLDS — shared utilities (no dependencies)
   Exposes: window.MesoUtil
   ============================================================ */
(function (global) {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));

  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

  function formatKES(n) {
    const value = Number(n);
    const safe = Number.isFinite(value) ? value : 0;
    return "KES " + safe.toLocaleString("en-KE", { maximumFractionDigits: safe % 1 ? 2 : 0 });
  }

  /** Accepts "1,500", "KES 1 500.50", 1500.5 → number */
  function parsePrice(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value == null ? "" : value).replace(/[^\d.]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function slugify(value, fallback = "category") {
    const slug = String(value == null ? "" : value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return slug || fallback;
  }

  function uid() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") return global.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function debounce(fn, wait = 500) {
    let t = null;
    const wrapped = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
    wrapped.cancel = () => clearTimeout(t);
    wrapped.flush = (...args) => {
      clearTimeout(t);
      fn(...args);
    };
    return wrapped;
  }

  function bytes(n) {
    if (!Number.isFinite(n) || n <= 0) return "—";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(message, kind = "info", ms = 3000) {
    const el = $("#toast");
    if (!el) {
      console[kind === "error" ? "error" : "log"]("[meso] " + message);
      return;
    }
    el.textContent = message;
    el.classList.remove("toast--info", "toast--ok", "toast--error");
    el.classList.add("show", kind === "error" ? "toast--error" : kind === "ok" ? "toast--ok" : "toast--info");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), ms);
  }

  /* ---------- render lock ----------
     While an admin is typing in a field or a dialog is open we postpone
     re-renders so nothing they typed is wiped out from under them. */
  let locks = 0;
  const lockWaiters = new Set();
  function lockRender(reason) {
    locks += 1;
    return () => {
      locks -= 1;
      if (locks <= 0) {
        locks = 0;
        lockWaiters.forEach((fn) => fn(reason));
      }
    };
  }
  function rendersLocked() {
    return locks > 0;
  }
  /** debugging aid: how many repaint locks are currently held */
  function lockCount() {
    return locks;
  }
  function onUnlock(fn) {
    lockWaiters.add(fn);
    return () => lockWaiters.delete(fn);
  }

  /* ---------- native <dialog> helpers ---------- */
  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else if (!dialog.open) {
      dialog.setAttribute("open", "");
    }
    global.document.body.classList.add("has-open-dialog");
  }
  function closeDialog(dialog) {
    if (!dialog) return;
    const isOpen = dialog.open || dialog.hasAttribute("open");
    if (isOpen) {
      if (typeof dialog.close === "function") dialog.close();
      else {
        dialog.removeAttribute("open");
        // environments without native <dialog> still get the close event we rely on
        dialog.dispatchEvent(new global.Event("close"));
      }
    }
    if (!$("dialog[open]")) document.body.classList.remove("has-open-dialog");
  }

  global.MesoUtil = {
    $,
    $$,
    escapeHtml,
    formatKES,
    parsePrice,
    slugify,
    uid,
    debounce,
    bytes,
    toast,
    lockRender,
    rendersLocked,
    lockCount,
    onUnlock,
    openDialog,
    closeDialog,
  };
})(window);
