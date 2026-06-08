# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — run the dev server at http://localhost:3000
- `npm test` — run tests in interactive watch mode (Jest + React Testing Library via react-scripts)
- `npm test -- --watchAll=false src/App.test.js` — run a single test file once, non-interactively
- `npm run build` — production build to `build/`
- `npm run deploy` — build and publish `build/` to GitHub Pages via `gh-pages` (deploys to https://habitslog.net)

This is a Create React App project (`react-scripts`). There is no separate lint command; ESLint (`react-app` config) runs as part of `start`/`build`.

## Environment

Firebase config is required via `REACT_APP_FIREBASE_*` env vars (see the keys in `.env`, which is gitignored). `src/firebase.js` validates all six are present at startup and throws if any are missing, so the app will not boot without a complete config.

## Architecture

A single-user-per-account habit tracker. All UI logic lives in `src/App.js`; the `src/components/` files are presentational and receive all state and handlers as props from `App`. There is no router or global state library despite `react-router-dom` being installed.

**Auth & data ownership:** Google sign-in only (`signInWithGoogle`/`signOutUser` in `src/firebase.js`), via `useAuthState` from `react-firebase-hooks`. All Firestore data is namespaced under `users/{uid}/...`, and `firestore.rules` enforces that a user can only read/write their own subtree. Every mutation handler in `App.js` early-returns if there is no `user`.

**Habits persistence (full-collection replace, debounced):** Habits live in local state and are mirrored to `users/{uid}/habits`. `saveHabitsToFirestore` does a **batch delete-all-then-write-all** of the entire habits collection on every save — it is not an incremental update. Saves are debounced 500ms via an effect on `[habits, user]`. A `habitsLoaded` ref gates saving so the initial fetch doesn't immediately trigger a wipe-and-rewrite. Habit ordering is a numeric `order` field maintained by drag-and-drop (`reorderHabits` reindexes 0..n).

**Notes persistence (per-document):** Notes live in `users/{uid}/notes` and are written individually with `addDoc`/`updateDoc`/`deleteDoc` directly inside `App.js` handlers (not through `firebase.js`), each call updating local state optimistically. Notes carry a `date` (yyyy-MM-dd string), `createdAt` Timestamp, and `isSticky` flag. Sticky notes render in `StickyNotes`; the rest render in `RegularNotes` filtered against `displayedDays`.

**Date model:** The grid shows a rolling 7-day window — 5 past days, today, and 1 future day — computed from `currentPeriodEndDate` with `date-fns`. Week navigation shifts this window by 7 days and is clamped so it can never advance past today. Completion state per habit is stored as arrays of `yyyy-MM-dd` strings in `completedDays` and `skippedDays` (mutually exclusive — toggling one removes the other). In the grid, **left-click toggles completion, right-click (context menu) toggles skip**.

**Streaks:** `calculateStreak` in `App.js` counts consecutive completed days back from the most recent, with special-casing for today/yesterday/day-before so a streak isn't shown as broken before the current day is logged.

**Note formatting:** `src/utils/textFormatter.js` (`parseNoteText`) renders a small markdown-like syntax (bold, italic, underline, strikethrough, and `[]`/`[x]` checkboxes) to HTML. It HTML-escapes input first to prevent XSS, then the components render the result via `dangerouslySetInnerHTML`. Interactive checkboxes are tracked by a `data-line` index so toggles can rewrite the correct source line.
