# Before this site goes live

Everything below is a real blocker or a decision Logosa has to make. Nothing on
the site invents a fact about the company, so the gaps are visible rather than
papered over — an unsupplied phone number renders as nothing at all, not as a
plausible-looking placeholder somebody might try to call.

---

## 1. Licensing — one blocker

**`public/3d assets/stone_garuda_-_free_low-res_version.glb` is NOT used, and must not be.**

It is licensed **CC BY-NC 4.0**. The *NonCommercial* term forbids use on a
commercial travel agency's website. Building it into the site would put Logosa
in breach. To use it, either licence it directly from the author
([Dystopia on Sketchfab](https://sketchfab.com/Dystopia)) or replace it with a
commercially licensed Garuda.

The two models that **are** used are **CC BY 4.0**, which permits commercial use
**but requires visible attribution**:

| Model | Author | Used for |
|---|---|---|
| Mount Everest 3D Model | alitural | The opening sequence |
| Kala Bhairava w/ 2 LOD — Nepal Heritage | Dystopia | The Craft chapter |

Attribution is rendered in the footer, on `/about`, and in the caption beneath
the Kala Bhairava. **Removing it breaks the licence.** It lives in
`src/data/credits.ts`.

---

## 2. Company details — currently hidden from the public site

Fill in `src/data/company.ts`. Every field set to `TO_CONFIRM` is **hidden at
runtime** rather than rendered, so the site is honest but incomplete until these
are supplied:

- `phone`, `whatsapp`, `email` — without these there is no contact route but the form
- `address.street`
- `registrationNo`, `tourismLicenceNo`, `panNo`
- `memberships` — NATTA, TAAN, NMA, etc. **Only list real ones.**
- `founded`, `hours`
- `social` — Facebook, Instagram, TripAdvisor, YouTube

Also set `NEXT_PUBLIC_SITE_URL` to the real domain (see `.env.example`),
otherwise canonical URLs, the sitemap and Open Graph tags point at a guess.

---

## 3. Bookings, enquiries and the admin — needs a database

The site has a booking desk: travellers request a booking at `/book` (or from
any journey page), staff quote and manage it at `/admin`, and the traveller
accepts the quote at a private link. Every enquiry from the contact form and
trip planner is stored there too.

**Without `MONGODB_URI` in production, none of this is switched on** — `/book`
points visitors at the enquiry form, `/admin` says it is not set up, and
enquiries are only delivered if email or a webhook is configured. Until one of
those is in place, **enquiries are lost.** This is the single most important
item here.

### Setting it up (Vercel)

1. **Database.** Add MongoDB Atlas from the Vercel Marketplace (the free M0
   cluster is plenty), or create a cluster at mongodb.com and set
   `MONGODB_URI` yourself. In Atlas → Network Access, allow connections from
   anywhere (`0.0.0.0/0`): Vercel functions do not have fixed IP addresses.
   The data goes in a database called `logosa` unless `MONGODB_DB` says
   otherwise. There are no migrations — the site creates its indexes the
   first time it connects.
2. **First account.** Set `ADMIN_SETUP_TOKEN` to a long random string, deploy,
   and open `/admin/setup`. Enter the token and create the owner account. The
   setup page closes for good once any account exists; the token can then be
   removed. Add everyone else under **Admin → Staff**.
3. **Email** (strongly recommended). Set `RESEND_API_KEY`, `INQUIRY_TO` (the
   staff inbox) and `INQUIRY_FROM` — an address on a domain **verified in
   Resend**. Travellers receive their booking link, quotes and confirmations
   from it; Resend's default test sender only delivers to your own account, so
   without a verified domain they would never arrive. Without email, everything
   is still recorded in the admin, and the admin says so on every page that
   would have sent something — staff copy the traveller's link and send it
   themselves.

Locally there is nothing to set up: with no `MONGODB_URI`, `npm run dev`
starts a real MongoDB server of its own, storing its data in `.data/mongo`.
Delete that folder to start again from empty. The first run downloads the
MongoDB server once per machine — a large download on Windows (~780 MB, of
which ~75 MB is kept in `~/.cache/mongodb-binaries`). To skip it, put an Atlas
connection string in `.env.local` as `MONGODB_URI` — ideally a separate
database from production, e.g. with `MONGODB_DB=logosa-dev`.

**This copy is already connected.** `.env` points `MONGODB_URI` at a MongoDB
Atlas cluster with `MONGODB_DB=site-1`, so `npm run dev` uses Atlas rather
than the local server. To create the first account, run `npm run dev` and open
`/admin/setup` — in development it does not ask for the setup token. `.env` is
ignored by git, so the connection string is never committed.

### How a booking runs

1. **Requested** — the traveller picks a journey (or a custom trip), a start
   date and a group size. Nothing is charged; the page says so.
2. **Quote sent** — staff write the total, an optional deposit, a validity date
   and what the price covers. The traveller sees it at their private link.
3. **Accepted** — the traveller accepts online (or by email/phone; staff can
   confirm directly from a sent quote).
4. **Confirmed** — staff record the deposit under Payments and confirm.
5. **Completed** — after the trip.

A booking can be cancelled at any open stage, with a reason on the record.
Every step is written to the booking's history, and the steps that concern the
traveller also appear on their page.

**The site takes no payments.** Deposits arrive by bank transfer, cash, eSewa,
Khalti or card through whatever Logosa already uses, and staff record them
against the booking. Adding an online gateway later is a matter of recording
the payment from its webhook instead of by hand.

### Worth knowing

- The traveller's link is the only credential for their booking — there are no
  traveller accounts. If one is sent to the wrong person, **Replace the link**
  on the booking issues a new one and kills the old.
- There is no "forgot password" email. An owner resets passwords under Staff.
- Form rate limits are kept in memory, per server instance. On Vercel that
  stops casual abuse, not a distributed attack; see `src/lib/rate-limit.ts`.
- A booking's payments and history live inside the booking document, so every
  change to a booking — its status and the history line recording it — is a
  single atomic write. Adding a field is just adding it to the types in
  `src/lib/db/schema.ts`; existing documents simply lack it, so give new
  fields a sensible reading when missing. New indexes go in `ensureIndexes()`
  in `src/lib/db/index.ts` and are created on the next deploy.
- Backups: Atlas's free tier takes no automatic backups. Once real bookings
  are in it, move to a tier that does, or schedule `mongodump`.

---

## 4. Photography — larger originals, and licences if it goes commercial

Every image on the site is a photograph; the generated illustrations are gone.
The twelve originals sit in `images/` exactly as supplied, and
`src/data/photos.ts` lists each one once, with alt text describing what is
actually in the frame. Destinations, journeys and stories all point at entries
there, so a photograph used on three pages is described the same way on all
three.

**Rights.** Fine as they are for now: this is a college project, not a
commercial launch. If the site is ever used commercially, Logosa must hold a
licence for every one of these. Several look as if they came from the web —
the aerial Everest (`images/Everest-and-khumbu/khumbu.png`) closely resembles a
widely shared Wikimedia Commons photograph, which would need a visible credit
under its licence. At that point, confirm where each came from, replace
anything that can't be licensed, and credit anything whose licence asks for it,
the way the 3D models are credited in `src/data/credits.ts`.

**Size.** Most originals are small — `images/Annapurna/annapurna.png` is 565 px
wide — and the site shows photographs up to the full width of a desktop
screen. The build enlarges anything under 1,600 px with a better filter than
the browser would use, but that cannot add detail that was never there: they
will look soft on large screens until replaced with originals of around
2,400 px on the long edge.

To add or replace a photograph:

1. Put the original in `images/` — any folder, JPEG, PNG or WebP.
2. Add or update its entry in `src/data/photos.ts`: `source`, `src`, and alt
   text that describes the photograph itself, not the page it sits on. Set
   `focus` if the subject is far off-centre and a tall crop would lose it.
3. Run `npm run build:images`. It writes `public/images/photos/`, and deletes
   copies that no entry uses any more.

When commissioning: the identity reads as dawn light (low sun, long shadows,
cool ranges against warm ground), and the same picture is cropped to 4:5,
3:2 and 16:9 in different places, so leave headroom around the subject.

---

## 5. Content that needs Logosa's sign-off

**Journeys** (`src/data/journeys.ts`) — ten real, established Nepali routes with
accurate elevations, walking times and permits. They ship `status: "published"`
because each is an accurate description of a real route — **not** because Logosa
has confirmed they operate it. Set `status: "draft"` on anything you do not run
and it disappears from the production site.

- Every journey has `price: null`. The site says "quoted per group" and asks for
  an enquiry. If you want prices shown, the type must change deliberately.
- `included` / `excluded` are **empty on purpose** — those are commercial
  promises nobody has agreed. The page asks travellers to request them in
  writing instead.

**Stories** (`src/data/stories.ts`) — three researched, factually accurate
editorial drafts, attributed to "Logosa", not to an invented author. Read,
amend and sign off each one, or replace with pieces by your own guides.

**Travel guide** (`src/data/travel-info.ts`) — every entry has a `lastVerified`
date, currently `null`, and the page says in the open that unverified items
should be checked against the linked source. Verify each against the Department
of Immigration / Nepal Tourism Board and set the date.

---

## 6. What the site deliberately does not have

No testimonials, no star ratings, no traveller counts, no awards, no "trusted by
X" logos, no fake live availability. None were supplied, so none were invented.
The review component is not built because building an empty one invites filling
it with fiction. When you have real reviews, connect them then.

---

## 7. Optional: the Mapbox journey

Without a token the map section renders the **drawn atlas** — real Natural Earth
boundary geometry, true coordinates, the same scroll narrative. It is a
designed fallback, not a broken state, and it is genuinely good.

To enable the 3D terrain map, set `NEXT_PUBLIC_MAPBOX_TOKEN`. Restrict the token
to your domain in the Mapbox dashboard — it ships to the browser.

This copy has a token set in `.env`, so the homepage flies the 3D map. Visitors
who have asked their device for reduced motion still get the drawn atlas.

---

## Commands

```bash
npm run dev          # development (starts a local MongoDB if MONGODB_URI is unset)
npm run build        # production build
npm start            # serve the build

npm run build:images              # web copies of the photographs in images/
node scripts/prepare-brand.mjs    # re-derive logo assets from logo.jpeg
node scripts/build-textures.mjs   # regenerate the Dhaka pattern SVGs
node scripts/build-models.mjs     # re-compress the GLB models
node scripts/shoot.mjs / --at 0,0.2,0.4   # screenshot pages for review
```

## Where things live

```
src/data/              all content and copy — edit here, not in components
src/data/photos.ts     every photograph, its alt text, and its original
src/lib/               dhaka pattern, mapbox, motion
src/lib/db/            database schema and connection
src/lib/bookings/      the booking lifecycle — every booking read and write
src/lib/auth/          staff accounts, passwords, sessions
src/app/(site)/        the public website
src/app/admin/         the booking desk (signed-in staff only)
src/components/        UI, grouped by section
images/                original photographs, as supplied — not served
public/images/photos/  web copies of them — regenerate, never hand-edit
public/models/         compressed GLB (source in "public/3d assets/")
public/textures/       generated Dhaka pattern
public/brand/          logo derivatives — regenerate, never hand-edit
```

The logo is the source of the whole design system. `logo.jpeg` is the master;
everything in `public/brand/` is derived from it by script and is safe to
delete and rebuild. The artwork itself is never recoloured or redrawn — where
it needs to sit on a dark surface it is placed on a paper plate instead.
