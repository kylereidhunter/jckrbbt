// functions/optionsFlowScanner.js
// Scheduled Cloud Function — runs every 30 min during market hours (9:45 AM - 4:00 PM ET, weekdays)
// Scans ~400 liquid optionable tickers for unusual options activity
// Caches hits in Firestore for the client scanner to read instantly
//
// SETUP:
// 1. Add to functions/index.js:
//    const { scanOptionsFlow, scanOptionsFlowManual } = require('./optionsFlowScanner');
//    exports.scanOptionsFlow = scanOptionsFlow;
//    exports.scanOptionsFlowManual = scanOptionsFlowManual;
//
// 2. Deploy:
//    firebase deploy --only functions
//
// FIRESTORE COLLECTION: optionsFlow
//   Document per ticker with unusual activity:
//   { ticker, score, patterns[], signals[], optionsData{}, price, change, volume, timestamp }

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const POLYGON_KEY = process.env.POLYGON_KEY;
const POLYGON_BASE = 'https://api.polygon.io';

// ========== POLYGON API HELPERS ==========

async function polygonGet(path, params = {}) {
  const url = new URL(`${POLYGON_BASE}${path}`);
  url.searchParams.set('apiKey', POLYGON_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Polygon ${path}: ${res.status} - ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function getAllSnapshots() {
  return polygonGet('/v2/snapshot/locale/us/markets/stocks/tickers');
}

async function getOptionsChain(ticker, params = {}) {
  return polygonGet(`/v3/snapshot/options/${ticker}`, params);
}

// ========== ETF/JUNK FILTER ==========

const MEGA_CAPS = new Set([
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'BRK',
  'AVGO', 'JPM', 'LLY', 'V', 'MA', 'UNH', 'XOM', 'COST', 'HD', 'PG',
  'JNJ', 'ABBV', 'WMT', 'NFLX', 'BAC', 'CRM', 'ORCL', 'CVX', 'MRK', 'KO',
  'PEP', 'TMO', 'ACN', 'MCD', 'CSCO', 'ADBE', 'IBM', 'ABT', 'DHR', 'GE',
  'PM', 'DIS', 'INTC', 'VZ', 'T', 'CMCSA', 'NKE', 'PFE', 'WFC', 'MS',
]);

const ETF_PATTERNS = new Set([
  'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'IVV', 'RSP',
  'XLF', 'XLK', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC',
  'TQQQ', 'SQQQ', 'SOXL', 'SOXS', 'UVXY', 'SVXY', 'VXX',
  'GLD', 'SLV', 'TLT', 'HYG', 'EEM', 'EFA', 'VEA', 'VWO',
  'ARKK', 'ARKW', 'ARKG', 'ARKF', 'ARKQ',
  'TSLL', 'NVDL', 'MSTU', 'MSTX',
  'IBIT', 'GBTC', 'ETHE', 'BITO',
  'SCHD', 'JEPI', 'JEPQ',
]);

function isJunk(ticker) {
  if (!ticker || ticker.length < 2 || ticker.length > 5) return true;
  if (/\d/.test(ticker)) return true;
  if (/[a-z]/.test(ticker)) return true;  // Preferred shares
  if (ticker.includes('.')) return true;
  if (ETF_PATTERNS.has(ticker)) return true;
  if (ticker.length >= 4 && ticker.endsWith('W')) return true;
  if (ticker.endsWith('U')) return true;
  if (ticker.length === 5) {
    const last = ticker.slice(-1);
    const lastTwo = ticker.slice(-2);
    if (['P', 'W', 'U', 'R', 'Z', 'Y', 'F', 'Q'].includes(last)) return true;
    if (['WS', 'WT', 'UN', 'PR', 'PF', 'CL'].includes(lastTwo)) return true;
  }
  if (ticker.length === 4 && ['W', 'Y', 'F', 'Q'].includes(ticker.slice(-1))) return true;
  // Leveraged ETF patterns
  if (/[23][XL]/.test(ticker)) return true;
  if (ticker.endsWith('XX') || ticker.endsWith('XY')) return true;
  return false;
}

// ========== OPTIONS SIGNAL DETECTION ==========

function analyzeOptionsChain(contracts, stockPrice, ticker) {
  if (!contracts || contracts.length === 0) return null;

  const today = new Date();
  let totalCallVolume = 0;
  let totalPutVolume = 0;
  let totalCallOI = 0;
  let totalPutOI = 0;
  let otmCallVolume = 0;
  let nearTermVolume = 0;   // Expiring within 14 days
  let totalVolume = 0;
  let maxIV = 0;
  let avgIV = 0;
  let ivCount = 0;
  let highVolContracts = [];
  let strikeVolumes = {};    // Track volume per strike for dominance detection

  contracts.forEach(c => {
    const vol = c.day?.volume || 0;
    const oi = c.open_interest || 0;
    const strike = c.details?.strike_price || 0;
    const iv = c.implied_volatility || 0;
    const type = c.details?.contract_type || '';
    const daysToExpiry = c.details?.expiration_date
      ? Math.ceil((new Date(c.details.expiration_date) - today) / (1000 * 60 * 60 * 24))
      : 30;

    totalVolume += vol;

    if (type === 'call') {
      totalCallVolume += vol;
      totalCallOI += oi;
      if (strike > stockPrice * 1.02) otmCallVolume += vol;
    } else if (type === 'put') {
      totalPutVolume += vol;
      totalPutOI += oi;
    }

    if (daysToExpiry <= 14) nearTermVolume += vol;

    if (iv > 0) {
      if (iv > maxIV) maxIV = iv;
      avgIV += iv;
      ivCount++;
    }

    // Track strike-level volume
    const strikeKey = `${strike}-${type}`;
    strikeVolumes[strikeKey] = (strikeVolumes[strikeKey] || 0) + vol;

    // Hot contracts: volume >> open interest = NEW positions
    if (vol > 0 && oi > 0 && vol >= oi * 3 && vol >= 100) {
      highVolContracts.push({
        strike, type, daysToExpiry, volume: vol, oi,
        ratio: (vol / oi).toFixed(1),
        iv: (iv * 100).toFixed(0)
      });
    }
    // Brand new positions (zero OI)
    if (vol >= 500 && oi === 0) {
      highVolContracts.push({
        strike, type, daysToExpiry, volume: vol, oi: 0,
        ratio: 'NEW',
        iv: (iv * 100).toFixed(0)
      });
    }
  });

  if (ivCount > 0) avgIV = avgIV / ivCount;

  // P/C ratio
  const totalOI = totalCallOI + totalPutOI;
  const pcRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 1;

  // Near-term concentration
  const nearTermPct = totalVolume > 0 ? nearTermVolume / totalVolume : 0;

  // Single-strike dominance
  const strikeEntries = Object.entries(strikeVolumes).sort((a, b) => b[1] - a[1]);
  const topStrikeShare = totalVolume > 0 && strikeEntries.length > 0
    ? strikeEntries[0][1] / totalVolume : 0;

  // ========== SIGNAL DETECTION ==========
  const patterns = [];
  const signals = [];
  let score = 0;

  // A. Call volume >> OI — aggressive new bullish bets
  if (totalCallOI > 0 && totalCallVolume >= totalCallOI * 2.5 && totalCallVolume >= 500) {
    patterns.push('OPTIONS_UNUSUAL');
    signals.push(`Call vol ${(totalCallVolume / totalCallOI).toFixed(1)}x open interest (${totalCallVolume.toLocaleString()} vs ${totalCallOI.toLocaleString()})`);
    score += 25;
  }

  // B. Heavy OTM call buying — someone betting on a big move up
  if (otmCallVolume >= 300 && totalCallVolume > 0 && (otmCallVolume / totalCallVolume) >= 0.5) {
    patterns.push('OPTIONS_OTM_CALLS');
    signals.push(`${((otmCallVolume / totalCallVolume) * 100).toFixed(0)}% of call volume is OTM (${otmCallVolume.toLocaleString()} contracts)`);
    score += 20;
  }

  // C. IV spike — market pricing in an unannounced catalyst
  if (avgIV > 0.8) {
    patterns.push('OPTIONS_IV_SPIKE');
    signals.push(`Implied volatility ${(avgIV * 100).toFixed(0)}% (max: ${(maxIV * 100).toFixed(0)}%)`);
    score += 20;
  }

  // D. P/C ratio extreme — heavy directional bias
  if (pcRatio < 0.3 && totalCallVolume >= 500) {
    patterns.push('OPTIONS_CALL_HEAVY');
    signals.push(`P/C ratio ${pcRatio.toFixed(2)} — extremely call-heavy`);
    score += 15;
  } else if (pcRatio > 2.0 && totalPutVolume >= 500) {
    patterns.push('OPTIONS_PUT_HEAVY');
    signals.push(`P/C ratio ${pcRatio.toFixed(2)} — heavy put activity`);
    score += 15;
  }

  // E. Near-term volume concentration — expecting imminent move
  if (nearTermPct > 0.6 && totalVolume >= 500) {
    patterns.push('OPTIONS_NEAR_TERM');
    signals.push(`${(nearTermPct * 100).toFixed(0)}% of volume expires within 14 days`);
    score += 15;
  }

  // F. Single-strike dominance — targeted sweep-like bet
  if (topStrikeShare > 0.4 && totalVolume >= 300) {
    patterns.push('OPTIONS_SWEEP');
    const topStrike = strikeEntries[0][0];
    signals.push(`Single strike ($${topStrike.split('-')[0]}) accounts for ${(topStrikeShare * 100).toFixed(0)}% of volume`);
    score += 10;
  }

  // G. Hot contracts — specific high-conviction trades
  if (highVolContracts.length >= 2) {
    const top = highVolContracts.sort((a, b) => b.volume - a.volume)[0];
    signals.push(`Hot: $${top.strike} ${top.type}s — ${top.volume.toLocaleString()} vol vs ${top.oi.toLocaleString()} OI (${top.daysToExpiry}d exp)`);
    score += 10;
  }

  // Combo bonus
  if (patterns.length >= 3) score += 20;
  else if (patterns.length >= 2) score += 10;

  if (patterns.length === 0) return null;

  return {
    score,
    patterns,
    signals,
    optionsData: {
      callVolume: totalCallVolume,
      putVolume: totalPutVolume,
      callOI: totalCallOI,
      putOI: totalPutOI,
      otmCallVolume,
      pcRatio: pcRatio.toFixed(2),
      avgIV: avgIV.toFixed(4),
      maxIV: maxIV.toFixed(4),
      nearTermPct: nearTermPct.toFixed(2),
      topStrikeShare: topStrikeShare.toFixed(2),
      topContracts: highVolContracts.sort((a, b) => b.volume - a.volume).slice(0, 5),
    }
  };
}

// ========== MAIN SCAN LOGIC ==========

async function runOptionsFlowScan() {
  const startTime = Date.now();
  console.log('📡 Starting options flow scan...');

  // 1. Get market snapshot to find liquid stocks
  let snapshotData;
  try {
    snapshotData = await getAllSnapshots();
  } catch (e) {
    console.error('Failed to fetch market snapshot:', e.message);
    return { success: false, error: 'Snapshot failed' };
  }

  const allTickers = snapshotData.tickers || [];
  console.log(`📊 Market snapshot: ${allTickers.length} total tickers`);

  // 2. Filter to scannable universe
  //    - Price $3-$500 (optionable range)
  //    - Volume > 100K (liquid enough to have meaningful options)
  //    - Previous volume > 50K (not a one-day spike on a dead stock)
  //    - Not ETF/junk/mega-cap
  //    Exclude mega-caps: they ALWAYS have high options activity, so they're noise not signal
  const candidates = allTickers
    .filter(t => {
      if (isJunk(t.ticker)) return false;
      if (MEGA_CAPS.has(t.ticker)) return false;
      const price = t.day?.c || t.prevDay?.c || 0;
      const volume = t.day?.v || 0;
      const prevVol = t.prevDay?.v || 0;
      return price >= 3 && price <= 500 && volume >= 100000 && prevVol >= 50000;
    })
    // Sort by volume descending — most active stocks first
    .sort((a, b) => (b.day?.v || 0) - (a.day?.v || 0))
    // Take top 400
    .slice(0, 400);

  console.log(`🎯 Scan universe: ${candidates.length} liquid tickers (top by volume, excluding mega-caps & ETFs)`);

  // 3. Batch scan options chains
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 250; // ms between batches to respect rate limits
  const today = new Date();
  const thirtyDaysOut = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expDate = thirtyDaysOut.toISOString().split('T')[0];

  const hits = [];
  let scanned = 0;
  let errors = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (t) => {
        try {
          // Fetch calls and puts separately for better signal decomposition
          const [callData, putData] = await Promise.all([
            getOptionsChain(t.ticker, {
              contract_type: 'call',
              'expiration_date.lte': expDate,
              limit: '50'
            }),
            getOptionsChain(t.ticker, {
              contract_type: 'put',
              'expiration_date.lte': expDate,
              limit: '50'
            })
          ]);

          const allContracts = [
            ...(callData.results || []),
            ...(putData.results || [])
          ];

          if (allContracts.length === 0) return null;

          const stockPrice = t.day?.c || t.prevDay?.c || 0;
          const analysis = analyzeOptionsChain(allContracts, stockPrice, t.ticker);

          if (!analysis) return null;

          // Include stock context
          const change = t.todaysChangePerc || 0;
          const volume = t.day?.v || 0;
          const prevVol = t.prevDay?.v || 1;
          const volumeRatio = volume / prevVol;

          return {
            ticker: t.ticker,
            price: stockPrice,
            change: change.toFixed(2),
            volume,
            volumeRatio: volumeRatio.toFixed(1),
            prevClose: t.prevDay?.c || null,
            ...analysis,
          };
        } catch (e) {
          errors++;
          return null;
        }
      })
    );

    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        hits.push(r.value);
      }
    });

    scanned += batch.length;

    // Progress logging every 50 tickers
    if (scanned % 50 === 0 || i + BATCH_SIZE >= candidates.length) {
      console.log(`  Scanned ${scanned}/${candidates.length} — ${hits.length} hits so far`);
    }

    // Rate limit delay
    if (i + BATCH_SIZE < candidates.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  console.log(`📡 Scan complete: ${scanned} tickers, ${hits.length} hits, ${errors} errors, ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // 4. Sort by score and write to Firestore
  hits.sort((a, b) => b.score - a.score);

  // Log top hits
  console.log(`🏆 Top hits: ${hits.slice(0, 10).map(h =>
    `${h.ticker}(${h.score}:${h.patterns.join('+')})`
  ).join(', ')}`);

  // 5. Write to Firestore — batch write for efficiency
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const scanId = new Date().toISOString().replace(/[:.]/g, '-');

  // Write individual ticker documents (for querying by the client)
  const writeBatch = db.batch();

  // Clear old entries first (older than 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const oldDocs = await db.collection('optionsFlow')
    .where('scannedAt', '<', twoHoursAgo)
    .limit(500)
    .get();

  oldDocs.forEach(doc => writeBatch.delete(doc.ref));

  // Write new hits (top 100 to keep Firestore lean)
  const topHits = hits.slice(0, 100);
  for (const hit of topHits) {
    const docRef = db.collection('optionsFlow').doc(hit.ticker);
    writeBatch.set(docRef, {
      ...hit,
      scannedAt: new Date(),
      timestamp,
      scanId,
    }, { merge: true });
  }

  // Also write a scan summary
  const summaryRef = db.collection('optionsFlowMeta').doc('latestScan');
  writeBatch.set(summaryRef, {
    scanId,
    tickersScanned: scanned,
    hitsFound: hits.length,
    topHitsWritten: topHits.length,
    errors,
    durationMs: Date.now() - startTime,
    timestamp,
    topTickers: hits.slice(0, 20).map(h => ({
      ticker: h.ticker,
      score: h.score,
      patterns: h.patterns,
    })),
  });

  await writeBatch.commit();
  console.log(`💾 Wrote ${topHits.length} hits + scan summary to Firestore`);

  return {
    success: true,
    scanned,
    hits: hits.length,
    topHitsWritten: topHits.length,
    errors,
    durationMs: Date.now() - startTime,
    topTickers: hits.slice(0, 10).map(h => h.ticker),
  };
}

// ========== SCHEDULED FUNCTION ==========
// Runs every 30 min during market hours: 9:45 AM to 4:00 PM ET, weekdays
// Cron: minute 15,45 of hours 9-15, Mon-Fri (ET)
// 9:45, 10:15, 10:45, ..., 15:15, 15:45

exports.scanOptionsFlow = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .pubsub.schedule('15,45 9-15 * * 1-5')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    // Skip the 9:15 run — market isn't open yet, and first 15 min are noisy
    const now = new Date();
    const etHour = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
    const etMinute = now.toLocaleString('en-US', { timeZone: 'America/New_York', minute: 'numeric' });
    if (parseInt(etHour) === 9 && parseInt(etMinute) < 40) {
      console.log('⏭️ Skipping — market just opened, data too noisy');
      return null;
    }

    try {
      const result = await runOptionsFlowScan();
      console.log('✅ Scheduled scan complete:', JSON.stringify(result));
      return result;
    } catch (e) {
      console.error('❌ Scheduled scan failed:', e);
      return null;
    }
  });

// ========== MANUAL TRIGGER (for testing) ==========

exports.scanOptionsFlowManual = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    console.log('🔧 Manual options flow scan triggered');
    try {
      const result = await runOptionsFlowScan();
      return result;
    } catch (e) {
      console.error('❌ Manual scan failed:', e);
      throw new functions.https.HttpsError('internal', e.message);
    }
  });

// Export for direct Node.js testing
exports._runOptionsFlowScan = runOptionsFlowScan;
