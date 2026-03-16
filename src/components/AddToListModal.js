// components/AddToListModal.js
// 1:1 web port of the React Native AddToListModal
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Check, List } from 'lucide-react';
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp,
} from 'firebase/firestore';

// ─── Fonts match the mobile app ──────────────────────────────────────────────
const FM = "'JetBrains Mono', monospace";
const FL = "'JetBrains Mono', monospace";
const FH = "'JetBrains Mono', monospace";

// ─── Props interface matches mobile exactly, plus web-specific deps ───────────
//
//  <AddToListModal
//    visible={showAddModal}
//    onClose={() => setShowAddModal(false)}
//    stock={selectedStock}
//    // --- from your AuthContext / app state ---
//    user={user}
//    db={db}
//    userProfile={userProfile}
//    watchlists={watchlists}
//    setWatchlists={setWatchlists}
//    // --- from your services (same signatures as mobile) ---
//    addStockToWatchlist={addStockToWatchlist}
//    createWatchlist={createWatchlist}
//    getUserWatchlists={getUserWatchlists}
//    logActivity={logActivity}        // optional
//  />

export default function AddToListModal({
  visible,
  onClose,
  stock,
  user,
  db,
  userProfile,
  watchlists = [],
  setWatchlists,
  addStockToWatchlist,
  createWatchlist,
  getUserWatchlists,
  logActivity,
}) {
  const [adding, setAdding]           = useState(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating]       = useState(false);
  const inputRef                       = useRef(null);

  // Reset state on open
  useEffect(() => {
    if (visible) {
      setShowCreate(false);
      setNewListName('');
      setAdding(null);
    }
  }, [visible]);

  // Focus the name input when create row appears
  useEffect(() => {
    if (showCreate) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showCreate]);

  // Close on Escape
  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!stock) return null;

  const symbol = stock.symbol || stock.ticker;
  const price  = parseFloat(stock.price) || 0;

  const isInList = (list) => list.stocks?.some(s => s.symbol === symbol);

  // ── handleAddToList: mirrors mobile exactly ───────────────────────────────
  const handleAddToList = async (listId) => {
    if (!user) return;
    setAdding(listId);
    try {
      const cleanStock = {
        symbol,
        name:       stock.name || stock._company?.name || stock.companyName || symbol,
        price:      price || null,
        addedPrice: price || null,
        change:     stock.change || null,
        addedAt:    new Date().toISOString(),
      };

      await addStockToWatchlist(listId, cleanStock);

      // Log activity for public lists
      const targetList = watchlists.find(l => l.id === listId);
      if (targetList?.isPublic && logActivity) {
        logActivity(db, {
          userId:         user.uid,
          userName:       userProfile?.username || 'Anonymous',
          userAvatar:     userProfile?.profilePicUrl || null,
          type:           'add_stock',
          targetSymbol:   symbol,
          targetListId:   listId,
          targetListName: targetList.name,
        }).catch(() => {});
      }

      // Update trending collection (non-critical)
      try {
        const watchRef = doc(db, 'trending', symbol);
        const watchDoc = await getDoc(watchRef);
        const now = Timestamp.now();
        if (watchDoc.exists()) {
          await updateDoc(watchRef, {
            adds:       arrayUnion(now),
            totalCount: (watchDoc.data().totalCount || 0) + 1,
            lastAdded:  now,
          });
        } else {
          await setDoc(watchRef, {
            symbol, name: cleanStock.name,
            adds: [now], totalCount: 1, lastAdded: now, createdAt: now,
          });
        }
      } catch (e) {
        console.log('Trending update failed (non-critical):', e.message);
      }

      // Refresh watchlists
      if (getUserWatchlists && setWatchlists) {
        const lists = await getUserWatchlists(user.uid);
        setWatchlists(lists);
      }

      onClose?.();
    } catch (e) {
      console.error('Add to list error:', e);
      alert(`Failed to add ${symbol} to list`);
    } finally {
      setAdding(null);
    }
  };

  // ── handleCreateAndAdd: mirrors mobile exactly ────────────────────────────
  const handleCreateAndAdd = async () => {
    if (!newListName.trim() || !user) return;
    setCreating(true);
    try {
      const listId = await createWatchlist(user.uid, newListName.trim(), '', false);
      await handleAddToList(listId);
      setNewListName('');
      setShowCreate(false);
    } catch (e) {
      console.error('Create list error:', e);
      alert('Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="atl-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              zIndex: 10001,
            }}
          />

          {/* ── Sheet ── */}
          <motion.div
            key="atl-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40, mass: 0.8 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              zIndex: 10002,
              backgroundColor: '#0f0f0f',
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              borderTop: '0.5px solid rgba(255,255,255,0.08)',
              paddingTop: 12, paddingBottom: 40,
              maxHeight: '85vh',
            }}
          >
            {/* Inner width constraint — separate so centering is stable during transform */}
            <div style={{ maxWidth: 540, margin: '0 auto', paddingLeft: 20, paddingRight: 20, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Handle bar */}
            <div style={{
              width: 40, height: 4, backgroundColor: '#333', borderRadius: 2,
              alignSelf: 'center', marginBottom: 16, flexShrink: 0,
            }} />

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20, flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: FH, fontSize: 20, color: '#fff', letterSpacing: -0.5, margin: 0 }}>
                  Add to list
                </p>
                <p style={{ fontFamily: FL, fontSize: 12, color: '#00ff4e', marginTop: 2, margin: '2px 0 0' }}>
                  {symbol} · ${price.toFixed(2)}
                </p>
              </div>
              <button
                onClick={onClose}
                style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              >
                <X size={20} color="#666" />
              </button>
            </div>

            {/* ── List scroll area ── */}
            <div style={{ overflowY: 'auto', maxHeight: 300, flexShrink: 0 }}>
              {watchlists.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 0', gap: 8 }}>
                  <List size={24} color="#333" />
                  <p style={{ fontFamily: FM, fontSize: 14, color: '#8a8a8a', margin: 0 }}>No lists yet</p>
                  <p style={{ fontFamily: FL, fontSize: 12, color: '#737373', margin: 0 }}>Create your first list below</p>
                </div>
              ) : (
                watchlists.map((list) => {
                  const alreadyIn = isInList(list);
                  const isAdding  = adding === list.id;
                  return (
                    <button
                      key={list.id}
                      disabled={alreadyIn || isAdding}
                      onClick={() => !alreadyIn && !isAdding && handleAddToList(list.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: 14, marginBottom: 8,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
                        cursor: alreadyIn ? 'default' : 'pointer',
                        opacity: alreadyIn ? 0.5 : 1,
                        textAlign: 'left',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: FM, fontSize: 15, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {list.name}
                          </span>
                          <span style={{
                            padding: '2px 6px', borderRadius: 3,
                            border: `1px solid ${list.isPublic ? 'rgba(0,255,78,0.2)' : 'rgba(255,255,255,0.06)'}`,
                            backgroundColor: list.isPublic ? 'rgba(0,255,78,0.06)' : 'rgba(255,255,255,0.03)',
                            fontSize: 7, fontFamily: FM,
                            color: list.isPublic ? '#00ff4e' : '#8a8a8a',
                            textTransform: 'uppercase', letterSpacing: 1,
                          }}>
                            {list.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>
                        <p style={{ fontFamily: FL, fontSize: 11, color: '#8a8a8a', marginTop: 2, margin: '2px 0 0' }}>
                          {list.stocks?.length || 0} stocks
                        </p>
                      </div>

                      {/* Right icon: spinner / check / plus */}
                      {isAdding ? (
                        <div style={styles.spinner} />
                      ) : alreadyIn ? (
                        <div style={styles.checkCircle}>
                          <Check size={14} color="#00ff4e" />
                        </div>
                      ) : (
                        <div style={styles.addCircle}>
                          <Plus size={16} color="#00ff4e" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* ── Create new list ── */}
            {showCreate ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexShrink: 0 }}>
                <input
                  ref={inputRef}
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateAndAdd(); }}
                  placeholder="List name..."
                  style={{
                    flex: 1, backgroundColor: '#000',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, color: '#fff',
                    padding: '12px 14px', fontSize: 14, fontFamily: FL,
                    outline: 'none', caretColor: '#00ff4e',
                  }}
                />
                <button
                  onClick={handleCreateAndAdd}
                  disabled={!newListName.trim() || creating}
                  style={{
                    ...styles.createConfirm,
                    opacity: (!newListName.trim() || creating) ? 0.3 : 1,
                  }}
                >
                  {creating
                    ? <div style={styles.spinnerDark} />
                    : <Check size={18} color="#000" />
                  }
                </button>
                <button
                  onClick={() => { setShowCreate(false); setNewListName(''); }}
                  style={{ padding: 10, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X size={18} color="#666" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                style={styles.createButton}
              >
                <Plus size={16} color="#000" />
                <span style={{ fontFamily: FM, fontSize: 13, color: '#000', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Create New List &amp; Add
                </span>
              </button>
            )}
            </div>{/* end inner width constraint */}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Shared style tokens ──────────────────────────────────────────────────────
const styles = {
  addCircle: {
    width: 36, height: 36, borderRadius: 18, flexShrink: 0,
    border: '1px solid rgba(0,255,78,0.3)', backgroundColor: 'rgba(0,255,78,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  checkCircle: {
    width: 36, height: 36, borderRadius: 18, flexShrink: 0,
    backgroundColor: 'rgba(0,255,78,0.1)', border: '1px solid rgba(0,255,78,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  spinner: {
    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
    border: '2px solid rgba(0,255,78,0.2)', borderTopColor: '#00ff4e',
    animation: 'spin 0.8s linear infinite',
  },
  createConfirm: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#00ff4e', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  },
  createButton: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#00ff4e', padding: '14px 0',
    borderRadius: 10, marginTop: 16, border: 'none',
    cursor: 'pointer', width: '100%', flexShrink: 0,
  },
  spinnerDark: {
    width: 16, height: 16, borderRadius: '50%',
    border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000',
    animation: 'spin 0.8s linear infinite',
  },
};

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('atl-spin')) {
  const s = document.createElement('style');
  s.id = 'atl-spin';
  s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
}
