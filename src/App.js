import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from 'react-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import AuthModal from './AuthModal';
import ProfileSettings from './ProfileSettings';
import Tooltip from './tooltip';
import CountUp from './CountUp';
import SkeletonCard from './SkeletonCard';
import WatchlistModal from './WatchlistModal';
import { createWatchlist, getUserWatchlists, getPublicWatchlists, addStockToWatchlist, removeStockFromWatchlist, updateWatchlist, deleteWatchlist } from './watchlistService';
import { followUser, unfollowUser, isFollowing, getFollowers, getFollowing, searchUsers } from './followService';
import { Users, Trash2, Plus, MessageCircle, Search, Target, TrendingUp, BarChart3, Lightbulb, AlertTriangle, Clock, Link2, Unlink, ChevronDown, Building2, Wallet, RefreshCw } from 'lucide-react';
import UserProfileModal from './UserProfileModal';
import PlaidLink from './PlaidLink';
import StockChatModal from './StockChatModal';



console.log('FINNHUB_KEY:', process.env.REACT_APP_FINNHUB_KEY);
console.log('GEN_AI_KEY:', process.env.REACT_APP_GEN_AI_KEY);

// --- CONFIGURATION ---
const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_KEY; 
const GEN_AI_KEY = process.env.REACT_APP_GEN_AI_KEY;
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const ALPHA_VANTAGE_KEY = process.env.REACT_APP_ALPHA_VANTAGE_KEY;
const TWELVE_DATA_KEY = process.env.REACT_APP_TWELVE_DATA_KEY;


const isMobile = () => window.innerWidth < 768;




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
  "Institutional Investor", "Morning Brew",
  "GuruFocus", "Simply Wall St", "Alpha Spread", "Stocktwits", "Trade Ideas",
  "Fintel", "Ortex", "Unusual Whales", "Market Chameleon", "Bamsec",
  "AlphaSense", "Sentieo", "S&P Global", "FactSet", "Capital IQ",
  "Pitchbook", "CB Insights", "Crunchbase", "BioPharma Dive", "FiercePharma",
  "MedCity News", "Endpoints News", "STAT News", "Clinical Trials Arena",
  "FDA.gov", "ClinicalTrials.gov", "BioSpace", "GlobeNewswire", "PR Newswire",
  "Business Wire", "EIN Presswire", "Shareholder.com", "Insider Monkey",
  "13F filings", "Form 4 filings", "8-K filings", "Hedge Fund Tracker"
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
  if (!closePrices || closePrices.length < 5) return 40; // Need at least 5 days
  
  // Calculate daily returns
  const returns = [];
  for (let i = 1; i < closePrices.length; i++) {
    const dailyReturn = Math.log(closePrices[i] / closePrices[i - 1]);
    
    // Filter out extreme outliers (likely bad data)
    // Daily moves over 50% are extremely rare and usually data errors
    if (Math.abs(dailyReturn) < 0.5) {
      returns.push(dailyReturn);
    }
  }
  
  if (returns.length < 5) return 40; // Not enough valid data
  
  // Calculate mean return
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  
  // Calculate variance
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  
  // Standard deviation
  const stdDev = Math.sqrt(variance);
  
  // Annualize (multiply by sqrt of trading days per year)
  const annualizedVolatility = stdDev * Math.sqrt(252) * 100;
  
console.log(`Raw volatility: ${annualizedVolatility.toFixed(2)}%, Valid returns: ${returns.length}/${closePrices.length - 1}`);

// Cap between 10-120% (allow for extreme but valid volatility in penny stocks/biotech)
return Math.min(Math.max(annualizedVolatility, 10), 120);
};

// Calculate Signal Strength based on quantifiable factors
const calculateSignalStrength = (newsData, priceData, currentPrice, volatility, aiCatalystScore, volumeRatio = 1) => {
  let score = 0;

  
  
  // 1. NEWS RECENCY (25 points max) - More generous
  if (newsData && newsData.length > 0) {
    const mostRecentNews = newsData[0];
    const daysSinceNews = (Date.now() / 1000 - mostRecentNews.datetime) / (24 * 60 * 60);
    
    if (daysSinceNews <= 3) {
      score += 25; // Very recent (within 3 days)
    } else if (daysSinceNews <= 7) {
      score += 20; // Recent (within a week)
    } else if (daysSinceNews <= 14) {
      score += 15; // Somewhat recent
    } else if (daysSinceNews <= 30) {
      score += 10; // Within a month
    }
  }
  
  // 2. NEWS VOLUME (15 points max) - Lower thresholds
  const newsCount = newsData?.length || 0;
  if (newsCount >= 8) {
    score += 15;
  } else if (newsCount >= 5) {
    score += 12;
  } else if (newsCount >= 3) {
    score += 9;
  } else if (newsCount >= 1) {
    score += 6; // At least some news
  }
  
  // 3. PRICE MOMENTUM (20 points max)
  if (priceData && priceData.length >= 5) {
    const fiveDaysAgo = priceData[priceData.length - 6];
    const priceChange = ((currentPrice - fiveDaysAgo) / fiveDaysAgo) * 100;
    
    const absMomentum = Math.abs(priceChange);
    if (absMomentum >= 10) {
      score += 20; // Strong momentum
    } else if (absMomentum >= 5) {
      score += 15; // Good momentum
    } else if (absMomentum >= 2) {
      score += 10; // Moderate momentum
    } else if (absMomentum >= 0.5) {
      score += 5; // Some momentum
    }
  }
  
  // 4. VOLATILITY FACTOR (15 points max)
  const vol = parseFloat(volatility);
  if (vol >= 60) {
    score += 15; // High volatility
  } else if (vol >= 45) {
    score += 13; // Moderate-high
  } else if (vol >= 30) {
    score += 10; // Moderate
  } else if (vol >= 20) {
    score += 7; // Low-moderate
  } else if (vol >= 10) {
    score += 4; // Low but present
  }
  
  // 5. AI CATALYST ASSESSMENT (25 points max) - Increased weight
  // This is the most important factor since AI evaluates all qualitative aspects
  const normalizedAI = Math.min(Math.max(aiCatalystScore, 0), 100);
  score += (normalizedAI / 100) * 25;
  
  // BONUS: If we have both news AND volatility, add synergy bonus
  if (newsCount >= 1 && vol >= 30) {
    score += 5;
  }
  
  // Ensure score is between 0-100
  return Math.min(Math.max(Math.round(score), 15), 95);

    // 6. VOLUME SURGE FACTOR (10 points max) - NEW
  if (volumeRatio >= 3) {
    score += 10; // Major volume spike
  } else if (volumeRatio >= 2) {
    score += 7; // Strong volume
  } else if (volumeRatio >= 1.5) {
    score += 4; // Elevated volume
  }
  
  // BONUS: If we have both news AND elevated volume, add synergy bonus
  if (newsCount >= 1 && volumeRatio >= 2) {
    score += 5; // News + volume = stronger signal
  }
  
  // Ensure score is between 0-100
  return Math.min(Math.max(Math.round(score), 15), 95);
};

// Brokerage logo URLs - using direct URLs
const BROKERAGE_LOGOS = {
  'robinhood': 'https://cdn.brandfetch.io/robinhood.com/w/400/h/400/logo',
  'fidelity': 'https://cdn.brandfetch.io/fidelity.com/w/400/h/400/logo',
  'charles schwab': 'https://cdn.brandfetch.io/schwab.com/w/400/h/400/logo',
  'schwab': 'https://cdn.brandfetch.io/schwab.com/w/400/h/400/logo',
  'td ameritrade': 'https://cdn.brandfetch.io/tdameritrade.com/w/400/h/400/logo',
  'e*trade': 'https://cdn.brandfetch.io/etrade.com/w/400/h/400/logo',
  'etrade': 'https://cdn.brandfetch.io/etrade.com/w/400/h/400/logo',
  'webull': 'https://cdn.brandfetch.io/webull.com/w/400/h/400/logo',
  'vanguard': 'https://cdn.brandfetch.io/vanguard.com/w/400/h/400/logo',
  'interactive brokers': 'https://cdn.brandfetch.io/interactivebrokers.com/w/400/h/400/logo',
  'coinbase': 'https://cdn.brandfetch.io/coinbase.com/w/400/h/400/logo',
  'merrill': 'https://cdn.brandfetch.io/ml.com/w/400/h/400/logo',
  'morgan stanley': 'https://cdn.brandfetch.io/morganstanley.com/w/400/h/400/logo',
  'ally': 'https://cdn.brandfetch.io/ally.com/w/400/h/400/logo',
  'sofi': 'https://cdn.brandfetch.io/sofi.com/w/400/h/400/logo',
  'public': 'https://cdn.brandfetch.io/public.com/w/400/h/400/logo',
  'wealthfront': 'https://cdn.brandfetch.io/wealthfront.com/w/400/h/400/logo',
  'betterment': 'https://cdn.brandfetch.io/betterment.com/w/400/h/400/logo',
  'acorns': 'https://cdn.brandfetch.io/acorns.com/w/400/h/400/logo',
  'm1 finance': 'https://cdn.brandfetch.io/m1finance.com/w/400/h/400/logo',
  'm1': 'https://cdn.brandfetch.io/m1finance.com/w/400/h/400/logo',
};

// Fallback emoji icons
const BROKERAGE_ICONS = {
  'robinhood': '🟢',
  'fidelity': '🔵',
  'charles schwab': '🔷',
  'schwab': '🔷',
  'td ameritrade': '🟩',
  'e*trade': '🟣',
  'etrade': '🟣',
  'webull': '🟠',
  'vanguard': '🔴',
  'interactive brokers': '⬛',
  'coinbase': '🪙',
  'merrill': '🔵',
  'morgan stanley': '💎',
  'default': '📊'
};

const getBrokerageLogo = (name) => {
  const lowerName = name?.toLowerCase() || '';
  for (const [key, url] of Object.entries(BROKERAGE_LOGOS)) {
    if (lowerName.includes(key)) {
      return url;
    }
  }
  return null;
};

const getBrokerageIcon = (name) => {
  const lowerName = name?.toLowerCase() || '';
  for (const [key, icon] of Object.entries(BROKERAGE_ICONS)) {
    if (lowerName.includes(key)) {
      return icon;
    }
  }
  return BROKERAGE_ICONS.default;
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

// Separate Clock component to isolate re-renders
function CurrentTime() {  // Changed name from Clock to CurrentTime
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <>
      <p className="text-[#00ff4e] font-black tabular-nums text-lg md:text-xl tracking-tighter">
        {time.toLocaleTimeString([], { hour12: true })}
      </p>
      <p className="text-zinc-500 text-[8px] md:text-[10px] font-black uppercase tracking-wider md:tracking-widest">
        {time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
      </p>
    </>
  );
}

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
  const [watchlists, setWatchlists] = useState([]);
  const [publicWatchlists, setPublicWatchlists] = useState([]);
  const [selectedWatchlist, setSelectedWatchlist] = useState(null);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [editingWatchlist, setEditingWatchlist] = useState(null);
  const [showAddToListMenu, setShowAddToListMenu] = useState(null); // stockSymbol when menu is open
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [followingUsers, setFollowingUsers] = useState(new Set());
  const [volatilityCache, setVolatilityCache] = useState({});
  const [profileCache, setProfileCache] = useState({});
const [connectedBrokerages, setConnectedBrokerages] = useState([]); // Array of {id, name, institutionId, lastUpdated}
const [selectedBrokerage, setSelectedBrokerage] = useState(null); // Currently selected brokerage ID
const [brokeragePositions, setBrokeragePositions] = useState({}); // {brokerageId: positions[]}
const [loadingPositions, setLoadingPositions] = useState(false);
const [showBrokerageSelector, setShowBrokerageSelector] = useState(false);
const [disconnectingBrokerage, setDisconnectingBrokerage] = useState(null);
const [showPlaidConsent, setShowPlaidConsent] = useState(false);
const [trendingStocks, setTrendingStocks] = useState([]);
const [trendingInterval, setTrendingInterval] = useState('weekly');
const [loadingTrending, setLoadingTrending] = useState(false);
const [loadingDiscover, setLoadingDiscover] = useState(false);
const [hoveringPositionSymbol, setHoveringPositionSymbol] = useState(null);
const watchlistIntervalRef = useRef(null);
const [showStockChat, setShowStockChat] = useState(null);
const [recentlyScanned, setRecentlyScanned] = useState(() => {
  // Load from localStorage on mount
  const saved = localStorage.getItem('recentlyScanned');
  return saved ? new Set(JSON.parse(saved)) : new Set();
});
const [showSearch, setShowSearch] = useState(false);
const [stockSearchResults, setStockSearchResults] = useState([]);
const [isManualResult, setIsManualResult] = useState(false);
const [scanProgress, setScanProgress] = useState(0);




// Computed: current positions based on selected brokerage
const positions = useMemo(() => {
  if (!selectedBrokerage) return [];
  return brokeragePositions[selectedBrokerage] || [];
}, [selectedBrokerage, brokeragePositions]);

// Computed: all positions across all brokerages (for portfolio summary)
const allPositions = useMemo(() => {
  return Object.values(brokeragePositions).flat();
}, [brokeragePositions]);

// Check if any brokerage is connected
const brokerageConnected = connectedBrokerages.length > 0;

const flattenedWatchlist = useMemo(() => {
  return watchlists.flatMap(l => l.stocks);
}, [watchlists]);
  

const searchTimeoutRef = useRef(null);
  

const addStockToList = async (stock, listId) => {
  if (!user) {
    alert('Please sign in to add stocks to lists');
    return;
  }
  
  try {
    // Add to watchlist first
    await addStockToWatchlist(listId, stock);
    
    // Track this stock being watched in Firestore
    try {
      const watchRef = doc(db, 'trending', stock.symbol);
      const watchDoc = await getDoc(watchRef);
      
      const now = new Date();
      
      if (watchDoc.exists()) {
        const data = watchDoc.data();
        await setDoc(watchRef, {
          symbol: stock.symbol,
          name: stock.name,
          totalCount: (data.totalCount || 0) + 1,
          dailyAdds: [...(data.dailyAdds || []), now],
          weeklyAdds: [...(data.weeklyAdds || []), now],
          monthlyAdds: [...(data.monthlyAdds || []), now],
          lastUpdated: now
        }, { merge: true });
      } else {
        await setDoc(watchRef, {
          symbol: stock.symbol,
          name: stock.name,
          totalCount: 1,
          dailyAdds: [now],
          weeklyAdds: [now],
          monthlyAdds: [now],
          lastUpdated: now
        });
      }
    } catch (trendingError) {
      // Log trending error but don't fail the whole operation
      console.log('Trending update failed (non-critical):', trendingError.message);
    }
    
    // Refresh lists - this updates the UI
    const lists = await getUserWatchlists(user.uid);
    setWatchlists(lists);
    setShowAddToListMenu(null);
    
    // Optional: Show success message
    console.log(`✓ Added ${stock.symbol} to watchlist`);
    
  } catch (error) {
    console.error('Error adding stock:', error);
    alert('Failed to add stock to watchlist. Please try again.');
  }
};

const updateList = useCallback(async (list) => {
  // Safety check - return empty array if list is undefined or not an array
  if (!list || !Array.isArray(list)) {
    return [];
  }
  
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
}, [FINNHUB_KEY]);

// User-specific seeded shuffle for legal compliance
const hashCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const fetchTrendingStocks = useCallback(async (interval = 'weekly') => {
  setLoadingTrending(true);
  try {
    const { collection, query, getDocs } = await import('firebase/firestore');
    const trendingRef = collection(db, 'trending');
    const snapshot = await getDocs(trendingRef);
    
    const now = new Date();
    let cutoffDate;
    
    // Determine cutoff date based on interval
    if (interval === 'daily') {
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (interval === 'weekly') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else { // monthly
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    

    const trending = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      let adds = [];
      
      // Filter adds based on interval
      if (interval === 'daily' && data.dailyAdds) {
        adds = data.dailyAdds.filter(add => {
          const addDate = add.toDate ? add.toDate() : new Date(add);
          return addDate >= cutoffDate;
        });
      } else if (interval === 'weekly' && data.weeklyAdds) {
        adds = data.weeklyAdds.filter(add => {
          const addDate = add.toDate ? add.toDate() : new Date(add);
          return addDate >= cutoffDate;
        });
      } else if (interval === 'monthly' && data.monthlyAdds) {
        adds = data.monthlyAdds.filter(add => {
          const addDate = add.toDate ? add.toDate() : new Date(add);
          return addDate >= cutoffDate;
        });
      }
      
      if (adds.length > 0) {
        trending.push({
          symbol: data.symbol,
          name: data.name,
          watchCount: adds.length,
          totalWatches: data.totalCount || 0
        });
      }
    });


    
    // Sort by watch count
    trending.sort((a, b) => b.watchCount - a.watchCount);
    
    // Take top 20
    setTrendingStocks(trending.slice(0, 20));
  } catch (error) {
    console.error('Error fetching trending stocks:', error);
  } finally {
    setLoadingTrending(false);
  }
}, []);

// Clear recently scanned stocks every 24 hours
useEffect(() => {
  const timer = setInterval(() => {
    setRecentlyScanned(new Set());
    localStorage.removeItem('recentlyScanned');
  }, 24 * 60 * 60 * 1000); // 24 hours
  
  return () => clearInterval(timer);
}, []);

// Persist recently scanned to localStorage
useEffect(() => {
  if (recentlyScanned.size > 0) {
    localStorage.setItem('recentlyScanned', JSON.stringify([...recentlyScanned]));
  }
}, [recentlyScanned]);

// Fetch trending stocks when tab changes or interval changes
useEffect(() => {
  if (activeTab === 'TRENDING') {
    fetchTrendingStocks(trendingInterval);
  }
}, [activeTab, trendingInterval, fetchTrendingStocks]);

// Load public watchlists for DISCOVER tab
useEffect(() => {
  if (activeTab === 'DISCOVER') {
    const loadPublicLists = async () => {
      setLoadingDiscover(true);
      try {
        const lists = await getPublicWatchlists();
        setPublicWatchlists(lists);
      } catch (error) {
        console.error('Error loading public watchlists:', error);
      } finally {
        setLoadingDiscover(false);
      }
    };
    
    loadPublicLists();
  }
}, [activeTab]);

const removeStockFromList = async (listId, stockSymbol) => {
  try {
    console.log('Removing:', stockSymbol, 'from list:', listId);
    await removeStockFromWatchlist(listId, stockSymbol);
    // Refresh lists
    const lists = await getUserWatchlists(user.uid);
    console.log('Updated watchlists after remove:', lists);
    console.log('Flattened stocks:', lists.flatMap(l => l.stocks).map(s => s.symbol));
    setWatchlists(lists);
  } catch (error) {
    console.error('Error removing stock:', error);
  }
};

const handleCreateWatchlist = async ({ name, description, isPublic }) => {
  if (!user) return;
  
  try {
    await createWatchlist(user.uid, name, description, isPublic);
    // Refresh lists
    const lists = await getUserWatchlists(user.uid);
    setWatchlists(lists);
  } catch (error) {
    console.error('Error creating watchlist:', error);
  }
};

const handleUpdateWatchlist = async ({ name, description, isPublic }) => {
  if (!editingWatchlist) return;
  
  try {
    await updateWatchlist(editingWatchlist.id, { name, description, isPublic });
    // Refresh lists
    const lists = await getUserWatchlists(user.uid);
    setWatchlists(lists);
    setEditingWatchlist(null);
  } catch (error) {
    console.error('Error updating watchlist:', error);
  }
};

const handleDeleteWatchlist = async (listId) => {
  if (!window.confirm('Are you sure you want to delete this watchlist?')) return;
  
  try {
    await deleteWatchlist(listId);
    // Refresh lists
    const lists = await getUserWatchlists(user.uid);
    setWatchlists(lists);
    if (selectedWatchlist?.id === listId) {
      setSelectedWatchlist(null);
    }
  } catch (error) {
    console.error('Error deleting watchlist:', error);
  }
};

const handleFollowUser = async (userId) => {
  if (!user) {
    alert('Please sign in to follow users');
    return;
  }
  
  try {
    await followUser(user.uid, userId);
    setFollowingUsers(prev => new Set([...prev, userId]));
    
    // Update current user's profile counts
    setUserProfile(prev => ({
      ...prev,
      followingCount: (prev.followingCount || 0) + 1
    }));
    
    // Update viewed user's follower count if modal is open
    if (viewingUser && viewingUser.id === userId) {
      setViewingUser(prev => ({
        ...prev,
        followerCount: (prev.followerCount || 0) + 1
      }));
    }
  } catch (error) {
    console.error('Error following user:', error);
  }
};

const handleUnfollowUser = async (userId) => {
  try {
    await unfollowUser(user.uid, userId);
    setFollowingUsers(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
    
    // Update current user's profile counts
    setUserProfile(prev => ({
      ...prev,
      followingCount: Math.max((prev.followingCount || 0) - 1, 0)
    }));
    
    // Update viewed user's follower count if modal is open
    if (viewingUser && viewingUser.id === userId) {
      setViewingUser(prev => ({
        ...prev,
        followerCount: Math.max((prev.followerCount || 0) - 1, 0)
      }));
    }
  } catch (error) {
    console.error('Error unfollowing user:', error);
  }
};

const handleSearchUsers = async (term) => {
  setUserSearchTerm(term);
  if (term.trim().length < 2) {
    setSearchResults([]);
    return;
  }
  
  try {
    const results = await searchUsers(term);
    setSearchResults(results);
  } catch (error) {
    console.error('Error searching users:', error);
  }
};

// Fetch positions for a specific brokerage
const fetchPositionsForBrokerage = useCallback(async (brokerageId) => {
  if (!user || !brokerageId) return null;
  
  try {
    const idToken = await auth.currentUser.getIdToken();
    
    // Use POST method to send brokerageId
    const response = await fetch('https://us-central1-jckrbbt-869de.cloudfunctions.net/getHoldings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ brokerageId })
    });
    
    const result = await response.json();
    
    console.log('Holdings response for', brokerageId, ':', result);
    
    if (result.error) {
      console.error(`Error fetching positions for ${brokerageId}:`, result.error);
      return null;
    }
    
    if (!result.holdings || result.holdings.length === 0) {
      console.log('No holdings returned for', brokerageId);
      return [];
    }
    
    // Transform Plaid data to our format
    const holdingsData = result.holdings.map(holding => {
      const security = result.securities?.find(s => s.security_id === holding.security_id);
      return {
        symbol: security?.ticker_symbol || 'N/A',
        name: security?.name || 'Unknown',
        quantity: holding.quantity,
        price: holding.institution_price,
        value: holding.institution_value,
        costBasis: holding.cost_basis,
        gain: holding.institution_value - holding.cost_basis,
        gainPercent: ((holding.institution_value - holding.cost_basis) / holding.cost_basis) * 100,
      };
    });
    
    return holdingsData;
  } catch (error) {
    console.error(`Error fetching positions for ${brokerageId}:`, error);
    return null;
  }
}, [user]);

// Fetch all positions for all connected brokerages
const fetchAllPositions = useCallback(async () => {
  if (!user || connectedBrokerages.length === 0) return;
  
  setLoadingPositions(true);
  try {
    const positionsMap = {};
    
    // Fetch positions for each brokerage in parallel
    await Promise.all(
      connectedBrokerages.map(async (brokerage) => {
        console.log('Fetching for brokerage:', brokerage.id);
        const positions = await fetchPositionsForBrokerage(brokerage.id);
        console.log('Received positions for', brokerage.id, '- count:', positions?.length);
        
        if (positions) {
          positionsMap[brokerage.id] = positions;
        }
      })
    );
    
    // Log AFTER the loop completes
    console.log('All positions fetched:', positionsMap);
    console.log('Connected brokerages:', connectedBrokerages);
    console.log('Selected brokerage:', selectedBrokerage);
    
    setBrokeragePositions(positionsMap);
    
    // Auto-select first brokerage if none selected
    if (!selectedBrokerage && connectedBrokerages.length > 0) {
      setSelectedBrokerage(connectedBrokerages[0].id);
    }
  } catch (error) {
    console.error('Error fetching all positions:', error);
  } finally {
    setLoadingPositions(false);
  }
}, [user, connectedBrokerages, fetchPositionsForBrokerage, selectedBrokerage]);

// Handle new brokerage connection
const handlePlaidSuccess = useCallback(async (metadata) => {
  console.log('Plaid connection successful!', metadata);
  
  // Add new brokerage to the list
  const newBrokerage = {
    id: metadata.item_id || `brokerage_${Date.now()}`,
    name: metadata.institution?.name || 'Connected Account',
    institutionId: metadata.institution?.institution_id,
    lastUpdated: new Date().toISOString()
  };
  
  // Update local state
  setConnectedBrokerages(prev => {
    // Check if already exists
    if (prev.some(b => b.id === newBrokerage.id)) {
      return prev;
    }
    return [...prev, newBrokerage];
  });
  
  // Save to Firestore
  if (user) {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        connectedBrokerages: arrayUnion(newBrokerage)
      });
    } catch (error) {
      console.error('Error saving brokerage to Firestore:', error);
    }
  }
  
  // Select the new brokerage
  setSelectedBrokerage(newBrokerage.id);
  
  // Fetch positions for the new brokerage
  const positions = await fetchPositionsForBrokerage(newBrokerage.id);
  if (positions) {
    setBrokeragePositions(prev => ({
      ...prev,
      [newBrokerage.id]: positions
    }));
  }
}, [user, fetchPositionsForBrokerage]);

// Disconnect a brokerage
const handleDisconnectBrokerage = useCallback(async (brokerageId) => {
  if (!user || !brokerageId) return;
  
  if (!window.confirm('Are you sure you want to disconnect this brokerage account?')) {
    return;
  }
  
  setDisconnectingBrokerage(brokerageId);
  
  try {
    const idToken = await auth.currentUser.getIdToken();
    
    // Call backend to remove Plaid item
    const response = await fetch('https://us-central1-jckrbbt-869de.cloudfunctions.net/disconnectBrokerage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ brokerageId })
    });
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    // Remove from local state
    const brokerageToRemove = connectedBrokerages.find(b => b.id === brokerageId);
    setConnectedBrokerages(prev => prev.filter(b => b.id !== brokerageId));
    
    // Remove positions
    setBrokeragePositions(prev => {
      const newPositions = { ...prev };
      delete newPositions[brokerageId];
      return newPositions;
    });
    
    // Update Firestore
    if (brokerageToRemove) {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        connectedBrokerages: arrayRemove(brokerageToRemove)
      });
    }
    
    // Select another brokerage if the disconnected one was selected
    if (selectedBrokerage === brokerageId) {
      const remaining = connectedBrokerages.filter(b => b.id !== brokerageId);
      setSelectedBrokerage(remaining.length > 0 ? remaining[0].id : null);
    }
    
    console.log('Brokerage disconnected successfully');
  } catch (error) {
    console.error('Error disconnecting brokerage:', error);
    alert('Failed to disconnect brokerage. Please try again.');
  } finally {
    setDisconnectingBrokerage(null);
  }
}, [user, connectedBrokerages, selectedBrokerage]);

const handlePlaidError = useCallback((error) => {
  console.error('Plaid error details:', error);
}, []);

// Fetch positions when brokerages change
useEffect(() => {
  if (connectedBrokerages.length > 0 && user) {
    fetchAllPositions();
  }
}, [connectedBrokerages, user, fetchAllPositions]);

const handleViewUserProfile = async (userId) => {
  console.log('View profile clicked:', userId);
  
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    console.log('User doc exists:', userDoc.exists());
    
    if (!userDoc.exists()) {
      alert('User not found');
      return;
    }
    
    const userData = { id: userId, ...userDoc.data() };
    
    // Load their public watchlists
    const lists = await getUserWatchlists(userId);
    const publicLists = lists.filter(list => list.isPublic);
    
    console.log('Public lists:', publicLists);
    
    setViewingUser({ ...userData, publicLists });
    setShowUserProfileModal(true);
  } catch (error) {
    console.error('Error loading user profile:', error);
    alert('Error loading profile: ' + error.message);
  }
};

const handleLogout = async () => {
  try {
    await signOut(auth);
    setWatchlist([]);
    setConnectedBrokerages([]);
setBrokeragePositions({});
setSelectedBrokerage(null);
  } catch (error) {
    console.error("Logout error:", error);
  }
};

const [watchlist, setWatchlist] = useState(() => {
  const saved = localStorage.getItem("JACKRABBIT_WATCHLIST");
  return saved ? JSON.parse(saved) : [];
});


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
        // Load user's watchlists
        const lists = await getUserWatchlists(currentUser.uid);
        setWatchlists(lists);
        setUserProfile({
          username: data.username || null,
          profilePicUrl: data.profilePicUrl || null,
          followerCount: data.followerCount || 0,
          followingCount: data.followingCount || 0
        });
        
        // Load following status
        const following = await getFollowing(currentUser.uid);
        setFollowingUsers(new Set(following.map(u => u.id)));
        
// Load connected brokerages
if (data.connectedBrokerages && data.connectedBrokerages.length > 0) {
  setConnectedBrokerages(data.connectedBrokerages);
  setSelectedBrokerage(data.connectedBrokerages[0].id);
} else if (data.brokerageConnected && data.plaidItemId) {
  // MIGRATE: Old single-brokerage format to new multi-brokerage format
  console.log('Migrating legacy brokerage to new format...');
  
  const legacyBrokerage = {
    id: data.plaidItemId,
    name: 'Robinhood', // Or you can try to detect from plaidItemId
    institutionId: null,
    lastUpdated: new Date().toISOString()
  };
  
  // Update Firestore with new format
  await setDoc(docRef, {
    connectedBrokerages: [legacyBrokerage]
  }, { merge: true });
  
  setConnectedBrokerages([legacyBrokerage]);
  setSelectedBrokerage(legacyBrokerage.id);
  
  console.log('Migration complete:', legacyBrokerage);
}
        
      } else {
        // Initialize counts for new users
        await setDoc(doc(db, 'users', currentUser.uid), {
          followerCount: 0,
          followingCount: 0,
          connectedBrokerages: []
        }, { merge: true });
        
        setUserProfile({
          username: null,
          profilePicUrl: null,
          followerCount: 0,
          followingCount: 0
        });
      }

    } else {
      // Not logged in - clear all user data
      setWatchlists([]);
      setUserProfile(null);
      setConnectedBrokerages([]);
      setBrokeragePositions({});
      setSelectedBrokerage(null);
    }
  });

  return () => unsubscribe();
}, []);  // <-- Empty dependency array

// Migrate old accounts to have follower/following counts
useEffect(() => {
  if (!user || authLoading) return;
  
  const migrateAccount = async () => {
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        // If counts don't exist, initialize them
        if (data.followerCount === undefined || data.followingCount === undefined) {
          console.log('Migrating account to add follower counts');
          await setDoc(docRef, {
            followerCount: 0,
            followingCount: 0
          }, { merge: true });
          
          // Reload profile
          setUserProfile(prev => ({
            ...prev,
            followerCount: 0,
            followingCount: 0
          }));
        }
      }
    } catch (error) {
      console.error('Error migrating account:', error);
    }
  };
  
  migrateAccount();
}, [user, authLoading]);

// Listen for create list modal trigger
useEffect(() => {
  const handleOpenModal = () => {
    setShowWatchlistModal(true);
  };
  
  window.addEventListener('openWatchlistModal', handleOpenModal);
  return () => window.removeEventListener('openWatchlistModal', handleOpenModal);
}, []);

// Close search on scroll and clear input
useEffect(() => {
  const handleScroll = () => {
    if (showSearch) {
      setShowSearch(false);
    }
  };
  
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, [showSearch]);

// Clear search when closing
useEffect(() => {
  if (!showSearch) {
    setUserSearchTerm('');
    setSearchResults([]);
  }
}, [showSearch]);

// Close selected watchlist when switching tabs
useEffect(() => {
  setSelectedWatchlist(null);
}, [activeTab]);

// Close add-to-list menu on scroll (for positions and dashboard)
useEffect(() => {
  if (!showAddToListMenu) return;
  
  const handleScroll = () => {
    setShowAddToListMenu(null);
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, [showAddToListMenu]);

// --- MARKET HOURS & CLOCK ---
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      
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

// --- LIVE PRICE UPDATES (Every 60 Seconds) ---
useEffect(() => {
  // Allow updates even when market is closed (for after-hours tracking)
  if (stocks.length === 0 && watchlists.length === 0) return;

  const liveTimer = setInterval(async () => {
    // Clear the stock cache so new prices get picked up
    stockCache.current = {};
    
    if (stocks.length > 0) {
      const updated = await updateList(stocks);
      setStocks(updated);
    }
    
    if (watchlists.length > 0) {
      const updatedLists = await Promise.all(
        watchlists.map(async (list) => ({
          ...list,
          stocks: await updateList(list.stocks)
        }))
      );
      setWatchlists(updatedLists);
    }
  }, 60000); // Every 60 seconds

  return () => clearInterval(liveTimer);
}, [updateList, stocks, watchlists]); // Removed isMarketOpen check

// --- NEWS ARTICLE DISCOVERY ---
const discoverNewsArticles = useCallback(async (sector, marketCap, priceLimit) => {
  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
  const currentYear = new Date().getFullYear();
  const twoWeeksAgo = new Date(Date.now() - 14*24*60*60*1000).toISOString().split('T')[0];
  
  const newsDiscoveryPrompt = `
TODAY'S DATE: ${currentMonthName} ${new Date().getDate()}, ${currentYear}

You are a stock market researcher. Your task: Find 200+ US stock tickers mentioned in recent financial news.

CRITICAL PRICE REQUIREMENT: Focus on stocks trading UNDER $${priceLimit} per share.
- Prioritize small/mid-cap companies
- Include biotech, pharma, regional banks, smaller tech companies
- AVOID mega-caps like AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA unless under $${priceLimit}

EXECUTE THESE 8 SEARCHES (run ALL of them, not just a few):

1. Search: "FDA approval" OR "PDUFA date" OR "clinical trial" (after:${twoWeeksAgo})
   → Find 25-30 biotech/pharma tickers

2. Search: "earnings beat" OR "revenue surprise" (after:${twoWeeksAgo})
   → Find 25-30 tickers with earnings news

3. Search: "analyst upgrade" OR "price target raised" (after:${twoWeeksAgo})
   → Find 25-30 upgraded stocks

4. Search: "insider buying" OR "Form 4 filed" (after:${twoWeeksAgo})
   → Find 20-25 tickers with insider activity

5. Search: "merger" OR "acquisition announced" (after:${twoWeeksAgo})
   → Find 15-20 M&A related stocks

6. Search: "government contract" OR "partnership announced" (after:${twoWeeksAgo})
   → Find 15-20 stocks with contracts/partnerships

7. Search: "dividend increase" OR "buyback announced" (after:${twoWeeksAgo})
   → Find 15-20 stocks with shareholder returns

8. Search: "product launch" OR "new drug approved" (after:${twoWeeksAgo})
   → Find 15-20 stocks with new products

SEARCH THESE SOURCES:
Bloomberg, Reuters, WSJ, Barron's, CNBC, Seeking Alpha, Benzinga, MarketWatch, BioPharma Dive, FiercePharma, GlobeNewswire, PR Newswire, Business Wire, SEC.gov, OpenInsider

${sector !== 'all' ? `SECTOR REQUIREMENT: ONLY include ${sector.toUpperCase()} sector stocks` : ''}
${marketCap !== 'all' ? `PREFER ${marketCap}-cap companies but include all sizes` : ''}

VALIDATION RULES:
✓ 2-5 letter ticker symbols only
✓ US-traded stocks (NYSE/NASDAQ/AMEX)
✓ Actual companies, not indexes

✗ REJECT these:
- News sources: Bloomberg, Reuters, CNBC, WSJ, NYT
- Indexes: SPY, QQQ, DIA, SPX, NDX
- Generic: AI, ML, CEO, CFO, FDA, SEC, IPO, ETF, ESG
- Countries: US, UK, EU, CN
- Months: JAN, FEB, MAR, etc.

CRITICAL REQUIREMENTS:
1. Run ALL 8 searches listed above
2. From each search, extract 15-30 tickers
3. Combine ALL results into one list
4. Return 200+ total unique tickers

OUTPUT FORMAT (comma-separated, no line breaks):
AAPL, MSFT, NVDA, TSLA, MRNA, PFE, JNJ, AMGN, LLY, GOOG, META, AMD, INTC, CSCO, ORCL, CRM, ADBE, QCOM, TXN, AVGO, NFLX, DIS, CMCSA, T, VZ, ... (continue until 200+ tickers)

DO NOT STOP at 28 tickers. You MUST return at least 200 tickers.
If a search returns fewer results, run additional related searches.
Keep searching until you have 200+ unique tickers total.
PRICE FILTER: Only include stocks likely trading under $${priceLimit}/share based on market cap and company size.
`;

  try {
    console.log('🔍 Stage 1: Searching for stocks in recent news...');
    
    const newsRes = await aiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: newsDiscoveryPrompt }] }],
      tools: [{ googleSearch: {} }]
    });
    
    const responseText = await newsRes.response.text();
    console.log('Raw AI response (first 500 chars):', responseText.substring(0, 500));
    
    // Extract tickers directly (2-5 capital letters)
    const tickerRegex = /\b[A-Z]{2,5}\b/g;
    const foundTickers = responseText.match(tickerRegex) || [];
    
    // Deduplicate
    const uniqueTickers = [...new Set(foundTickers)];
    
    console.log(`✓ Found ${uniqueTickers.length} tickers from news search`);
    console.log('Sample tickers:', uniqueTickers.slice(0, 20));
    
    return uniqueTickers;
    
  } catch (error) {
    console.error('Error in news discovery:', error);
    return [];
  }
}, [aiModel]);

  // --- NEURAL SCANNER LOGIC ---
const runScanner = useCallback(async (tickerToSearch = null) => {
  const isManual = Boolean(tickerToSearch);
  setIsManualResult(isManual);
  setLoading(true);
  setScanProgress(0);

  const rejectedTickers = new Set();
  const displayedTickers = new Set(); 
  const localStocks = [];
  
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
  const fDate = now.toISOString().split('T')[0];     
  const yDate = threeDaysAgo.toISOString().split('T')[0];
  const currentMonthName = now.toLocaleString('default', { month: 'long' }); 
  const currentYear = now.getFullYear();

let attempts = 0;

try {
  const targetGoal = isManual ? 1 : 5;

  while (localStocks.length < targetGoal && attempts < 3) {
    attempts++;
    let tickersToProcess = [];

    if (isManual) {
      setScanStatus(`LOCKING ON: ${tickerToSearch.toUpperCase()}...`);
      tickersToProcess = [tickerToSearch.toUpperCase().replace(/[^A-Z]/g, "")];
} else {
  setScanStatus(`SCANNING NEWS SOURCES...`);
  
  // Discover tickers from recent financial news
  const foundSymbols = await discoverNewsArticles(scanSector, scanMarketCap, scanPriceLimit);
  console.log(`📰 Discovered ${foundSymbols.length} stocks from recent news`);
  
  if (foundSymbols.length === 0) {
    setScanStatus(`NO STOCKS IN RECENT NEWS`);
    setLoading(false);
    return;
  }
  
  tickersToProcess = foundSymbols;
}

const blacklist = [
  "CNBC", "CNN", "FRED", "WSJ", "NYSE", "NASDAQ", "BLOOMBERG", "REUTERS", 
  "FDA", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  "AI", "ML", "EV", "CEO", "CFO", "IPO", "ETF", "ESG", "IT", "US", "UK", "EU",
  "PDUFA", "SEC", "II", "III", "IV", "LLC", "INC", "BMO", "RBC", "API", "ADC", 
  "IKE", "PPP", "MPS", "ABCD", "EFGH", "IJKL", "MNOP", "WXYZ",
  "EDGAR", "FORM", "AM", "PM", "EST", "PST", "GMT", "UTC", "CR", "EA", "IP" 
];

const foreignSuffixes = [".L", ".HK", ".TO", ".AX", ".PA", ".DE"];

const tickers = tickersToProcess.filter(t => {
  if (blacklist.includes(t)) return false;
  if (foreignSuffixes.some(suffix => t.includes(suffix))) return false;
  if (t.length > 5) return false;
  if (t.length < 3) return false;
  
  // NEW: Filter obvious junk patterns
  if (/\d/.test(t)) return false; // No numbers in tickers
  if (t.endsWith('X') && t.length === 4) return false; // Often OTC junk
  
  if (!isManual && recentlyScanned.has(t)) return false;
  return true;
});

console.log('Tickers after filtering:', tickers);  // ADD THIS

// NEW: User-specific randomization for legal compliance
const seed = user?.uid ? `${user.uid}-${new Date().toDateString()}` : Date.now().toString();
const shuffledTickers = tickers.sort((a, b) => {
  return hashCode(seed + a) - hashCode(seed + b);
}).slice(0, 50); // Take first 50 for processing

console.log('shuffledTickers:', shuffledTickers);  // ADD THIS
console.log('Starting for loop, targetGoal:', targetGoal);  // ADD THIS

// Process stocks in batches of 5 for speed
const batchSize = 2;
for (let i = 0; i < shuffledTickers.length && localStocks.length < targetGoal; i += batchSize) {
  const batch = shuffledTickers.slice(i, i + batchSize);
  
  console.log(`Processing batch ${Math.floor(i/batchSize) + 1}: ${batch.join(', ')}`);
  setScanProgress(20 + (i / shuffledTickers.length) * 60);
  
  const batchResults = await Promise.allSettled(
    batch.map(async (ticker) => {
      try {
// Fetch quote and news (these change frequently)
        const [q, n] = await Promise.all([
          fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`).then(r => r.json()),
          fetch(`https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${yDate}&to=${fDate}&token=${FINNHUB_KEY}`).then(r => r.json())
        ]);

        // Check profile cache (profiles don't change often)
        let p;
        if (profileCache[ticker]) {
          console.log(`${ticker} - Using cached profile`);
          p = profileCache[ticker];
        } else {
          p = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`).then(r => r.json());
          if (p && p.name) {
            setProfileCache(prev => ({ ...prev, [ticker]: p }));
            console.log(`${ticker} - Cached profile for future scans`);
          }
        }

        if (!q || !q.c || q.c === 0) {
          console.log(`${ticker} - Invalid quote data`);
          return null;
        }

        if (!isManual) {
          if (q.c < 2) {
            console.log(`${ticker} - Rejected: Price too low ($${q.c})`);
            return null;
          }
          if (q.c > scanPriceLimit) {
            console.log(`${ticker} - Rejected: Price above limit ($${q.c} > $${scanPriceLimit})`);
            return null;
          }
        }

        let h = { c: [] };
        if (volatilityCache[ticker]) {
          h = { c: volatilityCache[ticker] };
        } else {
          try {
            const twelveUrl = `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=1day&outputsize=90&apikey=${TWELVE_DATA_KEY}`;
            const twelveRes = await fetch(twelveUrl);
            const twelveData = await twelveRes.json();
            
            if (twelveData.values && twelveData.values.length > 0) {
              const closePrices = twelveData.values.map(day => parseFloat(day.close)).reverse();
              h = { c: closePrices };
              setVolatilityCache(prev => ({ ...prev, [ticker]: closePrices }));
            }
          } catch (e) {
            console.log(`Twelve Data error for ${ticker}:`, e);
          }
        }

        const headlines = n?.length > 0 
          ? n.slice(0, 10).map(i => `[${new Date(i.datetime * 1000).toLocaleDateString()}] ${i.headline}`).join(" | ") 
          : "No recent company-specific news found.";

        const fiftyTwoWeekHigh = q.h;
        const fiftyTwoWeekLow = q.l;
        const currentPrice = q.c;
        const priceNearHigh = (currentPrice / fiftyTwoWeekHigh) > 0.95;
        const priceFromLow = ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100;

        const technicalContext = `
TECHNICAL SETUP:
- Current: $${currentPrice.toFixed(2)}
- 52W High: $${fiftyTwoWeekHigh.toFixed(2)}
- 52W Low: $${fiftyTwoWeekLow.toFixed(2)}
- Near Highs: ${priceNearHigh ? 'YES - Within 5%, potential breakout zone' : 'NO'}
- From Low: +${priceFromLow.toFixed(1)}%
`;

const analysisPrompt = isManual 
  ? `
    TICKER: ${ticker}
    CURRENT PRICE: $${q.c}
    52-WEEK RANGE: $${q.l} - $${q.h}
    ${technicalContext}
    NEWS (Past 3 Days): ${headlines}
    COMPANY: ${p.name || ticker}
    
    COMPREHENSIVE ANALYSIS REQUIRED:
    
    Provide a THOROUGH, DETAILED analysis for this manually searched stock.
    
    STEP 1 - IDENTIFY ALL CATALYSTS:
    - Recent earnings, revenue, EPS, guidance
    - FDA approvals, clinical trials, PDUFA dates
    - Analyst upgrades/downgrades with targets
    - Product launches, partnerships, contracts
    - M&A, buybacks, insider activity
    - Regulatory developments
    
    STEP 2 - FUNDAMENTALS:
    - Core business and revenue drivers
    - Recent financial performance
    - Competitive position
    
    STEP 3 - TECHNICAL SETUP:
    - Price momentum and volume
    - Support/resistance levels
    
    STEP 4 - RISKS:
    - What could go wrong?
    - Competition, regulatory risks
    
    FORMAT (Use EXACT tags):
    NAME: ${p.name || 'Unknown'}
    [RANGE] $XX.XX - $XX.XX [/RANGE]
    [SIG] BULLISH or BEARISH [/SIG]
    [MOM] Positive, Steady, or Uncertain [/MOM]
    [CAT] Primary catalyst - max 15 words [/CAT]
    [TIMING] ENTER_NOW or WATCH_FOR_PULLBACK or WAIT_FOR_BREAKOUT [/TIMING]
    [CONF] XX.XX [/CONF]
    [VOLATILITY] XX.XX [/VOLATILITY]
    [INSIGHTS]
    | CATALYST: Specific catalyst with dates/numbers (e.g., "Q4 earnings beat 15% on Jan 28, raised guidance")
    | FUNDAMENTAL: Key business driver (e.g., "Revenue up 23% YoY, cash runway to Q2 2027")
    | TECHNICAL: Price action context (e.g., "Up 34% from lows, approaching 52W high with volume")
    | OPPORTUNITY: Upside potential (e.g., "Phase 2 data Q1 2026, analyst targets $15-20")
    | RISK: Main downside (e.g., "Binary clinical trial event, intense competition")
    | TIMING: Entry strategy (e.g., "Wait for pullback to $8-9 support")
    [/INSIGHTS]
    
    CRITICAL: Each insight MUST start with the label followed by a COLON.
    Include specific numbers, dates, percentages, and concrete events.
  `
  : `
    TICKER: ${ticker}
    PRICE: $${q.c} (52W: $${q.l} - $${q.h})
    ${technicalContext}
    NEWS HEADLINES: ${headlines}
    COMPANY: ${p.name || ticker}

    COMPREHENSIVE ANALYSIS REQUIRED:
    
    You are analyzing a stock that appeared in recent financial news. Your job is to provide a THOROUGH, 
    DETAILED analysis that investors can act on.
    
    STEP 1 - IDENTIFY ALL CATALYSTS:
    Review the news headlines carefully and identify:
    - Recent earnings (revenue, EPS, guidance)
    - FDA approvals, clinical trial results, PDUFA dates
    - Analyst upgrades/downgrades with price targets
    - Product launches, partnerships, contracts
    - M&A activity, buybacks, insider buying
    - Regulatory developments
    - Financial updates (revenue guidance, cash runway)
    
    STEP 2 - ANALYZE FUNDAMENTALS:
    - What is the company's core business?
    - What are the main revenue drivers?
    - Recent financial performance trends
    - Competitive position in sector
    
    STEP 3 - TECHNICAL SETUP:
    - Price momentum (near highs/lows?)
    - Volume patterns
    - Key support/resistance levels
    
    STEP 4 - RISK ASSESSMENT:
    - What could go wrong?
    - Competition or regulatory risks
    - Execution challenges
    
    FORMAT (Use EXACT tags):
    NAME: ${p.name || 'Unknown'}
    [RANGE] $XX.XX - $XX.XX [/RANGE]
    [SIG] BULLISH or BEARISH or NEUTRAL [/SIG]
    [MOM] Positive, Steady, or Uncertain [/MOM]
    [CAT] Primary catalyst with specifics - max 15 words [/CAT]
    [TIMING] ENTER_NOW or WATCH_FOR_PULLBACK or WAIT_FOR_BREAKOUT [/TIMING]
    [CONF] XX.XX [/CONF]
    [VOLATILITY] XX.XX [/VOLATILITY]
    [INSIGHTS]
    | CATALYST: Specific recent catalyst with dates/numbers (e.g., "Q4 earnings beat by 15% on Jan 28, raised FY guidance")
    | FUNDAMENTAL: Key business driver or recent financial update (e.g., "Revenue up 23% YoY, cash runway extends to Q2 2027")
    | TECHNICAL: Price action and momentum context (e.g., "Up 34% from lows, approaching 52W high with strong volume")
    | OPPORTUNITY: Why this could move higher (e.g., "Phase 2 data expected Q1 2026, analyst targets $15-20 range")
    | RISK: Main downside consideration (e.g., "Clinical trial results binary event, competitive landscape intensifying")
    | TIMING: Specific entry/exit strategy based on setup (e.g., "Wait for pullback to $8-9 support before entry")
    [/INSIGHTS]
    
    CRITICAL: Each insight must be SPECIFIC and ACTIONABLE. No generic statements like "positive momentum" or "sector tailwinds."
    Include actual numbers, dates, percentages, price targets, and concrete events.
    
    Only use NEUTRAL if headlines literally say "No recent company-specific news found"
  `;

        const analysis = await aiModel.generateContent(analysisPrompt);
        const resText = await analysis.response.text();

        if (!isManual && resText.includes("NEUTRAL")) {
          console.log(`${ticker} - Rejected: AI marked as NEUTRAL`);
          return null;
        }

        const aiConfidence = getScore(extract("CONF", resText), 65);
        const volumeRatio = (q.v || 0) / (q.av || 1);

        const newStock = {
          symbol: ticker.trim().toUpperCase(),
          name: p.name || clean(extract("NAME", resText)) || `${ticker} CORP`,
          price: q.c.toFixed(2),
          change: q.dp?.toFixed(2) || "0.00",
          isPositive: extract("SIG", resText).toUpperCase().includes("BULLISH"),
          range: clean(extract("RANGE", resText)),
          confidence: calculateSignalStrength(n, h.c, q.c, h.c && h.c.length >= 2 ? calculateHV(h.c).toFixed(2) : 40, aiConfidence, volumeRatio),
          volatility: h.c && h.c.length >= 2 ? calculateHV(h.c).toFixed(2) : 40,
          rating: clean(extract("SIG", resText)),
          momentum: clean(extract("MOM", resText)),
          catalyst: formatText(clean(extract("CAT", resText))),
          insights: extract("INSIGHTS", resText).split('|').map(i => formatText(clean(i))).filter(i => i.length > 5)
        };

        console.log(`✓ ${ticker} passed all filters`);
        return newStock;

      } catch (error) {
        console.log(`${ticker} - Error:`, error.message);
        return null;
      }
    })
  );

for (const result of batchResults) {
  if (result.status === 'fulfilled' && result.value) {
    // Check if we already have this stock
    const isDuplicate = localStocks.some(s => s.symbol === result.value.symbol);
    
    if (!isDuplicate && localStocks.length < targetGoal) {
      localStocks.push(result.value);
      setStocks([...localStocks]);
      setRecentlyScanned(prev => new Set([...prev, result.value.symbol]));
    }
  }
}

if (localStocks.length < targetGoal) {
  await new Promise(r => setTimeout(r, 1500)); // Reduced to 1.5 seconds
}
}

if (isManual) break;
    }
 } catch (err) { console.error(err); }
  finally { 
    setLoading(false); 
    setScanProgress(100);
    setScanStatus("COMPLETE");
    // Restart watchlist updates after scan completes
    if (watchlistIntervalRef.current) {
      clearInterval(watchlistIntervalRef.current);
    }
    watchlistIntervalRef.current = setInterval(updateList, 60000);
  }
}, [aiModel, sourceString, scanPriceLimit, scanMarketCap, scanSector]);


const getSortedAndFilteredStocks = useCallback((stockList) => {
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
}, [sortBy, filterSignal, filterPriceRange, filterVolatility]);

// Create a stable reference cache for stock objects
const stockCache = useRef({});

const getStableStock = useCallback((stock) => {
  const key = stock.symbol;
  const cached = stockCache.current[key];
  
  // If stock data hasn't changed, return cached version
  if (cached && cached.price === stock.price && cached.change === stock.change) {
    return cached;
  }
  
  // Otherwise cache and return new version
  stockCache.current[key] = stock;
  return stock;
}, []);

// Then change your displayedStocks to use this:
const displayedStocks = useMemo(() => 
  getSortedAndFilteredStocks(stocks).map(getStableStock), 
  [stocks, getSortedAndFilteredStocks, getStableStock]
);

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
  @keyframes shimmer {
    100% {
      transform: translateX(100%);
    }
  }
`}</style>
      
{/* HEADER */}
<header className="flex flex-col mb-8 md:mb-12 border-b-2 border-zinc-900 pb-6 md:pb-8">
  {/* Top row - Logo, Status, Search, Clock, Auth */}
  <div className="flex justify-between items-center gap-4 mb-0">
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
    
    {/* Right side - Search, Clock and Auth */}
    <div className="flex items-center gap-4 md:gap-6">
      {/* Search Icon */}
      <button
        onClick={() => setShowSearch(!showSearch)}
        className="p-2 md:p-3 rounded-lg border-2 border-zinc-800 bg-black hover:border-[#00ff4e]/50 transition-all active:scale-95"
      >
        <Search size={18} className="md:w-5 md:h-5 text-zinc-500 hover:text-[#00ff4e] transition-colors" />
      </button>

      {/* Clock - hidden on mobile */}
      <div className="text-right hidden md:block">
        <CurrentTime />
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
            <div className="hidden md:block">
              <span className="text-white text-sm font-bold whitespace-nowrap block">
                {userProfile?.username || user.email}
              </span>
              {userProfile && (
                <span className="text-zinc-500 text-[10px] font-bold">
                  {userProfile.followerCount || 0} followers · {userProfile.followingCount || 0} following
                </span>
              )}
            </div>
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
  </div>

  {/* Search Dropdown - appears below the header content */}
  <AnimatePresence>
    {showSearch && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden mt-6"
      >
        <div className="bg-[#050505] border-2 border-zinc-800 rounded-xl p-4 md:p-6">
          <div className="mb-4">
            <input
              type="text"
              value={userSearchTerm}
              onChange={(e) => {
                setUserSearchTerm(e.target.value);
                if (e.target.value.length >= 2) {
                  handleSearchUsers(e.target.value);
                } else {
                  setSearchResults([]);
                }
              }}
              placeholder="Search for users and watchlists..."
              className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00ff4e]/50 transition-colors"
            />
          </div>

          {/* Search Results */}
          {loadingDiscover ? (
            <div className="py-8 text-center">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Searching...</p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map(user => (
                <div
                  key={user.id}
                  onClick={() => {
                      handleViewUserProfile(user.id);
                      setShowSearch(false);
                    }}
                  className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-[#00ff4e]/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {user.profilePicUrl ? (
                      <img src={user.profilePicUrl} alt={user.username} className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                        <Users size={20} className="text-zinc-600" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-black text-white">{user.username}</p>
                      <p className="text-xs text-zinc-500">{user.followerCount || 0} followers</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {user.watchlistCount > 0 && (
                      <span className="text-xs px-2 py-1 bg-[#00ff4e]/10 text-[#00ff4e] rounded">
                        {user.watchlistCount} {user.watchlistCount === 1 ? 'list' : 'lists'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : userSearchTerm.length >= 2 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-zinc-500">No users found</p>
            </div>
          ) : null}

          {/* Public Watchlists */}
          {!userSearchTerm && publicWatchlists.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Popular Watchlists</p>
              <div className="space-y-3">
                {publicWatchlists.slice(0, 5).map(list => (
                  <div
                    key={list.id}
                    className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-[#00ff4e]/50 transition-all cursor-pointer"
                    onClick={() => {
                      handleViewUserProfile(list.ownerId);
                      setShowSearch(false);
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-black text-white">{list.name}</p>
                      <span className="text-xs text-zinc-500">{list.stocks?.length || 0} stocks</span>
                    </div>
                    {list.description && (
                      <p className="text-xs text-zinc-600 mb-2">{list.description}</p>
                    )}
                    <p className="text-xs text-zinc-500">
                      by {list.ownerUsername || 'Anonymous'} • {list.followerCount || 0} followers
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</header>


<TypewriterGreeting />


<div className="flex gap-2 md:gap-4 mb-6 md:mb-8 border-b border-zinc-900 pb-4 overflow-x-auto">
  {["DASHBOARD", "TRENDING", "MY LISTS", "MY POSITIONS", "NEWS"].map(tab => (
  <button
    key={tab}
    onClick={() => setActiveTab(tab)}
    className={`text-[10px] md:text-xs font-black tracking-[0.2em] md:tracking-[0.3em] px-4 md:px-6 py-2 rounded-full transition-all whitespace-nowrap flex-shrink-0 ${
      activeTab === tab 
      ? "bg-[#00ff4e] text-black shadow-[0_0_20px_rgba(0,255,78,0.4)]" 
      : "text-zinc-500 hover:text-white"
    }`}
  >
    {tab === "MY LISTS" ? `MY LISTS` : tab}
  </button>
))}
      </div>

      {/* NEWS TAB CONTROLS */}
{activeTab === "NEWS" && (
  <div className="space-y-4 md:space-y-6 mb-6 md:mb-8">
    {/* MANUAL SEARCH SECTION */}
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

 {activeTab === "DASHBOARD" && (
  <div className="space-y-4 md:space-y-6 mb-6 md:mb-8">
{/* MANUAL SEARCH SECTION */}
<div className="bg-[#111111] border border-zinc-800 p-4 md:p-5 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300">
  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">
    Analyze Any Stock
  </h3>
  <div className="flex flex-col sm:flex-row gap-3">
    <div className="flex-1 relative">
      <input
        type="text"
        placeholder="Enter ticker or company name (e.g. AAPL, Apple)..."
        value={manualSearch}
onChange={(e) => {
  const value = e.target.value.toUpperCase();
  setManualSearch(value);
  
  // Clear previous timeout
  if (searchTimeoutRef.current) {
    clearTimeout(searchTimeoutRef.current);
  }
  
  // Only search after user stops typing for 500ms
  searchTimeoutRef.current = setTimeout(async () => {
    if (value.length >= 2) {
      try {
        const res = await fetch(`https://finnhub.io/api/v1/search?q=${value}&token=${FINNHUB_KEY}`);
        const data = await res.json();
        setStockSearchResults(data.result?.slice(0, 5) || []);
      } catch (err) {
        console.error('Search failed:', err);
        setStockSearchResults([]);
      }
    } else {
      setStockSearchResults([]);
    }
  }, 500);
}}
onKeyDown={(e) => {
  if (e.key === 'Enter' && manualSearch) {
    setStocks([]); // ADD THIS
    setIsManualResult(true); // ADD THIS
    runScanner(manualSearch);
    setStockSearchResults([]);
  }
}}
        className="w-full bg-black border border-zinc-800 text-white px-4 md:px-5 py-3 rounded-lg outline-none transition-all font-mono text-base placeholder:text-zinc-700 focus:border-[#00ff4e]/50"
        style={{ caretColor: '#00ff4e' }}
      />
    </div>
    
    <button 
  onClick={() => {
    setStocks([]);
    setIsManualResult(true);
    runScanner(manualSearch);
    setStockSearchResults([]);
  }}
      disabled={loading || !manualSearch}
      className="hover:opacity-90 disabled:opacity-20 text-black px-6 md:px-8 py-3 rounded-lg text-xs md:text-sm font-black tracking-tighter transition-all shadow-[0_0_15px_rgba(0,255,78,0.2)] active:scale-95 whitespace-nowrap"
      style={{ backgroundColor: '#00ff4e' }}
    >
      {loading ? 'ANALYZING...' : 'ANALYZE STOCK'}
    </button>
  </div>
  
  {/* Search results - inside the same container, pushes everything down */}
  <AnimatePresence>
    {stockSearchResults.length > 0 && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
          {stockSearchResults.map((result) => (
            <button
  key={result.symbol}
onClick={async () => {
  console.log('Clicked stock:', result.symbol);
  setStocks([]); // ADD THIS
  setManualSearch(result.symbol);
  setStockSearchResults([]);
  setIsManualResult(true); // ADD THIS
  
  // Add small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 500));
  
  runScanner(result.symbol);
}}
  className="w-full text-left px-4 py-3 bg-black hover:bg-zinc-900 transition-all rounded-lg border border-zinc-800 hover:border-[#00ff4e]/50"
>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-black text-white">{result.symbol}</p>
                  <p className="text-xs text-zinc-500">{result.description}</p>
                </div>
                <span className="text-xs text-zinc-600">{result.type}</span>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>

{/* MANUAL SEARCH RESULTS - Shows right after search box */}
{isManualResult && displayedStocks.length > 0 && (
  <div className="space-y-6 md:space-y-8 mb-6">
    {displayedStocks.map((stock) => (
      <MetricCard 
        key={stock.symbol}
        stock={getStableStock(stock)}
        isMarketOpen={isMarketOpen} 
        onAction={(stock) => setShowAddToListMenu(stock)}
        removeFromWatchlist={removeStockFromList}
        actionType="ADD"
        watchlist={flattenedWatchlist}
        showAddToListMenu={showAddToListMenu}
        onCloseMenu={() => setShowAddToListMenu(null)}
        watchlists={watchlists}
        onAddToList={addStockToList}
        user={user}
        onOpenChat={(stock) => setShowStockChat(stock)}
      />
    ))}
  </div>
)}

  
{/* AI SCANNER SECTION */}
<div className="bg-[#111111] border border-zinc-800 p-4 md:p-5 rounded-xl shadow-2xl backdrop-blur-md">
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
  onClick={() => { 
    setStocks([]);
    setManualSearch(""); 
    setIsManualResult(false);
    runScanner(null); 
  }}
  disabled={loading}
  className="flex-1 hover:opacity-90 disabled:opacity-20 text-black px-6 md:px-8 py-3 rounded-lg text-xs md:text-sm font-black tracking-tighter transition-all shadow-[0_0_15px_rgba(0,255,78,0.2)] active:scale-95 whitespace-nowrap"
  style={{ backgroundColor: '#00ff4e' }}
>
  {loading && !isManualResult ? (
    <>
      <span>ANALYZING MARKET</span>
      <span className="inline-flex gap-0.5 ml-2">
        <span className="animate-[pulse_1s_ease-in-out_infinite]">.</span>
        <span className="animate-[pulse_1s_ease-in-out_0.2s_infinite]">.</span>
        <span className="animate-[pulse_1s_ease-in-out_0.4s_infinite]">.</span>
      </span>
    </>
  ) : (
    'ANALYZE MARKET'
  )}
</button>
  </div>
</div>



  </div>
)}


      {/* SORT & FILTER BAR */}
      {activeTab === "DASHBOARD" && stocks.length > 0 && (
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
{loading && stocks.length === 0 && (
  <div className="py-32 text-center">
    {/* Animated Logo */}
    <div className="flex justify-center mb-6">
      <img 
        src="/jckrbbt_logo_animated.svg" 
        alt="Loading" 
        className="w-24 h-24"
      />
    </div>
    
    {/* Status Text */}
    <p className="text-sm font-black text-white uppercase tracking-wider mb-6 animate-pulse">
      {scanStatus}
    </p>
    
    {/* Progress Bar */}
    <div className="max-w-md mx-auto px-4">
      <div className="relative h-2 bg-zinc-900 rounded-full overflow-hidden mb-2">
        <div 
          className="absolute h-full bg-[#00ff4e] transition-all duration-500 ease-out"
          style={{ 
            width: `${scanProgress}%`,
            boxShadow: '0 0 20px rgba(0,255,78,0.5)'
          }}
        />
      </div>
      <p className="text-xs text-zinc-500">
        {scanProgress}% Complete
      </p>
    </div>
  </div>
)}
  {!isManualResult && displayedStocks.map((stock, index) => (
    <MetricCard 
  key={stock.symbol}
  stock={getStableStock(stock)}
  isMarketOpen={isMarketOpen} 
  onAction={(stock) => setShowAddToListMenu(stock)}
  removeFromWatchlist={removeStockFromList}
  actionType="ADD"
  watchlist={flattenedWatchlist}
  showAddToListMenu={showAddToListMenu}
  onCloseMenu={() => setShowAddToListMenu(null)}
  watchlists={watchlists}
  onAddToList={addStockToList}
  user={user}
  onOpenChat={(stock) => setShowStockChat(stock)}  // ADD THIS LINE
/>
  ))}
    </>

) : activeTab === "DISCOVER" ? (
  <>
    {/* Search Bar */}
    <div className="mb-6">
      <div className="bg-[#050505] border border-zinc-900 p-4 rounded-xl">
        <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">
          Find Users
        </h3>
        <input
          type="text"
          placeholder="Search by username..."
          value={userSearchTerm}
          onChange={(e) => handleSearchUsers(e.target.value)}
          className="w-full bg-black border border-zinc-800 text-white px-4 py-3 rounded-lg outline-none transition-all font-mono text-sm placeholder:text-zinc-700 focus:border-[#00ff4e]/50"
        />
        
        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map(searchUser => (
              <div
                key={searchUser.id}
                className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-all cursor-pointer"
                onClick={() => handleViewUserProfile(searchUser.id)}
              >
                <div className="flex items-center gap-3">
                  {searchUser.profilePicUrl ? (
                    <img 
                      src={searchUser.profilePicUrl} 
                      alt={searchUser.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-[#00ff4e] rounded-full flex items-center justify-center text-black font-black">
                      {searchUser.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-white">{searchUser.username}</p>
                    <p className="text-xs text-zinc-500">{searchUser.followerCount || 0} followers</p>
                  </div>
                </div>
                <Users size={16} className="text-zinc-500" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Public Watchlists */}
    <div>
      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">
        Public Watchlists
      </h3>
      
      {loadingDiscover ? (
        <div className="py-32 text-center">
          <p className="text-zinc-500 text-sm uppercase tracking-widest font-black">Loading...</p>
        </div>
      ) : publicWatchlists.length === 0 ? (
        <div className="py-32 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
          <p className="text-xs md:text-sm tracking-[0.4em] uppercase font-black">No Public Lists Yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {publicWatchlists.map((list, index) => (
            <motion.div
              key={list.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-6 hover:border-zinc-700 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
                    {list.name}
                  </h3>
                  {list.description && (
                    <p className="text-sm text-zinc-400 mb-2">{list.description}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-zinc-600">{list.stocks?.length || 0} stocks</p>
                    <button
                      onClick={() => handleViewUserProfile(list.userId)}
                      className="text-xs text-[#00ff4e] hover:underline font-bold"
                    >
                      by {list.ownerUsername || 'Anonymous'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stock previews */}
              {list.stocks && list.stocks.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {list.stocks.slice(0, 5).map((stock) => (
                    <span
                      key={stock.symbol}
                      className="text-xs font-black bg-zinc-900 text-[#00ff4e] px-3 py-1 rounded border border-zinc-800 uppercase"
                    >
                      {stock.symbol}
                    </span>
                  ))}
                  {list.stocks.length > 5 && (
                    <span className="text-xs text-zinc-600 px-3 py-1">
                      +{list.stocks.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  </>
 ) : activeTab === "TRENDING" ? (
  <>
    {/* Interval Filter */}
    <div className="mb-6">
      <div className="bg-[#050505] border border-zinc-900 p-4 rounded-xl">
        <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">
          Time Period
        </h3>
        <div className="flex gap-2">
          {['daily', 'weekly', 'monthly'].map((interval) => (
            <button
              key={interval}
              onClick={() => setTrendingInterval(interval)}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tight transition-all ${
                trendingInterval === interval
                  ? 'bg-[#00ff4e] text-black'
                  : 'bg-zinc-900 text-zinc-500 hover:text-white'
              }`}
            >
              {interval}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Trending Stocks List */}
    {loadingTrending ? (
      <div className="py-32 text-center">
        <p className="text-zinc-500 text-sm uppercase tracking-widest font-black">Loading Trending Stocks...</p>
      </div>
    ) : trendingStocks.length === 0 ? (
      <div className="py-32 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
        <p className="text-xs md:text-sm tracking-[0.4em] uppercase font-black">No Trending Stocks Yet</p>
      </div>
    ) : (
      <div className="space-y-4">
        {trendingStocks.map((stock, index) => (
          <motion.div
            key={stock.symbol}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-6 hover:border-zinc-700 transition-all cursor-pointer"
            onClick={() => {
              setManualSearch(stock.symbol);
              setActiveTab("DASHBOARD");
              runScanner(stock.symbol);
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Rank Badge */}
                <div className="flex items-center justify-center min-w-[48px] w-12 h-12 bg-zinc-900 rounded-full px-2">
                  <span className="text-2xl font-black text-[#00ff4e] leading-none">#{index + 1}</span>
                </div>
                
                {/* Stock Info */}
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">{stock.symbol}</h3>
                  <p className="text-sm text-zinc-500">{stock.name}</p>
                </div>
              </div>

              {/* Watch Stats */}
              <div className="text-right">
                <p className="text-3xl font-black text-[#00ff4e] mb-1">{stock.watchCount}</p>
                <p className="text-xs text-zinc-600 uppercase tracking-wider">
                  {trendingInterval === 'daily' ? 'Adds Today' : 
                   trendingInterval === 'weekly' ? 'Adds This Week' : 
                   'Adds This Month'}
                </p>
                <p className="text-[10px] text-zinc-700 mt-1">
                  {stock.totalWatches} total watches
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 h-2 bg-zinc-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#00ff4e] shadow-[0_0_10px_#00ff4e]"
                style={{ 
                  width: `${Math.min((stock.watchCount / (trendingStocks[0]?.watchCount || 1)) * 100, 100)}%` 
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    )}
  </>

) : activeTab === "MY LISTS" ? (
  <>
    {/* Create New List Button */}
    {user && (
        <div className="mb-6">
          <button
            onClick={() => setShowWatchlistModal(true)}
            className="flex items-center gap-2 bg-[#00ff4e] hover:opacity-90 text-black font-black px-6 py-3 rounded-lg text-sm uppercase tracking-tight transition-all"
          >
            <Plus size={16} />
            Create New List
          </button>
        </div>
      )}

      {/* User's Watchlists */}
      {!user ? (
        <div className="py-32 md:py-40 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
          <p className="text-xs md:text-sm tracking-[0.4em] md:tracking-[0.5em] uppercase font-black mb-4">Sign in to create lists</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-[#00ff4e] hover:opacity-90 text-black font-black px-6 py-3 rounded-lg text-xs uppercase tracking-tight transition-all"
          >
            Sign In
          </button>
        </div>
      ) : watchlists.length === 0 ? (
        <div className="py-32 md:py-40 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
          <p className="text-xs md:text-sm tracking-[0.4em] md:tracking-[0.5em] uppercase font-black">No Lists Yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {watchlists.map((list, index) => (
            <motion.div
              key={list.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-6 hover:border-zinc-700 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
  <div className="flex-1">
    <div className="flex items-center gap-3 mb-2">
      <h3 
        onClick={() => setSelectedWatchlist(selectedWatchlist?.id === list.id ? null : list)}
        className="text-xl font-black text-white uppercase tracking-tight cursor-pointer hover:text-[#00ff4e] transition-colors"
      >
        {list.name}
      </h3>
      {/* Desktop badge */}
      {list.isPublic ? (
        <span className="hidden md:inline-block text-[8px] font-black bg-[#00ff4e]/10 text-[#00ff4e] px-2 py-1 rounded border border-[#00ff4e]/30 uppercase">
          Public
        </span>
      ) : (
        <span className="hidden md:inline-block text-[8px] font-black bg-zinc-800 text-zinc-500 px-2 py-1 rounded border border-zinc-700 uppercase">
          Private
        </span>
      )}
    </div>
    {list.description && (
      <p className="text-sm text-zinc-400 mb-2">{list.description}</p>
    )}
    <div className="flex items-center gap-2">
      <p className="text-xs text-zinc-600">{list.stocks.length} stocks</p>
      {/* Mobile badge */}
      {list.isPublic ? (
        <span className="md:hidden text-[8px] font-black bg-[#00ff4e]/10 text-[#00ff4e] px-2 py-1 rounded border border-[#00ff4e]/30 uppercase">
          Public
        </span>
      ) : (
        <span className="md:hidden text-[8px] font-black bg-zinc-800 text-zinc-500 px-2 py-1 rounded border border-zinc-700 uppercase">
          Private
        </span>
      )}
    </div>
  </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingWatchlist(list);
                      setShowWatchlistModal(true);
                    }}
                    className="text-zinc-500 hover:text-[#00ff4e] transition-colors p-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteWatchlist(list.id)}
                    className="text-zinc-500 hover:text-red-500 transition-colors p-2"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedWatchlist(selectedWatchlist?.id === list.id ? null : list)}
                    className="text-zinc-500 hover:text-white transition-colors text-sm font-bold uppercase"
                  >
                    {selectedWatchlist?.id === list.id ? 'Hide ▲' : 'View ▼'}
                  </button>
                </div>
              </div>

{/* Stocks in this list */}
              <AnimatePresence>
                {selectedWatchlist?.id === list.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                   <div className="space-y-6 md:space-y-8">
                    {list.stocks.map((stock) => (
                      <MetricCard 
                        key={stock.symbol}
                        stock={getStableStock(stock)}
                        isMarketOpen={isMarketOpen} 
                        onAction={(stock) => setShowAddToListMenu(stock)}
                        removeFromWatchlist={(symbol) => removeStockFromList(list.id, symbol)}
                        actionType="REMOVE"
                        watchlist={flattenedWatchlist}
                        showAddToListMenu={showAddToListMenu}
                        onCloseMenu={() => setShowAddToListMenu(null)}
                        watchlists={watchlists}
                        onAddToList={addStockToList}
                        user={user}
                        onOpenChat={(stock) => setShowStockChat(stock)}  // ADD THIS LINE
                      />
                    ))}
                  </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </>

) : activeTab === "NEWS" ? (
  // NEWS tab content
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
    
) : activeTab === "MY POSITIONS" ? (
  <>
    {/* MY POSITIONS Tab */}
    {!user ? (
      <div className="py-32 md:py-40 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
        <p className="text-xs md:text-sm tracking-[0.4em] md:tracking-[0.5em] uppercase font-black mb-4">Sign in to view positions</p>
        <button
          onClick={() => setShowAuthModal(true)}
          className="bg-[#00ff4e] hover:opacity-90 text-black font-black px-6 py-3 rounded-lg text-xs uppercase tracking-tight transition-all"
        >
          Sign In
        </button>
      </div>
    ) : (
      <>
        {/* Brokerage Management Header */}
        <div className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-2">Connected Accounts</h3>
              <p className="text-xs text-zinc-600">
                {connectedBrokerages.length === 0 
                  ? 'No accounts connected yet' 
                  : `${connectedBrokerages.length} account${connectedBrokerages.length > 1 ? 's' : ''} connected`
                }
              </p>
            </div>
            
{/* Add New Brokerage Button - only render when tab is active */}
{activeTab === "MY POSITIONS" && (
  <PlaidLink 
    key="plaid-link-positions"
    user={user}
    onSuccess={handlePlaidSuccess}
    onError={handlePlaidError}
    buttonText={connectedBrokerages.length > 0 ? "Add Another Account" : "Connect Brokerage"}
    buttonClassName={`flex items-center gap-2 ${
      connectedBrokerages.length > 0 
        ? 'bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 hover:border-[#00ff4e]/50' 
        : 'bg-[#00ff4e] hover:opacity-90 text-black'
    } font-black px-4 md:px-6 py-3 rounded-lg text-xs uppercase tracking-tight transition-all`}
  />
)}
          </div>

          {/* Connected Brokerages List */}
          {connectedBrokerages.length > 0 && (
            <div className="mt-6 space-y-3">
              {connectedBrokerages.map((brokerage) => (
                <div 
                  key={brokerage.id}
                  onClick={() => setSelectedBrokerage(brokerage.id)}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedBrokerage === brokerage.id 
                      ? 'border-[#00ff4e] bg-[#00ff4e]/5' 
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'
                  }`}
                >
<div className="flex items-center gap-4">
  {getBrokerageLogo(brokerage.name) ? (
    <img 
      src={getBrokerageLogo(brokerage.name)}
      alt={brokerage.name}
      className="w-10 h-10 rounded-lg object-contain bg-white p-1.5"
      onError={(e) => {
        // Hide image and show fallback emoji
        e.target.style.display = 'none';
        e.target.nextSibling.style.display = 'flex';
      }}
    />
  ) : null}
  <div 
    className={`w-10 h-10 rounded-lg bg-zinc-800 items-center justify-center ${getBrokerageLogo(brokerage.name) ? 'hidden' : 'flex'}`}
  >
    <span className="text-xl">{getBrokerageIcon(brokerage.name)}</span>
  </div>
  <div>
    <p className="text-sm font-black text-white">{brokerage.name}</p>
    <p className="text-xs text-zinc-500">
      {brokeragePositions[brokerage.id]?.length || 0} positions • 
      Updated {brokerage.lastUpdated ? new Date(brokerage.lastUpdated).toLocaleDateString() : 'recently'}
    </p>
  </div>
</div>
                  
                  <div className="flex items-center gap-2">
                    {selectedBrokerage === brokerage.id && (
                      <span className="text-[8px] font-black bg-[#00ff4e]/20 text-[#00ff4e] px-2 py-1 rounded uppercase tracking-wider">
                        Active
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDisconnectBrokerage(brokerage.id);
                      }}
                      disabled={disconnectingBrokerage === brokerage.id}
                      className="p-2 text-zinc-600 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="Disconnect account"
                    >
                      {disconnectingBrokerage === brokerage.id ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Unlink size={16} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* No Brokerages Connected State */}
        {!brokerageConnected && (
          <div className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-xl">
            <Building2 size={48} className="mx-auto mb-4 text-zinc-700" />
            <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight mb-2">
              Connect Your First Brokerage
            </h3>
            <p className="text-zinc-500 text-sm mb-6 max-w-md mx-auto">
              Link your brokerage accounts to automatically track your portfolio and see real-time performance across all your investments.
            </p>
          </div>
        )}

        {/* Portfolio Content */}
        {brokerageConnected && (
          <>
            {loadingPositions ? (
              <div className="py-32 md:py-40 text-center">
                <RefreshCw size={32} className="mx-auto mb-4 text-[#00ff4e] animate-spin" />
                <p className="text-zinc-500 text-sm uppercase tracking-widest font-black">Loading Positions...</p>
              </div>
            ) : positions.length === 0 ? (
              <div className="py-20 text-center opacity-50 border-2 border-dashed border-zinc-900 rounded-xl">
                <Wallet size={48} className="mx-auto mb-4 text-zinc-700" />
                <p className="text-xs md:text-sm tracking-[0.4em] md:tracking-[0.5em] uppercase font-black">
                  No positions in {connectedBrokerages.find(b => b.id === selectedBrokerage)?.name || 'this account'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Portfolio Summary for Selected Brokerage */}
                <div className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">
                      {connectedBrokerages.find(b => b.id === selectedBrokerage)?.name || 'Portfolio'} Summary
                    </h3>
                    <button
                      onClick={() => fetchAllPositions()}
                      disabled={loadingPositions}
                      className="flex items-center gap-2 text-xs text-zinc-500 hover:text-[#00ff4e] transition-colors"
                    >
                      <RefreshCw size={14} className={loadingPositions ? 'animate-spin' : ''} />
                      Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-zinc-600 mb-1">Total Value</p>
                      <p className="text-2xl font-black text-white">
                        ${positions.reduce((sum, p) => sum + (p.value ?? 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-600 mb-1">Total Gain/Loss</p>
                      <p className={`text-2xl font-black ${positions.reduce((sum, p) => sum + (p.gain ?? 0), 0) >= 0 ? 'text-[#00ff4e]' : 'text-red-500'}`}>
                        {positions.reduce((sum, p) => sum + (p.gain ?? 0), 0) >= 0 ? '+' : ''}
                        ${Math.abs(positions.reduce((sum, p) => sum + (p.gain ?? 0), 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-600 mb-1">Cost Basis</p>
                      <p className="text-2xl font-black text-white">
                        ${positions.reduce((sum, p) => sum + (p.costBasis ?? 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-600 mb-1">Positions</p>
                      <p className="text-2xl font-black text-white">{positions.length}</p>
                    </div>
                  </div>
                </div>

                {/* Combined Portfolio Summary (if multiple brokerages) */}
                {connectedBrokerages.length > 1 && (
                  <div className="bg-gradient-to-r from-[#00ff4e]/5 to-transparent border-2 border-[#00ff4e]/20 rounded-xl p-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#00ff4e] mb-4">
                      Combined Portfolio (All Accounts)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Total Value</p>
                        <p className="text-xl font-black text-white">
                          ${allPositions.reduce((sum, p) => sum + (p.value ?? 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Total Gain/Loss</p>
                        <p className={`text-xl font-black ${allPositions.reduce((sum, p) => sum + (p.gain ?? 0), 0) >= 0 ? 'text-[#00ff4e]' : 'text-red-500'}`}>
                          {allPositions.reduce((sum, p) => sum + (p.gain ?? 0), 0) >= 0 ? '+' : ''}
                          ${Math.abs(allPositions.reduce((sum, p) => sum + (p.gain ?? 0), 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Total Positions</p>
                        <p className="text-xl font-black text-white">{allPositions.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Accounts</p>
                        <p className="text-xl font-black text-white">{connectedBrokerages.length}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Position Cards */}
                {positions.map((position, index) => {
                  const isPositionAdded = flattenedWatchlist.some(s => s.symbol === position.symbol);
                  const isHoveringThisPosition = hoveringPositionSymbol === position.symbol;
                  
                  return (
                    <motion.div
                      key={position.symbol}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-6 hover:border-zinc-700 transition-all relative"
                    >
                      {/* Add to List Button */}
                      <div className="absolute top-4 right-4 z-10">
                        <button 
                          data-add-button={`position-${position.symbol}`}
                          onMouseEnter={() => setHoveringPositionSymbol(position.symbol)}
                          onMouseLeave={() => setHoveringPositionSymbol(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!user) {
                              alert('Please sign in to add stocks to lists');
                              return;
                            }
                            
                            if (isPositionAdded && isHoveringThisPosition) {
                              const listWithStock = watchlists.find(list => 
                                list.stocks.some(s => s.symbol === position.symbol)
                              );
                              if (listWithStock) {
                                removeStockFromList(listWithStock.id, position.symbol);
                              }
                            } else if (!isPositionAdded) {
                              const stockObj = {
                                symbol: position.symbol,
                                name: position.name,
                                price: position.price?.toFixed(2) || '0.00',
                                change: position.gainPercent?.toFixed(2) || '0.00',
                                isPositive: position.gain >= 0,
                                range: 'N/A',
                                confidence: 0,
                                volatility: 0,
                                rating: 'N/A',
                                momentum: 'N/A',
                                catalyst: 'Portfolio Position',
                                insights: []
                              };
                              setShowAddToListMenu(stockObj);
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all active:scale-95 ${
                            isPositionAdded
                              ? isHoveringThisPosition
                                ? "border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                : "border-[#00ff4e]/50 bg-[#00ff4e]/10 text-[#00ff4e]"
                              : "border-zinc-800 bg-black text-zinc-500 hover:text-[#00ff4e] hover:border-[#00ff4e]/50"
                          }`}
                        >
                          <span className="text-xs font-black uppercase tracking-wider hidden sm:inline">
                            {isPositionAdded
                              ? isHoveringThisPosition ? "Remove" : "Added"
                              : "Add"
                            }
                          </span>
                          {isPositionAdded && isHoveringThisPosition ? (
                            <Trash2 size={14} />
                          ) : (
                            <Plus size={14} />
                          )}
                        </button>

                        {/* Add to List Dropdown for Positions */}
                        {showAddToListMenu?.symbol === position.symbol && (() => {
                          const buttonElement = document.querySelector(`button[data-add-button="position-${position.symbol}"]`);
                          const rect = buttonElement?.getBoundingClientRect();
                          
                          return ReactDOM.createPortal(
                            <>
                              <div 
                                className="fixed inset-0 bg-transparent z-[99998]"
                                onClick={() => setShowAddToListMenu(null)}
                              />
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
                                    setShowAddToListMenu(null);
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
                                    const isInList = list.stocks.some(s => s.symbol === position.symbol);
                                    return (
                                      <button
                                        key={list.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isInList) {
                                            addStockToList(showAddToListMenu, list.id);
                                          }
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
                      </div>

                      <div 
                        className="cursor-pointer"
                        onClick={() => {
                          setManualSearch(position.symbol);
                          setActiveTab("DASHBOARD");
                          runScanner(position.symbol);
                        }}
                      >
                        {/* Header */}
                        <div className="mb-6">
                          <p className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">{position.name}</p>
                          
                          <div className="flex flex-col md:flex-row md:items-baseline gap-3 md:gap-6">
                            <h3 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">{position.symbol}</h3>
                            <div className="flex items-baseline gap-3">
                              <p className="text-2xl md:text-3xl font-black text-white tabular-nums leading-none">
                                ${position.price?.toFixed(2) ?? '0.00'}
                              </p>
                              <p className={`text-lg md:text-xl font-black tabular-nums leading-none ${position.gain >= 0 ? 'text-[#00ff4e]' : 'text-red-500'}`}>
                                {position.gain >= 0 ? '+' : ''}{position.gainPercent?.toFixed(2) ?? '0.00'}%
                                <span className="ml-2 align-middle">{position.gain >= 0 ? '▲' : '▼'}</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t-2 border-zinc-900">
                          <div>
                            <p className="text-xs text-zinc-600 mb-1">Shares</p>
                            <p className="text-lg font-black text-white">{position.quantity ?? '0'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-600 mb-1">Market Value</p>
                            <p className="text-lg font-black text-white">${position.value?.toLocaleString() ?? '0'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-600 mb-1">Cost Basis</p>
                            <p className="text-lg font-black text-white">${position.costBasis?.toLocaleString() ?? '0'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-600 mb-1">Gain/Loss</p>
                            <p className={`text-lg font-black ${position.gain >= 0 ? 'text-[#00ff4e]' : 'text-red-500'}`}>
                              {position.gain >= 0 ? '+' : ''}${Math.abs(position.gain ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </>
    )}
  </>
) : (
  // NEWS tab conten
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
        {/* WATCHLIST MODAL */}
      <WatchlistModal
        isOpen={showWatchlistModal}
        onClose={() => {
          setShowWatchlistModal(false);
          setEditingWatchlist(null);
        }}
        onSave={editingWatchlist ? handleUpdateWatchlist : handleCreateWatchlist}
        editList={editingWatchlist}
      />


      {/* USER PROFILE MODAL */}
<UserProfileModal
  isOpen={showUserProfileModal}
  onClose={() => {
    setShowUserProfileModal(false);
    setViewingUser(null);
  }}
  user={viewingUser}
  currentUserId={user?.uid}
  isFollowing={viewingUser ? followingUsers.has(viewingUser.id) : false}
  onFollow={handleFollowUser}
  onUnfollow={handleUnfollowUser}
/>

{/* STOCK CHAT MODAL */}
<StockChatModal
  isOpen={!!showStockChat}
  onClose={() => setShowStockChat(null)}
  stock={showStockChat}
  aiModel={aiModel}
/>

{/* Footer */}
<footer className="mt-16 pt-8 border-t-2 border-zinc-900 text-center">
  <a 
    href="/privacy"
    className="text-zinc-600 hover:text-[#00ff4e] text-xs font-bold uppercase tracking-wider transition-colors"
  >
    Privacy Policy
  </a>
</footer>

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

const MetricCard = React.memo(function MetricCard({ stock, isMarketOpen, onAction, actionType, watchlist = [], removeFromWatchlist, showAddToListMenu, onCloseMenu, watchlists = [], onAddToList, user, onOpenChat }) {
  
  // Generate a unique ID for this component instance
  const instanceId = useRef(Math.random().toString(36).substr(2, 9));
  
  console.log(`MetricCard ${stock.symbol} [${instanceId.current}] rendered`);

  const [isOpen, setIsOpen] = useState(false);  
  const [isHoveringButton, setIsHoveringButton] = useState(false);
  const cardRef = useRef(null);
  const prevPrice = useRef(null); // Start with null
  const prevChange = useRef(null); // Start with null
  const hasAnimatedRef = useRef(false); // Track if we've animated once
  
  const accent = stock.isPositive ? '#00ff4e' : '#FF4B2B';
  const isPositive = parseFloat(stock.change) >= 0;
  const trendColor = isPositive ? '#00ff4e' : '#FF4B2B';
  const Triangle = isPositive ? '▲' : '▼';
  const prefix = isPositive ? '+' : '';
  const isAlreadyAdded = watchlist.some(s => s.symbol === stock.symbol);
  
  // Only animate if: (1) first time seeing this stock, OR (2) price/change actually changed
  const shouldAnimate = !hasAnimatedRef.current || 
                       (prevPrice.current !== null && prevPrice.current !== stock.price) ||
                       (prevChange.current !== null && prevChange.current !== stock.change);

  // Update refs after render
  useEffect(() => {
    prevPrice.current = stock.price;
    prevChange.current = stock.change;
    hasAnimatedRef.current = true; // Mark as animated
  }, [stock.price, stock.change]);

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


  // Close add-to-list menu on scroll
  useEffect(() => {
    if (!showAddToListMenu) return;
    
    const handleScroll = () => {
      onCloseMenu();
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showAddToListMenu, onCloseMenu]);

  console.log('Testing icons:', { Target, BarChart3, TrendingUp, Lightbulb, AlertTriangle, Clock });


  return (
    <div 
      ref={cardRef}
      className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-8 relative hover:border-zinc-600 transition-all overflow-hidden group"
    >
{/* ACTION BUTTONS */}
<div className="absolute top-3 right-3 md:top-4 md:right-8 z-10 flex gap-2">
  {/* Ask AI Button */}
  <button 
    onClick={(e) => {
      e.stopPropagation();
      onOpenChat && onOpenChat(stock);
    }}
    className="flex items-center gap-2 px-3 md:px-5 py-2 rounded-lg border border-zinc-800 bg-black text-zinc-500 hover:text-[#00ff4e] hover:border-[#00ff4e]/50 transition-all active:scale-95"
  >
    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] leading-none hidden sm:inline">
      Ask AI
    </span>
    <MessageCircle size={12} className="md:w-3.5 md:h-3.5" />
  </button>

  {/* Existing Add/Remove Button */}
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
      <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] leading-none hidden sm:inline">
        Remove
      </span>
      <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
    </button>
  ) : (
    <>
      <button 
        data-add-button="true"
        onMouseEnter={() => setIsHoveringButton(true)}
        onMouseLeave={() => setIsHoveringButton(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (!user) {
            alert('Please sign in to add stocks to lists');
            return;
          }
          
          if (isAlreadyAdded && isHoveringButton) {
            const listWithStock = watchlists.find(list => 
              list.stocks.some(s => s.symbol === stock.symbol)
            );
            if (listWithStock) {
              removeFromWatchlist(listWithStock.id, stock.symbol);
            }
          } else if (!isAlreadyAdded) {
            onAction(stock);
          }
        }}
        className={`flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 rounded-lg border transition-all active:scale-95 ${
          isAlreadyAdded 
            ? isHoveringButton
              ? "border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20"
              : "border-[#00ff4e]/50 bg-[#00ff4e]/10 text-[#00ff4e]"
            : "border-zinc-800 bg-black text-zinc-500 hover:text-[#00ff4e] hover:border-[#00ff4e]/50"
        }`}
      >
        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] leading-none hidden sm:inline">
          {isAlreadyAdded 
            ? isHoveringButton ? "Remove" : "Added"
            : "Add"
          }
        </span>
        {isAlreadyAdded && isHoveringButton ? (
          <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
        ) : (
          <Plus size={12} className="md:w-3.5 md:h-3.5" />
        )}
      </button>

      {/* Add to List Dropdown */}
      {showAddToListMenu?.symbol === stock.symbol && (() => {
        // Find the button element to position relative to it
        const buttonElement = cardRef.current?.querySelector('button[data-add-button="true"]');
        const rect = buttonElement?.getBoundingClientRect();
        
        return ReactDOM.createPortal(
          <>
            <div 
              className="fixed inset-0 bg-transparent z-[99998]"
              onClick={() => onCloseMenu()}
            />
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
              
              {/* Create New List Option */}
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
                        if (!isInList) {
                          onAddToList(stock, list.id);
                        }
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
              <span className="text-3xl md:text-5xl font-black text-white tabular-nums leading-none">
                ${shouldAnimate ? (
                  <CountUp end={parseFloat(stock.price)} decimals={2} duration={1200} />
                ) : (
                  parseFloat(stock.price).toFixed(2)
                )}
              </span>
              <span className="text-xl md:text-3xl font-black tabular-nums leading-none" style={{ color: trendColor }}>
                {prefix}{shouldAnimate ? (
                  <CountUp end={Math.abs(parseFloat(stock.change))} decimals={2} duration={1200} />
                ) : (
                  Math.abs(parseFloat(stock.change)).toFixed(2)
                )}% <span className="text-lg md:text-2xl ml-1 md:ml-2 align-middle">{Triangle}</span>
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
    <span style={{ color: '#00ff4e' }}>
      {stock.confidence}%
    </span>
  </div>
  <div className="h-[2px] md:h-[3px] bg-zinc-900 w-full relative">
    <div 
      className="absolute h-full bg-[#00ff4e] shadow-[0_0_15px_#00ff4e]" 
      style={{ width: `${stock.confidence}%` }}
    />
  </div>
</div>
  <div>
    <div className="flex justify-between items-end mb-2">
      <span className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center">
        Volatility Index
        <Tooltip content="Historical Volatility (HV) calculated using annualized standard deviation of daily returns over 30 days. Higher volatility indicates larger price swings and higher risk/reward potential. Values above 60% are considered highly volatile." />
      </span>
      <span className="text-[10px] md:text-xs font-mono text-[#00ff4e] bg-[#00ff4e]/10 px-2 py-0.5 rounded">{stock.volatility}%</span>
    </div>
    <div className="h-[2px] bg-zinc-800 rounded-full overflow-hidden">
      <div 
        className={`h-full shadow-[0_0_15px] ${stock.volatility > 35 ? 'bg-red-500 shadow-red-500' : 'bg-[#00ff4e] shadow-[#00ff4e]'}`} 
        style={{ width: `${stock.volatility}%` }}
      />
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
{stock.insights.map((point, i) => {
  // Check if insight starts with a label
    console.log('Insight', i, ':', point); // ADD THIS LINE

const labelMatch = point.match(/^(CATALYST|FUNDAMENTAL|TECHNICAL|OPPORTUNITY|RISK|TIMING)\s*:?\s*(.+)$/);    
console.log('Label match:', labelMatch); // ADD THIS LINE


  if (labelMatch) {
    const label = labelMatch[1];
    const content = labelMatch[2];

        console.log('Rendering with icon:', label); // ADD THIS LINE

    
    // Explicitly map each label to its icon and color
    let IconComponent = null;
    let color = '#00ff4e';
    
    if (label === 'CATALYST') {
      IconComponent = Target;
      color = '#00ff4e';
    } else if (label === 'FUNDAMENTAL') {
      IconComponent = BarChart3;
      color = '#3b82f6';
    } else if (label === 'TECHNICAL') {
      IconComponent = TrendingUp;
      color = '#f59e0b';
    } else if (label === 'OPPORTUNITY') {
      IconComponent = Lightbulb;
      color = '#10b981';
    } else if (label === 'RISK') {
      IconComponent = AlertTriangle;
      color = '#ef4444';
    } else if (label === 'TIMING') {
      IconComponent = Clock;
      color = '#8b5cf6';
    }
    
    return (
      <div key={i} className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {IconComponent && <IconComponent size={14} style={{ color }} />}
            <span 
              className="text-[10px] font-black uppercase px-2 py-0.5 rounded"
              style={{ 
                color,
                backgroundColor: `${color}10`,
                border: `1px solid ${color}30`
              }}
            >
              {label}
            </span>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed pl-5">
            {content}
          </p>
        </div>
      </div>
    );
  }
  
  // Fallback for unlabeled insights
  return (
    <div key={i} className="flex items-start gap-3">
      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#00ff4e] shrink-0 shadow-[0_0_5px_#00ff4e]" />
      <p className="text-zinc-300 text-sm leading-relaxed">{point}</p>
    </div>
  );
})}
                </div>
                <div className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl p-3 md:p-4">
                  <div className="flex justify-between items-center mb-3 md:mb-4">
                    <h4 className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">Intraday Pulse</h4>
                    <span className="text-[8px] md:text-[10px] font-bold text-[#00ff4e]">LIVE</span>
                  </div>
                  <MiniChart  symbol={stock.symbol} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.stock.price === nextProps.stock.price &&
    prevProps.stock.change === nextProps.stock.change &&
    prevProps.stock.symbol === nextProps.stock.symbol &&
    prevProps.isMarketOpen === nextProps.isMarketOpen &&
    prevProps.showAddToListMenu?.symbol === nextProps.showAddToListMenu?.symbol &&
    prevProps.watchlist.length === nextProps.watchlist.length  // Add this line
  );
});


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
