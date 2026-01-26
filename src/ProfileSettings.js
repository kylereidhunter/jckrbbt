import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { updateProfile } from 'firebase/auth';

export default function ProfileSettings({ isOpen, onClose, user }) {
  const [username, setUsername] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  // Load user profile data
  useEffect(() => {
    if (!user || !isOpen) return;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUsername(data.username || '');
          setProfilePicUrl(data.profilePicUrl || '');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user, isOpen]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      // Create a reference to the file location
      const imageRef = ref(storage, `profile-pictures/${user.uid}`);
      
      // Upload the file
      await uploadBytes(imageRef, file);
      
      // Get the download URL
      const downloadUrl = await getDownloadURL(imageRef);
      
      setProfilePicUrl(downloadUrl);
      setMessage('Image uploaded! Click "Save Changes" to update your profile.');
    } catch (error) {
      setMessage('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setProfilePicUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      // Update Firestore
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, {
        username: username.trim(),
        profilePicUrl: profilePicUrl.trim()
      }, { merge: true });

      // Update Firebase Auth displayName if username changed
      if (username.trim()) {
        await updateProfile(auth.currentUser, {
          displayName: username.trim()
        });
      }

        setMessage('Profile updated successfully!');
        setTimeout(() => {
        onClose(true); // Pass true to indicate successful save
        }, 1500);
    } catch (error) {
      setMessage('Error updating profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#050505] border-2 border-zinc-800 rounded-xl p-6 md:p-8 max-w-md w-full shadow-2xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              Profile Settings
            </h2>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors text-2xl"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-2 border-[#00ff4e] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              {/* Profile Picture Preview & Upload */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-4">
                  {profilePicUrl ? (
                    <img 
                      src={profilePicUrl} 
                      alt="Profile" 
                      className="w-24 h-24 rounded-full object-cover border-2 border-[#00ff4e]"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-24 h-24 rounded-full bg-[#00ff4e] flex items-center justify-center text-black font-black text-3xl ${profilePicUrl ? 'hidden' : ''}`}
                  >
                    {username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  
                  {profilePicUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="profile-pic-upload"
                />
                <label
                  htmlFor="profile-pic-upload"
                  className={`cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-xs font-bold border border-zinc-800 transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </label>
                <p className="text-[10px] text-zinc-600 mt-2">Max 5MB • JPG, PNG, GIF</p>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-zinc-500 block mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter a username"
                  className="w-full bg-black border border-zinc-800 text-white px-4 py-3 rounded-lg outline-none focus:border-[#00ff4e]/50 transition-all"
                  style={{ caretColor: '#00ff4e' }}
                  maxLength={20}
                />
                <p className="text-[10px] text-zinc-600 mt-1">Max 20 characters</p>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-zinc-500 block mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-500 px-4 py-3 rounded-lg cursor-not-allowed"
                />
                <p className="text-[10px] text-zinc-600 mt-1">Email cannot be changed</p>
              </div>

              {message && (
                <div className={`${message.includes('Error') ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-[#00ff4e]/10 border-[#00ff4e]/50 text-[#00ff4e]'} border px-4 py-2 rounded-lg text-sm font-bold`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving || uploading}
                className="w-full bg-[#00ff4e] text-black font-black py-3 rounded-lg hover:opacity-90 transition-all disabled:opacity-50 uppercase tracking-tight"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}