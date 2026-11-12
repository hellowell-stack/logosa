# Logosa — Travel through Nepal

The website of Logosa Tours and Travels, Kathmandu: destinations, journeys,
long-form stories, an experience finder and trip planner, and a booking desk
where staff quote and confirm trips.

Built with Next.js 16 (App Router), React 19, Tailwind 4, three.js for the
opening and the Craft chapter, and MongoDB for bookings and enquiries.

```bash
npm install
npm run dev            # http://localhost:3000 — starts a local MongoDB if MONGODB_URI is unset
npm run build          # production build
npm run lint
npm run build:images   # web copies of the photographs in images/
```

**Read [LAUNCH.md](LAUNCH.md) before going live.** It lists what is still
Logosa's to supply or decide — licences, company details, the database,
photography — and where everything lives. Environment variables are
documented in [.env.example](.env.example).
