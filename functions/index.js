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

// Create Link Token - CALLABLE VERSION
exports.createLinkToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  try {
    const request = {
      user: {
        client_user_id: context.auth.uid,
      },
      client_name: 'Jackrabbit',
      products: ['investments'],
      country_codes: ['US'],
      language: 'en',
    };

    const response = await plaidClient.linkTokenCreate(request);
    return { link_token: response.data.link_token };
  } catch (error) {
    console.error('Error creating link token:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Exchange Token - CALLABLE VERSION
exports.exchangePlaidToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: data.publicToken,
    });

    await admin.firestore()
      .collection('users')
      .doc(context.auth.uid)
      .set({
        plaidAccessToken: response.data.access_token,
        plaidItemId: response.data.item_id,
        brokerageConnected: true,
      }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Error exchanging token:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Get Holdings - CALLABLE VERSION
exports.getHoldings = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  try {
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(context.auth.uid)
      .get();

    const accessToken = userDoc.data()?.plaidAccessToken;
    
    if (!accessToken) {
      throw new functions.https.HttpsError('not-found', 'No brokerage account linked');
    }

    const response = await plaidClient.investmentsHoldingsGet({
      access_token: accessToken,
    });

    return {
      accounts: response.data.accounts,
      holdings: response.data.holdings,
      securities: response.data.securities,
    };
  } catch (error) {
    console.error('Error fetching holdings:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Disconnect - CALLABLE VERSION
exports.disconnectPlaid = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  try {
    await admin.firestore()
      .collection('users')
      .doc(context.auth.uid)
      .update({
        plaidAccessToken: admin.firestore.FieldValue.delete(),
        plaidItemId: admin.firestore.FieldValue.delete(),
        brokerageConnected: false,
      });

    return { success: true };
  } catch (error) {
    console.error('Error disconnecting:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});