# BCH Builders Lab — site + live funding bar

This is the full site as a Vercel project. It's the same static site as before,
plus one serverless function (`/api/raised`) that powers the live funding bar.

## What's here

```
index.html              the homepage (support teaser links to /support)
support.html            /support — full funding bar, tiers, QR, wallet pay, partners
lab-floor.html          /lab-floor — PR-based builder sign-up + who's building table
updates.json            Ecosystem Updates feed (edit to post updates)
sw.js                   PWA service worker
manifest.webmanifest    PWA manifest
icon-*.png              app icons
bch-builders-lab-banner.png   social share image
vercel.json             Vercel config (cleanUrls on, so /support & /lab-floor work)
api/raised.js           serverless function: returns funding progress
```

## Pages & routing

`cleanUrls` is on in vercel.json, so `/support` serves `support.html` and
`/lab-floor` serves `lab-floor.html` automatically — no `.html` needed in links.

- **Homepage** has a compact Support teaser (with a live mini goal-bar) that links
  to the full `/support` page.
- **/support** holds everything: live goal bar, the four tiers with QR flip and
  wallet pay, direct-send, transparency line, and Partners (CashStamps, OPTN Labs,
  El Bitcoin).
- **/lab-floor** is the builder sign-up: a "who's building" table plus instructions
  for adding yourself via a GitHub pull request (edit `builders.json`, open a PR).
  **You still need to create the Lab Floor repo** and replace the placeholder
  `https://github.com/YOUR-ORG/bch-builders-lab` link in lab-floor.html.

## Deploy

1. Put this whole folder in a Git repo (GitHub).
2. On vercel.com: New Project → import the repo → Deploy. No build settings needed.
3. Point your domain (bchbuilders.online) at the Vercel project.

That's it. The static files serve as before; `/api/raised` runs as a function.

## Turn the funding bar live (2 steps)

The bar reads **total BCH ever received** by the donation address, subtracts a
**baseline** (so this campaign starts at $0), converts to USD at the live price,
and fills toward the **$500** goal. Spending the funds never drops the bar,
because it reads *total received*, not *balance*.

Everything is configured at the top of `api/raised.js`:

```js
const ADDRESS  = 'bitcoincash:qpuz...';  // your donation address
const GOAL_USD = 500;                     // one full Lab session
const BASELINE_BCH = null;                // <-- you'll set this once
```

### Step 1 — deploy once with `BASELINE_BCH = null`

Visit `https://your-site/api/raised`. Because the baseline isn't set, it returns:

```json
{ "needsBaseline": true, "currentTotalBCH": 1.2345, "message": "..." }
```

Copy that `currentTotalBCH` number.

### Step 2 — lock the baseline

Set `BASELINE_BCH` to that number and redeploy:

```js
const BASELINE_BCH = 1.2345;   // campaign now starts at $0
```

From now on, only NEW payments count. The bar starts empty and fills as BCH
arrives. Every visitor's page fetches the live number on load.

## Notes

- **Goal is in USD ($500), converted live.** If the BCH price moves, the dollar
  value of received BCH moves with it, so the bar can shift slightly on a quiet
  day even with no new payments. That's expected with a USD-denominated goal.
- Price comes from CoinGecko; if it's ever down, the function falls back to a
  safe default so the bar never breaks.
- The function caches results for 30s so the explorer APIs aren't hammered.
- Data source: blocksdk BCH API (no key), with a fallback explorer. If you ever
  want to swap in your own indexer (Chaingraph/Fulcrum), edit
  `getTotalReceivedBCH()` in `api/raised.js` — that's the only function to change.
- To start a brand-new campaign later, just update `BASELINE_BCH` to the current
  total again. Bar resets to $0.
