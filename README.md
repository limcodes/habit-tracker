# Habits Log

A calm, single-user habit and daily-notes tracker. Track habits on a rolling
weekly grid (tap a day to cycle empty → done → skipped), keep dated notes with
lightweight markdown and checklists, pin sticky notes, and watch your streaks.

Live at **[habitslog.net](https://habitslog.net)**.

## Stack

- **React** (Create React App) — single-page app, no router
- **Firebase** — Google authentication + Cloud Firestore (per-user data under
  `users/{uid}/…`, locked down by `firestore.rules`)
- Deployed to **GitHub Pages** via `gh-pages`

See [`CLAUDE.md`](./CLAUDE.md) for the architecture overview (data model, the
debounced diff-based habits save, the notes model, and the date/streak logic).

## Setup

Firebase config is read from environment variables (the app validates them at
startup). Create a `.env` in the project root:

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
```

## Commands

```bash
npm start        # run the dev server at http://localhost:3000
npm test         # run the test suite (Jest + React Testing Library)
npm run build    # production build to build/
npm run deploy   # build, then publish build/ to GitHub Pages (habitslog.net)
```

Run a single test file once:

```bash
npm test -- --watchAll=false src/App.test.js
```

## Deployment

`npm run deploy` builds and pushes `build/` to the `gh-pages` branch.
`public/CNAME` carries the `habitslog.net` custom domain into the build, so the
domain is preserved on each deploy.
