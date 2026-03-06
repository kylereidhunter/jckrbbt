const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

admin.initializeApp();

// ============================================================
// CONFIG — uses functions/.env (not deprecated functions.config())
// ============================================================

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'production';

const POLYGON_KEY = process.env.POLYGON_KEY;
const FINNHUB_KEY = process.env.FINNHUB_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;

// ============================================================
// PLAID CLIENT
// ============================================================

const configuration = new Configuration({
  basePath: PLAID_ENV === 'production' ? PlaidEnvironments.production : PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// ============================================================
// HELPERS
// ============================================================

const setCorsHeaders = (res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
};

const verifyAuth = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
};

// ============================================================
// POLYGON PROXY
// ============================================================
// Usage: /polygonProxy?path=/v2/snapshot/locale/us/markets/stocks/tickers&tickers=AAPL,MSFT

exports.polygonProxy = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { path, ...queryParams } = req.query;

    if (!path) {
      return res.status(400).json({ error: "Missing 'path' parameter" });
    }

    const params = new URLSearchParams(queryParams);
    params.set('apiKey', POLYGON_KEY);

    const url = `https://api.polygon.io${path}?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (path.includes('snapshot') || path.includes('reference')) {
      res.set('Cache-Control', 'public, max-age=5, s-maxage=5');
    }

    res.status(response.status).json(data);
  } catch (error) {
    console.error('Polygon proxy error:', error);
    res.status(500).json({ error: 'Polygon API request failed' });
  }
});

// ============================================================
// FINNHUB PROXY
// ============================================================
// Usage: /finnhubProxy?path=/api/v1/company-news&symbol=AAPL&from=2026-02-01&to=2026-02-14

exports.finnhubProxy = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { path, ...queryParams } = req.query;

    if (!path) {
      return res.status(400).json({ error: "Missing 'path' parameter" });
    }

    const params = new URLSearchParams(queryParams);
    params.set('token', FINNHUB_KEY);

    const url = `https://finnhub.io${path}?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Finnhub proxy error:', error);
    res.status(500).json({ error: 'Finnhub API request failed' });
  }
});

// ============================================================
// GEMINI AI PROXY
// ============================================================
// Usage: POST /geminiProxy  Body: { model: "gemini-2.0-flash", contents: [...] }

exports.geminiProxy = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const { model, contents, generationConfig, systemInstruction } = req.body;

    const modelName = model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`;

    const body = { contents };
    if (generationConfig) body.generationConfig = generationConfig;
    if (systemInstruction) body.systemInstruction = systemInstruction;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Gemini proxy error:', error);
    res.status(500).json({ error: 'Gemini API request failed' });
  }
});

// ============================================================
// PLAID FUNCTIONS (existing — unchanged)
// ============================================================

// Create Link Token
exports.createLinkToken = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
    const request = {
      user: {
        client_user_id: userId,
      },
      client_name: 'Jackrabbit',
      products: ['investments'],
      country_codes: ['US'],
      language: 'en',
    };

    const response = await plaidClient.linkTokenCreate(request);
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exchange Token
exports.exchangePlaidToken = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
    const { publicToken } = req.body;
    
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('plaidItems')
      .doc(itemId)
      .set({
        accessToken: accessToken,
        itemId: itemId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.json({ 
      success: true,
      item_id: itemId
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Holdings
exports.getHoldings = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
    const brokerageId = req.body?.brokerageId || req.query?.brokerageId;
    
    let accessToken;

    if (brokerageId) {
      const itemDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('plaidItems')
        .doc(brokerageId)
        .get();

      if (!itemDoc.exists) {
        const userDoc = await admin.firestore()
          .collection('users')
          .doc(userId)
          .get();
        
        accessToken = userDoc.data()?.plaidAccessToken;
        
        if (!accessToken) {
          return res.status(404).json({ error: 'Brokerage account not found' });
        }
      } else {
        accessToken = itemDoc.data()?.accessToken;
      }
    } else {
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .get();

      accessToken = userDoc.data()?.plaidAccessToken;
      
      if (!accessToken) {
        return res.status(404).json({ error: 'No brokerage account linked' });
      }
    }

    const response = await plaidClient.investmentsHoldingsGet({
      access_token: accessToken,
    });

    res.json({
      accounts: response.data.accounts,
      holdings: response.data.holdings,
      securities: response.data.securities,
    });
  } catch (error) {
    console.error('Error fetching holdings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect Brokerage
exports.disconnectBrokerage = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
    const { brokerageId } = req.body;

    if (!brokerageId) {
      return res.status(400).json({ error: 'brokerageId is required' });
    }

    const itemDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('plaidItems')
      .doc(brokerageId)
      .get();

    if (itemDoc.exists) {
      const accessToken = itemDoc.data()?.accessToken;

      if (accessToken) {
        try {
          await plaidClient.itemRemove({
            access_token: accessToken,
          });
        } catch (plaidError) {
          console.warn('Could not remove item from Plaid:', plaidError.message);
        }
      }

      await admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('plaidItems')
        .doc(brokerageId)
        .delete();
    } else {
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .get();

      if (userDoc.data()?.plaidItemId === brokerageId || brokerageId === 'legacy_brokerage') {
        const accessToken = userDoc.data()?.plaidAccessToken;
        
        if (accessToken) {
          try {
            await plaidClient.itemRemove({
              access_token: accessToken,
            });
          } catch (plaidError) {
            console.warn('Could not remove legacy item from Plaid:', plaidError.message);
          }
        }

        await admin.firestore()
          .collection('users')
          .doc(userId)
          .update({
            plaidAccessToken: admin.firestore.FieldValue.delete(),
            plaidItemId: admin.firestore.FieldValue.delete(),
            brokerageConnected: false,
          });
      } else {
        return res.status(404).json({ error: 'Brokerage not found' });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting brokerage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Legacy disconnect
exports.disconnectPlaid = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
    await admin.firestore()
      .collection('users')
      .doc(userId)
      .update({
        plaidAccessToken: admin.firestore.FieldValue.delete(),
        plaidItemId: admin.firestore.FieldValue.delete(),
        brokerageConnected: false,
      });

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PUSH NOTIFICATION ALERTS
// ============================================================

const { checkAlerts, sendEarningsReminders, sendEarningsResults } = require('./notificationAlerts');
exports.checkAlerts = checkAlerts;
exports.sendEarningsReminders = sendEarningsReminders;
exports.sendEarningsResults = sendEarningsResults;

// ============================================================
// DAILY BRIEFING
// ============================================================

const { generateDailyBriefing, refreshBriefing } = require('./dailyBriefing');
exports.generateDailyBriefing = generateDailyBriefing;
exports.refreshBriefing = refreshBriefing;

// ============================================================
// UPVOTE NOTIFICATIONS (trade ideas)
// ============================================================

const { onIdeaUpvoted } = require('./upvoteNotifications');
exports.onIdeaUpvoted = onIdeaUpvoted;

// ============================================================
// OPTIONS FLOW SCANNER
// ============================================================

const { scanOptionsFlow, scanOptionsFlowManual } = require('./optionsFlowScanner');
exports.scanOptionsFlow = scanOptionsFlow;
exports.scanOptionsFlowManual = scanOptionsFlowManual;
// ============================================================
// X AUTO-POSTING
// ============================================================

const { postMorningScan, postMarketClose, postManual, postMiddayMovers, postWeeklyScorecard, postBreakingAlert } = require('./xAutoPost');
exports.postMorningScan = postMorningScan;
exports.postMarketClose = postMarketClose;
exports.postManual = postManual;
exports.postMiddayMovers = postMiddayMovers;
exports.postWeeklyScorecard = postWeeklyScorecard;
exports.postBreakingAlert = postBreakingAlert;
