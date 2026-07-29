# Workout Journal

A private, personal fitness journal built with React. Track workouts, weight,
progress photos, habits, custom records, and goals — all stored locally on
your device.

## Running it locally

You'll need [Node.js](https://nodejs.org) installed (v18 or newer).

```bash
npm install
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`) in your
browser. For the best experience, open it on your phone and use "Add to
Home Screen" (iOS Safari: Share → Add to Home Screen) so it behaves like a
native app.

## Building for deployment

```bash
npm run build
```

This produces a `dist/` folder you can host anywhere static files are
served (Vercel, Netlify, GitHub Pages, your own server, etc.).

## Data & privacy

All data is stored in your browser's local storage on your own device.
Nothing is uploaded anywhere. Progress photos never touch your device's
Photos app or leave the browser. Clearing your browser's site data for
this app will erase everything, so use Export (in More → Export Data) if
you want a backup.

## Deploying to GitHub Pages (automatic — recommended)

This project includes a GitHub Actions workflow that builds and deploys
the site for you automatically, so you never have to remember to run
`npm run build` yourself. **This is the fix for the exact "works locally
but shows a black screen on GitHub Pages" problem** — that happens when
the raw `.jsx` source gets uploaded directly, since browsers can't run
JSX without being built first. The workflow always builds before
publishing, so this can't happen.

Setup (one time):

1. Create a new GitHub repository and push this entire folder to it
   (including the `.github` folder — make sure your `.gitignore` doesn't
   accidentally exclude it; hidden folders are easy to miss when
   dragging files into GitHub's web uploader, so using `git push` from
   the command line is more reliable).
2. On GitHub, go to your repo's **Settings → Pages**.
3. Under "Build and deployment", set **Source** to **GitHub Actions**
   (not "Deploy from a branch").
4. Push a commit to your `main` branch (or go to the **Actions** tab and
   run the "Deploy to GitHub Pages" workflow manually).
5. Wait about a minute for the build to finish, then visit the URL shown
   under Settings → Pages.

From then on, every push to `main` automatically rebuilds and republishes
the site.

## Deploying elsewhere (Vercel, Netlify, your own server, etc.)

```bash
npm install
npm run build
```

This produces a `dist/` folder — deploy the **contents of `dist/`**, never
the raw project source. Most hosts (Vercel, Netlify) do this build step
for you automatically if you just connect the repo and set the build
command to `npm run build` and the output directory to `dist`.

### If you still get a blank/black screen after deploying

1. Open the deployed site and check the browser console (on iPhone:
   Settings → Safari → Advanced → Web Inspector, then inspect from a Mac;
   on desktop: right-click → Inspect → Console) for a red error — it'll
   usually name the exact file that failed to load.
2. Confirm what actually got deployed is the *contents of `dist/`* (files
   like `index.html` and an `assets/` folder with `.js`/`.css` files
   inside) — not a folder containing `src/App.jsx`. If you see `.jsx`
   files in the deployed output, that's the bug: the site was never built.
3. If using GitHub Pages, double check Settings → Pages → Source is set
   to "GitHub Actions", not "Deploy from a branch" — the latter publishes
   whatever raw files are in the branch, JSX included.

## Notes

- Camera capture (progress photos, front/back toggle) relies on
  `<input type="file" capture>`, which works in mobile browsers but may
  behave differently on desktop.
- This was originally built and iterated on as a Claude artifact, so the
  code includes a small compatibility shim that uses `localStorage` when
  running standalone (outside Claude) instead of Claude's built-in
  artifact storage API.
