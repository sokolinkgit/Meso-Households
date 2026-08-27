# Meso Households 🏠

**Your One-Stop Household Solution** — Kamukunji, Nairobi.

A fully responsive single-page website for Meso Households, a household goods shop dealing in flasks,
plates, blenders, thermos, water bottles, electric kettles, cookware and cutlery — with an inline
**admin studio** so the owner edits the real page instead of a back office.

## 📍 Shop Details
- **Location:** Muthithu Building, Shop GF02, Kamukunji, Nairobi
- **Phone / WhatsApp:** 0742 005 725

## ✨ Visitor features
- Hero slideshow, about, products, why-us, testimonials and visit-us sections
- Catalogue grouped by category, with category filters
- Shopping cart with quantity controls (localStorage) → **order via WhatsApp**
- Embedded Google Map, directions link, floating WhatsApp button, back-to-top
- Mobile-first responsive design, scroll-reveal animations, toasts, active-nav highlighting
- Live data: prices/photos change on the page without a refresh (Supabase Realtime)

## 🛠 Admin studio (no separate dashboard)
Signed-in admins see **exactly the page visitors see**, with editing controls layered on top — there is
no "admin panel at the bottom" to keep in sync.

| Task | How |
| --- | --- |
| Sign in | Click the house logo 5×, or the footer's *Site management* link, or open `#admin` |
| Edit any text | Click the name, price, description, badge or category title on the page and retype it. Enter/Tab/⌘S saves, Esc cancels |
| Move a product to another category | The **In ▸ category** dropdown on the card — the card jumps to the new category instantly |
| Move a whole category's products | **Move all ▸** dropdown in the category header |
| Reorder categories | ↑ / ↓ in the category header |
| Add / rename / delete a category | `＋ New category`, ✏️ Edit, 🗑 Delete — deleting asks where its products should go (or deletes them) |
| Add / edit / duplicate / delete a product | Card toolbar: ✏️ 🖼 ⧉ 🗑 (duplicate opens the copy ready to edit) |
| Upload a photo | Drag-drop, browse or **paste** into the photo box → stored in Supabase Storage, shown on the card immediately |
| Use a past URL instead | Paste any image URL (e.g. `images/foo.jpg` or `https://…`) into the same field |
| Delete an image | "Remove image" — for bucket files it offers to delete the uploaded file too, for URL images it just unlinks them |
| Media library | 🖼 Media library in the admin bar: browse, upload, copy URL, delete unused files |
| Homepage photos | Each hero slide has ✏️ / 🗑 plus *Add a hero photo* under the slideshow (`hero_slides` table) |
| Turn editing off | The **Edit mode** switch in the admin bar — off means you see the pure visitor view |
| Check what is connected | Click the status pill in the admin bar: tables, storage bucket, realtime, sign-in, with copyable setup SQL |

Every write is **optimistic**: the page updates immediately, the card shows `Saving… → Saved ✓`, and a
rejected write is rolled back with the reason in a toast (unique slug, missing table, RLS, offline…).
Writes from two fields can't race — saves are serialised per row/editor.

**Preview mode:** with no (or unreachable) Supabase the whole studio still works against localStorage,
so you can try it by opening `index.html`. Any email + password signs you in and the status pill says
*Preview data*.

## 🗄 Supabase setup
1. Create the project, then paste **`supabase-schema.sql`** into *SQL Editor → Run* (idempotent — safe to re-run).
   It creates `categories`, `products`, `hero_slides`, `admin_users` + `is_admin()`, the RLS policies,
   the public **`product-images`** storage bucket with admin-only writes, and adds the tables to the
   realtime publication.
2. *Authentication → Users* → add the admin's email + password.
3. Grant admin (run once per admin, in SQL editor):
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where lower(email) = 'you@example.com'
   on conflict (user_id) do nothing;
   ```
4. Point `js/supabase-config.js` at your project (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_BUCKET`).
   The anon key is public by design — RLS keeps writes admin-only.

Photos are resized in the browser (max edge 1400px, WebP/JPEG) before upload, so phone photos stay light,
and are served from the bucket's public URL. A file still used by a product cannot be deleted from the
library — unlink it first.

## 🚀 Run locally
```bash
python3 -m http.server 8080   # then visit http://localhost:8080
```
or just open `index.html`. No build step, no frameworks, no dependencies.

## 📁 Structure
```
├── index.html              # markup incl. the admin bar + dialogs (native <dialog>)
├── css/style.css           # visitor styling
├── css/admin.css           # admin studio layer (bar, sheets, inline controls, media library)
├── js/supabase-config.js   # project URL / anon key / bucket
├── js/util.js              # helpers: toasts, dialog + render-lock primitives
├── js/db.js                # data layer: Supabase + preview adapter, optimistic CRUD, storage, realtime, auth
├── js/render.js            # the shared markup for cards & category blocks (visitor and admin)
├── js/admin.js             # admin studio: inline editing, dialogs, image upload/picker, media library
├── js/main.js              # page controller: catalogue, slider, cart, WhatsApp checkout
└── supabase-schema.sql     # tables, RLS, storage bucket + policies, seed data
```
