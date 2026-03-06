// functions/scannerEngine.js
// Server-side stock scanner — ported from services/scanner.js
// Runs the same anomaly detection, options scanning, news, and AI analysis
// Used by: xAutoPost, dailyBriefing, push notifications, etc.

const admin = require('firebase-admin');
const db = admin.firestore();

const POLYGON_KEY = process.env.POLYGON_KEY;
const FINNHUB_KEY = process.env.FINNHUB_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;

// Dynamic import for node-fetch (ESM module)
const getFetch = async () => (await import('node-fetch')).default;

// ============================================================
// HELPERS
// ============================================================

const cleanCompanyName = (name) => {
  if (!name) return name;
  return name
    .replace(/,?\s*(common\s+stock|class\s+[a-z](\s+common\s+stock)?|ordinary\s+shares?|american\s+depositary\s+(shares?|receipts?)|ads|adr|warrant.*|units?|series\s+[a-z]).*$/gi, '')
    .replace(/,?\s*(inc\.?|corp\.?|ltd\.?|llc\.?|plc\.?|n\.?v\.?|s\.?a\.?|co\.?|group|holdings?|enterprises?|international|&\s*co\.?)$/gi, '')
    .replace(/,?\s*$/, '')
    .trim();
};

const stripMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^#+\s/gm, '')
    .replace(/^[-*]\s/gm, '• ');
};

// ============================================================
// ETF / JUNK FILTERS (same as client)
// ============================================================

const KNOWN_ETFS = new Set([
  'MSTX','MSTU','MSTK','XRPT','XXRP','CRPT','BITW','LABX',
  'SOXL','SOXS','TQQQ','SQQQ','UVXY','SVXY','NUGT','DUST',
  'LABU','LABD','FNGU','FNGD','SPXL','SPXS','TNA','TZA',
  'UDOW','SDOW','UPRO','SPXU','QLD','QID','DDM','DXD',
  'TSLL','TSLS','NVDL','NVDS','AMDL','AMDS',
  'ARKK','ARKW','ARKG','ARKF','ARKQ','ARKX','ARKB',
  'SPY','QQQ','IWM','DIA','VTI','VOO','IVV',
  'VEA','VWO','EFA','EEM','IEFA','IEMG',
  'XLF','XLK','XLE','XLV','XLI','XLY','XLP','XLU','XLB','XLRE',
  'VGT','VHT','VFH','VDE','VIS','VCR','VDC',
  'TLT','IEF','SHY','BND','AGG','LQD','HYG','JNK',
  'TMF','TMV','TBT','TBF',
  'VIX','VXX','VIXY','SVOL','VIXM',
  'GLD','SLV','IAU','USO','UNG',
  'SCHD','VYM','JEPI','JEPQ','QYLD','XYLD',
  'GBTC','ETHE','BITO','IBIT','FBTC',
  'MJ','MSOS','YOLO',
  'BOIL','KOLD','UCO','SCO','AGQ','ZSL','UGL','GLL',
  'NAIL','CLAW','DPST','DRIP','GUSH','RETL',
  'WEBL','WEBS','HIBL','HIBS','CURE','PILL',
  'FXI','MCHI','KWEB','EWJ','EWZ','EWY',
]);

const JUNK_TICKERS = new Set([
  'BAGY','MEMY','SOLC','OKTG','BULZ','BERZ','FNGG','FNGZ',
  'DUSL','NRGU','NRGD','OILU','OILD','MEXX','CWEB',
  'FLYU','FLYD','FNGO','WANT','PASS','SRET','TPOR','UTSL',
  'HIGH','SBAR','SPOG','SPHL',
]);

const isLikelyETF = (ticker) => {
  if (KNOWN_ETFS.has(ticker)) return true;
  if (ticker.length >= 4 && ticker.endsWith('W')) return true;
  if (ticker.endsWith('U')) return true;
  if (ticker.includes('.')) return true;
  if (/[23][XL]/.test(ticker)) return true;
  return false;
};

const isJunk = (ticker, dynamicETFs = new Set()) => {
  if (JUNK_TICKERS.has(ticker)) return true;
  if (dynamicETFs.has(ticker)) return true;
  if (isLikelyETF(ticker)) return true;
  if (ticker.length < 2 || ticker.length > 5) return true;
  if (/\d/.test(ticker)) return true;
  if (/[a-z]/.test(ticker)) return true;
  if (ticker.length === 5) {
    const lastChar = ticker.slice(-1);
    const lastTwo = ticker.slice(-2);
    if (['P','W','U','R','Z','Y','F','Q'].includes(lastChar)) return true;
    if (['WS','WT','UN','PR','PF','CL'].includes(lastTwo)) return true;
  }
  if (ticker.length === 4 && ['W','Y','F','Q'].includes(ticker.slice(-1))) return true;
  return false;
};

const isNameJunk = (name) => {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes(' etf') || n.includes(' etn') || n.includes('direxion') ||
    n.includes('proshares') || n.includes('graniteshares') || n.includes('leveraged') ||
    n.includes('inverse') || n.includes('ishares') || n.includes('spdr ') ||
    n.includes('vanguard ') || n.includes('wisdomtree') || n.includes('first trust') ||
    n.includes('invesco ') || n.includes('global x ') || n.includes('vaneck') ||
    n.includes('depositary') || n.includes('preferred') || n.includes('grayscale') ||
    n.includes('% notes') || n.includes('trust units') ||
    n.includes(' 2x') || n.includes(' 3x');
};

const isLikelySPAC = (name) => {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('acquisition corp') || n.includes('blank check') || n.includes('merger corp') || /\bspac\b/.test(n);
};

const isDebtInstrument = (name) => {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes(' bonds') || n.includes('debenture') || n.includes('notes due') ||
    n.includes('% senior') || n.includes('convertible note') || n.includes('floating rate');
};

// ============================================================
// POLYGON API HELPERS (direct server-side calls)
// ============================================================

const polygonFetch = async (path, params = {}) => {
  const fetch = await getFetch();
  const url = new URL(`https://api.polygon.io${path}`);
  params.apiKey = POLYGON_KEY;
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  return res.json();
};

const polygonAllSnapshots = () => polygonFetch('/v2/snapshot/locale/us/markets/stocks/tickers');
const polygonSnapshot = (tickers) => polygonFetch('/v2/snapshot/locale/us/markets/stocks/tickers', { tickers: tickers.join(',') });
const polygonGainers = () => polygonFetch('/v2/snapshot/locale/us/markets/stocks/gainers');
const polygonTickerDetails = (ticker) => polygonFetch(`/v3/reference/tickers/${ticker}`);
const polygonOptions = (ticker, params) => polygonFetch(`/v3/snapshot/options/${ticker}`, params);
const polygonNews = (params) => polygonFetch('/v2/reference/news', params);

const finnhubNews = async (ticker, from, to) => {
  const fetch = await getFetch();
  const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
  const res = await fetch(url);
  return res.json();
};

const geminiGenerate = async (prompt) => {
  const fetch = await getFetch();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
      }),
    }
  );
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

// ============================================================
// SCORING (same as client)
// ============================================================

const scoreAnomaly = (patterns) => {
  let score = 0;
  if (patterns.includes('PRE_MOVE')) score += 50;
  if (patterns.includes('INSTITUTIONAL_FOOTPRINT')) score += 45;
  if (patterns.includes('QUIET_ACCUMULATION')) score += 40;
  if (patterns.includes('VOLUME_SPIKE')) score += 35;
  if (patterns.includes('SECTOR_DIVERGENCE')) score += 35;
  if (patterns.includes('OPTIONS_UNUSUAL')) score += 50;
  if (patterns.includes('OPTIONS_IV_SPIKE')) score += 40;
  if (patterns.includes('OPTIONS_OTM_CALLS')) score += 45;
  if (patterns.includes('BREAKOUT_52W')) score += 25;
  if (patterns.includes('MOMENTUM')) score += 15;
  if (patterns.length >= 3) score += 25;
  else if (patterns.length >= 2) score += 10;
  return score;
};

const scoreSentiment = (change, patterns, optionsData = null) => {
  let score = 0;
  const c = parseFloat(change) || 0;
  if (c > 2) score += 3;
  else if (c > 0.5) score += 2;
  else if (c > -0.3) score += 1;
  else if (c > -2) score -= 1;
  else score -= 3;
  if (patterns.includes('QUIET_ACCUMULATION') && c >= -0.5) score += 2;
  if (patterns.includes('INSTITUTIONAL_FOOTPRINT') && c >= -0.3) score += 2;
  if (patterns.includes('BREAKOUT_52W')) score += 3;
  if (patterns.includes('MOMENTUM')) score += (c >= 0 ? 2 : -2);
  if (patterns.includes('VOLUME_SPIKE')) score += (c >= 0 ? 1 : -1);
  if (patterns.includes('OPTIONS_UNUSUAL')) score += 2;
  if (patterns.includes('OPTIONS_OTM_CALLS')) score += 2;
  if (optionsData?.callVolume > 0) score += 1;
  if (patterns.includes('PRE_MOVE')) score += 2;
  if (score >= 3) return 'BULLISH';
  if (score <= -2) return 'BEARISH';
  return 'NEUTRAL';
};

// ============================================================
// SECTOR MAPPING
// ============================================================

const SECTOR_ETFS = {
  'XLK': 'Technology', 'XLF': 'Financials', 'XLE': 'Energy',
  'XLV': 'Healthcare', 'XLI': 'Industrials', 'XLY': 'Consumer Discretionary',
  'XLP': 'Consumer Staples', 'XLU': 'Utilities', 'XLB': 'Materials',
  'XLRE': 'Real Estate', 'XLC': 'Communication'
};

const sicToSector = (sic) => {
  if (!sic) return null;
  const s = sic.toLowerCase();
  if (s.includes('software') || s.includes('computer') || s.includes('semiconductor') || s.includes('electronic')) return 'XLK';
  if (s.includes('bank') || s.includes('financ') || s.includes('insurance') || s.includes('invest')) return 'XLF';
  if (s.includes('oil') || s.includes('gas') || s.includes('petrol') || s.includes('energy') || s.includes('mining')) return 'XLE';
  if (s.includes('pharma') || s.includes('biotech') || s.includes('medical') || s.includes('health') || s.includes('surgical')) return 'XLV';
  if (s.includes('aerospace') || s.includes('defense') || s.includes('manufactur') || s.includes('machinery')) return 'XLI';
  if (s.includes('retail') || s.includes('restaurant') || s.includes('hotel') || s.includes('apparel')) return 'XLY';
  if (s.includes('food') || s.includes('beverage') || s.includes('tobacco')) return 'XLP';
  if (s.includes('electric') || s.includes('utilit') || s.includes('water supply')) return 'XLU';
  if (s.includes('chemical') || s.includes('steel') || s.includes('paper')) return 'XLB';
  if (s.includes('real estate') || s.includes('reit')) return 'XLRE';
  if (s.includes('telecom') || s.includes('broadcast') || s.includes('media')) return 'XLC';
  return null;
};

// ============================================================
// MAIN SCANNER — server-side version
// ============================================================

async function runScanner(options = {}) {
  const { priceMin = 5, priceMax = 500, maxResults = 5 } = options;
  console.log(`🔍 SERVER SCANNER — price: $${priceMin}-$${priceMax}, max: ${maxResults}`);

  const movers = new Map();
  let allSnapshotTickers = [];

  // ========== STEP 1: MARKET SNAPSHOT + SECTOR ETFs ==========
  console.log('📊 Step 1: Fetching market snapshot...');

  let sectorPerf = {};
  let spyChange = 0;

  // Time-of-day volume normalization
  const now = new Date();
  const etHour = now.getUTCHours() - 5;
  const etMinute = now.getUTCMinutes();
  const marketOpenMin = 9 * 60 + 30;
  const marketCloseMin = 16 * 60;
  const currentMin = etHour * 60 + etMinute;
  const totalMarketMinutes = marketCloseMin - marketOpenMin;
  const elapsedMinutes = Math.max(1, Math.min(totalMarketMinutes, currentMin - marketOpenMin));
  const dayFraction = elapsedMinutes / totalMarketMinutes;
  const isMarketHours = currentMin >= marketOpenMin && currentMin <= marketCloseMin;
  const volFloor = isMarketHours ? Math.max(25000, Math.round(100000 * dayFraction)) : 100000;

  let isNonTradingDay = false;

  const getPrice = (t) => isNonTradingDay ? (t.prevDay?.c || 0) : (t.day?.c || t.prevDay?.c || 0);
  const getVolume = (t) => isNonTradingDay ? (t.prevDay?.v || 0) : (t.day?.v || 0);
  const getChange = (t) => {
    if (isNonTradingDay) {
      const pc = t.prevDay?.c || 0;
      const po = t.prevDay?.o || pc;
      return po > 0 ? ((pc - po) / po * 100) : 0;
    }
    return t.todaysChangePerc || ((t.day?.c - t.prevDay?.c) / (t.prevDay?.c || 1) * 100);
  };
  const getPrevVolume = (t) => isNonTradingDay ? (t.prevDay?.v || 1) : (t.prevDay?.v || 1);

  try {
    const [snapshotData, sectorData] = await Promise.all([
      polygonAllSnapshots(),
      polygonSnapshot(['SPY', ...Object.keys(SECTOR_ETFS)])
    ]);

    // Detect non-trading day
    const spyTicker = sectorData.tickers?.find(t => t.ticker === 'SPY');
    isNonTradingDay = (spyTicker?.day?.v || 0) === 0;
    if (isNonTradingDay) console.log('📅 Non-trading day detected');

    sectorData.tickers?.forEach(t => {
      const change = getChange(t);
      if (t.ticker === 'SPY') spyChange = change;
      else sectorPerf[t.ticker] = change;
    });

    allSnapshotTickers = snapshotData.tickers || [];

    // Pattern detection on each stock
    snapshotData.tickers?.forEach(t => {
      if (isJunk(t.ticker)) return;
      const price = getPrice(t);
      const change = getChange(t);
      const volume = getVolume(t);
      const prevVolume = getPrevVolume(t);
      const projectedVolume = (!isNonTradingDay && isMarketHours) ? volume / dayFraction : volume;
      const volumeRatio = isNonTradingDay ? 1 : (projectedVolume / prevVolume);
      const high52 = t.max52Week?.high;
      const absChange = Math.abs(change || 0);

      if (!price || price < priceMin || price > priceMax) return;
      const effectiveVolFloor = isNonTradingDay ? 50000 : volFloor;
      if (volume < effectiveVolFloor) return;
      if (!isNonTradingDay && prevVolume < 20000) return;

      const patterns = [];
      const triggers = [];

      if (isNonTradingDay) {
        if (absChange >= 4 && volume >= 200000) { patterns.push('MOMENTUM'); triggers.push(`[MOMENTUM] ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`); }
        if (absChange >= 2 && volume >= 500000) { patterns.push('VOLUME_SPIKE'); triggers.push(`[VOLUME] ${(volume / 1e6).toFixed(1)}M shares`); }
        if (high52 && price && ((high52 - price) / high52 * 100) <= 3 && volume >= 100000) { patterns.push('BREAKOUT_52W'); triggers.push('[BREAKOUT] Near 52w high'); }
        if (absChange < 1.5 && volume >= 500000) { patterns.push('QUIET_ACCUMULATION'); triggers.push('[ACCUMULATION] Tight range, heavy vol'); }
      } else {
        if (volumeRatio >= 3 && absChange < 2) { patterns.push('INSTITUTIONAL_FOOTPRINT'); triggers.push(`[FOOTPRINT] ${volumeRatio.toFixed(1)}x vol, ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`); }
        if (absChange < 1.5 && volumeRatio >= 2.5 && volume >= (isMarketHours ? Math.max(50000, 200000 * dayFraction) : 200000)) { patterns.push('QUIET_ACCUMULATION'); triggers.push(`[ACCUMULATION] ${volumeRatio.toFixed(1)}x vol`); }
        if (volumeRatio >= 5) { patterns.push('VOLUME_SPIKE'); triggers.push(`[VOLUME] ${volumeRatio.toFixed(1)}x avg`); }
        if (high52 && price && ((high52 - price) / high52 * 100) <= 3 && volumeRatio >= 1.5) { patterns.push('BREAKOUT_52W'); triggers.push('[BREAKOUT] Near 52w high on volume'); }
        if (absChange >= 4 && volumeRatio >= 2) { patterns.push('MOMENTUM'); triggers.push(`[MOMENTUM] ${change >= 0 ? '+' : ''}${change.toFixed(1)}% on ${volumeRatio.toFixed(1)}x vol`); }
      }

      if (patterns.length === 0) return;

      movers.set(t.ticker, {
        price, change: change || 0, volume, volumeRatio: volumeRatio.toFixed(1),
        anomalyScore: scoreAnomaly(patterns), patterns: [...patterns],
        trigger: triggers.join(' • '), triggerType: patterns[0].toLowerCase(),
        sentiment: scoreSentiment(change, patterns), source: 'anomaly'
      });
    });
    console.log(`✓ Snapshot: ${movers.size} stocks with anomaly patterns`);
  } catch (e) {
    console.log('Snapshot scan failed:', e.message);
  }

  // ========== STEP 1.5: SECTOR CORRELATION ==========
  console.log('🔀 Step 1.5: Sector correlations...');
  const topForCorrelation = [...movers.entries()]
    .sort((a, b) => b[1].anomalyScore - a[1].anomalyScore)
    .slice(0, 50);

  for (let i = 0; i < topForCorrelation.length; i += 10) {
    const batch = topForCorrelation.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async ([ticker]) => {
        try {
          const data = await polygonTickerDetails(ticker);
          return { ticker, sic: data.results?.sic_description || null };
        } catch { return { ticker, sic: null }; }
      })
    );
    results.forEach(({ ticker, sic }) => {
      const stock = movers.get(ticker);
      if (!stock) return;
      stock.sic = sic;
      const sectorETF = sicToSector(sic);
      if (sectorETF && sectorPerf[sectorETF] !== undefined) {
        const sectorChange = sectorPerf[sectorETF];
        const stockChange = parseFloat(stock.change) || 0;
        if ((stockChange > 0.5 && sectorChange < -0.5) || (stockChange < -0.5 && sectorChange > 0.5)) {
          if (Math.abs(stockChange - sectorChange) >= 2) {
            stock.patterns.push('SECTOR_DIVERGENCE');
            stock.sectorETF = sectorETF;
            stock.sectorChange = sectorChange;
            stock.anomalyScore = scoreAnomaly(stock.patterns);
          }
        }
      }
    });
    if (i + 10 < topForCorrelation.length) await new Promise(r => setTimeout(r, 50));
  }

  // ========== STEP 2: OPTIONS SCANNING ==========
  console.log('📞 Step 2: Options scanning...');
  const topForOptions = [...movers.entries()]
    .sort((a, b) => b[1].anomalyScore - a[1].anomalyScore)
    .slice(0, 30)
    .map(([ticker]) => ticker);

  let optionsHits = 0;
  for (let i = 0; i < topForOptions.length; i += 5) {
    const batch = topForOptions.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        try {
          const today = new Date();
          const expDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const data = await polygonOptions(ticker, { contract_type: 'call', 'expiration_date.lte': expDate, limit: '50' });
          const contracts = data.results || [];
          if (contracts.length === 0) return { ticker, hasUnusual: false };

          const stock = movers.get(ticker);
          const stockPrice = stock?.price || 0;
          let totalCallVolume = 0, totalOpenInterest = 0, otmCallVolume = 0, avgIV = 0, ivCount = 0, highVolContracts = [];

          contracts.forEach(c => {
            const vol = c.day?.volume || 0;
            const oi = c.open_interest || 0;
            const strike = c.details?.strike_price || 0;
            const iv = c.implied_volatility || 0;
            const daysToExpiry = c.details?.expiration_date ? Math.ceil((new Date(c.details.expiration_date) - today) / 86400000) : 30;
            totalCallVolume += vol;
            totalOpenInterest += oi;
            if (iv > 0) { avgIV += iv; ivCount++; }
            if (strike > stockPrice * 1.02) otmCallVolume += vol;
            if (vol > 0 && oi > 0 && vol >= oi * 3 && vol >= 100)
              highVolContracts.push({ strike, daysToExpiry, volume: vol, oi, ratio: (vol / oi).toFixed(1) });
            if (vol >= 500 && oi === 0)
              highVolContracts.push({ strike, daysToExpiry, volume: vol, oi: 0, ratio: 'NEW' });
          });

          if (ivCount > 0) avgIV = avgIV / ivCount;
          const optionsPatterns = [];
          if (totalOpenInterest > 0 && totalCallVolume >= totalOpenInterest * 2 && totalCallVolume >= 1000) optionsPatterns.push('OPTIONS_UNUSUAL');
          if (otmCallVolume >= 500 && totalCallVolume > 0 && (otmCallVolume / totalCallVolume) >= 0.6) optionsPatterns.push('OPTIONS_OTM_CALLS');
          if (avgIV > 0.8) optionsPatterns.push('OPTIONS_IV_SPIKE');

          return {
            ticker, hasUnusual: optionsPatterns.length > 0, optionsPatterns,
            totalCallVolume, totalOpenInterest, otmCallVolume, avgIV,
            highVolContracts: highVolContracts.slice(0, 3)
          };
        } catch { return { ticker, hasUnusual: false }; }
      })
    );

    batchResults.forEach(result => {
      if (!result.hasUnusual) return;
      const stock = movers.get(result.ticker);
      if (!stock) return;
      stock.patterns.push(...result.optionsPatterns);
      stock.anomalyScore = scoreAnomaly(stock.patterns);
      stock.optionsData = {
        callVolume: result.totalCallVolume, openInterest: result.totalOpenInterest,
        otmCallVolume: result.otmCallVolume, avgIV: result.avgIV,
        topContracts: result.highVolContracts
      };
      stock.sentiment = scoreSentiment(stock.change, stock.patterns, stock.optionsData);
      optionsHits++;
    });
    if (i + 5 < topForOptions.length) await new Promise(r => setTimeout(r, 100));
  }
  console.log(`📞 Options anomalies: ${optionsHits}`);

  // ========== STEP 2b: OPTIONS FLOW CACHE (from Cloud Function scanner) ==========
  console.log('📡 Step 2b: Loading options flow cache...');
  let optionsFirstHits = 0;
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const flowSnap = await db.collection('optionsFlow')
      .where('scannedAt', '>', oneHourAgo)
      .orderBy('scannedAt', 'desc')
      .limit(100)
      .get();

    if (flowSnap.size > 0) {
      flowSnap.forEach(doc => {
        const cached = doc.data();
        const ticker = cached.ticker;
        if (movers.has(ticker)) {
          const existing = movers.get(ticker);
          if (!existing.optionsData && cached.optionsData) {
            existing.optionsData = {
              callVolume: cached.optionsData.callVolume || 0,
              openInterest: cached.optionsData.callOI || 0,
              otmCallVolume: cached.optionsData.otmCallVolume || 0,
              avgIV: parseFloat(cached.optionsData.avgIV) || 0,
              topContracts: cached.optionsData.topContracts || [],
            };
            (cached.patterns || []).forEach(p => { if (!existing.patterns.includes(p)) existing.patterns.push(p); });
            existing.anomalyScore = scoreAnomaly(existing.patterns);
          }
          return;
        }
        const price = cached.price || 0;
        if (price < priceMin || price > priceMax) return;
        if ((cached.score || 0) < 25) return;
        const absChange = Math.abs(parseFloat(cached.change) || 0);
        const patterns = [...(cached.patterns || [])];
        if (absChange < 2) patterns.unshift('PRE_MOVE');
        movers.set(ticker, {
          price, change: parseFloat(cached.change) || 0, volume: cached.volume || 0,
          volumeRatio: cached.volumeRatio || '1.0',
          anomalyScore: scoreAnomaly(patterns) + (absChange < 2 ? 20 : 0),
          patterns, trigger: (cached.signals || []).join(' • '),
          triggerType: 'options_first',
          sentiment: scoreSentiment(cached.change, patterns),
          optionsData: {
            callVolume: cached.optionsData?.callVolume || 0,
            openInterest: cached.optionsData?.callOI || 0,
            otmCallVolume: cached.optionsData?.otmCallVolume || 0,
            avgIV: parseFloat(cached.optionsData?.avgIV) || 0,
            topContracts: cached.optionsData?.topContracts || [],
          },
          source: 'options_discovery',
        });
        optionsFirstHits++;
      });
      console.log(`🎯 Options flow cache: ${optionsFirstHits} signals`);
    }
  } catch (e) {
    console.log('Options flow cache failed:', e.message);
  }

  // ========== STEP 2c: MERGE GAINERS ==========
  try {
    const data = await polygonGainers();
    data.tickers?.forEach(t => {
      const price = getPrice(t);
      const change = getChange(t);
      const volume = getVolume(t);
      const prevVolume = getPrevVolume(t);
      const projectedVol = (!isNonTradingDay && isMarketHours) ? volume / dayFraction : volume;
      const volumeRatio = isNonTradingDay ? 1 : (projectedVol / prevVolume);
      if (price >= priceMin && price <= priceMax && !isJunk(t.ticker) && volume >= (isNonTradingDay ? 50000 : volFloor)) {
        if (!movers.get(t.ticker)) {
          const patterns = ['MOMENTUM'];
          if (!isNonTradingDay && volumeRatio >= 5) patterns.push('VOLUME_SPIKE');
          movers.set(t.ticker, {
            price, change: change || 0, volume, volumeRatio: volumeRatio.toFixed(1),
            anomalyScore: scoreAnomaly(patterns), patterns,
            trigger: `[GAINER] +${change?.toFixed(1)}%`,
            triggerType: 'gainer', sentiment: scoreSentiment(change, patterns), source: 'anomaly'
          });
        }
      }
    });
    console.log(`✓ Gainers merged, total: ${movers.size}`);
  } catch (e) { console.log('Gainers failed:', e.message); }

  if (movers.size === 0) return { stocks: [], total: 0 };

  // ========== STEP 3: NEWS + COMPANY CONTEXT ==========
  console.log('📰 Step 3: Fetching news...');
  const sortedByAnomaly = [...movers.entries()]
    .sort((a, b) => b[1].anomalyScore - a[1].anomalyScore)
    .slice(0, 60);

  const withData = [];
  for (let i = 0; i < sortedByAnomaly.length; i += 10) {
    const batch = sortedByAnomaly.slice(i, i + 10);
    const batchResults = await Promise.all(
      batch.map(async ([ticker, data]) => {
        try {
          const twoDaysAgo = new Date(Date.now() - 48 * 3600000).toISOString().split('T')[0];
          const newsRes = await polygonNews({ ticker, limit: '5', 'published_utc.gte': twoDaysAgo, order: 'desc', sort: 'published_utc' });
          const articles = newsRes?.results || [];
          // Also fetch company details
          let name = ticker, industry = '';
          try {
            const details = await polygonTickerDetails(ticker);
            name = details.results?.name || ticker;
            industry = details.results?.sic_description || '';
          } catch {}
          return {
            ticker, ...data, name: cleanCompanyName(name), industry,
            hasRecentNews: articles.length > 0,
            headline: articles[0]?.title || null,
            newsSource: articles[0]?.publisher?.name || null,
            news: articles.slice(0, 3),
          };
        } catch {
          return { ticker, ...data, name: ticker, industry: '', hasRecentNews: false, news: [] };
        }
      })
    );
    withData.push(...batchResults);
    if (i + 10 < sortedByAnomaly.length) await new Promise(r => setTimeout(r, 100));
  }

  // ========== STEP 4: TIER SPLIT ==========
  let preMoveSignals = withData.filter(s => s.source === 'options_discovery' && !s.hasRecentNews).sort((a, b) => b.anomalyScore - a.anomalyScore);
  let earlySignals = withData.filter(s => s.source !== 'options_discovery' && !s.hasRecentNews && s.anomalyScore >= 20).sort((a, b) => b.anomalyScore - a.anomalyScore);
  let catalystStocks = withData.filter(s => s.hasRecentNews).sort((a, b) => b.anomalyScore - a.anomalyScore);

  console.log(`🎯 Pre-Move: ${preMoveSignals.length} | Early: ${earlySignals.length} | Catalyst: ${catalystStocks.length}`);

  // ========== STEP 5: AI ANALYSIS ==========
  console.log('🤖 Step 5: AI analysis...');
  const allCandidates = [...preMoveSignals.slice(0, 5), ...earlySignals.slice(0, 10), ...catalystStocks.slice(0, 10)];
  
  if (allCandidates.length > 0) {
    try {
      const input = allCandidates.map((s, i) => {
        const parts = [`${s.ticker} (${s.name}${s.industry ? ' — ' + s.industry : ''})`];
        parts.push(`${s.change >= 0 ? '+' : ''}${(s.change || 0).toFixed(1)}%, vol: ${s.volumeRatio}x`);
        parts.push(`signals: ${(s.patterns || []).join(', ')}`);
        if (s.optionsData) {
          const ratio = (s.optionsData.callVolume / Math.max(s.optionsData.openInterest, 1)).toFixed(1);
          parts.push(`calls: ${s.optionsData.callVolume?.toLocaleString()} vol (${ratio}x OI)`);
          if (s.optionsData.avgIV > 0) parts.push(`IV: ${(s.optionsData.avgIV * 100).toFixed(0)}%`);
          if (s.optionsData.topContracts?.[0]) {
            const tc = s.optionsData.topContracts[0];
            parts.push(`hot: $${tc.strike} calls, ${tc.volume} vol, ${tc.daysToExpiry}d out`);
          }
        }
        if (s.hasRecentNews && s.headline) parts.push(`news: "${s.headline}"`);
        if (s.sectorETF) parts.push(`sector ${s.sectorETF}: ${s.sectorChange >= 0 ? '+' : ''}${s.sectorChange?.toFixed(1)}%`);
        return `${i + 1}. ${parts.join(' | ')}`;
      }).join('\n');

      const aiText = await geminiGenerate(
        `You are a stock market analyst writing for active traders. For each stock, write a 30-45 word narrative.

If the stock has NEWS: Lead with specific catalyst details (drug names, deal sizes, earnings numbers), then explain the technical confirmation.
If NO news: Describe what the data shows and theorize what smart money might be positioning for.

RULES:
- Name the company first
- Use specific numbers from data
- Two parts separated by " — "
- Never say "unusual activity detected" — be specific
- Industry-appropriate theories (biotech=trial data, bank=M&A, defense=contracts)

Stocks:
${input}

Return ONLY a numbered list:
1. [insight]
...`
      );

      const lines = aiText.split('\n');
      const analyses = [];
      let current = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^\d+[\.\)]\s/.test(trimmed)) {
          if (current) analyses.push(current);
          current = trimmed.replace(/^\d+[\.\)]\s*/, '').trim();
        } else if (trimmed && current) {
          current += ' ' + trimmed;
        }
      }
      if (current) analyses.push(current);

      allCandidates.forEach((stock, i) => {
        stock.catalyst = (analyses[i] && analyses[i].length > 10) ? stripMarkdown(analyses[i].replace(/^["']|["']$/g, '')) : `${stock.name}: ${stock.trigger}`;
        stock.catalystType = stock.source === 'options_discovery' ? 'options_first' : stock.hasRecentNews ? 'news' : 'early_signal';
      });
      console.log(`🤖 AI analyzed ${analyses.length} stocks`);
    } catch (e) {
      console.log('AI analysis failed:', e.message);
      allCandidates.forEach(stock => {
        stock.catalyst = `${stock.name}: ${stock.trigger}`;
        stock.catalystType = stock.hasRecentNews ? 'news' : 'early_signal';
      });
    }
  }

  // ========== STEP 6: SCORE, FILTER, RETURN TOP N ==========
  console.log('✅ Step 6: Final scoring...');
  const scored = allCandidates
    .filter(s => !isNameJunk(s.name) && !isLikelySPAC(s.name) && !isDebtInstrument(s.name))
    .map(s => {
      const tierBonus = s.catalystType === 'options_first' ? 40 : s.catalystType === 'early_signal' ? 30 : 0;
      return { ...s, finalScore: (s.anomalyScore || 0) + tierBonus };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  const results = scored.slice(0, maxResults).map(s => ({
    ticker: s.ticker,
    name: s.name,
    industry: s.industry || '',
    price: s.price,
    change: s.change,
    volume: s.volume,
    volumeRatio: s.volumeRatio,
    patterns: s.patterns,
    catalyst: s.catalyst,
    catalystType: s.catalystType,
    sentiment: s.sentiment,
    anomalyScore: s.anomalyScore,
    optionsData: s.optionsData || null,
    headline: s.headline || null,
  }));

  console.log(`✅ Scanner complete: ${results.length} stocks from ${movers.size} candidates`);
  results.forEach(s => console.log(`  ${s.ticker} (${s.anomalyScore}) ${s.catalystType}: ${s.catalyst?.slice(0, 80)}`));

  return { stocks: results, total: movers.size, spyChange };
}

module.exports = { runScanner };
