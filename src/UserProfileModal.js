import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, ChevronDown, ChevronUp, Copy, Check, UserPlus, UserMinus, TrendingUp, TrendingDown, Minus, Eye, Heart } from 'lucide-react';

const POLYGON_KEY = process.env.REACT_APP_POLYGON_KEY;

export default function UserProfileModal({ 
  isOpen, onClose, user, currentUserId, 
  isFollowing, onFollow, onUnfollow,
  onStockClick,          // (stock) => void — navigate to stock in scanner/chart
  onCopyWatchlist,       // (list) => void — copy all stocks into user's new list
  followedLists = [],    // array of list IDs the current user follows
  onFollowList,          // (listId) => void
  onUnfollowList         // (listId) => void
}) {
  const [expandedList, setExpandedList] = useState(null);
  const [stockPrices, setStockPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [copiedListId, setCopiedListId] = useState(null);
  const [localFollowerCounts, setLocalFollowerCounts] = useState({});


  if (!isOpen || !user) return null;

  const isOwnProfile = currentUserId === user.id;

  // Fetch snapshot prices for all stocks in a list
  const fetchStockPrices = async (stocks) => {
    if (!stocks || stocks.length === 0) return;
    setLoadingPrices(true);
    const prices = {};

    await Promise.allSettled(
      stocks.map(async (stock) => {
        try {
          const res = await fetch(
            `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${stock.symbol}?apiKey=${POLYGON_KEY}`
          );
          const data = await res.json();
          if (data.ticker) {
            const t = data.ticker;
            prices[stock.symbol] = {
              price: t.day?.c || t.prevDay?.c || t.lastTrade?.p || 0,
              change: t.todaysChangePerc || 0,
            };
          }
        } catch (e) { /* silent */ }
      })
    );

    setStockPrices((prev) => ({ ...prev, ...prices }));
    setLoadingPrices(false);
  };

  const handleExpandList = (list) => {
    if (expandedList === list.id) {
      setExpandedList(null);
    } else {
      setExpandedList(list.id);
      const missing = list.stocks?.filter((s) => !stockPrices[s.symbol]);
      if (missing?.length) fetchStockPrices(missing);
    }
  };

  const handleCopyList = (list) => {
    if (onCopyWatchlist) {
      onCopyWatchlist(list);
      setCopiedListId(list.id);
      setTimeout(() => setCopiedListId(null), 2000);
    }
  };

  const isListFollowed = (listId) => followedLists.includes(listId);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100000] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#050505] border-2 border-zinc-800 rounded-xl p-5 md:p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* ── Header ── */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              {user.profilePicUrl ? (
                <img
                  src={user.profilePicUrl}
                  alt={user.username}
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover border-2 border-zinc-800"
                />
              ) : (
                <div className="w-14 h-14 md:w-16 md:h-16 bg-[#00ff4e] rounded-full flex items-center justify-center text-black font-black text-xl md:text-2xl">
                  {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                  {user.username || 'Anonymous User'}
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs md:text-sm text-zinc-400">
                    <strong className="text-white">{user.followerCount || 0}</strong> followers
                  </span>
                  <span className="text-xs md:text-sm text-zinc-400">
                    <strong className="text-white">{user.followingCount || 0}</strong> following
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors p-1">
              <X size={22} />
            </button>
          </div>

          {/* ── Follow / Unfollow User ── */}
          {!isOwnProfile && (
            <div className="mb-6">
              {isFollowing ? (
                <button
                  onClick={() => onUnfollow(user.id)}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black py-3 rounded-lg transition-all uppercase tracking-tight border border-zinc-700 flex items-center justify-center gap-2 text-sm"
                >
                  <UserMinus size={16} /> Following
                </button>
              ) : (
                <button
                  onClick={() => onFollow(user.id)}
                  className="w-full bg-[#00ff4e] hover:opacity-90 text-black font-black py-3 rounded-lg transition-all uppercase tracking-tight flex items-center justify-center gap-2 text-sm"
                >
                  <UserPlus size={16} /> Follow
                </button>
              )}
            </div>
          )}

          {/* ── Public Watchlists ── */}
          <div>
            <h3 className="text-[10px] md:text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Eye size={14} />
              Public Watchlists ({user.publicLists?.length || 0})
            </h3>

            {!user.publicLists || user.publicLists.length === 0 ? (
              <div className="text-center py-10 text-zinc-700 text-sm">
                No public watchlists yet
              </div>
            ) : (
              <div className="space-y-3">
                {user.publicLists.map((list) => {
                  const isExpanded = expandedList === list.id;
                  const isFollowedByMe = isListFollowed(list.id);
                  const isCopied = copiedListId === list.id;

                  return (
                    <div
                      key={list.id}
                      className={`bg-zinc-900/60 border rounded-xl overflow-hidden transition-all duration-300 ${
                        isExpanded ? 'border-[#00ff4e]/30' : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {/* ── List Header (tap to expand) ── */}
                      <button
                        onClick={() => handleExpandList(list)}
                        className="w-full text-left p-4 flex items-center justify-between group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-base md:text-lg font-black text-white uppercase tracking-tight truncate">
                              {list.name}
                            </h4>
                            {(localFollowerCounts[list.id] ?? list.followerCount ?? 0) > 0 && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 shrink-0">
                                <Heart size={10} className="text-zinc-600" />
                                {localFollowerCounts[list.id] ?? list.followerCount ?? 0}
                              </span>
                            )}
                          </div>
                          {list.description && (
                            <p className="text-xs text-zinc-500 truncate">{list.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] font-bold text-zinc-600">
                              {list.stocks?.length || 0} stocks
                            </span>
                            {/* ticker preview when collapsed */}
                            {!isExpanded && list.stocks?.length > 0 && (
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                {list.stocks.slice(0, 5).map((s) => (
                                  <span key={s.symbol} className="text-[9px] font-black text-zinc-500 uppercase">
                                    {s.symbol}
                                  </span>
                                ))}
                                {list.stocks.length > 5 && (
                                  <span className="text-[9px] text-zinc-700">+{list.stocks.length - 5}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-3 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </button>

                      {/* ── Expanded Content ── */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            {/* Action buttons (only for other users' lists) */}
                            {!isOwnProfile && (
                              <div className="flex gap-2 px-4 pb-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isFollowedByMe) {
                                      onUnfollowList?.(list.id);
                                      setLocalFollowerCounts(prev => ({
                                        ...prev,
                                        [list.id]: (prev[list.id] ?? list.followerCount ?? 0) - 1
                                      }));
                                    } else {
                                      onFollowList?.(list.id);
                                      setLocalFollowerCounts(prev => ({
                                        ...prev,
                                        [list.id]: (prev[list.id] ?? list.followerCount ?? 0) + 1
                                      }));
                                    }
                                  }}
                                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider transition-all border ${
                                    isFollowedByMe
                                      ? 'bg-[#00ff4e]/10 text-[#00ff4e] border-[#00ff4e]/30'
                                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white hover:border-zinc-600'
                                  }`}
                                >
                                  <Heart size={13} className={isFollowedByMe ? 'fill-[#00ff4e]' : ''} />
                                  {isFollowedByMe ? 'Following List' : 'Follow List'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyList(list);
                                  }}
                                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider transition-all border ${
                                    isCopied
                                      ? 'bg-[#00ff4e]/10 text-[#00ff4e] border-[#00ff4e]/30'
                                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white hover:border-zinc-600'
                                  }`}
                                >
                                  {isCopied ? <Check size={13} /> : <Copy size={13} />}
                                  {isCopied ? 'Copied!' : 'Copy to My Lists'}
                                </button>
                              </div>
                            )}

                            {/* Stock rows */}
                            <div className="border-t border-zinc-800/50">
                              {loadingPrices && !list.stocks?.some((s) => stockPrices[s.symbol]) ? (
                                <div className="px-4 py-6 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="flex gap-1">
                                      <span className="w-1.5 h-1.5 bg-[#00ff4e] rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
                                      <span className="w-1.5 h-1.5 bg-[#00ff4e] rounded-full animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
                                      <span className="w-1.5 h-1.5 bg-[#00ff4e] rounded-full animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
                                    </div>
                                    <span className="text-xs text-zinc-600">Loading prices...</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="max-h-[300px] overflow-y-auto">
                                  {list.stocks?.map((stock, idx) => {
                                    const pd = stockPrices[stock.symbol];
                                    const change = pd?.change || 0;
                                    const up = change > 0;
                                    const down = change < 0;

                                    return (
                                      <button
                                        key={stock.symbol}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onStockClick?.(stock);
                                        }}
                                        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors text-left ${
                                          idx !== list.stocks.length - 1 ? 'border-b border-zinc-800/30' : ''
                                        }`}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <span className="text-sm md:text-base font-black text-white uppercase block">
                                            {stock.symbol}
                                          </span>
                                          {stock.name && (
                                            <span className="text-[10px] text-zinc-600 truncate block max-w-[180px]">
                                              {stock.name}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                          {pd ? (
                                            <>
                                              <span className="text-sm font-black text-white tabular-nums">
                                                ${pd.price?.toFixed(2)}
                                              </span>
                                              <span
                                                className={`flex items-center gap-1 text-xs font-bold tabular-nums ${
                                                  up ? 'text-[#00ff4e]' : down ? 'text-red-500' : 'text-zinc-500'
                                                }`}
                                              >
                                                {up ? <TrendingUp size={12} /> : down ? <TrendingDown size={12} /> : <Minus size={12} />}
                                                {up ? '+' : ''}
                                                {change.toFixed(2)}%
                                              </span>
                                            </>
                                          ) : (
                                            <span className="text-xs text-zinc-700">—</span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Disclaimer */}
          {user.publicLists?.length > 0 && (
            <p className="mt-6 text-[9px] text-zinc-700 text-center">
              Watchlists are for informational purposes only · Not financial advice
            </p>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}