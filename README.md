# Meso Households 🏠

**Your One-Stop Household Solution** — Kamukunji, Nairobi.

A fully responsive single-page website for Meso Households, a household goods shop dealing in flasks, plates, blenders, thermos, water bottles, electric kettles, cookware and cutlery.

## 📍 Shop Details
- **Location:** Muthithu Building, Shop GF02, Kamukunji, Nairobi
- **Phone / WhatsApp:** 0742 005 725

## ✨ Features
- Hero, about, products, why-us, testimonials and visit-us sections
- Product catalogue with category filters (Kitchen Appliances, Flasks & Thermos, Dining, Cookware)
- Shopping cart with quantity controls (saved in localStorage)
- **Order via WhatsApp** — the cart builds a ready-to-send order message
- **Admin panel** (sign in with a Supabase admin account) — add/edit/delete categories & products with photo uploads, plus:
  - **Bulk upload** — pick (or create) a category, then select *all* product photos at once (file picker or drag & drop); each photo becomes one product, and price, tag and description can be filled in later, one by one
  - **Bulk delete** — in "Manage all", tick any products (or hit "Select all") and delete them in one go
- Embedded Google Map + directions link, floating WhatsApp button, back-to-top
- Mobile-first responsive design with hamburger menu
- Scroll-reveal animations, toast notifications, active-nav highlighting

## 🛠️ Built With
HTML, CSS and vanilla JavaScript only — no frameworks, no libraries.

## 🚀 Run Locally
Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

## 📁 Structure
```
├── index.html        # Page markup
├── css/style.css     # All styling
├── js/main.js        # Catalogue, cart, WhatsApp checkout & interactions
└── images/           # Product & hero images
```
