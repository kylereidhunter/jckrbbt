// functions/dailyBriefing.js
// Scheduled Cloud Function — runs at 6:30 AM ET weekdays
// Generates personalized daily briefings for each user
//
// SETUP:
// 1. Add to functions/index.js:
//    const { generateDailyBriefing } = require('./dailyBriefing');
//    exports.generateDailyBriefing = generateDailyBriefing;
//
// 2. Deploy:
//    firebase deploy --only functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

const POLYGON_KEY = process.env.POLYGON_KEY;
const FINNHUB_KEY = process.env.FINNHUB_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_BASE = (process.env.PLAID_ENV || 'production') === 'production'
  ? 'https://production.plaid.com'
  : 'https://sandbox.plaid.com';

// ========== HELPERS ==========

// Timeout wrapper for all external API calls (prevents hanging)
function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function polygonFetch(path, params = {}) {
  const query = new URLSearchParams({ ...params, apiKey: POLYGON_KEY });
  const url = `https://api.polygon.io${path}?${query.toString()}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Polygon ${res.status}`);
  return res.json();
}

async function finnhubFetch(path, params = {}) {
  const query = new URLSearchParams({ ...params, token: FINNHUB_KEY });
  const url = `https://finnhub.io${path}?${query.toString()}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  return res.json();
}

async function geminiGenerate(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
    }),
  }, 20000); // 20s timeout for AI generation
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function formatDateStr(d) {
  return d.toISOString().split('T')[0];
}

function formatPrice(n) {
  if (!n || isNaN(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

function formatPct(n) {
  if (!n || isNaN(n)) return '0.0%';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

async function sendPushNotifications(messages) {
  if (messages.length === 0) return;
  const valid = messages.filter(m => Expo.isExpoPushToken(m.to));
  if (valid.length === 0) return;
  const chunks = expo.chunkPushNotifications(valid);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (e) {
      console.error('Push chunk error:', e);
    }
  }
  console.log(`📨 Sent ${valid.length} briefing notifications`);
}

// ========== MARKET DATA (shared across all users) ==========

async function fetchMarketData(isWeekend = false) {
  const today = new Date();
  const todayStr = formatDateStr(today);

  // 1. Market indices snapshot
  const indexTickers = ['SPY', 'QQQ', 'DIA', 'IWM', 'VIX'];
  let indices = {};
  try {
    const data = await polygonFetch('/v2/snapshot/locale/us/markets/stocks/tickers', {
      tickers: indexTickers.join(','),
    });
    (data.tickers || []).forEach(t => {
      indices[t.ticker] = {
        price: t.day?.c || t.prevDay?.c || 0,
        change: t.todaysChangePerc || 0,
        preMarket: t.min?.c || t.day?.c || t.prevDay?.c || 0,
      };
    });
  } catch (e) {
    console.error('Index snapshot error:', e);
  }

  // 2. Top gainers for early signals (skip on weekends — stale data)
  let gainers = [];
  if (!isWeekend) {
    try {
      const data = await polygonFetch('/v2/snapshot/locale/us/markets/stocks/gainers');
      gainers = (data.tickers || [])
        .filter(t => t.day?.v > 500000 && t.todaysChangePerc > 5)
        .slice(0, 10)
        .map(t => ({
          symbol: t.ticker,
          change: t.todaysChangePerc || 0,
          price: t.day?.c || 0,
          volume: t.day?.v || 0,
        }));
    } catch (e) {
      console.error('Gainers fetch error:', e);
    }
  }

  // 2b. Weekly performance for indices (weekend only)
  let weeklyPerformance = {};
  if (isWeekend) {
    try {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      for (const sym of ['SPY', 'QQQ', 'DIA', 'IWM']) {
        const data = await polygonFetch(`/v2/aggs/ticker/${sym}/range/1/day/${formatDateStr(weekAgo)}/${todayStr}`, {
          adjusted: 'true', sort: 'asc',
        });
        const bars = data.results || [];
        if (bars.length >= 2) {
          const weekOpen = bars[0].o;
          const weekClose = bars[bars.length - 1].c;
          weeklyPerformance[sym] = {
            weekOpen, weekClose,
            weekChange: ((weekClose - weekOpen) / weekOpen) * 100,
            weekHigh: Math.max(...bars.map(b => b.h)),
            weekLow: Math.min(...bars.map(b => b.l)),
          };
        }
      }
    } catch (e) {
      console.error('Weekly performance error:', e);
    }
  }

  // 3. Earnings calendar (today + next 5 trading days)
  let earningsCalendar = [];
  try {
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 7); // 7 calendar days ≈ 5 trading days
    const data = await finnhubFetch('/api/v1/calendar/earnings', {
      from: todayStr, to: formatDateStr(endDate),
    });
    earningsCalendar = (data.earningsCalendar || []).map(e => ({
      symbol: e.symbol,
      date: e.date,
      hour: e.hour,
      epsEstimate: e.epsEstimate,
      revenueEstimate: e.revenueEstimate,
    }));
  } catch (e) {
    console.error('Earnings calendar error:', e);
  }

  // Split into today vs upcoming
  const earningsToday = earningsCalendar.filter(e => e.date === todayStr);
  const earningsUpcoming = earningsCalendar.filter(e => e.date !== todayStr);

  // 4. Market news (top 5 headlines)
  let topNews = [];
  try {
    const data = await polygonFetch('/v2/reference/news', { limit: '8', order: 'desc' });
    topNews = (data.results || []).slice(0, 5).map(n => ({
      title: n.title,
      source: n.publisher?.name || 'Unknown',
      tickers: n.tickers || [],
    }));
  } catch (e) {
    console.error('News fetch error:', e);
  }

  return { indices, gainers, earningsToday, earningsUpcoming, topNews, todayStr, weeklyPerformance };
}

// ========== PER-USER BRIEFING ==========

async function generateUserBriefing(userId, userData, marketData) {
  const { indices, gainers, earningsToday, earningsUpcoming, topNews, todayStr, weeklyPerformance, isWeekend } = marketData;

  // Collect user's tickers from pins, watchlists, and portfolio
  const userTickers = new Set();

  // Pinned stocks
  const pins = userData.pinnedStocks || [];
  pins.forEach(p => {
    const sym = typeof p === 'string' ? p : p.symbol;
    if (sym) userTickers.add(sym);
  });

  // Watchlists (root-level collection, filtered by ownerId)
  try {
    const wSnap = await db.collection('watchlists').where('ownerId', '==', userId).get();
    wSnap.forEach(doc => {
      const data = doc.data();
      // Watchlists store stocks as an array of objects with .symbol
      (data.stocks || []).forEach(s => {
        const sym = typeof s === 'string' ? s : s.symbol;
        if (sym) userTickers.add(sym);
      });
    });
  } catch (e) {
    console.error(`Watchlist fetch error for ${userId}:`, e);
  }

  // Portfolio holdings via Plaid
  const brokerages = userData.connectedBrokerages || [];
  if (brokerages.length > 0) {
    for (const brokerage of brokerages) {
      try {
        // Get stored access token from plaidItems subcollection
        const plaidSnap = await db.doc(`users/${userId}/plaidItems/${brokerage.id}`).get();
        if (!plaidSnap.exists) continue;
        const accessToken = plaidSnap.data()?.accessToken;
        if (!accessToken) continue;

        const plaidRes = await fetchWithTimeout(`${PLAID_BASE}/investments/holdings/get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            access_token: accessToken,
          }),
        });
        const plaidData = await plaidRes.json();

        // Extract symbols from securities
        const securities = {};
        (plaidData.securities || []).forEach(s => {
          if (s.security_id) securities[s.security_id] = s.ticker_symbol;
        });
        (plaidData.holdings || []).forEach(h => {
          const sym = securities[h.security_id];
          if (sym && sym !== 'N/A' && !sym.includes(':') && sym.length <= 5) {
            userTickers.add(sym);
          }
        });
      } catch (e) {
        console.error(`Plaid holdings error for ${userId}:`, e.message);
      }
    }
  }

  const tickerList = [...userTickers];
  console.log(`🔍 User ${userId}: found ${tickerList.length} tickers — ${tickerList.slice(0, 10).join(', ')}`);

  // Fetch snapshots for user's stocks
  let stockData = {};
  if (tickerList.length > 0) {
    try {
      // Polygon accepts up to ~100 tickers at once
      const batches = [];
      for (let i = 0; i < tickerList.length; i += 50) {
        batches.push(tickerList.slice(i, i + 50));
      }
      for (const batch of batches) {
        const data = await polygonFetch('/v2/snapshot/locale/us/markets/stocks/tickers', {
          tickers: batch.join(','),
        });
        (data.tickers || []).forEach(t => {
          stockData[t.ticker] = {
            price: t.day?.c || t.prevDay?.c || 0,
            change: t.todaysChangePerc || 0,
            volume: t.day?.v || 0,
            prevClose: t.prevDay?.c || 0,
            preMarket: t.min?.c || null,
            dayHigh: t.day?.h || 0,
            dayLow: t.day?.l || 0,
            dayOpen: t.day?.o || 0,
            prevHigh: t.prevDay?.h || 0,
            prevLow: t.prevDay?.l || 0,
          };
        });
      }
    } catch (e) {
      console.error(`Snapshot error for ${userId}:`, e);
    }
  }

  // ===== BUILD BRIEFING SECTIONS =====

  // 1. Market Pulse
  const spy = indices['SPY'];
  const qqq = indices['QQQ'];
  const vix = indices['VIX'];
  const marketPulse = {
    indices: Object.entries(indices).map(([symbol, data]) => ({
      symbol, price: data.price, change: data.change,
    })),
    direction: spy ? (spy.change >= 0.3 ? 'bullish' : spy.change <= -0.3 ? 'bearish' : 'neutral') : 'neutral',
  };

  // 2. Your Stocks — sorted by absolute change magnitude
  const yourStocks = tickerList
    .filter(sym => stockData[sym])
    .map(sym => {
      const sd = stockData[sym];
      return {
        symbol: sym,
        price: sd.price,
        change: sd.change,
        volume: sd.volume,
        prevClose: sd.prevClose,
        hasEarningsToday: earningsToday.some(e => e.symbol === sym),
        earningsHour: earningsToday.find(e => e.symbol === sym)?.hour || null,
        hasNews: topNews.some(n => n.tickers?.includes(sym)),
      };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  // 3. Pre-market gaps (stocks gapping >2% from prev close)
  const preMarketGaps = tickerList
    .filter(sym => stockData[sym]?.preMarket && stockData[sym]?.prevClose)
    .map(sym => {
      const sd = stockData[sym];
      const gapPct = ((sd.preMarket - sd.prevClose) / sd.prevClose) * 100;
      return { symbol: sym, gapPct, preMarketPrice: sd.preMarket, prevClose: sd.prevClose };
    })
    .filter(g => Math.abs(g.gapPct) >= 1)
    .sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct))
    .slice(0, 5);

  // 4. Per-stock action items (derived from existing data, zero extra API calls)
  const actionItems = [];
  for (const sym of tickerList) {
    const sd = stockData[sym];
    if (!sd) continue;
    const items = [];

    // Big move today
    if (Math.abs(sd.change) >= 2) {
      items.push({ type: 'big_move', text: `${sd.change >= 0 ? 'Up' : 'Down'} ${Math.abs(sd.change).toFixed(1)}% today` });
    }

    // Pre-market gap
    if (sd.preMarket && sd.prevClose) {
      const gap = ((sd.preMarket - sd.prevClose) / sd.prevClose) * 100;
      if (Math.abs(gap) >= 1) {
        items.push({ type: 'gap', text: `Gapping ${gap >= 0 ? 'up' : 'down'} ${Math.abs(gap).toFixed(1)}% pre-market` });
      }
    }

    // Earnings today
    const earningsHit = earningsToday.find(e => e.symbol === sym);
    if (earningsHit) {
      items.push({ type: 'earnings_today', text: `Reports earnings ${earningsHit.hour === 'bmo' ? 'before open' : 'after close'} today` });
    }

    // Earnings upcoming (next 5 days)
    const upcomingHit = earningsUpcoming.find(e => e.symbol === sym);
    if (upcomingHit) {
      items.push({ type: 'earnings_soon', text: `Earnings on ${upcomingHit.date} (${upcomingHit.hour === 'bmo' ? 'pre' : 'post'})` });
    }

    // In the news
    const newsHit = topNews.find(n => n.tickers?.includes(sym));
    if (newsHit) {
      items.push({ type: 'in_news', text: `In the news: "${newsHit.title.slice(0, 60)}${newsHit.title.length > 60 ? '...' : ''}"` });
    }

    // Wide range day (high-low spread > 2.5% of price — volatile day)
    if (sd.dayHigh && sd.dayLow && sd.price) {
      const rangePct = ((sd.dayHigh - sd.dayLow) / sd.price) * 100;
      if (rangePct >= 2.5) {
        items.push({ type: 'volatile', text: `Wide range: $${sd.dayLow.toFixed(2)}-$${sd.dayHigh.toFixed(2)} (${rangePct.toFixed(1)}% spread)` });
      }
    }

    if (items.length > 0) {
      actionItems.push({ symbol: sym, price: sd.price, change: sd.change, items });
    }
  }
  actionItems.sort((a, b) => b.items.length - a.items.length || Math.abs(b.change) - Math.abs(a.change));

  // 5. Flag stocks that need attention
  const alertStocks = yourStocks.filter(s =>
    Math.abs(s.change) >= 2 || s.hasEarningsToday || s.hasNews
  );

  // 6. Early Signals — gainers not in user's stocks
  const earlySignals = gainers
    .filter(g => !userTickers.has(g.symbol))
    .slice(0, 5);

  // 7. Earnings overlap
  const yourEarnings = earningsToday.filter(e => userTickers.has(e.symbol));
  const otherNotableEarnings = earningsToday
    .filter(e => !userTickers.has(e.symbol))
    .filter(e => e.revenueEstimate > 1e9 || e.symbol?.length <= 4)
    .slice(0, 5);

  // 8. Upcoming earnings for user's stocks (next 5 trading days)
  const yourUpcomingEarnings = earningsUpcoming
    .filter(e => userTickers.has(e.symbol))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 9. Generate enriched AI Summary
  let aiSummary = '';
  try {
    const stocksSummary = yourStocks.length > 0
      ? `User holds/watches: ${yourStocks.slice(0, 15).map(s => `${s.symbol} ${formatPct(s.change)}`).join(', ')}`
      : 'User has no stocks tracked yet';

    const earningsSummary = yourEarnings.length > 0
      ? `Earnings TODAY from user's stocks: ${yourEarnings.map(e => `${e.symbol} (${e.hour === 'bmo' ? 'pre-market' : 'after close'})`).join(', ')}`
      : '';

    const upcomingEarningsSummary = yourUpcomingEarnings.length > 0
      ? `Upcoming earnings this week from user's stocks: ${yourUpcomingEarnings.slice(0, 5).map(e => `${e.symbol} on ${e.date}`).join(', ')}`
      : '';

    const signalsSummary = earlySignals.length > 0
      ? `Early movers NOT in user's portfolio: ${earlySignals.slice(0, 3).map(s => `${s.symbol} ${formatPct(s.change)}`).join(', ')}`
      : '';

    const gapsSummary = preMarketGaps.length > 0
      ? `Pre-market gaps in user's stocks: ${preMarketGaps.map(g => `${g.symbol} ${g.gapPct >= 0 ? '+' : ''}${g.gapPct.toFixed(1)}%`).join(', ')}`
      : '';

    const actionSummary = actionItems.length > 0
      ? `Key action items: ${actionItems.slice(0, 5).map(a => `${a.symbol}: ${a.items[0].text}`).join('; ')}`
      : '';

    // Build weekly performance summary for weekends
    const weeklyPerfSummary = weeklyPerformance && Object.keys(weeklyPerformance).length > 0
      ? `Weekly performance: ${Object.entries(weeklyPerformance).map(([sym, d]) => `${sym} ${d.weekChange >= 0 ? '+' : ''}${d.weekChange.toFixed(2)}% (range $${d.weekLow.toFixed(2)}-$${d.weekHigh.toFixed(2)})`).join(', ')}`
      : '';

    // Weekend vs weekday user stock summary
    const weeklyStockChanges = yourStocks.length > 0
      ? `User's stocks Friday close: ${yourStocks.slice(0, 15).map(s => `${s.symbol} $${s.price?.toFixed(2) || '?'} (${formatPct(s.change)} Fri)`).join(', ')}`
      : '';

    let prompt;
    if (isWeekend) {
      prompt = `You are JCKRBBT, an AI stock analyst assistant. Write a personalized WEEKEND market recap and preview for a trader. 5-7 sentences. Be specific, direct, and forward-looking. No disclaimers or hedging. Reference specific tickers, percentages, and price levels. Sound like a sharp trading desk analyst writing a weekend note.

This week's market performance:
${weeklyPerfSummary}
- Friday close: SPY ${formatPct(spy?.change)}, QQQ ${formatPct(qqq?.change)}, VIX at ${vix?.price?.toFixed(1) || '?'}

${weeklyStockChanges}
${upcomingEarningsSummary}
${signalsSummary}

Structure your response:
1. Recap the week in 1-2 sentences — what drove the market, any notable themes
2. Highlight the user's biggest winners and losers from the week
3. Look ahead to Monday — what earnings, events, or setups should they prepare for
4. One specific thing to research or plan this weekend before markets open

Do NOT use bullet points, headers, or formatting. Write in flowing sentences like a weekend research note. Start with "This week" or reference the week.`;
    } else {
      prompt = `You are JCKRBBT, an AI stock analyst assistant. Write a personalized morning market briefing for a trader. 4-6 sentences. Be specific, direct, and actionable. No disclaimers or hedging. Reference specific tickers, percentages, and price levels. Prioritize what the trader should DO or WATCH today. Sound like a sharp trading desk analyst giving a morning call.

Market conditions:
- SPY ${formatPct(spy?.change)}, QQQ ${formatPct(qqq?.change)}, VIX at ${vix?.price?.toFixed(1) || '?'}
- Market direction: ${marketPulse.direction}

${stocksSummary}
${gapsSummary}
${earningsSummary}
${upcomingEarningsSummary}
${actionSummary}
${signalsSummary}

Structure your response:
1. Lead with the single most important thing for THIS trader today (earnings, big gap, major move)
2. Quick market context (1 sentence)
3. Specific stocks to watch and why
4. One actionable suggestion

Do NOT use bullet points, headers, or formatting. Write in flowing sentences like a morning note.`;
    }

    aiSummary = await geminiGenerate(prompt);
  } catch (e) {
    console.error(`AI summary error for ${userId}:`, e);
    const upCount = yourStocks.filter(s => s.change > 0).length;
    const downCount = yourStocks.filter(s => s.change < 0).length;
    if (isWeekend) {
      aiSummary = `Markets closed the week with SPY ${formatPct(spy?.change)} on Friday. ${yourStocks.length > 0 ? `Of your ${yourStocks.length} tracked stocks, ${upCount} finished green and ${downCount} finished red.` : 'Start tracking stocks to get personalized weekend recaps.'} Check back for earnings and setups heading into Monday.`;
    } else {
      aiSummary = `Markets are ${spy?.change >= 0 ? 'pointing higher' : 'under pressure'} with SPY ${formatPct(spy?.change)}. ${yourStocks.length > 0 ? `Of your ${yourStocks.length} tracked stocks, ${upCount} are green and ${downCount} are red.` : 'Start tracking stocks to get personalized insights.'}`;
    }
  }

  // ===== COMPOSE BRIEFING OBJECT =====
  const briefing = {
    date: todayStr,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    isWeekend: !!isWeekend,
    aiSummary,
    marketPulse,
    yourStocks: yourStocks.slice(0, 20),
    alertStocks: alertStocks.slice(0, 5),
    earlySignals,
    yourEarnings,
    otherNotableEarnings,
    yourUpcomingEarnings: yourUpcomingEarnings.slice(0, 8),
    preMarketGaps,
    actionItems: actionItems.slice(0, 8),
    topNews: topNews.slice(0, 3),
    weeklyPerformance: weeklyPerformance || {},
    stats: {
      totalTracked: tickerList.length,
      greenCount: yourStocks.filter(s => s.change > 0).length,
      redCount: yourStocks.filter(s => s.change < 0).length,
      biggestGainer: yourStocks.length > 0 ? yourStocks.reduce((a, b) => a.change > b.change ? a : b, yourStocks[0]) : null,
      biggestLoser: yourStocks.length > 0 ? yourStocks.reduce((a, b) => a.change < b.change ? a : b, yourStocks[0]) : null,
    },
  };

  return briefing;
}

// ================================================================
// MAIN: Generate Daily Briefings
// Runs every day — weekdays at 6:30 AM ET, weekends at 8:30 AM ET
// ================================================================

exports.generateDailyBriefing = functions
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .pubsub.schedule('30 6 * * *') // 6:30 AM ET, every day
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const now = new Date();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;
    console.log(`🌅 Starting ${isWeekend ? 'weekend' : 'daily'} briefing generation...`);

    // 1. Fetch shared market data (one set of API calls for all users)
    const marketData = await fetchMarketData(isWeekend);
    marketData.isWeekend = isWeekend;
    console.log(`📊 Market data: SPY ${formatPct(marketData.indices['SPY']?.change)}, ${marketData.earningsToday.length} earnings today, ${marketData.earningsUpcoming.length} upcoming, ${marketData.gainers.length} early signals`);

    // 2. Get all users with push tokens
    const usersSnapshot = await db.collection('users')
      .where('pushToken', '!=', null)
      .get();

    if (usersSnapshot.empty) {
      console.log('No users with push tokens');
      return null;
    }

    console.log(`👥 Generating briefings for ${usersSnapshot.size} users`);

    const pushMessages = [];
    let successCount = 0;
    let errorCount = 0;

    // 3. Generate personalized briefing for each user
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const token = userData.pushToken;

      try {
        // Check notification settings
        let settings;
        try {
          const snap = await db.doc(`users/${userId}/settings/notifications`).get();
          settings = snap.exists ? snap.data() : {};
        } catch { settings = {}; }

        // Skip if user disabled briefings (default: enabled)
        if (settings.dailyBriefing === false) continue;

        // Generate briefing
        const briefing = await generateUserBriefing(userId, userData, marketData);

        // Store in Firestore
        await db.doc(`users/${userId}/briefings/${marketData.todayStr}`).set(briefing);

        // Queue push notification
        if (Expo.isExpoPushToken(token)) {
          const alertCount = briefing.alertStocks.length;
          const earningsCount = briefing.yourEarnings.length;

          let pushBody = briefing.aiSummary.slice(0, 150);
          if (pushBody.length >= 150) pushBody = pushBody.slice(0, 147) + '...';

          pushMessages.push({
            to: token,
            sound: 'default',
            title: isWeekend ? '📅 Your Weekend Recap' : '🌅 Your Morning Briefing',
            body: pushBody,
            data: { type: 'daily_briefing', date: marketData.todayStr },
            channelId: 'briefing',
          });
        }

        successCount++;
      } catch (e) {
        console.error(`Briefing error for ${userId}:`, e.message);
        errorCount++;
      }
    }

    // 4. Send all push notifications
    await sendPushNotifications(pushMessages);

    console.log(`✅ Daily briefings complete: ${successCount} generated, ${errorCount} errors, ${pushMessages.length} notifications sent`);
    return null;
  });

// ================================================================
// ALSO EXPORT: On-demand briefing (user can refresh manually)
// Called from the app when user pulls to refresh
// ================================================================

exports.refreshBriefing = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');

    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

    let uid;
    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    try {
      console.log(`🚀 refreshBriefing: starting for ${uid}`);
      const userDoc = await db.doc(`users/${uid}`).get();
      if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

      const now = new Date();
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;
      console.log(`👤 refreshBriefing: user found, fetching ${isWeekend ? 'weekend' : 'weekday'} market data...`);

      const marketData = await fetchMarketData(isWeekend);
      marketData.isWeekend = isWeekend;
      console.log(`📊 refreshBriefing: market data ready, generating briefing...`);

      const briefing = await generateUserBriefing(uid, userDoc.data(), marketData);
      console.log(`📋 Briefing for ${uid}: ${briefing.yourStocks?.length || 0} stocks, ${briefing.actionItems?.length || 0} actions, ${briefing.preMarketGaps?.length || 0} gaps, ${briefing.yourUpcomingEarnings?.length || 0} upcoming earnings, ${briefing.alertStocks?.length || 0} alerts`);

      // Store
      await db.doc(`users/${uid}/briefings/${marketData.todayStr}`).set(briefing);
      console.log(`✅ refreshBriefing: saved and responding`);

      res.json({ success: true, briefing });
    } catch (e) {
      console.error('Refresh briefing error:', e);
      res.status(500).json({ error: 'Failed to generate briefing' });
    }
  });
