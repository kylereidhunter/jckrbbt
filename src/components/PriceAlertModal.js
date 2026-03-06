// components/PriceAlertModal.js
// 1:1 web port of the React Native PriceAlertModal
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

// ─── Fonts ────────────────────────────────────────────────────────────────────
const FM = 'JetBrainsMono-Medium, monospace';
const FL = 'JetBrainsMono-Light, monospace';
const FH = 'AlphaLyrae-Medium, serif';

const PRESETS = [
  { label: '-10%', pct: -10, color: '#FF4B2B' },
  { label: '-5%',  pct: -5,  color: '#FF4B2B' },
  { label: '+5%',  pct: 5,   color: '#00ff4e' },
  { label: '+10%', pct: 10,  color: '#00ff4e' },
  { label: '+20%', pct: 20,  color: '#00ff4e' },
];

// ─── Props interface matches mobile exactly, plus web-specific deps ───────────
//
//  <PriceAlertModal
//    visible={showAlertModal}
//    onClose={() => setShowAlertModal(false)}
//    symbol={stock.symbol}
//    companyName={companyName}
//    currentPrice={price}
//    // --- from your AuthContext ---
//    user={user}
//    // --- from your services (same signatures as mobile) ---
//    createPriceAlert={createPriceAlert}
//    getSymbolAlerts={getSymbolAlerts}
//    deletePriceAlert={deletePriceAlert}
//  />

export default function PriceAlertModal({
  visible,
  onClose,
  symbol,
  companyName,
  currentPrice,
  user,
  createPriceAlert,
  getSymbolAlerts,
  deletePriceAlert,
}) {
  const [targetPrice, setTargetPrice]       = useState('');
  const [loading, setLoading]               = useState(false);
  const [existingAlerts, setExistingAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts]   = useState(false);
  const inputRef = useRef(null);

  // Reset + load alerts on open
  useEffect(() => {
    if (visible) {
      setTargetPrice('');
      setLoading(false);
      if (user && getSymbolAlerts) fetchExistingAlerts();
      setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
        if (inputRef.current) {
          const container = inputRef.current.closest('[style*="overflow-y"]');
          if (container) container.scrollLeft = 0;
        }
      }, 350);
    }
  }, [visible]);

  // Escape to close
  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  const fetchExistingAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const alerts = await getSymbolAlerts(user.uid, symbol);
      setExistingAlerts(alerts);
    } catch (e) {
      console.error('Fetch alerts error:', e);
    }
    setLoadingAlerts(false);
  };

  const handleCreate = async () => {
    if (!user) { alert('Please sign in to set price alerts.'); return; }
    const price = parseFloat(targetPrice);
    if (!price || price <= 0) { alert('Please enter a valid target price.'); return; }
    const autoDirection = price > currentPrice ? 'above' : 'below';
    setLoading(true);
    try {
      await createPriceAlert(user.uid, {
        symbol, targetPrice: price, direction: autoDirection, companyName,
      });
      if (getSymbolAlerts) await fetchExistingAlerts();
      setTargetPrice('');
    } catch (e) {
      alert('Failed to create alert. Try again.');
    }
    setLoading(false);
  };

  const handleDelete = async (alertId) => {
    try {
      await deletePriceAlert(user.uid, alertId);
      setExistingAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (e) {
      alert('Failed to delete alert.');
    }
  };

  const applyPreset = (pct) => {
    if (!currentPrice) return;
    setTargetPrice((currentPrice * (1 + pct / 100)).toFixed(2));
    inputRef.current?.focus({ preventScroll: true });
  };

  const priceNum    = parseFloat(targetPrice);
  const isAbove     = priceNum > currentPrice;
  const accentColor = isAbove ? '#00ff4e' : '#FF4B2B';
  const pctDiff     = priceNum && currentPrice > 0
    ? (((priceNum - currentPrice) / currentPrice) * 100).toFixed(1)
    : null;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="pal-backdrop"
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
            key="pal-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40, mass: 0.8 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              zIndex: 10002,
              backgroundColor: '#1a1a1a',
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              borderTop: '1px solid rgba(0,255,78,0.15)',
              paddingTop: 12, paddingBottom: 32,
              maxHeight: '90vh',
              overflowX: 'hidden',
            }}
          >
            {/* Inner div — padding and scroll here, not on the motion element */}
            <div style={{ paddingLeft: 24, paddingRight: 24, overflowY: 'auto', overflowX: 'hidden', maxHeight: 'calc(90vh - 44px)', boxSizing: 'border-box', width: '100%' }}>
            {/* Handle bar */}
            <div style={{
              width: 40, height: 4, backgroundColor: '#333', borderRadius: 2,
              margin: '0 auto 10px',
            }} />

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: FH, fontSize: 22, color: '#00ff4e', letterSpacing: 1, margin: 0 }}>
                  {symbol}
                </p>
                <p style={{ fontFamily: FL, fontSize: 12, color: '#8a8a8a', marginTop: 2, margin: '2px 0 0' }}>
                  {companyName}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontFamily: FL, fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                  Current
                </p>
                <p style={{ fontFamily: FM, fontSize: 20, color: '#fff', marginTop: 2, margin: '2px 0 0' }}>
                  ${currentPrice?.toFixed(2)}
                </p>
              </div>
            </div>

            {/* ── Target price label ── */}
            <p style={{ fontFamily: FM, fontSize: 10, color: '#555', letterSpacing: 2, marginBottom: 8, margin: '0 0 8px' }}>
              TARGET PRICE
            </p>

            {/* ── Price input row ── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              marginBottom: 12,
              borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8,
            }}>
              <span style={{ fontFamily: FM, fontSize: 32, color: '#555' }}>$</span>
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0"
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && targetPrice) handleCreate(); }}
                placeholder="0.00"
                style={{
                  flex: 1, fontFamily: FM, fontSize: 32, color: '#fff',
                  backgroundColor: 'transparent', border: 'none', outline: 'none',
                  padding: '4px 0', caretColor: '#00ff4e',
                  MozAppearance: 'textfield',
                }}
              />
              {/* pct diff badge */}
              {pctDiff && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 10px', borderRadius: 8,
                  backgroundColor: isAbove ? 'rgba(0,255,78,0.12)' : 'rgba(255,75,43,0.12)',
                  flexShrink: 0,
                }}>
                  {isAbove
                    ? <TrendingUp  size={12} color="#00ff4e" />
                    : <TrendingDown size={12} color="#FF4B2B" />
                  }
                  <span style={{ fontFamily: FM, fontSize: 13, color: accentColor }}>
                    {isAbove ? '+' : ''}{pctDiff}%
                  </span>
                </div>
              )}
            </div>

            {/* ── Quick presets ── */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.pct)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    border: `1px solid ${p.color}30`,
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontFamily: FM, fontSize: 12, letterSpacing: 0.5, color: p.color }}>
                    {p.label}
                  </span>
                </button>
              ))}
            </div>

            {/* ── Direction hint (only when price entered) ── */}
            {priceNum > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 10, marginBottom: 12,
                border: `1px solid ${isAbove ? 'rgba(0,255,78,0.15)' : 'rgba(255,75,43,0.15)'}`,
                backgroundColor: isAbove ? 'rgba(0,255,78,0.04)' : 'rgba(255,75,43,0.04)',
              }}>
                {isAbove
                  ? <ArrowUpCircle   size={14} color="#00ff4e" />
                  : <ArrowDownCircle size={14} color="#FF4B2B" />
                }
                <span style={{ fontFamily: FL, fontSize: 12, color: accentColor, flex: 1 }}>
                  Alert when {symbol} {isAbove ? 'rises above' : 'drops below'} ${priceNum.toFixed(2)}
                </span>
              </div>
            )}

            {/* ── Set Alert button ── */}
            <button
              onClick={handleCreate}
              disabled={!targetPrice || loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: '#00ff4e', borderRadius: 10, padding: '14px 0',
                marginBottom: 4, border: 'none', cursor: 'pointer', width: '100%',
                boxShadow: '0 0 20px rgba(0,255,78,0.15)',
                opacity: (!targetPrice || loading) ? 0.4 : 1,
              }}
            >
              {loading
                ? <div style={S.spinnerDark} />
                : <>
                    <Bell size={16} color="#000" />
                    <span style={{ fontFamily: FM, fontSize: 15, color: '#000', textTransform: 'uppercase', letterSpacing: 2 }}>
                      Set Alert
                    </span>
                  </>
              }
            </button>

            {/* ── Existing alerts ── */}
            {loadingAlerts ? (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <div style={S.spinnerGreen} />
              </div>
            ) : existingAlerts.length > 0 ? (
              <div style={{ marginTop: 12, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontFamily: FM, fontSize: 10, color: '#555', letterSpacing: 2, marginBottom: 12, margin: '0 0 12px' }}>
                  ACTIVE ALERTS · {symbol}
                </p>
                {existingAlerts.map(alert => {
                  const alertPct   = currentPrice > 0
                    ? (((alert.targetPrice - currentPrice) / currentPrice) * 100).toFixed(1)
                    : null;
                  const alertAbove = alert.direction === 'above';
                  return (
                    <div
                      key={alert.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        paddingTop: 10, paddingBottom: 10,
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                        backgroundColor: alertAbove ? 'rgba(0,255,78,0.08)' : 'rgba(255,75,43,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {alertAbove
                          ? <TrendingUp   size={14} color="#00ff4e" />
                          : <TrendingDown size={14} color="#FF4B2B" />
                        }
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: FM, fontSize: 16, color: '#fff', margin: 0 }}>
                          ${alert.targetPrice.toFixed(2)}
                        </p>
                        <p style={{ fontFamily: FL, fontSize: 11, color: '#555', marginTop: 1, margin: '1px 0 0' }}>
                          {alertAbove ? 'Rises above' : 'Drops below'}
                          {alertPct ? ` (${alertAbove ? '+' : ''}${alertPct}%)` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <X size={16} color="#555" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
            </div>{/* end inner div */}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const S = {
  spinnerDark: {
    width: 18, height: 18, borderRadius: '50%',
    border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000',
    animation: 'spin 0.8s linear infinite', display: 'inline-block',
  },
  spinnerGreen: {
    width: 18, height: 18, borderRadius: '50%',
    border: '2px solid rgba(0,255,78,0.2)', borderTopColor: '#00ff4e',
    animation: 'spin 0.8s linear infinite',
  },
};

// Inject keyframes + strip number input arrows (matches mobile feel)
if (typeof document !== 'undefined' && !document.getElementById('pal-spin')) {
  const s = document.createElement('style');
  s.id = 'pal-spin';
  s.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pal-fade-in { from { opacity: 0; } to { opacity: 1; } }
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    input[type=number] { -moz-appearance: textfield; }
  `;
  document.head.appendChild(s);
}
