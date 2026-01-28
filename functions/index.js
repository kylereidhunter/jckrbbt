const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

admin.initializeApp();

// Initialize Plaid client
const PLAID_CLIENT_ID = '6978f77110c986001d23496d';
const PLAID_SECRET = '6544e168f07174e7f553dc138eef32';

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Helper to verify Firebase auth token
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

// Create Link Token
exports.createLinkToken = functions.https.onRequest(async (req, res) => {
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
  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
    const { publicToken } = req.body;
    
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    await admin.firestore()
      .collection('users')
      .doc(userId)
      .set({
        plaidAccessToken: response.data.access_token,
        plaidItemId: response.data.item_id,
        brokerageConnected: true,
      }, { merge: true });

    res.json({ success: true });
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Holdings
exports.getHoldings = functions.https.onRequest(async (req, res) => {
  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();

    const accessToken = userDoc.data()?.plaidAccessToken;
    
    if (!accessToken) {
      return res.status(404).json({ error: 'No brokerage account linked' });
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

// Disconnect
exports.disconnectPlaid = functions.https.onRequest(async (req, res) => {
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