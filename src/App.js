import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import CountUp from './CountUp';
import SkeletonCard from './SkeletonCard';
import WatchlistModal from './WatchlistModal';
import { createWatchlist, getUserWatchlists, getPublicWatchlists, addStockToWatchlist, removeStockFromWatchlist, updateWatchlist, deleteWatchlist } from './watchlistService';
import { followUser, unfollowUser, isFollowing, getFollowers, getFollowing, searchUsers } from './followService';
import { Users } from 'lucide-react';
import UserProfileModal from './UserProfileModal';
import PlaidLink from './PlaidLink';
import StockChatModal from './StockChatModal';
import { MessageCircle } from 'lucide-react';



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
function Clock() {
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
const [positions, setPositions] = useState([]);
const [loadingPositions, setLoadingPositions] = useState(false);
const [brokerageConnected, setBrokerageConnected] = useState(false);
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





const flattenedWatchlist = useMemo(() => {
  return watchlists.flatMap(l => l.stocks);
}, [watchlists]);
  


  

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

const fetchPositions = useCallback(async () => {
  if (!user) return;
  
  setLoadingPositions(true);
  try {
    const idToken = await auth.currentUser.getIdToken();
    
    const response = await fetch('https://us-central1-jckrbbt-869de.cloudfunctions.net/getHoldings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });
    
    const result = await response.json();
    
    // Transform Plaid data to our format
    const holdingsData = result.holdings.map(holding => {
      const security = result.securities.find(s => s.security_id === holding.security_id);
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
    
    setPositions(holdingsData);
  } catch (error) {
    console.error('Error fetching positions:', error);
    alert('Error loading positions. Please try reconnecting your account.');
  } finally {
    setLoadingPositions(false);
  }
}, [user]);

// Add these memoized callbacks AFTER fetchPositions
const handlePlaidSuccess = useCallback(() => {
  console.log('Plaid connection successful!');
  setBrokerageConnected(true);
  fetchPositions();
}, [fetchPositions]);

const handlePlaidError = useCallback((error) => {
  console.error('Plaid error details:', error);
}, []);

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
        
        // Check if brokerage is connected and load positions
        if (data.brokerageConnected) {
          setBrokerageConnected(true);
          fetchPositions();
        }
        
      } else {
        // Initialize counts for new users
        await setDoc(doc(db, 'users', currentUser.uid), {
          followerCount: 0,
          followingCount: 0
        }, { merge: true });
        
        setUserProfile({
          username: null,
          profilePicUrl: null,
          followerCount: 0,
          followingCount: 0
        });
      }

   } else {
  // Not logged in
  setWatchlists([]);
      setUserProfile(null);
    }
  });

  
  
  return () => unsubscribe();
}, [fetchPositions]);

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

  // --- NEURAL SCANNER LOGIC ---
const runScanner = useCallback(async (tickerToSearch = null) => {
  setLoading(true);
  clearInterval(watchlistIntervalRef.current);
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
    const targetGoal = isManual ? 1 : 5; // Changed from 10

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

IMPORTANT: Provide DIVERSE results across different sectors and catalyst types. Don't focus on just one sector.
RANDOMIZATION: Include a mix of biotech, tech, finance, energy, and consumer stocks.

CRITICAL RULES:
1. Return ONLY valid US-traded stock tickers (2-5 letters, listed on NYSE/NASDAQ/AMEX)
2. NO ADRs, NO foreign stocks, NO Chinese companies
3. Every stock MUST have a SPECIFIC catalyst from the past 7 days OR upcoming in next 14 days
4. NO stocks based solely on "near 52-week high" or "technical setup"

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

REQUIRED CATALYST TYPES (stock must have at least ONE):

1. BIOTECH/PHARMA BINARY EVENTS (Highest Priority):
   - "FDA PDUFA approval decision date [specific date in next 14 days]"
   - "Phase 3 clinical trial data readout [specific date]"
   - "FDA panel meeting scheduled [date]"
   - "Oncology conference presentation [specific date]"
   Must include SPECIFIC DATE within next 2 weeks

2. EARNINGS WITH MOMENTUM:
   - "Earnings report [date] analyst expects beat"
   - "Earnings this week strong guidance expected"
   - "Earnings surprise last quarter revenue growth"
   Must have earnings within 7 days OR recent beat within 14 days

3. INSIDER/INSTITUTIONAL BUYING:
   - "CEO insider buying Form 4 filed [date within 7 days]"
   - "Hedge fund 13F new position disclosed [recent date]"
   - "Director purchased shares [date within 14 days]"
   Must show RECENT insider buying (not months ago)

4. M&A/ACQUISITION NEWS:
   - "Merger announced [date within 30 days]"
   - "Acquisition target rumored [recent report]"
   - "Activist investor stake revealed [date within 14 days]"
   Must have concrete M&A news/rumor from past month

5. ANALYST UPGRADES (Recent):
   - "Upgraded to buy [analyst firm] [date within 7 days]"
   - "Price target raised [date within 14 days]"
   - "Initiated coverage outperform [recent]"
   Must be RECENT upgrade (not old)

6. REGULATORY/GOVERNMENT CATALYSTS:
   - "Contract awarded [specific contract] [date]"
   - "Regulatory approval granted [date within 30 days]"
   - "Policy change benefits [specific company]"
   Must have specific government/regulatory news

7. PRODUCT LAUNCHES/PARTNERSHIPS:
   - "New product launched [date within 30 days]"
   - "Partnership announced with [major company] [date]"
   - "Revenue guidance raised [date within 30 days]"
   Must have concrete business development news

STRICT REJECTION CRITERIA:
✗ Only "approaching 52-week high" with no other catalyst
✗ Only "technical breakout" without news
✗ Generic "sector momentum" without company-specific catalyst
✗ ADRs or foreign stocks (ending in .L, .HK, etc)
✗ News older than 30 days with nothing recent
✗ "Potential" or "could" catalysts - need CONFIRMED events

DIVERSITY REQUIREMENTS:
- Include mix of small-cap ($300M-$2B), mid-cap ($2B-$10B), and large-cap (>$10B)
- At least 3 different sectors represented
- Include at least 2 stocks over $50 per share for diversification
- Avoid penny stocks under $2

TRUSTED NEWS SOURCES ONLY: ${sourceString}

${excludeStr}

SEARCH PROCESS:
1. Search for "biotech FDA approval January 2026 PDUFA date"
2. Search for "earnings this week analyst upgrades"
3. Search for "insider buying Form 4 filed this week"
4. Search for "merger acquisition announced January 2026"
5. For each result, verify it has a SPECIFIC catalyst and is US-traded

OUTPUT FORMAT: Return ONLY a comma-separated list of 200-300 US stock tickers.
Example: ABCD, EFGH, IJKL, MNOP

DO NOT include tickers unless you found SPECIFIC catalyst information.
`;

        const aiRes = await aiModel.generateContent({
          contents: [{ role: "user", parts: [{ text: discoveryPrompt }] }],
          tools: [{ googleSearch: {} }] 
        });
        
        const aiText = await aiRes.response.text();
        const foundSymbols = (aiText || "").match(/\b[A-Z]{2,5}\b/g) || [];
        tickersToProcess = [...new Set(foundSymbols)];
      }

const blacklist = ["CNBC", "CNN", "FRED", "WSJ", "NYSE", "NASDAQ", "BLOOMBERG", "REUTERS", "FDA", "JAN", "FEB", "AI", "ML", "EV", "CEO", "CFO", "IPO", "ETF", "ESG"];
const foreignSuffixes = [".L", ".HK", ".TO", ".AX", ".PA", ".DE"];

const tickers = tickersToProcess.filter(t => {
  if (blacklist.includes(t)) return false;
  if (foreignSuffixes.some(suffix => t.includes(suffix))) return false;
  if (t.length > 5) return false;
  if (recentlyScanned.has(t)) return false; // NEW: Skip recently scanned
  return true;
});

// NEW: User-specific randomization for legal compliance
const seed = user?.uid ? `${user.uid}-${new Date().toDateString()}` : Date.now().toString();
const shuffledTickers = tickers.sort((a, b) => {
  return hashCode(seed + a) - hashCode(seed + b);
}).slice(0, 50); // Take first 50 for processing

for (const ticker of shuffledTickers) {
  if (localStocks.length >= targetGoal) break;

try {
  // Add delay BEFORE making requests to avoid rate limiting
  await new Promise(r => setTimeout(r, 2000));

  const qUrl = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`;
  const nUrl = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${yDate}&to=${fDate}&token=${FINNHUB_KEY}`;    
  const pUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`;

  // Fetch with error handling
  let q, n, p;
  try {
    [q, n, p] = await Promise.all([
      fetch(qUrl).then(r => {
        if (!r.ok) throw new Error(`Finnhub error: ${r.status}`);
        return r.json();
      }),
      fetch(nUrl).then(r => {
        if (!r.ok) throw new Error(`Finnhub error: ${r.status}`);
        return r.json();
      }),
      fetch(pUrl).then(r => {
        if (!r.ok) throw new Error(`Finnhub error: ${r.status}`);
        return r.json();
      })
    ]);
  } catch (fetchError) {
    console.log(`${ticker} - Finnhub API error, skipping:`, fetchError.message);
    console.log(`${ticker} - Finnhub quote data:`, { c: q.c, v: q.v, av: q.av, dp: q.dp });
    rejectedTickers.add(ticker);
    continue;
  }

  // Validate data
  if (!q || !q.c || q.c === 0) {
    console.log(`${ticker} - Invalid quote data`);
    rejectedTickers.add(ticker);
    continue;
  }

// Fetch historical data from Twelve Data (800 calls/day free)
let h = { c: [] };

// Check cache first
if (volatilityCache[ticker]) {
  console.log(`${ticker} - Using cached volatility data`);
  h = { c: volatilityCache[ticker] };
} else {
  try {
    // Twelve Data API - much better free tier
    console.log('Twelve Data Key:', TWELVE_DATA_KEY?.substring(0, 10) + '...');
    const twelveUrl = `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=1day&outputsize=90&apikey=${TWELVE_DATA_KEY}`;
    const twelveRes = await fetch(twelveUrl);
    const twelveData = await twelveRes.json();
    
    if (twelveData.values && twelveData.values.length > 0) {
      const closePrices = twelveData.values
        .map(day => parseFloat(day.close))
        .reverse();
      h = { c: closePrices };
      
      // Cache the data
      setVolatilityCache(prev => ({ ...prev, [ticker]: closePrices }));
      console.log(`${ticker} - Cached ${closePrices.length} data points from Twelve Data`);
    } else if (twelveData.status === 'error') {
      console.log(`${ticker} - Twelve Data error:`, twelveData.message);
    }
  } catch (e) {
    console.log(`Twelve Data error for ${ticker}:`, e);
  }
}

// ADD TECHNICAL BREAKOUT CONFIRMATION HERE:
// Calculate technical setup
const fiftyTwoWeekHigh = q.h;
const fiftyTwoWeekLow = q.l;
const currentPrice = q.c;
const priceNearHigh = (currentPrice / fiftyTwoWeekHigh) > 0.95; // Within 5% of highs
const priceFromLow = ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100; // % above low

const technicalContext = `
TECHNICAL SETUP:
- Current: $${currentPrice.toFixed(2)}
- 52W High: $${fiftyTwoWeekHigh.toFixed(2)}
- 52W Low: $${fiftyTwoWeekLow.toFixed(2)}
- Near Highs: ${priceNearHigh ? 'YES - Within 5%, potential breakout zone' : 'NO'}
- From Low: +${priceFromLow.toFixed(1)}%
`;

if (!isManual) {
  if (q.c < 2) {
    rejectedTickers.add(ticker);
    continue;
  }
  
  if (q.c > scanPriceLimit) {
    rejectedTickers.add(ticker);
    continue;
  }
  
  // Volume check - only apply if we have valid average volume data
  const currentVolume = q.v || 0;
  const avgVolume = q.av || 0;
  
  // Only check volume if avgVolume exists and is meaningful
  if (avgVolume > 0) {
    const volumeRatio = currentVolume / avgVolume;
    
    // Reject if volume is significantly below average (less than 0.5x)
    // Changed from 1.5x to be less strict
    if (volumeRatio < 0.5) {
      console.log(`${ticker} - Very low volume (${volumeRatio.toFixed(2)}x avg), skipping`);
      rejectedTickers.add(ticker);
      continue;
    }
    
    if (volumeRatio >= 1.5) {
      console.log(`${ticker} - Volume check passed (${volumeRatio.toFixed(2)}x avg) ✓`);
    }
  } else {
    console.log(`${ticker} - No average volume data, skipping volume check`);
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
    ${technicalContext}
    NEWS (Past 7 Days): ${headlines}
    COMPANY: ${p.name || ticker}
    
    Provide a comprehensive analysis regardless of catalyst strength.
    
    ANALYZE:
    1. Price momentum and technical setup
    2. Recent news developments (even if minor)
    3. Sector trends and peer comparison
    4. Risk factors and potential headwinds
    5. TIMING - When should traders act?
    
    FORMAT (Use EXACT tags):
    NAME: ${p.name || 'Unknown'}
    [RANGE] $XX.XX - $XX.XX [/RANGE]
    [SIG] BULLISH or BEARISH [/SIG]
    [MOM] Positive, Steady, or Uncertain [/MOM]
    [CAT] Brief description of main driver or "Routine Trading" [/CAT]
    [TIMING] ENTER_NOW or WATCH_FOR_PULLBACK or WAIT_FOR_BREAKOUT [/TIMING]
    [CONF] XX.XX [/CONF] (20-95 range, higher = more confident)
    [VOLATILITY] XX.XX [/VOLATILITY]
    [INSIGHTS]
    | First insight about price action or technical setup
    | Second insight about fundamentals or news
    | Third insight about risks or catalysts
    | Fourth insight about TIMING - explain your [TIMING] choice
    [/INSIGHTS]
    
    TIMING GUIDELINES:
    - ENTER_NOW: Catalyst imminent (0-3 days) OR breaking out with volume confirmation
    - WATCH_FOR_PULLBACK: Strong setup but extended (near resistance, overbought)
    - WAIT_FOR_BREAKOUT: Consolidating near highs, needs volume trigger
  `
  : `
    TICKER: ${ticker}
    PRICE: $${q.c} (52W: $${q.l} - $${q.h})
    ${technicalContext}
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
    [TIMING] ENTER_NOW or WATCH_FOR_PULLBACK or WAIT_FOR_BREAKOUT [/TIMING]
    [CONF] XX.XX [/CONF]
    [VOLATILITY] XX.XX [/VOLATILITY]
    [INSIGHTS]
    | Insight about catalyst or price action
    | Supporting technical or fundamental point
    | Risk consideration or alternative view
    | TIMING insight - explain when to enter based on setup
    [/INSIGHTS]
    
    TIMING GUIDELINES:
    - ENTER_NOW: Catalyst imminent (0-3 days) OR breaking out with volume
    - WATCH_FOR_PULLBACK: Strong setup but extended or overbought
    - WAIT_FOR_BREAKOUT: Consolidating, needs volume confirmation
    
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

const volumeRatio = (q.v || 0) / (q.av || 1);

console.log(`${ticker} - Historical data points:`, h.c?.length);
console.log(`${ticker} - Calculated HV:`, h.c && h.c.length >= 2 ? calculateHV(h.c) : 'FALLBACK');
console.log(`${ticker} - AI Confidence:`, aiConfidence);
console.log(`${ticker} - Signal Strength:`, calculateSignalStrength(n, h.c, q.c, h.c && h.c.length >= 2 ? calculateHV(h.c).toFixed(2) : 40, aiConfidence));

const newStock = {
  symbol: ticker.trim().toUpperCase(),
  name: p.name || clean(extract("NAME", resText)) || `${ticker} CORP`,
  price: q.c.toFixed(2),
  change: q.dp?.toFixed(2) || "0.00",
  isPositive: extract("SIG", resText).toUpperCase().includes("BULLISH"),
  range: clean(extract("RANGE", resText)),
  confidence: calculateSignalStrength(n, h.c, q.c, h.c && h.c.length >= 2 ? calculateHV(h.c).toFixed(2) : 40, aiConfidence, volumeRatio),
  volatility: h.c && h.c.length >= 2 ? calculateHV(h.c).toFixed(2) : (() => {
  // Intelligent fallback based on price change and sector
  const priceChange = Math.abs(parseFloat(q.dp || 0));
  
  // Base volatility from daily change (expand the range)
  let estimatedVol = 25 + (priceChange * 6);
  
  // Adjust for price level (lower price = higher volatility typically)
  if (q.c < 5) estimatedVol += 15;
  else if (q.c < 10) estimatedVol += 10;
  else if (q.c < 20) estimatedVol += 5;
  
  return Math.min(Math.max(estimatedVol, 20), 100).toFixed(2);
})(),
  rating: clean(extract("SIG", resText)),
  momentum: clean(extract("MOM", resText)),
  catalyst: formatText(clean(extract("CAT", resText))), 
  insights: extract("INSIGHTS", resText).split('|').map(i => formatText(clean(i))).filter(i => i.length > 5)
};

        localStocks.push(newStock);
        displayedTickers.add(ticker); 
        setStocks([...localStocks]); 

        // NEW: Add to recently scanned cooldown
        setRecentlyScanned(prev => new Set([...prev, ticker]));

        } catch (e) {
          rejectedTickers.add(ticker);
        }
      }
      if (isManual) break;
    }
 } catch (err) { console.error(err); }
  finally { 
    setLoading(false); 
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
      <Clock />
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
</header>

      <TypewriterGreeting />

      <div className="flex gap-2 md:gap-4 mb-6 md:mb-8 border-b border-zinc-900 pb-4 overflow-x-auto">
       {["DASHBOARD", "TRENDING", "DISCOVER", "MY LISTS", "MY POSITIONS", "NEWS"].map(tab => (
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
            className="flex-1 bg-black border border-zinc-800 text-white px-4 md:px-5 py-3 rounded-lg outline-none transition-all font-mono text-base placeholder:text-zinc-700 focus:border-[#00ff4e]/50"
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
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}
  {displayedStocks.map((stock, index) => (
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
    ) : !brokerageConnected ? (
      <div className="py-32 md:py-40 text-center border-2 border-dashed border-zinc-900 rounded-xl">
        <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight mb-4">
          Connect Your Brokerage
        </h3>
        <p className="text-zinc-500 text-sm mb-8 max-w-md mx-auto">
          Link your brokerage account to automatically track your portfolio and see real-time performance.
        </p>
<PlaidLink 
  user={user}
  onSuccess={handlePlaidSuccess}
  onError={handlePlaidError}
/>
      </div>
    ) : loadingPositions ? (
      <div className="py-32 md:py-40 text-center">
        <p className="text-zinc-500 text-sm uppercase tracking-widest font-black">Loading Positions...</p>
      </div>
    ) : positions.length === 0 ? (
      <div className="py-32 md:py-40 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
        <p className="text-xs md:text-sm tracking-[0.4em] md:tracking-[0.5em] uppercase font-black">No positions found</p>
      </div>
    ) : (
      <div className="space-y-4">
{/* Portfolio Summary */}
        <div className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-4">Portfolio Summary</h3>
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
            
            // If already added and hovering, remove it
            if (isPositionAdded && isHoveringThisPosition) {
              const listWithStock = watchlists.find(list => 
                list.stocks.some(s => s.symbol === position.symbol)
              );
              if (listWithStock) {
                removeStockFromList(listWithStock.id, position.symbol);
              }
            } else if (!isPositionAdded) {
              // Otherwise, show the add menu
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
                
                {/* Create New List Option */}
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
        {/* Header - Symbol, Name, Price, Change */}
        <div className="mb-6">
          <p className="text-xs text-zinc-500 font-black uppercase tracking-widest mb-2">{position.name}</p>
          
          {/* Mobile: Stacked layout */}
          <div className="flex flex-col md:hidden gap-3">
            <h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">{position.symbol}</h3>
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-black text-white tabular-nums leading-none">
                ${position.price?.toFixed(2) ?? '0.00'}
              </p>
              <p className={`text-xl font-black tabular-nums leading-none ${position.gain >= 0 ? 'text-[#00ff4e]' : 'text-red-500'}`}>
                {position.gain >= 0 ? '+' : ''}{position.gainPercent?.toFixed(2) ?? '0.00'}%
                <span className="ml-2 align-middle">{position.gain >= 0 ? '▲' : '▼'}</span>
              </p>
            </div>
          </div>
          
          {/* Desktop: Horizontal layout */}
          <div className="hidden md:flex items-baseline gap-6">
            <h3 className="text-5xl font-black text-white uppercase tracking-tighter leading-none">{position.symbol}</h3>
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-black text-white tabular-nums leading-none">
                ${position.price?.toFixed(2) ?? '0.00'}
              </p>
              <p className={`text-xl font-black tabular-nums ${position.gain >= 0 ? 'text-[#00ff4e]' : 'text-red-500'}`}>
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

