// functions/upvoteNotifications.js
// Firestore trigger — sends push notification when trade ideas hit upvote milestones
//
// SETUP:
// 1. Add to functions/index.js:
//    const { onIdeaUpvoted } = require('./upvoteNotifications');
//    exports.onIdeaUpvoted = onIdeaUpvoted;
//
// 2. Deploy:
//    firebase deploy --only functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

const MILESTONES = [1, 5, 10, 25, 50, 100];

// ========== Send push notification ==========
async function sendPush(token, title, body, data = {}) {
  if (!token || !Expo.isExpoPushToken(token)) return;
  try {
    const [ticket] = await expo.sendPushNotificationsAsync([{
      to: token,
      sound: 'default',
      title,
      body,
      data,
      channelId: 'default',
    }]);
    if (ticket.status === 'error') {
      console.error('Push error:', ticket.message);
      if (ticket.details?.error === 'DeviceNotRegistered') {
        // Remove invalid token
        const snapshot = await db.collection('users').where('pushToken', '==', token).get();
        snapshot.forEach(doc => doc.ref.update({ pushToken: null }));
      }
    }
  } catch (e) { console.error('Push send error:', e); }
}

// ========== Write in-app notification ==========
async function writeNotification(userId, { title, body, type, symbol, ideaId }) {
  try {
    await db.collection('users').doc(userId).collection('notifications').add({
      title,
      body,
      type: type || 'upvote_milestone',
      symbol: symbol || null,
      ideaId: ideaId || null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { console.error('Write notification error:', e); }
}

// ========== Main trigger ==========
exports.onIdeaUpvoted = functions
  .runWith({ memory: '256MB' })
  .firestore.document('tradeIdeas/{ideaId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const ideaId = context.params.ideaId;

    // Only care about upvote increases
    const oldCount = before.upvotes || 0;
    const newCount = after.upvotes || 0;
    if (newCount <= oldCount) return null;

    // Check if we hit a milestone
    const hitMilestone = MILESTONES.find(m => oldCount < m && newCount >= m);
    if (!hitMilestone) return null;

    // Don't notify the author about their own upvotes if they just upvoted themselves (shouldn't happen but safety)
    const authorId = after.userId;
    if (!authorId) return null;

    // Cooldown: don't send more than one upvote notification per idea per hour
    const alertKey = `upvote_${ideaId}_${hitMilestone}`;
    try {
      const logSnap = await db.doc(`users/${authorId}/alertLog/${alertKey}`).get();
      if (logSnap.exists) {
        const lastSent = logSnap.data().sentAt?.toDate?.() || new Date(logSnap.data().sentAt);
        if ((Date.now() - lastSent.getTime()) < 3600000) return null; // 1hr cooldown
      }
    } catch {}

    // Get author's push token
    const authorDoc = await db.collection('users').doc(authorId).get();
    if (!authorDoc.exists) return null;
    const authorData = authorDoc.data();
    const pushToken = authorData.pushToken;

    const symbol = after.symbol || '';
    const title = '🔥 Your idea is getting traction!';
    const body = hitMilestone === 1
      ? `Your ${symbol} idea just got its first upvote!`
      : `Your ${symbol} idea hit ${hitMilestone} upvotes!`;

    // Send push notification
    await sendPush(pushToken, title, body, {
      type: 'upvote_milestone',
      symbol,
      ideaId,
    });

    // Write in-app notification
    await writeNotification(authorId, {
      title,
      body,
      type: 'upvote_milestone',
      symbol,
      ideaId,
    });

    // Log to prevent spam
    await db.doc(`users/${authorId}/alertLog/${alertKey}`).set({
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`🔔 Upvote milestone: ${symbol} idea hit ${hitMilestone} upvotes (user: ${authorId})`);
    return null;
  });
