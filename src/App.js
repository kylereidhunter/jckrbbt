import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from 'react-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, getDocs, collection, query, where } from 'firebase/firestore';
import AuthModal from './AuthModal';
import ProfileSettings from './ProfileSettings';
import Tooltip from './tooltip';
import CountUp from './CountUp';
import SkeletonCard from './SkeletonCard';
import WatchlistModal from './WatchlistModal';
import { createWatchlist, getUserWatchlists, getPublicWatchlists, addStockToWatchlist, removeStockFromWatchlist, updateWatchlist, deleteWatchlist } from './watchlistService';
import { followUser, unfollowUser, isFollowing, getFollowers, getFollowing, searchUsers } from './followService';
import { Activity, Users, Trash2, Plus, MessageCircle, Search, Target, TrendingUp, BarChart3, Lightbulb, AlertTriangle, Clock, Link2, Unlink, ChevronDown, Building2, Wallet, RefreshCw, Zap, Sprout, LayoutDashboard, Flame, List, Briefcase, Newspaper, Send, Heart, History } from 'lucide-react';import PlaidLink from './PlaidLink';
import StockChatModal from './StockChatModal';
import UserProfileModal from './UserProfileModal';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, PieChart, Pie, Cell, Sector } from 'recharts';
import { logActivity, getActivityFeed, getGlobalFeed } from './activityService';


console.log('FINNHUB_KEY:', process.env.REACT_APP_FINNHUB_KEY);
console.log('GEN_AI_KEY:', process.env.REACT_APP_GEN_AI_KEY);

// --- CONFIGURATION ---
const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_KEY; 
const GEN_AI_KEY = process.env.REACT_APP_GEN_AI_KEY;
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const ALPHA_VANTAGE_KEY = process.env.REACT_APP_ALPHA_VANTAGE_KEY;
const TWELVE_DATA_KEY = process.env.REACT_APP_TWELVE_DATA_KEY;
const POLYGON_KEY = process.env.REACT_APP_POLYGON_KEY;


const isMobile = () => window.innerWidth < 768;


// ========== NEWS SOURCES FOR SCANNING ==========
const NEWS_SOURCES = [
  // === MAJOR FINANCIAL NEWS ===
  { name: 'Wall Street Journal', domain: 'wsj.com' },
  { name: 'Bloomberg', domain: 'bloomberg.com' },
  { name: 'Financial Times', domain: 'ft.com' },
  { name: 'Reuters', domain: 'reuters.com' },
  { name: 'CNBC', domain: 'cnbc.com' },
  { name: 'Barrons', domain: 'barrons.com' },
  { name: 'MarketWatch', domain: 'marketwatch.com' },
  { name: 'Seeking Alpha', domain: 'seekingalpha.com' },
  { name: 'The Economist', domain: 'economist.com' },
  { name: 'Forbes', domain: 'forbes.com' },
  { name: 'Investors Business Daily', domain: 'investors.com' },
  { name: 'Yahoo Finance', domain: 'finance.yahoo.com' },
  { name: 'Benzinga', domain: 'benzinga.com' },
  { name: 'Morningstar', domain: 'morningstar.com' },
  { name: 'Zacks', domain: 'zacks.com' },
  { name: 'Motley Fool', domain: 'fool.com' },
  { name: 'Barchart', domain: 'barchart.com' },
  { name: 'Investing.com', domain: 'investing.com' },
  { name: 'Fortune', domain: 'fortune.com' },
  { name: 'Business Insider', domain: 'businessinsider.com' },
  { name: 'The Street', domain: 'thestreet.com' },
  { name: 'CNN Business', domain: 'cnn.com/business' },
  { name: 'Fox Business', domain: 'foxbusiness.com' },
  { name: 'Nikkei Asia', domain: 'asia.nikkei.com' },
  { name: 'TradingView', domain: 'tradingview.com' },
  { name: 'FinViz', domain: 'finviz.com' },
  { name: 'TipRanks', domain: 'tipranks.com' },
  { name: 'Investopedia', domain: 'investopedia.com' },
  { name: 'Bankrate', domain: 'bankrate.com' },
  { name: 'NerdWallet', domain: 'nerdwallet.com' },
  { name: 'Kiplinger', domain: 'kiplinger.com' },
  { name: 'CoinDesk', domain: 'coindesk.com' },
  { name: 'The Block', domain: 'theblock.co' },
  { name: 'South China Morning Post', domain: 'scmp.com' },
  { name: 'LiveMint', domain: 'livemint.com' },
  { name: 'Globe and Mail', domain: 'theglobeandmail.com' },
  { name: 'Australian Financial Review', domain: 'afr.com' },
  { name: 'WhaleWisdom', domain: 'whalewisdom.com' },
  { name: 'Dataroma', domain: 'dataroma.com' },
  { name: 'OpenInsider', domain: 'openinsider.com' },
  { name: 'ETF.com', domain: 'etf.com' },
  { name: 'ValueWalk', domain: 'valuewalk.com' },
  { name: 'Institutional Investor', domain: 'institutionalinvestor.com' },
  { name: 'Morning Brew', domain: 'morningbrew.com' },

  // === RESEARCH & ANALYTICS ===
  { name: 'GuruFocus', domain: 'gurufocus.com' },
  { name: 'Simply Wall St', domain: 'simplywall.st' },
  { name: 'Alpha Spread', domain: 'alphaspread.com' },
  { name: 'Stocktwits', domain: 'stocktwits.com' },
  { name: 'Fintel', domain: 'fintel.io' },
  { name: 'Ortex', domain: 'ortex.com' },
  { name: 'Unusual Whales', domain: 'unusualwhales.com' },
  { name: 'Market Chameleon', domain: 'marketchameleon.com' },
  { name: 'Bamsec', domain: 'bamsec.com' },
  { name: 'S&P Global', domain: 'spglobal.com' },
  { name: 'PitchBook', domain: 'pitchbook.com' },
  { name: 'CB Insights', domain: 'cbinsights.com' },
  { name: 'Crunchbase', domain: 'crunchbase.com' },
  { name: 'Insider Monkey', domain: 'insidermonkey.com' },

  // === BIOTECH & PHARMA ===
  { name: 'BioPharma Dive', domain: 'biopharmadive.com' },
  { name: 'FiercePharma', domain: 'fiercepharma.com' },
  { name: 'FierceBiotech', domain: 'fiercebiotech.com' },
  { name: 'MedCity News', domain: 'medcitynews.com' },
  { name: 'Endpoints News', domain: 'endpts.com' },
  { name: 'STAT News', domain: 'statnews.com' },
  { name: 'Clinical Trials Arena', domain: 'clinicaltrialsarena.com' },
  { name: 'BioSpace', domain: 'biospace.com' },
  { name: 'BioWorld', domain: 'bioworld.com' },
  { name: 'Pharmaceutical Technology', domain: 'pharmaceutical-technology.com' },
  { name: 'Drug Discovery Today', domain: 'drugdiscoverytoday.com' },

  // === PRESS RELEASES & FILINGS ===
  { name: 'GlobeNewswire', domain: 'globenewswire.com' },
  { name: 'PR Newswire', domain: 'prnewswire.com' },
  { name: 'Business Wire', domain: 'businesswire.com' },
  { name: 'EIN Presswire', domain: 'einpresswire.com' },
  { name: 'Accesswire', domain: 'accesswire.com' },
  { name: 'Cision', domain: 'cision.com' },
  { name: 'SEC EDGAR', domain: 'sec.gov/cgi-bin/browse-edgar' },

  // === TECH & STARTUPS ===
  { name: 'TechCrunch', domain: 'techcrunch.com' },
  { name: 'The Verge', domain: 'theverge.com' },
  { name: 'Ars Technica', domain: 'arstechnica.com' },
  { name: 'Wired', domain: 'wired.com' },
  { name: 'VentureBeat', domain: 'venturebeat.com' },
  { name: 'The Information', domain: 'theinformation.com' },
  { name: 'Techmeme', domain: 'techmeme.com' },
  { name: 'Hacker News', domain: 'news.ycombinator.com' },
  { name: 'SiliconANGLE', domain: 'siliconangle.com' },
  { name: 'ZDNet', domain: 'zdnet.com' },
  { name: 'CNET', domain: 'cnet.com' },
  { name: 'Engadget', domain: 'engadget.com' },
  { name: 'MIT Technology Review', domain: 'technologyreview.com' },

  // === ENERGY & COMMODITIES ===
  { name: 'Oil Price', domain: 'oilprice.com' },
  { name: 'Rigzone', domain: 'rigzone.com' },
  { name: 'Platts', domain: 'spglobal.com/platts' },
  { name: 'Argus Media', domain: 'argusmedia.com' },
  { name: 'Natural Gas Intelligence', domain: 'naturalgasintel.com' },
  { name: 'World Oil', domain: 'worldoil.com' },
  { name: 'Hart Energy', domain: 'hartenergy.com' },
  { name: 'Mining.com', domain: 'mining.com' },
  { name: 'Kitco', domain: 'kitco.com' },

  // === REAL ESTATE ===
  { name: 'Commercial Observer', domain: 'commercialobserver.com' },
  { name: 'The Real Deal', domain: 'therealdeal.com' },
  { name: 'CoStar', domain: 'costar.com' },
  { name: 'Bisnow', domain: 'bisnow.com' },
  { name: 'GlobeSt', domain: 'globest.com' },
  { name: 'National Real Estate Investor', domain: 'nreionline.com' },

  // === MACRO & ECONOMICS ===
  { name: 'Zero Hedge', domain: 'zerohedge.com' },
  { name: 'Real Vision', domain: 'realvision.com' },
  { name: 'Mauldin Economics', domain: 'mauldineconomics.com' },

  // === OPTIONS & DERIVATIVES ===
  { name: 'CBOE', domain: 'cboe.com' },
  { name: 'CME Group', domain: 'cmegroup.com' },
  { name: 'tastylive', domain: 'tastylive.com' },
  { name: 'Option Alpha', domain: 'optionalpha.com' },

  // === EARNINGS & TRANSCRIPTS ===
  { name: 'Earnings Whispers', domain: 'earningswhispers.com' },
  { name: 'Estimize', domain: 'estimize.com' },
  { name: 'The Transcript', domain: 'thetranscript.substack.com' },
  { name: 'AlphaStreet', domain: 'alphastreet.com' },
  { name: 'Quartr', domain: 'quartr.com' },

  // === INTERNATIONAL ===
  { name: 'Caixin', domain: 'caixinglobal.com' },
  { name: 'Economic Times India', domain: 'economictimes.indiatimes.com' },
  { name: 'Handelsblatt', domain: 'handelsblatt.com' },
  { name: 'Les Echos', domain: 'lesechos.fr' },
  { name: 'Nikkei', domain: 'nikkei.com' },
  { name: 'Korea Herald', domain: 'koreaherald.com' },
  { name: 'Straits Times', domain: 'straitstimes.com' },
];

const REPUTABLE_SOURCES = [
  // === MAJOR FINANCIAL NEWS ===
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
  
  // === RESEARCH & ANALYTICS ===
  "GuruFocus", "Simply Wall St", "Alpha Spread", "Stocktwits", "Trade Ideas",
  "Fintel", "Ortex", "Unusual Whales", "Market Chameleon", "Bamsec",
  "AlphaSense", "Sentieo", "S&P Global", "FactSet", "Capital IQ",
  "Pitchbook", "CB Insights", "Crunchbase",
  
  // === BIOTECH & PHARMA ===
  "BioPharma Dive", "FiercePharma", "MedCity News", "Endpoints News", 
  "STAT News", "Clinical Trials Arena", "FDA.gov", "ClinicalTrials.gov", 
  "BioSpace", "BioWorld", "Evaluate Pharma", "Drug Discovery Today",
  "Pharmaceutical Technology", "PharmaLive", "Fierce Biotech",
  
  // === PRESS RELEASES & FILINGS ===
  "GlobeNewswire", "PR Newswire", "Business Wire", "EIN Presswire", 
  "Shareholder.com", "Insider Monkey", "13F filings", "Form 4 filings", 
  "8-K filings", "Hedge Fund Tracker", "Accesswire", "Cision",
  
  // === TECH & STARTUPS ===
  "TechCrunch", "The Verge", "Ars Technica", "Wired", "VentureBeat",
  "The Information", "Protocol", "Techmeme", "Hacker News", "SiliconANGLE",
  "ZDNet", "CNET", "Engadget", "MIT Technology Review",
  
  // === ENERGY & COMMODITIES ===
  "Oil Price", "Rigzone", "Energy Intelligence", "Platts", "Argus Media",
  "Natural Gas Intelligence", "World Oil", "Upstream", "Hart Energy",
  "Mining.com", "Kitco", "Metal Bulletin",
  
  // === REAL ESTATE ===
  "Commercial Observer", "The Real Deal", "CoStar", "Bisnow", "GlobeSt",
  "Real Capital Analytics", "PERE News", "National Real Estate Investor",
  
  // === MACRO & ECONOMICS ===
  "Zero Hedge", "MacroVoices", "Real Vision", "Grant's Interest Rate Observer",
  "Evergreen Gavekal", "Mauldin Economics", "Bridgewater Daily Observations",
  "Bank for International Settlements", "IMF", "World Bank",
  
  // === OPTIONS & DERIVATIVES ===
  "Options Clearing Corporation", "CBOE", "CME Group", "tastylive",
  "Option Alpha", "Options Insider",
  
  // === EARNINGS & TRANSCRIPTS ===
  "Earnings Whispers", "Estimize", "The Transcript", "AlphaStreet",
  "Quartr", "Tikr Terminal",
  
  // === INTERNATIONAL ===
  "Caixin", "Economic Times India", "Handelsblatt", "Les Echos",
  "Il Sole 24 Ore", "Nikkei", "Yonhap News", "Korea Herald",
  "The Edge Malaysia", "Straits Times", "AFR", "NZX"
];

const sourceString = REPUTABLE_SOURCES.map(s => `site:${s}`).join(" OR ");

const cleanCompanyName = (name) => {
  if (!name) return name;
  return name
    .replace(/,?\s*(inc\.?|corp\.?|ltd\.?|llc\.?|plc\.?|n\.?v\.?|s\.?a\.?|co\.?|group|holdings?|enterprises?|international|&\s*co\.?)$/gi, '')
    .replace(/\s*(common\s+stock|class\s+[a-z](\s+common\s+stock)?|ordinary\s+shares?|american\s+depositary\s+(shares?|receipts?)|ads|adr|warrant.*|units?|series\s+[a-z])$/gi, '')
    .replace(/,?\s*$/, '')
    .trim();
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

// =============================================
// POLYGON WEBSOCKET HOOK
// =============================================
const usePolygonWebSocket = (apiKey, tickers, enabled = true) => {
  const [livePrices, setLivePrices] = useState({});
  const [wsStatus, setWsStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'
  const wsRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const subscribedTickers = useRef(new Set());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const connect = useCallback(() => {
    if (!apiKey || !enabled || tickers.length === 0) return;
    
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setWsStatus('connecting');
    const ws = new WebSocket('wss://socket.polygon.io/stocks');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to Polygon');
      // Authenticate
      ws.send(JSON.stringify({ action: 'auth', params: apiKey }));
    };

    ws.onmessage = (event) => {
      const messages = JSON.parse(event.data);
      
      messages.forEach((msg) => {
        // Auth success
        if (msg.ev === 'status' && msg.status === 'auth_success') {
          console.log('[WS] Authenticated');
          setWsStatus('connected');
          
          // Subscribe to aggregate per second for all tickers
          const subs = tickers.map(t => `A.${t}`).join(',');
          ws.send(JSON.stringify({ action: 'subscribe', params: subs }));
          subscribedTickers.current = new Set(tickers);
          console.log(`[WS] Subscribed to ${tickers.length} tickers`);
        }
        
        // Auth failed
        if (msg.ev === 'status' && msg.status === 'auth_failed') {
          console.error('[WS] Auth failed');
          setWsStatus('disconnected');
        }

        // Aggregate per second event
        if (msg.ev === 'A') {
          setLivePrices(prev => {
            const prevPrice = prev[msg.sym]?.price;
            const newPrice = msg.c; // close price of aggregate
            return {
              ...prev,
              [msg.sym]: {
                price: newPrice,
                prevPrice: prevPrice ?? newPrice,
                volume: msg.v,
                vwap: msg.vw,
                open: msg.o,
                high: msg.h,
                low: msg.l,
                timestamp: msg.s,
                direction: newPrice > (prevPrice ?? newPrice) ? 'up' : newPrice < (prevPrice ?? newPrice) ? 'down' : 'flat',
                updatedAt: Date.now()
              }
            };
          });
        }
      });
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };

ws.onclose = () => {
      console.log('[WS] Disconnected');
      setWsStatus('disconnected');
      wsRef.current = null;
      
      // Only reconnect during market hours (Mon-Fri, 4am-8pm ET)
      const now = new Date();
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const day = et.getDay();
      const hour = et.getHours();
      const isMarketDay = day >= 1 && day <= 5;
      const isMarketWindow = hour >= 4 && hour <= 20;
      
      if (enabledRef.current && isMarketDay && isMarketWindow) {
        reconnectTimeout.current = setTimeout(() => {
          console.log('[WS] Reconnecting...');
          connect();
        }, 5000);
      } else {
        console.log('[WS] Market closed, skipping reconnect');
      }
    };
  }, [apiKey, tickers, enabled]);



  // Connect on mount / when tickers change
  useEffect(() => {
    if (!enabled || tickers.length === 0) return;
    connect();
    
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled, tickers.length]);

  // Handle ticker changes without full reconnect
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const currentSubs = subscribedTickers.current;
    const newTickers = new Set(tickers);
    
    // Unsubscribe removed tickers
    const toUnsub = [...currentSubs].filter(t => !newTickers.has(t));
    if (toUnsub.length > 0) {
      wsRef.current.send(JSON.stringify({ 
        action: 'unsubscribe', 
        params: toUnsub.map(t => `A.${t}`).join(',') 
      }));
    }
    
    // Subscribe new tickers
    const toSub = [...newTickers].filter(t => !currentSubs.has(t));
    if (toSub.length > 0) {
      wsRef.current.send(JSON.stringify({ 
        action: 'subscribe', 
        params: toSub.map(t => `A.${t}`).join(',') 
      }));
    }
    
    subscribedTickers.current = newTickers;
  }, [tickers]);

  return { livePrices, wsStatus };
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
  const [sortBy, setSortBy] = useState("default");
  const [filterSignal, setFilterSignal] = useState("all");
  const [scanPriceMin, setScanPriceMin] = useState(2);
const [scanPriceMax, setScanPriceMax] = useState(500);
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
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
const [scanComplete, setScanComplete] = useState(true);
const [marketIndices, setMarketIndices] = useState(null);
const [loadingIndices, setLoadingIndices] = useState(false);
const [indicesLastUpdated, setIndicesLastUpdated] = useState(null);
const [scanStartIndex, setScanStartIndex] = useState(0);
const [followedLists, setFollowedLists] = useState([]);
const [followedListsData, setFollowedListsData] = useState([]);
const [feedActivities, setFeedActivities] = useState([]);
const [loadingFeed, setLoadingFeed] = useState(false);
const [following, setFollowing] = useState([]);
const [showDashboardNews, setShowDashboardNews] = useState(false);
const [showAllNews, setShowAllNews] = useState(false);
const [scanHistory, setScanHistory] = useState([]);
const [showScanHistory, setShowScanHistory] = useState(false);



// Sector mapping for filtering - includes Polygon SIC codes
const SECTOR_MAP = {
  'technology': [
    // General
    'Technology', 'Software', 'Semiconductors', 'IT Services', 'Hardware', 'Tech',
    // Polygon SIC codes
    'SERVICES-PREPACKAGED SOFTWARE',
    'SERVICES-COMPUTER PROGRAMMING',
    'SERVICES-COMPUTER PROCESSING',
    'SERVICES-COMPUTER INTEGRATED SYSTEMS',
    'SERVICES-COMPUTER PROGRAMMING SERVICES',
    'SERVICES-COMPUTER PROGRAMMING, DATA PROCESSING',
    'SERVICES-COMPUTER PROCESSING & DATA PREPARATION',
    'SERVICES-COMPUTER FACILITIES MANAGEMENT SERVICE',
    'SERVICES-INFORMATION RETRIEVAL SERVICES',
    'SERVICES-COMPUTER RENTAL & LEASING',
    'COMPUTER PROGRAMMING',
    'ELECTRONIC COMPUTERS',
    'COMPUTER PERIPHERAL EQUIPMENT',
    'COMPUTER COMMUNICATIONS EQUIPMENT',
    'COMPUTER STORAGE DEVICES',
    'COMPUTER TERMINALS',
    'SEMICONDUCTORS & RELATED DEVICES',
    'PRINTED CIRCUIT BOARDS',
    'RADIO & TV BROADCASTING & COMMUNICATIONS EQUIPMENT',
    'COMMUNICATIONS EQUIPMENT',
    'TELEPHONE & TELEGRAPH APPARATUS',
    'ELECTRONIC COMPONENTS',
    'ELECTRONIC CONNECTORS',
    'ELECTRONIC COILS, TRANSFORMERS',
    'CATHODE RAY TELEVISION PICTURE TUBES',
    'HOUSEHOLD AUDIO & VIDEO EQUIPMENT',
    'MAGNETIC & OPTICAL RECORDING MEDIA',
    'MEASURING & CONTROLLING DEVICES',
    'INSTRUMENTS FOR MEAS & TESTING OF ELECTRICITY',
    'LABORATORY ANALYTICAL INSTRUMENTS',
    'COMPUTER & OFFICE EQUIPMENT',
    'CALCULATING & ACCOUNTING MACHINES',
    'OFFICE MACHINES',
  ],
  'healthcare': [
    // General
    'Healthcare', 'Biotechnology', 'Pharmaceuticals', 'Medical Devices', 'Health Care', 'Biotech', 'Pharma', 'Medical',
    // Polygon SIC codes - Pharma & Biotech
    'PHARMACEUTICAL PREPARATIONS',
    'BIOLOGICAL PRODUCTS',
    'BIOLOGICAL PRODUCTS, (NO DISGNOSTIC SUBSTANCES)',
    'BIOLOGICAL PRODUCTS (NO DIAGNOSTIC SUBSTANCES)',
    'MEDICINAL CHEMICALS & BOTANICAL PRODUCTS',
    'DIAGNOSTIC SUBSTANCES',
    'IN VITRO & IN VIVO DIAGNOSTIC SUBSTANCES',
    'PHARMACEUTICAL',
    'DRUGS',
    'MEDICINALS',
    // Medical Devices & Equipment
    'SURGICAL & MEDICAL INSTRUMENTS & APPARATUS',
    'SURGICAL & MEDICAL INSTRUMENTS',
    'SURGICAL APPLIANCES & SUPPLIES',
    'DENTAL EQUIPMENT & SUPPLIES',
    'ORTHOPEDIC, PROSTHETIC & SURGICAL APPLIANCES',
    'OPHTHALMIC GOODS',
    'ELECTROMEDICAL & ELECTROTHERAPEUTIC APPARATUS',
    'X-RAY APPARATUS & TUBES',
    'ELECTROMEDICAL APPARATUS',
    'LABORATORY APPARATUS & FURNITURE',
    'MEDICAL INSTRUMENTS',
    // Healthcare Services
    'SERVICES-OFFICES & CLINICS OF DOCTORS OF MEDICINE',
    'SERVICES-OFFICES & CLINICS OF DOCTORS',
    'SERVICES-HOSPITALS',
    'SERVICES-SKILLED NURSING CARE FACILITIES',
    'SERVICES-NURSING & PERSONAL CARE FACILITIES',
    'SERVICES-HEALTH SERVICES',
    'SERVICES-MEDICAL LABORATORIES',
    'SERVICES-HOME HEALTH CARE SERVICES',
    'SERVICES-SPECIALTY OUTPATIENT FACILITIES',
    'SERVICES-MISC HEALTH & ALLIED SERVICES',
    'SERVICES-KIDNEY DIALYSIS CENTERS',
    'HOSPITAL & MEDICAL SERVICE PLANS',
    'ACCIDENT & HEALTH INSURANCE',
    'HEALTHCARE',
    'MANAGED HEALTHCARE',
  ],
  'finance': [
    // General
    'Financial Services', 'Banks', 'Banking', 'Insurance', 'Asset Management', 'Finance', 'Capital Markets', 'Credit Services',
    // Polygon SIC codes
    'NATIONAL COMMERCIAL BANKS',
    'STATE COMMERCIAL BANKS',
    'COMMERCIAL BANKS',
    'SAVINGS INSTITUTIONS',
    'SAVINGS INSTITUTIONS, FEDERALLY CHARTERED',
    'SAVINGS INSTITUTIONS, NOT FEDERALLY CHARTERED',
    'CREDIT UNIONS',
    'FUNCTIONS RELATED TO DEPOSITORY BANKING',
    'FEDERAL RESERVE BANKS',
    'FOREIGN BANKING',
    'PERSONAL CREDIT INSTITUTIONS',
    'BUSINESS CREDIT INSTITUTIONS',
    'MORTGAGE BANKERS & LOAN CORRESPONDENTS',
    'LOAN BROKERS',
    'FINANCE SERVICES',
    'FINANCE LESSORS',
    'FINANCIAL SERVICES',
    'SECURITY & COMMODITY BROKERS, DEALERS',
    'SECURITY BROKERS, DEALERS & FLOTATION COMPANIES',
    'COMMODITY CONTRACTS DEALERS, BROKERS',
    'SECURITY & COMMODITY EXCHANGES',
    'INVESTMENT ADVICE',
    'INVESTMENT OFFICES',
    'INVESTORS',
    'REAL ESTATE INVESTMENT TRUSTS',
    'INSURANCE CARRIERS',
    'LIFE INSURANCE',
    'ACCIDENT & HEALTH INSURANCE',
    'HOSPITAL & MEDICAL SERVICE PLANS',
    'FIRE, MARINE & CASUALTY INSURANCE',
    'SURETY INSURANCE',
    'TITLE INSURANCE',
    'INSURANCE AGENTS, BROKERS & SERVICE',
    'ASSET MANAGEMENT',
    'PRIVATE EQUITY',
  ],
  'energy': [
    // General
    'Energy', 'Oil & Gas', 'Renewable Energy', 'Oil', 'Gas', 'Petroleum',
    // Polygon SIC codes
    'CRUDE PETROLEUM & NATURAL GAS',
    'NATURAL GAS LIQUIDS',
    'OIL & GAS FIELD SERVICES',
    'DRILLING OIL & GAS WELLS',
    'OIL & GAS FIELD EXPLORATION SERVICES',
    'NATURAL GAS TRANSMISSION',
    'NATURAL GAS TRANSMISSION & DISTRIBUTION',
    'NATURAL GAS DISTRIBUTION',
    'PETROLEUM REFINING',
    'PETROLEUM & PETROLEUM PRODUCTS WHOLESALERS',
    'ELECTRIC SERVICES',
    'ELECTRIC & OTHER SERVICES COMBINED',
    'GAS & OTHER SERVICES COMBINED',
    'COMBINATION ELECTRIC & GAS',
    'COGENERATION SERVICES',
    'SOLAR',
    'WIND',
    'RENEWABLE',
    'COAL MINING',
    'BITUMINOUS COAL & LIGNITE MINING',
    'BITUMINOUS COAL',
    'ANTHRACITE MINING',
    'COAL',
    'PIPELINES',
    'REFINED PETROLEUM PIPELINES',
    'ELECTRIC UTILITY',
    'GAS UTILITY',
    'UTILITIES-ELECTRIC',
    'UTILITIES-GAS',
  ],
  'consumer': [
    // General
    'Consumer Cyclical', 'Consumer Defensive', 'Retail', 'Consumer Goods', 'Consumer',
    // Polygon SIC codes - Retail
    'RETAIL-EATING PLACES',
    'RETAIL-GROCERY STORES',
    'RETAIL-DRUG STORES AND PROPRIETARY STORES',
    'RETAIL-APPAREL & ACCESSORY STORES',
    'RETAIL-FAMILY CLOTHING STORES',
    'RETAIL-SHOE STORES',
    'RETAIL-FURNITURE STORES',
    'RETAIL-HOUSEHOLD APPLIANCE STORES',
    'RETAIL-RADIO, TV & CONSUMER ELECTRONICS STORES',
    'RETAIL-COMPUTER & COMPUTER SOFTWARE STORES',
    'RETAIL-BUILDING MATERIALS, HARDWARE',
    'RETAIL-AUTO DEALERS & GASOLINE STATIONS',
    'RETAIL-AUTO & HOME SUPPLY STORES',
    'RETAIL-CATALOG & MAIL-ORDER HOUSES',
    'RETAIL-MISC GENERAL MERCHANDISE STORES',
    'RETAIL-DEPARTMENT STORES',
    'RETAIL-VARIETY STORES',
    'RETAIL-MISCELLANEOUS RETAIL',
    'RETAIL-NONSTORE RETAILERS',
    'RETAIL-JEWELRY STORES',
    'RETAIL-SPORTING GOODS & BICYCLE SHOPS',
    'RETAIL-HOBBY, TOY & GAME SHOPS',
    // Consumer Products
    'BEVERAGES',
    'FOOD AND KINDRED PRODUCTS',
    'MEAT PACKING PLANTS',
    'DAIRY PRODUCTS',
    'BAKERY PRODUCTS',
    'SUGAR & CONFECTIONERY PRODUCTS',
    'FATS AND OILS',
    'GRAIN MILL PRODUCTS',
    'CANNED, FROZEN & PRESERVED FRUIT, VEG',
    'TOBACCO PRODUCTS',
    'CIGARETTES',
    'APPAREL & OTHER FINISHED PRODUCTS',
    'FOOTWEAR',
    'LEATHER & LEATHER PRODUCTS',
    'HOUSEHOLD FURNITURE',
    'SOAP, DETERGENTS, CLEANING PREPARATIONS',
    'PERFUMES, COSMETICS & OTHER TOILET PREPARATIONS',
    'SPORTING & ATHLETIC GOODS',
    'SPORTING & ATHLETIC GOODS, NEC',
    'TOYS & AMUSEMENT',
    'GAMES, TOYS & CHILDREN\'S VEHICLES',
    // Services
    'SERVICES-HOTELS & MOTELS',
    'SERVICES-AMUSEMENT & RECREATION SERVICES',
    'SERVICES-MOTION PICTURE & VIDEO TAPE PRODUCTION',
    'SERVICES-MOTION PICTURE THEATERS',
    'RESTAURANTS',
    'EATING PLACES',
    'DRINKING PLACES',
  ],
  'industrial': [
    // General
    'Industrials', 'Manufacturing', 'Aerospace', 'Defense', 'Industrial', 'Machinery',
    // Polygon SIC codes
    'AIRCRAFT',
    'AIRCRAFT ENGINES & ENGINE PARTS',
    'AIRCRAFT PARTS & AUXILIARY EQUIPMENT',
    'GUIDED MISSILES & SPACE VEHICLES',
    'SEARCH, DETECTION, NAVIGATION, GUIDANCE',
    'SHIP & BOAT BUILDING & REPAIRING',
    'RAILROAD EQUIPMENT',
    'MOTORCYCLES, BICYCLES & PARTS',
    'MOTOR VEHICLES & PASSENGER CAR BODIES',
    'MOTOR VEHICLE PARTS & ACCESSORIES',
    'TRUCK & BUS BODIES',
    'TRUCK TRAILERS',
    'FARM MACHINERY & EQUIPMENT',
    'LAWN & GARDEN TRACTORS & HOME LAWN',
    'CONSTRUCTION MACHINERY & EQUIP',
    'MINING MACHINERY & EQUIP',
    'OIL & GAS FIELD MACHINERY & EQUIPMENT',
    'INDUSTRIAL MACHINERY & EQUIPMENT',
    'MACHINE TOOLS, METAL CUTTING TYPES',
    'MACHINE TOOLS, METAL FORMING TYPES',
    'SPECIAL INDUSTRY MACHINERY',
    'GENERAL INDUSTRIAL MACHINERY & EQUIPMENT',
    'PUMPS & PUMPING EQUIPMENT',
    'BALL & ROLLER BEARINGS',
    'INDUSTRIAL & COMMERCIAL FANS & BLOWERS',
    'PACKAGING MACHINERY',
    'POWER-DRIVEN HANDTOOLS',
    'WELDING APPARATUS',
    'ELECTRICAL INDUSTRIAL APPARATUS',
    'MOTORS & GENERATORS',
    'INDUSTRIAL CONTROLS',
    'TRANSFORMERS',
    'SWITCHGEAR & SWITCHBOARD APPARATUS',
    'RELAYS & INDUSTRIAL CONTROLS',
    'RAILROADS, LINE-HAUL OPERATING',
    'TRUCKING & COURIER SERVICES',
    'AIR TRANSPORTATION',
    'TRANSPORTATION SERVICES',
    'SERVICES-ENGINEERING SERVICES',
    'SERVICES-MANAGEMENT CONSULTING SERVICES',
    'SERVICES-DETECTIVE, GUARD & ARMORED CAR SERVICES',
    'SERVICES-FACILITIES SUPPORT MANAGEMENT SERVICES',
    'SERVICES-HELP SUPPLY SERVICES',
    'SERVICES-EQUIPMENT RENTAL & LEASING',
  ],
  'materials': [
    // General
    'Basic Materials', 'Chemicals', 'Mining', 'Materials', 'Metals', 'Steel',
    // Polygon SIC codes
    'METAL MINING',
    'GOLD AND SILVER ORES',
    'COPPER ORES',
    'LEAD AND ZINC ORES',
    'FERROALLOY ORES',
    'MISCELLANEOUS METAL ORES',
    'IRON ORES',
    'NONMETALLIC MINERALS',
    'DIMENSION STONE',
    'CRUSHED AND BROKEN STONE',
    'SAND AND GRAVEL',
    'CLAY, CERAMIC, AND REFRACTORY MINERALS',
    'CHEMICAL & FERTILIZER MINERAL MINING',
    'INDUSTRIAL ORGANIC CHEMICALS',
    'INDUSTRIAL INORGANIC CHEMICALS',
    'PLASTICS MATERIALS & SYNTHETIC RESINS',
    'SYNTHETIC RUBBER',
    'AGRICULTURAL CHEMICALS',
    'ADHESIVES AND SEALANTS',
    'EXPLOSIVES',
    'PRINTING INK',
    'CARBON BLACK',
    'PAINTS, VARNISHES, LACQUERS, ENAMELS',
    'STEEL WORKS, BLAST FURNACES',
    'STEEL WORKS',
    'IRON & STEEL FOUNDRIES',
    'ROLLING DRAWING & EXTRUDING OF NONFERROUS METALS',
    'NONFERROUS FOUNDRIES',
    'PRIMARY SMELTING & REFINING OF COPPER',
    'PRIMARY SMELTING & REFINING OF NONFERROUS METALS',
    'ALUMINUM',
    'COPPER',
    'PAPER MILLS',
    'PAPERBOARD MILLS',
    'PAPER & PAPERBOARD',
    'CONVERTED PAPER & PAPERBOARD PRODUCTS',
    'LUMBER & WOOD PRODUCTS',
    'SAWMILLS & PLANING MILLS',
    'MILLWORK, VENEER, PLYWOOD',
    'WOOD BUILDINGS & MOBILE HOMES',
    'GLASS & GLASSWARE',
    'GLASS CONTAINERS',
    'CEMENT, HYDRAULIC',
    'CONCRETE, GYPSUM & PLASTER PRODUCTS',
    'READY-MIXED CONCRETE',
  ],
  'real estate': [
    // General
    'Real Estate', 'REIT', 'Property',
    // Polygon SIC codes
    'REAL ESTATE',
    'REAL ESTATE INVESTMENT TRUSTS',
    'REAL ESTATE AGENTS & MANAGERS',
    'REAL ESTATE AGENTS & MANAGERS (FOR OTHERS)',
    'REAL ESTATE OPERATORS',
    'REAL ESTATE DEALERS',
    'TITLE ABSTRACT OFFICES',
    'LAND SUBDIVIDERS & DEVELOPERS',
    'OPERATIVE BUILDERS',
  ],
  'communications': [
    // General
    'Communication Services', 'Media', 'Telecom', 'Communications', 'Entertainment',
    // Polygon SIC codes
    'TELEPHONE COMMUNICATIONS',
    'TELEGRAPH & OTHER MESSAGE COMMUNICATIONS',
    'RADIO BROADCASTING STATIONS',
    'TELEVISION BROADCASTING STATIONS',
    'CABLE & OTHER PAY TELEVISION SERVICES',
    'COMMUNICATIONS SERVICES',
    'RADIOTELEPHONE COMMUNICATIONS',
    'COMMUNICATIONS EQUIPMENT',
    'SERVICES-ADVERTISING',
    'SERVICES-ADVERTISING AGENCIES',
    'SERVICES-MOTION PICTURE & VIDEO TAPE PRODUCTION',
    'SERVICES-MOTION PICTURE & VIDEO TAPE DISTRIBUTION',
    'SERVICES-MOTION PICTURE THEATERS',
    'SERVICES-VIDEO TAPE RENTAL',
    'SERVICES-ALLIED TO MOTION PICTURE PRODUCTION',
    'SERVICES-AMUSEMENT & RECREATION SERVICES',
    'SERVICES-MEMBERSHIP SPORTS & RECREATION CLUBS',
    'SERVICES-THEATRICAL PRODUCERS',
    'SERVICES-BANDS, ORCHESTRAS, ACTORS',
    'SERVICES-RACING, INCLUDING TRACK OPERATION',
    'SERVICES-MISC AMUSEMENT & RECREATION',
    'NEWSPAPERS: PUBLISHING OR PUBLISHING & PRINTING',
    'PERIODICALS: PUBLISHING OR PUBLISHING & PRINTING',
    'BOOKS: PUBLISHING OR PUBLISHING & PRINTING',
    'MISCELLANEOUS PUBLISHING',
    'GREETING CARDS',
    'SERVICES-COMPUTER PROGRAMMING',
  ],
  'utilities': [
    // General
    'Utilities', 'Electric', 'Gas', 'Water', 'Utility',
    // Polygon SIC codes
    'ELECTRIC SERVICES',
    'GAS PRODUCTION & DISTRIBUTION',
    'COMBINATION UTILITY SERVICES',
    'ELECTRIC & OTHER SERVICES COMBINED',
    'GAS & OTHER SERVICES COMBINED',
    'WATER SUPPLY',
    'SANITARY SERVICES',
    'REFUSE SYSTEMS',
    'SEWERAGE SYSTEMS',
    'STEAM & AIR-CONDITIONING SUPPLY',
    'IRRIGATION SYSTEMS',
    'COGENERATION',
  ]
};

const matchesSector = (finnhubIndustry, selectedSector) => {
  if (selectedSector === 'all') return true;
  if (!finnhubIndustry) return false;
  
  const sectorKeywords = SECTOR_MAP[selectedSector.toLowerCase()] || [];
  return sectorKeywords.some(keyword => 
    finnhubIndustry.toLowerCase().includes(keyword.toLowerCase())
  );
};




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

// Collect all unique tickers for websocket
const wsTickers = useMemo(() => {
  const tickerSet = new Set();
  positions.forEach(p => { if (p.symbol && p.symbol !== 'N/A' && !p.symbol.includes(':')) tickerSet.add(p.symbol); });
  if (flattenedWatchlist) flattenedWatchlist.forEach(w => { if (w.symbol) tickerSet.add(w.symbol); });
  if (stocks) stocks.forEach(s => { if (s.symbol) tickerSet.add(s.symbol); });
  return [...tickerSet];
}, [positions, flattenedWatchlist, stocks]);

// Polygon websocket for real-time prices
const { livePrices, wsStatus } = usePolygonWebSocket(POLYGON_KEY, wsTickers, !!auth.currentUser);
  

const searchTimeoutRef = useRef(null);
  
const addStockToList = async (stock, listId) => {
  if (!user) {
    alert('Please sign in to add stocks to lists');
    return;
  }
  
  try {
    // Sanitize - remove any undefined values before Firestore
    const cleanStock = {
      symbol: stock.symbol || '',
      name: stock.name || '',
      price: stock.price || null,
      change: stock.change || null,
      addedAt: new Date().toISOString(),
    };
    
    await addStockToWatchlist(listId, cleanStock);
    
    // Track this stock being watched in Firestore
    try {
      const watchRef = doc(db, 'trending', stock.symbol);
      const watchDoc = await getDoc(watchRef);
      
      const now = new Date();
      
      if (watchDoc.exists()) {
        // ... existing trending code ...
      } else {
        // ... existing trending code ...
      }
    } catch (trendingError) {
      console.log('Trending update failed (non-critical):', trendingError.message);
    }

    // Log activity for feed
    logActivity(db, {
      userId: user.uid,
      userName: user.displayName,
      userAvatar: user.photoURL,
      type: 'add_stock',
      targetSymbol: stock.symbol,
      targetListId: listId,
      targetListName: watchlists.find(w => w.id === listId)?.name || 'a list',
    });
    
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
  if (!list || !Array.isArray(list)) {
    return [];
  }
  
  return Promise.all(list.map(async (stock) => {
    try {
      const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${stock.symbol}/prev?adjusted=true&apiKey=${POLYGON_KEY}`);
      const data = await res.json();
      if (!data.results || !data.results[0]) return stock;
      
      const quote = data.results[0];
      const change = ((quote.c - quote.o) / quote.o) * 100;
      
      return {
        ...stock,
        price: quote.c.toFixed(2),
        change: change.toFixed(2),
        isPositive: change >= 0
      };
    } catch (e) { return stock; }
  }));
}, []);

// User-specific seeded shuffle for legal compliance
const hashCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Fetch major market indices - uses batch endpoint (1 API call for all)
const fetchMarketIndices = useCallback(async () => {
  setLoadingIndices(true);
  try {
    const symbols = ['SPY', 'QQQ', 'DIA', 'IWM'];
    const indices = {};
    
    // Fetch all in parallel
    await Promise.all(symbols.map(async (symbol) => {
      const res = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${POLYGON_KEY}`
      );
      const data = await res.json();
      
      if (data.results && data.results[0]) {
        const quote = data.results[0];
        const prevClose = quote.c;
        
        // Get current price from snapshot
        const snapshotRes = await fetch(
          `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${POLYGON_KEY}`
        );
        const snapshotData = await snapshotRes.json();
        const currentPrice = snapshotData.ticker?.day?.c || snapshotData.ticker?.prevDay?.c || quote.c;
        const change = currentPrice - quote.o;
        const changePercent = ((currentPrice - quote.o) / quote.o) * 100;
        
        indices[symbol] = {
          symbol,
          name: symbol === 'SPY' ? 'S&P 500' : 
                symbol === 'QQQ' ? 'NASDAQ' : 
                symbol === 'DIA' ? 'DOW' : 'RUSSELL',
          price: currentPrice,
          change: change,
          changePercent: changePercent,
          previousClose: quote.o,
          isPositive: changePercent >= 0
        };
      }
    }));
    
    setMarketIndices(indices);
    setIndicesLastUpdated(new Date());
  } catch (error) {
    console.error('Error fetching market indices:', error);
  } finally {
    setLoadingIndices(false);
  }
}, []);

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
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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

// Log scanned stocks to Firestore
const logScanHistory = async (scannedStocks) => {
  if (!user?.uid || !db || scannedStocks.length === 0) return;
  try {
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const histRef = doc(db, 'users', user.uid, 'scanHistory', 'recent');
    const existing = await getDoc(histRef);
    const prev = existing.exists() ? existing.data().scans || [] : [];
    
    const newEntries = scannedStocks.map(s => ({
      symbol: s.symbol,
      name: s.name,
      price: s.price,
      change: s.change,
      catalystType: s.catalystType || 'manual',
      timestamp: new Date().toISOString()
    }));
    
    // Keep last 50 scans
    const merged = [...newEntries, ...prev].slice(0, 50);
    await setDoc(histRef, { scans: merged });
    setScanHistory(merged);
  } catch (e) {
    console.error('Failed to log scan history:', e);
  }
};

// Get tickers scanned in last 24 hours
const getRecentTickers = () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Set(
    scanHistory
      .filter(s => new Date(s.timestamp) > cutoff)
      .map(s => s.symbol)
  );
};

// Load scan history on auth
const loadScanHistory = async () => {
  if (!user?.uid || !db) return;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const histRef = doc(db, 'users', user.uid, 'scanHistory', 'recent');
    const snap = await getDoc(histRef);
    if (snap.exists()) {
      setScanHistory(snap.data().scans || []);
    }
  } catch (e) {
    console.error('Failed to load scan history:', e);
  }
};

// Clear recently scanned stocks every 24 hours
useEffect(() => {
  const timer = setInterval(() => {
    setRecentlyScanned(new Set());
    localStorage.removeItem('recentlyScanned');
  }, 24 * 60 * 60 * 1000); // 24 hours
  
  return () => clearInterval(timer);
}, []);

// Fetch market indices on load and refresh every 5 minutes
useEffect(() => {
  // Fetch on mount
  fetchMarketIndices();
  
  // Auto-refresh every 5 minutes (300000ms) - only when market is open
  const interval = setInterval(() => {
    if (isMarketOpen) {
      fetchMarketIndices();
    }
  }, 300000); // 5 minutes
  
  return () => clearInterval(interval);
}, [fetchMarketIndices, isMarketOpen]);

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

  // --- FETCH FEED ON TAB SWITCH ---
useEffect(() => {
  if (activeTab !== "FEED" || !user || !db) return;
  
  const fetchFeed = async () => {
    setLoadingFeed(true);
    try {
      let activities;
      if (following.length > 0) {
        activities = await getActivityFeed(db, following, 50);
      } else {
        // Show global feed if not following anyone
        activities = await getGlobalFeed(db, 30);
      }
      setFeedActivities(activities);
    } catch (e) {
      console.error('Feed fetch error:', e);
    } finally {
      setLoadingFeed(false);
    }
  };
  
  fetchFeed();
}, [activeTab, user, db, following]);

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

useEffect(() => {
  loadScanHistory();
}, [user, db]);

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
    
    logActivity(db, {
      userId: user.uid,
      userName: user.displayName,
      userAvatar: user.photoURL,
      type: 'create_list',
      targetListName: name,
    });
    
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
        gainPercent: holding.cost_basis > 0 
  ? ((holding.institution_value - holding.cost_basis) / holding.cost_basis) * 100 
  : 0,
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
  
  if (userDoc.exists()) {
    setFollowedLists(userDoc.data().followedLists || []);
    setFollowing(userDoc.data().following || []);
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


const fetchNews = useCallback(async () => {
  setLoadingNews(true);
  try {
    const res = await fetch(
      `https://api.polygon.io/v2/reference/news?limit=30&order=desc&sort=published_utc&apiKey=${POLYGON_KEY}`
    );
    const data = await res.json();
    
    if (data.results && data.results.length > 0) {
      const articles = data.results.map((article, i) => ({
        id: article.id || i,
        headline: article.title,
        summary: article.description || '',
        source: article.publisher?.name || 'Unknown',
        url: article.article_url,
        image: article.image_url || null,
        datetime: new Date(article.published_utc).getTime() / 1000,
        tickers: article.tickers || [],
        category: article.tickers?.length > 0 ? 'Stocks' : 'Markets',
      }));
      setNewsArticles(articles);
    } else {
      setNewsArticles([]);
    }
  } catch (error) {
    console.error('Error fetching news:', error);
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

useEffect(() => {
  const fetchFollowedLists = async () => {
    if (!followedLists.length) {
      setFollowedListsData([]);
      return;
    }
    try {
      const results = [];
      for (const listId of followedLists) {
        const listDoc = await getDoc(doc(db, 'watchlists', listId));
        if (listDoc.exists()) results.push(listDoc.data());
      }
      setFollowedListsData(results);
    } catch (e) {
      console.error('Error fetching followed lists:', e);
    }
  };
  fetchFollowedLists();
}, [followedLists]);

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

const isLikelyETF = (ticker) => {
  const knownETFs = new Set([
    // Leveraged/Inverse ETFs
    'MSTX', 'MSTU', 'MSTK', 'XRPT', 'XXRP', 'CRPT', 'BITW', 'LABX',
    'SOXL', 'SOXS', 'TQQQ', 'SQQQ', 'UVXY', 'SVXY', 'NUGT', 'DUST',
    'LABU', 'LABD', 'FNGU', 'FNGD', 'SPXL', 'SPXS', 'TNA', 'TZA',
    'UDOW', 'SDOW', 'UPRO', 'SPXU', 'QLD', 'QID', 'DDM', 'DXD',
    'MVV', 'MZZ', 'UWM', 'TWM', 'SAA', 'SDD', 'UGE', 'SZK',
    'KORU', 'YANG', 'YINN', 'INDL', 'EDC', 'EDZ', 'EURL', 'DRN', 'DRV',
    'CURE', 'PILL', 'RETL', 'MIDU', 'WANT', 'HIBL', 'HIBS',
    'WEBL', 'WEBS', 'NAIL', 'CLAW', 'DPST', 'DRIP', 'GUSH',
    'BOIL', 'KOLD', 'UNG', 'UCO', 'SCO', 'USO', 'UGL', 'GLL',
    'AGQ', 'ZSL', 'JNUG', 'JDST', 'NUGT', 'DUST',
    'TSLL', 'TSLS', 'NVDL', 'NVDS', 'AMDL', 'AMDS',
    
    // Crypto ETFs/ETNs
    'TXBC', 'BLOK', 'LEGR', 'BITW', 'GBTC', 'ETHE', 'BITO', 'BTF', 'XBTF',
    'ARKB', 'IBIT', 'FBTC', 'HODL', 'BTCO', 'EZBC', 'BRRR', 'BTCW',
    'ETHV', 'SOLZ', 'ZKPW', 'UXRP',
    
    // ARK ETFs
    'ARKK', 'ARKW', 'ARKG', 'ARKF', 'ARKQ', 'ARKX', 'ARKB',
    
    // Popular Index ETFs (avoid recommending these as "picks")
    'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'IVV',
    'VEA', 'VWO', 'EFA', 'EEM', 'IEFA', 'IEMG',
    
    // Sector ETFs
    'XLF', 'XLK', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE',
    'VGT', 'VHT', 'VFH', 'VDE', 'VIS', 'VCR', 'VDC',
    
    // Bond ETFs
    'TLT', 'IEF', 'SHY', 'BND', 'AGG', 'LQD', 'HYG', 'JNK',
    'TMF', 'TMV', 'TBT', 'TBF',
    
    // Volatility products
    'VIX', 'VXX', 'VIXY', 'SVOL', 'VIXM',
    
    // Commodity ETFs
    'GLD', 'SLV', 'IAU', 'PPLT', 'PALL', 'CPER', 'WEAT', 'CORN', 'SOYB',
    'DBA', 'DBC', 'GSG', 'PDBC',
    
    // Thematic ETFs often mistaken for stocks
    'ICLN', 'TAN', 'QCLN', 'PBW', 'FAN', 'LIT', 'REMX',
    'ROBO', 'BOTZ', 'IRBO', 'AIQ', 'WCLD', 'SKYY', 'CLOU',
    'HACK', 'BUG', 'CIBR', 'IHAK',
    'ESPO', 'HERO', 'NERD', 'GAMR',
    'MJ', 'MSOS', 'YOLO', 'POTX',
    'JETS', 'AWAY', 'CRUZ',
    'BETZ', 'BJK',
    'PAVE', 'IFRA',
    'AMTD', // Often confused - TD Ameritrade holding
    
    // International/Country ETFs
    'FXI', 'MCHI', 'KWEB', 'ASHR', 'GXC',
    'EWJ', 'EWZ', 'EWY', 'EWT', 'EWG', 'EWU', 'EWA', 'EWC',
    'INDA', 'INDY', 'SMIN',
    'RSX', 'ERUS',
    'VNM', 'EPHE', 'THD', 'EIDO', 'EWM', 'EWS',
    
    // Fixed income/dividend ETFs
    'SCHD', 'VYM', 'DVY', 'HDV', 'SPHD', 'SPYD',
    'JEPI', 'JEPQ', 'QYLD', 'XYLD', 'RYLD', 'DIVO',
    
    // Misc that slip through
    'SPHL' // Shell company often caught in scans
  ]);
  
  if (knownETFs.has(ticker)) return true;
  
  // Warrants (4+ chars ending in W)
  if (ticker.length >= 4 && ticker.endsWith('W')) return true;
  
  // Units (ending in U)
  if (ticker.endsWith('U')) return true;
  
  // Class shares (contain .)
  if (ticker.includes('.')) return true;
  
  // Pattern matching for leveraged/inverse ETFs
  if (/^[A-Z]{2,4}[XQS]$/.test(ticker) && ticker.length <= 5) return true;
  if (/[23][XL]/.test(ticker)) return true;
  
  // Common ETF endings
  if (ticker.endsWith('XX') || ticker.endsWith('XY')) return true;
  
  return false;
};

// ========== STREAMLINED STOCK DISCOVERY ==========
const discoverStocks = useCallback(async (sector, marketCap, priceMin, priceMax) => {
  console.log(`🔍 STREAMLINED DISCOVERY`);
  console.log(`💰 Price range: $${priceMin} - $${priceMax}`);
  
  const movers = new Map();
  
  // ========== MASSIVE ETF/JUNK BLACKLIST ==========
  const JUNK_TICKERS = new Set([
    'BAGY', 'MEMY', 'SOLC', 'OKTG', 'HIBL', 'HIBS', 'WEBL', 'WEBS',
    'BULZ', 'BERZ', 'FNGG', 'FNGZ', 'LABU', 'LABD', 'CURE', 'PILL',
    'DUSL', 'DRIP', 'GUSH', 'NRGU', 'NRGD', 'OILU', 'OILD',
    'SOXL', 'SOXS', 'TECL', 'TECS', 'TNA', 'TZA', 'FAS', 'FAZ',
    'SPXL', 'SPXS', 'TQQQ', 'SQQQ', 'UPRO', 'SPXU', 'UDOW', 'SDOW',
    'URTY', 'SRTY', 'MIDU', 'MIDZ', 'EDC', 'EDZ', 'YINN', 'YANG',
    'MEXX', 'INDL', 'EURL', 'ERX', 'ERY', 'NUGT', 'DUST', 'JNUG', 'JDST',
    'DPST', 'WEET', 'KORU', 'CWEB', 'CBON', 'CHAU', 'CHAD',
    'FLYU', 'FLYD', 'FNGO', 'FNGD', 'FNGU', 'WANT', 'PASS',
    'NAIL', 'CLAW', 'RETL', 'SRET', 'TPOR', 'UTSL',
    'UVXY', 'SVXY', 'VIXY', 'VIXM', 'VXX', 'SVOL',
    'QLD', 'QID', 'DDM', 'DXD', 'MVV', 'MZZ', 'UWM', 'TWM',
    'SAA', 'SDD', 'UGE', 'SZK', 'UCC', 'SCC', 'ROM', 'REW',
    'UYG', 'SKF', 'UPW', 'SDP', 'DIG', 'DUG', 'AGQ', 'ZSL',
    'UGL', 'GLL', 'UCO', 'SCO', 'BOIL', 'KOLD', 'UBT', 'TBT',
    'TSLL', 'TSLS', 'NVDL', 'NVDS', 'AMDL', 'AMDS', 'CONL', 'CONY',
    'BTAL', 'XOMO', 'TSMI', 'SMCX',
    'MSTU', 'MSTX', 'MSTZ', 'MSDD', 'XRPT', 'XXRP', 'UXRP',
    'BITW', 'GBTC', 'ETHE', 'BITO', 'ARKB', 'IBIT', 'FBTC',
    'ETHV', 'SOLZ', 'ZKPW',
    'ARKK', 'ARKW', 'ARKG', 'ARKF', 'ARKQ', 'ARKX', 'IZRL', 'PRNT',
    'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'IVV', 'RSP',
    'VEA', 'VWO', 'EFA', 'EEM', 'IEFA', 'IEMG', 'VT', 'ACWI',
    'XLF', 'XLK', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC',
    'VGT', 'VHT', 'VFH', 'VDE', 'VIS', 'VCR', 'VDC', 'VNQ', 'VPU',
    'GLD', 'SLV', 'IAU', 'USO', 'UNG',
    'TLT', 'IEF', 'SHY', 'BND', 'AGG', 'LQD', 'HYG', 'JNK',
    'SCHD', 'VYM', 'JEPI', 'JEPQ', 'QYLD', 'XYLD'
  ]);

  const isJunk = (ticker) => {
    if (JUNK_TICKERS.has(ticker)) return true;
    if (isLikelyETF(ticker)) return true;
    if (ticker.length < 2 || ticker.length > 5) return true;
    if (/\d/.test(ticker)) return true;
    
    if (ticker.length === 5) {
      const lastChar = ticker.slice(-1);
      const lastTwo = ticker.slice(-2);
      if (['P', 'W', 'U', 'R', 'Z', 'Y', 'F', 'Q'].includes(lastChar)) return true;
      if (['WS', 'WT', 'UN', 'PR', 'PF', 'CL'].includes(lastTwo)) return true;
    }
    
    if (ticker.length === 4 && ['W', 'Y', 'F', 'Q'].includes(ticker.slice(-1))) return true;
    
    return false;
  };
  
  // ========== STEP 1: Get gainers ==========
  setScanStatus('SCANNING GAINERS...');
  try {
    const res = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON_KEY}`
    );
    const data = await res.json();
    data.tickers?.forEach(t => {
      const price = t.day?.c || t.prevDay?.c;
      const change = t.todaysChangePerc || ((t.prevDay?.c - t.prevDay?.o) / t.prevDay?.o * 100);
      
      if (price >= priceMin && price <= priceMax && !isJunk(t.ticker)) {
        movers.set(t.ticker, {
          price,
          change: change?.toFixed(2),
          volume: t.day?.v || t.prevDay?.v,
          trigger: `🚀 Top Gainer: +${change?.toFixed(1)}%`,
          triggerType: 'gainer',
          source: 'gainer'
        });
      }
    });
    console.log(`✓ Gainers: ${movers.size} in price range`);
  } catch (e) {
    console.log('Gainers fetch failed:', e.message);
  }
  
  // ========== STEP 2: Get volume spikes + breakouts ==========
  setScanStatus('SCANNING VOLUME & BREAKOUTS...');
  try {
    const res = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`
    );
    const data = await res.json();
    
    data.tickers?.forEach(t => {
      if (movers.has(t.ticker) || isJunk(t.ticker)) return;
      
      const price = t.day?.c || t.prevDay?.c;
      const change = t.todaysChangePerc || ((t.prevDay?.c - t.prevDay?.o) / t.prevDay?.o * 100);
      const volume = t.day?.v || t.prevDay?.v || 0;
      const prevVolume = t.prevDay?.v || 1;
      const volumeRatio = volume / prevVolume;
      const high52 = t.max52Week?.high;
      
      if (!price || price < priceMin || price > priceMax) return;
      if (!change || change <= 0) return;
      
      // Volume spike (2x normal)
      if (volumeRatio > 2) {
        movers.set(t.ticker, {
          price,
          change: change?.toFixed(2),
          volume,
          volumeRatio: volumeRatio.toFixed(1),
          trigger: `🔥 Volume Spike: ${volumeRatio.toFixed(1)}x normal`,
          triggerType: 'volume',
          source: 'volume'
        });
        return;
      }
      
      // Near 52-week high (within 5%)
      if (high52 && price) {
        const distanceFromHigh = ((high52 - price) / high52) * 100;
        if (distanceFromHigh <= 5) {
          movers.set(t.ticker, {
            price,
            change: change?.toFixed(2),
            volume,
            trigger: `📈 Breakout: ${distanceFromHigh < 1 ? 'At' : 'Near'} 52-week high`,
            triggerType: 'breakout',
            source: 'breakout'
          });
          return;
        }
      }
      
      // Just a solid gainer with decent volume
      if (change > 5 && volume > 100000) {
        movers.set(t.ticker, {
          price,
          change: change?.toFixed(2),
          volume,
          trigger: `💹 Strong Move: +${change?.toFixed(1)}% on ${(volume/1000000).toFixed(1)}M vol`,
          triggerType: 'momentum',
          source: 'momentum'
        });
      }
    });
  } catch (e) {
    console.log('Snapshot scan failed:', e.message);
  }
  
  console.log(`✓ Total movers: ${movers.size}`);

  if (movers.size === 0) {
    return { stocks: [], total: 0 };
  }
  
// ========== STEP 3: Fetch news and summarize ==========
setScanStatus('FETCHING NEWS...');

const sortedMovers = [...movers.entries()]
  .sort((a, b) => parseFloat(b[1].change || 0) - parseFloat(a[1].change || 0))
  .slice(0, 80);

console.log(`📰 Checking news for top ${sortedMovers.length} movers...`);

// First, fetch all news
const withData = [];
for (let i = 0; i < sortedMovers.length; i += 10) {
  const batch = sortedMovers.slice(i, i + 10);
  
  const batchResults = await Promise.all(
    batch.map(async ([ticker, data]) => {
      try {
        const newsRes = await fetch(
          `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=3&apiKey=${POLYGON_KEY}`
        );
        const newsData = await newsRes.json();
        const articles = newsData.results || [];
        
        return {
          ticker,
          ...data,
          news: articles.slice(0, 3),
          newsCount: articles.length,
          headline: articles[0]?.title || null,
          newsSource: articles[0]?.publisher?.name || null,
          newsDate: articles[0]?.published_utc 
            ? new Date(articles[0].published_utc).toLocaleDateString() 
            : null
        };
      } catch (e) {
        return { ticker, ...data, news: [], newsCount: 0 };
      }
    })
  );
  
  withData.push(...batchResults);
  
  if (i + 10 < sortedMovers.length) {
    await new Promise(r => setTimeout(r, 100));
  }
}

// ========== STEP 4: AI analyzes catalysts ==========
setScanStatus('ANALYZING CATALYSTS...');

const stocksWithNews = withData.filter(s => s.headline);
const stocksWithoutNews = withData.filter(s => !s.headline);

// AI analyzes stocks with news - tell us WHY it matters
if (stocksWithNews.length > 0) {
  try {
    const stocksToAnalyze = stocksWithNews.slice(0, 25);
    
    const analysisInput = stocksToAnalyze
      .map((s, i) => {
        const newsText = s.news
          ?.slice(0, 2)
          .map(n => n.title)
          .join(' | ') || s.headline;
        return `${i + 1}. ${s.ticker} (+${s.change}%): "${newsText}"`;
      })
      .join('\n');
    
    const analysisResult = await aiModel.generateContent(
      `You are a stock analyst. For each stock, explain WHY the stock is moving in 6-10 words. Focus on the actionable catalyst - what happened that matters to traders.

Be specific: Include numbers, percentages, drug names, deal values, earnings beats/misses.
Bad: "Positive news drives shares higher"
Good: "FDA approves cancer drug, $2B market opportunity"
Good: "Q4 earnings beat 15%, raised 2024 guidance"
Good: "Acquired by Microsoft for $50/share"
Good: "$200M contract with US Army announced"

Stocks:
${analysisInput}

Return ONLY a numbered list:
1. [catalyst summary]
2. [catalyst summary]
...`
    );
    
    const analysisText = await analysisResult.response.text();
    const analyses = analysisText.split('\n')
      .filter(line => /^\d+\./.test(line.trim()))
      .map(line => line.replace(/^\d+\.\s*/, '').trim());
    
    // Apply analyses back to stocks
    stocksToAnalyze.forEach((stock, i) => {
      if (analyses[i] && analyses[i].length > 5) {
        stock.catalyst = analyses[i].replace(/^["']|["']$/g, '');
      } else {
        // Fallback
        stock.catalyst = stock.headline?.slice(0, 60) || stock.trigger;
      }
      stock.catalystType = 'news';
    });
    
// Any remaining stocks with news that weren't analyzed
    stocksWithNews.slice(25).forEach(stock => {
      stock.catalyst = stock.headline?.slice(0, 60) || stock.trigger;
      stock.catalystType = 'news';
    });
    
    // Clean up bad AI responses - if AI couldn't identify a catalyst, use the headline or trigger instead
    stocksWithNews.forEach(stock => {
      if (stock.catalyst && (
        stock.catalyst.toLowerCase().includes('no clear catalyst') ||
        stock.catalyst.toLowerCase().includes('not identified') ||
        stock.catalyst.toLowerCase().includes('no specific') ||
        stock.catalyst.toLowerCase().includes('unclear') ||
        stock.catalyst.toLowerCase().includes('no catalyst') ||
        stock.catalyst.toLowerCase().includes('cannot determine') ||
        stock.catalyst.toLowerCase().includes('no news') ||
        stock.catalyst.toLowerCase().includes('provided summaries')
      )) {
        // Fall back to headline, then trigger
        stock.catalyst = stock.headline?.slice(0, 60) || stock.trigger;
      }
    });
    
    console.log(`🤖 AI analyzed ${stocksToAnalyze.length} stocks`);
    
  } catch (e) {
    console.log('AI analysis failed:', e.message);
    stocksWithNews.forEach(stock => {
      stock.catalyst = stock.headline?.slice(0, 60) || stock.trigger;
      stock.catalystType = 'news';
    });
  }
}

// Stocks without news use technical trigger
stocksWithoutNews.forEach(stock => {
  stock.catalyst = stock.trigger;
  stock.catalystType = stock.triggerType;
});

// ========== STEP 5: Combine and sort ==========
const allStocks = [...stocksWithNews, ...stocksWithoutNews];

const sorted = allStocks.sort((a, b) => {
  // News always wins
  if (a.catalystType === 'news' && b.catalystType !== 'news') return -1;
  if (b.catalystType === 'news' && a.catalystType !== 'news') return 1;
  // Then volume spikes
  if (a.catalystType === 'volume' && b.catalystType !== 'volume') return -1;
  if (b.catalystType === 'volume' && a.catalystType !== 'volume') return 1;
  // Then by % change
  return parseFloat(b.change || 0) - parseFloat(a.change || 0);
});

const withNews = sorted.filter(s => s.catalystType === 'news').length;
const withTechnical = sorted.filter(s => s.catalystType !== 'news').length;
console.log(`✅ Found ${withNews} with news, ${withTechnical} with technical triggers`);

return {
  stocks: sorted,
  total: movers.size
};
  
}, [setScanStatus, isLikelyETF]);




// Get tickers this user has seen in the last 24 hours
const getRecentlyScannedTickers = async (userId) => {
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
  const recentTickers = new Set();
  
  try {
    const userScansQuery = query(
      collection(db, 'scannerResults'),
      where('userId', '==', userId),
      where('timestamp', '>', twentyFourHoursAgo)
    );
    
    const userSnapshot = await getDocs(userScansQuery);
    userSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.tickers) {
        data.tickers.forEach(t => recentTickers.add(t));
      }
    });
    
    console.log(`📋 User has seen ${recentTickers.size} tickers in last 24h`);
    
  } catch (e) {
    console.log('Error fetching recent scans:', e.message);
  }
  
  return recentTickers;
};

// Get stored scan position (tracks where we are in the candidate list)
const getStoredScanPosition = () => {
  try {
    const stored = localStorage.getItem('scannerPosition');
    if (!stored) return { index: 0, date: new Date().toDateString() };
    const parsed = JSON.parse(stored);
    // Reset position if it's a new day
    if (parsed.date !== new Date().toDateString()) {
      return { index: 0, date: new Date().toDateString() };
    }
    return parsed;
  } catch (e) {
    return { index: 0, date: new Date().toDateString() };
  }
};

// Update scan position for next scan
const updateScanPosition = (newIndex, totalCandidates) => {
  // Wrap around if we've gone through all candidates
  const wrappedIndex = newIndex >= totalCandidates ? 0 : newIndex;
  localStorage.setItem('scannerPosition', JSON.stringify({
    index: wrappedIndex,
    date: new Date().toDateString()
  }));
  return wrappedIndex;
};

const fetchEarningsDate = async (symbol) => {
  try {
    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const futureDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    const to = futureDate.toISOString().split('T')[0];
    
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
    );
    const data = await res.json();
    console.log(`Earnings data for ${symbol}:`, data);
    const upcoming = data.earningsCalendar
  ?.sort((a, b) => new Date(a.date) - new Date(b.date))
  .find(e => new Date(e.date) >= today);
    if (upcoming) {
      return {
        date: upcoming.date,
        estimate: upcoming.epsEstimate,
        quarter: upcoming.quarter,
        year: upcoming.year
      };
    }
    return null;
  } catch (e) {
    return null;
  }
};

// --- STREAMLINED SCANNER ---
const runScanner = useCallback(async (tickerToSearch = null) => {
  const isManual = Boolean(tickerToSearch);
  setIsManualResult(isManual);
  setLoading(true);
  setScanProgress(0);
  setScanComplete(false);
  
  try {
    // ========== MANUAL SEARCH ==========
    if (isManual) {
      setScanStatus(`ANALYZING: ${tickerToSearch.toUpperCase()}`);
      const ticker = tickerToSearch.toUpperCase().replace(/[^A-Z]/g, "");
      
      // Fetch data for manual ticker
      const [quoteRes, newsRes, profileRes] = await Promise.all([
        fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_KEY}`),
        fetch(`https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=5&apiKey=${POLYGON_KEY}`),
        fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`)
      ]);
      
      const [quoteData, newsData, profileData] = await Promise.all([
        quoteRes.json(),
        newsRes.json(),
        profileRes.json()
      ]);
      
      if (!quoteData.results?.[0]) {
        setScanStatus(`NO DATA FOUND FOR ${ticker}`);
        setLoading(false);
        setScanComplete(true);
        return;
      }
      
      const quote = quoteData.results[0];
      const news = newsData.results || [];
      const profile = profileData.results || {};
      const change = ((quote.c - quote.o) / quote.o) * 100;
      const earnings = await fetchEarningsDate(ticker);

      
      const stock = {
        symbol: ticker,
        name: cleanCompanyName(profile.name) || ticker,
        price: quote.c.toFixed(2),
        change: change.toFixed(2),
        isPositive: change >= 0,
        headline: news[0]?.title || null,
        newsSource: news[0]?.publisher?.name || null,
        newsDate: news[0]?.published_utc ? new Date(news[0].published_utc).toLocaleDateString() : null,
        newsCount: news.length,
        news: news.slice(0, 3),
        volume: quote.v,
        industry: profile.sic_description || '',
        source: 'manual',
        earnings: earnings,
      };

      console.log('Stock earnings:', stock.earnings);
      
      setStocks([stock]);
      logScanHistory([stock]);
      setScanProgress(100);
      setScanStatus("ANALYSIS COMPLETE");
      setScanComplete(true);
      setLoading(false);
      return;
    }
    
// ========== AUTO DISCOVERY ==========
const priceMin = scanPriceMin || 2;
const priceMax = scanPriceMax || 500;

const result = await discoverStocks(scanSector, null, priceMin, priceMax);
const discoveredStocks = result.stocks || [];

if (discoveredStocks.length === 0) {
  setScanStatus('NO STOCKS FOUND');
  setLoading(false);
  setScanComplete(true);
  return;
}

// Shuffle for variety, but keep news/volume stocks weighted higher
const newsStocks = discoveredStocks.filter(s => s.catalystType === 'news');
const volumeStocks = discoveredStocks.filter(s => s.catalystType === 'volume');
const otherStocks = discoveredStocks.filter(s => !['news', 'volume'].includes(s.catalystType));

// Shuffle each group
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const prioritized = [
  ...shuffle(newsStocks),
  ...shuffle(volumeStocks),
  ...shuffle(otherStocks)
];

// Take more candidates when filtering by sector
const candidateCount = scanSector !== 'all' ? 60 : 25;
const candidates = prioritized.slice(0, candidateCount);

setScanStatus('VERIFYING STOCKS...');
setScanProgress(60);

// Verify each stock
const verified = [];

const recentTickers = getRecentTickers();

for (const stock of candidates) {
  if (verified.length >= 5) break;
  if (!stock.ticker) continue;
  
  if (recentTickers.has(stock.ticker)) {
  console.log(`⏭️ Skipped (scanned recently): ${stock.ticker}`);
  continue;
}
  
  try {
    const profileRes = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${stock.ticker}?apiKey=${POLYGON_KEY}`
    );
    const profileData = await profileRes.json();
    const name = profileData.results?.name || stock.ticker;
    const nameLower = name.toLowerCase();
    
    // ETF/Junk filter
    if (
      nameLower.includes(' etf') ||
      nameLower.includes(' etn') ||
      nameLower.includes('direxion') ||
      nameLower.includes('proshares') ||
      nameLower.includes('graniteshares') ||
      nameLower.includes('leveraged') ||
      nameLower.includes('inverse') ||
      nameLower.includes('ishares') ||
      nameLower.includes('spdr ') ||
      nameLower.includes('vanguard ') ||
      nameLower.includes('wisdomtree') ||
      nameLower.includes('first trust') ||
      nameLower.includes('invesco ') ||
      nameLower.includes('global x ') ||
      nameLower.includes('vaneck') ||
      nameLower.includes('schwab ') ||
      nameLower.includes('depositary') ||
      nameLower.includes('preferred') ||
      nameLower.includes('% notes') ||
      nameLower.includes('trust units') ||
      nameLower.includes(' 2x') ||
      nameLower.includes(' 3x') ||
      nameLower.includes('2x ') ||
      nameLower.includes('3x ')
    ) {
      console.log(`❌ Filtered: ${stock.ticker} (${name})`);
      continue;
    }

        // Sector filter
    if (scanSector !== 'all') {
      const sicDesc = profileData.results?.sic_description || '';
      if (!matchesSector(sicDesc, scanSector)) {
        console.log(`❌ Wrong sector: ${stock.ticker} (${sicDesc})`);
        continue;
      }
    }

  const earnings = await fetchEarningsDate(stock.ticker);

    
    // Valid stock!
    verified.push({
      symbol: stock.ticker,
      name: cleanCompanyName(name),
      price: stock.price?.toFixed ? stock.price.toFixed(2) : String(stock.price || '0.00'),
      change: stock.change || '0.00',
      isPositive: parseFloat(stock.change || 0) >= 0,
      catalyst: stock.catalyst,
      catalystType: stock.catalystType,
      headline: stock.headline,
      newsSource: stock.newsSource,
      newsDate: stock.newsDate,
      newsCount: stock.newsCount || 0,
      news: stock.news || [],
      volume: stock.volume,
      volumeRatio: stock.volumeRatio,
      trigger: stock.trigger,
      source: stock.source,
      industry: profileData.results?.sic_description || '',
      earnings: earnings,
    });
    
    console.log(`✅ Added: ${stock.ticker} - ${stock.catalystType}: ${stock.catalyst?.slice(0, 50)}`);
    
  } catch (e) {
    console.log(`⚠️ Failed: ${stock.ticker}`, e.message);
  }
}

if (verified.length === 0) {
  setScanStatus('NO VALID STOCKS FOUND');
  setLoading(false);
  setScanComplete(true);
  return;
}

// Update recently scanned
verified.forEach(s => {
  setRecentlyScanned(prev => new Set([...prev, s.symbol]));
});

setStocks(verified);
logScanHistory(verified);
setScanProgress(100);
setScanStatus(`FOUND ${verified.length} STOCKS`);
setScanComplete(true);
    
  } catch (err) {
    console.error('Scanner error:', err);
    setScanStatus('SCAN FAILED');
  } finally {
    setLoading(false);
  }
}, [discoverStocks, scanPriceMin, scanPriceMax, scanSector, recentlyScanned]);


// Handle clicking a similar stock ticker
const handleScanSimilar = useCallback((ticker) => {
  setStocks([]);
  setManualSearch(ticker);
  setIsManualResult(true);
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Run the scan
  runScanner(ticker);
}, [runScanner]);

const getSortedAndFilteredStocks = useCallback((stockList) => {
  let filtered = [...stockList];
  
  // Filter by catalyst type (replaces old signal filter)
  if (filterSignal !== "all") {
    filtered = filtered.filter(stock => 
      stock.catalystType === filterSignal
    );
  }
  
  // Sort options updated for new data model
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "change-high") return parseFloat(b.change) - parseFloat(a.change);
    if (sortBy === "change-low") return parseFloat(a.change) - parseFloat(b.change);
    if (sortBy === "price-high") return parseFloat(b.price) - parseFloat(a.price);
    if (sortBy === "price-low") return parseFloat(a.price) - parseFloat(b.price);
    if (sortBy === "volume") return (b.volume || 0) - (a.volume || 0);
    if (sortBy === "news") return (b.newsCount || 0) - (a.newsCount || 0);
    // Default: news catalysts first, then by change
    if (a.catalystType === 'news' && b.catalystType !== 'news') return -1;
    if (b.catalystType === 'news' && a.catalystType !== 'news') return 1;
    return parseFloat(b.change) - parseFloat(a.change);
  });
  
  return sorted;
}, [sortBy, filterSignal]);

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
    <div className="min-h-screen bg-black text-white p-4 md:p-8 pb-20 md:pb-8 font-mono">
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
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  .animate-shimmer {
    animation: shimmer 2s infinite linear;
  }
    @keyframes priceFlashGreen {
  0% { background-color: rgba(0, 255, 78, 0.3); }
  100% { background-color: transparent; }
}
@keyframes priceFlashRed {
  0% { background-color: rgba(255, 75, 43, 0.3); }
  100% { background-color: transparent; }
}
.price-flash-up {
  animation: priceFlashGreen 1s ease-out;
}
.price-flash-down {
  animation: priceFlashRed 1s ease-out;
}
`}</style>
      
{/* HEADER */}
<header className="flex flex-col mb-4 md:mb-6">
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
  className={`p-2 md:p-3 rounded-lg border bg-black transition-all active:scale-95 ${
    showSearch 
      ? 'border-zinc-800' 
      : 'border-zinc-800 hover:border-zinc-700'
  }`}
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
       <div className="bg-[#111111] border border-zinc-800 p-4 md:p-5 rounded-xl shadow-2xl backdrop-blur-md">
  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">
    Find Users & Watchlists
  </h3>
  <div className="flex-1 relative">
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
      placeholder="Search by username..."
      className="w-full bg-black border border-zinc-800 text-white px-4 md:px-5 py-3 rounded-lg outline-none transition-all font-mono text-base placeholder:text-zinc-700 focus:border-[#00ff4e]/50"
      style={{ caretColor: '#00ff4e' }}
    />
  </div>

  {/* Search Results */}
  <div className="mt-4">
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
</div>
      </motion.div>
    )}
  </AnimatePresence>
</header>


{/* Market Indices Bar */}
<div className="mb-6 md:mb-8">
  <div className={`bg-[#0a0a0a] rounded-xl p-3 md:p-4 overflow-hidden transition-all duration-500 ${
    isMarketOpen 
  ? 'border-2 border-[#00ff4e]/60 shadow-[0_0_30px_rgba(0,255,78,0.15)]' 
  : 'border border-zinc-800'
  }`}>
    
    {/* Header Row */}
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${isMarketOpen ? 'bg-[#00ff4e] animate-pulse' : 'bg-zinc-600'}`} />
        <span className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-wider">
          {isMarketOpen ? 'Markets Open' : 'Markets Closed'}
        </span>
      </div>
      <button
        onClick={fetchMarketIndices}
        disabled={loadingIndices}
        className="text-[9px] text-zinc-600 hover:text-[#00ff4e] transition-colors flex items-center gap-1.5 px-2 py-1 rounded border border-transparent hover:border-zinc-800"
      >
        <RefreshCw size={10} className={loadingIndices ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">
          {loadingIndices ? 'Updating...' : indicesLastUpdated 
            ? `Updated ${indicesLastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
            : 'Refresh'}
        </span>
      </button>
    </div>

    {/* Indices Grid */}
    {marketIndices ? (
      <div className="grid grid-cols-4 gap-2 md:gap-3">
        {['SPY', 'QQQ', 'DIA', 'IWM'].map(symbol => {
          const index = marketIndices[symbol];
          if (!index) return null;
          
          const color = index.isPositive ? '#00ff4e' : '#ef4444';
          
          return (
            <div 
              key={symbol}
              className="text-center md:text-left"
            >
              <p className="text-[9px] md:text-[10px] font-black text-zinc-500 mb-0.5">
                {index.name}
              </p>
              <p className="text-sm md:text-lg font-black text-white tabular-nums leading-tight">
                ${index.price.toFixed(2)}
              </p>
              <p 
                className="text-[10px] md:text-xs font-black tabular-nums"
                style={{ color }}
              >
                {index.isPositive ? '▲' : '▼'} {index.isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%
              </p>
            </div>
          );
        })}
      </div>
    ) : loadingIndices ? (
      <div className="grid grid-cols-4 gap-2 md:gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-3 bg-zinc-800 rounded w-12 mb-1" />
            <div className="h-5 bg-zinc-800 rounded w-16 mb-1" />
            <div className="h-3 bg-zinc-800 rounded w-10" />
          </div>
        ))}
      </div>
    ) : (
      <div className="text-center py-2">
        <button 
          onClick={fetchMarketIndices}
          className="text-[#00ff4e] text-xs hover:underline"
        >
          Load market data
        </button>
      </div>
    )}
    
  </div>
</div>


{/* Tab Navigation - Bottom bar on mobile, inline on desktop */}
<div className="hidden md:flex gap-3 mb-8">
  {[
    { id: "DASHBOARD", icon: LayoutDashboard },
    { id: "FEED", icon: Activity },
    { id: "TRENDING", icon: Flame },
    { id: "MY LISTS", icon: List },
    { id: "MY POSITIONS", icon: Briefcase },
  ].map(tab => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`flex-1 h-20 flex items-center justify-center rounded-xl transition-all ${
          isActive 
            ? "bg-[#00ff4e] text-black shadow-[0_0_20px_rgba(0,255,78,0.4)]" 
            : "bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800 border border-zinc-800"
        }`}
        title={tab.id}
      >
        <Icon size={32} />
      </button>
    );
  })}
</div>

{/* Mobile Bottom Tab Bar */}
<div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-t border-zinc-800 px-2 pb-[env(safe-area-inset-bottom)]">
  <div className="flex">
    {[
      { id: "DASHBOARD", icon: LayoutDashboard, label: "Home" },
      { id: "FEED", icon: Activity, label: "Feed" },
      { id: "TRENDING", icon: Flame, label: "Trending" },
      { id: "MY LISTS", icon: List, label: "Lists" },
      { id: "MY POSITIONS", icon: Briefcase, label: "Portfolio" },
    ].map(tab => {
      const Icon = tab.icon;
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 flex flex-col items-center justify-center py-6 transition-all ${
            isActive 
              ? "text-[#00ff4e]" 
              : "text-zinc-600"
          }`}
        >
          <Icon size={28} strokeWidth={isActive ? 2.5 : 1.5} />
        </button>
      );
    })}
  </div>
</div>


{activeTab === "DASHBOARD" && (
  <div className="space-y-4 md:space-y-6 mb-6 md:mb-8">
    
    {/* Page Title */}
    <h1 className="text-2xl md:text-3xl font-black text-[#00ff4e] uppercase tracking-tight flex items-center gap-3" style={{textShadow: '0 0 10px rgba(0,255,78,0.4)'}}>
  <LayoutDashboard size={28} className="md:w-8 md:h-8 text-[#00ff4e]" style={{filter: 'drop-shadow(0 0 8px rgba(0,255,78,0.5))'}} />Dashboard
</h1>

    {/* Desktop: Side by side | Mobile: Stacked */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
  
  {/* MANUAL SEARCH SECTION */}
  <div className="bg-[#111111] border border-zinc-800 p-4 md:p-5 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300">
    <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">
      Analyze Any Stock
    </h3>
    <div className="flex flex-col gap-3">
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
            
            // Only search after user stops typing for 500ms and has 2+ characters
            if (value.length < 2) {
              setStockSearchResults([]);
              return;
            }
            
            searchTimeoutRef.current = setTimeout(async () => {
  try {
    const res = await fetch(`https://api.polygon.io/v3/reference/tickers?search=${value}&active=true&limit=5&apiKey=${POLYGON_KEY}`);
    const data = await res.json();
    
    const results = data.results?.slice(0, 5).map(item => ({
      symbol: item.ticker,
      description: item.name
    })) || [];
    
    setStockSearchResults(results);
  } catch (err) {
    console.error('Search failed:', err);
    setStockSearchResults([]);
  }
}, 500);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && manualSearch) {
              setStocks([]); 
              setIsManualResult(true); 
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
        className="w-full hover:opacity-90 disabled:opacity-20 text-black px-6 md:px-8 py-3 rounded-lg text-xs md:text-sm font-black tracking-tighter transition-all shadow-[0_0_15px_rgba(0,255,78,0.2)] active:scale-95 whitespace-nowrap"
        style={{ backgroundColor: '#00ff4e' }}
      >
        {loading && isManualResult ? 'ANALYZING...' : 'ANALYZE STOCK'}
      </button>
    </div>
    
    {/* Search results dropdown */}
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
                  setStocks([]);
                  setManualSearch(result.symbol);
                  setStockSearchResults([]);
                  setIsManualResult(true);
                  await new Promise(r => setTimeout(r, 100));
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

  {/* AI SCANNER SECTION */}
  <div className="bg-[#111111] border border-zinc-800 p-4 md:p-5 rounded-xl shadow-2xl backdrop-blur-md">
    <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">
      Analyze Market
    </h3>
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
<div className="flex items-end gap-2 w-full">
<div className="flex flex-col gap-1 flex-1">
  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Min $</span>
  <input
    type="text"
    inputMode="numeric"
    value={scanPriceMin}
    onChange={(e) => setScanPriceMin(e.target.value)}
    onBlur={(e) => setScanPriceMin(Number(e.target.value) || 0)}
    className="w-full bg-black border border-zinc-800 text-white px-3 py-3 rounded-lg text-xs font-bold outline-none focus:border-[#00ff4e]/50 transition-all tabular-nums"
    min={0}
    step={1}
  />
</div>
<span className="text-zinc-600 font-black pb-3">–</span>
<div className="flex flex-col gap-1 flex-1">
  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Max $</span>
  <input
    type="text"
    inputMode="numeric"
    value={scanPriceMax}
    onChange={(e) => setScanPriceMax(e.target.value)}
    onBlur={(e) => setScanPriceMax(Number(e.target.value) || 500)}
    className="w-full bg-black border border-zinc-800 text-white px-3 py-3 rounded-lg text-xs font-bold outline-none focus:border-[#00ff4e]/50 transition-all tabular-nums"
    min={0}
    step={1}
  />
</div>
        </div>
        
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
      </div>

      <button 
        onClick={() => { 
          setStocks([]);
          setManualSearch(""); 
          setIsManualResult(false);
          runScanner(null); 
        }}
        disabled={loading}
        className="w-full hover:opacity-90 disabled:opacity-20 text-black px-6 md:px-8 py-3 rounded-lg text-xs md:text-sm font-black tracking-tighter transition-all shadow-[0_0_15px_rgba(0,255,78,0.2)] active:scale-95 whitespace-nowrap"
        style={{ backgroundColor: '#00ff4e' }}
      >
        {loading && !isManualResult ? (
          <>
            <span>SCANNING MARKET</span>
            <span className="inline-flex gap-0.5 ml-2">
              <span className="animate-[pulse_1s_ease-in-out_infinite]">.</span>
              <span className="animate-[pulse_1s_ease-in-out_0.2s_infinite]">.</span>
              <span className="animate-[pulse_1s_ease-in-out_0.4s_infinite]">.</span>
            </span>
          </>
        ) : (
          'SCAN MARKET'
        )}
      </button>
    </div>
  </div>
  
</div>

{/* SCAN HISTORY */}
{user && scanHistory.length > 0 && (
  <div className="mt-4">
    <button 
      onClick={() => setShowScanHistory(!showScanHistory)} 
      className="flex items-center gap-2 md:gap-3 transition-all mb-3"
    >
      <History size={14} className={`md:w-4 md:h-4 ${showScanHistory ? 'text-[#00ff4e]' : 'text-white'} transition-colors`} />
      <span className={`text-[10px] md:text-xs font-black uppercase tracking-[0.2em] ${showScanHistory ? 'text-[#00ff4e]' : 'text-white'} transition-colors`}>
        Scan History ({scanHistory.filter(s => new Date(s.timestamp) > new Date(Date.now() - 24*60*60*1000)).length} in 24hr)
      </span>
      <motion.span animate={{ rotate: showScanHistory ? 180 : 0 }} className={`text-[10px] ${showScanHistory ? 'text-[#00ff4e]' : 'text-zinc-500'}`}>▼</motion.span>
    </button>
    
    <AnimatePresence>
      {showScanHistory && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {scanHistory.map((scan, i) => {
              const isRecent = new Date(scan.timestamp) > new Date(Date.now() - 24*60*60*1000);
              const timeAgo = (() => {
                const diff = Date.now() - new Date(scan.timestamp).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                return `${Math.floor(hrs / 24)}d ago`;
              })();
              const change = parseFloat(scan.change);
              
              return (
                <button
                  key={`${scan.symbol}-${i}`}
                  onClick={() => {
                    setManualSearch(scan.symbol);
                    setIsManualResult(true);
                    setStocks([]);
                    runScanner(scan.symbol);
                    setShowScanHistory(false);
                  }}
                  className="w-full flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-[#00ff4e]/30 transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-white">{scan.symbol}</span>
                      <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">{scan.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-sm font-black text-white">${scan.price}</span>
                      <span className={`text-xs font-bold ml-2 ${change >= 0 ? 'text-[#00ff4e]' : 'text-[#FF4B2B]'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-[9px] font-bold ${isRecent ? 'text-[#00ff4e]' : 'text-zinc-600'}`}>
                        {timeAgo}
                      </span>
                      {isRecent && (
                        <span className="text-[8px] text-zinc-600 uppercase">24hr lock</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)}

{/* MANUAL SEARCH RESULTS - Shows right after search box */}
{isManualResult && displayedStocks.length > 0 && (
  <div className="space-y-6 md:space-y-8 mb-6">
    {displayedStocks.map((stock) => (
      <MetricCard 
        key={stock.symbol}
        stock={getStableStock(stock)}
        isMarketOpen={isMarketOpen} 
        livePrices={livePrices}
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
        onScanSimilar={handleScanSimilar}
        aiModel={aiModel}
  db={db}
      />
    ))}
  </div>
)}

  
  </div>
)}


{/* SORT & FILTER BAR */}
      {activeTab === "DASHBOARD" && stocks.length > 0 && (
        <div className="bg-[#111111] border border-zinc-900 rounded-lg p-3 md:p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
          <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
            Filters:
          </span>
          
          <div className="grid grid-cols-2 sm:flex gap-2 md:gap-4 w-full sm:w-auto">
            <CustomDropdown
              value={sortBy}
              onChange={setSortBy}
              label="Sort"
              options={[
                { value: 'default', label: 'Default' },
                { value: 'change-high', label: 'Change ↓' },
                { value: 'change-low', label: 'Change ↑' },
                { value: 'price-high', label: 'Price ↓' },
                { value: 'price-low', label: 'Price ↑' },
                { value: 'volume', label: 'Volume ↓' },
                { value: 'news', label: 'Most News' }
              ]}
            />
            
            <CustomDropdown
              value={filterSignal}
              onChange={setFilterSignal}
              label="Trigger"
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'news', label: 'News' },
                { value: 'volume', label: 'Volume' },
                { value: 'breakout', label: 'Breakout' },
                { value: 'momentum', label: 'Momentum' },
                { value: 'gainer', label: 'Gainer' }
              ]}
            />
            

          </div>
          {(sortBy !== "default" || filterSignal !== "all") && (
            <button
              onClick={() => {
                setSortBy("default");
setFilterSignal("all");
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
{/* Initial Loading State - No stocks yet */}
{loading && stocks.length === 0 && (
  <div className="py-32 text-center">
    <div className="flex justify-center mb-3">
      <img 
        src="/jckrbbt_logo_animated.svg" 
        alt="Loading" 
        className="w-40 h-40"
      />
    </div>
    
    <p className="text-sm font-black text-white uppercase tracking-wider mb-2 animate-pulse">
      {scanStatus}
    </p>
    <p className="text-xs text-zinc-600 mb-6">
      This may take a minute...
    </p>
    
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

{/* Scanning Header - Shows while scanning WITH stocks already found */}
{loading && stocks.length > 0 && !isManualResult && (
  <div className="mb-6 bg-gradient-to-r from-[#00ff4e]/5 to-transparent border border-[#00ff4e]/30 rounded-xl p-4 md:p-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        {/* Spinning loader */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full border-2 border-[#00ff4e]/20 border-t-[#00ff4e] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-[#00ff4e] rounded-full animate-pulse shadow-[0_0_10px_#00ff4e]" />
          </div>
        </div>
        <div>
          <p className="text-sm font-black text-white uppercase tracking-wider">
            Still scanning...
          </p>
          <p className="text-xs text-zinc-500 font-mono truncate max-w-[200px] sm:max-w-none">
            {scanStatus}
          </p>
        </div>
      </div>
      
      {/* Found counter */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-3xl font-black text-[#00ff4e] leading-none">{stocks.length}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Found</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-black text-zinc-600 leading-none">5</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Target</p>
        </div>
      </div>
    </div>
    
    {/* Progress bar */}
    <div className="relative h-2 bg-zinc-900 rounded-full overflow-hidden">
      <div 
        className="absolute h-full bg-[#00ff4e] transition-all duration-500 ease-out"
        style={{ 
          width: `${scanProgress}%`,
          boxShadow: '0 0 15px rgba(0,255,78,0.4)'
        }}
      />
      {/* Animated shimmer effect */}
      <div 
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
        style={{ 
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s infinite'
        }}
      />
    </div>
    <p className="text-xs text-zinc-600 mt-2 text-center">
      {scanProgress}% complete • Stocks appear as they're discovered
    </p>
  </div>
)}

{!isManualResult && displayedStocks.map((stock, index) => (
    <MetricCard 
      key={stock.symbol}
      stock={getStableStock(stock)}
      isMarketOpen={isMarketOpen}
      livePrices={livePrices} 
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
      onScanSimilar={handleScanSimilar}
       aiModel={aiModel}
  db={db}
    />
  ))}

  {/* Scan Complete Indicator */}
  {!loading && scanComplete && stocks.length > 0 && !isManualResult && (
    <div className="mt-8 py-6 border-t border-zinc-900 text-center">
      <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00ff4e]/10 border border-[#00ff4e]/30 rounded-full">
        <svg className="w-4 h-4 text-[#00ff4e] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-xs font-black text-[#00ff4e] uppercase tracking-wider whitespace-nowrap">
          Scan Complete
        </span>
        <span className="text-xs text-white whitespace-nowrap">
          • {stocks.length} opportunities found
        </span>
      </div>
      <p className="text-xs text-zinc-600 mt-3 px-4">
        Run another scan or adjust<br />filters to discover more
      </p>
    </div>
  )}
    {/* MARKET NEWS - Bottom Section */}
    <div className="mt-8 md:mt-12 border-t-2 border-zinc-900 pt-6">
      <button
        onClick={() => {
          if (newsArticles.length === 0) fetchNews();
          setShowDashboardNews(prev => !prev);
        }}
        className="group flex items-center gap-3 mb-4"
      >
        <Newspaper size={18} className={`${showDashboardNews ? 'text-[#00ff4e]' : 'text-zinc-600 group-hover:text-zinc-400'} transition-colors`} />
<span className={`text-2xl md:text-3xl font-black uppercase tracking-tight ${showDashboardNews ? 'text-[#00ff4e]' : 'text-white group-hover:text-zinc-300'} transition-colors`}>  Market News
        </span>
        <span className={`text-xs ${showDashboardNews ? 'text-[#00ff4e]' : 'text-zinc-600'} transition-transform ${showDashboardNews ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      <AnimatePresence>
        {showDashboardNews && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: 0.4 } }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {loadingNews && newsArticles.length === 0 && (
              <div className="py-16 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
                <p className="text-xs tracking-[0.4em] uppercase font-black">Loading News...</p>
              </div>
            )}
            {!loadingNews && newsArticles.length === 0 && (
              <div className="py-16 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
                <p className="text-xs tracking-[0.4em] uppercase font-black">No News Available</p>
              </div>
            )}
            <div className="space-y-3">
              {newsArticles.slice(0, 10).map(article => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
            {newsArticles.length > 10 && (
              <button
                onClick={() => setShowAllNews(prev => !prev)}
                className="w-full mt-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider hover:text-[#00ff4e] transition-colors"
              >
                {showAllNews ? 'Show Less' : `View All ${newsArticles.length} Articles`}
              </button>
            )}
            <AnimatePresence>
              {showAllNews && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3 mt-3 overflow-hidden"
                >
                  {newsArticles.slice(10).map(article => (
                    <NewsCard key={article.id} article={article} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

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
    {/* Page Title */}
<h1 className="text-2xl md:text-3xl font-black text-[#00ff4e] uppercase tracking-tight flex items-center gap-3" style={{textShadow: '0 0 10px rgba(0,255,78,0.4)'}}> <Flame size={28} className="md:w-8 md:h-8 text-[#00ff4e]" style={{filter: 'drop-shadow(0 0 8px rgba(0,255,78,0.5))'}} />Trending
</h1>

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
    {/* Page Title */}
<h1 className="text-2xl md:text-3xl font-black text-[#00ff4e] uppercase tracking-tight flex items-center gap-3" style={{textShadow: '0 0 10px rgba(0,255,78,0.4)'}}>  <List size={28} className="md:w-8 md:h-8 text-[#00ff4e]" style={{filter: 'drop-shadow(0 0 8px rgba(0,255,78,0.5))'}} /> My Lists
</h1>

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
                        livePrices={livePrices}
                        onAction={(stock) => setShowAddToListMenu(stock)}
                        removeFromWatchlist={(symbol) => removeStockFromList(list.id, symbol)}
                        actionType="REMOVE"
                        watchlist={flattenedWatchlist}
                        showAddToListMenu={showAddToListMenu}
                        onCloseMenu={() => setShowAddToListMenu(null)}
                        watchlists={watchlists}
                        onAddToList={addStockToList}
                        user={user}
                        onOpenChat={(stock) => setShowStockChat(stock)}
                        onScanSimilar={handleScanSimilar}
                         aiModel={aiModel}
                        db={db}
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
{/* Lists I Follow */}
      {user && followedListsData.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg md:text-xl font-black text-zinc-500 uppercase tracking-tight mb-4 flex items-center gap-2">
            <Heart size={18} className="text-[#00ff4e]" />
            Lists I Follow
          </h2>
          <div className="space-y-4">
            {followedListsData.map((list, index) => (
              <motion.div
                key={list.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-6 hover:border-zinc-700 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3
                        onClick={() => setSelectedWatchlist(selectedWatchlist?.id === list.id ? null : list)}
                        className="text-xl font-black text-white uppercase tracking-tight cursor-pointer hover:text-[#00ff4e] transition-colors"
                      >
                        {list.name}
                      </h3>
                      <span className="text-[8px] font-black bg-[#00ff4e]/10 text-[#00ff4e] px-2 py-1 rounded border border-[#00ff4e]/30 uppercase">
                        Following
                      </span>
                    </div>
                    {list.description && (
                      <p className="text-sm text-zinc-400 mb-1">{list.description}</p>
                    )}
                    <p className="text-xs text-zinc-600">
                      {list.stocks?.length || 0} stocks · {list.followerCount || 0} followers
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const { toggleFollowWatchlist } = await import('./watchlistService');
                          await toggleFollowWatchlist(user.uid, list.id, false);
                          setFollowedLists(prev => prev.filter(id => id !== list.id));
                        } catch (e) {
                          console.error('Unfollow error:', e);
                        }
                      }}
                      className="text-zinc-500 hover:text-red-500 transition-colors p-2 text-[10px] font-black uppercase"
                    >
                      Unfollow
                    </button>
                    <button
                      onClick={() => setSelectedWatchlist(selectedWatchlist?.id === list.id ? null : list)}
                      className="text-zinc-500 hover:text-white transition-colors text-sm font-bold uppercase"
                    >
                      {selectedWatchlist?.id === list.id ? 'Hide ▲' : 'View ▼'}
                    </button>
                  </div>
                </div>

                {/* Expanded stocks */}
                <AnimatePresence>
                  {selectedWatchlist?.id === list.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-6 md:space-y-8 mt-4">
                        {list.stocks?.map((stock) => (
                          <MetricCard
                            key={stock.symbol}
                            stock={getStableStock(stock)}
                            isMarketOpen={isMarketOpen}
                            livePrices={livePrices}
                            onAction={(stock) => setShowAddToListMenu(stock)}
                            actionType="ADD"
                            watchlist={flattenedWatchlist}
                            showAddToListMenu={showAddToListMenu}
                            onCloseMenu={() => setShowAddToListMenu(null)}
                            watchlists={watchlists}
                            onAddToList={addStockToList}
                            user={user}
                            onOpenChat={(stock) => setShowStockChat(stock)}
                            onScanSimilar={handleScanSimilar}
                            aiModel={aiModel}
                            db={db}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </>

) : activeTab === "FEED" ? (
  <>
<h1 className="text-2xl md:text-3xl font-black text-[#00ff4e] uppercase tracking-tight flex items-center gap-3" style={{textShadow: '0 0 10px rgba(0,255,78,0.4)'}}> <Activity size={28} className="md:w-8 md:h-8 text-[#00ff4e]" style={{filter: 'drop-shadow(0 0 8px rgba(0,255,78,0.5))'}} />Activity Feed
</h1>
    <p className="text-xs text-zinc-500 font-bold mb-6">
      {following.length > 0 ? 'What people you follow are watching' : 'Discover what the community is watching'}
    </p>

    {loadingFeed && feedActivities.length === 0 && (
      <div className="py-32 text-center opacity-20 border-2 border-dashed border-zinc-900 rounded-xl">
        <p className="text-xs tracking-[0.4em] uppercase font-black">Loading Feed...</p>
      </div>
    )}

    {!loadingFeed && feedActivities.length === 0 && (
      <div className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-xl">
        <Activity size={32} className="mx-auto text-zinc-700 mb-4" />
        <p className="text-sm font-black text-zinc-500 mb-2">No Activity Yet</p>
        <p className="text-xs text-zinc-600 max-w-xs mx-auto">
          {following.length > 0 
            ? "People you follow haven't made any moves yet. Check back soon!" 
            : "Follow other users from the community to see their activity here."}
        </p>
      </div>
    )}

    {feedActivities.length > 0 && (
      <div className="space-y-2">
        {feedActivities.map((activity) => {
          const timeAgo = (() => {
            const diff = Date.now() - new Date(activity.timestamp).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return 'just now';
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            const days = Math.floor(hrs / 24);
            if (days < 7) return `${days}d ago`;
            return new Date(activity.timestamp).toLocaleDateString();
          })();

          const getActivityIcon = (type) => {
            switch (type) {
              case 'add_stock': return { icon: Plus, color: '#00ff4e', bg: '#00ff4e15' };
              case 'remove_stock': return { icon: Trash2, color: '#FF4B2B', bg: '#FF4B2B15' };
              case 'create_list': return { icon: List, color: '#3b82f6', bg: '#3b82f615' };
              case 'follow_list': return { icon: Heart, color: '#ec4899', bg: '#ec489915' };
              default: return { icon: Activity, color: '#71717a', bg: '#71717a15' };
            }
          };

          const actStyle = getActivityIcon(activity.type);
          const ActIcon = actStyle.icon;

          const getActivityText = () => {
            switch (activity.type) {
              case 'add_stock':
                return (
                  <>
                    added{' '}
                    <button
                      onClick={() => {
                        setManualSearch(activity.targetSymbol);
                        setActiveTab('DASHBOARD');
                        runScanner(activity.targetSymbol);
                      }}
                      className="font-black text-[#00ff4e] hover:underline"
                    >
                      {activity.targetSymbol}
                    </button>
                    {' '}to{' '}
                    <span className="font-black text-white">{activity.targetListName}</span>
                  </>
                );
              case 'remove_stock':
                return (
                  <>
                    removed{' '}
                    <span className="font-black text-red-400">{activity.targetSymbol}</span>
                    {' '}from{' '}
                    <span className="font-black text-white">{activity.targetListName}</span>
                  </>
                );
              case 'create_list':
                return (
                  <>
                    created a new list:{' '}
                    <span className="font-black text-white">{activity.targetListName}</span>
                  </>
                );
              case 'follow_list':
                return (
                  <>
                    followed{' '}
                    <span className="font-black text-white">{activity.targetListName}</span>
                  </>
                );
              default:
                return 'did something';
            }
          };

          return (
            <div 
              key={activity.id}
              className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 hover:border-zinc-700 transition-all"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {activity.userAvatar ? (
                    <img 
                      src={activity.userAvatar} 
                      alt="" 
                      className="w-10 h-10 rounded-full border-2 border-zinc-800"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
                      <span className="text-sm font-black text-zinc-500">
                        {(activity.userName || '?')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    <span className="font-black text-white">{activity.userName || 'Someone'}</span>
                    {' '}
                    {getActivityText()}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <ActIcon size={12} style={{ color: actStyle.color }} />
                    <span className="text-[10px] font-bold text-zinc-600">{timeAgo}</span>
                  </div>
                </div>

                {/* Stock badge if applicable */}
                {activity.targetSymbol && (
                  <button
                    onClick={() => {
                      setManualSearch(activity.targetSymbol);
                      setActiveTab('DASHBOARD');
                      runScanner(activity.targetSymbol);
                    }}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-[#00ff4e]/50 hover:bg-[#00ff4e]/5 transition-all"
                  >
                    <span className="text-xs font-black text-white">{activity.targetSymbol}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </>
    
) : activeTab === "MY POSITIONS" ? (
  <>
    {/* Page Title */}
<h1 className="text-2xl md:text-3xl font-black text-[#00ff4e] uppercase tracking-tight flex items-center gap-3" style={{textShadow: '0 0 10px rgba(0,255,78,0.4)'}}>  <Briefcase size={28} className="md:w-8 md:h-8 text-[#00ff4e]" style={{filter: 'drop-shadow(0 0 8px rgba(0,255,78,0.5))'}} />My Positions
</h1>

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

{wsStatus === 'connected' && (
  <div className="flex items-center gap-1.5">
    <div className="w-1.5 h-1.5 rounded-full bg-[#00ff4e] animate-pulse" />
    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Live</span>
  </div>
)}

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

{/* Portfolio Analytics */}
                <PortfolioAnalytics 
                  positions={positions} 
                  polygonKey={POLYGON_KEY} 
                />

                {/* Position Cards */}
                {positions.map((position, index) => {
                  const isPositionAdded = flattenedWatchlist.some(s => s.symbol === position.symbol);
                  const isHoveringThisPosition = hoveringPositionSymbol === position.symbol;
                  
                  return (
                    <PositionCard
                      key={position.symbol}
                      position={position}
                      index={index}
                      livePrices={livePrices}
                      isPositionAdded={isPositionAdded}
                      isHoveringThisPosition={isHoveringThisPosition}
                      setHoveringPositionSymbol={setHoveringPositionSymbol}
                      user={user}
                      watchlists={watchlists}
                      flattenedWatchlist={flattenedWatchlist}
                      showAddToListMenu={showAddToListMenu}
                      setShowAddToListMenu={setShowAddToListMenu}
                      addStockToList={addStockToList}
                      removeStockFromList={removeStockFromList}
                      setManualSearch={setManualSearch}
                      setActiveTab={setActiveTab}
                      runScanner={runScanner}
                    />
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
  followedLists={followedLists}
  
onStockClick={(stock) => {
  setShowUserProfileModal(false);
  setViewingUser(null);
  setManualSearch(stock.symbol);
  setActiveTab('discover');
  runScanner(stock.symbol);
}}
  
onCopyWatchlist={async (list) => {
  const newId = await createWatchlist(user.uid, `${list.name} (copy)`, list.description, false);
  for (const stock of list.stocks) {
    await addStockToWatchlist(newId, stock);
  }
  // Refresh watchlists - use however you currently load them
  const updated = await getUserWatchlists(user.uid);
  setWatchlists(updated);
}}
  

onFollowList={async (listId) => {
  if (followedLists.includes(listId)) return;
  try {
    const { toggleFollowWatchlist } = await import('./watchlistService');
    await toggleFollowWatchlist(user.uid, listId, true);
    setFollowedLists(prev => [...prev, listId]);
    
    logActivity(db, {
      userId: user.uid,
      userName: user.displayName,
      userAvatar: user.photoURL,
      type: 'follow_list',
      targetListId: listId,
      targetListName: followedListsData.find(l => l.id === listId)?.name || 
                      publicWatchlists.find(l => l.id === listId)?.name || 
                      'a list',
    });
  } catch (e) {
    console.error('Follow list error:', e);
  }
}}

onUnfollowList={async (listId) => {
  try {
    const { toggleFollowWatchlist } = await import('./watchlistService');
    await toggleFollowWatchlist(user.uid, listId, false);
    setFollowedLists(prev => prev.filter(id => id !== listId));
  } catch (e) {
    console.error('Unfollow list error:', e);
  }
}}
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


const StockChart = ({ symbol, polygonKey }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1D');
  const [showVolume, setShowVolume] = useState(false);
  const [priceChange, setPriceChange] = useState(null);
  const [hoverData, setHoverData] = useState(null);

  const TIME_RANGES = [
    { label: '1D', multiplier: 5, timespan: 'minute', days: 1 },
    { label: '1W', multiplier: 15, timespan: 'minute', days: 7 },
    { label: '1M', multiplier: 1, timespan: 'hour', days: 30 },
    { label: '3M', multiplier: 1, timespan: 'day', days: 90 },
    { label: '6M', multiplier: 1, timespan: 'day', days: 180 },
    { label: '1Y', multiplier: 1, timespan: 'day', days: 365 },
    { label: 'ALL', multiplier: 1, timespan: 'week', days: 1825 },
  ];

  const fetchChartData = useCallback(async (range) => {
    if (!symbol) return;
    setLoading(true);

    const config = TIME_RANGES.find(r => r.label === range);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - config.days);

    // For 1D, if it's a weekend/holiday, go back to last trading day
    if (range === '1D') {
      const day = to.getDay();
      if (day === 0) from.setDate(from.getDate() - 2); // Sunday -> Friday
      if (day === 6) from.setDate(from.getDate() - 1); // Saturday -> Friday
    }

    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    try {
      const res = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${config.multiplier}/${config.timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=5000&apiKey=${polygonKey}`
      );
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        setChartData([]);
        setLoading(false);
        return;
      }

      const formatted = data.results.map((bar) => {
        const date = new Date(bar.t);
        let label;

        if (range === '1D') {
          label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (range === '1W') {
          label = date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        } else if (range === '1M' || range === '3M') {
          label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } else {
          label = date.toLocaleDateString([], { month: 'short', year: '2-digit' });
        }

        return {
          time: label,
          timestamp: bar.t,
          price: bar.c,
          open: bar.o,
          high: bar.h,
          low: bar.l,
          volume: bar.v,
        };
      });

      setChartData(formatted);

      // Calculate price change for the period
      if (formatted.length >= 2) {
        const first = formatted[0].price;
        const last = formatted[formatted.length - 1].price;
        const change = ((last - first) / first) * 100;
        setPriceChange(change);
      }
    } catch (error) {
      console.error('Chart data fetch error:', error);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, polygonKey]);

  useEffect(() => {
    fetchChartData(timeRange);
  }, [timeRange, fetchChartData]);

  const isPositive = priceChange === null ? true : priceChange >= 0;
  const chartColor = isPositive ? '#00ff4e' : '#FF4B2B';
  const gradientId = `gradient-${symbol}-${timeRange}`;
  const volumeGradientId = `vol-gradient-${symbol}`;

  // Display price from hover or latest
  const displayPrice = hoverData?.price ?? chartData[chartData.length - 1]?.price;
  const displayTime = hoverData?.time ?? null;

  // Format volume for tooltip
  const formatVol = (v) => {
    if (!v) return '0';
    if (v >= 1000000000) return (v / 1000000000).toFixed(1) + 'B';
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
    return v.toString();
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      // Update hover state
      if (!hoverData || hoverData.timestamp !== data.timestamp) {
        setTimeout(() => setHoverData(data), 0);
      }
      return null; // We display in the header instead
    }
    return null;
  };

  // Calculate Y-axis domain with padding
  const prices = chartData.map(d => d.price).filter(Boolean);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const pricePadding = (maxPrice - minPrice) * 0.1 || 1;

  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-3 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 md:mb-4">
        <div className="flex items-center gap-3">
          <h4 className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {symbol}
          </h4>
          {displayPrice && (
            <span className="text-sm md:text-base font-black text-white tabular-nums">
              ${displayPrice.toFixed(2)}
            </span>
          )}
          {priceChange !== null && !hoverData && (
            <span 
              className="text-[10px] md:text-xs font-black tabular-nums"
              style={{ color: chartColor }}
            >
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          )}
          {displayTime && (
            <span className="text-[10px] text-zinc-600 font-mono">{displayTime}</span>
          )}
        </div>

        {/* Volume Toggle */}
        <button
          onClick={() => setShowVolume(!showVolume)}
          className={`text-[8px] md:text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded border transition-all ${
            showVolume 
              ? 'bg-[#00ff4e]/10 text-[#00ff4e] border-[#00ff4e]/30' 
              : 'bg-transparent text-zinc-600 border-zinc-800 hover:text-zinc-400 hover:border-zinc-700'
          }`}
        >
          Vol {showVolume ? 'On' : 'Off'}
        </button>
      </div>

      {/* Time Range Tabs */}
      <div className="flex gap-1 mb-3 md:mb-4">
        {TIME_RANGES.map(({ label }) => (
          <button
            key={label}
            onClick={() => {
              setTimeRange(label);
              setHoverData(null);
            }}
            className={`flex-1 text-[9px] md:text-[10px] font-black uppercase tracking-wider py-1.5 md:py-2 rounded-md transition-all ${
              timeRange === label
                ? 'text-black'
                : 'bg-transparent text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900'
            }`}
            style={timeRange === label ? { backgroundColor: chartColor } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-[200px] md:h-[260px] flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#00ff4e]/30 border-t-[#00ff4e] rounded-full animate-spin" />
            <span className="text-xs text-zinc-600 font-bold">Loading chart...</span>
          </div>
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-[200px] md:h-[260px] flex items-center justify-center">
          <span className="text-xs text-zinc-600 font-bold uppercase tracking-wider">No data available</span>
        </div>
      ) : (
        <div 
          className="h-[200px] md:h-[260px]"
          onMouseLeave={() => setHoverData(null)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={chartData} 
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={volumeGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <XAxis 
                dataKey="time" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#52525b', fontSize: 9, fontFamily: 'monospace' }}
                interval="preserveStartEnd"
                minTickGap={50}
              />

              <YAxis 
                domain={[minPrice - pricePadding, maxPrice + pricePadding]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#52525b', fontSize: 9, fontFamily: 'monospace' }}
                tickFormatter={(v) => `$${v.toFixed(v >= 100 ? 0 : 2)}`}
                width={55}
                yAxisId="price"
              />

              {showVolume && (
                <YAxis 
                  yAxisId="volume"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={false}
                  width={0}
                />
              )}

              {showVolume && (
                <Bar 
                  dataKey="volume" 
                  yAxisId="volume"
                  fill={`url(#${volumeGradientId})`}
                  radius={[1, 1, 0, 0]}
                  isAnimationActive={false}
                />
              )}

              <Area
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                yAxisId="price"
                isAnimationActive={true}
                animationDuration={800}
                dot={false}
                activeDot={{ 
                  r: 4, 
                  fill: chartColor, 
                  stroke: '#000', 
                  strokeWidth: 2,
                  style: { filter: `drop-shadow(0 0 6px ${chartColor})` }
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer Stats */}
      {chartData.length > 0 && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/50">
          <div className="flex gap-4">
            <div>
              <span className="text-[8px] text-zinc-600 font-black uppercase">High</span>
              <p className="text-[10px] md:text-xs font-black text-white tabular-nums">${Math.max(...prices).toFixed(2)}</p>
            </div>
            <div>
              <span className="text-[8px] text-zinc-600 font-black uppercase">Low</span>
              <p className="text-[10px] md:text-xs font-black text-white tabular-nums">${Math.min(...prices).toFixed(2)}</p>
            </div>
            {showVolume && (
              <div>
                <span className="text-[8px] text-zinc-600 font-black uppercase">Avg Vol</span>
                <p className="text-[10px] md:text-xs font-black text-white tabular-nums">
                  {formatVol(chartData.reduce((sum, d) => sum + (d.volume || 0), 0) / chartData.length)}
                </p>
              </div>
            )}
          </div>
          <span className="text-[8px] text-zinc-700 font-mono">{timeRange} · {chartData.length} bars</span>
        </div>
      )}
    </div>
  );
};

// =============================================
// REPLACE: MetricCard Component (v3 - Inline AI Chat)
// =============================================
// Find: const MetricCard = React.memo(function MetricCard
// Replace everything through the closing });
// (the one right before "const PositionCard = React.memo")

const MetricCard = React.memo(function MetricCard({ 
  stock, isMarketOpen, onAction, actionType, watchlist = [], 
  removeFromWatchlist, showAddToListMenu, onCloseMenu, 
  watchlists = [], onAddToList, user, onOpenChat, onScanSimilar,
  aiModel, db
}) {
  const [showChart, setShowChart] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [isHoveringButton, setIsHoveringButton] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const cardRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const prevPrice = useRef(null);
  const prevChange = useRef(null);
  const hasAnimatedRef = useRef(false);
  
  const isPositive = parseFloat(stock.change) >= 0;
  const accent = isPositive ? '#00ff4e' : '#FF4B2B';
  const trendColor = isPositive ? '#00ff4e' : '#FF4B2B';
  const Triangle = isPositive ? '▲' : '▼';
  const prefix = isPositive ? '+' : '';
  const isAlreadyAdded = watchlist.some(s => s.symbol === stock.symbol);
  
  const shouldAnimate = !hasAnimatedRef.current || 
    (prevPrice.current !== null && prevPrice.current !== stock.price) ||
    (prevChange.current !== null && prevChange.current !== stock.change);

    const [chatLoaded, setChatLoaded] = useState(false);
  const [hasSavedChat, setHasSavedChat] = useState(false);

  // Load saved chat history on mount
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
    prevPrice.current = stock.price;
    prevChange.current = stock.change;
    hasAnimatedRef.current = true;
  }, [stock.price, stock.change]);

useEffect(() => {
    if (!showAddToListMenu) return;
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

  // Auto-scroll chat
  useEffect(() => {
    if (chatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
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
    dataPoints.push(`Price: $${stock.price}`);
    dataPoints.push(`Change: ${parseFloat(stock.change) >= 0 ? '+' : ''}${stock.change}%`);
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
    <div 
      ref={cardRef}
      className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-8 relative hover:border-zinc-600 transition-all overflow-hidden group"
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
                {isAlreadyAdded ? (isHoveringButton ? "Remove" : "Added") : "Add"}
              </span>
              {isAlreadyAdded && isHoveringButton ? (
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

      {/* HEADER: Symbol + Price */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-6 md:mb-8 gap-4">
        <div className="flex-1">
          <p className="text-[8px] md:text-[10px] text-[#ffffff] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] mb-2 flex items-start gap-2 pr-24 md:pr-0">
            <span 
              className={`h-1.5 w-1.5 md:h-2 md:w-2 rounded-full flex-shrink-0 mt-1 ${isMarketOpen ? 'animate-pulse' : ''}`} 
              style={{ backgroundColor: accent, boxShadow: isMarketOpen ? `0 0 15px ${accent}` : 'none' }} 
            />
            <span className="break-words leading-relaxed">{stock.name}</span>
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

{/* Catalyst Type Badge */}
<div className="md:text-right md:border-l-2 md:border-zinc-900 md:pl-8">
          <p className="text-[8px] md:text-[10px] text-zinc-500 font-black uppercase tracking-wider md:tracking-widest mb-2">Trigger</p>
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
      </div>

            {/* CHART TOGGLE */}
<div className="border-t-2 border-zinc-900 mt-4 md:mt-6 pt-4 md:pt-6 pb-4 md:pb-6">
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
              <StockChart symbol={stock.symbol} polygonKey={process.env.REACT_APP_POLYGON_KEY} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CATALYST - Why It's Moving */}
      <div className="border-t-2 border-zinc-900 pt-4 md:pt-8 mt-0 md:mt-0 mb-6 md:mb-8">
        <div className="flex items-start gap-3 md:gap-4">
          <div 
            className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center mt-0.5"
            style={{ backgroundColor: `${catalystStyle.color}15`, border: `1px solid ${catalystStyle.color}40` }}
          >
            <CatalystIcon size={18} className="md:w-5 md:h-5" style={{ color: catalystStyle.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[8px] md:text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">
              Why It's Moving
            </p>
            <p className="text-lg md:text-2xl font-black text-white leading-tight">
              {(() => {
                const c = stock.catalyst || '';
                const isUseless = c.toLowerCase().includes('no clear') || 
                                  c.toLowerCase().includes('not identified') || 
                                  c.toLowerCase().includes('provided summaries') ||
                                  c.toLowerCase().includes('no catalyst');
                if (c && !isUseless) return c;
                return stock.headline?.slice(0, 80) || stock.trigger || 'Unusual activity detected';
              })()}
            </p>
          </div>
        </div>
      </div>

      {/* QUICK STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-6 md:mb-8">
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
            <p className="text-xs md:text-sm font-black text-zinc-300 uppercase leading-tight">{stock.industry}</p>
          </div>
        )}
      </div>

      {/* NEWS SOURCE ATTRIBUTION */}
      {stock.newsSource && (
        <a 
          href={stock.news?.[0]?.article_url || stock.news?.[0]?.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 mb-6 md:mb-8 px-4 py-3 bg-zinc-900/50 rounded-lg border border-[#00ff4e]/30 hover:border-[#00ff4e] hover:bg-[#00ff4e]/5 transition-all cursor-pointer group/headline"
        >
          <Newspaper size={14} className="text-[#00ff4e]/50 group-hover/headline:text-[#00ff4e] flex-shrink-0 transition-colors" />
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm text-zinc-300 group-hover/headline:text-white truncate transition-colors">{stock.headline}</p>
            <p className="text-[10px] text-zinc-600">
              {stock.newsSource}{stock.newsDate ? ` · ${stock.newsDate}` : ''}
            </p>
          </div>
          <span className="text-zinc-700 group-hover/headline:text-[#00ff4e] transition-colors flex-shrink-0 hidden md:block">→</span>
        </a>
      )}

{/* CHAT SECTION WITH BORDER */}
      {chatMessages.length > 0 && (
        <div className="border-t-2 border-zinc-900 pt-4 md:pt-6 mb-0">
          <AnimatePresence>
            {chatOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1, transition: { duration: 0.4 } }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-3 md:p-4 mb-4">
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
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] px-3 md:px-4 py-2.5 rounded-lg ${
                          msg.role === 'user' 
                            ? 'bg-[#00ff4e]/10 text-white border border-[#00ff4e]/20' 
                            : 'bg-black text-zinc-300 border border-zinc-800'
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
                        <div className="bg-black border border-zinc-800 px-4 py-2.5 rounded-lg">
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
                    
                    <div ref={chatEndRef} />
                  </div>

                  {/* Disclaimer */}
                  <p className="text-[9px] text-zinc-700 mt-3 text-center">
                    AI-powered research with web search <br /> Not financial advice
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

      {/* ASK AI SECTION */}
      <div className="pt-0 md:pt-0 mb-2 md:mb-3">
<div className="flex items-center gap-2 md:gap-3 mb-3">
 <Lightbulb size={14} className="md:w-4 md:h-4 text-[#00ff4e]" />
  <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-white">
    Ask AI
  </span>
</div>
        
        {/* Quick Prompt Pills - compact, wrapping row */}
        <div className="flex flex-wrap gap-1.5 md:gap-2 mb-3">
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                sendChatMessage(prompt);
              }}
              disabled={chatLoading}
              className="text-[10px] md:text-xs font-bold px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-[#00ff4e] hover:border-[#00ff4e]/30 hover:bg-[#00ff4e]/5 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
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
              className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff4e]/50 transition-colors disabled:opacity-50 font-mono placeholder:text-zinc-600"
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

{/* NEWS ARTICLES TOGGLE */}
      {stock.news && stock.news.length > 0 && (
        <div className="border-t-2 border-zinc-900 mt-4 md:mt-6 pt-4 md:pt-6">
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
                    className="block p-3 md:p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-[#00ff4e]/30 hover:bg-zinc-900 transition-all group/article"
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
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.stock.price === nextProps.stock.price &&
    prevProps.stock.change === nextProps.stock.change &&
    prevProps.stock.symbol === nextProps.stock.symbol &&
    prevProps.isMarketOpen === nextProps.isMarketOpen &&
    prevProps.showAddToListMenu?.symbol === nextProps.showAddToListMenu?.symbol &&
    prevProps.watchlist.length === nextProps.watchlist.length &&
    prevProps.aiModel === nextProps.aiModel &&
    prevProps.db === nextProps.db
  );
});

// =============================================
// PORTFOLIO ANALYTICS COMPONENT (Premium v2)
// =============================================
const PortfolioAnalytics = React.memo(function PortfolioAnalytics({ positions, polygonKey }) {
  const [sectorData, setSectorData] = useState({});
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [activeChart, setActiveChart] = useState('allocation');
  const [activeIndex, setActiveIndex] = useState(null);

  // Fetch sector data for all positions
  useEffect(() => {
    if (!positions || positions.length === 0) return;

    
    const fetchSectors = async () => {
      setLoadingSectors(true);
      const sectors = {};
      
      await Promise.all(
        positions.filter(p => p.symbol && p.symbol !== 'N/A' && !p.symbol.includes(':')).map(async (position) => {
          try {
            const res = await fetch(
              `https://api.polygon.io/v3/reference/tickers/${position.symbol}?apiKey=${polygonKey}`
            );
            const data = await res.json();
            const sic = data.results?.sic_description || 'Unknown';
            
            let sector = 'Other';
            const sicLower = sic.toLowerCase();
            if (sicLower.includes('software') || sicLower.includes('computer') || sicLower.includes('semiconductor') || sicLower.includes('electronic')) sector = 'Technology';
            else if (sicLower.includes('pharma') || sicLower.includes('biological') || sicLower.includes('medical') || sicLower.includes('surgical') || sicLower.includes('health')) sector = 'Healthcare';
            else if (sicLower.includes('bank') || sicLower.includes('insurance') || sicLower.includes('investment') || sicLower.includes('finance') || sicLower.includes('security broker')) sector = 'Finance';
            else if (sicLower.includes('petroleum') || sicLower.includes('oil') || sicLower.includes('gas') || sicLower.includes('electric service') || sicLower.includes('energy')) sector = 'Energy';
            else if (sicLower.includes('retail') || sicLower.includes('food') || sicLower.includes('beverage') || sicLower.includes('apparel') || sicLower.includes('restaurant')) sector = 'Consumer';
            else if (sicLower.includes('aircraft') || sicLower.includes('motor vehicle') || sicLower.includes('machinery') || sicLower.includes('trucking') || sicLower.includes('railroad')) sector = 'Industrial';
            else if (sicLower.includes('mining') || sicLower.includes('chemical') || sicLower.includes('steel') || sicLower.includes('metal') || sicLower.includes('paper')) sector = 'Materials';
            else if (sicLower.includes('real estate')) sector = 'Real Estate';
            else if (sicLower.includes('telephone') || sicLower.includes('broadcasting') || sicLower.includes('cable') || sicLower.includes('advertising') || sicLower.includes('motion picture')) sector = 'Communications';
            else if (sicLower.includes('utility') || sicLower.includes('water supply') || sicLower.includes('sanitary')) sector = 'Utilities';
            else if (sic !== 'Unknown') sector = 'Other';
            
            sectors[position.symbol] = { sector, sicDescription: sic };
          } catch (e) {
            sectors[position.symbol] = { sector: 'Unknown', sicDescription: '' };
          }
        })
      );
      
      setSectorData(sectors);
      setLoadingSectors(false);
    };
    
    fetchSectors();
  }, [positions, polygonKey]);

  // --- Calculations ---
  const totalValue = positions.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const totalGain = positions.reduce((sum, p) => sum + (p.gain ?? 0), 0);
  const totalCost = positions.reduce((sum, p) => sum + (p.costBasis ?? 0), 0);
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const winners = positions.filter(p => (p.gain ?? 0) >= 0);
  const losers = positions.filter(p => (p.gain ?? 0) < 0);
  const winRate = positions.length > 0 ? (winners.length / positions.length) * 100 : 0;
  
const validPositions = positions.filter(p => p.costBasis > 0 && isFinite(p.gainPercent));
const sortedByGain = [...validPositions].sort((a, b) => (b.gainPercent ?? 0) - (a.gainPercent ?? 0));
const bestStock = sortedByGain[0];
const worstStock = sortedByGain[sortedByGain.length - 1];
  
  const avgGainPercent = positions.length > 0 
    ? positions.reduce((sum, p) => sum + (p.gainPercent ?? 0), 0) / positions.length 
    : 0;

  const largestPosition = [...positions].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];

  // --- Chart Data ---
  const CHART_COLORS = [
    '#00ff4e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', 
    '#ec4899', '#10b981', '#06b6d4', '#f97316', '#6366f1', 
    '#84cc16', '#14b8a6'
  ];

  // Allocation data
  const allocationData = (() => {
    const sorted = [...positions].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const top = sorted.slice(0, 8).map(p => ({
      name: p.symbol,
      value: p.value ?? 0,
      percent: totalValue > 0 ? ((p.value ?? 0) / totalValue * 100) : 0,
      gain: p.gainPercent ?? 0
    }));
    
    if (sorted.length > 8) {
      const others = sorted.slice(8);
      const otherValue = others.reduce((sum, p) => sum + (p.value ?? 0), 0);
      top.push({
        name: `+${others.length} more`,
        value: otherValue,
        percent: totalValue > 0 ? (otherValue / totalValue * 100) : 0,
        gain: 0
      });
    }
    return top;
  })();

  // Sector data
  const sectorChartData = (() => {
    if (loadingSectors) return [];
    const sectorValues = {};
    positions.forEach(p => {
      const sector = sectorData[p.symbol]?.sector || 'Unknown';
      sectorValues[sector] = (sectorValues[sector] || 0) + (p.value ?? 0);
    });
    return Object.entries(sectorValues)
      .map(([name, value]) => ({ 
        name, 
        value, 
        percent: totalValue > 0 ? (value / totalValue * 100) : 0 
      }))
      .sort((a, b) => b.value - a.value);
  })();

  // Performers data
  const performersData = sortedByGain
    .filter(p => p.symbol && p.symbol !== 'N/A')
    .map(p => ({
      symbol: p.symbol,
      gain: parseFloat((p.gainPercent ?? 0).toFixed(2)),
      value: p.value ?? 0,
      fill: (p.gainPercent ?? 0) >= 0 ? '#00ff4e' : '#FF4B2B'
    }));

  // Format currency
  const fmtCurrency = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val.toFixed(2)}`;
  };

  // Hover handlers for pie
  const onPieEnter = (_, index) => setActiveIndex(index);
  const onPieLeave = () => {
  // Small delay so tap doesn't immediately clear
  setTimeout(() => setActiveIndex(null), 2000);
};

  // Custom active shape renderer for hover effect
  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <defs>
          <filter id={`glow-${props.index}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 3}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          opacity={1}
          filter={`url(#glow-${props.index})`}
        />
      </g>
    );
  };

  // Pie tooltip
  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-black/95 backdrop-blur-sm border border-zinc-700 rounded-xl px-4 py-3 shadow-2xl">
          <p className="text-sm font-black text-white mb-1">{data.name}</p>
          <p className="text-xs text-zinc-300 tabular-nums">
            {fmtCurrency(data.value)}
          </p>
          <p className="text-xs font-black tabular-nums mt-0.5" style={{ color: '#00ff4e' }}>
            {data.percent.toFixed(1)}% of portfolio
          </p>
          {data.gain !== undefined && data.gain !== 0 && (
            <p className="text-[10px] font-bold tabular-nums mt-0.5" style={{ color: data.gain >= 0 ? '#00ff4e' : '#FF4B2B' }}>
              {data.gain >= 0 ? '+' : ''}{data.gain.toFixed(1)}% return
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Bar tooltip
  const BarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-black/95 backdrop-blur-sm border border-zinc-700 rounded-xl px-4 py-3 shadow-2xl">
          <p className="text-sm font-black text-white">{data.symbol}</p>
          <p className="text-xs font-bold tabular-nums" style={{ color: data.gain >= 0 ? '#00ff4e' : '#FF4B2B' }}>
            {data.gain >= 0 ? '+' : ''}{data.gain}%
          </p>
          <p className="text-[10px] text-zinc-400 tabular-nums">{fmtCurrency(data.value)}</p>
        </div>
      );
    }
    return null;
  };

  // Get the current pie data based on active chart
  const currentPieData = activeChart === 'allocation' ? allocationData : sectorChartData;
  const currentHovered = activeIndex !== null && currentPieData[activeIndex] ? currentPieData[activeIndex] : null;

  if (positions.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Win Rate */}
        <div className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-5 relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="absolute top-0 left-0 h-1 transition-all duration-500" style={{ 
            width: `${winRate}%`, 
            backgroundColor: winRate >= 50 ? '#00ff4e' : '#FF4B2B',
            boxShadow: `0 0 15px ${winRate >= 50 ? 'rgba(0,255,78,0.4)' : 'rgba(255,75,43,0.4)'}`
          }} />
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider mb-2">Win Rate</p>
          <p className="text-3xl md:text-4xl font-black tabular-nums leading-none mb-1" style={{ color: winRate >= 50 ? '#00ff4e' : '#FF4B2B' }}>
            {winRate.toFixed(0)}%
          </p>
          <p className="text-[10px] text-zinc-600 font-bold">
            <span className="text-[#00ff4e]">{winners.length}W</span>
            {' / '}
            <span className="text-red-500">{losers.length}L</span>
          </p>
        </div>

        {/* Total Return */}
        <div className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-5 relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="absolute top-0 left-0 h-1 w-full" style={{ 
            backgroundColor: totalGainPercent >= 0 ? '#00ff4e' : '#FF4B2B',
            opacity: 0.3
          }} />
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider mb-2">Total Return</p>
          <p className="text-3xl md:text-4xl font-black tabular-nums leading-none mb-1" style={{ color: totalGainPercent >= 0 ? '#00ff4e' : '#FF4B2B' }}>
            {totalGainPercent >= 0 ? '+' : ''}{totalGainPercent.toFixed(1)}%
          </p>
          <p className="text-[10px] text-zinc-600 font-bold tabular-nums">
            {totalGain >= 0 ? '+' : '-'}${Math.abs(totalGain).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Best */}
        <div className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-5 relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="absolute top-0 left-0 h-1 w-full bg-[#00ff4e] opacity-30" />
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider mb-2">Best Position</p>
          {bestStock ? (
            <>
              <p className="text-3xl md:text-4xl font-black text-[#00ff4e] tabular-nums leading-none mb-1">
                +{(bestStock.gainPercent ?? 0).toFixed(1)}%
              </p>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">{bestStock.symbol}</p>
            </>
          ) : (
            <p className="text-2xl font-black text-zinc-700">—</p>
          )}
        </div>

        {/* Worst */}
        <div className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-5 relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="absolute top-0 left-0 h-1 w-full bg-red-500 opacity-30" />
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider mb-2">Worst Position</p>
          {worstStock ? (
            <>
              <p className="text-3xl md:text-4xl font-black tabular-nums leading-none mb-1" style={{ color: (worstStock.gainPercent ?? 0) >= 0 ? '#00ff4e' : '#FF4B2B' }}>
                {(worstStock.gainPercent ?? 0) >= 0 ? '+' : ''}{(worstStock.gainPercent ?? 0).toFixed(1)}%
              </p>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wider">{worstStock.symbol}</p>
            </>
          ) : (
            <p className="text-2xl font-black text-zinc-700">—</p>
          )}
        </div>
      </div>

      {/* Secondary Stats Bar */}
      <div className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#00ff4e]/10 flex items-center justify-center flex-shrink-0">
              <Wallet size={18} className="text-[#00ff4e]" />
            </div>
            <div>
              <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">Portfolio</p>
              <p className="text-base md:text-lg font-black text-white tabular-nums">{fmtCurrency(totalValue)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <Target size={18} className="text-zinc-400" />
            </div>
            <div>
              <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">Cost Basis</p>
              <p className="text-base md:text-lg font-black text-white tabular-nums">{fmtCurrency(totalCost)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <BarChart3 size={18} className="text-zinc-400" />
            </div>
            <div>
              <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">Avg Return</p>
              <p className="text-base md:text-lg font-black tabular-nums" style={{ color: avgGainPercent >= 0 ? '#00ff4e' : '#FF4B2B' }}>
                {avgGainPercent >= 0 ? '+' : ''}{avgGainPercent.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={18} className="text-zinc-400" />
            </div>
            <div>
              <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">Largest</p>
              <p className="text-base md:text-lg font-black text-white">{largestPosition?.symbol || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="bg-[#050505] border-2 border-zinc-900 rounded-xl p-4 md:p-6 overflow-hidden">
        {/* Chart Tabs */}
        <div className="flex gap-1.5 mb-6">
          {[
            { id: 'allocation', label: 'Allocation', icon: '◉' },
            { id: 'sector', label: 'Sectors', icon: '◎' },
            { id: 'performers', label: 'Performance', icon: '◆' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveChart(tab.id); setActiveIndex(null); }}
              className={`flex-1 py-2.5 md:py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all ${
                activeChart === tab.id
                  ? 'bg-[#00ff4e] text-black shadow-[0_0_20px_rgba(0,255,78,0.3)]'
                  : 'bg-zinc-900/80 text-zinc-500 hover:text-white hover:bg-zinc-800 border border-zinc-800'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ============ ALLOCATION PIE ============ */}
        {activeChart === 'allocation' && (
          <div>
            <div className="relative h-[320px] md:h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {CHART_COLORS.map((color, i) => (
                      <linearGradient key={`grad-alloc-${i}`} id={`grad-alloc-${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={activeIndex !== null ? 120 : 120}
                    paddingAngle={1.5}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationBegin={0}
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                  >
                    {allocationData.map((entry, index) => (
                      <Cell 
                        key={entry.name} 
                        fill={`url(#grad-alloc-${index % CHART_COLORS.length})`}
                        opacity={activeIndex === null || activeIndex === index ? 1 : 0.35}
                        style={{
                          filter: activeIndex === index ? `drop-shadow(0 0 12px ${CHART_COLORS[index % CHART_COLORS.length]}80)` : 'none',
                          transform: activeIndex === index ? 'scale(1.04)' : 'scale(1)',
                          transformOrigin: '50% 50%',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  {currentHovered && activeChart === 'allocation' ? (
                    <>
                      <p className="text-xl md:text-2xl font-black text-white leading-none mb-0.5">{currentHovered.name}</p>
                      <p className="text-sm md:text-base font-black tabular-nums" style={{ color: '#00ff4e' }}>
                        {currentHovered.percent.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-zinc-500 tabular-nums">{fmtCurrency(currentHovered.value)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider mb-1">Total Value</p>
                      <p className="text-xl md:text-2xl font-black text-white leading-none tabular-nums">
                        {fmtCurrency(totalValue)}
                      </p>
                      <p className="text-[10px] font-bold tabular-nums mt-0.5" style={{ color: totalGainPercent >= 0 ? '#00ff4e' : '#FF4B2B' }}>
                        {totalGainPercent >= 0 ? '↑' : '↓'} {Math.abs(totalGainPercent).toFixed(1)}%
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Legend - Visual bars */}
            <div className="mt-6 space-y-2">
              {allocationData.map((entry, i) => (
                <div 
                  key={entry.name} 
                  className="group flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-900/50 transition-all cursor-default"
                 onMouseEnter={() => setActiveIndex(i)}
onMouseLeave={() => setActiveIndex(null)}
onClick={() => setActiveIndex(prev => prev === i ? null : i)}
                >
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0 transition-all group-hover:scale-125"
                    style={{ 
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      boxShadow: activeIndex === i ? `0 0 10px ${CHART_COLORS[i % CHART_COLORS.length]}` : 'none'
                    }} 
                  />
                  <span className="text-xs font-black text-zinc-300 w-16 flex-shrink-0">{entry.name}</span>
                  <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${entry.percent}%`, 
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        opacity: activeIndex === null || activeIndex === i ? 1 : 0.3,
                        boxShadow: activeIndex === i ? `0 0 8px ${CHART_COLORS[i % CHART_COLORS.length]}60` : 'none'
                      }} 
                    />
                  </div>
                  <span className="text-[10px] font-black text-zinc-400 tabular-nums w-12 text-right">{entry.percent.toFixed(1)}%</span>
                  <span className="text-[10px] text-zinc-600 tabular-nums w-16 text-right hidden md:block">{fmtCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ SECTOR PIE ============ */}
        {activeChart === 'sector' && (
          <div>
            {loadingSectors ? (
              <div className="h-[320px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-2 border-[#00ff4e]/30 border-t-[#00ff4e] rounded-full animate-spin" />
                  <span className="text-xs text-zinc-600 font-bold uppercase tracking-wider">Analyzing sectors...</span>
                </div>
              </div>
            ) : (
              <>
                <div className="relative h-[320px] md:h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {CHART_COLORS.map((color, i) => (
                          <linearGradient key={`grad-sec-${i}`} id={`grad-sec-${i}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={sectorChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={75}
                        outerRadius={120}
                        paddingAngle={1.5}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={true}
                        animationDuration={1000}
                        onMouseEnter={onPieEnter}
                        onMouseLeave={onPieLeave}
                      >
                        {sectorChartData.map((entry, index) => (
                          <Cell 
                            key={entry.name} 
                            fill={`url(#grad-sec-${index % CHART_COLORS.length})`}
                            opacity={activeIndex === null || activeIndex === index ? 1 : 0.35}
                            style={{
                              filter: activeIndex === index ? `drop-shadow(0 0 12px ${CHART_COLORS[index % CHART_COLORS.length]}80)` : 'none',
                              transform: activeIndex === index ? 'scale(1.04)' : 'scale(1)',
                              transformOrigin: '50% 50%',
                              transition: 'all 0.3s ease',
                              cursor: 'pointer'
                            }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Label */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      {currentHovered && activeChart === 'sector' ? (
                        <>
                          <p className="text-lg md:text-xl font-black text-white leading-none mb-0.5">{currentHovered.name}</p>
                          <p className="text-sm md:text-base font-black tabular-nums" style={{ color: '#00ff4e' }}>
                            {currentHovered.percent.toFixed(1)}%
                          </p>
                          <p className="text-[10px] text-zinc-500 tabular-nums">{fmtCurrency(currentHovered.value)}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-3xl md:text-4xl font-black text-white leading-none">{sectorChartData.length}</p>
                          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider mt-1">Sectors</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-6 space-y-2">
                  {sectorChartData.map((entry, i) => (
                    <div 
                      key={entry.name} 
                      className="group flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-900/50 transition-all cursor-default"
                      onMouseEnter={() => setActiveIndex(i)}
onMouseLeave={() => setActiveIndex(null)}
onClick={() => setActiveIndex(prev => prev === i ? null : i)}
                    >
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0 transition-all group-hover:scale-125"
                        style={{ 
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          boxShadow: activeIndex === i ? `0 0 10px ${CHART_COLORS[i % CHART_COLORS.length]}` : 'none'
                        }} 
                      />
                      <span className="text-xs font-black text-zinc-300 w-24 flex-shrink-0">{entry.name}</span>
                      <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${entry.percent}%`, 
                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                            opacity: activeIndex === null || activeIndex === i ? 1 : 0.3,
                            boxShadow: activeIndex === i ? `0 0 8px ${CHART_COLORS[i % CHART_COLORS.length]}60` : 'none'
                          }} 
                        />
                      </div>
                      <span className="text-[10px] font-black text-zinc-400 tabular-nums w-12 text-right">{entry.percent.toFixed(1)}%</span>
                      <span className="text-[10px] text-zinc-600 tabular-nums w-16 text-right hidden md:block">{fmtCurrency(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ============ PERFORMANCE BAR ============ */}
        {activeChart === 'performers' && (
          <div>
            <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">
              Return by Position
            </h4>
            <div style={{ height: Math.max(performersData.length * 40, 200) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={performersData}
                  layout="vertical"
                  margin={{ top: 5, right: 40, left: 55, bottom: 5 }}
                  barGap={2}
                >
                  <defs>
                    <linearGradient id="bar-green" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#00ff4e" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#00ff4e" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="bar-red" x1="1" y1="0" x2="0" y2="0">
                      <stop offset="0%" stopColor="#FF4B2B" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#FF4B2B" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    type="number" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="symbol" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace' }}
                    width={50}
                  />
                
                  <Bar 
                    dataKey="gain" 
                    radius={[0, 6, 6, 0]}
                    isAnimationActive={true}
                    animationDuration={1000}
                    barSize={20}
                  >
                    {performersData.map((entry, index) => (
                      <Cell 
                        key={index} 
                        fill={entry.gain >= 0 ? 'url(#bar-green)' : 'url(#bar-red)'}
                        style={{ 
                          filter: `drop-shadow(0 0 4px ${entry.gain >= 0 ? 'rgba(0,255,78,0.3)' : 'rgba(255,75,43,0.3)'})`,
                          cursor: 'pointer'
                        }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// POSITION CARD COMPONENT WITH CHART TOGGLE
const PositionCard = React.memo(function PositionCard({
  position,
  index,
  livePrices,
  isPositionAdded,
  isHoveringThisPosition,
  setHoveringPositionSymbol,
  user,
  watchlists,
  flattenedWatchlist,
  showAddToListMenu,
  setShowAddToListMenu,
  addStockToList,
  removeStockFromList,
  setManualSearch,
  setActiveTab,
  runScanner
}) {
  const [showChart, setShowChart] = useState(false);

  // Inside PositionCard or wherever you render position price
const live = livePrices?.[position.symbol];
const displayPrice = live ? live.price : position.currentPrice;
const flashClass = live?.direction === 'up' ? 'price-flash-up' : live?.direction === 'down' ? 'price-flash-down' : '';
  
  return (
    <motion.div
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

      {/* Chart Toggle Section */}
      <div className="mt-6 pt-4 border-t-2 border-zinc-900">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setShowChart(!showChart);
          }}
          className="group flex items-center gap-2 md:gap-3 transition-all"
        >
          <span className={`h-1 w-1 md:h-1.5 md:w-1.5 rounded-full ${showChart ? 'bg-[#00ff4e] shadow-[0_0_8px_#00ff4e]' : 'bg-zinc-700'}`} />
          <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.25em] md:tracking-[0.3em] ${showChart ? 'text-[#00ff4e]' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
            {showChart ? "Hide Chart" : "Show Chart"}
          </span>
          <motion.span 
            animate={{ rotate: showChart ? 180 : 0 }} 
            className={`text-[8px] md:text-[10px] ${showChart ? 'text-[#00ff4e]' : 'text-zinc-500'}`}
          >
            ▼
          </motion.span>
        </button>

        <AnimatePresence>
          {showChart && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mt-4"
            >
              <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-3 md:p-4">
                <div className="flex justify-between items-center mb-3 md:mb-4">
                  <h4 className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    {position.symbol} - Intraday
                  </h4>
                  <span className="text-[8px] md:text-[10px] font-bold text-[#00ff4e]">LIVE</span>
                </div>
                <MiniChart symbol={position.symbol} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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
