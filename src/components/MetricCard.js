// components/MetricCard.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import TradeButton from './TradeButton';
import StockChart from './StockChart';
import { Activity, Target, TrendingUp, BarChart3, Lightbulb, Newspaper, MessageCircle, Send, Plus, Trash2, Search, FileText, Zap, List, X, Check, Building2 } from 'lucide-react';
import CountUp from '../CountUp';
import MiniChart from './MiniChart';
import { POLYGON_KEY, REPUTABLE_SOURCES, NEWS_SOURCES, cleanCompanyName, getTradeUrl, getBrokerageLogo, getBrokerageIcon } from '../config/constants';

const MetricCard = React.memo(function MetricCard({ 
  stock, isMarketOpen, onAction, actionType, watchlist = [], 
  removeFromWatchlist, showAddToListMenu, onCloseMenu, 
  watchlists = [], onAddToList, user, onOpenChat, onScanSimilar,
  aiModel, db, connectedBrokerages, livePrices
}) {
  const [showChart, setShowChart] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [isHoveringButton, setIsHoveringButton] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const cardRef = useRef(null);
const chatContainerRef = useRef(null);
const chatInputRef = useRef(null);
  const prevPrice = useRef(null);
  const prevChange = useRef(null);
  const hasAnimatedRef = useRef(false);

  // Use actual previous close from Polygon snapshot when available
  const prevCloseRef = useRef(null);
  if (prevCloseRef.current === null && stock.prevClose) {
    prevCloseRef.current = parseFloat(stock.prevClose);
  } else if (prevCloseRef.current === null && stock.price && stock.change) {
    // Fallback: derive from price/change (manual search, etc.)
    const changePercent = parseFloat(stock.change);
    prevCloseRef.current = parseFloat(stock.price) / (1 + changePercent / 100);
  }

  // Use WebSocket price when available, fall back to stock prop
  const wsData = livePrices?.[stock.symbol];
  const livePrice = wsData?.price ?? parseFloat(stock.price);
  const prevClose = prevCloseRef.current || parseFloat(stock.price);
  const liveChange = prevClose > 0 ? ((livePrice - prevClose) / prevClose) * 100 : parseFloat(stock.change);
  
  const isPositive = liveChange >= 0;
  const accent = isPositive ? '#00ff4e' : '#FF4B2B';
  const trendColor = isPositive ? '#00ff4e' : '#FF4B2B';
  const Triangle = isPositive ? '▲' : '▼';
  const prefix = isPositive ? '+' : '';
  const isAlreadyAdded = watchlist.some(s => s.symbol === stock.symbol);
  
  const shouldAnimate = !hasAnimatedRef.current || 
    (prevPrice.current !== null && prevPrice.current !== livePrice) ||
    (prevChange.current !== null && prevChange.current !== liveChange);

    const [chatLoaded, setChatLoaded] = useState(false);
  const [hasSavedChat, setHasSavedChat] = useState(false);
  const [showBio, setShowBio] = useState(false);
const [bioText, setBioText] = useState(null);
const [bioLoading, setBioLoading] = useState(false);
const [showRatings, setShowRatings] = useState(false);
const [ratingsData, setRatingsData] = useState(null);
const [ratingsLoading, setRatingsLoading] = useState(false);
const [showReport, setShowReport] = useState(false);
const [reportData, setReportData] = useState(null);
const [reportLoading, setReportLoading] = useState(false);

  // Lock body scroll when report modal is open
  useEffect(() => {
    if (showReport) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [showReport]);

  // Load saved chat history on mount
  // Close all expanded sections when card scrolls out of view
  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          const hasOpenSection = showChart || showBio || showRatings || showNews || chatOpen;
          if (!hasOpenSection) return;
          
          // Only adjust scroll if card is above viewport (scrolled past going down)
          const isAbove = entry.boundingClientRect.top < 0;
          const prevHeight = cardRef.current?.offsetHeight || 0;
          
          setShowChart(false);
          setShowBio(false);
          setShowRatings(false);
          setShowNews(false);
          setChatOpen(false);
          
          if (isAbove) {
            // Wait for collapse animations to finish, then adjust scroll
            setTimeout(() => {
              const newHeight = cardRef.current?.offsetHeight || 0;
              const diff = prevHeight - newHeight;
              if (diff > 0) {
                window.scrollBy(0, -diff);
              }
            }, 450);
          }
        }
      },
      { threshold: 0 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [showChart, showBio, showRatings, showNews, chatOpen]);

  useEffect(() => {
    if (!user?.uid || !db || !stock.symbol || chatLoaded) return;
    
    const loadChat = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const chatDoc = await getDoc(doc(db, 'users', user.uid, 'stockChats', stock.symbol));
        if (chatDoc.exists()) {
          const data = chatDoc.data();
          if (data.messages && data.messages.length > 0) {
            setChatMessages(data.messages);
            setHasSavedChat(true);
          }
        }
      } catch (e) {
        console.error('Failed to load chat:', e);
      }
      setChatLoaded(true);
    };
    
    loadChat();
  }, [user, db, stock.symbol, chatLoaded]);

  // Save chat to Firestore
  const saveChat = async (messages) => {
    if (!user?.uid || !db || !stock.symbol || messages.length === 0) return;
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'users', user.uid, 'stockChats', stock.symbol), {
        messages: messages.slice(-50), // Keep last 50 messages
        symbol: stock.symbol,
        name: stock.name,
        updatedAt: new Date().toISOString()
      });
      setHasSavedChat(true);
    } catch (e) {
      console.error('Failed to save chat:', e);
    }
  };

  useEffect(() => {
    prevPrice.current = livePrice;
    prevChange.current = liveChange;
    hasAnimatedRef.current = true;
  }, [livePrice, liveChange]);

const fetchBio = async () => {
    if (bioText) { setShowBio(!showBio); return; }
    setBioLoading(true);
    setShowBio(true);
    
    // Check Firestore cache first
    if (db) {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const cached = await getDoc(doc(db, 'stockBios', stock.symbol));
        if (cached.exists() && cached.data().bio) {
          setBioText(cached.data().bio);
          setBioLoading(false);
          return;
        }
      } catch (e) {}
    }

    try {
      const response = await aiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: `Give a 2-3 sentence company overview of ${stock.name} (${stock.symbol}). Include what the company does, its sector, and what makes it notable. Be concise and factual. No disclaimers.` }] }]
      });
      const text = await response.response.text();
      setBioText(text);
      
      // Cache in Firestore
      if (db) {
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          await setDoc(doc(db, 'stockBios', stock.symbol), {
            bio: text,
            name: stock.name,
            updatedAt: new Date().toISOString()
          });
        } catch (e) {}
      }
    } catch (e) {
      setBioText('Unable to load company bio.');
    } finally {
      setBioLoading(false);
    }
  };

const fetchRatings = async () => {
    if (ratingsData) { setShowRatings(!showRatings); return; }
    setRatingsLoading(true);
    setShowRatings(true);

    try {
      const res = await fetch(
        `https://api.polygon.io/v3/reference/tickers/${stock.symbol}?apiKey=${process.env.REACT_APP_POLYGON_KEY}`
      );
      const tickerData = await res.json();
      console.log('Polygon ticker data:', tickerData);

      const recRes = await fetch(
        `https://finnhub.io/api/v1/stock/recommendation?symbol=${stock.symbol}&token=${process.env.REACT_APP_FINNHUB_KEY}`
      );
      const recommendations = await recRes.json();
      console.log('Finnhub recommendations:', recommendations);

      let priceTarget = null;
      try {
        const ptResponse = await aiModel.generateContent({
          contents: [{ role: "user", parts: [{ text: `What is the current 12-month analyst consensus price target for ${stock.symbol}? Return ONLY a JSON object like {"targetLow": 10.00, "targetMean": 15.00, "targetHigh": 20.00}. If unavailable, return {"unavailable": true}. No other text, no markdown, no backticks.` }] }],
          tools: [{ googleSearch: {} }]
        });
        const ptText = await ptResponse.response.text();
        console.log('AI price target raw:', ptText);
        const jsonMatch = ptText.match(/\{[^}]+\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (!parsed.unavailable && parsed.targetMean) {
            priceTarget = parsed;
          }
        }
      } catch (e) {
        console.log('Price target error:', e.message);
      }

      console.log('Final ratingsData:', {
        marketCap: tickerData.results?.market_cap,
        recommendations: recommendations?.slice(0, 3),
        priceTarget
      });

      setRatingsData({
        description: tickerData.results?.description,
        marketCap: tickerData.results?.market_cap,
        recommendations: recommendations?.slice(0, 3) || [],
        priceTarget: priceTarget || null
      });
    } catch (e) {
      console.error('Ratings fetch error:', e);
      setRatingsData({ error: true });
    } finally {
      setRatingsLoading(false);
    }
  };

  const generateResearchReport = async () => {
    if (reportData) { setShowReport(true); return; }
    if (!aiModel) return;
    setReportLoading(true);
    setShowReport(true);

    try {
      const dataPoints = [];
      dataPoints.push(`Price: $${livePrice.toFixed(2)}`);
      dataPoints.push(`Change Today: ${liveChange >= 0 ? '+' : ''}${liveChange.toFixed(2)}%`);
      if (stock.catalyst) dataPoints.push(`Current Catalyst: ${stock.catalyst}`);
      if (stock.catalystType) dataPoints.push(`Trigger Type: ${stock.catalystType}`);
      if (stock.volume) dataPoints.push(`Volume: ${stock.volume.toLocaleString()}`);
      if (stock.volumeRatio) dataPoints.push(`Volume vs Average: ${stock.volumeRatio}x`);
      if (stock.industry) dataPoints.push(`Industry: ${stock.industry}`);
      if (stock.headline) dataPoints.push(`Latest headline: "${stock.headline}"`);
      if (bioText) dataPoints.push(`Company Bio: ${bioText}`);
      if (ratingsData?.priceTarget) dataPoints.push(`Price Targets: Low $${ratingsData.priceTarget.targetLow}, Mean $${ratingsData.priceTarget.targetMean}, High $${ratingsData.priceTarget.targetHigh}`);
      if (ratingsData?.marketCap) dataPoints.push(`Market Cap: $${(ratingsData.marketCap / 1e9).toFixed(2)}B`);
      
      let newsContext = '';
      if (stock.news && stock.news.length > 0) {
        newsContext = '\n\nRECENT NEWS:\n' + stock.news.map((n, i) => 
          `${i + 1}. "${n.title}" (${n.publisher?.name || 'Unknown'}, ${n.published_utc ? new Date(n.published_utc).toLocaleDateString() : 'Recent'})`
        ).join('\n');
      }

      const prompt = `You are a senior equity research analyst writing a comprehensive research report on ${stock.symbol} (${stock.name}). Use the data provided AND web search to fill in any gaps. Search for "${stock.symbol} financials", "${stock.symbol} analyst ratings", and "${stock.symbol} upcoming catalysts" to get the latest data.

AVAILABLE DATA:
${dataPoints.join('\n')}
${newsContext}

Write a research report with EXACTLY these sections. Use "##" before each heading. Be specific with numbers, dates, and data. Each section should be 2-4 sentences. No filler, no generic statements.

## EXECUTIVE SUMMARY
What the company does and why it's relevant right now. Include market cap and sector.

## WHY IT'S MOVING
The specific catalyst driving today's price action. Reference the news/volume data.

## BULL CASE
The 3 strongest arguments for buying. Be specific — reference revenue growth, partnerships, market opportunity, or technical setup.

## BEAR CASE
The 3 biggest risks. Be specific — reference competition, valuation, cash burn, dilution, or regulatory risk.

## TECHNICAL SETUP
Current support/resistance levels, trend direction, volume analysis. Reference specific price levels.

## KEY FINANCIALS
Revenue, earnings, margins, cash position. Use the most recent quarterly data you can find.

## CATALYST TIMELINE
Upcoming events: earnings date, FDA dates, product launches, conferences, lockup expirations. Include specific dates.

## RISK RATING
Rate the risk 1-5 (1 = low risk blue chip, 5 = extremely speculative). Explain why.

## VERDICT
One clear word: BULLISH, BEARISH, or NEUTRAL. Then 2-3 sentences explaining your reasoning.

CRITICAL: Be honest and balanced. If this is a speculative stock, say so. This is NOT financial advice — it's research and analysis.`;

      const response = await aiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }]
      });
      const text = await response.response.text();
      
      // Parse sections
      const sections = [];
      const expectedTitles = ['EXECUTIVE SUMMARY', 'WHY IT', 'BULL CASE', 'BEAR CASE', 'TECHNICAL', 'KEY FINANCIALS', 'CATALYST TIMELINE', 'RISK RATING', 'VERDICT'];
      const parts = text.split(/^##\s+/m).filter(Boolean);
      parts.forEach(part => {
        const newlineIdx = part.indexOf('\n');
        if (newlineIdx > -1) {
          const title = part.slice(0, newlineIdx).trim();
          const content = part.slice(newlineIdx + 1).trim();
          // Only include recognized section headings
          if (expectedTitles.some(t => title.toUpperCase().startsWith(t))) {
            sections.push({ title, content });
          }
        }
      });

      setReportData({
        sections,
        generatedAt: new Date(),
        rawText: text
      });
    } catch (err) {
      console.error('Research report error:', err);
      setReportData({
        sections: [{ title: 'ERROR', content: 'Unable to generate report. Please try again.' }],
        generatedAt: new Date(),
        error: true
      });
    } finally {
      setReportLoading(false);
    }
  };

useEffect(() => {
    const handleScroll = () => onCloseMenu();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showAddToListMenu, onCloseMenu]);

  // Auto-collapse everything when card scrolls out of view
  useEffect(() => {
    if (!showChart && !showNews && !chatOpen) return;
    
    const handleScroll = () => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // If less than 20% of the card is visible, collapse everything
      if (rect.bottom < windowHeight * 0.1 || rect.top > windowHeight * 0.9) {
        setShowChart(false);
        setShowNews(false);
        setChatOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showChart, showNews, chatOpen]);

// Auto-scroll chat container only (not the page)
useEffect(() => {
    if (chatOpen && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
}, [chatMessages, chatOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen && chatInputRef.current) {
      setTimeout(() => chatInputRef.current?.focus(), 300);
    }
  }, [chatOpen]);

  // Catalyst type badge styling
  const getCatalystStyle = (type) => {
    switch (type) {
      case 'early_signal':
        return { icon: Search, color: '#f97316', label: 'EARLY SIGNAL' };
      case 'options_first':
        return { icon: Target, color: '#ec4899', label: 'PRE-MOVE OPTIONS' };
      case 'news':
        return { icon: Newspaper, color: '#00ff4e', label: 'NEWS CATALYST' };
      case 'volume':
        return { icon: BarChart3, color: '#f59e0b', label: 'VOLUME SPIKE' };
      case 'breakout':
        return { icon: TrendingUp, color: '#3b82f6', label: 'BREAKOUT' };
      case 'momentum':
        return { icon: Zap, color: '#8b5cf6', label: 'MOMENTUM' };
      case 'gainer':
        return { icon: TrendingUp, color: '#10b981', label: 'TOP GAINER' };
      default:
        return { icon: Target, color: '#71717a', label: 'SIGNAL' };
    }
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
  if (diffDays <= 30) return new Date(earnings.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return null; // Don't show if more than 30 days out
};

  const catalystStyle = getCatalystStyle(stock.catalystType);
  const CatalystIcon = catalystStyle.icon;

  const formatVolume = (vol) => {
    if (!vol) return null;
    if (vol >= 1000000000) return (vol / 1000000000).toFixed(1) + 'B';
    if (vol >= 1000000) return (vol / 1000000).toFixed(1) + 'M';
    if (vol >= 1000) return (vol / 1000).toFixed(0) + 'K';
    return vol.toString();
  };

  // --- AI CHAT LOGIC (inline) ---
  const buildContext = (userQuestion) => {
    const dataPoints = [];
    dataPoints.push(`Price: $${livePrice.toFixed(2)}`);
    dataPoints.push(`Change: ${liveChange >= 0 ? '+' : ''}${liveChange.toFixed(2)}%`);
    if (stock.catalyst) dataPoints.push(`Catalyst: ${stock.catalyst}`);
    if (stock.catalystType) dataPoints.push(`Trigger Type: ${stock.catalystType}`);
    if (stock.volume) dataPoints.push(`Volume: ${stock.volume.toLocaleString()}`);
    if (stock.volumeRatio) dataPoints.push(`Volume vs Average: ${stock.volumeRatio}x`);
    if (stock.industry) dataPoints.push(`Industry: ${stock.industry}`);
    if (stock.newsCount) dataPoints.push(`Recent articles: ${stock.newsCount}`);
    if (stock.headline) dataPoints.push(`Latest headline: "${stock.headline}"`);
    if (stock.newsSource) dataPoints.push(`Source: ${stock.newsSource}`);
    
    let newsContext = '';
    if (stock.news && stock.news.length > 0) {
      newsContext = '\n\nRECENT NEWS ARTICLES:\n' + stock.news.map((n, i) => 
        `${i + 1}. "${n.title}" (${n.publisher?.name || 'Unknown'}, ${n.published_utc ? new Date(n.published_utc).toLocaleDateString() : 'Recent'})`
      ).join('\n');
    }

    return `You are an expert stock analyst helping a trader research ${stock.symbol} (${stock.name}). You have access to web search to find any information not provided below.

CURRENT DATA:
${dataPoints.join('\n')}
${newsContext}

User question: ${userQuestion}

INSTRUCTIONS:
- Be direct and actionable (2-5 sentences unless the question warrants more detail)
- If the question requires information NOT in the data above (earnings dates, financials, analyst ratings, company background, etc.), use web search
- When using web search, search for "${stock.symbol} [relevant query]"
- Always cite sources when using search results
- Frame insights in terms of actionable trading decisions
- Be honest about uncertainty
- Never give direct buy/sell recommendations, but DO give the information needed to decide`;
  };

  

const sendChatMessage = async (messageText) => {
    const text = messageText || chatInput;
    console.log('sendChat:', { text, chatLoading, aiModel: !!aiModel, user: !!user, db: !!db });
    if (!text.trim() || chatLoading || !aiModel) return;
    
    const userMessage = { role: 'user', text: text.trim() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    // Open chat if not already open
    if (!chatOpen) setChatOpen(true);

    try {
      const context = buildContext(text.trim());
      const response = await aiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: context }] }],
        tools: [{ googleSearch: {} }]
      });
      const aiText = await response.response.text();
      setChatMessages(prev => {
        const updated = [...prev, { role: 'assistant', text: aiText }];
        saveChat(updated);
        return updated;
      });
    } catch (error) {
      console.error('AI chat error:', error);
      setChatMessages(prev => {
        const updated = [...prev, { 
          role: 'assistant', 
          text: 'Sorry, I encountered an error. Please try again.' 
        }];
        saveChat(updated);
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  };

  const quickPrompts = [
    "Why is this moving?",
    "Bull case?",
    "Key risks?",
    "Good entry?",
    "Analyst targets?",
    "Upcoming catalysts?"
  ];

return (
    <>
    <div 
ref={cardRef}
      className="rounded-xl p-4 md:p-8 relative transition-all duration-300 overflow-hidden group"
     style={{background: 'linear-gradient(135deg, rgba(50,50,50,0.95) 0%, rgba(25,25,25,0.98) 50%), radial-gradient(ellipse at 10% 0%, rgba(255,255,255,0.06) 0%, transparent 50%)', boxShadow: '0 4px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0,255,78,0.03), inset 0 1px 0 rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderTop: '1px solid rgba(0,255,78,0.2)'}}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 30px rgba(0,0,0,0.5), 0 0 30px rgba(0,255,78,0.08), inset 0 1px 0 rgba(255,255,255,0.09)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.15)'; e.currentTarget.style.borderTop = '1px solid rgba(0,255,78,0.3)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0,255,78,0.03), inset 0 1px 0 rgba(255,255,255,0.07)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.borderTop = '1px solid rgba(0,255,78,0.2)'; }}
    >

      {/* ACTION BUTTONS - Top Right */}
      <div className="absolute top-3 right-3 md:top-4 md:right-8 z-10 flex gap-2">
        {/* Add/Remove Button */}
        {actionType === "REMOVE" ? (
          <button 
            onMouseEnter={() => setIsHoveringButton(true)}
            onMouseLeave={() => setIsHoveringButton(false)}
            onClick={(e) => {
              e.stopPropagation();
              removeFromWatchlist(stock.symbol);
            }}
            className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 rounded-lg border transition-all active:scale-95 border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20"
          >
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] leading-none hidden sm:inline">Remove</span>
            <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
          </button>
        ) : (
          <>
            <button 
              data-add-button="true"
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  alert('Please sign in to add stocks to lists');
                  return;
                }
                if (isAlreadyAdded) {
                  const listWithStock = watchlists.find(list => 
                    list.stocks.some(s => s.symbol === stock.symbol)
                  );
                  if (listWithStock) {
                    removeFromWatchlist(listWithStock.id, stock.symbol);
                  }
                } else {
                  onAction(stock);
                }
              }}
              className={`flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 rounded-lg border transition-all active:scale-95 ${
                isAlreadyAdded 
                  ? "border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                  : "border-zinc-800 bg-black text-zinc-500 hover:text-[#00ff4e] hover:border-[#00ff4e]/50"
              }`}
            >
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] leading-none hidden sm:inline">
                {isAlreadyAdded ? "Remove" : "Add"}
              </span>
              {isAlreadyAdded ? (
                <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
              ) : (
                <Plus size={12} className="md:w-3.5 md:h-3.5" />
              )}
            </button>

            {/* Add to List Dropdown */}
            {showAddToListMenu?.symbol === stock.symbol && (() => {
              const buttonElement = cardRef.current?.querySelector('button[data-add-button="true"]');
              const rect = buttonElement?.getBoundingClientRect();
              
              return ReactDOM.createPortal(
                <>
                  <div className="fixed inset-0 bg-transparent z-[99998]" onClick={() => onCloseMenu()} />
                  <div 
                    className="fixed bg-black border-2 border-zinc-800 rounded-lg shadow-2xl max-h-60 overflow-y-auto z-[99999]"
                    style={{
                      top: rect ? `${rect.bottom + 8}px` : '100px',
                      right: rect ? `${window.innerWidth - rect.right}px` : '20px',
                      width: '280px'
                    }}
                  >
                    <div className="p-3 border-b border-zinc-800">
                      <p className="text-xs font-black text-white uppercase">Add to List</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseMenu();
                        window.dispatchEvent(new CustomEvent('openWatchlistModal'));
                      }}
                      className="w-full text-left px-4 py-3 text-xs font-bold transition-all border-b border-zinc-900 text-[#00ff4e] hover:bg-zinc-900"
                    >
                      <div className="flex items-center gap-2">
                        <Plus size={14} />
                        <span className="uppercase tracking-wider">Create New List</span>
                      </div>
                    </button>
                    {watchlists.length === 0 ? (
                      <div className="p-4 text-center">
                        <p className="text-xs text-zinc-500">No lists yet. Create one above!</p>
                      </div>
                    ) : (
                      watchlists.map((list) => {
                        const isInList = list.stocks.some(s => s.symbol === stock.symbol);
                        return (
                          <button
                            key={list.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isInList) onAddToList(stock, list.id);
                            }}
                            disabled={isInList}
                            className={`w-full text-left px-4 py-3 text-xs font-bold transition-all border-b border-zinc-900 last:border-0 ${
                              isInList
                                ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                                : 'text-white hover:bg-zinc-900 hover:text-[#00ff4e]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="uppercase tracking-wider">{list.name}</span>
                              {isInList && (
                                <svg className="w-4 h-4 text-[#00ff4e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-[9px] text-zinc-600">{list.stocks.length} stocks</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>,
                document.body
              );
            })()}
          </>
        )}
      </div>

      {/* HEADER: Name + Symbol + Price */}
      <div className="mb-6 md:mb-8">
        <p className="text-[8px] md:text-[10px] text-[#ffffff] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] mb-2 flex items-start gap-2 pr-24 md:pr-0">
          <span 
            className={`h-1.5 w-1.5 md:h-2 md:w-2 rounded-full flex-shrink-0 mt-1 ${isMarketOpen ? 'animate-pulse' : ''}`} 
            style={{ backgroundColor: accent, boxShadow: isMarketOpen ? `0 0 15px ${accent}` : 'none' }} 
          />
          <span className="break-words leading-relaxed">{stock.name}</span>
        </p>
        
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 md:gap-8">
          <div className="flex items-baseline gap-3">
            <h2 className="text-4xl md:text-7xl font-black tracking-tighter text-white uppercase leading-none">{stock.symbol}</h2>
            {stock.sentiment && stock.sentiment !== 'NEUTRAL' && (
              <span 
                className="text-[10px] md:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded self-center"
                style={{ 
                  color: stock.sentiment === 'BULLISH' ? '#00ff4e' : '#FF4B2B',
                  backgroundColor: stock.sentiment === 'BULLISH' ? '#00ff4e12' : '#FF4B2B12',
                }}
              >
                {stock.sentiment === 'BULLISH' ? '▲ BULL' : '▼ BEAR'}
              </span>
            )}
          </div>
          
          <div className="flex items-baseline gap-2 md:gap-3">
            <span className="text-3xl md:text-5xl font-black text-white tabular-nums leading-none">
              ${shouldAnimate ? (
                <CountUp end={livePrice} decimals={2} duration={1200} />
              ) : (
                livePrice.toFixed(2)
              )}
            </span>
            <span className="text-xl md:text-3xl font-black tabular-nums leading-none" style={{ color: trendColor }}>
              {prefix}{shouldAnimate ? (
                <CountUp end={Math.abs(liveChange)} decimals={2} duration={1200} />
              ) : (
                Math.abs(liveChange).toFixed(2)
              )}% <span className="text-lg md:text-2xl ml-1 md:ml-2 align-middle">{Triangle}</span>
            </span>
            
          </div>
                  {/* Trade Button */}
        <TradeButton symbol={stock.symbol} connectedBrokerages={connectedBrokerages} />
        </div>
      </div>

      

      {/* QUICK STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-6 md:mb-8 border-t border-zinc-700/50 pt-4 md:pt-6">
        {stock.volume && (
          <div>
            <p className="text-[8px] md:text-[10px] text-zinc-500 font-black uppercase tracking-tighter mb-1 md:mb-2">Volume</p>
            <p className="text-base md:text-xl font-black text-white">{formatVolume(stock.volume)}</p>
          </div>
        )}
        {stock.volumeRatio && parseFloat(stock.volumeRatio) > 1 && (
          <div>
            <p className="text-[8px] md:text-[10px] text-zinc-500 font-black uppercase tracking-tighter mb-1 md:mb-2">vs Avg Volume</p>
            <p className="text-base md:text-xl font-black text-amber-400">{stock.volumeRatio}x</p>
          </div>
        )}
        {stock.industry && (
          <div>
            <p className="text-[8px] md:text-[10px] text-zinc-500 font-black uppercase tracking-tighter mb-1 md:mb-2">Sector</p>
            <p className="text-xs md:text-sm font-black text-white uppercase leading-tight">{stock.industry}</p>
          </div>
        )}
      </div>

      {/* TRIGGER TAGS */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-wrap gap-2">
          <div 
            className="inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-md font-black text-xs md:text-sm uppercase tracking-tight border"
            style={{ 
              color: catalystStyle.color, 
              backgroundColor: `${catalystStyle.color}15`,
              borderColor: `${catalystStyle.color}40`
            }}
          >
            <CatalystIcon size={14} className="md:w-4 md:h-4" />
            <span>{catalystStyle.label}</span>
          </div>
          {/* Sentiment Badge */}
          {stock.sentiment && stock.sentiment !== 'NEUTRAL' && (
            <div 
              className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 rounded-md font-black text-xs md:text-sm uppercase tracking-tight border"
              style={{ 
                color: stock.sentiment === 'BULLISH' ? '#00ff4e' : '#FF4B2B',
                backgroundColor: stock.sentiment === 'BULLISH' ? '#00ff4e15' : '#FF4B2B15',
                borderColor: stock.sentiment === 'BULLISH' ? '#00ff4e40' : '#FF4B2B40'
              }}
            >
              <span>{stock.sentiment === 'BULLISH' ? '▲' : '▼'}</span>
              <span>{stock.sentiment}</span>
            </div>
          )}
          {/* Earnings Badge */}
          {getEarningsLabel(stock.earnings) && (
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-md font-black text-xs md:text-sm uppercase tracking-tight border"
              style={{ 
                color: '#f59e0b', 
                backgroundColor: 'rgba(245,158,11,0.08)',
                borderColor: 'rgba(245,158,11,0.25)'
              }}
            >
              <BarChart3 size={14} className="md:w-4 md:h-4" style={{ color: '#f59e0b' }} />
              <span>EARNINGS {getEarningsLabel(stock.earnings)}</span>
            </div>
          )}
        </div>
      </div>

      {/* WHY IT'S MOVING + SOURCE LINK */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-start gap-3 md:gap-4">
          <div 
            className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center mt-0.5"
            style={{ backgroundColor: `${catalystStyle.color}15`, border: `1px solid ${catalystStyle.color}40` }}
          >
            <CatalystIcon size={18} className="md:w-5 md:h-5" style={{ color: catalystStyle.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[8px] md:text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">
              {stock.catalystType === 'early_signal' ? 'Unusual Activity Detected' : stock.catalystType === 'options_first' ? 'Smart Money Positioning' : 'Why It\'s Moving'}
            </p>
            {(() => {
              const c = stock.catalyst || '';
              const isUseless = c.toLowerCase().includes('no clear') || 
                                c.toLowerCase().includes('not identified') || 
                                c.toLowerCase().includes('provided summaries') ||
                                c.toLowerCase().includes('no catalyst');
              const text = (c && !isUseless) ? c : (stock.headline?.slice(0, 120) || stock.trigger || 'Unusual activity detected');
              
              // Split on " — " to separate hook from detail
              const dashIdx = text.indexOf(' — ');
              if (dashIdx > 15 && dashIdx < text.length - 4) {
                const hook = text.slice(0, dashIdx);
                const detail = text.slice(dashIdx + 3);
                return (
                  <>
                    <p className="text-base md:text-xl font-black text-white leading-tight mb-1.5">
                      {hook}
                    </p>
                    <p className="text-sm md:text-base text-zinc-400 leading-relaxed font-medium">
                      {detail}
                    </p>
                  </>
                );
              }
              return (
                <p className="text-base md:text-xl font-black text-white leading-tight">
                  {text}
                </p>
              );
            })()}
          </div>
        </div>

        {/* Source Attribution Link */}
        {stock.newsSource && (
          <a 
            href={stock.news?.[0]?.article_url || stock.news?.[0]?.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 mt-4 px-4 py-3 bg-black/70 rounded-lg border border-[#00ff4e]/60 hover:border-[#00ff4e] hover:bg-[#00ff4e]/5 transition-all cursor-pointer group/headline"
          >
            <Newspaper size={14} className="text-[#00ff4e] group-hover/headline:text-[#00ff4e] flex-shrink-0 transition-colors" />
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm text-zinc-300 group-hover/headline:text-white truncate transition-colors">{stock.headline}</p>
              <p className="text-[10px] text-zinc-600">
                {stock.newsSource}{stock.newsDate ? ` · ${stock.newsDate}` : ''}
              </p>
            </div>
            <span className="text-zinc-700 group-hover/headline:text-[#00ff4e] transition-colors flex-shrink-0 hidden md:block">→</span>
          </a>
        )}
      </div>

            {/* ASK AI HEADER */}
      <div className="border-t border-zinc-700/50 pt-4 md:pt-6 mb-3">
        <div className="flex items-center gap-2 md:gap-3">
          <Lightbulb size={14} className="md:w-4 md:h-4 text-[#00ff4e]" />
          <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-white">
            Ask AI
          </span>
        </div>
      </div>

      {/* CHAT SECTION */}
      {chatMessages.length > 0 && (
        <div className="mb-0">
          <AnimatePresence>
            {chatOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1, transition: { duration: 0.4 } }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-black/70 border border-zinc-700 rounded-xl p-3 md:p-4 mb-4">
                  {/* Chat Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle size={12} className="text-[#00ff4e]" />
                      <span className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        AI Research · {stock.symbol}
                      </span>
                      {hasSavedChat && (
                        <span className="text-[8px] font-bold text-[#00ff4e]/50 uppercase">· Saved</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          setChatMessages([]);
                          setHasSavedChat(false);
                          if (user?.uid && db) {
                            try {
                              const { doc, deleteDoc } = await import('firebase/firestore');
                              await deleteDoc(doc(db, 'users', user.uid, 'stockChats', stock.symbol));
                            } catch (e) {}
                          }
                          setChatOpen(false);
                        }}
                        className="text-zinc-700 hover:text-red-500 transition-colors text-[10px] font-bold uppercase"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setChatOpen(false)}
                        className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs font-bold uppercase"
                      >
                        Collapse ▲
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div ref={chatContainerRef} className="space-y-3 max-h-[400px] overflow-y-auto">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] px-3 md:px-4 py-2.5 rounded-lg ${
                          msg.role === 'user' 
                            ? 'bg-[#00ff4e]/10 text-white border border-[#00ff4e]/20' 
                            : 'bg-black/70 text-zinc-300 border border-zinc-700'
                        }`}>
                          <p className="text-xs md:text-sm whitespace-pre-wrap leading-relaxed">
                            {msg.text.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={j} className="text-white font-black">{part.slice(2, -2)}</strong>;
                              }
                              return part;
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-black/70 border border-zinc-700 px-4 py-2.5 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <span className="w-1.5 h-1.5 bg-[#00ff4e] rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
                              <span className="w-1.5 h-1.5 bg-[#00ff4e] rounded-full animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
                              <span className="w-1.5 h-1.5 bg-[#00ff4e] rounded-full animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
                            </div>
                            <span className="text-xs text-zinc-500">Researching...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Disclaimer */}
                  <p className="text-[9px] text-zinc-700 mt-3 text-center">
                    AI-powered research · Not financial advice
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsed chat indicator */}
          {!chatOpen && (
            <button 
              onClick={() => setChatOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider hover:text-[#00ff4e] transition-colors"
            >
              <MessageCircle size={12} />
              <span>{chatMessages.length} messages · Click to expand</span>
              <span>▼</span>
            </button>
          )}
        </div>
      )}

      {/* PROMPTS + INPUT */}
      <div className="pt-0 md:pt-0 mb-2 md:mb-3">
        {/* Full Research Report Button */}
        <button
          onClick={(e) => { e.stopPropagation(); generateResearchReport(); }}
          disabled={reportLoading || !aiModel}
          className="w-full mb-3 py-3 px-4 rounded-lg font-black text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(88,28,235,0.15) 100%)',
            border: '1px solid rgba(139,92,246,0.3)',
            color: '#a78bfa',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(88,28,235,0.25) 100%)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(88,28,235,0.15) 100%)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; }}
        >
          {reportLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              <span>Generating Report...</span>
            </>
          ) : (
            <>
              <FileText size={14} />
              <span>✦ Full Research Report</span>
            </>
          )}
        </button>

        {/* Quick Prompt Pills */}
        <div className="flex flex-wrap gap-1.5 md:gap-2 mb-3">
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                sendChatMessage(prompt);
              }}
              disabled={chatLoading}
className="text-[10px] md:text-xs font-bold px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg bg-black/70 border border-zinc-700 text-zinc-400 hover:text-[#00ff4e] hover:border-[#00ff4e]/30 hover:bg-[#00ff4e]/5 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={chatInputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              onFocus={() => { if (!chatOpen && chatMessages.length > 0) setChatOpen(true); }}
              placeholder={`Ask anything about ${stock.symbol}...`}
              disabled={chatLoading}
              className="w-full bg-black/70 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff4e]/50 transition-colors disabled:opacity-50 font-mono placeholder:text-zinc-400"
              style={{ caretColor: '#00ff4e' }}
            />
            {!chatInput && chatMessages.length === 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                <MessageCircle size={14} className="text-zinc-600" />
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-wider hidden sm:inline">Ask AI</span>
              </div>
            )}
          </div>
          <button
            onClick={() => sendChatMessage()}
            disabled={!chatInput.trim() || chatLoading}
            className="px-4 py-3 bg-[#00ff4e] hover:opacity-90 disabled:opacity-20 text-black rounded-lg font-black text-sm transition-all active:scale-95 flex items-center gap-2 flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* CHART TOGGLE */}
      <div className="border-t border-zinc-700/50 pt-4 md:pt-6 pb-4 md:pb-6">
        <button onClick={() => setShowChart(!showChart)} className="flex items-center gap-2 md:gap-3 transition-all">
          <TrendingUp size={14} className={`md:w-4 md:h-4 ${showChart ? 'text-[#00ff4e]' : 'text-white'} transition-colors`} />
          <span className={`text-[10px] md:text-xs font-black uppercase tracking-[0.2em] ${showChart ? 'text-[#00ff4e]' : 'text-white'} transition-colors`}>
            {showChart ? "Hide Chart" : "View Chart"}
          </span>
          <motion.span animate={{ rotate: showChart ? 180 : 0 }} className={`text-[10px] ${showChart ? 'text-[#00ff4e]' : 'text-zinc-500'}`}>▼</motion.span>
        </button>

        <AnimatePresence>
          {showChart && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1, transition: { duration: 0.4 } }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 md:mt-6 overflow-hidden"
            >
              <StockChart symbol={stock.symbol} polygonKey={process.env.REACT_APP_POLYGON_KEY} isMarketOpen={isMarketOpen} livePrice={livePrices?.[stock.symbol]?.price} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* COMPANY BIO TOGGLE */}
      <div className="border-t border-zinc-700/50 pt-4 md:pt-6 pb-4 md:pb-6">
        <button onClick={fetchBio} className="flex items-center gap-2 md:gap-3 transition-all">
          <Building2 size={14} className={`md:w-4 md:h-4 ${showBio ? 'text-[#00ff4e]' : 'text-white'} transition-colors`} />
          <span className={`text-[10px] md:text-xs font-black uppercase tracking-[0.2em] ${showBio ? 'text-[#00ff4e]' : 'text-white'} transition-colors`}>
            {showBio ? "Hide Bio" : "Company Bio"}
          </span>
          <motion.span animate={{ rotate: showBio ? 180 : 0 }} className={`text-[10px] ${showBio ? 'text-[#00ff4e]' : 'text-zinc-500'}`}>▼</motion.span>
        </button>

        <AnimatePresence>
          {showBio && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1, transition: { duration: 0.4 } }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="bg-black/70 border border-zinc-700 rounded-xl p-4">
                {bioLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#00ff4e]/30 border-t-[#00ff4e] rounded-full animate-spin" />
                    <span className="text-xs text-zinc-500 font-bold">Loading company info...</span>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-300 leading-relaxed">{bioText}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ANALYST RATINGS TOGGLE */}
<div className="border-t border-zinc-700/50 pt-4 md:pt-6">
          <button onClick={fetchRatings} className="flex items-center gap-2 md:gap-3 transition-all">
          <Target size={14} className={`md:w-4 md:h-4 ${showRatings ? 'text-[#00ff4e]' : 'text-white'} transition-colors`} />
          <span className={`text-[10px] md:text-xs font-black uppercase tracking-[0.2em] ${showRatings ? 'text-[#00ff4e]' : 'text-white'} transition-colors`}>
            {showRatings ? "Hide Ratings" : "Analyst Ratings"}
          </span>
          <motion.span animate={{ rotate: showRatings ? 180 : 0 }} className={`text-[10px] ${showRatings ? 'text-[#00ff4e]' : 'text-zinc-500'}`}>▼</motion.span>
        </button>

        <AnimatePresence>
          {showRatings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1, transition: { duration: 0.4 } }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="bg-black/70 border border-zinc-700 rounded-xl p-4">
                {ratingsLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-[#00ff4e]/30 border-t-[#00ff4e] rounded-full animate-spin" />
                    <span className="text-xs text-zinc-500 font-bold">Loading analyst data...</span>
                  </div>
                ) : ratingsData?.error ? (
                  <p className="text-xs text-zinc-500">Unable to load analyst data.</p>
                ) : (
                  <div className="space-y-4">
                    {/* Price Target */}
                    {ratingsData?.priceTarget?.targetMean && (
                      <div>
<p className="text-[8px] md:text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">12-Month Price Target</p>                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[9px] text-zinc-600 uppercase font-bold">Low</p>
                            <p className="text-sm font-black text-red-400">${ratingsData.priceTarget.targetLow?.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-zinc-600 uppercase font-bold">Average</p>
                            <p className="text-sm font-black text-white">${ratingsData.priceTarget.targetMean?.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-zinc-600 uppercase font-bold">High</p>
                            <p className="text-sm font-black text-[#00ff4e]">${ratingsData.priceTarget.targetHigh?.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {ratingsData?.recommendations?.length > 0 && (
                      <div>
                        <p className="text-[8px] md:text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Recent Consensus</p>
                        <div className="space-y-2">
                          {ratingsData.recommendations.map((rec, i) => {
                            const total = (rec.buy || 0) + (rec.hold || 0) + (rec.sell || 0) + (rec.strongBuy || 0) + (rec.strongSell || 0);
                            const bullish = ((rec.buy || 0) + (rec.strongBuy || 0)) / (total || 1) * 100;
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <span className="text-[10px] text-zinc-600 font-mono w-20 flex-shrink-0">
                                  {new Date(rec.period).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                                </span>
                                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all"
                                    style={{ 
                                      width: `${bullish}%`,
                                      backgroundColor: bullish > 60 ? '#00ff4e' : bullish > 40 ? '#f59e0b' : '#ef4444'
                                    }} 
                                  />
                                </div>
                                <span className="text-[10px] font-black w-12 text-right" style={{ 
                                  color: bullish > 60 ? '#00ff4e' : bullish > 40 ? '#f59e0b' : '#ef4444'
                                }}>
                                  {bullish.toFixed(0)}% Buy
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Market Cap */}
                    {ratingsData?.marketCap && (
                      <div>
                        <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">Market Cap</p>
                        <p className="text-sm font-black text-white">
                          ${ratingsData.marketCap >= 1e12 ? (ratingsData.marketCap / 1e12).toFixed(2) + 'T' :
                            ratingsData.marketCap >= 1e9 ? (ratingsData.marketCap / 1e9).toFixed(2) + 'B' :
                            ratingsData.marketCap >= 1e6 ? (ratingsData.marketCap / 1e6).toFixed(2) + 'M' :
                            ratingsData.marketCap.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      {/* NEWS ARTICLES TOGGLE */}
      {stock.news && stock.news.length > 0 && (
        <div className="border-t border-zinc-700/50 mt-4 md:mt-6 pt-4 md:pt-6">
          <button onClick={() => setShowNews(!showNews)} className="flex items-center gap-2 md:gap-3 transition-all">
            <Newspaper size={14} className={`md:w-4 md:h-4 ${showNews ? 'text-[#00ff4e]' : 'text-white'} transition-colors`} />
            <span className={`text-[10px] md:text-xs font-black uppercase tracking-[0.2em] ${showNews ? 'text-[#00ff4e]' : 'text-white'} transition-colors`}>
              {showNews ? "Hide News" : `View ${stock.news.length} Related ${stock.news.length === 1 ? 'Article' : 'Articles'}`}
            </span>
            <motion.span animate={{ rotate: showNews ? 180 : 0 }} className={`text-[10px] ${showNews ? 'text-[#00ff4e]' : 'text-zinc-500'}`}>▼</motion.span>
          </button>

          <AnimatePresence>
            {showNews && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1, transition: { duration: 0.4 } }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 md:mt-6 space-y-3 overflow-hidden"
              >
                {stock.news.map((article, i) => (
                  <a 
                    key={i}
                    href={article.article_url || article.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 md:p-4 bg-black/70 border border-zinc-700 rounded-lg hover:border-[#00ff4e]/30 hover:bg-zinc-900 transition-all group/article"
                  >
                    <div className="flex items-start gap-3">
                      {article.image_url && (
                        <img 
                          src={article.image_url} 
                          alt="" 
                          className="w-16 h-16 md:w-20 md:h-20 rounded-lg object-cover flex-shrink-0"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-base font-black text-white leading-tight mb-1 group-hover/article:text-[#00ff4e] transition-colors">
                          {article.title}
                        </p>
                        {article.description && (
                          <p className="text-xs text-zinc-500 line-clamp-2 mb-1">{article.description}</p>
                        )}
                        <p className="text-[10px] text-zinc-600">
                          {article.publisher?.name || article.source || 'Unknown source'}
                          {article.published_utc ? ` · ${new Date(article.published_utc).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      <span className="text-zinc-700 group-hover/article:text-[#00ff4e] transition-colors flex-shrink-0 hidden md:block">→</span>
                    </div>
                  </a>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <div className="pb-2 md:pb-4" />
    </div>

    {/* FULL RESEARCH REPORT MODAL */}
    <AnimatePresence>
    {showReport && (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[9999] flex items-stretch md:items-start md:justify-center" 
        onClick={() => setShowReport(false)}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />
        <motion.div 
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-2xl mx-auto h-full md:h-auto md:my-8 md:max-h-[90vh] overflow-y-auto md:rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(30,30,30,0.98) 0%, rgba(10,10,10,0.99) 100%)',
            border: '1px solid rgba(139,92,246,0.2)',
            boxShadow: '0 0 60px rgba(139,92,246,0.1), 0 0 120px rgba(0,0,0,0.5)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="sticky top-0 z-10 px-5 md:px-8 pt-5 md:pt-6 pb-4 border-b border-zinc-800/50" style={{ background: 'linear-gradient(135deg, rgba(30,30,30,0.98) 0%, rgba(10,10,10,0.99) 100%)' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={16} className="text-purple-400" />
                  <span className="text-[9px] font-black text-purple-400 uppercase tracking-[0.3em]">AI Research Report</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white leading-none">{stock.symbol}</h2>
                <p className="text-xs text-zinc-500 mt-1">{stock.name}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-lg font-black text-white tabular-nums">${livePrice.toFixed(2)}</span>
                  <span className="text-sm font-black tabular-nums" style={{ color: liveChange >= 0 ? '#00ff4e' : '#FF4B2B' }}>
                    {liveChange >= 0 ? '+' : ''}{liveChange.toFixed(2)}%
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowReport(false)}
                className="text-zinc-500 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="px-5 md:px-8 py-5 md:py-6">
            {reportLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-8 h-8 border-3 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" style={{ borderWidth: '3px' }} />
                <div className="text-center">
                  <p className="text-sm font-black text-white mb-1">Generating Research Report</p>
                  <p className="text-xs text-zinc-500">Analyzing {stock.symbol} with AI + web search...</p>
                </div>
              </div>
            ) : reportData?.sections ? (
              <div className="space-y-6">
                {reportData.sections.map((section, i) => {
                  const isVerdict = section.title.toUpperCase().includes('VERDICT');
                  const isRisk = section.title.toUpperCase().includes('RISK');
                  const isBull = section.title.toUpperCase().includes('BULL');
                  const isBear = section.title.toUpperCase().includes('BEAR');
                  
                  let accentColor = 'rgba(139,92,246,0.15)';
                  let borderColor = 'rgba(139,92,246,0.2)';
                  let iconColor = '#a78bfa';
                  
                  if (isBull) { accentColor = 'rgba(0,255,78,0.08)'; borderColor = 'rgba(0,255,78,0.2)'; iconColor = '#00ff4e'; }
                  if (isBear) { accentColor = 'rgba(255,75,43,0.08)'; borderColor = 'rgba(255,75,43,0.2)'; iconColor = '#FF4B2B'; }
                  if (isVerdict) { accentColor = 'rgba(245,158,11,0.08)'; borderColor = 'rgba(245,158,11,0.3)'; iconColor = '#f59e0b'; }
                  if (isRisk) { accentColor = 'rgba(239,68,68,0.08)'; borderColor = 'rgba(239,68,68,0.2)'; iconColor = '#ef4444'; }

                  return (
                    <div key={i} className="rounded-xl p-4" style={{ background: accentColor, border: `1px solid ${borderColor}` }}>
                      <h3 className="text-[9px] font-black uppercase tracking-[0.25em] mb-3" style={{ color: iconColor }}>
                        {section.title}
                      </h3>
                      <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {section.content.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j} className="text-white font-black">{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {/* Disclaimer */}
                <div className="pt-4 border-t border-zinc-800/50">
                  <p className="text-[9px] text-zinc-700 leading-relaxed">
                    This report was generated by AI and is for informational purposes only. It is not financial advice. 
                    Always do your own research before making investment decisions. Data may be delayed or inaccurate.
                  </p>
                  {reportData.generatedAt && (
                    <p className="text-[9px] text-zinc-700 mt-1">
                      Generated {reportData.generatedAt.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    )}
    </AnimatePresence>
    </>
  );
}, (prevProps, nextProps) => {
  const sym = nextProps.stock.symbol;
  return (
    prevProps.stock.symbol === nextProps.stock.symbol &&
    prevProps.stock.price === nextProps.stock.price &&
    prevProps.stock.change === nextProps.stock.change &&
    prevProps.isMarketOpen === nextProps.isMarketOpen &&
    prevProps.showAddToListMenu?.symbol === nextProps.showAddToListMenu?.symbol &&
    prevProps.watchlist.length === nextProps.watchlist.length &&
    prevProps.aiModel === nextProps.aiModel &&
    prevProps.db === nextProps.db &&
    prevProps.livePrices?.[sym]?.price === nextProps.livePrices?.[sym]?.price
  );
});

export default MetricCard;
