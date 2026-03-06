// functions/xAutoPost.js
// X (Twitter) auto-posting — uses real scanner engine for authentic results

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { TwitterApi } = require('twitter-api-v2');
const { runScanner } = require('./scannerEngine');

const X_API_KEY = process.env.X_API_KEY;
const X_API_SECRET = process.env.X_API_SECRET;
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;
const POLYGON_KEY = process.env.POLYGON_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;

const db = admin.firestore();

const getTwitterClient = () => {
  return new TwitterApi({
    appKey: X_API_KEY,
    appSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_TOKEN_SECRET,
  });
};

// ============================================================
// QUALITY GATE — skip posting weak scans
// ============================================================

const evaluatePostQuality = (stocks, spyChange) => {
  if (!stocks || stocks.length === 0) return { shouldPost: false, reason: 'no stocks' };

  const topMove = Math.max(...stocks.map(s => Math.abs(s.change || 0)));
  const hasCatalyst = stocks.some(s => s.catalyst && s.catalyst.length > 10);
  const highVolume = stocks.some(s => (s.volumeRatio || 0) >= 2);
  const counterTrend = spyChange < -1 && stocks.some(s => s.change > 1);
  const bigMover = topMove >= 3;

  // Score the scan — need at least 3 to be worth tweeting
  let score = 0;
  if (bigMover) score += 3;
  else if (topMove >= 2) score += 1;
  if (hasCatalyst) score += 2;
  if (highVolume) score += 1;
  if (counterTrend) score += 2;

  if (score < 1) {
    return { shouldPost: false, reason: `low quality (score ${score}/9, need 1)`, score };
  }

  // Context tags tell Gemini what angle to take
  const tags = [];
  if (counterTrend) tags.push('COUNTER_TREND');
  if (bigMover) tags.push('BIG_MOVER');
  if (highVolume) tags.push('HIGH_VOLUME');
  if (hasCatalyst) tags.push('CATALYST_DRIVEN');

  return { shouldPost: true, score, tags };
};

// ============================================================
// HELPERS
// ============================================================

const isDuplicate = async (type) => {
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const snap = await db.collection('xPosts')
    .where('type', '==', type)
    .where('postedAt', '>', cutoff)
    .limit(1)
    .get();
  return !snap.empty;
};

const logPost = async (type, tweetText, tweetId, metadata = {}) => {
  await db.collection('xPosts').add({
    type,
    tweetText,
    tweetId,
    postedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...metadata,
  });
};

// Strip emojis we never want in tweets
const BANNED_EMOJIS = /\u{1F916}|\u{1F6A8}|\u{1F525}|\u{1F680}|\u{1F4B0}|\u{1F911}|\u{1F4AF}/gu;
// 🤖 robot, 🚨 siren, 🔥 fire, 🚀 rocket, 💰 money bag, 🤑 money face, 💯 hundred
const sanitizeEmojis = (text) => text.replace(BANNED_EMOJIS, '').replace(/  +/g, ' ').trim();

const generateTweet = async (prompt) => {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.8 },
      }),
    }
  );
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
};

// Fallback tweet formatters — used when Gemini fails
const buildFallbackMorningTweet = (stocks) => {
  // Pick the top 2 most interesting stocks
  const top = [...stocks]
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 2);
  const lines = [];
  top.forEach(s => {
    const changeStr = s.change >= 0 ? `+${s.change.toFixed(1)}` : s.change.toFixed(1);
    const catalyst = s.catalyst ? ` — ${s.catalyst.slice(0, 60)}` : '';
    lines.push(`$${s.ticker} ${changeStr}%${catalyst}`);
  });
  lines.push(`\nScanner flagged ${stocks.length} movers pre-market.`);
  lines.push('jckrbbt.io');
  return lines.join('\n');
};

const buildFallbackCloseTweet = (results) => {
  const wins = results.filter(r => r.hit).length;
  const best = [...results].sort((a, b) => parseFloat(b.endChange) - parseFloat(a.endChange))[0];
  const lines = [`${wins}/${results.length} morning picks held by close.`];
  if (best) {
    lines.push(`$${best.ticker} led at ${best.endChange > 0 ? '+' : ''}${best.endChange}%.`);
  }
  lines.push('jckrbbt.io');
  return lines.join('\n');
};

// ============================================================
// MORNING SCAN POST — 9:35 AM ET weekdays
// Uses the REAL scanner engine (same as the app)
// ============================================================

exports.postMorningScan = functions
  .runWith({ timeoutSeconds: 300, memory: '512MB', secrets: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"] })
  .pubsub
  .schedule('35 9 * * 1-5')
  .timeZone('America/New_York')
  .onRun(async () => {
    try {
      if (await isDuplicate('morning_scan')) {
        console.log('Morning scan already posted recently, skipping');
        return null;
      }

      // Run the REAL scanner — same engine as the app
      console.log('\u{1F50D} Running full scanner for morning tweet...');
      const scanResult = await runScanner({ priceMin: 5, priceMax: 500, maxResults: 5 });
      const stocks = scanResult.stocks || [];

      if (stocks.length === 0) {
        console.log('No stocks found, skipping morning post');
        return null;
      }

      console.log(`\u{1F4CA} Scanner returned ${stocks.length} stocks: ${stocks.map(s => s.ticker).join(', ')}`);

      // Quality gate — don't tweet weak scans
      const spyChange = scanResult.spyChange || 0;
      const quality = evaluatePostQuality(stocks, spyChange);
      if (!quality.shouldPost) {
        console.log(`\u26D4 Skipping morning post: ${quality.reason}`);
        return null;
      }
      console.log(`\u2705 Quality gate passed (score ${quality.score}), tags: ${quality.tags.join(', ')}`);

      // Sort: biggest absolute movers with catalysts first
      const ranked = [...stocks].sort((a, b) => {
        const aScore = Math.abs(a.change || 0) + (a.catalyst ? 2 : 0) + ((a.volumeRatio || 0) >= 2 ? 1 : 0);
        const bScore = Math.abs(b.change || 0) + (b.catalyst ? 2 : 0) + ((b.volumeRatio || 0) >= 2 ? 1 : 0);
        return bScore - aScore;
      });

      // Build rich per-stock data for Gemini to clean up into one-liners
      const stocksForPrompt = ranked.slice(0, 5).map(s => {
        const parts = [`$${s.ticker} (${s.name})`];
        parts.push(`Pre-market: ${s.change >= 0 ? '+' : ''}${s.change.toFixed(1)}%`);
        parts.push(`Volume: ${s.volumeRatio}x avg`);
        if (s.catalyst) parts.push(`Unusual Activity: ${s.catalyst.slice(0, 200)}`);
        if (s.catalystType) parts.push(`Type: ${s.catalystType}`);
        if (s.patterns && s.patterns.length) parts.push(`Technicals: ${s.patterns.join(', ')}`);
        if (s.optionsData && s.optionsData.callVolume) parts.push(`Options: ${s.optionsData.callVolume.toLocaleString()} calls`);
        if (s.sentiment) parts.push(`Sentiment: ${s.sentiment}`);
        return parts.join(' | ');
      });

      // Dynamic market context line
      let marketContext = '';
      if (quality.tags.includes('COUNTER_TREND')) {
        marketContext = `Market context: SPY ${spyChange.toFixed(1)}% — these names are bucking the trend.`;
      } else if (spyChange >= 0.5) {
        marketContext = `Market context: SPY +${spyChange.toFixed(1)}% — risk-on tape.`;
      } else if (spyChange <= -0.5) {
        marketContext = `Market context: SPY ${spyChange.toFixed(1)}% — defensive tape, these names still showing strength.`;
      } else {
        marketContext = `Market context: SPY ${spyChange >= 0 ? '+' : ''}${spyChange.toFixed(1)}% (flat).`;
      }

      const prompt = `You write posts for JCKRBBT, an AI stock scanner for retail traders.

Your job: Format a clean pre-market watchlist tweet. Write it EXACTLY in this structure — no deviations.

SCANNER DATA (${stocksForPrompt.length} stocks flagged pre-market):
${stocksForPrompt.map((s, i) => `[Stock ${i + 1}]\n${s}`).join('\n\n')}

${marketContext}

OUTPUT FORMAT — follow this exactly:
Line 1: "What we're keeping an eye on today based on our pre-market scan:"
Line 2: blank
Lines 3-7: One line per stock, format: $TICKER: [one clean sentence distilling the Unusual Activity — what it is, why it matters, keep it punchy and specific. Max 80 chars per line.]
Line 8: blank
Line 9: "Follow for updates throughout the day on what's moving."
Line 10: "jckrbbt.io"

RULES for the per-stock lines:
- Use the Unusual Activity/catalyst data — rewrite it into ONE clean sentence, do not copy it verbatim
- Be specific: "$NVDA: Options flow spiking ahead of earnings, 3x avg call volume" not "$NVDA: Unusual activity detected"
- If no clear catalyst, say what the technical signal is: "$XYZ: Breaking above 50-day MA on 2x volume, pre-market momentum"
- No emojis. No hashtags. No exclamation marks. No quotes around the output.
- Tone: like a sharp trader texting their group chat, not a brand account

BAD line: "$FWRG: Unusual Activity Detected — something is happening with this stock today"
GOOD line: "$FWRG: +8.5% pre-market, FDA decision due today — options market pricing in a big move"`;


      let tweetText = await generateTweet(prompt);

      // Validate — watchlist format will be longer, allow up to 280 per tweet
      // This will be posted as a thread if needed
      if (!tweetText || tweetText.length < 30) {
        console.log('Gemini output invalid, using fallback');
        tweetText = buildFallbackMorningTweet(stocks);
      }
      if (!tweetText.includes('jckrbbt.io')) {
        tweetText = tweetText.trimEnd() + '\njckrbbt.io';
      }
      tweetText = sanitizeEmojis(tweetText.replace(/^["']|["']$/g, ''));

      // If the watchlist is over 280 chars, split into a thread
      const client = getTwitterClient();
      let result;
      if (tweetText.length > 280) {
        // Split: first tweet is header + first 2 stocks, second tweet is remaining stocks + CTA
        const lines = tweetText.split('\n');
        const headerEnd = lines.findIndex(l => l.startsWith('$'));
        const stockLines = lines.filter(l => l.startsWith('$'));
        const header = lines.slice(0, headerEnd).join('\n').trim();
        const cta = lines.filter(l => l.includes('Follow') || l.includes('jckrbbt.io')).join('\n');

        const tweet1 = [header, '', ...stockLines.slice(0, 3)].join('\n').substring(0, 280);
        const tweet2 = [...stockLines.slice(3), '', cta].join('\n').substring(0, 280);

        if (tweet2.trim().length > 10) {
          const t1 = await client.v2.tweet(tweet1);
          result = await client.v2.tweet(tweet2, { reply: { in_reply_to_tweet_id: t1.data.id } });
          result = t1; // log the first tweet id
        } else {
          result = await client.v2.tweet(tweet1);
        }
      } else {
        result = await client.v2.tweet(tweetText);
      }

      await logPost('morning_scan', tweetText, result.data.id, {
        movers: stocks.map(s => s.ticker),
        scannerData: stocks.map(s => ({
          ticker: s.ticker, name: s.name, change: s.change,
          catalyst: (s.catalyst || '').slice(0, 200), catalystType: s.catalystType,
          patterns: s.patterns, sentiment: s.sentiment,
        })),
      });

      console.log('\u2705 Morning scan posted:', result.data.id);
      console.log('Tweet:', tweetText);
      return null;
    } catch (error) {
      console.error('Error posting morning scan:', error);
      return null;
    }
  });

// ============================================================
// MARKET CLOSE RECAP — 4:05 PM ET weekdays
// Scores morning picks + shows how they ended
// ============================================================

exports.postMarketClose = functions
  .runWith({ timeoutSeconds: 240, memory: '512MB', secrets: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"] })
  .pubsub
  .schedule('5 16 * * 1-5')
  .timeZone('America/New_York')
  .onRun(async () => {
    try {
      if (await isDuplicate('market_close')) {
        console.log('Market close already posted recently, skipping');
        return null;
      }

      const fetch = (await import('node-fetch')).default;

      // ── 1. Fetch today's top movers from Polygon (gainers + losers) ──
      const [gainersRes, losersRes] = await Promise.all([
        fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON_KEY}`).then(r => r.json()),
        fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/losers?apiKey=${POLYGON_KEY}`).then(r => r.json()),
      ]);

      const topGainers = (gainersRes.tickers || [])
        .filter(t => t.lastTrade && t.lastTrade.p >= 5 && t.day && t.day.v >= 500000)
        .slice(0, 5)
        .map(t => ({
          ticker: t.ticker,
          change: t.todaysChangePerc,
          volume: t.day.v,
          price: t.lastTrade.p,
          direction: 'up',
        }));

      const topLosers = (losersRes.tickers || [])
        .filter(t => t.lastTrade && t.lastTrade.p >= 5 && t.day && t.day.v >= 500000)
        .slice(0, 3)
        .map(t => ({
          ticker: t.ticker,
          change: t.todaysChangePerc,
          volume: t.day.v,
          price: t.lastTrade.p,
          direction: 'down',
        }));

      const todayMovers = [...topGainers, ...topLosers];

      if (todayMovers.length === 0) {
        console.log('Could not fetch end-of-day movers, skipping');
        return null;
      }

      // ── 2. Run scanner to identify tomorrow's watchlist candidates ──
      console.log('🔍 Running EOD scanner for tomorrow watchlist...');
      const scanResult = await runScanner({ priceMin: 5, priceMax: 500, maxResults: 8 });
      const tomorrowCandidates = (scanResult.stocks || [])
        .filter(s => s.catalyst || (s.volumeRatio && s.volumeRatio >= 1.5))
        .slice(0, 4);

      // ── 3. Get catalysts for today's movers via Gemini ──
      const moverData = await Promise.all(
        todayMovers.slice(0, 4).map(async (m) => {
          const catalystPrompt = `In 1 sentence (max 80 chars), what drove $${m.ticker} ${m.change > 0 ? 'up' : 'down'} ${Math.abs(m.change).toFixed(1)}% today? Be specific — name the catalyst (earnings, upgrade, FDA, guidance, sector rotation, etc). If unknown, say "no clear catalyst."`;
          const catalyst = await generateTweet(catalystPrompt);
          const noCatalyst = !catalyst || catalyst.toLowerCase().includes('no clear catalyst') || catalyst.length < 10;
          return { ...m, catalyst: noCatalyst ? null : catalyst.trim() };
        })
      );

      // ── 4. Get SPY EOD ──
      let spyChange = 0;
      try {
        const spyRes = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/SPY?apiKey=${POLYGON_KEY}`);
        const spyData = await spyRes.json();
        spyChange = spyData?.ticker?.todaysChangePerc || 0;
      } catch (e) { console.log('SPY fetch failed:', e.message); }

      // ── 5. Build prompt data ──
      const todayRecapData = moverData
        .filter(m => m.catalyst)
        .map(m => `$${m.ticker}: ${m.change > 0 ? '+' : ''}${m.change.toFixed(1)}% | Vol: ${(m.volume / 1000000).toFixed(1)}M | ${m.catalyst}`)
        .join('\n');

      const tomorrowData = tomorrowCandidates.map(s => {
        const parts = [`$${s.ticker}: ${s.change >= 0 ? '+' : ''}${s.change.toFixed(1)}% today`];
        if (s.catalyst) parts.push(s.catalyst.slice(0, 100));
        if (s.patterns && s.patterns.length) parts.push(`Setup: ${s.patterns.slice(0, 2).join(', ')}`);
        return parts.join(' | ');
      }).join('\n');

      const prompt = `You write posts for JCKRBBT, an AI stock scanner for retail traders.

Your job: Write a structured end-of-day recap tweet. Follow the format EXACTLY.

TODAY'S MARKET — SPY ${spyChange >= 0 ? '+' : ''}${spyChange.toFixed(1)}%

TODAY'S TOP MOVERS (with catalysts):
${todayRecapData || 'Market data unavailable'}

TOMORROW'S WATCHLIST (scanner flagged these for potential movement):
${tomorrowData || 'See app for full scan'}

OUTPUT FORMAT — follow this exactly:
Line 1: "Here's what moved today and what to watch tomorrow:"
Line 2: blank
Line 3-5: Top movers recap — one line each: "$TICKER: [how much it moved] — [why, 1 sentence max]"
Line 6: blank
Line 7: "On watch for tomorrow:"
Line 8-10: Tomorrow watchlist — one line each: "$TICKER: [what the setup is and why it has potential, 1 sentence]"
Line 11: blank
Line 12: "Follow for pre-market scan tomorrow morning."
Line 13: "jckrbbt.io"

RULES:
- Be specific with catalysts — "$NVDA +4.2% — data center demand beat estimates" not "$NVDA had big gains"
- Tomorrow watchlist should sound forward-looking: "setting up for...", "watch for a break above...", "earnings tomorrow..."
- No scorecard framing. No "X/Y picks hit." No batting average. This is a recap, not a report card.
- No emojis. No hashtags. No exclamation marks.
- Tone: sharp trader end-of-day debrief, not a brand newsletter

BAD: "2/5 picks hit today. $FWRG finished strong at +8.5%. The rest failed to hold. jckrbbt.io"
GOOD:
"Here's what moved today and what to watch tomorrow:

$FWRG: +8.5% — FDA fast-track designation announced pre-market, held gains all day
$NVDA: +3.1% — data center revenue guidance raise, institutional accumulation visible
$TSLA: -4.2% — delivery miss vs estimates, CEO distraction narrative back

On watch for tomorrow:
$AMD: earnings after bell, options pricing in a 7% move either direction
$SOFI: breaking above 200-day MA on 2x volume, continuation setup
$PLTR: NATO contract news still playing out, watch for follow-through

Follow for pre-market scan tomorrow morning.
jckrbbt.io"`;

      let tweetText = await generateTweet(prompt);

      // Fallback
      if (!tweetText || tweetText.length < 30) {
        const lines = ['Here\'s what moved today and what to watch tomorrow:\n'];
        moverData.slice(0, 3).forEach(m => {
          const catalyst = m.catalyst ? ` — ${m.catalyst.slice(0, 60)}` : '';
          lines.push(`$${m.ticker}: ${m.change > 0 ? '+' : ''}${m.change.toFixed(1)}%${catalyst}`);
        });
        if (tomorrowCandidates.length > 0) {
          lines.push('\nOn watch for tomorrow:');
          tomorrowCandidates.slice(0, 2).forEach(s => {
            lines.push(`$${s.ticker}: ${s.catalyst ? s.catalyst.slice(0, 70) : 'scanner flagged unusual activity'}`);
          });
        }
        lines.push('\njckrbbt.io');
        tweetText = lines.join('\n');
      }

      if (!tweetText.includes('jckrbbt.io')) {
        tweetText = tweetText.trimEnd() + '\njckrbbt.io';
      }
      tweetText = sanitizeEmojis(tweetText.replace(/^["']|["']$/g, ''));

      // Post as thread if over 280 chars
      const client = getTwitterClient();
      let result;
      if (tweetText.length > 280) {
        const lines = tweetText.split('\n');
        const watchIdx = lines.findIndex(l => l.toLowerCase().includes('on watch for tomorrow'));
        const tweet1 = watchIdx > 0
          ? lines.slice(0, watchIdx).join('\n').trim().substring(0, 280)
          : tweetText.substring(0, 280);
        const tweet2 = watchIdx > 0
          ? lines.slice(watchIdx).join('\n').trim().substring(0, 280)
          : '';

        const t1 = await client.v2.tweet(tweet1);
        result = t1;
        if (tweet2.length > 10) {
          await client.v2.tweet(tweet2, { reply: { in_reply_to_tweet_id: t1.data.id } });
        }
      } else {
        result = await client.v2.tweet(tweetText);
      }

      await logPost('market_close', tweetText, result.data.id, {
        todayMovers: moverData.map(m => ({ ticker: m.ticker, change: m.change, catalyst: m.catalyst })),
        tomorrowWatchlist: tomorrowCandidates.map(s => s.ticker),
        spyChange,
      });

      console.log('✅ Market close posted:', result.data.id);
      console.log('Tweet:', tweetText);
      return null;
    } catch (error) {
      console.error('Error posting market close:', error);
      return null;
    }
  });

// ============================================================
// MANUAL POST — callable for ad-hoc tweets/threads
// ============================================================

exports.postManual = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (!userDoc.data() || userDoc.data().role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }

  try {
    const { text, thread } = req.body;
    const client = getTwitterClient();

    if (thread && Array.isArray(thread) && thread.length > 1) {
      let lastTweetId = null;
      const tweetIds = [];
      for (const tweetText of thread) {
        const opts = lastTweetId ? { reply: { in_reply_to_tweet_id: lastTweetId } } : {};
        const result = await client.v2.tweet(tweetText, opts);
        lastTweetId = result.data.id;
        tweetIds.push(result.data.id);
      }
      await logPost('manual_thread', thread.join('\n---\n'), tweetIds[0], { threadIds: tweetIds });
      return res.json({ success: true, tweetIds });
    } else {
      const tweetText = text || (thread && thread[0]);
      if (!tweetText) return res.status(400).json({ error: 'Provide "text" or "thread" array' });
      const result = await client.v2.tweet(tweetText);
      await logPost('manual', tweetText, result.data.id);
      return res.json({ success: true, tweetId: result.data.id });
    }
  } catch (error) {
    console.error('Error posting manual tweet:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================
// MID-DAY MOVERS — 12:30 PM ET weekdays
// Re-runs scanner to catch late-morning breakouts, reversals,
// and stocks that weren't on the radar at 9:35 AM
// ============================================================

exports.postMiddayMovers = functions
  .runWith({ timeoutSeconds: 300, memory: '512MB', secrets: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"] })
  .pubsub
  .schedule('30 12 * * 1-5')
  .timeZone('America/New_York')
  .onRun(async () => {
    try {
      if (await isDuplicate('midday_movers')) {
        console.log('Midday movers already posted recently, skipping');
        return null;
      }

      // Get morning picks so we can highlight what's NEW
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const morningSnap = await db.collection('xPosts')
        .where('type', '==', 'morning_scan')
        .where('postedAt', '>', today)
        .limit(1)
        .get();

      const morningTickers = new Set();
      if (!morningSnap.empty) {
        const doc = morningSnap.docs[0].data();
        (doc.movers || []).forEach(t => morningTickers.add(t));
      }

      // Run the scanner again — will catch mid-day action
      console.log('\u{1F50D} Running midday scanner...');
      const scanResult = await runScanner({ priceMin: 5, priceMax: 500, maxResults: 8 });
      const allStocks = scanResult.stocks || [];

      if (allStocks.length === 0) {
        console.log('No midday movers found, skipping');
        return null;
      }

      // Quality gate
      const spyChange = scanResult.spyChange || 0;
      const quality = evaluatePostQuality(allStocks, spyChange);
      if (!quality.shouldPost) {
        console.log(`\u26D4 Skipping midday post: ${quality.reason}`);
        return null;
      }

      // Split into NEW movers (not in morning scan) and morning picks that accelerated
      const newMovers = allStocks.filter(s => !morningTickers.has(s.ticker));
      const morningUpdates = allStocks.filter(s => morningTickers.has(s.ticker));

      // Rank by interestingness
      const rankStock = (s) => Math.abs(s.change || 0) + (s.catalyst ? 2 : 0) + ((s.volumeRatio || 0) >= 2 ? 1 : 0) + (!morningTickers.has(s.ticker) ? 1.5 : 0);
      const ranked = [...allStocks].sort((a, b) => rankStock(b) - rankStock(a));
      const featured = ranked.slice(0, 4);

      console.log(`\u{1F4CA} Midday: ${newMovers.length} new movers, ${morningUpdates.length} morning picks still active`);

      const stockData = featured.map(s => {
        const parts = [`$${s.ticker} (${s.name})`];
        parts.push(`${s.change >= 0 ? '+' : ''}${s.change.toFixed(1)}% | ${s.volumeRatio}x avg volume`);
        const isNew = !morningTickers.has(s.ticker);
        if (isNew) parts.push('** NEW since open **');
        if (s.catalyst) parts.push(`Catalyst: ${s.catalyst.slice(0, 120)}`);
        if (s.catalystType) parts.push(`Type: ${s.catalystType}`);
        return parts.join(' | ');
      }).join('\n');

      // Dynamic angle
      let angleInstruction = '';
      if (newMovers.length >= 2 && newMovers.some(s => Math.abs(s.change) >= 3)) {
        angleInstruction = 'ANGLE: Fresh movers emerged after the open — things the morning scan missed but the midday scan caught. This shows the scanner stays active.';
      } else if (morningUpdates.some(s => Math.abs(s.change) >= 5)) {
        angleInstruction = 'ANGLE: A morning pick is now ripping even harder — call out the continuation. "We flagged this at +3%, now it\'s +7%."';
      } else if (quality.tags.includes('COUNTER_TREND')) {
        angleInstruction = 'ANGLE: Market is selling off but these names are bucking the trend. Lead with that contrast.';
      }

      const prompt = `You write tweets for JCKRBBT, an AI stock scanner for retail traders.

MIDDAY SCANNER RESULTS (just rescanned the market):
${stockData}

MARKET: SPY ${spyChange >= 0 ? '+' : ''}${spyChange.toFixed(1)}%
New movers since morning: ${newMovers.length}

${angleInstruction}

WRITE ONE TWEET. Rules:
- Max 260 characters
- Pick the 1-2 MOST interesting stocks — preferably NEW ones the morning scan didn't catch
- Include the catalyst/reason for the move
- If a morning pick accelerated, call it out: "flagged at open, still running"
- Write like a trader, not a brand. No "lunch break scan is HERE" energy.
- 1 emoji max. NEVER use: 🤖 🚨 🔥 🚀 💰 🤑 💯
- End with: jckrbbt.io
- No hashtags, no quotes

BAD: "Lunch break scan is HERE! Market evolved, we caught it: $SOFI +1.1%, $SM +1.7%"
GOOD: "$AFRM +6.3% mid-day breakout on BNPL volume surge — wasn't on the morning scan. Scanner caught the midday rotation. jckrbbt.io"`;


      let tweetText = await generateTweet(prompt);

      if (!tweetText || tweetText.length > 280 || tweetText.length < 30) {
        // Fallback
        const lines = ['JCKRBBT Midday Scan\n'];
        if (newMovers.length > 0) lines.push(`${newMovers.length} new movers since open:\n`);
        featured.slice(0, 4).forEach(s => {
          const tag = !morningTickers.has(s.ticker) ? ' \u{1F195}' : '';
          lines.push(`$${s.ticker} ${s.change >= 0 ? '+' : ''}${s.change.toFixed(1)}%${tag}`);
        });
        lines.push('\njckrbbt.io');
        tweetText = lines.join('\n');
      }
      if (!tweetText.includes('jckrbbt.io')) {
        tweetText = tweetText.substring(0, 255) + '\njckrbbt.io';
      }
      tweetText = sanitizeEmojis(tweetText.replace(/^["']|["']$/g, ''));

      const client = getTwitterClient();
      const result = await client.v2.tweet(tweetText);

      await logPost('midday_movers', tweetText, result.data.id, {
        movers: featured.map(s => s.ticker),
        newMovers: newMovers.map(s => s.ticker),
        morningCarryovers: morningUpdates.map(s => s.ticker),
        scannerData: featured.map(s => ({
          ticker: s.ticker, name: s.name, change: s.change,
          catalyst: (s.catalyst || '').slice(0, 200), catalystType: s.catalystType,
          patterns: s.patterns, sentiment: s.sentiment,
        })),
      });

      console.log('\u2705 Midday movers posted:', result.data.id);
      return null;
    } catch (error) {
      console.error('Error posting midday movers:', error);
      return null;
    }
  });

// ============================================================
// WEEKLY SCORECARD — Friday 4:30 PM ET
// Best pick of the week, overall hit rate, vs S&P comparison
// ============================================================

exports.postWeeklyScorecard = functions
  .runWith({ timeoutSeconds: 120, memory: '256MB', secrets: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"] })
  .pubsub
  .schedule('30 16 * * 5')
  .timeZone('America/New_York')
  .onRun(async () => {
    try {
      if (await isDuplicate('weekly_scorecard')) {
        console.log('Weekly scorecard already posted, skipping');
        return null;
      }

      // Get all morning scans from this week (Mon-Fri)
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (now.getDay() - 1));
      monday.setHours(0, 0, 0, 0);

      const weekSnap = await db.collection('xPosts')
        .where('type', '==', 'morning_scan')
        .where('postedAt', '>', monday)
        .orderBy('postedAt', 'asc')
        .get();

      // Also get market close recaps for scorecard data
      const closeSnap = await db.collection('xPosts')
        .where('type', '==', 'market_close')
        .where('postedAt', '>', monday)
        .orderBy('postedAt', 'asc')
        .get();

      let totalPicks = 0;
      let totalHits = 0;
      let bestPick = null;
      let bestPickChange = -Infinity;
      const allTickers = new Set();

      // Aggregate scorecard data from close recaps
      closeSnap.docs.forEach(doc => {
        const data = doc.data();
        const scorecard = data.scorecard || [];
        scorecard.forEach(s => {
          totalPicks++;
          const endChange = parseFloat(s.endChange) || 0;
          if (s.hit) totalHits++;
          if (endChange > bestPickChange) {
            bestPickChange = endChange;
            bestPick = s;
          }
        });
      });

      // Count unique tickers from morning scans
      weekSnap.docs.forEach(doc => {
        const data = doc.data();
        (data.movers || []).forEach(t => allTickers.add(t));
      });

      // Get SPY weekly performance
      const fetch = (await import('node-fetch')).default;
      let spyWeekChange = 0;
      try {
        const mondayStr = monday.toISOString().split('T')[0];
        const url = `https://api.polygon.io/v2/aggs/ticker/SPY/range/1/week/${mondayStr}/${now.toISOString().split('T')[0]}?apiKey=${POLYGON_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const bar = data.results[data.results.length - 1];
          spyWeekChange = ((bar.c - bar.o) / bar.o * 100).toFixed(1);
        }
      } catch (e) { console.log('SPY weekly fetch failed:', e.message); }

      if (totalPicks === 0) {
        console.log('No scorecard data this week, skipping');
        return null;
      }

      const hitRate = ((totalHits / totalPicks) * 100).toFixed(0);
      const scanDays = weekSnap.size;

      const prompt = `You write tweets for JCKRBBT, an AI stock scanner for retail traders.

WEEKLY SCORECARD (Friday recap — this is the most shareable tweet of the week):
- ${scanDays} days scanned
- ${totalPicks} picks, ${totalHits} hit target (${hitRate}% hit rate, >2% EOD = hit)
- ${allTickers.size} unique stocks flagged
- Best pick: $${bestPick ? bestPick.ticker : 'N/A'} ${bestPick ? (bestPickChange > 0 ? '+' : '') + bestPickChange.toFixed(1) + '%' : ''}${bestPick && bestPick.name ? ` (${bestPick.name})` : ''}
- SPY this week: ${spyWeekChange > 0 ? '+' : ''}${spyWeekChange}%
${bestPickChange > parseFloat(spyWeekChange) ? `- Scanner's best pick beat SPY by ${(bestPickChange - parseFloat(spyWeekChange)).toFixed(1)} percentage points` : ''}

WRITE ONE TWEET. Rules:
- Max 260 characters
- This is your proof tweet — it builds credibility over time
- Lead with the concrete stat: hit rate or best pick
- If best pick crushed SPY, make that the headline
- Be honest — if hit rate was bad, own it and frame what you're improving
- Tone: results speak louder than hype
- 1 emoji max. NEVER use: 🤖 🚨 🔥 🚀 💰 🤑 💯
- End with: jckrbbt.io
- No hashtags, no quotes

BAD: "What a week! Our scanner crushed it with amazing picks!"
GOOD: "${hitRate}% hit rate this week. Best flag: $${bestPick ? bestPick.ticker : 'XYZ'} ${bestPick ? '+' + bestPickChange.toFixed(1) : '+8.3'}% vs SPY ${spyWeekChange > 0 ? '+' : ''}${spyWeekChange}%. ${totalPicks} picks, receipts every day. jckrbbt.io"`;

      let tweetText = await generateTweet(prompt);

      if (!tweetText || tweetText.length > 280 || tweetText.length < 30) {
        // Fallback
        const lines = ['JCKRBBT Weekly Scorecard\n'];
        lines.push(`${hitRate}% hit rate this week (${totalHits}/${totalPicks})`);
        if (bestPick) lines.push(`Best pick: $${bestPick.ticker} ${bestPickChange > 0 ? '+' : ''}${bestPickChange.toFixed(1)}%`);
        lines.push(`SPY: ${spyWeekChange > 0 ? '+' : ''}${spyWeekChange}%`);
        lines.push('\njckrbbt.io');
        tweetText = lines.join('\n');
      }
      if (!tweetText.includes('jckrbbt.io')) {
        tweetText = tweetText.substring(0, 255) + '\njckrbbt.io';
      }
      tweetText = sanitizeEmojis(tweetText.replace(/^["']|["']$/g, ''));

      const client = getTwitterClient();
      const result = await client.v2.tweet(tweetText);

      await logPost('weekly_scorecard', tweetText, result.data.id, {
        totalPicks, totalHits, hitRate,
        bestPick: bestPick ? { ticker: bestPick.ticker, change: bestPickChange } : null,
        spyWeekChange, scanDays,
        uniqueTickers: allTickers.size,
      });

      console.log('\u2705 Weekly scorecard posted:', result.data.id);
      return null;
    } catch (error) {
      console.error('Error posting weekly scorecard:', error);
      return null;
    }
  });

// ============================================================
// BREAKING MOVER ALERT — every 15 min during market hours
// Polls Polygon for 3.5%+ movers with catalysts, posts if found.
// Dedupes per ticker so we don't spam the same stock twice.
// ============================================================

// Check if we already tweeted about this ticker today
const alreadyAlertedTicker = async (ticker) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Use single collection query + filter in code to avoid composite index requirement
  const snap = await db.collection('xPosts')
    .where('type', '==', 'breaking_alert')
    .where('postedAt', '>', today)
    .get();
  return snap.docs.some(d => d.data().alertTicker === ticker);
};

// Cap alerts at 3 per day to avoid being spammy
const alertCountToday = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const snap = await db.collection('xPosts')
    .where('type', '==', 'breaking_alert')
    .where('postedAt', '>', today)
    .get();
  return snap.size;
};

exports.postBreakingAlert = functions
  .runWith({ timeoutSeconds: 120, memory: '256MB', secrets: ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"] })
  .pubsub
  .schedule('*/15 10-15 * * 1-5')
  .timeZone('America/New_York')
  .onRun(async () => {
    try {
      // Cron handles market hours (10 AM - 3:59 PM ET, Mon-Fri)
      // Just skip near scheduled post times to avoid collisions
      const now = new Date();
      const hour = now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
      const minute = now.toLocaleString('en-US', { timeZone: 'America/New_York', minute: 'numeric' });
      const etHour = parseInt(hour);
      const etMinute = parseInt(minute);

      // Skip if near scheduled post times to avoid collisions
      // Morning scan at 9:35, midday at 12:30, close at 16:05
      if ((etHour === 12 && etMinute >= 25 && etMinute <= 40)) {
        console.log('Near scheduled post time, skipping alert check');
        return null;
      }

      // Cap at 5 alerts per day — aggressive for growth
      const todayCount = await alertCountToday();
      if (todayCount >= 5) {
        console.log(`Already posted ${todayCount} alerts today, capped at 5`);
        return null;
      }

      // ── 1. Pull gainers + losers from Polygon ──
      const fetch = (await import('node-fetch')).default;
      const [gainersRes, losersRes] = await Promise.all([
        fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON_KEY}`).then(r => r.json()),
        fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/losers?apiKey=${POLYGON_KEY}`).then(r => r.json()),
      ]);

      const rawGainers = (gainersRes.tickers || []).filter(t =>
        t.todaysChangePerc >= 3.5 &&
        t.day && t.day.v >= 500000 &&
        t.min && t.min.av >= 1000 &&
        t.lastTrade && t.lastTrade.p >= 5
      );
      const rawLosers = (losersRes.tickers || []).filter(t =>
        t.todaysChangePerc <= -3.5 &&
        t.day && t.day.v >= 500000 &&
        t.min && t.min.av >= 1000 &&
        t.lastTrade && t.lastTrade.p >= 5
      );

      if (rawGainers.length === 0 && rawLosers.length === 0) {
        console.log('No 3.5%+ movers found');
        return null;
      }

      // ── 2. Enrich candidates with data signals from Polygon snapshot ──
      const enrichCandidate = (t, direction) => {
        const price = t.lastTrade?.p || 0;
        const volume = t.day?.v || 0;
        const avgVolume = t.day?.av || 1;                     // avg daily volume
        const volumeRatio = avgVolume > 0 ? volume / avgVolume : 0;
        const vwap = t.day?.vw || 0;
        const open = t.day?.o || 0;
        const high = t.day?.h || 0;
        const low = t.day?.l || 0;
        const prevClose = t.prevDay?.c || 0;
        const change = t.todaysChangePerc || 0;

        // Recent momentum: current minute bar volume vs avg minute volume
        const minVolume = t.min?.v || 0;
        const avgMinVolume = t.min?.av || 1;
        const minuteVolumeRatio = avgMinVolume > 0 ? minVolume / avgMinVolume : 0;

        // Price vs VWAP (above = bullish structure, below = weak)
        const priceVsVwap = vwap > 0 ? ((price - vwap) / vwap * 100).toFixed(2) : null;

        // Day range position: where in today's range is price sitting (0=low, 1=high)
        const rangePosition = (high - low) > 0 ? ((price - low) / (high - low)) : null;

        // Score the data quality — what we actually have to say about this stock
        let dataScore = 0;
        if (Math.abs(change) >= 8) dataScore += 4;
        else if (Math.abs(change) >= 5) dataScore += 3;
        else dataScore += 1;
        if (volumeRatio >= 5) dataScore += 4;
        else if (volumeRatio >= 3) dataScore += 3;
        else if (volumeRatio >= 2) dataScore += 2;
        if (minuteVolumeRatio >= 3) dataScore += 2;   // acceleration RIGHT NOW
        if (rangePosition !== null) {
          if (direction === 'up' && rangePosition >= 0.85) dataScore += 1;  // at HOD = strength
          if (direction === 'down' && rangePosition <= 0.15) dataScore += 1; // at LOD = weakness
        }

        return {
          ticker: t.ticker,
          change,
          volume,
          avgVolume,
          volumeRatio: parseFloat(volumeRatio.toFixed(1)),
          price,
          prevClose,
          open,
          high,
          low,
          vwap: parseFloat(vwap.toFixed(2)),
          priceVsVwap,
          minVolume,
          minuteVolumeRatio: parseFloat(minuteVolumeRatio.toFixed(1)),
          rangePosition: rangePosition !== null ? parseFloat(rangePosition.toFixed(2)) : null,
          direction,
          dataScore,
        };
      };

      const candidates = [
        ...rawGainers.map(t => enrichCandidate(t, 'up')),
        ...rawLosers.map(t => enrichCandidate(t, 'down')),
      ].sort((a, b) => b.dataScore - a.dataScore);

      console.log(`📊 Found ${candidates.length} candidates: ${candidates.slice(0, 5).map(c => `${c.ticker} ${c.change > 0 ? '+' : ''}${c.change.toFixed(1)}% (score:${c.dataScore} vol:${c.volumeRatio}x)`).join(', ')}`);

      // ── 3. Pick the first candidate we haven't already alerted on ──
      let picked = null;
      for (const c of candidates.slice(0, 10)) {
        if (!(await alreadyAlertedTicker(c.ticker))) {
          picked = c;
          break;
        }
      }

      if (!picked) {
        console.log('All top movers already alerted today');
        return null;
      }

      console.log(`🎯 Picked $${picked.ticker} ${picked.change > 0 ? '+' : ''}${picked.change.toFixed(1)}% | ${picked.volumeRatio}x vol | score:${picked.dataScore}`);

      // ── 4. Check Finnhub for a real news headline — only use if it's major ──
      const FINNHUB_KEY = process.env.FINNHUB_KEY;
      let newsHeadline = null;

      if (FINNHUB_KEY) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const newsRes = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${picked.ticker}&from=${today}&to=${today}&token=${FINNHUB_KEY}`);
          const newsData = await newsRes.json();
          if (Array.isArray(newsData) && newsData.length > 0) {
            // Only surface news if it looks like a genuine catalyst, not a blog recap
            const majorNewsKeywords = ['earnings', 'beats', 'misses', 'guidance', 'fda', 'approval', 'upgrade', 'downgrade', 'acqui', 'merger', 'deal', 'raises', 'cuts', 'recall', 'sec', 'investigation', 'layoff', 'ceo'];
            const sorted = newsData.sort((a, b) => b.datetime - a.datetime);
            const majorStory = sorted.find(n =>
              n.headline && majorNewsKeywords.some(kw => n.headline.toLowerCase().includes(kw))
            );
            if (majorStory) {
              newsHeadline = majorStory.headline.slice(0, 120);
              console.log(`📰 Major news found: ${newsHeadline}`);
            } else {
              console.log(`📰 News exists but no major catalyst keywords — leading with data`);
            }
          }
        } catch (e) {
          console.log('Finnhub fetch failed:', e.message);
        }
      }

      // ── 5. Build the data narrative (always present, news is additive) ──
      const dataPoints = [];
      dataPoints.push(`${picked.change > 0 ? '+' : ''}${picked.change.toFixed(1)}% on the day`);
      dataPoints.push(`${picked.volumeRatio}x avg volume (${(picked.volume / 1000000).toFixed(1)}M shares)`);
      if (picked.minuteVolumeRatio >= 2) dataPoints.push(`current minute bar running ${picked.minuteVolumeRatio}x avg — accelerating`);
      if (picked.priceVsVwap !== null) {
        const vwapStr = parseFloat(picked.priceVsVwap) > 0
          ? `${picked.priceVsVwap}% above VWAP`
          : `${Math.abs(picked.priceVsVwap)}% below VWAP`;
        dataPoints.push(vwapStr);
      }
      if (picked.rangePosition !== null) {
        if (picked.direction === 'up' && picked.rangePosition >= 0.85) dataPoints.push('printing near HOD — no resistance yet');
        if (picked.direction === 'up' && picked.rangePosition <= 0.4) dataPoints.push('off highs — watch for support hold');
        if (picked.direction === 'down' && picked.rangePosition <= 0.15) dataPoints.push('pressing LOD — sellers in control');
        if (picked.direction === 'down' && picked.rangePosition >= 0.6) dataPoints.push('off lows — potential stabilization');
      }

      // ── 6. Generate tweet — data-first, news as context if available ──
      const tweetPrompt = `You write tweets for JCKRBBT, an AI stock scanner for active traders. The scanner surfaces moves based on price action, volume, and market structure — not news feeds.

LIVE SCANNER ALERT — $${picked.ticker}:
Direction: ${picked.direction === 'up' ? 'UP' : 'DOWN'}
Price: $${picked.price.toFixed(2)} (prev close $${picked.prevClose.toFixed(2)})
Change: ${picked.change > 0 ? '+' : ''}${picked.change.toFixed(1)}%
Volume: ${(picked.volume / 1000000).toFixed(1)}M shares | ${picked.volumeRatio}x avg daily volume
VWAP: $${picked.vwap} | Price is ${picked.priceVsVwap !== null ? (parseFloat(picked.priceVsVwap) >= 0 ? picked.priceVsVwap + '% above' : Math.abs(picked.priceVsVwap) + '% below') : 'near'} VWAP
Day range: $${picked.low.toFixed(2)} - $${picked.high.toFixed(2)} | Price at ${picked.rangePosition !== null ? Math.round(picked.rangePosition * 100) + '% of range' : 'mid-range'}
Intraday momentum: current minute ${picked.minuteVolumeRatio}x avg minute volume
${newsHeadline ? `\nNEWS (confirmed major catalyst): ${newsHeadline}` : '\nNO confirmed news catalyst — this is a pure price/volume signal'}

WRITE ONE TWEET. Rules:
- Max 260 characters
- LEAD with the data: the move %, volume multiple, and what the price structure looks like
- If there IS confirmed news, weave it in AFTER the data — it explains the why
- If there is NO news, that's fine and worth saying: "no news — volume doing the talking"
- Second line: what a trader should watch (key level, continuation signal, or risk)
- Sound like a trader calling out a live move to their chat group — specific, confident, no hype
- No emojis. No hashtags. No exclamation marks. No quotes around the output.
- End with: jckrbbt.io

BAD: "BREAKING: $NVDA is making a big move today! Check our scanner for details! jckrbbt.io"
BAD: "$NVDA +5% — something is happening. Volume is high. Watch this one. jckrbbt.io"
GOOD (no news): "$NVDA +5.8% on 4.2x avg volume, printing at HOD with no news catalyst. Pure price action. Watch $142 — if it holds, continuation setup. jckrbbt.io"
GOOD (with news): "$SMCI +12% — FDA fast-track designation just dropped. 6x volume, surging through VWAP. First resistance at $38.50. jckrbbt.io"`;

      let tweetText = await generateTweet(tweetPrompt);

      // Validate
      if (!tweetText || tweetText.length > 280 || tweetText.length < 30) {
        const dir = picked.change > 0 ? '+' : '';
        const newsStr = newsHeadline ? ` — ${newsHeadline.slice(0, 60)}` : ` — ${picked.volumeRatio}x avg volume, no news`;
        tweetText = `$${picked.ticker} ${dir}${picked.change.toFixed(1)}%${newsStr}\n$${picked.price.toFixed(2)} | ${picked.priceVsVwap !== null ? (parseFloat(picked.priceVsVwap) >= 0 ? picked.priceVsVwap + '% above VWAP' : Math.abs(picked.priceVsVwap) + '% below VWAP') : 'near VWAP'}\njckrbbt.io`;
      }
      if (!tweetText.includes('jckrbbt.io')) {
        tweetText = tweetText.trimEnd() + '\njckrbbt.io';
      }
      tweetText = sanitizeEmojis(tweetText.replace(/^["']|["']$/g, ''));

      // Post
      const client = getTwitterClient();
      const result = await client.v2.tweet(tweetText);

      await logPost('breaking_alert', tweetText, result.data.id, {
        alertTicker: picked.ticker,
        change: picked.change,
        volume: picked.volume,
        volumeRatio: picked.volumeRatio,
        price: picked.price,
        vwap: picked.vwap,
        priceVsVwap: picked.priceVsVwap,
        rangePosition: picked.rangePosition,
        minuteVolumeRatio: picked.minuteVolumeRatio,
        newsHeadline: newsHeadline || null,
        dataScore: picked.dataScore,
        alertNumber: todayCount + 1,
      });

      console.log(`\u2705 Breaking alert #${todayCount + 1} posted:`, result.data.id);
      console.log('Tweet:', tweetText);
      return null;
    } catch (error) {
      console.error('Error in breaking alert:', error);
      return null;
    }
  });
