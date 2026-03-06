// functions/notificationAlerts.js
// Scheduled Cloud Function — checks portfolios, watchlists, earnings
// and sends Expo push notifications to users
//
// SETUP:
// 1. Add to your existing functions/index.js:
//    const { checkAlerts, sendEarningsReminders } = require('./notificationAlerts');
//    exports.checkAlerts = checkAlerts;
//    exports.sendEarningsReminders = sendEarningsReminders;
//
// 2. Install deps in functions/:
//    cd functions && npm install expo-server-sdk node-fetch@2
//
// 3. Deploy:
//    firebase deploy --only functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');

// Initialize if not already done (your index.js may already do this)
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

const POLYGON_API_KEY = process.env.POLYGON_KEY;

// ========== HELPER: Fetch Polygon snapshot ==========
async function getSnapshots(tickers) {
  if (!tickers || tickers.length === 0) return {};
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(',')}&apiKey=${POLYGON_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const map = {};
    (data.tickers || []).forEach(t => {
      map[t.ticker] = {
        price: t.day?.c || t.prevDay?.c || 0,
        change: t.todaysChangePerc || 0,
        volume: t.day?.v || 0,
      };
    });
    return map;
  } catch (e) {
    console.error('Polygon snapshot error:', e);
    return {};
  }
}

// ========== HELPER: Check if market hours ==========
function isMarketHours() {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false; // weekend
  const hour = et.getHours();
  const min = et.getMinutes();
  const totalMin = hour * 60 + min;
  // 9:15 AM to 4:30 PM ET (start slightly before open, end slightly after close)
  return totalMin >= 555 && totalMin <= 990;
}

// ========== HELPER: Send Expo push notifications ==========
async function sendPushNotifications(messages) {
  if (messages.length === 0) return;
  
  // Filter valid tokens
  const validMessages = messages.filter(m => Expo.isExpoPushToken(m.to));
  if (validMessages.length === 0) return;

  const chunks = expo.chunkPushNotifications(validMessages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      // Log any errors
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'error') {
          console.error(`Push error for ${chunk[i].to}:`, ticket.message);
          // If token is invalid, remove it
          if (ticket.details?.error === 'DeviceNotRegistered') {
            removeInvalidToken(chunk[i].to);
          }
        }
      });
    } catch (e) {
      console.error('Push chunk error:', e);
    }
  }
  console.log(`📨 Sent ${validMessages.length} push notifications`);
}

async function removeInvalidToken(token) {
  try {
    const snapshot = await db.collection('users').where('pushToken', '==', token).get();
    snapshot.forEach(doc => {
      doc.ref.update({ pushToken: null });
      console.log(`🗑 Removed invalid token for user ${doc.id}`);
    });
  } catch (e) { console.error('Remove token error:', e); }
}

// ========== HELPER: Get user notification settings ==========
async function getUserSettings(userId) {
  const defaults = {
    portfolioAlerts: true,
    portfolioThreshold: 5,
    earningsReminders: true,
    watchlistAlerts: true,
    watchlistThreshold: 5,
    quietHoursStart: 22,
    quietHoursEnd: 7,
  };
  try {
    const snap = await db.doc(`users/${userId}/settings/notifications`).get();
    return snap.exists ? { ...defaults, ...snap.data() } : defaults;
  } catch { return defaults; }
}

// ========== HELPER: Check quiet hours ==========
function isQuietHours(settings) {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = et.getHours();
  const { quietHoursStart, quietHoursEnd } = settings;
  if (quietHoursStart > quietHoursEnd) {
    // Wraps midnight: e.g. 22-7
    return hour >= quietHoursStart || hour < quietHoursEnd;
  }
  return hour >= quietHoursStart && hour < quietHoursEnd;
}

// ========== HELPER: Deduplicate — don't spam same alert ==========
async function hasRecentAlert(userId, alertKey, cooldownMinutes = 60) {
  try {
    const snap = await db.doc(`users/${userId}/alertLog/${alertKey}`).get();
    if (!snap.exists) return false;
    const lastSent = snap.data().sentAt?.toDate?.() || new Date(snap.data().sentAt);
    const elapsed = (Date.now() - lastSent.getTime()) / 60000;
    return elapsed < cooldownMinutes;
  } catch { return false; }
}

async function logAlert(userId, alertKey) {
  try {
    await db.doc(`users/${userId}/alertLog/${alertKey}`).set({
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { console.error('Log alert error:', e); }
}

// ================================================================
// MAIN FUNCTION: Check portfolio & watchlist alerts
// Runs every 15 minutes during market hours
// ================================================================
exports.checkAlerts = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .pubsub.schedule('every 15 minutes')
  .timeZone('America/New_York')
  .onRun(async () => {
    // Only run during market hours
    if (!isMarketHours()) {
      console.log('⏸ Market closed, skipping alert check');
      return null;
    }

    console.log('🔔 Starting alert check...');
    const messages = [];

    // Get all users with push tokens
    const usersSnapshot = await db.collection('users')
      .where('pushToken', '!=', null)
      .get();

    if (usersSnapshot.empty) {
      console.log('No users with push tokens');
      return null;
    }

    console.log(`👥 Checking ${usersSnapshot.size} users with push tokens`);

    // Collect all unique tickers we need to check
    const allTickers = new Set();
    const userDataMap = new Map();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const settings = await getUserSettings(userId);

      if (isQuietHours(settings)) continue;

      const userInfo = { userData, settings, portfolioTickers: [], watchlistTickers: [], priceAlerts: [] };

      // Portfolio tickers
      if (settings.portfolioAlerts && userData.connectedBrokerages?.length > 0) {
        try {
          // Fetch holdings from Plaid for each brokerage
          for (const brokerage of userData.connectedBrokerages) {
            const holdingsSnap = await db.doc(`users/${userId}/holdings/${brokerage.id}`).get();
            if (holdingsSnap.exists) {
              const holdings = holdingsSnap.data().positions || [];
              holdings.forEach(h => {
                if (h.symbol && h.symbol !== 'N/A' && !h.symbol.includes(':')) {
                  allTickers.add(h.symbol);
                  userInfo.portfolioTickers.push({
                    symbol: h.symbol,
                    costBasis: h.costBasis || 0,
                    quantity: h.quantity || 0,
                  });
                }
              });
            }
          }
        } catch (e) { console.log(`Portfolio fetch error for ${userId}:`, e.message); }
      }

      // Watchlist tickers
      if (settings.watchlistAlerts) {
        try {
          const watchlistsSnap = await db.collection(`users/${userId}/watchlists`).get();
          watchlistsSnap.forEach(wDoc => {
            const wData = wDoc.data();
            (wData.tickers || []).forEach(t => {
              const sym = typeof t === 'string' ? t : t.symbol;
              if (sym) {
                allTickers.add(sym);
                userInfo.watchlistTickers.push(sym);
              }
            });
          });
        } catch (e) { console.log(`Watchlist fetch error for ${userId}:`, e.message); }
      }

      // Price alert tickers
      try {
        const alertsSnap = await db.collection(`users/${userId}/priceAlerts`)
          .where('triggered', '==', false).get();
        alertsSnap.forEach(aDoc => {
          const alert = { id: aDoc.id, ...aDoc.data() };
          if (alert.symbol) {
            allTickers.add(alert.symbol);
            userInfo.priceAlerts.push(alert);
          }
        });
      } catch (e) { console.log(`Price alerts fetch error for ${userId}:`, e.message); }

      userDataMap.set(userId, userInfo);
    }

    if (allTickers.size === 0) {
      console.log('No tickers to check');
      return null;
    }

    // Batch fetch all prices (Polygon allows up to ~200 per call)
    const tickerArray = [...allTickers];
    const priceData = {};
    for (let i = 0; i < tickerArray.length; i += 100) {
      const batch = tickerArray.slice(i, i + 100);
      const batchData = await getSnapshots(batch);
      Object.assign(priceData, batchData);
    }

    console.log(`📊 Fetched prices for ${Object.keys(priceData).length} tickers`);

    // Check each user
    for (const [userId, userInfo] of userDataMap) {
      const { userData, settings } = userInfo;
      const token = userData.pushToken;

      // ===== PORTFOLIO ALERTS =====
      if (settings.portfolioAlerts) {
        const bigMovers = [];
        for (const holding of userInfo.portfolioTickers) {
          const snap = priceData[holding.symbol];
          if (!snap) continue;
          const absChange = Math.abs(snap.change);
          if (absChange >= settings.portfolioThreshold) {
            bigMovers.push({
              symbol: holding.symbol,
              change: snap.change,
              price: snap.price,
            });
          }
        }

        if (bigMovers.length > 0) {
          const alertKey = `portfolio_${new Date().toISOString().split('T')[0]}`;
          const alreadySent = await hasRecentAlert(userId, alertKey, 120); // 2hr cooldown
          if (!alreadySent) {
            const top = bigMovers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 3);
            const moversText = top.map(m => 
              `${m.symbol} ${m.change >= 0 ? '+' : ''}${m.change.toFixed(1)}%`
            ).join(', ');

            messages.push({
              to: token,
              sound: 'default',
              title: `📈 Portfolio Alert`,
              body: bigMovers.length === 1
                ? `${top[0].symbol} is ${top[0].change >= 0 ? 'up' : 'down'} ${Math.abs(top[0].change).toFixed(1)}% ($${top[0].price.toFixed(2)})`
                : `${bigMovers.length} positions moving: ${moversText}`,
              data: { type: 'portfolio_alert', symbols: bigMovers.map(m => m.symbol) },
              channelId: 'portfolio',
            });
            await logAlert(userId, alertKey);
          }
        }
      }

      // ===== WATCHLIST ALERTS =====
      if (settings.watchlistAlerts) {
        const watchlistMovers = [];
        const uniqueWatchlistSymbols = [...new Set(userInfo.watchlistTickers)];
        for (const symbol of uniqueWatchlistSymbols) {
          const snap = priceData[symbol];
          if (!snap) continue;
          if (Math.abs(snap.change) >= settings.watchlistThreshold) {
            watchlistMovers.push({
              symbol,
              change: snap.change,
              price: snap.price,
            });
          }
        }

        if (watchlistMovers.length > 0) {
          const alertKey = `watchlist_${new Date().toISOString().split('T')[0]}`;
          const alreadySent = await hasRecentAlert(userId, alertKey, 120);
          if (!alreadySent) {
            const top = watchlistMovers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 3);
            const moversText = top.map(m =>
              `${m.symbol} ${m.change >= 0 ? '+' : ''}${m.change.toFixed(1)}%`
            ).join(', ');

            messages.push({
              to: token,
              sound: 'default',
              title: `👀 Watchlist Alert`,
              body: watchlistMovers.length === 1
                ? `${top[0].symbol} is ${top[0].change >= 0 ? 'up' : 'down'} ${Math.abs(top[0].change).toFixed(1)}%`
                : `${watchlistMovers.length} watchlist stocks moving: ${moversText}`,
              data: { type: 'watchlist_alert', symbols: watchlistMovers.map(m => m.symbol) },
              channelId: 'default',
            });
            await logAlert(userId, alertKey);
          }
        }
      }

      // ===== PRICE ALERTS =====
      for (const alert of userInfo.priceAlerts) {
        const snap = priceData[alert.symbol];
        if (!snap) continue;
        const currentPrice = snap.price;
        const triggered = (alert.direction === 'above' && currentPrice >= alert.targetPrice)
          || (alert.direction === 'below' && currentPrice <= alert.targetPrice);

        if (triggered) {
          const alertKey = `price_${alert.id}`;
          const alreadySent = await hasRecentAlert(userId, alertKey, 1440); // 24hr cooldown
          if (!alreadySent) {
            const arrow = alert.direction === 'above' ? '📈' : '📉';
            messages.push({
              to: token,
              sound: 'default',
              title: `${arrow} Price Alert: ${alert.symbol}`,
              body: `${alert.symbol} ${alert.direction === 'above' ? 'rose above' : 'dropped below'} $${alert.targetPrice.toFixed(2)} — now at $${currentPrice.toFixed(2)}`,
              data: { type: 'price_alert', symbol: alert.symbol },
              channelId: 'default',
            });
            await logAlert(userId, alertKey);

            // Mark alert as triggered
            try {
              await db.doc(`users/${userId}/priceAlerts/${alert.id}`).update({
                triggered: true,
                triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
                triggeredPrice: currentPrice,
              });
            } catch (e) { console.error('Mark triggered error:', e); }
          }
        }
      }
    }

    // Send all notifications
    await sendPushNotifications(messages);
    console.log(`✅ Alert check complete. ${messages.length} notifications queued.`);
    return null;
  });

// ================================================================
// EARNINGS REMINDERS: Runs daily at 6 PM ET
// Checks all users' portfolio + watchlist for earnings tomorrow
// ================================================================
exports.sendEarningsReminders = functions
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('0 18 * * 1-5') // 6 PM ET, weekdays only
  .timeZone('America/New_York')
  .onRun(async () => {
    console.log('📅 Checking earnings reminders...');
    const messages = [];

    // Tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Fetch earnings calendar for tomorrow from Finnhub
    let earningsTomorrow = new Set();
    try {
      const finnhubKey = process.env.FINNHUB_KEY;
      const url = `https://finnhub.io/api/v1/calendar/earnings?from=${tomorrowStr}&to=${tomorrowStr}&token=${finnhubKey}`;
      const res = await fetch(url);
      const data = await res.json();
      (data.earningsCalendar || []).forEach(e => {
        if (e.symbol) earningsTomorrow.add(e.symbol);
      });
      console.log(`📊 ${earningsTomorrow.size} companies reporting earnings tomorrow`);
    } catch (e) {
      console.error('Finnhub earnings fetch error:', e);
      return null;
    }

    if (earningsTomorrow.size === 0) return null;

    // Check each user
    const usersSnapshot = await db.collection('users')
      .where('pushToken', '!=', null)
      .get();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const settings = await getUserSettings(userId);
      if (!settings.earningsReminders) continue;
      if (isQuietHours(settings)) continue;

      const token = userData.pushToken;
      const matchingSymbols = [];

      // Check portfolio
      if (userData.connectedBrokerages?.length > 0) {
        for (const brokerage of userData.connectedBrokerages) {
          try {
            const holdingsSnap = await db.doc(`users/${userId}/holdings/${brokerage.id}`).get();
            if (holdingsSnap.exists) {
              (holdingsSnap.data().positions || []).forEach(h => {
                if (h.symbol && earningsTomorrow.has(h.symbol)) {
                  matchingSymbols.push({ symbol: h.symbol, source: 'portfolio' });
                }
              });
            }
          } catch {}
        }
      }

      // Check watchlists
      try {
        const watchlistsSnap = await db.collection(`users/${userId}/watchlists`).get();
        watchlistsSnap.forEach(wDoc => {
          (wDoc.data().tickers || []).forEach(t => {
            const sym = typeof t === 'string' ? t : t.symbol;
            if (sym && earningsTomorrow.has(sym) && !matchingSymbols.some(m => m.symbol === sym)) {
              matchingSymbols.push({ symbol: sym, source: 'watchlist' });
            }
          });
        });
      } catch {}

      if (matchingSymbols.length > 0) {
        const alertKey = `earnings_${tomorrowStr}`;
        const alreadySent = await hasRecentAlert(userId, alertKey, 1440); // 24hr cooldown
        if (!alreadySent) {
          const symbols = matchingSymbols.map(m => m.symbol);
          const portfolioSymbols = matchingSymbols.filter(m => m.source === 'portfolio').map(m => m.symbol);

          let body;
          if (matchingSymbols.length === 1) {
            body = `${symbols[0]} reports earnings tomorrow${portfolioSymbols.includes(symbols[0]) ? ' — you hold this stock' : ''}.`;
          } else {
            body = `${symbols.join(', ')} report earnings tomorrow. ${portfolioSymbols.length > 0 ? `You hold ${portfolioSymbols.join(', ')}.` : ''}`;
          }

          messages.push({
            to: token,
            sound: 'default',
            title: `📊 Earnings Tomorrow`,
            body,
            data: { type: 'earnings_reminder', symbols },
            channelId: 'earnings',
          });
          await logAlert(userId, alertKey);
        }
      }
    }

    await sendPushNotifications(messages);
    console.log(`✅ Earnings reminders sent: ${messages.length}`);
    return null;
  });
