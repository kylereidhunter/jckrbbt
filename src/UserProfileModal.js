import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users } from 'lucide-react';

export default function UserProfileModal({ isOpen, onClose, user, currentUserId, isFollowing, onFollow, onUnfollow }) {
  if (!isOpen || !user) return null;

  const isOwnProfile = currentUserId === user.id;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#050505] border-2 border-zinc-800 rounded-xl p-6 md:p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              {user.profilePicUrl ? (
                <img 
                  src={user.profilePicUrl} 
                  alt={user.username} 
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-[#00ff4e] rounded-full flex items-center justify-center text-black font-black text-2xl">
                  {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                  {user.username || 'Anonymous User'}
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-sm text-zinc-400">
                    <strong className="text-white">{user.followerCount || 0}</strong> followers
                  </span>
                  <span className="text-sm text-zinc-400">
                    <strong className="text-white">{user.followingCount || 0}</strong> following
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors text-2xl"
            >
              <X size={24} />
            </button>
          </div>

          {/* Follow/Unfollow Button */}
          {!isOwnProfile && (
            <div className="mb-6">
              {isFollowing ? (
                <button
                  onClick={() => onUnfollow(user.id)}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black py-3 rounded-lg transition-all uppercase tracking-tight border border-zinc-700"
                >
                  Following
                </button>
              ) : (
                <button
                  onClick={() => onFollow(user.id)}
                  className="w-full bg-[#00ff4e] hover:opacity-90 text-black font-black py-3 rounded-lg transition-all uppercase tracking-tight"
                >
                  Follow
                </button>
              )}
            </div>
          )}

          {/* Public Watchlists */}
          <div>
            <h3 className="text-sm font-black text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users size={16} />
              Public Watchlists ({user.publicLists?.length || 0})
            </h3>
            
            {!user.publicLists || user.publicLists.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">
                No public watchlists yet
              </div>
            ) : (
              <div className="space-y-3">
                {user.publicLists.map((list) => (
                  <div
                    key={list.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-black text-white uppercase tracking-tight">
                        {list.name}
                      </h4>
                      <span className="text-[8px] font-black bg-[#00ff4e]/10 text-[#00ff4e] px-2 py-1 rounded border border-[#00ff4e]/30 uppercase">
                        Public
                      </span>
                    </div>
                    {list.description && (
                      <p className="text-sm text-zinc-400 mb-2">{list.description}</p>
                    )}
                    <p className="text-xs text-zinc-600">{list.stocks?.length || 0} stocks</p>
                    
                    {/* Show stock tickers */}
                    {list.stocks && list.stocks.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {list.stocks.slice(0, 10).map((stock) => (
                          <span
                            key={stock.symbol}
                            className="text-[10px] font-black bg-black text-[#00ff4e] px-2 py-1 rounded border border-zinc-800 uppercase"
                          >
                            ${stock.symbol}
                          </span>
                        ))}
                        {list.stocks.length > 10 && (
                          <span className="text-[10px] font-bold text-zinc-600 px-2 py-1">
                            +{list.stocks.length - 10} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Disclaimer */}
          {user.publicLists && user.publicLists.length > 0 && (
            <div className="mt-6 bg-yellow-500/10 border border-yellow-500/50 text-yellow-500 px-4 py-3 rounded-lg text-xs">
              ⚠️ <strong>Educational Only:</strong> These watchlists are for informational purposes. Not financial advice.
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}