// activityService.js
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

// Log an activity event
export const logActivity = async (db, { userId, userName, userAvatar, type, targetSymbol, targetListId, targetListName, metadata = {} }) => {
  try {
    await addDoc(collection(db, 'activities'), {
      userId,
      userName: userName || 'Anonymous',
      userAvatar: userAvatar || null,
      type, // 'add_stock' | 'remove_stock' | 'create_list' | 'follow_list'
      targetSymbol: targetSymbol || null,
      targetListId: targetListId || null,
      targetListName: targetListName || null,
      metadata,
      timestamp: new Date().toISOString(),
      createdAt: Timestamp.now()
    });
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
};

// Get activity feed for a user (activities from people they follow)
export const getActivityFeed = async (db, followingList = [], limitCount = 50) => {
  if (!followingList || followingList.length === 0) return [];
  
  try {
    // Firestore 'in' supports max 30 values, so batch if needed
    const batches = [];
    for (let i = 0; i < followingList.length; i += 30) {
      batches.push(followingList.slice(i, i + 30));
    }
    
    let allActivities = [];
    
    for (const batch of batches) {
      const q = query(
        collection(db, 'activities'),
        where('userId', 'in', batch),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        allActivities.push({ id: doc.id, ...doc.data() });
      });
    }
    
    // Sort all results by timestamp descending
    allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return allActivities.slice(0, limitCount);
  } catch (e) {
    console.error('Failed to fetch activity feed:', e);
    return [];
  }
};

// Get global/discover feed (recent activities from everyone — for users who don't follow anyone yet)
export const getGlobalFeed = async (db, limitCount = 30) => {
  try {
    const q = query(
      collection(db, 'activities'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const activities = [];
    snapshot.forEach(doc => {
      activities.push({ id: doc.id, ...doc.data() });
    });
    return activities;
  } catch (e) {
    console.error('Failed to fetch global feed:', e);
    return [];
  }
};