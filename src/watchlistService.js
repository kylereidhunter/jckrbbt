import { collection, doc, setDoc, getDoc, getDocs, query, where, deleteDoc, updateDoc, arrayUnion, arrayRemove, orderBy, limit, increment } from 'firebase/firestore';
import { db } from './firebase';


// Create a new watchlist
export const createWatchlist = async (userId, name, description, isPublic) => {
  const listId = `${userId}_${Date.now()}`;
  const listRef = doc(db, 'watchlists', listId);
  
  await setDoc(listRef, {
    id: listId,
    ownerId: userId,
    name,
    description: description || '',
    isPublic,
    stocks: [],
    followerCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  
  return listId;
};

// Get user's watchlists
export const getUserWatchlists = async (userId) => {
  const q = query(
    collection(db, 'watchlists'),
    where('ownerId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
};

// Get public watchlists
export const getPublicWatchlists = async (limitCount = 20) => {
  const q = query(
    collection(db, 'watchlists'),
    where('isPublic', '==', true),
    orderBy('followerCount', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
};

// Add stock to watchlist
export const addStockToWatchlist = async (listId, stock) => {
  const listRef = doc(db, 'watchlists', listId);
  await updateDoc(listRef, {
    stocks: arrayUnion(stock),
    updatedAt: Date.now()
  });
};

// Remove stock from watchlist
export const removeStockFromWatchlist = async (listId, stockSymbol) => {
  const listRef = doc(db, 'watchlists', listId);
  const listDoc = await getDoc(listRef);
  
  if (listDoc.exists()) {
    const stocks = listDoc.data().stocks.filter(s => s.symbol !== stockSymbol);
    await updateDoc(listRef, {
      stocks,
      updatedAt: Date.now()
    });
  }
};

// Update watchlist metadata
export const updateWatchlist = async (listId, updates) => {
  const listRef = doc(db, 'watchlists', listId);
  await updateDoc(listRef, {
    ...updates,
    updatedAt: Date.now()
  });
};

// Delete watchlist
export const deleteWatchlist = async (listId) => {
  await deleteDoc(doc(db, 'watchlists', listId));
};

// Follow/unfollow watchlist
export const toggleFollowWatchlist = async (userId, listId, isFollowing) => {
  const userRef = doc(db, 'users', userId);
  const listRef = doc(db, 'watchlists', listId);
  
  if (isFollowing) {
    await updateDoc(userRef, {
      followedLists: arrayUnion(listId)
    });
    await updateDoc(listRef, {
      followerCount: increment(1)
    });
  } else {
    await updateDoc(userRef, {
      followedLists: arrayRemove(listId)
    });
    await updateDoc(listRef, {
      followerCount: increment(-1)
    });
  }
};