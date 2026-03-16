// components/MetricCard.js
// 1:1 web port of StockCard.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import MiniChart from './MiniChart';
import {
  Activity, Target, TrendingUp, BarChart3, Zap, Search,
  Newspaper, MessageCircle, Send, Plus, Trash2, Bell,
  Briefcase, FileText, ChevronDown, ChevronUp, ArrowUpRight,
  Share2, Pin, Cpu,
} from 'lucide-react';
import CountUp from '../CountUp';
import { POLYGON_KEY, cleanCompanyName, getTradeUrl } from '../config/constants';

// ─── Catalyst badge config (mirrors StockCard getCatalystStyle) ──────────────
const getCatalystStyle = (type) => {
  switch (type) {
    case 'early_signal':   return { Icon: Search,     color: '#f97316', label: 'EARLY SIGNAL' };
    case 'options_first':  return { Icon: Target,     color: '#ec4899', label: 'PRE-MOVE OPTIONS' };
    case 'news':           return { Icon: TrendingUp, color: '#00ff4e', label: 'NEWS CATALYST' };
    case 'volume':         return { Icon: BarChart3,  color: '#f59e0b', label: 'VOLUME SPIKE' };
    case 'breakout':       return { Icon: TrendingUp, color: '#3b82f6', label: 'BREAKOUT' };
    case 'momentum':       return { Icon: Zap,        color: '#8b5cf6', label: 'MOMENTUM' };
    case 'gainer':         return { Icon: TrendingUp, color: '#10b981', label: 'TOP GAINER' };
    default:               return { Icon: Target,     color: '#71717a', label: 'SIGNAL' };
  }
};

const PATTERN_COLORS = {
  PRE_MOVE: '#ec4899', INSTITUTIONAL_FOOTPRINT: '#818cf8', QUIET_ACCUMULATION: '#6366f1',
  VOLUME_SPIKE: '#f59e0b', SECTOR_DIVERGENCE: '#ec4899', OPTIONS_UNUSUAL: '#a855f7',
  OPTIONS_IV_SPIKE: '#c084fc', OPTIONS_OTM_CALLS: '#d946ef', BREAKOUT_52W: '#00ff4e', MOMENTUM: '#22d3ee',
};

// ─── Brokerage trade URLs (mirrors StockCard) ────────────────────────────────
const BROKERAGE_TRADE_URLS = {
  'robinhood':           (s) => `https://robinhood.com/stocks/${s}`,
  'webull':              (s) => `https://www.webull.com/quote/${s.toLowerCase()}`,
  'fidelity':            (s) => `https://digital.fidelity.com/prgw/digital/research/quote/dashboard/summary?symbol=${s}`,
  'schwab':              (s) => `https://www.schwab.com/research/stocks/quotes/summary/${s}`,
  'charles schwab':      (s) => `https://www.schwab.com/research/stocks/quotes/summary/${s}`,
  'e*trade':             (s) => `https://us.etrade.com/etx/mkt/quotes?symbol=${s}`,
  'etrade':              (s) => `https://us.etrade.com/etx/mkt/quotes?symbol=${s}`,
  'td ameritrade':       (s) => `https://research.tdameritrade.com/grid/public/research/stocks/summary?symbol=${s}`,
  'interactive brokers': (s) => `https://www.interactivebrokers.com/en/index.php?f=46777&symbology=IB&symbol=${s}`,
  'sofi':                (s) => `https://www.sofi.com/invest/stocks/${s.toLowerCase()}`,
  'public':              (s) => `https://public.com/stocks/${s}`,
  'vanguard':            (s) => `https://investor.vanguard.com/investment-products/stocks/profile/${s.toLowerCase()}`,
  'ally':                (s) => `https://www.ally.com/invest/stocks/${s}`,
  'm1 finance':          (s) => `https://m1.com/invest/stocks/${s}`,
  'm1':                  (s) => `https://m1.com/invest/stocks/${s}`,
};

const getBrokerageTradeUrl = (brokerageName, sym) => {
  const lower = brokerageName?.toLowerCase() || '';
  for (const [key, fn] of Object.entries(BROKERAGE_TRADE_URLS)) {
    if (lower.includes(key)) return fn(sym);
  }
  return null;
};

const formatVolume = (vol) => {
  if (!vol) return null;
  if (vol >= 1e9) return (vol / 1e9).toFixed(1) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(1) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(0) + 'K';
  return vol.toString();
};

const getEarningsLabel = (earnings) => {
  if (!earnings?.date) return null;
  const today = new Date();
  const earningsDate = new Date(earnings.date + 'T00:00:00');
  const diffDays = Math.ceil((earningsDate - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'TOMORROW';
  if (diffDays <= 7) return `IN ${diffDays} DAYS`;
  if (diffDays <= 30) return earningsDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return null;
};

const QUICK_PROMPTS = [
  'Why is this moving?', 'Bull case?', 'Key risks?',
  'Good entry?', 'Analyst targets?', 'Upcoming catalysts?',
];

// ─── ExpandableSection (mirrors StockCard ExpandableSection) ─────────────────
function ExpandableSection({ title, iconName, isOpen, onToggle, loading, children }) {
  const IconMap = {
    'trending-up': TrendingUp,
    'briefcase':   Briefcase,
    'target':      Target,
    'file-text':   FileText,
  };
  const Icon = IconMap[iconName] || Target;
  return (
    <div style={{ borderTop: '1px solid rgba(113,113,122,0.18)', paddingTop: 14, paddingBottom: 14 }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <Icon size={14} color={isOpen ? '#00ff4e' : '#fff'} />
        <span style={{
          fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: 2,
          color: isOpen ? '#00ff4e' : '#fff', flex: 1, textAlign: 'left',
        }}>
          {title}
        </span>
        <span style={{ fontSize: 10, color: isOpen ? '#00ff4e' : '#8a8a8a' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { duration: 0.3 } }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: 14 }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={S.spinner} />
                  <span style={{ fontSize: 12, color: '#8a8a8a', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>
                    Loading...
                  </span>
                </div>
              ) : children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── TradeDropdown (mirrors StockCard TradeDropdown) ─────────────────────────
function TradeDropdown({ brokerages, onTrade }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 12, flex: 1 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ ...S.tradeBtn, width: '100%', justifyContent: 'center' }}
      >
        <Briefcase size={12} color="#00ff4e" />
        <span style={S.tradeBtnText}>Trade</span>
        {open ? <ChevronUp size={12} color="#00ff4e" /> : <ChevronDown size={12} color="#00ff4e" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              marginTop: 4, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
              backgroundColor: 'rgba(0,0,0,0.7)', overflow: 'hidden',
            }}
          >
            {brokerages.map((b) => (
              <button
                key={b.id}
                onClick={() => { setOpen(false); onTrade(b.url); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', width: '100%', background: 'none',
                  border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                }}
              >
                <Briefcase size={13} color="#00ff4e" />
                <span style={{
                  fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                  color: '#fff', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1, textAlign: 'left',
                }}>
                  {b.name}
                </span>
                <span style={{ color: '#555', fontSize: 14 }}>→</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main MetricCard ──────────────────────────────────────────────────────────
const MetricCard = React.memo(function MetricCard({
  stock,
  isExpanded: controlledExpanded,
  onToggleExpand,
  onAISummary,
  onAddToList,
  connectedBrokerages = [],
  onPin,
  isPinned,
  isMarketOpen,
  aiModel,
  db,
  user,
  livePrices,
  onSetAlert,       // (stock) => void  — opens PriceAlertModal in App
  // legacy MetricCard props kept for backwards compat
  watchlist = [],
  removeFromWatchlist,
  showAddToListMenu,
  onCloseMenu,
  watchlists = [],
  onOpenChat,
  onScanSimilar,
}) {
  const cardRef = useRef(null);
  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);

  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const [showAlertModal, setShowAlertModal] = useState(false); // placeholder — no web alert modal
  const [showChart, setShowChart] = useState(false);
  const [showBio, setShowBio] = useState(false);
  const [bioText, setBioText] = useState(null);
  const [bioLoading, setBioLoading] = useState(false);
  const [showRatings, setShowRatings] = useState(false);
  const [ratingsData, setRatingsData] = useState(null);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [hasSavedChat, setHasSavedChat] = useState(false);
  const [tradeDropdownOpen, setTradeDropdownOpen] = useState(false);

  const symbol = stock.symbol || stock.ticker;
  const price  = parseFloat(stock.price)  || 0;
  const change = parseFloat(stock.change) || 0;

  // Live price — prefer WebSocket feed, fall back to prop
  const wsData      = livePrices?.[symbol];
  const prevCloseRef = useRef(null);
  if (prevCloseRef.current === null && stock.prevClose) {
    prevCloseRef.current = parseFloat(stock.prevClose);
  } else if (prevCloseRef.current === null && stock.price && stock.change) {
    const cp = parseFloat(stock.change);
    prevCloseRef.current = parseFloat(stock.price) / (1 + cp / 100);
  }
  const displayPrice  = wsData?.price ?? price;
  const prevClose     = prevCloseRef.current || price;
  const displayChange = prevClose > 0 ? ((displayPrice - prevClose) / prevClose) * 100 : change;

  const isPositive  = displayChange >= 0;
  const accent      = isPositive ? '#00ff4e' : '#FF4B2B';
  const cs          = getCatalystStyle(stock.catalystType);
  const CatalystIcon = cs.Icon;
  const earningsLabel = getEarningsLabel(stock.earnings);
  const companyName   = stock._company?.name || stock.name || stock.companyName || symbol;

  // Catalyst text (same logic as StockCard)
  const rawCatalyst = stock.catalyst || '';
  const isUseless = rawCatalyst.toLowerCase().includes('no clear') ||
                    rawCatalyst.toLowerCase().includes('not identified') ||
                    rawCatalyst.toLowerCase().includes('provided summaries') ||
                    rawCatalyst.toLowerCase().includes('no catalyst') ||
                    rawCatalyst.toLowerCase().includes('manual lookup') ||
                    rawCatalyst.toLowerCase().includes('manual_lookup');
  const catalystText = ((rawCatalyst && !isUseless)
    ? rawCatalyst
    : (stock.headline?.slice(0, 120) || stock.trigger || 'Unusual activity detected')).replace(/\*\*/g, '').trim();
  const dashIdx = catalystText.indexOf(' — ');
  const hook   = (dashIdx > 15 && dashIdx < catalystText.length - 4) ? catalystText.slice(0, dashIdx)     : catalystText;
  const detail = (dashIdx > 15 && dashIdx < catalystText.length - 4) ? catalystText.slice(dashIdx + 3) : null;

  const closeAllSections = useCallback(() => {
    setShowChart(false);
    setShowBio(false);
    setShowRatings(false);
    setShowNews(false);
    setChatOpen(false);
  }, []);

  // Auto-close sections when card collapses
  useEffect(() => {
    if (!expanded) closeAllSections();
  }, [expanded, closeAllSections]);

  // Auto-collapse when scrolled out of view
  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          const hasOpen = showChart || showBio || showRatings || showNews || chatOpen;
          if (!hasOpen) return;
          const isAbove = entry.boundingClientRect.top < 0;
          const prevH = cardRef.current?.offsetHeight || 0;
          closeAllSections();
          if (isAbove) {
            setTimeout(() => {
              const newH = cardRef.current?.offsetHeight || 0;
              const diff = prevH - newH;
              if (diff > 0) window.scrollBy(0, -diff);
            }, 450);
          }
        }
      },
      { threshold: 0 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [showChart, showBio, showRatings, showNews, chatOpen, closeAllSections]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatOpen]);

  // Focus chat input when opened
  useEffect(() => {
    if (chatOpen && chatInputRef.current) {
      setTimeout(() => chatInputRef.current?.focus(), 300);
    }
  }, [chatOpen]);

  // Load saved chat from Firestore
  useEffect(() => {
    if (!user?.uid || !db || !symbol || chatLoaded) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'stockChats', symbol));
        if (snap.exists() && snap.data().messages?.length > 0) {
          setChatMessages(snap.data().messages);
          setHasSavedChat(true);
        }
      } catch (e) {}
      setChatLoaded(true);
    };
    load();
  }, [user, db, symbol, chatLoaded]);

  const saveChat = async (messages) => {
    if (!user?.uid || !db || !symbol || messages.length === 0) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'stockChats', symbol), {
        messages: messages.slice(-50),
        symbol,
        name: companyName,
        updatedAt: new Date().toISOString(),
      });
      setHasSavedChat(true);
    } catch (e) {}
  };

  // ===== AI Chat (mirrors StockCard sendMessage) =====
  const sendMessage = async (text) => {
    if (!text?.trim() || chatLoading || !aiModel) return;
    const userMsg    = { role: 'user', text: text.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    setChatOpen(true);
    try {
      const context = `Stock: ${symbol} (${companyName})\nPrice: $${displayPrice.toFixed(2)}\nChange: ${isPositive ? '+' : ''}${displayChange.toFixed(2)}%\nCatalyst: ${stock.catalyst || 'N/A'}\nIndustry: ${stock.industry || stock._company?.industry || 'N/A'}\nVolume: ${formatVolume(stock.volume) || 'N/A'}\nVolume Ratio: ${stock.volumeRatio || 'N/A'}x`;
      const prompt  = `You are an AI stock analyst assistant. Context:\n${context}\n\nUser: ${text.trim()}\n\nProvide a concise, helpful answer. No disclaimers. Be specific and actionable.`;
      const response = await aiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
      });
      const aiText = await response.response.text();
      const updated = [...newMessages, { role: 'assistant', text: aiText || 'No response generated.' }];
      setChatMessages(updated);
      saveChat(updated);
    } catch (e) {
      const updated = [...newMessages, { role: 'assistant', text: 'Unable to get a response. Try again.' }];
      setChatMessages(updated);
      saveChat(updated);
    } finally {
      setChatLoading(false);
    }
  };

  // ===== Bio (mirrors StockCard fetchBio) =====
  const fetchBio = async () => {
    if (bioText) { setShowBio(!showBio); return; }
    setBioLoading(true);
    setShowBio(true);
    // Check Firestore cache
    if (db) {
      try {
        const cached = await getDoc(doc(db, 'stockBios', symbol));
        if (cached.exists() && cached.data().bio) {
          setBioText(cached.data().bio);
          setBioLoading(false);
          return;
        }
      } catch (e) {}
    }
    try {
      const response = await aiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: `Give a 2-3 sentence company overview of ${companyName} (${symbol}). Include what the company does, its sector, and what makes it notable. Be concise and factual. No disclaimers.` }] }],
      });
      const text = await response.response.text();
      setBioText(text || 'No bio available.');
      if (db) {
        try {
          await setDoc(doc(db, 'stockBios', symbol), { bio: text, name: companyName, updatedAt: new Date().toISOString() });
        } catch (e) {}
      }
    } catch (e) {
      setBioText('Unable to load company bio.');
    } finally {
      setBioLoading(false);
    }
  };

  // ===== Ratings (mirrors StockCard fetchRatings) =====
  const fetchRatings = async () => {
    if (ratingsData) { setShowRatings(!showRatings); return; }
    setRatingsLoading(true);
    setShowRatings(true);
    try {
      let tickerData = null;
      try {
        const res = await fetch(`https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${process.env.REACT_APP_POLYGON_KEY}`);
        tickerData = await res.json();
      } catch (e) {}

      let recommendations = [];
      try {
        const rec = await fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${process.env.REACT_APP_FINNHUB_KEY}`);
        const d = await rec.json();
        recommendations = Array.isArray(d) ? d.slice(0, 3) : [];
      } catch (e) {}

      let priceTarget = null;
      try {
        const curPrice = parseFloat(stock.price || 0).toFixed(2);
        const r = await aiModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: `Stock: ${symbol}, current price: $${curPrice}. What is the 12-month analyst consensus price target? Return ONLY valid JSON with real analyst data. Format: {"targetLow": NUMBER, "targetMean": NUMBER, "targetHigh": NUMBER}. Numbers must be actual analyst estimates relevant to the current price, NOT placeholders. If no analyst coverage exists, return: {"unavailable": true}. No other text.` }] }],
          tools: [{ googleSearch: {} }],
        });
        const txt = await r.response.text();
        const m = txt.match(/\{[^}]+\}/);
        if (m) {
          const p  = JSON.parse(m[0]);
          const cp = parseFloat(curPrice);
          const isPlaceholder = p.unavailable || !p.targetMean ||
            (Math.round(p.targetLow) === 10 && Math.round(p.targetMean) === 15 && Math.round(p.targetHigh) === 20) ||
            (p.targetLow === p.targetMean && p.targetMean === p.targetHigh) ||
            (cp > 1 && (p.targetMean < cp * 0.1 || p.targetMean > cp * 20));
          if (!isPlaceholder) priceTarget = p;
        }
      } catch (e) {}

      setRatingsData({
        marketCap:       tickerData?.results?.market_cap,
        recommendations,
        priceTarget,
      });
    } catch (e) {
      setRatingsData({ error: true });
    } finally {
      setRatingsLoading(false);
    }
  };

  // ===== Share (web equivalent of StockCard handleShare) =====
  const handleShare = () => {
    const arrow     = isPositive ? '▲' : '▼';
    const changeStr = `${isPositive ? '+' : ''}${displayChange.toFixed(2)}%`;
    const catalyst  = stock.catalyst && !stock.catalyst.toLowerCase().includes('no clear')
      ? `\n📌 ${stock.catalyst.slice(0, 100)}` : '';
    const text = `${symbol} — $${displayPrice.toFixed(2)} (${arrow} ${changeStr})${catalyst}\n\nFound on jckrbbt.io`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  // ─── Brokerage buttons ───────────────────────────────────────────────────
  const brokeragesWithUrls = connectedBrokerages
    .map(b => ({ ...b, url: getBrokerageTradeUrl(b.name, symbol) }))
    .filter(b => b.url);

  const handleTrade = (url) => window.open(url, '_blank', 'noopener');

  const toggleExpand = () => {
    if (expanded) closeAllSections();
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      ref={cardRef}
      style={{
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
      }}
    >
      {/* Card body */}
      <div
        className="glass-card"
        style={{
          padding: 16,
          background: 'rgba(255,255,255,0.05)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
        }}
      >
        {/* Clickable header area (expands/collapses) */}
        <div onClick={toggleExpand} style={{ cursor: 'pointer' }}>

          {/* ACTIONS ROW */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 2 }}>
            {/* Status dot */}
            <div style={{
              width: 7, height: 7, borderRadius: 4,
              backgroundColor: accent,
              boxShadow: `0 0 6px ${accent}`,
              marginRight: 'auto',
            }} />

            {/* Pin button */}
            {onPin && (
              <button
                onClick={(e) => { e.stopPropagation(); onPin(stock); }}
                style={{
                  ...S.iconBtn,
                  ...(isPinned ? { backgroundColor: '#00ff4e', borderColor: '#00ff4e' } : {}),
                }}
              >
                <Pin size={15} color={isPinned ? '#000' : '#00ff4e'} />
              </button>
            )}

            {/* Share button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              style={S.iconBtn}
            >
              <Share2 size={14} color="#00ff4e" />
            </button>

            {/* Add to list button */}
            {onAddToList && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddToList(stock); }}
                style={S.addToListBtn}
              >
                <span style={S.addToListText}>Add to List</span>
                <Plus size={13} color="#00ff4e" />
              </button>
            )}
          </div>

          {/* TICKER ROW — navigates to stock detail */}
          <div
            onClick={(e) => { e.stopPropagation(); window.location.href = `/stock/${symbol}`; }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, cursor: 'pointer' }}
          >
            <span style={{
              fontSize: 40, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
              color: '#fff', letterSpacing: -2, lineHeight: 1,
            }}>
              {symbol}
            </span>
            <div style={{
              marginLeft: 6, backgroundColor: 'rgba(0,255,78,0.1)', borderRadius: 6, padding: 3,
              boxShadow: '0 0 6px rgba(0,255,78,0.4)',
            }}>
              <ArrowUpRight size={13} color="#00ff4e" />
            </div>
          </div>

          {/* Company name */}
          <p style={{
            fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
            color: '#737373', letterSpacing: 3, textTransform: 'uppercase',
            marginBottom: 8, marginLeft: 2, margin: '0 0 8px 2px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {companyName}
          </p>

          {/* PRICE ROW */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <span style={{
              fontSize: 30, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
              color: '#fff', fontVariantNumeric: 'tabular-nums',
            }}>
              $<CountUp end={displayPrice} decimals={2} duration={1200} />
            </span>
            <span style={{
              fontSize: 22, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
              color: accent, fontVariantNumeric: 'tabular-nums',
            }}>
              {isPositive ? '+' : '-'}<CountUp end={Math.abs(displayChange)} decimals={2} duration={1200} />%
            </span>
            <span style={{ fontSize: 18, color: accent, marginLeft: 4 }}>
              {isPositive ? '▲' : '▼'}
            </span>
          </div>

          {/* TRADE & ALERT ROW */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }} onClick={e => e.stopPropagation()}>
            {brokeragesWithUrls.length === 1 && (
              <button
                style={{ ...S.tradeBtn, flex: 1 }}
                onClick={() => handleTrade(brokeragesWithUrls[0].url)}
              >
                <Briefcase size={12} color="#00ff4e" />
                <span style={S.tradeBtnText}>Trade on {brokeragesWithUrls[0].name}</span>
              </button>
            )}
            {brokeragesWithUrls.length > 1 && (
              <div style={{ flex: 1 }}>
                <TradeDropdown brokerages={brokeragesWithUrls} onTrade={handleTrade} />
              </div>
            )}
            <button
              style={{ ...S.tradeBtn, flex: 1 }}
              onClick={() => onSetAlert ? onSetAlert(stock) : setShowAlertModal(true)}
            >
              <Bell size={12} color="#00ff4e" />
              <span style={S.tradeBtnText}>Set Alert</span>
            </button>
          </div>

          {/* STATS GRID */}
          <div style={{
            display: 'flex', gap: 16, paddingTop: 14, paddingBottom: 14,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            {stock.volume > 0 && (
              <div style={{ flex: 1 }}>
                <p style={S.statLabel}>Volume</p>
                <p style={S.statValue}>{formatVolume(stock.volume)}</p>
              </div>
            )}
            {stock.volumeRatio && parseFloat(stock.volumeRatio) > 1 && (
              <div style={{ flex: 1 }}>
                <p style={S.statLabel}>vs Avg Volume</p>
                <p style={{ ...S.statValue, color: '#f59e0b' }}>{stock.volumeRatio}x</p>
              </div>
            )}
            {stock.industry && (
              <div style={{ flex: 1 }}>
                <p style={S.statLabel}>Sector</p>
                <p style={{ ...S.statValue, fontSize: 12 }}>{stock.industry}</p>
              </div>
            )}
          </div>

          {/* TAGS */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {/* Catalyst tag */}
            <div style={{ ...S.tagPill, backgroundColor: cs.color + '15', borderColor: cs.color + '40' }}>
              <CatalystIcon size={12} color={cs.color} />
              <span style={{ ...S.tagLabel, color: cs.color }}>{cs.label}</span>
            </div>
            {/* Sentiment tag */}
            {stock.sentiment && stock.sentiment !== 'NEUTRAL' && (
              <div style={{
                ...S.tagPill,
                backgroundColor: (stock.sentiment === 'BULLISH' ? '#00ff4e' : '#FF4B2B') + '15',
                borderColor:     (stock.sentiment === 'BULLISH' ? '#00ff4e' : '#FF4B2B') + '40',
              }}>
                <span style={{ ...S.tagLabel, color: stock.sentiment === 'BULLISH' ? '#00ff4e' : '#FF4B2B' }}>
                  {stock.sentiment === 'BULLISH' ? '▲' : '▼'} {stock.sentiment}
                </span>
              </div>
            )}
            {/* Earnings tag */}
            {earningsLabel && (
              <div style={{ ...S.tagPill, backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)' }}>
                <BarChart3 size={12} color="#f59e0b" />
                <span style={{ ...S.tagLabel, color: '#f59e0b' }}>EARNINGS {earningsLabel}</span>
              </div>
            )}
          </div>

          {/* CATALYST SECTION */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: cs.color + '15', border: `1px solid ${cs.color}40`,
            }}>
              <CatalystIcon size={16} color={cs.color} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                color: '#666', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4,
              }}>
                {stock.catalystType === 'early_signal'  ? 'Unusual Activity Detected' :
                 stock.catalystType === 'options_first' ? 'Smart Money Positioning'   : "Why It's Moving"}
              </p>
              <p style={{
                fontSize: 16, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                color: '#fff', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: expanded ? undefined : 2,
                WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden',
              }}>
                {hook}
              </p>
              {detail && expanded && (
                <p style={{ fontSize: 13, color: '#999', lineHeight: 1.5, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, marginTop: 4 }}>
                  {detail}
                </p>
              )}
            </div>
          </div>

          {/* SOURCE BOX */}
          {stock.newsSource && (
            <a
              href={stock.news?.[0]?.article_url || stock.news?.[0]?.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', backgroundColor: 'rgba(0,0,0,0.7)',
                borderRadius: 10, border: '1px solid rgba(0,255,78,0.35)',
                marginBottom: 12, textDecoration: 'none',
              }}
            >
              <FileText size={12} color="#00ff4e" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 12, color: '#d4d4d8',
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  margin: 0,
                }}>
                  {stock.headline}
                </p>
                <p style={{ fontSize: 10, color: '#555', marginTop: 2, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, margin: '2px 0 0' }}>
                  {stock.newsSource}{stock.newsDate ? ` · ${stock.newsDate}` : ''}
                </p>
              </div>
              <span style={{ color: '#3f3f46', fontSize: 14 }}>→</span>
            </a>
          )}
        </div>{/* end clickable header area */}

        {/* AI SUMMARY BUTTON (optional) */}
        {onAISummary && (
          <div style={{ paddingTop: 14, paddingBottom: 14 }}>
            <button
              onClick={() => onAISummary(stock)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 7, padding: '10px 16px', borderRadius: 10, width: '100%',
                border: '1px solid rgba(168,85,247,0.35)',
                backgroundColor: 'rgba(168,85,247,0.08)', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 14, color: '#a855f7' }}>✦</span>
              <span style={{
                fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                color: '#a855f7', letterSpacing: 1, textTransform: 'uppercase',
              }}>
                AI Summary
              </span>
            </button>
          </div>
        )}

        {/* ===== EXPANDED SECTION ===== */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transition: { duration: 0.3 } }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              {/* OPTIONS DATA */}
              {stock.optionsData && (
                <div style={{
                  marginTop: 8, paddingTop: 12,
                  borderTop: '1px solid rgba(168,85,247,0.15)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Activity size={12} color="#a855f7" />
                    <span style={{
                      fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                      color: '#a855f7', letterSpacing: 2,
                    }}>
                      OPTIONS ACTIVITY
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 24, paddingBottom: 10 }}>
                    {stock.optionsData.callVolume > 0 && (
                      <div style={{ minWidth: 70 }}>
                        <p style={S.statLabel}>Call Vol</p>
                        <p style={{ ...S.statValue, color: '#a855f7' }}>{formatVolume(stock.optionsData.callVolume)}</p>
                      </div>
                    )}
                    {stock.optionsData.avgIV > 0 && (
                      <div style={{ minWidth: 70 }}>
                        <p style={S.statLabel}>Avg IV</p>
                        <p style={{ ...S.statValue, color: '#c084fc' }}>{(stock.optionsData.avgIV * 100).toFixed(0)}%</p>
                      </div>
                    )}
                    {stock.optionsData.otmCallPct > 0 && (
                      <div style={{ minWidth: 70 }}>
                        <p style={S.statLabel}>OTM Calls</p>
                        <p style={{ ...S.statValue, color: '#d946ef' }}>{(stock.optionsData.otmCallPct * 100).toFixed(0)}%</p>
                      </div>
                    )}
                  </div>
                  {stock.patterns?.length > 0 && <PatternTags patterns={stock.patterns} />}
                </div>
              )}

              {/* Patterns without options data */}
              {!stock.optionsData && stock.patterns?.length > 0 && (
                <PatternTags patterns={stock.patterns} />
              )}

              {/* CHART */}
              <ExpandableSection
                title={showChart ? 'Hide Chart' : 'View Chart'}
                iconName="trending-up"
                isOpen={showChart}
                onToggle={() => setShowChart(!showChart)}
              >
                <MiniChart
                  symbol={symbol}
                  livePrice={wsData?.price}
                  liveChange={displayChange}
                  isMarketOpen={isMarketOpen}
                />
              </ExpandableSection>

              {/* BIO */}
              <ExpandableSection
                title={showBio ? 'Hide Bio' : 'Company Bio'}
                iconName="briefcase"
                isOpen={showBio}
                onToggle={fetchBio}
                loading={bioLoading}
              >
                <div style={{ padding: 14 }}>
                  <p style={{ fontSize: 14, color: '#d4d4d8', lineHeight: 1.6, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, margin: 0 }}>
                    {bioText}
                  </p>
                </div>
              </ExpandableSection>

              {/* RATINGS */}
              <ExpandableSection
                title={showRatings ? 'Hide Ratings' : 'Analyst Ratings'}
                iconName="target"
                isOpen={showRatings}
                onToggle={fetchRatings}
                loading={ratingsLoading}
              >
                {ratingsData?.error ? (
                  <p style={{ fontSize: 12, color: '#8a8a8a', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>
                    Unable to load analyst data.
                  </p>
                ) : (
                  <div style={{ padding: 14 }}>
                    {ratingsData?.priceTarget?.targetMean && (
                      <div style={{ marginBottom: 14 }}>
                        <p style={S.secLabel}>12-Month Price Target</p>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <p style={S.tgtLabel}>Low</p>
                            <p style={{ ...S.tgtVal, color: '#ef4444' }}>${ratingsData.priceTarget.targetLow?.toFixed(2)}</p>
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={S.tgtLabel}>Average</p>
                            <p style={{ ...S.tgtVal, color: '#fff' }}>${ratingsData.priceTarget.targetMean?.toFixed(2)}</p>
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={S.tgtLabel}>High</p>
                            <p style={{ ...S.tgtVal, color: '#00ff4e' }}>${ratingsData.priceTarget.targetHigh?.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {ratingsData?.recommendations?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <p style={S.secLabel}>Recent Consensus</p>
                        {ratingsData.recommendations.map((rec, i) => {
                          const total   = (rec.buy||0)+(rec.hold||0)+(rec.sell||0)+(rec.strongBuy||0)+(rec.strongSell||0);
                          const bullish = ((rec.buy||0)+(rec.strongBuy||0))/(total||1)*100;
                          const barColor = bullish > 60 ? '#00ff4e' : bullish > 40 ? '#f59e0b' : '#ef4444';
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 10, color: '#8a8a8a', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, width: 50 }}>
                                {new Date(rec.period).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                              </span>
                              <div style={{ flex: 1, height: 6, backgroundColor: '#27272a', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${bullish}%`, height: '100%', backgroundColor: barColor, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, width: 55, textAlign: 'right', color: barColor }}>
                                {bullish.toFixed(0)}% Buy
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {ratingsData?.marketCap && (
                      <div>
                        <p style={S.secLabel}>Market Cap</p>
                        <p style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: '#fff', margin: 0 }}>
                          ${ratingsData.marketCap >= 1e12 ? (ratingsData.marketCap/1e12).toFixed(2)+'T' :
                            ratingsData.marketCap >= 1e9  ? (ratingsData.marketCap/1e9).toFixed(2)+'B'  :
                            ratingsData.marketCap >= 1e6  ? (ratingsData.marketCap/1e6).toFixed(2)+'M'  :
                            ratingsData.marketCap.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </ExpandableSection>

              {/* ASK AI */}
              <div style={{ borderTop: '1px solid rgba(113,113,122,0.18)', paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Cpu size={14} color="#00ff4e" />
                  <span style={{
                    fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                    textTransform: 'uppercase', letterSpacing: 2, color: '#fff',
                  }}>
                    Ask AI
                  </span>
                </div>

                {/* Chat messages */}
                {chatMessages.length > 0 && chatOpen && (
                  <div style={{
                    backgroundColor: 'rgba(0,0,0,0.7)', border: '1px solid #3f3f46',
                    borderRadius: 12, padding: 12, marginBottom: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MessageCircle size={12} color="#00ff4e" />
                        <span style={{
                          fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                          textTransform: 'uppercase', letterSpacing: 1.5, color: '#00ff4e',
                        }}>
                          AI Research · {symbol}
                        </span>
                        {hasSavedChat && (
                          <span style={{ fontSize: 8, color: 'rgba(0,255,78,0.5)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                            · Saved
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                          onClick={async () => {
                            setChatMessages([]);
                            setHasSavedChat(false);
                            if (user?.uid && db) {
                              try { await deleteDoc(doc(db, 'users', user.uid, 'stockChats', symbol)); } catch (e) {}
                            }
                            setChatOpen(false);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: '#555', textTransform: 'uppercase' }}
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => setChatOpen(false)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}
                        >
                          Collapse ▲
                        </button>
                      </div>
                    </div>
                    <div ref={chatScrollRef} style={{ maxHeight: 300, overflowY: 'auto' }}>
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          style={{
                            ...(msg.role === 'user' ? S.userBub : S.aiBub),
                            marginBottom: 8,
                          }}
                        >
                          <p style={{
                            ...(msg.role === 'user' ? S.userTxt : S.aiTxt),
                            margin: 0, whiteSpace: 'pre-wrap',
                          }}>
                            {msg.text.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                              part.startsWith('**') && part.endsWith('**')
                                ? <strong key={j} style={{ color: '#fff' }}>{part.slice(2, -2)}</strong>
                                : part
                            )}
                          </p>
                        </div>
                      ))}
                      {chatLoading && (
                        <div style={{ ...S.aiBub, marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={S.spinner} />
                            <span style={{ fontSize: 12, color: '#8a8a8a' }}>Researching...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Collapsed chat indicator */}
                {chatMessages.length > 0 && !chatOpen && (
                  <button
                    onClick={() => setChatOpen(true)}
                    style={{
                      display: 'block', width: '100%', background: 'none', border: 'none',
                      cursor: 'pointer', paddingTop: 6, paddingBottom: 6, textAlign: 'center',
                      fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
                      color: '#00ff4e', textTransform: 'uppercase', letterSpacing: 1,
                    }}
                  >
                    Show {chatMessages.length} messages ▼
                  </button>
                )}

                {/* Quick prompts */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {QUICK_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(p)}
                      disabled={chatLoading}
                      style={{
                        ...S.promptChip,
                        ...(i === 0 ? S.promptFirst : {}),
                      }}
                    >
                      <span style={{
                        fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
                        color: i === 0 ? '#00ff4e' : '#a1a1aa',
                      }}>
                        {p}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Chat input */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput); } }}
                    onFocus={() => { if (!chatOpen && chatMessages.length > 0) setChatOpen(true); }}
                    placeholder={`Ask about ${symbol}...`}
                    disabled={chatLoading}
                    style={{
                      flex: 1, backgroundColor: '#000', border: '1px solid #3f3f46',
                      borderRadius: 12, color: '#fff', padding: '12px 14px',
                      fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
                      caretColor: '#00ff4e', outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => sendMessage(chatInput)}
                    disabled={!chatInput.trim() || chatLoading}
                    style={{
                      backgroundColor: '#00ff4e', borderRadius: 12, padding: 12,
                      border: 'none', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      opacity: (!chatInput.trim() || chatLoading) ? 0.2 : 1,
                    }}
                  >
                    <Send size={16} color="#000" />
                  </button>
                </div>
              </div>

              {/* NEWS */}
              {stock.news?.length > 0 && (
                <ExpandableSection
                  title={showNews ? 'Hide News' : `View ${stock.news.length} Related ${stock.news.length === 1 ? 'Article' : 'Articles'}`}
                  iconName="file-text"
                  isOpen={showNews}
                  onToggle={() => setShowNews(!showNews)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {stock.news.map((article, i) => (
                      <a
                        key={i}
                        href={article.article_url || article.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          backgroundColor: 'rgba(0,0,0,0.7)', border: '1px solid #3f3f46',
                          borderRadius: 12, padding: 12, textDecoration: 'none',
                        }}
                      >
                        <FileText size={13} color="#00ff4e" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 13, color: '#d4d4d8',
                            fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
                            lineHeight: 1.4, marginBottom: 4,
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '0 0 4px',
                          }}>
                            {article.title}
                          </p>
                          <p style={{ fontSize: 10, color: '#8a8a8a', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, margin: 0 }}>
                            {article.publisher?.name || 'Unknown'}{article.published_utc ? ` · ${new Date(article.published_utc).toLocaleDateString()}` : ''}
                          </p>
                        </div>
                        <span style={{ color: '#3f3f46', fontSize: 14 }}>→</span>
                      </a>
                    ))}
                  </div>
                </ExpandableSection>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM CHEVRON */}
        <div
          onClick={toggleExpand}
          style={{ display: 'flex', justifyContent: 'center', marginTop: 8, paddingTop: 4, paddingBottom: 4, cursor: 'pointer' }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(0,255,78,0.12)',
            border: '1px solid rgba(0,255,78,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px rgba(0,255,78,0.6)',
          }}>
            {expanded
              ? <ChevronUp  size={20} color="#00ff4e" />
              : <ChevronDown size={20} color="#00ff4e" />
            }
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  const sym = next.stock.symbol;
  return (
    prev.stock.symbol   === next.stock.symbol   &&
    prev.stock.price    === next.stock.price     &&
    prev.stock.change   === next.stock.change    &&
    prev.isMarketOpen   === next.isMarketOpen    &&
    prev.isPinned       === next.isPinned        &&
    prev.aiModel        === next.aiModel         &&
    prev.db             === next.db              &&
    prev.livePrices?.[sym]?.price === next.livePrices?.[sym]?.price
  );
});

// ─── PatternTags helper ───────────────────────────────────────────────────────
function PatternTags({ patterns }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, marginBottom: 12 }}>
      {patterns.slice(0, 5).map((p, i) => {
        const c = PATTERN_COLORS[p] || '#666';
        return (
          <div key={i} style={{
            paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
            borderRadius: 5, border: `1px solid ${c}50`, backgroundColor: c + '12',
          }}>
            <span style={{
              fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
              letterSpacing: 0.5, textTransform: 'uppercase', color: c,
            }}>
              {p.replace(/_/g, ' ')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared style tokens ──────────────────────────────────────────────────────
const S = {
  iconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '5px 8px', borderRadius: 8, background: 'none',
    border: '1px solid rgba(0,255,78,0.25)', backgroundColor: 'rgba(0,255,78,0.06)',
    cursor: 'pointer',
  },
  addToListBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 8, background: 'none',
    border: '1px solid rgba(0,255,78,0.25)', backgroundColor: 'rgba(0,255,78,0.06)',
    cursor: 'pointer',
  },
  addToListText: {
    fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
    color: '#00ff4e', letterSpacing: 0.5,
  },
  tradeBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 12px', borderRadius: 8,
    border: '1px solid rgba(0,255,78,0.3)', backgroundColor: 'rgba(0,255,78,0.05)',
    cursor: 'pointer', background: 'none',
  },
  tradeBtnText: {
    fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
    color: '#00ff4e', letterSpacing: 0.8, textTransform: 'uppercase',
  },
  statLabel: {
    fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
    color: '#666', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4, margin: '0 0 4px',
  },
  statValue: {
    fontSize: 16, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: '#fff', margin: 0,
  },
  tagPill: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 10px', borderRadius: 6, border: '1px solid transparent',
  },
  tagLabel: {
    fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  secLabel: {
    fontSize: 8, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
    color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 8, margin: '0 0 8px',
  },
  tgtLabel: {
    fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
    color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 2, margin: '0 0 2px',
  },
  tgtVal: {
    fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, margin: 0,
  },
  userBub: {
    backgroundColor: 'rgba(0,255,78,0.1)', border: '1px solid rgba(0,255,78,0.2)',
    borderRadius: 12, padding: 12, alignSelf: 'flex-end', maxWidth: '85%',
    display: 'inline-block', float: 'right', clear: 'both',
  },
  aiBub: {
    backgroundColor: 'rgba(39,39,42,0.8)', border: '1px solid #3f3f46',
    borderRadius: 12, padding: 12, alignSelf: 'flex-start', maxWidth: '95%',
    display: 'inline-block', float: 'left', clear: 'both',
  },
  userTxt: {
    fontSize: 13, color: '#fff', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, lineHeight: 1.5,
  },
  aiTxt: {
    fontSize: 13, color: '#d4d4d8', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, lineHeight: 1.55,
  },
  promptChip: {
    border: '1px solid #3f3f46', borderRadius: 8,
    padding: '8px 12px', background: 'none', cursor: 'pointer',
  },
  promptFirst: {
    borderColor: 'rgba(0,255,78,0.4)', backgroundColor: 'rgba(0,255,78,0.08)',
  },
  spinner: {
    width: 14, height: 14, borderRadius: '50%',
    border: '2px solid rgba(0,255,78,0.2)', borderTopColor: '#00ff4e',
    display: 'inline-block', animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
};

// Inject spinner keyframes once
if (typeof document !== 'undefined' && !document.getElementById('mc-spin')) {
  const style = document.createElement('style');
  style.id = 'mc-spin';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}

export default MetricCard;
