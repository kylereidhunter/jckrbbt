import { collection, doc, setDoc, deleteDoc, query, where, getDocs, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

// Follow a user
export const followUser = async (followerId, followingId) => {
  const followId = `${followerId}_${followingId}`;
  const followRef = doc(db, 'follows', followId);
  
  await setDoc(followRef, {
    followerId,
    followingId,
    createdAt: Date.now()
  });
  
  // Update follower/following counts
  const followerRef = doc(db, 'users', followerId);
  const followingRef = doc(db, 'users', followingId);
  
  await updateDoc(followerRef, {
    followingCount: increment(1)
  });
  
  await updateDoc(followingRef, {
    followerCount: increment(1)
  });
};

// Unfollow a user
export const unfollowUser = async (followerId, followingId) => {
  const followId = `${followerId}_${followingId}`;
  await deleteDoc(doc(db, 'follows', followId));
  
  // Update follower/following counts
  const followerRef = doc(db, 'users', followerId);
  const followingRef = doc(db, 'users', followingId);
  
  // Get current values first to prevent going negative
  const followerDoc = await getDoc(followerRef);
  const followingDoc = await getDoc(followingRef);
  
  const currentFollowingCount = followerDoc.data()?.followingCount || 0;
  const currentFollowerCount = followingDoc.data()?.followerCount || 0;
  
  await updateDoc(followerRef, {
    followingCount: Math.max(currentFollowingCount - 1, 0)
  });
  
  await updateDoc(followingRef, {
    followerCount: Math.max(currentFollowerCount - 1, 0)
  });
};

// Check if user is following another user
export const isFollowing = async (followerId, followingId) => {
  const followId = `${followerId}_${followingId}`;
  const followDoc = await getDoc(doc(db, 'follows', followId));
  return followDoc.exists();
};

// Get user's followers
export const getFollowers = async (userId) => {
  const q = query(
    collection(db, 'follows'),
    where('followingId', '==', userId)
  );
  
  const snapshot = await getDocs(q);
  const followerIds = snapshot.docs.map(doc => doc.data().followerId);
  
  // Get user data for each follower
  const followers = await Promise.all(
    followerIds.map(async (id) => {
      const userDoc = await getDoc(doc(db, 'users', id));
      return { id, ...userDoc.data() };
    })
  );
  
  return followers;
};

// Get user's following
export const getFollowing = async (userId) => {
  const q = query(
    collection(db, 'follows'),
    where('followerId', '==', userId)
  );
  
  const snapshot = await getDocs(q);
  const followingIds = snapshot.docs.map(doc => doc.data().followingId);
  
  // Get user data for each following
  const following = await Promise.all(
    followingIds.map(async (id) => {
      const userDoc = await getDoc(doc(db, 'users', id));
      return { id, ...userDoc.data() };
    })
  );
  
  return following;
};

// Search users by username
export const searchUsers = async (searchTerm) => {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  
  // Filter locally (Firestore doesn't support case-insensitive search natively)
  const users = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(user => 
      user.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  
  return users;
};