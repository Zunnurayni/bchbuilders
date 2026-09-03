// /api/raised — returns funding progress for the BCH Builders Lab support bar.
//
// It reads the total BCH ever RECEIVED by the donation address (not the balance,
// so spending the funds never makes the bar drop), subtracts a baseline so this
// campaign starts at $0, converts to USD at the live price, and returns a clean
// number the front-end can use to fill the bar toward the goal.
//
// ====== EDIT THESE THREE VALUES ======
const ADDRESS  = 'bitcoincash:qpuzdxhlmwyygy2marsx3tjxzqgk7jg8ccxr77mz0d';
const GOAL_USD = 500;          // one full Lab session
const BASELINE_BCH = null;     // set to a number to reset the campaign to $0.
                               // Leave null on first deploy — the function will
                               // report the current total so you can copy it here.
// =====================================

// Simple in-memory cache so we don't hammer the APIs (Vercel keeps warm functions briefly)
let cache = { at: 0, data: null };
const CACHE_MS = 30 * 1000; // 30 seconds

async function getTotalReceivedBCH(address) {
  // Primary: blocksdk (returns BCH directly, no key). Address without the "bitcoincash:" prefix.
  const bare = address.replace(/^bitcoincash:/, '');
  try {
    const r = await fetch(`https://api.blocksdk.com/v2/bch/addresses/${bare}`);
    if (r.ok) {
      const j = await r.json();
      const tr = j?.payload?.total_received;
      if (typeof tr === 'number') return tr; // already in BCH
    }
  } catch (e) { /* fall through */ }

  // Fallback: Fulcrum-style public REST via a different explorer returning satoshis.
  try {
    const r = await fetch(`https://rest.bitcoin.com/v2/address/details/${address}`);
    if (r.ok) {
      const j = await r.json();
      if (typeof j?.totalReceived === 'number') return j.totalReceived; // BCH
    }
  } catch (e) { /* fall through */ }

  throw new Error('Could not fetch total received from any source');
}

async function getBchPriceUSD() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-cash&vs_currencies=usd');
    if (r.ok) {
      const j = await r.json();
      const p = j?.['bitcoin-cash']?.usd;
      if (typeof p === 'number' && p > 0) return p;
    }
  } catch (e) { /* fall through */ }
  return 240; // safe fallback if price feed is down
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  // Serve cached result if fresh
  if (cache.data && Date.now() - cache.at < CACHE_MS) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  try {
    const [totalBCH, price] = await Promise.all([
      getTotalReceivedBCH(ADDRESS),
      getBchPriceUSD()
    ]);

    // If baseline not set yet, report it so the operator can lock it in.
    if (BASELINE_BCH === null) {
      const payload = {
        needsBaseline: true,
        currentTotalBCH: totalBCH,
        message: 'Set BASELINE_BCH to this currentTotalBCH value to start the campaign at $0.',
        goalUSD: GOAL_USD,
        bchPriceUSD: price
      };
      cache = { at: Date.now(), data: payload };
      return res.status(200).json(payload);
    }

    const campaignBCH = Math.max(0, totalBCH - BASELINE_BCH);
    const raisedUSD = campaignBCH * price;
    const pct = Math.min(100, Math.round((raisedUSD / GOAL_USD) * 100));

    const payload = {
      raisedUSD: Math.round(raisedUSD),
      raisedBCH: Number(campaignBCH.toFixed(8)),
      goalUSD: GOAL_USD,
      bchPriceUSD: price,
      pct
    };
    cache = { at: Date.now(), data: payload };
    return res.status(200).json(payload);
  } catch (err) {
    // On failure, tell the front-end so it can fall back gracefully.
    return res.status(200).json({ error: true, message: String(err && err.message || err) });
  }
};
