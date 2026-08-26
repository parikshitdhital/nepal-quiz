# Nepal Geography Quiz — Deploy Guide

This folder is a plain static website: `index.html`, `styles.css`, `app.js`,
and a `data/` folder with the district/city/landmark JSON. No build step,
no server-side code — any static host works.

## Files
- `index.html` — page structure
- `styles.css` — all styling
- `app.js` — quiz logic (fetches the JSON files at load time)
- `data/districts.json` — 77 district boundary shapes
- `data/provinces.json` — district → province lookup
- `data/cities.json` — 40 major cities
- `data/landmarks.json` — 36 mountains, lakes, rivers, parks, temples

Scores and leaderboards save to the visitor's own browser via
`localStorage` — nothing leaves their device, no backend needed.

## Deploy in ~2 minutes (Vercel or Netlify)

1. **Put this folder in a GitHub repo**
   - Go to github.com → New repository → name it (e.g. `nepal-quiz`)
   - Drag-and-drop all the files/folders above into the repo via the
     GitHub web UI (no git commands needed) → commit

2. **Connect to Vercel or Netlify** (either works, both free)
   - **Vercel**: vercel.com → sign in with GitHub → "Add New Project" →
     pick your repo → leave all settings default (no framework, no build
     command) → Deploy
   - **Netlify**: app.netlify.com → "Add new site" → "Import an existing
     project" → pick your repo → leave build command blank, publish
     directory as `/` → Deploy

3. **Copy your live URL** from the dashboard — it's public immediately.

Any future edit: push the changed file to GitHub, the host auto-redeploys
in under a minute.

## Notes
- Works fully offline-first after the initial load, aside from the Google
  Fonts import in `styles.css` (safe to remove if you want zero external
  requests).
- If you ever add a real backend (shared leaderboards across visitors,
  not just per-device), that's a bigger step — happy to help when you're
  there.
