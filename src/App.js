import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Trash2, Plus, } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from 'react-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import AuthModal from './AuthModal';
import ProfileSettings from './ProfileSettings';
import Tooltip from './tooltip';

console.log('FINNHUB_KEY:', process.env.REACT_APP_FINNHUB_KEY);
console.log('GEN_AI_KEY:', process.env.REACT_APP_GEN_AI_KEY);

// --- CONFIGURATION ---
const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_KEY; 
const GEN_AI_KEY = process.env.REACT_APP_GEN_AI_KEY;
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


const REPUTABLE_SOURCES = [
 "Wall Street Journal", "Bloomberg", "Financial Times", "Reuters", "CNBC", 
  "Barron's", "MarketWatch", "Seeking Alpha", "The Economist", "Forbes",
  "Investor's Business Daily", "Yahoo Finance", "Benzinga", "Morningstar",
  "Zacks Investment Research", "The Motley Fool", "Barchart", "Investing.com",
  "Fortune", "Business Insider", "The Street", "CNN Business", "Fox Business",
  "Nikkei Asia", "TradingView", "FinViz", "Koyfin", "StockCharts", "TipRanks",
  "Investopedia", "Bankrate", "NerdWallet", "Kiplinger", "FRED (Federal Reserve)",
  "SEC EDGAR", "CoinDesk", "The Block", "Glassnode", "South China Morning Post",
  "LiveMint", "The Globe and Mail", "Australian Financial Review", "WhaleWisdom",
  "Dataroma", "OpenInsider", "ETF.com", "Project Syndicate", "ValueWalk",
  "Institutional Investor", "Morning Brew"
];

const sourceString = REPUTABLE_SOURCES.map(s => `site:${s}`).join(" OR ");



const TypewriterGreeting = () => {
  const [text, setText] = useState("");
  const [isDone, setIsDone] = useState(false);
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "GOOD MORNING";
    if (hour < 18) return "GOOD AFTERNOON";
    return "GOOD EVENING";
  };

  const fullText = getGreeting();

  useEffect(() => {
    let i = 0;
    setText(""); 
    const timer = setInterval(() => {
      setText(fullText.slice(0, i));
      i++;
      if (i > fullText.length) {
        clearInterval(timer);
        setIsDone(true);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [fullText]);

  return (
    <div className="mb-6 md:mb-8 font-black text-xl md:text-3xl tracking-[0.15em] md:tracking-[0.2em] flex items-baseline gap-1">
      <span className="text-white leading-none">{text}</span>
      <span 
        className={`inline-block w-4 md:w-5 h-[2px] md:h-[3px] bg-[#00ff4e] translate-y-[2px] ${isDone ? 'animate-[pulse_1s_infinite]' : ''}`} 
        style={{ boxShadow: '0 0 8px rgba(0,255,78,0.6)' }}
      />
    </div>
  );
};


const extract = (tag, text) => {
  const regex = new RegExp(`\\[${tag}\\]\\s*([\\s\\S]*?)\\s*\\[\\/${tag}\\]`, "i");
  const match = text.match(regex);
  return (match && match[1]) ? match[1].trim() : "";
};

const clean = (val) => {
  if (!val) return "";
  return val.replace(/["':`|]/g, "").trim(); // Removed \- to keep hyphens
};

const formatText = (text) => {
  if (!text) return text;
  
  // Fix common formatting issues
  let result = text;
  
  // Match: 52week, 52 week, 52weeks, 52 weeks (case insensitive)
  result = result.replace(/(\d+)\s*(week|weeks|wk|wks)/gi, '$1-week');
  result = result.replace(/(\d+)\s*(day|days)/gi, '$1-day');
  result = result.replace(/(\d+)\s*(month|months|mo|mos)/gi, '$1-month');
  result = result.replace(/(\d+)\s*(year|years|yr|yrs)/gi, '$1-year');
  result = result.replace(/\bPE\b/g, 'P/E');
  result = result.replace(/\bPS\b/g, 'P/S');
  result = result.replace(/alltime/gi, 'all-time');
  
  // Fix double hyphens if they occur
  result = result.replace(/(\d+)--/g, '$1-');
  
  return result;
};

// Calculate Historical Volatility (annualized)
const calculateHV = (closePrices) => {
  if (!closePrices || closePrices.length < 2) return 40; // fallback
  
  // Calculate daily returns
  const returns = [];
  for (let i = 1; i < closePrices.length; i++) {
    const dailyReturn = Math.log(closePrices[i] / closePrices[i - 1]);
    returns.push(dailyReturn);
  }
  
  // Calculate mean return
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  
  // Calculate variance
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  
  // Standard deviation
  const stdDev = Math.sqrt(variance);
  
  // Annualize (multiply by sqrt of trading days per year)
  const annualizedVolatility = stdDev * Math.sqrt(252) * 100;
  
  return Math.min(Math.max(annualizedVolatility, 5), 150); // Cap between 5-150%
};

// Calculate Signal Strength based on quantifiable factors
const calculateSignalStrength = (newsData, priceData, currentPrice, volatility, aiCatalystScore) => {
  let score = 0;
  
  // 1. NEWS RECENCY (30 points max)
  if (newsData && newsData.length > 0) {
    const mostRecentNews = newsData[0];
    const daysSinceNews = (Date.now() / 1000 - mostRecentNews.datetime) / (24 * 60 * 60);
    
    if (daysSinceNews <= 7) {
      score += 30; // Very recent
    } else if (daysSinceNews <= 14) {
      score += 20; // Recent
    } else if (daysSinceNews <= 30) {
      score += 10; // Somewhat recent
    }
  }
  
  // 2. NEWS VOLUME (20 points max)
  const newsCount = newsData?.length || 0;
  if (newsCount >= 10) {
    score += 20;
  } else if (newsCount >= 5) {
    score += 15;
  } else if (newsCount >= 3) {
    score += 10;
  } else if (newsCount >= 1) {
    score += 5;
  }
  
  // 3. PRICE MOMENTUM (25 points max)
  // Check 5-day price momentum
  if (priceData && priceData.length >= 5) {
    const fiveDaysAgo = priceData[priceData.length - 6];
    const priceChange = ((currentPrice - fiveDaysAgo) / fiveDaysAgo) * 100;
    
    const absMomentum = Math.abs(priceChange);
    if (absMomentum >= 10) {
      score += 25; // Strong momentum
    } else if (absMomentum >= 5) {
      score += 18; // Good momentum
    } else if (absMomentum >= 2) {
      score += 12; // Moderate momentum
    } else if (absMomentum >= 1) {
      score += 6; // Some momentum
    }
  }
  
  // 4. VOLATILITY FACTOR (15 points max)
  // Higher volatility = more conviction in directional move
  const vol = parseFloat(volatility);
  if (vol >= 60) {
    score += 15; // High volatility
  } else if (vol >= 40) {
    score += 12; // Moderate-high
  } else if (vol >= 25) {
    score += 8; // Moderate
  } else if (vol >= 15) {
    score += 5; // Low-moderate
  }
  
  // 5. AI CATALYST ASSESSMENT (10 points max)
  // Use the AI's confidence as a small factor
  score += Math.min(aiCatalystScore / 10, 10);
  
  // Ensure score is between 0-100
  return Math.min(Math.max(Math.round(score), 10), 95);
};



// --- TRADINGVIEW MINI CHART COMPONENT ---
const MiniChart = ({ symbol }) => {
  const cleanSymbol = symbol ? symbol.split(/[^a-zA-Z]/)[0].toUpperCase() : "";

  const settings = {
    "symbol": cleanSymbol,
    "width": "100%",
    "height": 220,
    "locale": "en",
    "dateRange": "1D",
    "colorTheme": "dark",
    "trendLineColor": "#00ff4e",
    "underLineColor": "rgba(0, 255, 78, 0.3)",
    "underLineBottomColor": "rgba(0, 0, 0, 0)",
    "isTransparent": true,
    "autosize": false
  };

  const encodedSettings = encodeURIComponent(JSON.stringify(settings));
  const chartUrl = `https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=en#${encodedSettings}`;

  return (
    <div style={{ height: '220px', width: '100%', overflow: 'hidden', background: '#000', borderRadius: '8px' }}>
      {cleanSymbol ? (
        <iframe
          key={cleanSymbol}
          title={`chart-${cleanSymbol}`}
          src={chartUrl}
          width="100%"
          height="220"
          style={{ border: 'none' }}
          allowtransparency="true" 
          scrolling="no"
        />
      ) : (
        <div className="flex items-center justify-center h-full text-zinc-800 text-[10px] uppercase font-black">
          Invalid Ticker
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [stocks, setStocks] = useState([]);
  const [newsArticles, setNewsArticles] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());  
  const [scanStatus, setScanStatus] = useState("SYSTEM READY");
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [activeTab, setActiveTab] = useState("DASHBOARD");
  const [sortBy, setSortBy] = useState("confidence");
  const [filterSignal, setFilterSignal] = useState("all");
  const [filterPriceRange, setFilterPriceRange] = useState("all");
  const [filterVolatility, setFilterVolatility] = useState("all");  
  const [scanPriceLimit, setScanPriceLimit] = useState(50);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [scanMarketCap, setScanMarketCap] = useState('all');
  const [scanSector, setScanSector] = useState('all');
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [watchlist, setWatchlist] = useState(() => {
  
  
  const saved = localStorage.getItem("JACKRABBIT_WATCHLIST");


  return saved ? JSON.parse(saved) : [];
});




const addToWatchlist = (stock) => {
  if (!watchlist.some(s => s.symbol === stock.symbol)) {
    setWatchlist(prev => [stock, ...prev]);
  }
};

const removeFromWatchlist = (symbol) => {
  setWatchlist(prev => prev.filter(s => s.symbol !== symbol));
};

const handleLogout = async () => {
  try {
    await signOut(auth);
    setWatchlist([]);
  } catch (error) {
    console.error("Logout error:", error);
  }
};

// --- FETCH NEWS FUNCTION ---
const fetchNews = useCallback(async () => {
  setLoadingNews(true);
  try {
    const newsUrl = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`;
    const response = await fetch(newsUrl);
    const data = await response.json();
    
    if (!data || data.length === 0) {
      setNewsArticles([]);
      setLoadingNews(false);
      return;
    }
    
    // Process articles with AI to categorize and extract tickers
    const processedArticles = await Promise.all(
      data.slice(0, 25).map(async (article) => {
        try {
          const aiPrompt = `
            Analyze this financial news headline and summary:
            HEADLINE: ${article.headline}
            SUMMARY: ${article.summary || "No summary available"}
            
            TASK:
            1. Categorize into ONE of: Markets, Stocks, Crypto, Tech, Economy, Policy, Earnings
            2. Extract any stock tickers mentioned (max 3, must be valid US tickers)
            
            FORMAT:
            [CATEGORY] CategoryName [/CATEGORY]
            [TICKERS] AAPL, MSFT [/TICKERS] (or "None" if no tickers)
          `;
          
          const aiResponse = await aiModel.generateContent(aiPrompt);
          const aiText = await aiResponse.response.text();
          
          const category = extract("CATEGORY", aiText) || "Markets";
          const tickersText = extract("TICKERS", aiText);
          const tickers = tickersText && tickersText !== "None" 
            ? tickersText.split(',').map(t => t.trim()).filter(t => t.length > 0).slice(0, 3)
            : [];
          
          return {
            id: article.id || article.datetime,
            headline: article.headline,
            summary: article.summary || "Click to read full article",
            source: article.source,
            url: article.url,
            image: article.image,
            datetime: article.datetime,
            category: category,
            tickers: tickers
          };
        } catch (e) {
          // If AI processing fails, return article with defaults
          return {
            id: article.id || article.datetime,
            headline: article.headline,
            summary: article.summary || "Click to read full article",
            source: article.source,
            url: article.url,
            image: article.image,
            datetime: article.datetime,
            category: "Markets",
            tickers: []
          };
        }
      })
    );
    
    setNewsArticles(processedArticles);
  } catch (error) {
    console.error("Error fetching news:", error);
    setNewsArticles([{
      id: 'error',
      headline: `Error loading news: ${error.message}`,
      summary: 'Please try refreshing',
      source: 'System',
      url: '#',
      image: null,
      datetime: Date.now() / 1000,
      category: 'Markets',
      tickers: []
    }]);
  } finally {
    setLoadingNews(false);
  }
}, []);


// --- DATA UTILITIES ---
const getScore = (extractedValue, fallback) => {
  if (!extractedValue) return fallback;
  const cleanValue = extractedValue.replace(/[^0-9.]/g, "");
  const score = parseFloat(cleanValue);
  return (isNaN(score) || score === 0) ? fallback : Math.min(Math.max(score, 5.00), 99.99);
};

  useEffect(() => {
  const timer = setInterval(() => setCurrentTime(new Date()), 1000);
  return () => clearInterval(timer);
}, []);

// --- AUTH STATE LISTENER ---
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);
    setAuthLoading(false);
    
    if (currentUser) {
      // Load user's watchlist and profile from Firestore
      const docRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWatchlist(data.watchlist || []);
        setUserProfile({
          username: data.username || null,
          profilePicUrl: data.profilePicUrl || null
        });
      } else {
        // No profile exists yet - set defaults
        setUserProfile({
          username: null,
          profilePicUrl: null
        });
      }
    } else {
      // Not logged in - load from localStorage
      const saved = localStorage.getItem("JACKRABBIT_WATCHLIST");
      setWatchlist(saved ? JSON.parse(saved) : []);
      setUserProfile(null);
    }
  });
  
  return () => unsubscribe();
}, []);

// Sync watchlist to Firestore (if logged in) or localStorage
useEffect(() => {
  if (user) {
    // Save to Firestore - get existing data first to preserve profile
    const saveWatchlist = async () => {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};
      
      await setDoc(docRef, {
        ...existingData,
        watchlist
      });
    };
    saveWatchlist();
  } else {
    // Save to localStorage
    localStorage.setItem("JACKRABBIT_WATCHLIST", JSON.stringify(watchlist));
  }
}, [watchlist, user]);

  // --- MARKET HOURS & CLOCK ---
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      // Basic NYSE Market Hours Check (EST)
      const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const hours = estTime.getHours();
      const mins = estTime.getMinutes();
      const day = estTime.getDay();
      const isOpen = day >= 1 && day <= 5 && (hours > 9 || (hours === 9 && mins >= 30)) && hours < 16;
      setIsMarketOpen(isOpen);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

// --- LOAD USER PROFILE ON PAGE LOAD ---
useEffect(() => {
  console.log('Profile load effect triggered:', { user: !!user, authLoading });
  
  if (!user || authLoading) return;
  
  const loadProfile = async () => {
    try {
      console.log('Loading profile for user:', user.uid);
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      console.log('Firestore doc exists:', docSnap.exists());
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Profile data from Firestore:', data);
        setUserProfile({
          username: data.username || null,
          profilePicUrl: data.profilePicUrl || null
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };
  
  loadProfile();
}, [user, authLoading]);

// --- FETCH NEWS ON TAB SWITCH & AUTO-REFRESH ---
useEffect(() => {
  if (activeTab === "NEWS" && newsArticles.length === 0) {
    fetchNews();
  }
}, [activeTab, fetchNews, newsArticles.length]);

useEffect(() => {
  if (activeTab === "NEWS") {
    const newsRefreshTimer = setInterval(() => {
      fetchNews();
    }, 300000); // Refresh every 5 minutes
    return () => clearInterval(newsRefreshTimer);
  }
}, [activeTab, fetchNews]);

  // --- LIVE PRICE UPDATES (Every 10 Seconds) ---
useEffect(() => {
  // Sync both lists
  if ((stocks.length === 0 && watchlist.length === 0) || !isMarketOpen) return;

  const liveTimer = setInterval(async () => {
    const updateList = async (list) => {
      return Promise.all(list.map(async (stock) => {
        try {
          const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${stock.symbol}&token=${FINNHUB_KEY}`);
          const data = await res.json();
          if (!data.c) return stock; 
          return {
            ...stock,
            price: data.c.toFixed(2),
            change: data.dp?.toFixed(2) || stock.change,
            isPositive: data.dp >= 0
          };
        } catch (e) { return stock; }
      }));
    };

    if (stocks.length > 0) setStocks(await updateList(stocks));
    if (watchlist.length > 0) setWatchlist(await updateList(watchlist));
  }, 10000);

  return () => clearInterval(liveTimer);
}, [stocks, watchlist, isMarketOpen]);

  // --- NEURAL SCANNER LOGIC ---
const runScanner = useCallback(async (tickerToSearch = null) => {
  setLoading(true);
  setStocks([]); 
  setScanStatus("INITIALIZING...");

  const rejectedTickers = new Set();
  const displayedTickers = new Set(); 
  const localStocks = [];
  
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const fDate = now.toISOString().split('T')[0];     
  const yDate = oneWeekAgo.toISOString().split('T')[0];
  const currentMonthName = now.toLocaleString('default', { month: 'long' }); 
  const currentYear = now.getFullYear();

  const isManual = !!tickerToSearch;
  let attempts = 0;

  try {
    const targetGoal = isManual ? 1 : 10;

    while (localStocks.length < targetGoal && attempts < 15) {
      attempts++;
      let tickersToProcess = [];

      if (isManual) {
        setScanStatus(`LOCKING ON: ${tickerToSearch.toUpperCase()}...`);
        tickersToProcess = [tickerToSearch.toUpperCase().replace(/[^A-Z]/g, "")];
      } else {
        setScanStatus(`GATHERING...`);
        const excludeStr = rejectedTickers.size > 0 ? `EXCLUDE: ${Array.from(rejectedTickers).slice(-20).join(", ")}` : "";

        const discoveryPrompt = `
You are a quantitative analyst scanning for US stocks under $${scanPriceLimit} with MAJOR catalysts for ${currentMonthName} ${currentYear}.

CRITICAL: Return ONLY valid stock tickers (2-5 letters, US-traded). No company names, no explanations.

${scanMarketCap !== 'all' ? `MARKET CAP FILTER: Focus ONLY on ${
  scanMarketCap === 'small' ? 'small-cap stocks ($300M - $2B market cap)' :
  scanMarketCap === 'mid' ? 'mid-cap stocks ($2B - $10B market cap)' :
  'large-cap stocks (over $10B market cap)'
}` : ''}

${scanSector !== 'all' ? `SECTOR FILTER: Focus ONLY on ${
  scanSector === 'technology' ? 'Technology sector (software, hardware, semiconductors, IT services)' :
  scanSector === 'healthcare' ? 'Healthcare sector (biotech, pharma, medical devices, healthcare services)' :
  scanSector === 'finance' ? 'Financial sector (banks, insurance, fintech, asset management)' :
  scanSector === 'energy' ? 'Energy sector (oil, gas, renewable energy, utilities)' :
  scanSector === 'consumer' ? 'Consumer sector (retail, restaurants, consumer goods)' :
  scanSector === 'industrial' ? 'Industrial sector (manufacturing, aerospace, defense, transportation)' :
  scanSector === 'materials' ? 'Materials sector (mining, chemicals, construction materials)' :
  scanSector === 'realestate' ? 'Real Estate sector (REITs, property management)' :
  'Utilities sector (electric, water, gas utilities)'
} companies.` : ''}

SEARCH STRATEGY:

1. BIOTECH CATALYSTS (Top Priority - Jan 2026 is peak season):
   - "FDA PDUFA approval January 2026"
   - "Phase 3 clinical trial results ${currentMonthName} 2026"
   - "Biosecure Act beneficiaries manufacturing"
   - "ASCO GU genitourinary conference ${currentMonthName} 2026"
   Search biotech stocks under $20 with binary events this month.

2. LEGISLATIVE & POLICY WINNERS:
   - "DOGE government efficiency contract winners"
   - "Corporate tax cut small cap beneficiaries 2026"
   - "EPA methane fee repeal energy stocks"
   - "Defense spending increase 2026 small caps"
   Search companies benefiting from new regulations/deregulation.

3. TECHNICAL BREAKOUTS:
   - "Stocks breaking 52-week high ${currentMonthName} 2026"
   - "Short squeeze candidates high short interest"
   - "Golden cross technical breakout small caps"
   - "Analyst upgrade strong buy rating this week"
   Search stocks with momentum + institutional buying.

4. M&A / SPECIAL SITUATIONS:
   - "Merger acquisition target ${currentMonthName} 2026"
   - "Activist investor stake announcement"
   - "Buyout rumor takeover candidate"
   Search companies with acquisition potential.

QUALITY FILTERS:
- Only stocks under $${scanPriceLimit}
- Must have NEWS from past 7 days
- Prioritize small/mid caps ($100M - $10B market cap)
- Avoid penny stocks under $2

TRUSTED SOURCES ONLY: ${sourceString}

${excludeStr}

OUTPUT FORMAT: Return ONLY a comma-separated list of 100-150 stock tickers.
Example: ABCD, EFGH, IJKL, MNOP
`;

        const aiRes = await aiModel.generateContent({
          contents: [{ role: "user", parts: [{ text: discoveryPrompt }] }],
          tools: [{ googleSearch: {} }] 
        });
        
        const aiText = await aiRes.response.text();
        const foundSymbols = (aiText || "").match(/\b[A-Z]{2,5}\b/g) || [];
        tickersToProcess = [...new Set(foundSymbols)];
      }

      const blacklist = ["CNBC", "CNN", "FRED", "WSJ", "NYSE", "NASDAQ", "BLOOMBERG", "REUTERS", "FDA", "JAN", "FEB"];
      const tickers = tickersToProcess.filter(t => !blacklist.includes(t));

      for (const ticker of tickers) {
        if (localStocks.length >= targetGoal) break;
        if (displayedTickers.has(ticker) || rejectedTickers.has(ticker)) continue;

        setScanStatus(`ANALYZING: ${ticker}`);

        try {
        const qUrl = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`;
        const nUrl = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${yDate}&to=${fDate}&token=${FINNHUB_KEY}`;    
        const pUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`;

        // Add historical data fetch (30 days of candles)
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
        const nowTimestamp = Math.floor(Date.now() / 1000);
        const hUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${thirtyDaysAgo}&to=${nowTimestamp}&token=${FINNHUB_KEY}`;

        const [q, n, p, h] = await Promise.all([
          fetch(qUrl).then(r => r.json()),
          fetch(nUrl).then(r => r.json()),
          fetch(pUrl).then(r => r.json()),
          fetch(hUrl).then(r => r.json()),
        ]);

          await new Promise(r => setTimeout(r, 1200));

if (!isManual) {
  if (q.c < 2) {
    rejectedTickers.add(ticker);
    continue;
  }
  
  if (q.c > scanPriceLimit) {
    rejectedTickers.add(ticker);
    continue;
  }
}

const headlines = n?.length > 0 
  ? n.slice(0, 10).map(i => `[${new Date(i.datetime * 1000).toLocaleDateString()}] ${i.headline}`).join(" | ") 
  : "No recent company-specific news found.";

const analysisPrompt = isManual 
  ? `
    TICKER: ${ticker}
    CURRENT PRICE: $${q.c}
    52-WEEK RANGE: $${q.l} - $${q.h}
    NEWS (Past 7 Days): ${headlines}
    COMPANY: ${p.name || ticker}
    
    Provide a comprehensive analysis regardless of catalyst strength.
    
    ANALYZE:
    1. Price momentum and technical setup
    2. Recent news developments (even if minor)
    3. Sector trends and peer comparison
    4. Risk factors and potential headwinds
    
    FORMAT (Use EXACT tags):
    NAME: ${p.name || 'Unknown'}
    [RANGE] $XX.XX - $XX.XX [/RANGE]
    [SIG] BULLISH or BEARISH [/SIG]
    [MOM] Positive, Steady, or Uncertain [/MOM]
    [CAT] Brief description of main driver or "Routine Trading" [/CAT]
    [CONF] XX.XX [/CONF] (20-95 range, higher = more confident)
    [VOLATILITY] XX.XX [/VOLATILITY]
    [INSIGHTS]
    | First insight about price action or technical setup
    | Second insight about fundamentals or news
    | Third insight about risks or catalysts
    [/INSIGHTS]
  `
  : `
    TICKER: ${ticker}
    PRICE: $${q.c} (52W: $${q.l} - $${q.h})
    NEWS: ${headlines}
    COMPANY: ${p.name || ticker}
    
    Analyze ${ticker} for potential trading opportunities in ${currentMonthName} ${currentYear}.
    
    IMPORTANT: If NEWS shows "No recent company-specific news found", you MUST analyze:
    - Price momentum and technical patterns
    - Sector performance and industry trends
    - Recent volume changes
    - Distance from 52-week high/low
    Do NOT just say "sector tailwinds" - be specific about what you observe.
    
    ACCEPT these as valid catalysts:
    ✓ Recent earnings or guidance (within 30 days)
    ✓ FDA approvals, clinical trials, healthcare developments
    ✓ M&A activity, acquisitions, activist investors
    ✓ Major analyst upgrades from known firms
    ✓ Significant contract wins or partnerships
    ✓ Technical breakouts with strong volume
    ✓ Regulatory/policy benefits to the company
    ✓ Sector rotation or industry tailwinds (only if specific)
    
    REJECT only if:
    ✗ Absolutely no news in past 30 days AND no technical setup
    ✗ Only negative news
    
    Be GENEROUS with confidence scores:
    - 60-80: Recent relevant news from decent source
    - 40-60: Technical setup or sector momentum
    - Below 40: Very weak/old information
    
    FORMAT (Use EXACT tags):
    NAME: ${p.name || 'Unknown'}
    [RANGE] $XX.XX - $XX.XX [/RANGE]
    [SIG] BULLISH or BEARISH [/SIG]
    [MOM] Positive, Steady, or Uncertain [/MOM]
    [CAT] Specific catalyst (NOT generic) - max 10 words [/CAT]
    [CONF] XX.XX [/CONF]
    [VOLATILITY] XX.XX [/VOLATILITY]
    [INSIGHTS]
    | Insight about catalyst or price action
    | Supporting technical or fundamental point
    | Risk consideration or alternative view
    [/INSIGHTS]
    
    Only mark [SIG] NEUTRAL [/SIG] if there's truly zero relevant information.
  `;

const analysis = await aiModel.generateContent(analysisPrompt);
const resText = await analysis.response.text();


if (!isManual && resText.includes("NEUTRAL")) {
  rejectedTickers.add(ticker);
  continue;
}

// Get AI's catalyst assessment
const aiConfidence = getScore(extract("CONF", resText), 65);

const newStock = {
  symbol: ticker.trim().toUpperCase(),
  name: p.name || clean(extract("NAME", resText)) || `${ticker} CORP`,
  price: q.c.toFixed(2),
  change: q.dp?.toFixed(2) || "0.00",
  isPositive: extract("SIG", resText).toUpperCase().includes("BULLISH"),
  range: clean(extract("RANGE", resText)),
  confidence: calculateSignalStrength(n, h.c, q.c, h.c && h.c.length >= 2 ? calculateHV(h.c).toFixed(2) : 40, aiConfidence),
  volatility: h.c && h.c.length >= 2 ? calculateHV(h.c).toFixed(2) : 40.00,
  rating: clean(extract("SIG", resText)),
  momentum: clean(extract("MOM", resText)),
  catalyst: formatText(clean(extract("CAT", resText))), 
  insights: extract("INSIGHTS", resText).split('|').map(i => formatText(clean(i))).filter(i => i.length > 5)
};

          localStocks.push(newStock);
          displayedTickers.add(ticker); 
          setStocks([...localStocks]); 

        } catch (e) {
          rejectedTickers.add(ticker);
        }
      }
      if (isManual) break;
    }
  } catch (err) { console.error(err); }
  finally { setLoading(false); setScanStatus("COMPLETE"); }
}, [aiModel, sourceString, scanPriceLimit, scanMarketCap, scanSector]);


// --- SORT AND FILTER LOGIC ---
const getSortedAndFilteredStocks = (stockList) => {
  let filtered = [...stockList];
  
  if (filterSignal !== "all") {
    filtered = filtered.filter(stock => 
      stock.rating.toLowerCase() === filterSignal.toLowerCase()
    );
  }
  
  if (filterPriceRange !== "all") {
    filtered = filtered.filter(stock => {
      const price = parseFloat(stock.price);
      if (filterPriceRange === "under10") return price < 10;
      if (filterPriceRange === "10-25") return price >= 10 && price < 25;
      if (filterPriceRange === "25-50") return price >= 25 && price < 50;
      if (filterPriceRange === "over50") return price >= 50;
      return true;
    });
  }
  
  if (filterVolatility !== "all") {
    filtered = filtered.filter(stock => {
      const vol = stock.volatility;
      if (filterVolatility === "low") return vol < 30;
      if (filterVolatility === "medium") return vol >= 30 && vol <= 50;
      if (filterVolatility === "high") return vol > 50;
      return true;
    });
  }
  
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "confidence") return b.confidence - a.confidence;
    if (sortBy === "volatility-high") return b.volatility - a.volatility;
    if (sortBy === "volatility-low") return a.volatility - b.volatility;
    if (sortBy === "price-high") return parseFloat(b.price) - parseFloat(a.price);
    if (sortBy === "price-low") return parseFloat(a.price) - parseFloat(b.price);
    if (sortBy === "change-high") return parseFloat(b.change) - parseFloat(a.change);
    if (sortBy === "change-low") return parseFloat(a.change) - parseFloat(b.change);
    return 0;
  });
  
  return sorted;
};

const displayedStocks = getSortedAndFilteredStocks(stocks);
const displayedWatchlist = getSortedAndFilteredStocks(watchlist);



 return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-mono">
      <style>{`
        select option {
          background-color: #000 !important;
          color: #fff !important;
        }
        select option:hover {
          background-color: #1a1a1a !important;
        }
        select option:checked {
          background-color: #00ff4e !important;
          color: #000 !important;
        }
      `}</style>
      
{/* HEADER */}
<header className="flex justify-between items-center mb-8 md:mb-12 border-b-2 border-zinc-900 pb-6 md:pb-8 gap-4">
  {/* Left side - Logo and Status */}
  <div className="flex items-center gap-4 md:gap-6">
    <button onClick={() => setActiveTab("DASHBOARD")} className="cursor-pointer hover:opacity-80 transition-opacity">
      <img src="/jckrbbt_logo.png" alt="Logo" className="h-12 md:h-16 w-auto object-contain" />
    </button>
    <div className="border-l-2 border-zinc-900 pl-4 md:pl-6 hidden md:block">
      <p className="text-zinc-600 text-[8px] md:text-[10px] tracking-[0.3em] md:tracking-[0.4em] uppercase flex items-center gap-2 font-black flex-wrap">
        <span className="hidden sm:inline">Status:</span>
        <span className="hidden lg:inline">{scanStatus}</span>
        {isMarketOpen && <span className="h-2 w-2 bg-[#00ff4e] rounded-full animate-pulse shadow-[0_0_10px_#00ff4e]"/>}
      </p>
    </div>
  </div>
  
  {/* Right side - Clock and Auth */}
  <div className="flex items-center gap-4 md:gap-6">
    {/* Clock - hidden on mobile */}
    <div className="text-right hidden md:block">
      <p className="text-[#00ff4e] font-black tabular-nums text-lg md:text-xl tracking-tighter">
        {currentTime.toLocaleTimeString([], { hour12: true })}
      </p>
      <p className="text-zinc-500 text-[8px] md:text-[10px] font-black uppercase tracking-wider md:tracking-widest">
        {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
      </p>
    </div>
    
    {/* Auth Button */}
    {authLoading ? (
      <div className="w-10 h-10 bg-zinc-900 rounded-full animate-pulse" />
    ) : user ? (
      <div className="relative group">
        <button className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-[#00ff4e]/50 px-3 md:px-4 py-2 rounded-lg transition-all">
          {userProfile?.profilePicUrl ? (
            <img 
              src={userProfile.profilePicUrl} 
              alt="Profile" 
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={`w-8 h-8 bg-[#00ff4e] rounded-full flex items-center justify-center text-black font-black text-sm flex-shrink-0 ${userProfile?.profilePicUrl ? 'hidden' : ''}`}
          >
            {userProfile?.username?.[0]?.toUpperCase() || user.email?.[0].toUpperCase()}
          </div>
          <span className="hidden md:block text-white text-sm font-bold whitespace-nowrap">
            {userProfile?.username || user.email}
          </span>
        </button>
        
        {/* Dropdown */}
        <div className="absolute right-0 top-full mt-2 w-48 bg-black border-2 border-zinc-800 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <button
            onClick={() => setShowProfileSettings(true)}
            className="w-full text-left px-4 py-3 text-sm font-bold text-white hover:bg-zinc-900 transition-all border-b border-zinc-800"
          >
            Profile Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-zinc-900 transition-all rounded-b-lg"
          >
            Sign Out
          </button>
        </div>
      </div>
    ) : (
      <button
        onClick={() => setShowAuthModal(true)}
        className="bg-[#00ff4e] hover:opacity-90 text-black font-black px-4 md:px-6 py-2 rounded-lg text-xs md:text-sm uppercase tracking-tight transition-all shadow-[0_0_15px_rgba(0,255,78,0.2)]"
      >
        Sign In
      </button>
    )}
  </div>
</header>

      <TypewriterGreeting />

      <div className="flex gap-2 md:gap-4 mb-6 md:mb-8 border-b border-zinc-900 pb-4 overflow-x-auto">
        {["DASHBOARD", "WATCH LIST", "NEWS"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[10px] md:text-xs font-black tracking-[0.2em] md:tracking-[0.3em] px-4 md:px-6 py-2 rounded-full transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === tab 
              ? "bg-[#00ff4e] text-black shadow-[0_0_20px_rgba(0,255,78,0.4)]" 
              : "text-zinc-500 hover:text-white"
            }`}
          >
            {tab === "WATCH LIST" ? `WATCH LIST (${watchlist.length})` : tab}
          </button>
        ))}
      </div>

      {/* NEWS TAB CONTROLS */}
      {activeTab === "NEWS" && (
        <div className="bg-[#050505] border border-zinc-900 p-3 md:p-4 rounded-xl mb-6 md:mb-8 shadow-2xl backdrop-blur-md overflow-visible">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 bg-[#00ff4e] rounded-full animate-pulse shadow-[0_0_10px_#00ff4e]" />
              <span className="text-zinc-500 text-[10px] md:text-xs font-black uppercase tracking-wider md:tracking-widest">
                Live Financial News
              </span>
            </div>
            <button 
              onClick={fetchNews}
              disabled={loadingNews}
              className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-zinc-400 px-4 md:px-6 py-3 rounded-lg text-xs md:text-sm font-bold border border-zinc-800 transition-all flex items-center justify-center gap-2 whitespace-nowrap hover:text-[#00ff4e] hover:border-[#00ff4e]/30"
            >
              <span className={loadingNews ? 'animate-spin' : ''}>↻</span>
              REFRESH
            </button>
          </div>
        </div>
      )}

 {activeTab !== "NEWS" && (
  <div className="space-y-4 md:space-y-6 mb-6 md:mb-8">
    {/* MANUAL SEARCH SECTION */}
    <div className="bg-[#050505] border border-zinc-900 p-4 md:p-5 rounded-xl shadow-2xl backdrop-blur-md">
      <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">
        Analyze Any Stock
      </h3>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Enter ticker (e.g. AAPL, TSLA)..."
          value={manualSearch}
          onChange={(e) => setManualSearch(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && runScanner(manualSearch)}
          className="flex-1 bg-black border border-zinc-800 text-white px-4 md:px-5 py-3 rounded-lg outline-none transition-all font-mono text-sm placeholder:text-zinc-700 focus:border-[#00ff4e]/50"
          style={{ caretColor: '#00ff4e' }}
        />
        <button 
          onClick={() => runScanner(manualSearch)}
          disabled={loading || !manualSearch}
          className="hover:opacity-90 disabled:opacity-20 text-black px-6 md:px-8 py-3 rounded-lg text-xs md:text-sm font-black tracking-tighter transition-all shadow-[0_0_15px_rgba(0,255,78,0.2)] active:scale-95 whitespace-nowrap"
          style={{ backgroundColor: '#00ff4e' }}
        >
          {loading ? 'ANALYZING...' : 'ANALYZE STOCK'}
        </button>
      </div>
    </div>

    {/* AI SCANNER SECTION */}
{/* AI SCANNER SECTION */}
<div className="bg-[#050505] border border-zinc-900 p-4 md:p-5 rounded-xl shadow-2xl backdrop-blur-md">
  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">
    ANALYZE MARKET
  </h3>
  <div className="flex flex-col sm:flex-row gap-3">
    <CustomDropdown
      value={scanPriceLimit}
      onChange={setScanPriceLimit}
      label="Price Limit"
      options={[
        { value: 10, label: 'Under $10' },
        { value: 25, label: 'Under $25' },
        { value: 50, label: 'Under $50' },
        { value: 100, label: 'Under $100' },
        { value: 999999, label: 'Any Price' }
      ]}
    />
    
    <CustomDropdown
      value={scanMarketCap}
      onChange={setScanMarketCap}
      label="Market Cap"
      options={[
        { value: 'all', label: 'Any Market Cap' },
        { value: 'small', label: 'Small Cap' },
        { value: 'mid', label: 'Mid Cap' },
        { value: 'large', label: 'Large Cap' }
      ]}
    />
    
    <CustomDropdown
      value={scanSector}
      onChange={setScanSector}
      label="Sector"
      options={[
        { value: 'all', label: 'All Sectors' },
        { value: 'technology', label: 'Technology' },
        { value: 'healthcare', label: 'Healthcare' },
        { value: 'finance', label: 'Finance' },
        { value: 'energy', label: 'Energy' },
        { value: 'consumer', label: 'Consumer' },
        { value: 'industrial', label: 'Industrial' },
        { value: 'materials', label: 'Materials' },
        { value: 'realestate', label: 'Real Estate' },
        { value: 'utilities', label: 'Utilities' }
      ]}
    />
    
    <button 
      onClick={() => { setManualSearch(""); runScanner(null); }}
      disabled={loading}
      className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 px-6 py-3 rounded-lg text-xs md:text-sm font-bold border border-zinc-800 transition-all flex items-center justify-center gap-2 whitespace-nowrap hover:text-[#00ff4e] hover:border-[#00ff4e]/30 disabled:opacity-50"
    >
      {loading ? (
        <>
          <span>ANALYZING MARKET</span>
          <span className="inline-flex gap-0.5">
            <span className="animate-[pulse_1s_ease-in-out_infinite]">.</span>
            <span className="animate-[pulse_1s_ease-in-out_0.2s_infinite]">.</span>
            <span className="animate-[pulse_1s_ease-in-out_0.4s_infinite]">.</span>
          </span>
        </>
      ) : (
        <>
          ANALYZE MARKET
        </>
      )}
    </button>
  </div>
</div>
  </div>
)}

      {/* SORT & FILTER BAR */}
      {activeTab !== "NEWS" && (stocks.length > 0 || watchlist.length > 0) && (
        <div className="bg-[#0a0a0a] border border-zinc-900 rounded-lg p-3 md:p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
          <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
            Filters:
          </span>
          
          <div className="grid grid-cols-2 sm:flex gap-2 md:gap-4 w-full sm:w-auto">
            <CustomDropdown
              value={sortBy}
              onChange={setSortBy}
              label="Sort"
              options={[
                { value: 'confidence', label: 'Confidence ↓' },
                { value: 'volatility-high', label: 'Volatility ↓' },
                { value: 'volatility-low', label: 'Volatility ↑' },
                { value: 'price-high', label: 'Price ↓' },
                { value: 'price-low', label: 'Price ↑' },
                { value: 'change-high', label: 'Change ↓' },
                { value: 'change-low', label: 'Change ↑' }
              ]}
            />
            
            <CustomDropdown
              value={filterSignal}
              onChange={setFilterSignal}
              label="Signal"
              options={[
                { value: 'all', label: 'All' },
                { value: 'bullish', label: 'Bullish' },
                { value: 'bearish', label: 'Bearish' }
              ]}
            />
            
            <CustomDropdown
              value={filterPriceRange}
              onChange={setFilterPriceRange}
              label="Price"
              options={[
                { value: 'all', label: 'All' },
                { value: 'under10', label: '<$10' },
                { value: '10-25', label: '$10-25' },
                { value: '25-50', label: '$25-50' },
                { value: 'over50', label: '>$50' }
              ]}
            />
            
            <CustomDropdown
              value={filterVolatility}
              onChange={setFilterVolatility}
              label="Volatility"
              options={[
                { value: 'all', label: 'All' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Med' },
                { value: 'high', label: 'High' }
              ]}
            />
          </div>
          
          {(sortBy !== "confidence" || filterSignal !== "all" || filterPriceRange !== "all" || filterVolatility !== "all") && (
            <button
              onClick={() => {
                setSortBy("confidence");
                setFilterSignal("all");
                setFilterPriceRange("all");
                setFilterVolatility("all");
              }}
              className="text-zinc-500 hover:text-[#00ff4e] text-[10px] md:text-xs font-black uppercase tracking-wider transition-colors whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* CARDS */}
      <div className="space-y-6 md:space-y-8 mt-6 md:mt-10">
        {activeTab === "DASHBOARD" ? (
          <>
            {stocks.length === 0 && !loading && (
              <div className="py-32 md:py-40 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
                <p className="text-xs md:text-sm tracking-[0.4em] md:tracking-[0.5em] uppercase font-black">Scanner Idle</p>
              </div>
            )}
            {displayedStocks.map(stock => (
              <MetricCard 
                key={stock.symbol} 
                stock={stock} 
                isMarketOpen={isMarketOpen} 
                onAction={() => addToWatchlist(stock)}
                removeFromWatchlist={removeFromWatchlist}
                actionType="ADD"
                watchlist={watchlist}
              />
            ))}
          </>
        ) : activeTab === "WATCH LIST" ? (
          <>
            {watchlist.length === 0 && (
              <div className="py-32 md:py-40 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
                <p className="text-xs md:text-sm tracking-[0.4em] md:tracking-[0.5em] uppercase font-black">Watch List Empty</p>
              </div>
            )}
            {displayedWatchlist.map(stock => (
              <MetricCard 
                key={stock.symbol} 
                stock={stock} 
                isMarketOpen={isMarketOpen} 
                onAction={() => removeFromWatchlist(stock.symbol)}
                removeFromWatchlist={removeFromWatchlist}
                actionType="REMOVE"
                watchlist={watchlist}
              />
            ))}
          </>
        ) : (
          <>
            {loadingNews && newsArticles.length === 0 && (
              <div className="py-32 md:py-40 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
                <p className="text-xs md:text-sm tracking-[0.4em] md:tracking-[0.5em] uppercase font-black">Loading News...</p>
              </div>
            )}
            {!loadingNews && newsArticles.length === 0 && (
              <div className="py-32 md:py-40 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
                <p className="text-xs md:text-sm tracking-[0.4em] md:tracking-[0.5em] uppercase font-black">No News Available</p>
              </div>
            )}
            {newsArticles.map(article => (
              <NewsCard key={article.id} article={article} />
            ))}
          </>
        )}
      </div>
           {/* AUTH MODAL */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => console.log('Auth successful!')}
      />
      {/* PROFILE SETTINGS MODAL */}
        <ProfileSettings
          isOpen={showProfileSettings}
          onClose={async (shouldReload) => {
            setShowProfileSettings(false);
            // Reload profile if changes were saved
            if (shouldReload && user) {
              const docRef = doc(db, 'users', user.uid);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const data = docSnap.data();
                setUserProfile({
                  username: data.username || null,
                  profilePicUrl: data.profilePicUrl || null
                });
              }
            }
          }}
          user={user}
        />
    </div>
  );
}

function CustomDropdown({ value, onChange, options, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const [buttonRect, setButtonRect] = useState(null);
  
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonRect({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);
  
  // Close dropdown on scroll
  useEffect(() => {
    if (!isOpen) return;
    
    const handleScroll = () => {
      setIsOpen(false);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isOpen]);
  
  const handleToggle = () => {
    setIsOpen(!isOpen);
  };
  
  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };
  
  return (
    <div className="relative flex-1 sm:flex-none min-w-[120px]">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="w-full bg-black border border-zinc-800 text-white px-3 md:px-5 py-3 md:py-4 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider cursor-pointer hover:border-[#00ff4e]/50 focus:border-[#00ff4e]/50 focus:outline-none transition-all text-left flex items-center justify-between"
      >
        <span className="truncate">{options.find(opt => opt.value === value)?.label || label}</span>
        <span className="text-[#00ff4e] ml-2 flex-shrink-0">▼</span>
      </button>
      
      {isOpen && buttonRect && ReactDOM.createPortal(
        <>
          <div 
            className="fixed inset-0 bg-transparent" 
            style={{ zIndex: 99998 }}
            onClick={handleToggle}
          />
          
          <div 
            className="fixed bg-black border-2 border-zinc-800 rounded-lg overflow-hidden shadow-2xl max-h-60 overflow-y-auto"
            style={{ 
              zIndex: 99999,
              top: `${Math.min(buttonRect.top + 4, window.innerHeight - 250)}px`,
              left: `${buttonRect.left}px`,
              width: `${buttonRect.width}px`
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full text-left px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all ${
                  value === option.value
                    ? 'bg-[#00ff4e] text-black'
                    : 'text-white hover:bg-zinc-900 hover:text-[#00ff4e]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function MetricCard({ stock, isMarketOpen, onAction, actionType, watchlist = [], removeFromWatchlist }) {
  const [isOpen, setIsOpen] = useState(false);  
  const [isHoveringButton, setIsHoveringButton] = useState(false);
  const cardRef = useRef(null);
  
  const accent = stock.isPositive ? '#00ff4e' : '#FF4B2B';
  const isPositive = parseFloat(stock.change) >= 0;
  const trendColor = isPositive ? '#00ff4e' : '#FF4B2B';
  const Triangle = isPositive ? '▲' : '▼';
  const prefix = isPositive ? '+' : '';
  const isAlreadyAdded = watchlist.some(s => s.symbol === stock.symbol);

  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => {
      if (!cardRef.current) return;
      
      const rect = cardRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      if (rect.bottom < 100 || rect.top > windowHeight - 100) {
        setIsOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen]);

  return (
    <div 
      ref={cardRef}
      className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-8 relative hover:border-zinc-600 transition-all overflow-hidden group"
    >
      
      {/* WATCHLIST BUTTON */}
      <button 
        onMouseEnter={() => setIsHoveringButton(true)}
        onMouseLeave={() => setIsHoveringButton(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (actionType === "REMOVE" || isAlreadyAdded) {
            removeFromWatchlist(stock.symbol);
          } else {
            onAction();
          }
        }}
        className={`absolute top-3 right-3 md:top-4 md:right-8 z-10 flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 rounded-lg border transition-all active:scale-95 ${
          isAlreadyAdded 
            ? isHoveringButton 
              ? "border-red-500/50 bg-red-500/10 text-red-500" 
              : "border-[#00ff4e]/50 bg-[#00ff4e]/10 text-[#00ff4e]" 
            : "border-zinc-800 bg-black text-zinc-500 hover:text-[#00ff4e] hover:border-[#00ff4e]/50"
        }`}
      >
        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] leading-none hidden sm:inline">
          {actionType === "REMOVE" 
            ? "Remove" 
            : isAlreadyAdded 
              ? (isHoveringButton ? "Remove" : "Added") 
              : "Add"}
        </span>
        
        <div className="flex items-center justify-center">
          {actionType === "REMOVE" || (isAlreadyAdded && isHoveringButton) ? (
            <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
          ) : isAlreadyAdded ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 md:w-3.5 md:h-3.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </motion.div>
          ) : (
            <Plus size={12} className="md:w-3.5 md:h-3.5" />
          )}
        </div>
      </button>

     

      {/* MAIN CONTENT */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-6 md:mb-8 gap-4">
        <div className="flex-1">
         <p className="text-[8px] md:text-[10px] text-[#ffffff] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] mb-2 flex items-center gap-2">
  <span 
    className={`h-1.5 w-1.5 md:h-2 md:w-2 rounded-full flex-shrink-0 ${isMarketOpen ? 'animate-pulse' : ''}`} 
    style={{ backgroundColor: accent, boxShadow: isMarketOpen ? `0 0 15px ${accent}` : 'none' }} 
  />
  {stock.name}
</p>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 md:gap-8">
            <h2 className="text-4xl md:text-7xl font-black tracking-tighter text-white uppercase leading-none">{stock.symbol}</h2>
            <div className="flex items-baseline gap-2 md:gap-3">
              <span className="text-3xl md:text-5xl font-black text-white tabular-nums leading-none">${stock.price}</span>
              <span className="text-xl md:text-3xl font-black tabular-nums leading-none" style={{ color: trendColor }}>
                {prefix}{stock.change}% <span className="text-lg md:text-2xl ml-1 md:ml-2 align-middle">{Triangle}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-4 md:gap-8 md:text-right md:border-l-2 md:border-zinc-900 md:pl-8">
          <div>
            <p className="text-[8px] md:text-[10px] text-zinc-500 font-black uppercase tracking-wider md:tracking-widest mb-2 md:mb-4">Predicted Range</p>
            <p className="text-xl md:text-3xl font-black text-white tracking-tight tabular-nums leading-none whitespace-nowrap">{stock.range}</p>
          </div>
        </div>
      </div>

{/* METRICS GRID */}
<div className="grid grid-cols-3 gap-4 md:gap-12 border-t-2 border-zinc-900 pt-4 md:pt-8 mb-6 md:mb-10">
  <div>
    <p className="text-[8px] md:text-[10px] text-zinc-500 font-black mb-1 md:mb-2 uppercase tracking-tighter flex items-center">
      Signal
      <Tooltip content="Bullish signals indicate potential upward movement based on AI analysis of news, technicals, and momentum. Bearish signals suggest downward pressure." />
    </p>
    <p className="text-base md:text-2xl font-black text-white uppercase">{stock.rating}</p>
  </div>
  <div>
    <p className="text-[8px] md:text-[10px] text-zinc-500 font-black mb-1 md:mb-2 uppercase tracking-tighter flex items-center">
      Momentum
      <Tooltip content="Momentum shows the strength and direction of recent price movement. Positive momentum indicates sustained buying pressure." />
    </p>
    <p className="text-base md:text-2xl font-black text-white uppercase">{stock.momentum}</p>
  </div>
  <div className="col-span-3 md:col-span-1">
    <p className="text-[8px] md:text-[10px] text-zinc-500 font-black mb-1 md:mb-2 uppercase tracking-tighter flex items-center">
      Catalyst
      <Tooltip content="The primary driver or event influencing the stock's movement. This could be earnings, FDA approvals, M&A activity, or technical breakouts." />
    </p>
    <p className="text-base md:text-2xl font-black text-white uppercase leading-tight">{stock.catalyst}</p>
  </div>
</div>

{/* PROGRESS BARS */}
<div className="space-y-4 md:space-y-8 mb-6 md:mb-10">
<div>
  <div className="flex justify-between text-[8px] md:text-[10px] font-black text-zinc-500 mb-2 md:mb-3 uppercase tracking-widest">
    <span className="flex items-center">
      Signal Strength
      <Tooltip content="Quantitative score (0-100%) based on news recency, news volume, price momentum, volatility, and catalyst strength. Higher scores indicate stronger trading opportunities." />
    </span>
    <span style={{ color: '#00ff4e' }}>{stock.confidence}%</span>
  </div>
  <div className="h-[2px] md:h-[3px] bg-zinc-900 w-full relative">
    <motion.div initial={{ width: 0 }} animate={{ width: `${stock.confidence}%` }} className="absolute h-full bg-[#00ff4e] shadow-[0_0_15px_#00ff4e]" />
  </div>
</div>
  <div>
    <div className="flex justify-between items-end mb-2">
      <span className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center">
        Volatility Index
        <Tooltip content="Measures price fluctuation based on 52-week range. Higher volatility means larger price swings and higher risk/reward potential." />
      </span>
      <span className="text-[10px] md:text-xs font-mono text-[#00ff4e] bg-[#00ff4e]/10 px-2 py-0.5 rounded">{stock.volatility}%</span>
    </div>
    <div className="h-[2px] bg-zinc-800 rounded-full overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width: `${stock.volatility}%` }} transition={{ duration: 1.5, ease: "circOut" }} className={`h-full shadow-[0_0_15px] ${stock.volatility > 35 ? 'bg-red-500 shadow-red-500' : 'bg-[#00ff4e] shadow-[#00ff4e]'}`} />
    </div>
  </div>
</div>

      {/* INSIGHTS TOGGLE */}
      <div className="border-t-2 border-zinc-900 pt-4 md:pt-6">
        <button onClick={() => setIsOpen(!isOpen)} className="group flex items-center gap-2 md:gap-3 transition-all">
          <span className={`h-1 w-1 md:h-1.5 md:w-1.5 rounded-full ${isOpen ? 'bg-[#00ff4e] shadow-[0_0_8px_#00ff4e]' : 'bg-zinc-700'}`} />
          <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.25em] md:tracking-[0.3em] ${isOpen ? 'text-[#00ff4e]' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
            {isOpen ? "Hide Insights" : "View Insights"}
          </span>
          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className={`text-[8px] md:text-[10px] ${isOpen ? 'text-[#00ff4e]' : 'text-zinc-500'}`}>▼</motion.span>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial="hidden" animate="visible" exit="hidden"
              variants={{ hidden: { height: 0, opacity: 0 }, visible: { height: "auto", opacity: 1, transition: { duration: 0.4 } } }}
              className="mt-4 md:mt-6 pl-4 md:pl-8 relative overflow-hidden"
            >
              <motion.div className="absolute left-0 top-0 w-[2px] h-full bg-[#00ff4e] shadow-[0_0_10px_#00ff4e]" />
              <div className="flex flex-col gap-6 md:gap-8">
                <div className="flex-1 space-y-4 md:space-y-6">
                  {stock.insights.map((point, i) => (
                    <div key={i} className="flex items-start gap-3 md:gap-4">
                      <span className="mt-1 md:mt-2 h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-[#00ff4e] shrink-0 shadow-[0_0_5px_#00ff4e]" />
                      <p className="text-zinc-300 text-xs md:text-sm leading-relaxed font-medium">{point}</p>
                    </div>
                  ))}
                </div>
                <div className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl p-3 md:p-4">
                  <div className="flex justify-between items-center mb-3 md:mb-4">
                    <h4 className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">Intraday Pulse</h4>
                    <span className="text-[8px] md:text-[10px] font-bold text-[#00ff4e]">LIVE</span>
                  </div>
                  <MiniChart symbol={stock.symbol} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// NEWS CARD COMPONENT
function NewsCard({ article }) {
  const categoryColors = {
    'Markets': '#00ff4e',
    'Stocks': '#3b82f6',
    'Crypto': '#f59e0b',
    'Tech': '#8b5cf6',
    'Economy': '#ef4444',
    'Policy': '#ec4899',
    'Earnings': '#10b981'
  };

  const categoryColor = categoryColors[article.category] || '#00ff4e';
  const timeAgo = new Date(article.datetime * 1000).toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-6 hover:border-zinc-700 transition-all cursor-pointer group"
      onClick={() => window.open(article.url, '_blank')}
    >
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Article Image */}
        {article.image && (
          <div className="w-full md:w-48 h-40 md:h-32 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-900">
            <img 
              src={article.image} 
              alt={article.headline}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}
        
        {/* Article Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3 flex-wrap">
            <span 
              className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.25em] md:tracking-[0.3em] px-2 md:px-3 py-1 rounded-full"
              style={{ 
                backgroundColor: `${categoryColor}20`, 
                color: categoryColor,
                border: `1px solid ${categoryColor}40`
              }}
            >
              {article.category}
            </span>
            <span className="text-zinc-600 text-[10px] md:text-xs font-bold uppercase tracking-wider">
              {article.source}
            </span>
            <span className="text-zinc-700 text-xs hidden sm:inline">•</span>
            <span className="text-zinc-600 text-[10px] md:text-xs hidden sm:inline">{timeAgo}</span>
          </div>

          {/* Headline */}
          <h3 className="text-base md:text-xl font-black text-white mb-2 md:mb-3 leading-tight group-hover:text-[#00ff4e] transition-colors">
            {article.headline}
          </h3>

          {/* Summary */}
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed mb-3 md:mb-4 line-clamp-2">
            {article.summary}
          </p>

          {/* Ticker Tags */}
          {article.tickers && article.tickers.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[8px] md:text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                Mentioned:
              </span>
              {article.tickers.map((ticker, idx) => (
                <span 
                  key={idx}
                  className="text-[9px] md:text-[10px] font-black bg-zinc-900 text-[#00ff4e] px-2 py-1 rounded border border-zinc-800 uppercase tracking-wider"
                >
                  ${ticker}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Arrow indicator - hidden on mobile */}
        <div className="hidden md:flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[#00ff4e] text-2xl">→</span>
        </div>
      </div>
    </motion.div>
  );
}