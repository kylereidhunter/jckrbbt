const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

admin.initializeApp();

// Initialize Plaid client
const PLAID_CLIENT_ID = functions.config().plaid?.client_id || '6978f77110c986001d23496d';
const PLAID_SECRET = functions.config().plaid?.secret || 'fc9f96184fc3ed0fbb85bd06f8af1d';
const PLAID_ENV = functions.config().plaid?.env || 'production';

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

// Helper to add CORS headers
const setCorsHeaders = (res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
};

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

// Exchange Token - UPDATED FOR MULTI-BROKERAGE
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

    // Store the access token in a subcollection for multi-brokerage support
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

    // Return the item_id so frontend can track this brokerage
    res.json({ 
      success: true,
      item_id: itemId
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Holdings - UPDATED FOR MULTI-BROKERAGE
exports.getHoldings = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const userId = await verifyAuth(req, res);
  if (!userId) return;

  try {
    // Get brokerageId from request body (POST) or query params (GET)
    const brokerageId = req.body?.brokerageId || req.query?.brokerageId;
    
    let accessToken;

    if (brokerageId) {
      // New multi-brokerage: fetch from subcollection
      const itemDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('plaidItems')
        .doc(brokerageId)
        .get();

      if (!itemDoc.exists) {
        // Fallback: check if it's the legacy single brokerage
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
      // Legacy support: no brokerageId provided, use old single token
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

// Disconnect Brokerage - UPDATED FOR MULTI-BROKERAGE
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

    // Get the access token to remove the item from Plaid
    const itemDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('plaidItems')
      .doc(brokerageId)
      .get();

    if (itemDoc.exists) {
      const accessToken = itemDoc.data()?.accessToken;

      // Remove item from Plaid (optional but recommended)
      if (accessToken) {
        try {
          await plaidClient.itemRemove({
            access_token: accessToken,
          });
        } catch (plaidError) {
          console.warn('Could not remove item from Plaid:', plaidError.message);
          // Continue anyway - we still want to remove from our database
        }
      }

      // Delete from subcollection
      await admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('plaidItems')
        .doc(brokerageId)
        .delete();
    } else {
      // Check if it's the legacy brokerage
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .get();

      if (userDoc.data()?.plaidItemId === brokerageId || brokerageId === 'legacy_brokerage') {
        // Remove legacy brokerage data
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

// Legacy disconnect (keep for backward compatibility)
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