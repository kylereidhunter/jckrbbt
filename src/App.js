import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from 'react-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, getDocs, collection, query, where } from 'firebase/firestore';
import AuthModal from './AuthModal';
import ProfileSettings from './ProfileSettings';
import AddToListModal from './components/AddToListModal';
import PriceAlertModal from './components/PriceAlertModal';
import Tooltip from './tooltip';
import CountUp from './CountUp';
import SkeletonCard from './SkeletonCard';
import WatchlistModal from './WatchlistModal';
import { createWatchlist, getUserWatchlists, getPublicWatchlists, addStockToWatchlist, removeStockFromWatchlist, updateWatchlist, deleteWatchlist } from './watchlistService';
import { followUser, unfollowUser, isFollowing, getFollowers, getFollowing, searchUsers } from './followService';
import { Activity, Users, Trash2, Plus, MessageCircle, Search, Target, TrendingUp, BarChart3, Lightbulb, AlertTriangle, Clock, Link2, Unlink, ChevronDown, Building2, Wallet, RefreshCw, Zap, Sprout, LayoutDashboard, Flame, List, Briefcase, Newspaper, Send, Heart, History, Pencil, FileText, X, Share2, Share, Download, Copy, Check, ArrowLeft, ArrowUp, ArrowDown, ArrowUpRight, Globe, Bell, Pin, Cpu, Edit, TrendingDown, DollarSign, ChevronUp, LogIn, ChevronRight } from 'lucide-react';
import PlaidLink from './PlaidLink';
import StockChatModal from './StockChatModal';
import UserProfileModal from './UserProfileModal';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, PieChart, Pie, Cell, Sector } from 'recharts';
import { logActivity, getActivityFeed, getGlobalFeed } from './activityService';

// Extracted modules
import {
  FINNHUB_KEY, GEN_AI_KEY, ALPHA_VANTAGE_KEY, TWELVE_DATA_KEY, POLYGON_KEY,
  NEWS_SOURCES, REPUTABLE_SOURCES, sourceString, cleanCompanyName,
  extract, clean, formatText, calculateHV, calculateSignalStrength,
  BROKERAGE_LOGOS, BROKERAGE_TRADE_URLS, getTradeUrl,
  BROKERAGE_ICONS, getBrokerageLogo, getBrokerageIcon
} from './config/constants';
import usePolygonWebSocket from './hooks/usePolygonWebSocket';
import MiniChart from './components/MiniChart';
import CurrentTime from './components/CurrentTime';
import CustomDropdown from './components/CustomDropdown';
import MetricCard from './components/MetricCard';
import PortfolioPerformanceChart from './components/PortfolioPerformanceChart';
import PortfolioAnalytics from './components/PortfolioAnalytics';
import PositionCard from './components/PositionCard';
import NewsCard from './components/NewsCard';
import StockChart from './components/StockChart';
import TradeButton from './components/TradeButton';


console.log('FINNHUB_KEY:', process.env.REACT_APP_FINNHUB_KEY);
console.log('GEN_AI_KEY:', process.env.REACT_APP_GEN_AI_KEY);

// --- CONFIGURATION ---
const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const isMobile = () => window.innerWidth < 768;


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
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [watchlists, setWatchlists] = useState([]);
  const [publicWatchlists, setPublicWatchlists] = useState([]);
  const [selectedWatchlist, setSelectedWatchlist] = useState(null);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [editingWatchlist, setEditingWatchlist] = useState(null);
  const [showListsCreate, setShowListsCreate] = useState(false);
  const [expandedListId, setExpandedListId] = useState(null);
  const [listsNewName, setListsNewName] = useState('');
  const [listsNewDesc, setListsNewDesc] = useState('');
  const [listsNewPublic, setListsNewPublic] = useState(false);
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
const [selectedStock, setSelectedStock] = useState(null);
const [addToListStock, setAddToListStock] = useState(null);
const [alertStock, setAlertStock] = useState(null);
const [showWelcome, setShowWelcome] = useState(() => {

  return !localStorage.getItem('jckrbbt_onboarded');
});
const [tourStep, setTourStep] = useState(0); // 0 = no tour, 1-4 = active steps
const [copiedReddit, setCopiedReddit] = useState(false);
const [copiedTwitter, setCopiedTwitter] = useState(false);
const [tourRect, setTourRect] = useState(null);
const tourSteps = useRef([
  { target: 'scan-market', title: 'Scan the Market', desc: 'Hit this to scan the entire market for unusual stock activity — data anomalies, volume spikes, and moves the news hasn\'t caught yet.', position: 'top' },
  { target: 'lists-tab', title: 'Save to Watchlists', desc: 'Save interesting stocks to watchlists to track them over time. Share lists publicly for others to follow.', position: 'top' },
  { target: 'portfolio-tab', title: 'Your Portfolio', desc: 'Connect your brokerage to see all your positions, P&L, and cost basis in one place.', position: 'top' },
]);

useEffect(() => {
  if (tourStep === 0) { setTourRect(null); return; }
  const step = tourSteps.current[tourStep - 1];
  if (!step) return;
  
  // Clear previous rect immediately to avoid stale positions
  setTourRect(null);
  
  // Small delay to ensure DOM is ready
  const timer = setTimeout(() => {
    const els = document.querySelectorAll(`[data-tour="${step.target}"]`);
    // Find the first visible element (skip display:none which has 0 dimensions)
    const el = Array.from(els).find(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (el) {
      // Check if element is fixed/in viewport already
      const r = el.getBoundingClientRect();
      const isInViewport = r.top >= 0 && r.bottom <= window.innerHeight;
      
      if (!isInViewport) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      // Wait for any scroll to finish then capture rect
      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setTourRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
        }
      }, isInViewport ? 50 : 500);
    }
  }, 150);
  return () => clearTimeout(timer);
}, [tourStep]);
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
const [scanAccuracy, setScanAccuracy] = useState({ stats: null, byTicker: {} });
const [accountsExpanded, setAccountsExpanded] = useState(false);
const [watchlistPrices, setWatchlistPrices] = useState({});
const [positionSortBy, setPositionSortBy] = useState('value-high');
const [editingCostBasis, setEditingCostBasis] = useState(null);
const [costBasisInput, setCostBasisInput] = useState('');
const [costBasisOverrides, setCostBasisOverrides] = useState({});



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

const sortedPositions = useMemo(() => {
  const sorted = [...positions];
  switch (positionSortBy) {
    case 'gain-high': return sorted.sort((a, b) => (b.gainPercent ?? 0) - (a.gainPercent ?? 0));
    case 'gain-low': return sorted.sort((a, b) => (a.gainPercent ?? 0) - (b.gainPercent ?? 0));
    case 'value-high': return sorted.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    case 'value-low': return sorted.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    case 'price-high': return sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    case 'price-low': return sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    case 'alpha': return sorted.sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));
    default: return sorted;
  }
}, [positions, positionSortBy]);

// Computed: all positions across all brokerages (for portfolio summary)
const allPositions = useMemo(() => {
  return Object.values(brokeragePositions).flat();
}, [brokeragePositions]);

// Check if any brokerage is connected
const brokerageConnected = connectedBrokerages.length > 0;

const flattenedWatchlist = useMemo(() => {
  return watchlists.flatMap(l => l.stocks);
}, [watchlists]);

// Fetch Polygon snapshot prices for watchlist stocks (WS only covers scanned stocks)
useEffect(() => {
  if (flattenedWatchlist.length === 0) return;
  const tickers = [...new Set(flattenedWatchlist.map(s => s.symbol).filter(Boolean))];
  if (tickers.length === 0) return;
  
  const fetchWatchlistPrices = async () => {
    try {
      const res = await fetch(
        `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(',')}&apiKey=${POLYGON_KEY}`
      );
      const data = await res.json();
      const prices = {};
      (data.tickers || []).forEach(t => {
        prices[t.ticker] = {
          price: t.day?.c || t.prevDay?.c || 0,
          prevClose: t.prevDay?.c || 0
        };
      });
      setWatchlistPrices(prices);
    } catch (e) {
      console.error('Watchlist price fetch failed:', e);
    }
  };
  
  fetchWatchlistPrices();
  // Refresh every 5 minutes
  const interval = setInterval(fetchWatchlistPrices, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, [flattenedWatchlist.length]);

// Collect unique tickers for websocket based on active tab
const wsTickers = useMemo(() => {
  const tickerSet = new Set();
  
  // Always add the stock being analyzed (if any)
  if (manualSearch) tickerSet.add(manualSearch);
  
  if (activeTab === 'DASHBOARD') {
    // Scan results
    if (stocks) stocks.forEach(s => { if (s.symbol) tickerSet.add(s.symbol); });
  } else if (activeTab === 'MY LISTS') {
    // Only the expanded watchlist's stocks
    if (selectedWatchlist) {
      const ownList = watchlists.find(l => l.id === selectedWatchlist.id);
      if (ownList) ownList.stocks.forEach(s => { if (s.symbol) tickerSet.add(s.symbol); });
      const followedList = followedListsData.find(l => l.id === selectedWatchlist.id);
      if (followedList) followedList.stocks?.forEach(s => { if (s.symbol) tickerSet.add(s.symbol); });
    }
  } else if (activeTab === 'MY POSITIONS') {
    // Portfolio positions
    positions.forEach(p => { if (p.symbol && p.symbol !== 'N/A' && !p.symbol.includes(':')) tickerSet.add(p.symbol); });
  }
  // DISCOVER, TRENDING, FEED etc. don't need live WS prices
  
  return [...tickerSet];
}, [activeTab, stocks, selectedWatchlist, watchlists, followedListsData, positions, manualSearch]);

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
      addedPrice: stock.price || null,
      change: stock.change || null,
      addedAt: new Date().toISOString(),
    };
    
    await addStockToWatchlist(listId, cleanStock);
    
    // Track this stock being watched in Firestore
    try {
      const { doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp } = await import('firebase/firestore');
      const watchRef = doc(db, 'trending', stock.symbol);
      const watchDoc = await getDoc(watchRef);
      
      const now = Timestamp.now();
      
      if (watchDoc.exists()) {
        await updateDoc(watchRef, {
          adds: arrayUnion(now),
          totalCount: (watchDoc.data().totalCount || 0) + 1,
          lastAdded: now
        });
      } else {
        await setDoc(watchRef, {
          symbol: stock.symbol,
          name: stock.name || '',
          adds: [now],
          totalCount: 1,
          lastAdded: now,
          createdAt: now
        });
      }
    } catch (trendingError) {
      console.log('Trending update failed (non-critical):', trendingError.message);
    }

    // Log activity for feed
    const targetList = watchlists.find(w => w.id === listId);
if (targetList?.isPublic) {
    logActivity(db, {
      userId: user.uid,
      userName: userProfile?.username || user.displayName,
      userAvatar: userProfile?.profilePicUrl || user.photoURL,
      type: 'add_stock',
      targetSymbol: stock.symbol,
      targetListId: listId,
      targetListName: watchlists.find(w => w.id === listId)?.name || 'a list',
    });
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
  if (!list || !Array.isArray(list) || list.length === 0) {
    return [];
  }
  
  // Batch fetch using snapshot endpoint - 1 API call for all tickers
  try {
    const tickers = list.map(s => s.symbol).join(',');
    const res = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers}&apiKey=${POLYGON_KEY}`);
    const data = await res.json();
    
    const priceMap = {};
    data.tickers?.forEach(t => {
      const currentPrice = t.day?.c || t.prevDay?.c;
      const prevClose = t.prevDay?.c;
      const change = t.todaysChangePerc || (prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : 0);
      priceMap[t.ticker] = { price: currentPrice, prevClose, change };
    });
    
    return list.map(stock => {
      const live = priceMap[stock.symbol];
      if (!live) return stock;
      // Capture old price BEFORE overwriting for fallback
      const oldPrice = stock.price;
      return {
        ...stock,
        price: live.price?.toFixed(2) || stock.price,
        prevClose: live.prevClose || null,
        change: live.change?.toFixed(2) || stock.change,
        isPositive: (live.change || 0) >= 0,
        // Preserve original add data for "since added" tracking
        addedPrice: stock.addedPrice || stock.price,
        addedAt: stock.addedAt || null,
      };
    });
  } catch (e) {
    return list;
  }
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
    const { collection, getDocs } = await import('firebase/firestore');
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
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      
      // Support both new unified 'adds' array and legacy separate arrays
      let allAdds = data.adds || [];
      
      // Also check legacy fields
      if (allAdds.length === 0) {
        if (interval === 'daily' && data.dailyAdds) allAdds = data.dailyAdds;
        else if (interval === 'weekly' && data.weeklyAdds) allAdds = data.weeklyAdds;
        else if (interval === 'monthly' && data.monthlyAdds) allAdds = data.monthlyAdds;
      }
      
      // Filter adds within the time window
      const recentAdds = allAdds.filter(add => {
        const addDate = add.toDate ? add.toDate() : new Date(add);
        return addDate >= cutoffDate;
      });
      
      if (recentAdds.length > 0) {
        trending.push({
          symbol: data.symbol,
          name: data.name,
          watchCount: recentAdds.length,
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
    
    const scanBatchId = Date.now().toString(36);
    const newEntries = scannedStocks.map(s => ({
      symbol: s.symbol,
      name: s.name,
      price: s.price,
      entryPrice: parseFloat(s.price) || 0,
      change: s.change,
      catalystType: s.catalystType || 'manual',
      sentiment: s.sentiment || 'NEUTRAL',
      patterns: (s.patterns || []).slice(0, 5),
      scanBatchId,
      timestamp: new Date().toISOString()
    }));
    
    // Keep last 50 scans
    const merged = [...newEntries, ...prev].slice(0, 100);
    await setDoc(histRef, { scans: merged });
    setScanHistory(merged);
  } catch (e) {
    console.error('Failed to log scan history:', e);
  }
};

// Get tickers scanned in last 24 hours
const getRecentTickers = () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const counts = new Map();
  scanHistory
    .filter(s => new Date(s.timestamp) > cutoff)
    .forEach(s => counts.set(s.symbol, (counts.get(s.symbol) || 0) + 1));
  return counts;
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

// ========== ACCURACY TRACKING ==========
const checkScanAccuracy = useCallback(async (history) => {
  if (!history || history.length === 0) return;
  
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const fourHours = 4 * oneHour;
  const twentyFourHours = 24 * oneHour;
  
  // Get entries from last 72h that are at least 1h old
  const candidates = history.filter(s => {
    const age = now - new Date(s.timestamp).getTime();
    return age > oneHour && age < 72 * oneHour && (s.entryPrice > 0 || parseFloat(s.price) > 0);
  });
  
  if (candidates.length === 0) {
    setScanAccuracy({ stats: null, byTicker: {} });
    return;
  }
  
  // Batch-fetch current prices (Polygon snapshot supports multiple tickers)
  const uniqueTickers = [...new Set(candidates.map(s => s.symbol))];
  const tickerPrices = {};
  
  try {
    // Fetch in batches of 20
    for (let i = 0; i < uniqueTickers.length; i += 20) {
      const batch = uniqueTickers.slice(i, i + 20);
      const res = await fetch(
        `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${batch.join(',')}&apiKey=${POLYGON_KEY}`
      );
      const data = await res.json();
      (data.tickers || []).forEach(t => {
        tickerPrices[t.ticker] = t.day?.c || t.prevDay?.c || 0;
      });
      if (i + 20 < uniqueTickers.length) await new Promise(r => setTimeout(r, 200));
    }
  } catch (e) {
    console.error('Accuracy price fetch failed:', e);
    return;
  }
  
  // Calculate per-entry results
  const byTicker = {};
  let totalChecked = 0;
  let hit2pct = 0;
  let hitDirectional = 0;
  
  candidates.forEach(entry => {
    const currentPrice = tickerPrices[entry.symbol];
    const entryPrice = entry.entryPrice || parseFloat(entry.price) || 0;
    if (!currentPrice || !entryPrice) return;
    
    const pctChange = ((currentPrice - entryPrice) / entryPrice) * 100;
    const age = now - new Date(entry.timestamp).getTime();
    const isBullish = entry.sentiment === 'BULLISH';
    const moved2pct = Math.abs(pctChange) >= 2;
    const correctDirection = isBullish ? pctChange >= 2 : pctChange <= -2;
    
    // Track best result per ticker (most recent scan entry)
    if (!byTicker[entry.symbol] || new Date(entry.timestamp) > new Date(byTicker[entry.symbol].detectedAt)) {
      byTicker[entry.symbol] = {
        entryPrice: entryPrice,
        currentPrice,
        pctChange: parseFloat(pctChange.toFixed(2)),
        detectedAt: entry.timestamp,
        sentiment: entry.sentiment,
        catalystType: entry.catalystType,
        hit: correctDirection,
        moved: moved2pct
      };
    }
    
    // Stats count only entries 4h+ old (enough time for signal to play out)
    if (age >= fourHours) {
      totalChecked++;
      if (moved2pct) hit2pct++;
      if (correctDirection) hitDirectional++;
    }
  });
  
  const stats = totalChecked > 0 ? {
    totalChecked,
    hit2pct,
    hitDirectional,
    hitRate: Math.round((hit2pct / totalChecked) * 100),
    directionalRate: Math.round((hitDirectional / totalChecked) * 100),
    lastUpdated: new Date().toISOString()
  } : null;
  
  if (stats) {
    console.log(`📊 Accuracy: ${stats.hit2pct}/${stats.totalChecked} moved 2%+ (${stats.hitRate}%), ${stats.hitDirectional} directionally correct (${stats.directionalRate}%)`);
  }
  
  setScanAccuracy({ stats, byTicker });
}, []);

// Check accuracy when scan history loads or changes
useEffect(() => {
  if (scanHistory.length > 0) {
    checkScanAccuracy(scanHistory);
  }
}, [scanHistory, checkScanAccuracy]);

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
  if (!user?.uid || !db) return;
  const loadOverrides = async () => {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'costBasisOverrides'));
    if (snap.exists()) setCostBasisOverrides(snap.data());
  };
  loadOverrides();
}, [user?.uid, db]);


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

const saveCostBasisOverride = async (symbol, value) => {
  if (!user?.uid || !db) return;
  const newOverrides = { ...costBasisOverrides, [symbol]: parseFloat(value) };
  setCostBasisOverrides(newOverrides);
  setEditingCostBasis(null);
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', user.uid, 'settings', 'costBasisOverrides'), newOverrides);
};

const handleCreateWatchlist = async ({ name, description, isPublic }) => {
  if (!user) return;
  
  try {
    await createWatchlist(user.uid, name, description, isPublic);
    
    logActivity(db, {
      userId: user.uid,
      userName: user.displayName,
      userAvatar: userProfile?.profilePicUrl || user.photoURL,
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
      const rawCost = holding.cost_basis ?? 0;
      const costBasis = costBasisOverrides[security?.ticker_symbol] ?? rawCost;
      return {
        symbol: security?.ticker_symbol || 'N/A',
        name: security?.name || 'Unknown',
        quantity: holding.quantity,
        price: holding.institution_price,
        value: holding.institution_value,
        costBasis: costBasis,
        gain: (holding.institution_value ?? 0) - costBasis,
        gainPercent: costBasis > 0 
          ? ((holding.institution_value - costBasis) / costBasis) * 100 
          : 0,
      };
    });
    
    return holdingsData;
  } catch (error) {
    console.error(`Error fetching positions for ${brokerageId}:`, error);
    return null;
  }
}, [user, costBasisOverrides]);

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


// Load followed lists from Firestore on auth
useEffect(() => {
  if (!user?.uid || !db) return;
  
  const loadFollowedLists = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setFollowedLists(userDoc.data().followedLists || []);
        setFollowing(userDoc.data().following || []);
      }
    } catch (e) {
      console.error('Failed to load followed lists:', e);
    }
  };
  
  loadFollowedLists();
}, [user, db]);

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
        category: (() => {
          const t = (article.title || '').toLowerCase();
          if (/\bearnings\b|revenue|profit|quarterly|eps\b|q[1-4]\b/i.test(t)) return 'Earnings';
          if (/\bipo\b|goes public|public offering/i.test(t)) return 'IPO';
          if (/\bmerger|acquisition|acquire|buyout|deal\b/i.test(t)) return 'M&A';
          if (/\bfda\b|approval|drug|pharma|biotech|trial/i.test(t)) return 'Biotech';
          if (/\bcrypto|bitcoin|ethereum|blockchain/i.test(t)) return 'Crypto';
          if (/\bfed\b|interest rate|inflation|cpi\b|fomc|treasury/i.test(t)) return 'Economy';
          if (/\boil\b|energy|crude|gas\b|opec/i.test(t)) return 'Energy';
          if (/\bai\b|artificial intelligence|chip|semiconductor|nvidia|tech/i.test(t)) return 'Tech';
          if (/\banalyst|upgrade|downgrade|price target|rating/i.test(t)) return 'Analyst';
          if (/\blayoff|restructur|cut.*jobs/i.test(t)) return 'Layoffs';
          if (article.tickers?.length > 0) return article.tickers.slice(0, 2).join(', ');
          return 'Markets';
        })(),
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
      // Dismiss welcome screen if still showing
      setShowWelcome(false);
      localStorage.setItem('jckrbbt_onboarded', 'true');
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
  }, 300000); // Every 5 minutes (WebSocket handles real-time price updates)

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

// ========== ENHANCED ANOMALY + OPTIONS STOCK DISCOVERY ==========
const discoverStocks = useCallback(async (sector, marketCap, priceMin, priceMax) => {
  console.log(`🔍 ANOMALY + OPTIONS DISCOVERY`);
  console.log(`💰 Price range: $${priceMin} - $${priceMax}`);
  setScanProgress(2);
  
  const movers = new Map();
  let allSnapshotTickers = []; // Save for options-first discovery
  
  // ========== DYNAMIC ETF/FUND FILTER (cached daily from Polygon) ==========
  let dynamicETFs = new Set();
  const cacheKey = 'polygon_etf_tickers';
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}');
    if (cached.date === today && cached.tickers?.length > 0) {
      dynamicETFs = new Set(cached.tickers);
      console.log(`📋 ETF filter: ${dynamicETFs.size} tickers (cached)`);
    } else {
      // Fetch all ETF, ETN, and FUND tickers from Polygon reference API
      const allNonStock = [];
      for (const type of ['ETF', 'ETN', 'FUND']) {
        let url = `https://api.polygon.io/v3/reference/tickers?type=${type}&market=stocks&active=true&limit=1000&apiKey=${POLYGON_KEY}`;
        while (url) {
          const res = await fetch(url);
          const data = await res.json();
          if (data.results) {
            allNonStock.push(...data.results.map(r => r.ticker));
          }
          url = data.next_url ? `${data.next_url}&apiKey=${POLYGON_KEY}` : null;
        }
      }
      dynamicETFs = new Set(allNonStock);
      localStorage.setItem(cacheKey, JSON.stringify({ date: today, tickers: allNonStock }));
      console.log(`📋 ETF filter: ${dynamicETFs.size} tickers (fetched fresh)`);
    }
  } catch (e) {
    console.log('ETF filter fetch failed, using static list:', e.message);
  }

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
    'SCHD', 'VYM', 'JEPI', 'JEPQ', 'QYLD', 'XYLD',
    // ETFs/funds that slip through pattern detection
    'HIGH', 'SBAR', 'SPOG', 'EPI', 'VXF', 'IYM', 'BBMC', 'EXI', 'INTL', 'OILK',
    'TDEC', 'VEM', 'JANB', 'IFLR', 'RSBT', 'MFSB', 'XC', 'SLDR', 'SJB', 'IEUR',
    'VUSV', 'PRSD', 'KCSH', 'FITBM',
    'DTH', 'NFRA', 'METV', 'ZALT', 'RFLR', 'BINC', 'IBHI', 'IGEB', 'MTBA', 'RSPT',
    'DBL', 'CGBL', 'IWMI', 'ZROZ', 'CURB', 'FBL', 'ECON', 'VRTL', 'AEXA',
    'IWC', 'ULST', 'WTV', 'ACEI', 'VNQI', 'MHD',
    // Preferred shares / depositary shares
    'NCZpA', 'ALBpA'
  ]);

  const isJunk = (ticker) => {
    if (JUNK_TICKERS.has(ticker)) return true;
    if (dynamicETFs.has(ticker)) return true;
    if (isLikelyETF(ticker)) return true;
    if (ticker.length < 2 || ticker.length > 5) return true;
    if (/\d/.test(ticker)) return true;
    // Preferred/depositary shares have lowercase letters (e.g., NCZpA, ALBpA, FITBpM)
    if (/[a-z]/.test(ticker)) return true;
    if (ticker.length === 5) {
      const lastChar = ticker.slice(-1);
      const lastTwo = ticker.slice(-2);
      if (['P', 'W', 'U', 'R', 'Z', 'Y', 'F', 'Q'].includes(lastChar)) return true;
      if (['WS', 'WT', 'UN', 'PR', 'PF', 'CL'].includes(lastTwo)) return true;
    }
    if (ticker.length === 4 && ['W', 'Y', 'F', 'Q'].includes(ticker.slice(-1))) return true;
    return false;
  };

  // ========== SECTOR ETF MAP (for correlation analysis) ==========
  const SECTOR_ETFS = {
    'XLK': 'Technology', 'XLF': 'Financials', 'XLE': 'Energy',
    'XLV': 'Healthcare', 'XLI': 'Industrials', 'XLY': 'Consumer Discretionary',
    'XLP': 'Consumer Staples', 'XLU': 'Utilities', 'XLB': 'Materials',
    'XLRE': 'Real Estate', 'XLC': 'Communication'
  };

  const sicToSector = (sic) => {
    if (!sic) return null;
    const s = sic.toLowerCase();
    if (s.includes('software') || s.includes('computer') || s.includes('semiconductor') || s.includes('electronic')) return 'XLK';
    if (s.includes('bank') || s.includes('financ') || s.includes('insurance') || s.includes('invest')) return 'XLF';
    if (s.includes('oil') || s.includes('gas') || s.includes('petrol') || s.includes('energy') || s.includes('mining')) return 'XLE';
    if (s.includes('pharma') || s.includes('biotech') || s.includes('medical') || s.includes('health') || s.includes('surgical')) return 'XLV';
    if (s.includes('aerospace') || s.includes('defense') || s.includes('manufactur') || s.includes('machinery') || s.includes('industrial')) return 'XLI';
    if (s.includes('retail') || s.includes('restaurant') || s.includes('hotel') || s.includes('auto') || s.includes('apparel')) return 'XLY';
    if (s.includes('food') || s.includes('beverage') || s.includes('tobacco') || s.includes('household')) return 'XLP';
    if (s.includes('electric') || s.includes('utilit') || s.includes('water supply')) return 'XLU';
    if (s.includes('chemical') || s.includes('steel') || s.includes('paper') || s.includes('lumber')) return 'XLB';
    if (s.includes('real estate') || s.includes('reit')) return 'XLRE';
    if (s.includes('telecom') || s.includes('broadcast') || s.includes('media') || s.includes('entertain')) return 'XLC';
    return null;
  };

  // ========== PATTERN-BASED ANOMALY SCORING ==========
  const scoreAnomaly = (patterns) => {
    let score = 0;
    if (patterns.includes('PRE_MOVE')) score += 50;  // Highest value — options activity before price move
    if (patterns.includes('INSTITUTIONAL_FOOTPRINT')) score += 45;
    if (patterns.includes('QUIET_ACCUMULATION')) score += 40;
    if (patterns.includes('VOLUME_SPIKE')) score += 35;
    if (patterns.includes('SECTOR_DIVERGENCE')) score += 35;
    if (patterns.includes('OPTIONS_UNUSUAL')) score += 50;
    if (patterns.includes('OPTIONS_IV_SPIKE')) score += 40;
    if (patterns.includes('OPTIONS_OTM_CALLS')) score += 45;
    if (patterns.includes('BREAKOUT_52W')) score += 25;
    if (patterns.includes('MOMENTUM')) score += 15;
    // Combo bonus
    const count = patterns.length;
    if (count >= 3) score += 25;
    else if (count >= 2) score += 10;
    return score;
  };

  // ========== SENTIMENT SCORING ==========
  const scoreSentiment = (change, patterns, optionsData = null) => {
    let score = 0; // positive = bullish, negative = bearish
    const c = parseFloat(change) || 0;
    
    // Price direction is the primary signal
    if (c > 2) score += 3;
    else if (c > 0.5) score += 2;
    else if (c > -0.3) score += 1; // flat-to-slightly-green
    else if (c > -2) score -= 1;
    else score -= 3; // big red day
    
    // Accumulation patterns are inherently bullish
    if (patterns.includes('QUIET_ACCUMULATION') && c >= -0.5) score += 2;
    if (patterns.includes('INSTITUTIONAL_FOOTPRINT') && c >= -0.3) score += 2;
    if (patterns.includes('BREAKOUT_52W')) score += 3;
    
    // Momentum follows direction
    if (patterns.includes('MOMENTUM')) score += (c >= 0 ? 2 : -2);
    
    // Volume spike on red = bearish, on green = bullish
    if (patterns.includes('VOLUME_SPIKE')) score += (c >= 0 ? 1 : -1);
    
    // Options call activity = bullish lean
    if (patterns.includes('OPTIONS_UNUSUAL')) score += 2;
    if (patterns.includes('OPTIONS_OTM_CALLS')) score += 2;
    if (optionsData?.callVolume > 0) score += 1;
    
    // Pre-move options positioning on flat stock = bullish (someone is betting on upside)
    if (patterns.includes('PRE_MOVE')) score += 2;
    
    if (score >= 3) return 'BULLISH';
    if (score <= -2) return 'BEARISH';
    return 'NEUTRAL';
  };

  // ========== STEP 1: MARKET SNAPSHOT + SECTOR ETFs ==========
  setScanStatus('SCANNING MARKET DATA...');
  setScanProgress(5);
  
  let sectorPerf = {};
  let spyChange = 0;
  
  // Normalize volume for time of day — today's volume is partial during market hours
  const now = new Date();
  const etHour = now.getUTCHours() - 5; // rough ET offset
  const etMinute = now.getUTCMinutes();
  const marketOpenMin = 9 * 60 + 30; // 9:30 AM ET
  const marketCloseMin = 16 * 60; // 4:00 PM ET
  const currentMin = etHour * 60 + etMinute;
  const totalMarketMinutes = marketCloseMin - marketOpenMin; // 390 min
  const elapsedMinutes = Math.max(1, Math.min(totalMarketMinutes, currentMin - marketOpenMin));
  const dayFraction = elapsedMinutes / totalMarketMinutes; // 0.0 to 1.0
  const isMarketHours = currentMin >= marketOpenMin && currentMin <= marketCloseMin;
  const volFloor = isMarketHours ? Math.max(25000, Math.round(100000 * dayFraction)) : 100000;
  
  console.log(`⏰ Market time: ${etHour}:${String(etMinute).padStart(2, '0')} ET, ${isMarketHours ? `${(dayFraction * 100).toFixed(0)}% of day elapsed, volFloor: ${volFloor}` : 'after hours (no normalization)'}`);

  try {
    const [snapshotRes, sectorRes] = await Promise.all([
      fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON_KEY}`),
      fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${['SPY', ...Object.keys(SECTOR_ETFS)].join(',')}&apiKey=${POLYGON_KEY}`)
    ]);
    
    const [snapshotData, sectorData] = await Promise.all([snapshotRes.json(), sectorRes.json()]);
    
    sectorData.tickers?.forEach(t => {
      const change = t.todaysChangePerc || 0;
      if (t.ticker === 'SPY') spyChange = change;
      else sectorPerf[t.ticker] = change;
    });
    console.log(`📊 SPY: ${spyChange >= 0 ? '+' : ''}${spyChange.toFixed(2)}%`);
    
    // Save all snapshot tickers for options-first discovery later
    allSnapshotTickers = snapshotData.tickers || [];
    
    // ========== Pattern detection on each stock ==========
    snapshotData.tickers?.forEach(t => {
      if (isJunk(t.ticker)) return;
      
      const price = t.day?.c || t.prevDay?.c;
      const change = t.todaysChangePerc || ((t.day?.c - t.prevDay?.c) / t.prevDay?.c * 100);
      const volume = t.day?.v || 0;
      const prevVolume = t.prevDay?.v || 1;
      // During market hours, project today's volume to full day pace
      // e.g., at 11 AM (23% of day), 500K volume → projected 2.17M full-day pace
      const projectedVolume = isMarketHours ? volume / dayFraction : volume;
      const volumeRatio = projectedVolume / prevVolume;
      const high52 = t.max52Week?.high;
      const absChange = Math.abs(change || 0);
      
      if (!price || price < priceMin || price > priceMax) return;
      if (volume < volFloor) return;
      // Require meaningful baseline volume — filters out micro-caps that normally trade 200 shares
      if (prevVolume < 20000) return;
      
      const patterns = [];
      const triggers = [];
      
      // 1. INSTITUTIONAL FOOTPRINT: 3x+ volume on flat day (<2% move)
      if (volumeRatio >= 3 && absChange < 2) {
        patterns.push('INSTITUTIONAL_FOOTPRINT');
        triggers.push(`[FOOTPRINT] ${volumeRatio.toFixed(1)}x volume, only ${change >= 0 ? '+' : ''}${change.toFixed(1)}% move`);
      }
      
      // 2. QUIET ACCUMULATION: Tight range + elevated volume
      const accumVolFloor = isMarketHours ? Math.max(50000, Math.round(200000 * dayFraction)) : 200000;
      if (absChange < 1.5 && volumeRatio >= 2.5 && volume >= accumVolFloor) {
        patterns.push('QUIET_ACCUMULATION');
        triggers.push(`[ACCUMULATION] Tight range (${change >= 0 ? '+' : ''}${change.toFixed(1)}%) on ${volumeRatio.toFixed(1)}x volume`);
      }
      
      // 3. VOLUME SPIKE: 5x+ volume
      if (volumeRatio >= 5) {
        patterns.push('VOLUME_SPIKE');
        triggers.push(`[VOLUME] ${volumeRatio.toFixed(1)}x average volume`);
      }
      
      // 4. BREAKOUT: Near 52-week high on volume
      if (high52 && price && ((high52 - price) / high52 * 100) <= 3 && volumeRatio >= 1.5) {
        patterns.push('BREAKOUT_52W');
        triggers.push(`[BREAKOUT] Within 3% of 52-week high on volume`);
      }
      
      // 5. MOMENTUM: Large price move + volume
      if (absChange >= 4 && volumeRatio >= 2) {
        patterns.push('MOMENTUM');
        triggers.push(`[MOMENTUM] ${change >= 0 ? '+' : ''}${change.toFixed(1)}% on ${volumeRatio.toFixed(1)}x vol`);
      }
      
      if (patterns.length === 0) return;
      
      movers.set(t.ticker, {
        price,
        prevClose: t.prevDay?.c || null,
        change: change?.toFixed(2),
        volume,
        volumeRatio: volumeRatio.toFixed(1),
        anomalyScore: scoreAnomaly(patterns),
        near52High: patterns.includes('BREAKOUT_52W'),
        patterns: [...patterns],
        trigger: triggers.join(' • '),
        triggerType: patterns[0].toLowerCase(),
        sentiment: scoreSentiment(change, patterns),
        sic: null,
        source: 'anomaly'
      });
    });
    
    console.log(`✓ Snapshot: ${movers.size} stocks with anomaly patterns`);
  } catch (e) {
    console.log('Snapshot scan failed:', e.message);
  }

  // ========== STEP 1.5: CORRELATION BREAKDOWN DETECTION ==========
  setScanStatus('ANALYZING SECTOR CORRELATIONS...');
  setScanProgress(18);
  
  const topForCorrelation = [...movers.entries()]
    .sort((a, b) => b[1].anomalyScore - a[1].anomalyScore)
    .slice(0, 80);
  
  for (let i = 0; i < topForCorrelation.length; i += 10) {
    const batch = topForCorrelation.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async ([ticker]) => {
        try {
          const res = await fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`);
          const data = await res.json();
          return { ticker, sic: data.results?.sic_description || null };
        } catch { return { ticker, sic: null }; }
      })
    );
    
    results.forEach(({ ticker, sic }) => {
      const stock = movers.get(ticker);
      if (!stock) return;
      stock.sic = sic;
      
      const sectorETF = sicToSector(sic);
      if (sectorETF && sectorPerf[sectorETF] !== undefined) {
        const sectorChange = sectorPerf[sectorETF];
        const stockChange = parseFloat(stock.change) || 0;
        
        const isDiverging = (stockChange > 0.5 && sectorChange < -0.5) || (stockChange < -0.5 && sectorChange > 0.5);
        const divergenceStrength = Math.abs(stockChange - sectorChange);
        
        if (isDiverging && divergenceStrength >= 2) {
          stock.patterns.push('SECTOR_DIVERGENCE');
          stock.trigger += ` • [DIVERGENCE] ${stockChange >= 0 ? 'Up' : 'Down'} while ${SECTOR_ETFS[sectorETF]} (${sectorETF}) ${sectorChange >= 0 ? '+' : ''}${sectorChange.toFixed(1)}%`;
          stock.sectorETF = sectorETF;
          stock.sectorChange = sectorChange;
          stock.anomalyScore = scoreAnomaly(stock.patterns);
        }
      }
    });
    
    if (i + 10 < topForCorrelation.length) await new Promise(r => setTimeout(r, 50));
  }
  
  console.log(`🔀 Sector divergences: ${[...movers.values()].filter(s => s.patterns.includes('SECTOR_DIVERGENCE')).length}`);

  // ========== STEP 2: UNUSUAL OPTIONS ACTIVITY SCAN ==========
  setScanStatus('SCANNING OPTIONS FLOW...');
  setScanProgress(22);
  
  const topForOptions = [...movers.entries()]
    .sort((a, b) => b[1].anomalyScore - a[1].anomalyScore)
    .slice(0, 40)
    .map(([ticker]) => ticker);
  
  let optionsHits = 0;
  
  for (let i = 0; i < topForOptions.length; i += 5) {
    const batch = topForOptions.slice(i, i + 5);
    
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        try {
          const today = new Date();
          const thirtyDaysOut = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
          const expDate = thirtyDaysOut.toISOString().split('T')[0];
          
          const res = await fetch(
            `https://api.polygon.io/v3/snapshot/options/${ticker}?contract_type=call&expiration_date.lte=${expDate}&limit=50&apiKey=${POLYGON_KEY}`
          );
          const data = await res.json();
          const contracts = data.results || [];
          
          // Debug first ticker to verify API is working
          if (i === 0 && batch.indexOf(ticker) === 0) {
            console.log(`🔎 Options API check for ${ticker}: ${contracts.length} contracts returned, status: ${data.status || 'unknown'}`);
          }
          
          if (contracts.length === 0) return { ticker, hasUnusual: false };
          
          const stock = movers.get(ticker);
          const stockPrice = stock?.price || 0;
          
          let totalCallVolume = 0;
          let totalOpenInterest = 0;
          let otmCallVolume = 0;
          let maxIV = 0;
          let avgIV = 0;
          let ivCount = 0;
          let highVolContracts = [];
          
          contracts.forEach(c => {
            const vol = c.day?.volume || 0;
            const oi = c.open_interest || 0;
            const strike = c.details?.strike_price || 0;
            const iv = c.implied_volatility || 0;
            const daysToExpiry = c.details?.expiration_date 
              ? Math.ceil((new Date(c.details.expiration_date) - today) / (1000 * 60 * 60 * 24))
              : 30;
            
            totalCallVolume += vol;
            totalOpenInterest += oi;
            
            if (iv > 0) {
              if (iv > maxIV) maxIV = iv;
              avgIV += iv;
              ivCount++;
            }
            
            if (strike > stockPrice * 1.02) {
              otmCallVolume += vol;
            }
            
            // Contracts where volume >> open interest = NEW positions
            if (vol > 0 && oi > 0 && vol >= oi * 3 && vol >= 100) {
              highVolContracts.push({ strike, daysToExpiry, volume: vol, oi, ratio: (vol / oi).toFixed(1), iv: (iv * 100).toFixed(0) });
            }
            // Brand new positions (zero OI)
            if (vol >= 500 && oi === 0) {
              highVolContracts.push({ strike, daysToExpiry, volume: vol, oi: 0, ratio: 'NEW', iv: (iv * 100).toFixed(0) });
            }
          });
          
          if (ivCount > 0) avgIV = avgIV / ivCount;
          
          const optionsPatterns = [];
          const optionsTriggers = [];
          
          // A. Call volume >> open interest — aggressive new bullish bets
          if (totalOpenInterest > 0 && totalCallVolume >= totalOpenInterest * 2 && totalCallVolume >= 1000) {
            optionsPatterns.push('OPTIONS_UNUSUAL');
            optionsTriggers.push(`[OPTIONS] Call vol ${(totalCallVolume/totalOpenInterest).toFixed(1)}x open interest`);
          }
          
          // B. Heavy OTM call buying — someone betting on a big move
          if (otmCallVolume >= 500 && totalCallVolume > 0 && (otmCallVolume / totalCallVolume) >= 0.6) {
            optionsPatterns.push('OPTIONS_OTM_CALLS');
            optionsTriggers.push(`[OTM CALLS] ${((otmCallVolume / totalCallVolume) * 100).toFixed(0)}% of call volume is OTM`);
          }
          
          // C. IV spike — market pricing in unannounced catalyst
          if (avgIV > 0.8) {
            optionsPatterns.push('OPTIONS_IV_SPIKE');
            optionsTriggers.push(`[IV SPIKE] Implied volatility ${(avgIV * 100).toFixed(0)}%`);
          }
          
          // D. Specific hot contracts
          if (highVolContracts.length >= 2) {
            const top = highVolContracts.sort((a, b) => b.volume - a.volume)[0];
            optionsTriggers.push(`[HOT] $${top.strike} calls: ${top.volume.toLocaleString()} vol vs ${top.oi.toLocaleString()} OI (${top.daysToExpiry}d exp)`);
          }
          
          return {
            ticker, hasUnusual: optionsPatterns.length > 0,
            optionsPatterns, optionsTriggers,
            totalCallVolume, totalOpenInterest, otmCallVolume, avgIV,
            highVolContracts: highVolContracts.slice(0, 3)
          };
        } catch (e) {
          return { ticker, hasUnusual: false };
        }
      })
    );
    
    batchResults.forEach(result => {
      if (!result.hasUnusual) return;
      const stock = movers.get(result.ticker);
      if (!stock) return;
      
      stock.patterns.push(...result.optionsPatterns);
      stock.trigger += ' • ' + result.optionsTriggers.join(' • ');
      stock.anomalyScore = scoreAnomaly(stock.patterns);
      stock.optionsData = {
        callVolume: result.totalCallVolume,
        openInterest: result.totalOpenInterest,
        otmCallVolume: result.otmCallVolume,
        avgIV: result.avgIV,
        topContracts: result.highVolContracts
      };
      // Rescore sentiment with options data
      stock.sentiment = scoreSentiment(stock.change, stock.patterns, stock.optionsData);
      optionsHits++;
    });
    
    if (i + 5 < topForOptions.length) await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`📞 Options anomalies: ${optionsHits} of ${topForOptions.length} checked`);

  // ========== STEP 2b: OPTIONS-FIRST DISCOVERY (pre-move detection) ==========
  // Scan FLAT stocks for unusual options activity — catches smart money positioning before price moves
  setScanStatus('SCANNING QUIET OPTIONS FLOW...');
  setScanProgress(38);
  
  const flatCandidates = allSnapshotTickers
    .filter(t => {
      if (isJunk(t.ticker)) return false;
      if (movers.has(t.ticker)) return false; // Already caught by anomaly scanner
      const price = t.day?.c || t.prevDay?.c;
      const volume = t.day?.v || 0;
      const prevVolume = t.prevDay?.v || 1;
      const change = Math.abs(t.todaysChangePerc || 0);
      // Flat price, decent liquidity but NOT mega-caps (they always have high options activity)
      // prevVolume cap at 5M excludes the top ~50 most-traded stocks (NVDA, AAPL, TSLA, etc.)
      return price >= priceMin && price <= priceMax && volume >= 100000 && prevVolume >= 50000 && prevVolume < 5000000 && change < 2;
    })
    .sort(() => Math.random() - 0.5) // Randomize to get variety across scans
    .slice(0, 30);
  
  let optionsFirstHits = 0;
  
  for (let i = 0; i < flatCandidates.length; i += 5) {
    const batch = flatCandidates.slice(i, i + 5);
    
    const batchResults = await Promise.all(
      batch.map(async (t) => {
        try {
          const today = new Date();
          const thirtyDaysOut = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
          const expDate = thirtyDaysOut.toISOString().split('T')[0];
          
          const res = await fetch(
            `https://api.polygon.io/v3/snapshot/options/${t.ticker}?contract_type=call&expiration_date.lte=${expDate}&limit=50&apiKey=${POLYGON_KEY}`
          );
          const data = await res.json();
          const contracts = data.results || [];
          
          if (contracts.length === 0) return null;
          
          const stockPrice = t.day?.c || t.prevDay?.c || 0;
          let totalCallVolume = 0, totalOpenInterest = 0, otmCallVolume = 0;
          let maxIV = 0, avgIV = 0, ivCount = 0;
          let highVolContracts = [];
          
          contracts.forEach(c => {
            const vol = c.day?.volume || 0;
            const oi = c.open_interest || 0;
            const strike = c.details?.strike_price || 0;
            const iv = c.implied_volatility || 0;
            const daysToExpiry = c.details?.expiration_date 
              ? Math.ceil((new Date(c.details.expiration_date) - today) / (1000 * 60 * 60 * 24)) : 30;
            
            totalCallVolume += vol;
            totalOpenInterest += oi;
            if (iv > 0) { if (iv > maxIV) maxIV = iv; avgIV += iv; ivCount++; }
            if (strike > stockPrice * 1.05) otmCallVolume += vol; // 5%+ OTM (tighter than 2%)
            
            // Contracts where volume >> open interest = NEW positions (tighter: 5x instead of 3x)
            if (vol > 0 && oi > 0 && vol >= oi * 5 && vol >= 200) {
              highVolContracts.push({ strike, daysToExpiry, volume: vol, oi, ratio: (vol / oi).toFixed(1), iv: (iv * 100).toFixed(0) });
            }
            if (vol >= 500 && oi === 0) {
              highVolContracts.push({ strike, daysToExpiry, volume: vol, oi: 0, ratio: 'NEW', iv: (iv * 100).toFixed(0) });
            }
          });
          
          if (ivCount > 0) avgIV = avgIV / ivCount;
          
          // Tighter thresholds for pre-move — must be genuinely unusual
          const patterns = [];
          const triggers = [];
          
          // Call volume 3x+ OI (tighter than normal 2x) — aggressive new positioning
          if (totalOpenInterest > 0 && totalCallVolume >= totalOpenInterest * 3 && totalCallVolume >= 1000) {
            patterns.push('OPTIONS_UNUSUAL');
            triggers.push(`[OPTIONS] Call vol ${(totalCallVolume/totalOpenInterest).toFixed(1)}x open interest`);
          }
          // Heavy OTM call buying — 5%+ out of the money
          if (otmCallVolume >= 500 && totalCallVolume > 0 && (otmCallVolume / totalCallVolume) >= 0.6) {
            patterns.push('OPTIONS_OTM_CALLS');
            triggers.push(`[OTM CALLS] ${((otmCallVolume / totalCallVolume) * 100).toFixed(0)}% of call volume is OTM`);
          }
          // IV spike — higher threshold (1.0 vs 0.8) since we want truly elevated IV
          if (avgIV > 1.0) {
            patterns.push('OPTIONS_IV_SPIKE');
            triggers.push(`[IV SPIKE] Implied volatility ${(avgIV * 100).toFixed(0)}%`);
          }
          if (highVolContracts.length >= 2) {
            const top = highVolContracts.sort((a, b) => b.volume - a.volume)[0];
            triggers.push(`[HOT] $${top.strike} calls: ${top.volume.toLocaleString()} vol vs ${top.oi.toLocaleString()} OI (${top.daysToExpiry}d exp)`);
          }
          
          if (patterns.length === 0) return null;
          
          const price = t.day?.c || t.prevDay?.c;
          const change = t.todaysChangePerc || 0;
          const volume = t.day?.v || 0;
          const prevVolume = t.prevDay?.v || 1;
          const projectedVol = isMarketHours ? volume / dayFraction : volume;
          const volumeRatio = projectedVol / prevVolume;
          
          return {
            ticker: t.ticker, price, prevClose: t.prevDay?.c || null,
            change: change?.toFixed(2), volume, volumeRatio: volumeRatio.toFixed(1),
            patterns, triggers,
            optionsData: { callVolume: totalCallVolume, openInterest: totalOpenInterest, otmCallVolume, avgIV, topContracts: highVolContracts.slice(0, 3) }
          };
        } catch { return null; }
      })
    );
    
    batchResults.filter(Boolean).forEach(result => {
      // Tighten pre-move: require 2+ options patterns OR 1 pattern + hot contract
      const optPatterns = result.patterns.filter(p => ['OPTIONS_UNUSUAL', 'OPTIONS_OTM_CALLS', 'OPTIONS_IV_SPIKE'].includes(p));
      const hasHotContract = result.optionsData?.topContracts?.length >= 1;
      if (optPatterns.length < 2 && !(optPatterns.length >= 1 && hasHotContract)) return;
      
      // Add PRE_MOVE tag — this is the key signal: options activity with NO price move
      result.patterns.unshift('PRE_MOVE');
      result.triggers.unshift(`[PRE-MOVE] Flat price (${result.change}%) but unusual options positioning`);
      
      movers.set(result.ticker, {
        price: result.price, prevClose: result.prevClose,
        change: result.change, volume: result.volume, volumeRatio: result.volumeRatio,
        anomalyScore: scoreAnomaly(result.patterns) + 20, // Bonus for being pre-move
        near52High: false, patterns: result.patterns,
        trigger: result.triggers.join(' • '),
        triggerType: 'options_first',
        sentiment: scoreSentiment(result.change, result.patterns, result.optionsData),
        optionsData: result.optionsData,
        source: 'options_discovery'
      });
      optionsFirstHits++;
    });
    
    if (i + 5 < flatCandidates.length) await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`🎯 Options-first discovery: ${optionsFirstHits} pre-move signals from ${flatCandidates.length} quiet stocks checked (pool excluded mega-caps)`);

  // ========== Grab top gainers to catch big movers ==========
  try {
    const res = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON_KEY}`);
    const data = await res.json();
    data.tickers?.forEach(t => {
      const price = t.day?.c || t.prevDay?.c;
      const change = t.todaysChangePerc || ((t.prevDay?.c - t.prevDay?.o) / t.prevDay?.o * 100);
      const volume = t.day?.v || 0;
      const prevVolume = t.prevDay?.v || 1;
      const projectedVol = isMarketHours ? volume / dayFraction : volume;
      const volumeRatio = projectedVol / prevVolume;
      
      if (price >= priceMin && price <= priceMax && !isJunk(t.ticker) && volume >= volFloor && prevVolume >= 20000) {
        if (!movers.get(t.ticker)) {
          const patterns = ['MOMENTUM'];
          const triggers = [`[GAINER] +${change?.toFixed(1)}% on ${volumeRatio.toFixed(1)}x vol`];
          if (volumeRatio >= 5) { patterns.push('VOLUME_SPIKE'); triggers.push(`[VOLUME] ${volumeRatio.toFixed(1)}x avg volume`); }
          movers.set(t.ticker, {
            price, prevClose: t.prevDay?.c || null, change: change?.toFixed(2), volume, volumeRatio: volumeRatio.toFixed(1),
            anomalyScore: scoreAnomaly(patterns), near52High: false, patterns, trigger: triggers.join(' • '),
            triggerType: 'gainer', sentiment: scoreSentiment(change, patterns), source: 'anomaly'
          });
        }
      }
    });
    console.log(`✓ Gainers merged, total: ${movers.size}`);
  } catch (e) { console.log('Gainers failed:', e.message); }
  
  if (movers.size === 0) return { stocks: [], total: 0 };

  // ========== STEP 3: CHECK NEWS COVERAGE ==========
  setScanStatus('CHECKING NEWS COVERAGE...');
  setScanProgress(48);
  
  const sortedByAnomaly = [...movers.entries()]
    .sort((a, b) => b[1].anomalyScore - a[1].anomalyScore)
    .slice(0, 100);
  
  console.log(`📊 Top anomalies: ${sortedByAnomaly.slice(0, 8).map(([t, d]) => `${t}(${d.anomalyScore}:${d.patterns.join('+')})`).join(', ')}`);

  const withData = [];
  for (let i = 0; i < sortedByAnomaly.length; i += 10) {
    const batch = sortedByAnomaly.slice(i, i + 10);
    const batchResults = await Promise.all(
      batch.map(async ([ticker, data]) => {
        try {
          const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
          const polygonRes = await fetch(
            `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=5&published_utc.gte=${twoDaysAgo}&order=desc&sort=published_utc&apiKey=${POLYGON_KEY}`
          ).then(r => r.json());
          const recentArticles = polygonRes.results || [];
          
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const olderRes = await fetch(
            `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=3&published_utc.gte=${thirtyDaysAgo}&order=desc&sort=published_utc&apiKey=${POLYGON_KEY}`
          ).then(r => r.json());
          const olderArticles = olderRes.results || [];
          
          return {
            ticker, ...data,
            recentNews: recentArticles, olderNews: olderArticles,
            hasRecentNews: recentArticles.length > 0,
            headline: recentArticles[0]?.title || null,
            newsSource: recentArticles[0]?.publisher?.name || null,
            newsDate: recentArticles[0]?.published_utc ? new Date(recentArticles[0].published_utc).toLocaleDateString() : null,
            newsCount: recentArticles.length,
            news: (recentArticles.length > 0 ? recentArticles : olderArticles).slice(0, 3),
          };
        } catch (e) {
          return { ticker, ...data, recentNews: [], olderNews: [], hasRecentNews: false, news: [], newsCount: 0 };
        }
      })
    );
    withData.push(...batchResults);
    if (i + 10 < sortedByAnomaly.length) await new Promise(r => setTimeout(r, 100));
  }

  // ========== STEP 4: SPLIT INTO TIERS ==========
  // Pre-move stocks WITHOUT news = true pre-move signal (highest value)
  // Pre-move stocks WITH news = options just reacting to news (demote to Tier 2)
  let preMoveSignals = withData
    .filter(s => s.source === 'options_discovery' && !s.hasRecentNews)
    .sort((a, b) => b.anomalyScore - a.anomalyScore);
  
  // TIER 1: Activity BEFORE news — the money signal (non-pre-move)
  let earlySignals = withData
    .filter(s => s.source !== 'options_discovery' && !s.hasRecentNews && s.anomalyScore >= 20)
    .sort((a, b) => b.anomalyScore - a.anomalyScore);
  
  // TIER 2: Activity WITH news — catalyst confirmed (includes demoted pre-move stocks)
  let catalystStocks = withData
    .filter(s => s.hasRecentNews)
    .sort((a, b) => b.anomalyScore - a.anomalyScore);
  
  // ========== STEP 4b: VERIFY EARLY SIGNALS VIA FINNHUB ==========
  // Polygon's ticker tagging misses a lot of news — cross-check with Finnhub
  // Verify both early signals and pre-move signals
  const signalsToVerify = [...earlySignals.slice(0, 15), ...preMoveSignals.slice(0, 10)];
  if (signalsToVerify.length > 0) {
    setScanStatus('VERIFYING EARLY SIGNALS...');
    setScanProgress(58);
    const twoDaysMs = 48 * 60 * 60 * 1000;
    const promoted = []; // stocks that actually have news → move to Tier 2
    
    for (let i = 0; i < signalsToVerify.length; i += 5) {
      const batch = signalsToVerify.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (stock) => {
          try {
            const finnhubArticles = await fetchFinnhubNews(stock.ticker, 5);
            const recentFinnhub = finnhubArticles.filter(a => {
              const pubDate = new Date(a.published_utc);
              return (Date.now() - pubDate.getTime()) < twoDaysMs;
            });
            return { ticker: stock.ticker, recentFinnhub };
          } catch {
            return { ticker: stock.ticker, recentFinnhub: [] };
          }
        })
      );
      
      for (const r of results) {
        if (r.recentFinnhub.length > 0) {
          // Check if it's an early signal or pre-move signal
          let stock = earlySignals.find(s => s.ticker === r.ticker);
          if (!stock) stock = preMoveSignals.find(s => s.ticker === r.ticker);
          if (stock) {
            stock.hasRecentNews = true;
            stock.headline = r.recentFinnhub[0].title;
            stock.newsSource = r.recentFinnhub[0].publisher?.name;
            stock.news = r.recentFinnhub.slice(0, 3);
            stock.newsCount = r.recentFinnhub.length;
            promoted.push(stock);
          }
        }
      }
      if (i + 5 < signalsToVerify.length) await new Promise(r => setTimeout(r, 600));
    }
    
    if (promoted.length > 0) {
      console.log(`🔄 Finnhub cross-check: ${promoted.length} stocks had news Polygon missed → moved to Tier 2 (${promoted.map(s => s.ticker).join(', ')})`);
      earlySignals = earlySignals.filter(s => !s.hasRecentNews);
      preMoveSignals = preMoveSignals.filter(s => !s.hasRecentNews);
      catalystStocks = [...catalystStocks, ...promoted].sort((a, b) => b.anomalyScore - a.anomalyScore);
    }
  }
  
  console.log(`🎯 Pre-Move (no news): ${preMoveSignals.length} — options activity before any news`);
  console.log(`🔍 Tier 1 (Early Signals): ${earlySignals.length} — activity before news`);
  console.log(`📰 Tier 2 (Catalysts): ${catalystStocks.length} — activity with news`);

  // ========== STEP 5: FETCH COMPANY CONTEXT + AI ANALYSIS ==========
  setScanStatus('FETCHING COMPANY CONTEXT...');
  setScanProgress(65);
  
  // Batch fetch company names & industries for AI context
  const allAIStocks = [...earlySignals.slice(0, 20), ...catalystStocks.slice(0, 25), ...preMoveSignals.slice(0, 15)];
  const uniqueAITickers = [...new Set(allAIStocks.map(s => s.ticker))];
  const companyContext = {};
  
  for (let i = 0; i < uniqueAITickers.length; i += 15) {
    const batch = uniqueAITickers.slice(i, i + 15);
    const results = await Promise.allSettled(
      batch.map(ticker => 
        fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`)
          .then(r => r.json())
          .then(d => ({ ticker, name: d.results?.name, industry: d.results?.sic_description }))
      )
    );
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        const { ticker, name, industry } = r.value;
        companyContext[ticker] = { name: cleanCompanyName(name || ticker), industry: industry || '' };
      }
    });
    if (i + 15 < uniqueAITickers.length) await new Promise(r => setTimeout(r, 200));
  }
  console.log(`🏢 Company context fetched for ${Object.keys(companyContext).length}/${uniqueAITickers.length} tickers`);
  
  // Attach context to stocks for reuse in verification step
  [...earlySignals, ...catalystStocks, ...preMoveSignals].forEach(s => {
    if (companyContext[s.ticker]) s._company = companyContext[s.ticker];
  });
  
  // Helper: build rich stock description for AI
  const buildStockContext = (s, i) => {
    const company = companyContext[s.ticker];
    const parts = [];
    parts.push(`${s.ticker}${company ? ` (${company.name}${company.industry ? ' — ' + company.industry : ''})` : ''}`);
    parts.push(`price: ${s.change >= 0 ? '+' : ''}${s.change}%, vol: ${s.volumeRatio}x avg`);
    const patterns = (s.patterns || []);
    if (patterns.length > 0) parts.push(`signals: ${patterns.join(', ')}`);
    if (s.optionsData) {
      const ratio = (s.optionsData.callVolume / Math.max(s.optionsData.openInterest, 1)).toFixed(1);
      parts.push(`calls: ${s.optionsData.callVolume.toLocaleString()} vol vs ${s.optionsData.openInterest.toLocaleString()} OI (${ratio}x)`);
      if (s.optionsData.avgIV > 0) parts.push(`IV: ${(s.optionsData.avgIV * 100).toFixed(0)}%`);
      if (s.optionsData.topContracts?.[0]) {
        const tc = s.optionsData.topContracts[0];
        parts.push(`hottest: $${tc.strike} calls, ${tc.volume} vol, ${tc.daysToExpiry}d out`);
      }
    }
    if (s.sectorETF) parts.push(`sector ${s.sectorETF}: ${s.sectorChange >= 0 ? '+' : ''}${s.sectorChange.toFixed(1)}%`);
    if (s.near52High) parts.push('near 52w high');
    if (s.olderNews?.[0]) parts.push(`older news: "${s.olderNews[0].title}"`);
    return `${i + 1}. ${parts.join(' | ')}`;
  };

  setScanStatus('ANALYZING ANOMALIES...');
  setScanProgress(72);

  // Helper: generate human-readable descriptions from raw data when AI doesn't run
  const buildReadableFallback = (s, type) => {
    const company = companyContext[s.ticker];
    const name = company?.name || s.ticker;
    const industry = company?.industry ? `, a ${company.industry.toLowerCase()}` : '';
    const volText = s.volumeRatio ? `${s.volumeRatio}x normal volume` : '';
    const parts = [];
    if (s.patterns?.includes('INSTITUTIONAL_FOOTPRINT')) parts.push('institutional block buying');
    if (s.patterns?.includes('QUIET_ACCUMULATION')) parts.push('quiet accumulation');
    if (s.patterns?.includes('VOLUME_SPIKE')) parts.push(volText || 'volume spike');
    if (s.patterns?.includes('MOMENTUM')) parts.push(`up ${s.change}%`);
    if (s.patterns?.includes('SECTOR_DIVERGENCE')) parts.push('diverging from sector');
    if (s.patterns?.includes('BREAKOUT_52W')) parts.push('near 52-week high');
    if (s.patterns?.includes('OPTIONS_IV_SPIKE')) parts.push('elevated IV');
    if (s.patterns?.includes('OPTIONS_OTM_CALLS')) parts.push('heavy OTM call buying');
    if (s.patterns?.includes('OPTIONS_UNUSUAL')) parts.push('unusual call volume vs open interest');
    const signals = parts.slice(0, 3).join(', ');
    if (type === 'options_first') {
      return `${name}${industry} showing ${signals} — no news yet, options market pricing in an undisclosed catalyst`;
    } else if (type === 'early_signal') {
      return `${name}${industry} showing ${signals} — no news yet, something may be developing behind the scenes`;
    } else {
      const headline = s.headline || s.recentNews?.[0]?.title || '';
      return headline ? `${name}${industry}: ${headline.slice(0, 80)}` : `${name}${industry} showing ${signals}`;
    }
  };
  
  // AI for EARLY SIGNALS — synthesize all signals into a compelling narrative
  if (earlySignals.length > 0) {
    try {
      const toAnalyze = earlySignals.slice(0, 20);
      const input = toAnalyze.map((s, i) => buildStockContext(s, i)).join('\n');
      
      const result = await aiModel.generateContent(
        `You are a stock market detective writing for active traders. These stocks show unusual activity with NO recent news — something is happening behind the scenes.

For each stock, write a 30-45 word narrative in TWO parts separated by " — ":
PART 1 (bold hook): What the company does + what's happening in the data (be specific with numbers)
PART 2 (the theory): What smart money might know — connect the dots between all signals to suggest a plausible catalyst

RULES:
- Name the company and its business in the first few words
- Use SPECIFIC numbers from the data (volume multiples, IV %, strike prices, expiry days)
- Connect multiple signals into a single theory (don't list them separately)
- The theory should be industry-appropriate (biotech = trial data, bank = M&A, defense = contract, etc.)
- Never say "unusual activity detected" or "something may be brewing" — BE SPECIFIC about what

Bad: "4x volume with institutional footprint and options IV spike — unusual activity detected"
Bad: "Showing signs of accumulation with elevated options flow — worth watching"
Good: "Regional bank quietly accumulating at 4x normal volume with $45 calls loading at 5x open interest, 12 days out — positioning suggests someone expects an acquisition bid or blowout earnings"
Good: "Biotech sitting flat while $30 OTM calls surge with IV spiking to 140%, diverging +3% from XBI — pattern consistent with insiders front-running Phase 3 data readout"
Good: "Defense contractor showing institutional block buying at 6x volume on a flat tape, $85 calls stacking 18 days out — likely front-running an unannounced DoD contract award"

Stocks:
${input}

Return ONLY a numbered list:
1. [insight]
...`
      );
      
      const text = await result.response.text();
      const analyses = text.split('\n').filter(line => /^\d+\./.test(line.trim())).map(line => line.replace(/^\d+\.\s*/, '').trim());
      
      toAnalyze.forEach((stock, i) => {
        stock.catalyst = (analyses[i] && analyses[i].length > 10) ? analyses[i].replace(/^["']|["']$/g, '').replace(/\*\*/g, '').trim() : buildReadableFallback(stock, 'early_signal');
        stock.catalystType = 'early_signal';
        stock.signalTier = 1;
      });
      earlySignals.slice(20).forEach(stock => { stock.catalyst = buildReadableFallback(stock, 'early_signal'); stock.catalystType = 'early_signal'; stock.signalTier = 1; });
      console.log(`🤖 AI analyzed ${toAnalyze.length} early signals`);
    } catch (e) {
      console.log('AI early signal failed:', e.message);
      earlySignals.forEach(stock => { stock.catalyst = buildReadableFallback(stock, 'early_signal'); stock.catalystType = 'early_signal'; stock.signalTier = 1; });
    }
  }

  
  // AI for CATALYST STOCKS — news + technical context narrative
  setScanProgress(80);
  if (catalystStocks.length > 0) {
    try {
      const toAnalyze = catalystStocks.slice(0, 25);
      const input = toAnalyze.map((s, i) => {
        const company = companyContext[s.ticker];
        const newsText = s.recentNews?.slice(0, 2).map(n => n.title).join(' | ') || s.headline;
        const parts = [];
        parts.push(`${s.ticker}${company ? ` (${company.name}${company.industry ? ' — ' + company.industry : ''})` : ''}`);
        parts.push(`+${s.change}%, vol: ${s.volumeRatio}x avg`);
        parts.push(`news: "${newsText}"`);
        if (s.optionsData) {
          const ratio = (s.optionsData.callVolume / Math.max(s.optionsData.openInterest, 1)).toFixed(1);
          parts.push(`options: ${ratio}x call/OI`);
        }
        if (s.patterns.includes('SECTOR_DIVERGENCE')) parts.push('diverging from sector');
        if (s.patterns.includes('INSTITUTIONAL_FOOTPRINT')) parts.push('institutional accumulation');
        if (s.near52High) parts.push('near 52w high');
        return `${i + 1}. ${parts.join(' | ')}`;
      }).join('\n');
      
      const result = await aiModel.generateContent(
        `You are a stock analyst writing for active traders. These stocks have NEWS driving them.

For each stock, write a 30-45 word narrative in TWO parts separated by " — ":
PART 1 (the catalyst): Lead with SPECIFIC news details — drug names, deal sizes, earnings beats/misses, contract values, regulatory decisions
PART 2 (the setup): Connect the news to technical confirmation — is smart money piling in? Options surging? Breaking key levels?

RULES:
- Be specific: "$2.3B acquisition" not "positive deal news"
- Include numbers: "beat by 22%" not "strong earnings"
- Use the technical signals to validate the news: "8x volume confirms this isn't just headlines"
- Never say "positive news" or "shares rise" — tell the trader WHY and WHAT COMES NEXT

Bad: "Positive news drives shares higher on volume"
Bad: "Company reports strong earnings, stock moves up"
Good: "FDA fast-tracks cancer immunotherapy into priority review, $45 calls surging 5x open interest — institutional buyers loading suggests multi-day runner ahead"
Good: "Beat Q4 by 22% and raised FY guidance above consensus, breaking 52-week high on 8x volume — momentum just starting as shorts scramble to cover"
Good: "$500M DoD drone contract awarded, stock diverging +4% from XLI sector — smart money accumulating with near-term calls stacking"

Stocks:
${input}

Return ONLY a numbered list:
1. [insight]
...`
      );
      
      const text = await result.response.text();
      const analyses = text.split('\n').filter(line => /^\d+\./.test(line.trim())).map(line => line.replace(/^\d+\.\s*/, '').trim());
      
      toAnalyze.forEach((stock, i) => {
        stock.catalyst = (analyses[i] && analyses[i].length > 10) ? analyses[i].replace(/^["']|["']$/g, '').replace(/\*\*/g, '').trim() : buildReadableFallback(stock, 'news');
        stock.catalystType = 'news';
        stock.signalTier = 2;
      });
      catalystStocks.slice(25).forEach(stock => { stock.catalyst = buildReadableFallback(stock, 'news'); stock.catalystType = 'news'; stock.signalTier = 2; });

      // Clean bad AI responses
      catalystStocks.forEach(stock => {
        if (stock.catalyst && (
          stock.catalyst.toLowerCase().includes('no clear catalyst') || stock.catalyst.toLowerCase().includes('not identified') ||
          stock.catalyst.toLowerCase().includes('no specific') || stock.catalyst.toLowerCase().includes('unclear') ||
          stock.catalyst.toLowerCase().includes('no catalyst') || stock.catalyst.toLowerCase().includes('cannot determine') ||
          stock.catalyst.toLowerCase().includes('no news') || stock.catalyst.toLowerCase().includes('provided summaries')
        )) { stock.catalyst = stock.headline?.slice(0, 120) || buildReadableFallback(stock, 'news'); }
      });
      console.log(`🤖 AI analyzed ${toAnalyze.length} catalyst stocks`);
    } catch (e) {
      console.log('AI catalyst failed:', e.message);
      catalystStocks.forEach(stock => { stock.catalyst = buildReadableFallback(stock, 'news'); stock.catalystType = 'news'; stock.signalTier = 2; });
    }
  }

  // ========== STEP 5b: AI ANALYSIS FOR PRE-MOVE OPTIONS ==========
  setScanStatus('ANALYZING PRE-MOVE OPTIONS...');
  setScanProgress(88);
  const preMoveStocksForAI = preMoveSignals; // Already filtered: no news
  
  if (preMoveStocksForAI.length > 0) {
    try {
      const toAnalyze = preMoveStocksForAI.slice(0, 15);
      const input = toAnalyze.map((s, i) => buildStockContext(s, i)).join('\n');
      
      const result = await aiModel.generateContent(
        `You are a smart money detective. These stocks have FLAT prices but UNUSUAL options activity and NO news — someone is positioning before a catalyst.

For each stock, write a 30-45 word narrative in TWO parts separated by " — ":
PART 1: Name the company, its business, and describe the exact options positioning (strikes, expiry timeline, volume vs OI ratios, IV level)
PART 2: Use the OPTIONS TIMELINE as a clue to the catalyst type:
  - 7-14 days out = imminent event (data readout, ruling, contract decision)
  - 30-60 days out = earnings play or scheduled FDA date
  - 90+ days out = strategic positioning (M&A thesis, sector rotation)

RULES:
- Industry context MUST inform your theory (biotech ≠ bank ≠ defense)
- Include specific numbers from the data
- The theory should explain WHY this timeline makes sense for this company
- Never say "bullish sentiment" or "aggressive positioning" — say WHAT they're positioning FOR

Bad: "High IV spike and call volume exceeding open interest — aggressive bullish sentiment"
Good: "Community bank flat while $45 calls load at 5x OI, 12 days out — timeline aligns with Q4 earnings, someone expects a blowout or acquisition announcement"
Good: "Biotech showing quiet accumulation with $30 OTM calls surging, IV at 140%, expiring in 21 days — positioning consistent with Phase 3 data readout imminent"
Good: "Defense contractor flat on a green tape, $85 calls 6x OI with 45-day expiry — timeline suggests front-running a major contract award cycle"

Stocks:
${input}

Return ONLY a numbered list:
1. [insight]
...`
      );
      
      const text = await result.response.text();
      const analyses = text.split('\n').filter(line => /^\d+\./.test(line.trim())).map(line => line.replace(/^\d+\.\s*/, '').trim());
      
      toAnalyze.forEach((stock, i) => {
        stock.catalyst = (analyses[i] && analyses[i].length > 10) ? analyses[i].replace(/^["']|["']$/g, '').replace(/\*\*/g, '').trim() : buildReadableFallback(stock, 'options_first');
        stock.catalystType = 'options_first';
        stock.signalTier = 1;
      });
      preMoveStocksForAI.slice(15).forEach(stock => { stock.catalyst = buildReadableFallback(stock, 'options_first'); stock.catalystType = 'options_first'; stock.signalTier = 1; });
      console.log(`🎯 AI analyzed ${toAnalyze.length} pre-move options signals`);
    } catch (e) {
      console.log('AI pre-move failed:', e.message);
      preMoveStocksForAI.forEach(stock => { stock.catalyst = buildReadableFallback(stock, 'options_first'); stock.catalystType = 'options_first'; stock.signalTier = 1; });
    }
  }

  // ========== STEP 6: COMBINE — PRE-MOVE + EARLY SIGNALS + CATALYSTS ==========
  const allStocks = [...preMoveStocksForAI, ...earlySignals, ...catalystStocks];
  
  const withEarly = allStocks.filter(s => s.signalTier === 1 && s.source !== 'options_discovery').length;
  const withCatalyst = allStocks.filter(s => s.signalTier === 2).length;
  const withOptions = allStocks.filter(s => s.optionsData).length;
  const withPreMove = preMoveStocksForAI.length;
  console.log(`✅ Final: ${withPreMove} pre-move, ${withEarly} early signals (${withOptions} w/ options), ${withCatalyst} catalyst stocks`);

  return { stocks: allStocks, total: movers.size };
  
}, [setScanStatus, setScanProgress, isLikelyETF, aiModel]);




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

  // Fetch news from Finnhub and normalize to Polygon format
const fetchFinnhubNews = async (ticker, limit = 3) => {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const from = thirtyDaysAgo.toISOString().split('T')[0];
    const to = today.toISOString().split('T')[0];
    
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
    );
    const articles = await res.json();
    
    // Normalize to Polygon format
    return (articles || []).slice(0, limit).map(a => ({
      title: a.headline,
      publisher: { name: a.source },
      published_utc: new Date(a.datetime * 1000).toISOString(),
      article_url: a.url,
      image_url: a.image,
      description: a.summary,
      tickers: a.related ? a.related.split(',') : [],
      _source: 'finnhub'
    }));
  } catch (e) {
    return [];
  }
};

// Deduplicate articles by title similarity
const dedupeArticles = (articles) => {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.title?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
      
      // Fetch data for manual ticker - use snapshot for live data
const [snapshotRes, profileRes] = await Promise.all([
  fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${ticker}&apiKey=${POLYGON_KEY}`),
  fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`)
]);

const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const newsRes = await fetch(
  `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=3&published_utc.gte=${thirtyDaysAgo}&order=desc&sort=published_utc&apiKey=${POLYGON_KEY}`
);
const newsData = await newsRes.json();
const articles = newsData.results || [];

const [snapshotData, profileData] = await Promise.all([
  snapshotRes.json(),
  profileRes.json()
]);

const finnhubNews = await fetchFinnhubNews(ticker, 5);
const news = dedupeArticles([...articles, ...finnhubNews])
  .sort((a, b) => new Date(b.published_utc) - new Date(a.published_utc))
  .slice(0, 5);
      
      const tickerData = snapshotData.tickers?.[0];
      if (!tickerData) {
        setScanStatus(`NO DATA FOUND FOR ${ticker}`);
        setLoading(false);
        setScanComplete(true);
        return;
      }
      
      const profile = profileData.results || {};
      const currentPrice = tickerData.day?.c || tickerData.prevDay?.c;
      const prevClosePrice = tickerData.prevDay?.c;
      const change = tickerData.todaysChangePerc || (prevClosePrice ? ((currentPrice - prevClosePrice) / prevClosePrice) * 100 : 0);
      const earnings = await fetchEarningsDate(ticker);

      
      const stock = {
        symbol: ticker,
        name: cleanCompanyName(profile.name) || ticker,
        price: currentPrice?.toFixed(2) || '0.00',
        prevClose: prevClosePrice || null,
        change: change?.toFixed(2) || '0.00',
        isPositive: change >= 0,
        headline: news[0]?.title || null,
        newsSource: news[0]?.publisher?.name || null,
        newsDate: news[0]?.published_utc ? new Date(news[0].published_utc).toLocaleDateString() : null,
        newsCount: news.length,
        news: news.slice(0, 3),
        volume: tickerData.day?.v || tickerData.prevDay?.v || 0,
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

const result = await discoverStocks('all', null, priceMin, priceMax);
const discoveredStocks = result.stocks || [];

if (discoveredStocks.length === 0) {
  setScanStatus('NO STOCKS FOUND');
  setLoading(false);
  setScanComplete(true);
  return;
}

// Score-based ordering with tier bonuses (replaces tier-based priority)
const isLikelySPAC = (name) => {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('acquisition corp') || n.includes('acquisition co') || n.includes('blank check') ||
    n.includes('merger corp') || n.includes('capital acquisition') || n.includes('equity partners') ||
    n.includes('growth capital') || n.includes('venture acquisition') || /\bacquisition\b/.test(n) || /\bspac\b/.test(n);
};

const isDebtInstrument = (name) => {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes(' bonds') || n.includes(' bond ') || n.includes('debenture') || n.includes('notes due') ||
    n.includes('% senior') || n.includes('% subordinated') || n.includes('convertible note') ||
    n.includes('fixed rate') || n.includes('floating rate') || n.includes('capital securities') ||
    n.includes('debt') || n.includes('warrant');
};

const recentTickers = getRecentTickers();

// Add tier bonus + SPAC penalty + recently-seen penalty, then sort by total score
const sortedCandidates = discoveredStocks.map(s => {
  const tierBonus = s.catalystType === 'options_first' ? 40 : s.catalystType === 'early_signal' ? 30 : 0;
  const spacPenalty = isLikelySPAC(s._company?.name) ? -80 : 0;
  const seenCount = recentTickers.get(s.ticker) || 0;
  const seenPenalty = seenCount * -50; // Cumulative: -50 first, -100 second, -150 third...
  const jitter = Math.floor(Math.random() * 31) - 15;
  const finalScore = (s.anomalyScore || 0) + tierBonus + spacPenalty + seenPenalty + jitter;
  return { ...s, finalScore, tierBonus, spacPenalty, seenPenalty, seenCount };
}).sort((a, b) => b.finalScore - a.finalScore);

console.log(`📋 Top candidates by score: ${sortedCandidates.slice(0, 10).map(s => 
  `${s.ticker}(${s.anomalyScore}${s.tierBonus ? '+' + s.tierBonus : ''}${s.seenPenalty ? s.seenPenalty : ''}=${s.finalScore}/${s.catalystType}/${(s.patterns||[]).length}p${s.seenCount ? '/seen' + s.seenCount + 'x' : ''})`
).join(', ')}`);

// Reserve 2 slots for fresh (unseen) stocks to ensure variety
const freshCandidates = sortedCandidates.filter(s => s.seenCount === 0);
const seenCandidates = sortedCandidates.filter(s => s.seenCount > 0);
const candidates = [...seenCandidates.slice(0, 10), ...freshCandidates.slice(0, 15)].slice(0, 25);

setScanStatus('VERIFYING STOCKS...');
setScanProgress(92);

// Verify each stock (guarantee at least 2 fresh picks)
const verified = [];
let freshCount = 0;
let seenVerifiedCount = 0;

for (const stock of candidates) {
  if (verified.length >= 5) break;
  if (!stock.ticker) continue;
  // Cap seen stocks at 3, leaving at least 2 slots for fresh
  if (stock.seenCount > 0 && seenVerifiedCount >= 3) continue;
  // Cap fresh stocks at 3, leaving at least 2 slots for top seen
  if (stock.seenCount === 0 && freshCount >= 3) continue;
  
  try {
    // Reuse company context from AI step if available, otherwise fetch
    let name, industry;
    if (stock._company) {
      name = stock._company.name || stock.ticker;
      industry = stock._company.industry || '';
    } else {
    const profileRes = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${stock.ticker}?apiKey=${POLYGON_KEY}`
    );
    const profileData = await profileRes.json();
    name = profileData.results?.name || stock.ticker;
      industry = profileData.results?.sic_description || '';
    }
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

    // Debt instrument hard filter
    if (isDebtInstrument(name)) {
      console.log(`❌ Filtered: ${stock.ticker} (${name}) [debt]`);
      continue;
    }

  const earnings = await fetchEarningsDate(stock.ticker);

    
    // Valid stock!
    verified.push({
      symbol: stock.ticker,
      name: cleanCompanyName(name),
      price: stock.price?.toFixed ? stock.price.toFixed(2) : String(stock.price || '0.00'),
      prevClose: stock.prevClose || null,
      change: stock.change || '0.00',
      isPositive: parseFloat(stock.change || 0) >= 0,
      catalyst: stock.catalyst,
      catalystType: stock.catalystType,
      signalTier: stock.signalTier || 2,
      anomalyScore: stock.anomalyScore || 0,
      patterns: stock.patterns || [],
      optionsData: stock.optionsData || null,
      headline: stock.headline,
      newsSource: stock.newsSource,
      newsDate: stock.newsDate,
      newsCount: stock.newsCount || 0,
      news: stock.news || [],
      volume: stock.volume,
      volumeRatio: stock.volumeRatio,
      trigger: stock.trigger,
      sentiment: stock.sentiment || 'NEUTRAL',
      source: stock.source,
      industry: industry,
      earnings: earnings,
    });
    
    console.log(`✅ Added: ${stock.ticker} - ${stock.catalystType} [${(stock.patterns || []).join('+')}]: ${stock.catalyst?.slice(0, 50)}`);
    if (stock.seenCount > 0) seenVerifiedCount++;
    else freshCount++;
  } catch (e) {
    console.log(`⚠️ Failed: ${stock.ticker}`, e.message);
  }
}

if (verified.length === 0) {
  // Fallback: relax filters - allow recently scanned, expand candidates
  setScanStatus('EXPANDING SEARCH...');
  const fallbackCandidates = sortedCandidates.slice(0, 120);
  
  for (const stock of fallbackCandidates) {
    if (verified.length >= 5) break;
    if (!stock.ticker) continue;
    
    try {
      const profileRes = await fetch(
        `https://api.polygon.io/v3/reference/tickers/${stock.ticker}?apiKey=${POLYGON_KEY}`
      );
      const profileData = await profileRes.json();
      const name = profileData.results?.name || stock.ticker;
      const nameLower = name.toLowerCase();
      
      if (
        nameLower.includes(' etf') || nameLower.includes(' etn') ||
        nameLower.includes('direxion') || nameLower.includes('proshares') ||
        nameLower.includes('graniteshares') || nameLower.includes('leveraged') ||
        nameLower.includes('inverse') || nameLower.includes('ishares') ||
        nameLower.includes('spdr ') || nameLower.includes('vanguard ') ||
        nameLower.includes('wisdomtree') || nameLower.includes('first trust') ||
        nameLower.includes('invesco ') || nameLower.includes('global x ') ||
        nameLower.includes('vaneck') || nameLower.includes('schwab ') ||
        nameLower.includes('depositary') || nameLower.includes('preferred') ||
        nameLower.includes('% notes') || nameLower.includes('trust units') ||
        nameLower.includes(' 2x') || nameLower.includes(' 3x') ||
        nameLower.includes('2x ') || nameLower.includes('3x ')
      ) continue;
      if (isDebtInstrument(name)) continue;

      const earnings = await fetchEarningsDate(stock.ticker);
      
      verified.push({
        symbol: stock.ticker,
        name: cleanCompanyName(name),
        price: stock.price?.toFixed ? stock.price.toFixed(2) : String(stock.price || '0.00'),
        prevClose: stock.prevClose || null,
        change: stock.change || '0.00',
        isPositive: parseFloat(stock.change || 0) >= 0,
        catalyst: stock.catalyst,
        catalystType: stock.catalystType,
        signalTier: stock.signalTier || 2,
        anomalyScore: stock.anomalyScore || 0,
        patterns: stock.patterns || [],
        optionsData: stock.optionsData || null,
        headline: stock.headline,
        newsSource: stock.newsSource,
        newsDate: stock.newsDate,
        newsCount: stock.newsCount || 0,
        news: stock.news || [],
        volume: stock.volume,
        volumeRatio: stock.volumeRatio,
        trigger: stock.trigger,
        sentiment: stock.sentiment || 'NEUTRAL',
        source: stock.source,
        industry: profileData.results?.sic_description || '',
        earnings: earnings,
      });
      
      console.log(`🔄 Fallback added: ${stock.ticker}`);
    } catch (e) {
      continue;
    }
  }
  
  if (verified.length === 0) {
    setScanStatus('NO VALID STOCKS FOUND');
    setLoading(false);
    setScanComplete(true);
    return;
  }
  
  setScanStatus(`FOUND ${verified.length} STOCKS (EXPANDED SEARCH)`);
}

// Update recently scanned
verified.forEach(s => {
  setRecentlyScanned(prev => new Set([...prev, s.symbol]));
});

setStocks(verified);
logScanHistory(verified);
setScanProgress(100);
const earlyCount = verified.filter(s => s.signalTier === 1).length;
const statusMsg = earlyCount > 0 
  ? `FOUND ${verified.length} STOCKS (${earlyCount} EARLY SIGNAL${earlyCount > 1 ? 'S' : ''})`
  : `FOUND ${verified.length} STOCKS`;
setScanStatus(statusMsg);
setScanComplete(true);
    
  } catch (err) {
    console.error('Scanner error:', err);
    setScanStatus('SCAN FAILED');
  } finally {
    setLoading(false);
  }
}, [discoverStocks, scanPriceMin, scanPriceMax, recentlyScanned]);


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
  
  // Filter by catalyst type or sentiment
  if (filterSignal !== "all") {
    if (filterSignal === 'bullish') {
      filtered = filtered.filter(stock => stock.sentiment === 'BULLISH');
    } else if (filterSignal === 'bearish') {
      filtered = filtered.filter(stock => stock.sentiment === 'BEARISH');
    } else if (filterSignal === 'pre_move') {
      filtered = filtered.filter(stock => stock.source === 'options_discovery' || stock.patterns?.includes('PRE_MOVE'));
    } else {
      filtered = filtered.filter(stock => 
        stock.catalystType === filterSignal
      );
    }
  }
  
  // Sort options updated for new data model
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "change-high") return parseFloat(b.change) - parseFloat(a.change);
    if (sortBy === "change-low") return parseFloat(a.change) - parseFloat(b.change);
    if (sortBy === "price-high") return parseFloat(b.price) - parseFloat(a.price);
    if (sortBy === "price-low") return parseFloat(a.price) - parseFloat(b.price);
    if (sortBy === "volume") return (b.volume || 0) - (a.volume || 0);
    if (sortBy === "news") return (b.newsCount || 0) - (a.newsCount || 0);
    // Default: pre-move first, then early signals, then news catalysts, then by change
    if (a.catalystType === 'options_first' && b.catalystType !== 'options_first') return -1;
    if (b.catalystType === 'options_first' && a.catalystType !== 'options_first') return 1;
    if (a.catalystType === 'early_signal' && b.catalystType !== 'early_signal') return -1;
    if (b.catalystType === 'early_signal' && a.catalystType !== 'early_signal') return 1;
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

// Lock sort order so live price updates don't reorder cards
const sortOrderRef = useRef([]);
const prevSortBy = useRef(sortBy);
const prevFilterSignal = useRef(filterSignal);
const prevStockCount = useRef(0);

const displayedStocks = useMemo(() => {
  const sorted = getSortedAndFilteredStocks(stocks);
  
  // Re-sort only when sort/filter changes or stock count changes (new scan)
  const sortChanged = prevSortBy.current !== sortBy;
  const filterChanged = prevFilterSignal.current !== filterSignal;
  const countChanged = sorted.length !== prevStockCount.current;
  
  if (sortChanged || filterChanged || countChanged || sortOrderRef.current.length === 0) {
    sortOrderRef.current = sorted.map(s => s.symbol);
    prevSortBy.current = sortBy;
    prevFilterSignal.current = filterSignal;
    prevStockCount.current = sorted.length;
    return sorted.map(getStableStock);
  }
  
  // Price update only — preserve existing order, just update data
  const stockMap = {};
  sorted.forEach(s => { stockMap[s.symbol] = s; });
  return sortOrderRef.current
    .filter(sym => stockMap[sym])
    .map(sym => getStableStock(stockMap[sym]));
}, [stocks, getSortedAndFilteredStocks, getStableStock, sortBy, filterSignal]);

const displayedWatchlist = getSortedAndFilteredStocks(watchlist);

// Share Scan as Image
const generateShareImage = useCallback(async () => {
  const stocksToShare = displayedStocks.slice(0, 6);
  if (stocksToShare.length === 0) return;

  // Load logo image
  const logo = new Image();
  logo.crossOrigin = 'anonymous';
  logo.src = '/jckrbbt_logo.png';
  
  await new Promise((resolve, reject) => {
    logo.onload = resolve;
    logo.onerror = reject;
  }).catch(() => null); // Continue even if logo fails to load

  const scale = 2; // retina
  const W = 600;
  const rowH = 80;
  const headerH = 120;
  const footerH = 70;
  const padding = 30;
  const H = headerH + (stocksToShare.length * rowH) + footerH + 20;

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a0a');
  grad.addColorStop(1, '#111111');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle border
  ctx.strokeStyle = 'rgba(0, 255, 78, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // Top accent line
  ctx.fillStyle = '#00ff4e';
  ctx.fillRect(0, 0, W, 2);

  // Header - Logo image
  let logoEndX = padding;
  if (logo.complete && logo.naturalWidth > 0) {
    const logoH = 30;
    const logoAspect = logo.naturalWidth / logo.naturalHeight;
    const logoDrawW = logoH * logoAspect;
    ctx.drawImage(logo, padding, 18, logoDrawW, logoH);
    logoEndX = padding + logoDrawW + 12;
  } else {
    // Fallback to text if logo fails
    ctx.font = '700 22px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('jckrbbt_', padding, 42);
    logoEndX = padding + ctx.measureText('jckrbbt_').width + 12;
  }

  // Header - "MARKET SCAN" badge
  const badgeText = 'MARKET SCAN';
  ctx.font = '800 9px "JetBrains Mono", ui-monospace, monospace';
  const badgeW = ctx.measureText(badgeText).width + 14;
  const bx = logoEndX;
  ctx.fillStyle = 'rgba(0, 255, 78, 0.12)';
  ctx.beginPath();
  ctx.roundRect(bx, 28, badgeW, 20, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 255, 78, 0.3)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.fillStyle = '#00ff4e';
  ctx.fillText(badgeText, bx + 7, 42);

  // Header - Username (right-aligned)
  const handle = user?.username ? `@${user.username}` : '';
  if (handle) {
    ctx.font = '700 12px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = '#a1a1aa';
    const handleW = ctx.measureText(handle).width;
    ctx.fillText(handle, W - padding - handleW, 42);
  }

  // Header - Date and count
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  ctx.font = '400 11px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = '#52525b';
  ctx.fillText(`${dateStr} • ${timeStr} • ${stocksToShare.length} stocks`, padding, 68);

  // Divider
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(padding, 85, W - padding * 2, 1);

  // Stock rows
  stocksToShare.forEach((stock, i) => {
    const y = headerH + (i * rowH);
    
    // Row hover effect - subtle alternating
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.015)';
      ctx.fillRect(padding - 10, y, W - padding * 2 + 20, rowH);
    }

    // Symbol
    ctx.font = '800 18px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(stock.symbol, padding, y + 28);

    // Company name (truncated)
    ctx.font = '400 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = '#71717a';
    let name = stock.name || '';
    if (name.length > 28) name = name.slice(0, 25) + '...';
    ctx.fillText(name, padding, y + 44);

    // Price - right aligned
    const priceStr = stock.price ? `$${parseFloat(stock.price).toFixed(2)}` : '';
    ctx.font = '600 14px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = '#a1a1aa';
    const priceW = ctx.measureText(priceStr).width;
    ctx.fillText(priceStr, W - padding - priceW, y + 24);

    // Change % - right aligned, colored
    const change = parseFloat(stock.change) || 0;
    const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    ctx.font = '800 12px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = change >= 0 ? '#00ff4e' : '#ef4444';
    const changeW = ctx.measureText(changeStr).width;
    // Change pill background
    const pillW = changeW + 12;
    const pillX = W - padding - pillW;
    ctx.fillStyle = change >= 0 ? 'rgba(0,255,78,0.1)' : 'rgba(239,68,68,0.1)';
    ctx.beginPath();
    ctx.roundRect(pillX, y + 32, pillW, 18, 4);
    ctx.fill();
    ctx.fillStyle = change >= 0 ? '#00ff4e' : '#ef4444';
    ctx.fillText(changeStr, pillX + 6, y + 45);

    // Catalyst - below symbol
    const catalyst = stock.catalyst || stock.trigger || '';
    const catalystHook = catalyst.includes(' — ') ? catalyst.split(' — ')[0] : catalyst;
    if (catalyst) {
      let catX = padding;
      
      // Early Signal badge
      if (stock.catalystType === 'early_signal' || stock.signalTier === 1) {
        const badgeLabel = 'EARLY SIGNAL';
        ctx.font = '800 7px "JetBrains Mono", ui-monospace, monospace';
        const bw = ctx.measureText(badgeLabel).width + 10;
        ctx.fillStyle = 'rgba(249, 115, 22, 0.15)';
        ctx.beginPath();
        ctx.roundRect(padding, y + 50, bw, 16, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.fillText(badgeLabel, padding + 5, y + 61);
        catX = padding + bw + 6;
      }
      
      ctx.font = '400 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = '#a1a1aa';
      const maxLen = stock.signalTier === 1 ? 42 : 55;
      let catText = catalystHook.length > maxLen ? catalystHook.slice(0, maxLen - 3) + '...' : catalystHook;
      ctx.fillText(`▸ ${catText}`, catX, y + 62);
    }

    // Row divider
    if (i < stocksToShare.length - 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(padding, y + rowH - 1, W - padding * 2, 0.5);
    }
  });

  // Footer divider
  const footerY = headerH + (stocksToShare.length * rowH) + 5;
  ctx.fillStyle = 'rgba(0, 255, 78, 0.15)';
  ctx.fillRect(padding, footerY, W - padding * 2, 1);

  // Footer - logo icon + text
  let footerTextX = padding;
  if (logo.complete && logo.naturalWidth > 0) {
    const fLogoH = 20;
    const fLogoAspect = logo.naturalWidth / logo.naturalHeight;
    const fLogoW = fLogoH * fLogoAspect;
    ctx.drawImage(logo, padding, footerY + 14, fLogoW, fLogoH);
    footerTextX = padding + fLogoW + 8;
  }
  
  ctx.font = '800 15px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = '#00ff4e';
  ctx.fillText('jckrbbt.io', footerTextX, footerY + 30);
  const jckrbbtW = ctx.measureText('jckrbbt.io').width;

  ctx.font = '400 10px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = '#52525b';
  ctx.fillText('Free AI Stock Scanner', footerTextX + jckrbbtW + 10, footerY + 30);

  // "Not financial advice" tiny text
  ctx.font = '400 8px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillStyle = '#27272a';
  ctx.fillText('Not financial advice. For informational purposes only.', padding, footerY + 52);

  // Convert to blob and download
  canvas.toBlob((blob) => {
    // Try native share first (mobile), fall back to download
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], `jckrbbt-scan-${now.toISOString().split('T')[0]}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: 'JCKRBBT Market Scan',
          text: `Today's scan on jckrbbt.io — ${stocksToShare.length} stocks with catalysts`
        }).catch(() => {
          // User cancelled share, do nothing
        });
        return;
      }
    }
    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jckrbbt-scan-${now.toISOString().split('T')[0]}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}, [displayedStocks, user]);

// Copy scan as Reddit markdown
const copyForReddit = useCallback(() => {
  const stocksToShare = displayedStocks.slice(0, 8);
  if (stocksToShare.length === 0) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const handle = user?.username ? ` | @${user.username}` : '';
  
  let md = `**Stocks I'm watching today** — ${dateStr}\n\n`;
  md += `|Ticker|Price|Change|Catalyst|\n`;
  md += `|:-|:-|:-|:-|\n`;
  stocksToShare.forEach(stock => {
    const price = stock.price ? `$${parseFloat(stock.price).toFixed(2)}` : '-';
    const change = parseFloat(stock.change) || 0;
    const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    const catalystHook = (stock.catalyst || stock.trigger || '');
    const catalyst = (catalystHook.includes(' — ') ? catalystHook.split(' — ')[0] : catalystHook).slice(0, 80);
    const earlyTag = stock.signalTier === 1 ? '🔍 ' : '';
    md += `|**${stock.symbol}**|${price}|${changeStr}|${earlyTag}${catalyst}|\n`;
  });
  md += `\nScanned with [jckrbbt.io](https://jckrbbt.io)${handle} — free AI stock scanner\n`;
  md += `\n*Not financial advice. For informational purposes only.*`;
  
  navigator.clipboard.writeText(md).then(() => {
    setCopiedReddit(true);
    setTimeout(() => setCopiedReddit(false), 2000);
  });
}, [displayedStocks, user]);

// Copy scan for Twitter/X
const copyForTwitter = useCallback(() => {
  const stocksToShare = displayedStocks.slice(0, 5);
  if (stocksToShare.length === 0) return;
  const handle = user?.username ? `\n\n@${user.username} on jckrbbt.io` : '';
  
  let text = `Stocks moving on catalysts today:\n\n`;
  stocksToShare.forEach(stock => {
    const change = parseFloat(stock.change) || 0;
    const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    const catalystRaw = (stock.catalyst || stock.trigger || '');
    const catalyst = (catalystRaw.includes(' — ') ? catalystRaw.split(' — ')[0] : catalystRaw).slice(0, 60);
    text += `$${stock.symbol} ${changeStr} — ${catalyst}\n`;
  });
  text += `\nFound with jckrbbt.io`;
  text += handle;
  
  navigator.clipboard.writeText(text).then(() => {
    setCopiedTwitter(true);
    setTimeout(() => setCopiedTwitter(false), 2000);
  });
}, [displayedStocks, user]);





 return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 pb-20 md:pb-8 font-mono">

{/* WELCOME ONBOARDING SCREEN */}
<AnimatePresence>
{showWelcome && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.5 }}
    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black"
  >
    {/* Subtle animated background */}
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #00ff4e 0%, transparent 70%)' }} />
    </div>

    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className="relative z-10 max-w-lg mx-auto px-6 text-center"
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mb-8"
      >
        <img src="/jckrbbt_logo.png" alt="JCKRBBT" className="h-16 md:h-20 mx-auto" />
      </motion.div>

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="text-base md:text-lg text-zinc-400 font-bold mb-10 leading-relaxed"
      >
        Find stocks with <span className="text-[#00ff4e] font-black">real catalysts</span>
        <br />before they move.
      </motion.p>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="space-y-4 mb-10"
      >
        {[
          { Icon: Zap, title: 'AI-Powered Scanner', desc: 'Spots unusual stock activity before the news breaks — volume spikes, price anomalies, and hidden moves' },
          { Icon: FileText, title: 'Deep Research Reports', desc: 'AI-generated bull/bear cases, technicals, and risk analysis' },
          { Icon: MessageCircle, title: 'Ask AI Anything', desc: 'Chat with AI about any stock — earnings, targets, risks' },
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + i * 0.15, duration: 0.4 }}
            className="flex items-start gap-4 text-left p-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5" style={{ background: 'rgba(0,255,78,0.1)', border: '1px solid rgba(0,255,78,0.2)' }}>
              <feature.Icon size={18} className="text-[#00ff4e]" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-wider">{feature.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{feature.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        className="space-y-3"
      >
        <button
          onClick={() => {
            localStorage.setItem('jckrbbt_onboarded', 'true');
            setShowWelcome(false);
            setShowAuthModal(true);
            setTimeout(() => setTourStep(1), 600);
          }}
          className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-wider text-black transition-all active:scale-95 hover:opacity-90"
          style={{ backgroundColor: '#00ff4e', boxShadow: '0 0 30px rgba(0,255,78,0.3)' }}
        >
          Get Started — It's Free
        </button>
        <button
          onClick={() => {
            localStorage.setItem('jckrbbt_onboarded', 'true');
            setShowWelcome(false);
            setTimeout(() => setTourStep(1), 600);
          }}
          className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Explore First
        </button>
      </motion.div>

      {/* Disclaimer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.4 }}
        className="text-[9px] text-zinc-800 mt-8 leading-relaxed"
      >
        Not financial advice. For informational purposes only.<br />
        <a href="/terms" className="text-zinc-700 hover:text-zinc-500 underline">Terms of Service</a>
        {' · '}
        <a href="/privacy" className="text-zinc-700 hover:text-zinc-500 underline">Privacy Policy</a>
      </motion.p>
    </motion.div>
  </motion.div>
)}
</AnimatePresence>

{/* TOOLTIP TOUR */}
<AnimatePresence>
{tourStep > 0 && (() => {
  const steps = tourSteps.current;
  const step = steps[tourStep - 1];
  if (!step) return null;
  const rect = tourRect;

  return (
    <motion.div
      key={`tour-${tourStep}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[9998]"
      style={{ pointerEvents: 'auto' }}
      onClick={() => { 
        if (tourStep < steps.length) setTourStep(tourStep + 1); 
        else { setTourStep(0); localStorage.setItem('jckrbbt_tour_done', 'true'); }
      }}
    >
      {/* Single dimming layer - only show when no spotlight rect */}
      {!rect && <div className="absolute inset-0 bg-black/80" />}
      
      {/* Spotlight on target - this creates the dim + cutout in one layer */}
      {rect && (
        <div 
          className="absolute rounded-xl"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.80), 0 0 30px rgba(0,255,78,0.2)',
            border: '2px solid rgba(0,255,78,0.4)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: step.position === 'top' ? 10 : -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="absolute z-[10000] w-72 md:w-80"
        style={{
          ...(rect ? (step.position === 'bottom' ? {
            top: rect.top + rect.height + 22,
            left: Math.max(16, Math.min(rect.left + rect.width / 2 - 160, window.innerWidth - 336)),
          } : {
            bottom: window.innerHeight - rect.top + 22,
            left: Math.max(16, Math.min(rect.left + rect.width / 2 - 160, window.innerWidth - 336)),
          }) : {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }),
        }}
        onClick={e => e.stopPropagation()}
      >
        <div 
          className="p-4 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(40,40,40,0.98) 0%, rgba(15,15,15,0.99) 100%)',
            border: '1px solid rgba(0,255,78,0.2)',
            boxShadow: '0 0 40px rgba(0,0,0,0.5), 0 0 20px rgba(0,255,78,0.1)',
          }}
        >
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black text-[#00ff4e] uppercase tracking-[0.3em]">
              Step {tourStep} of {steps.length}
            </span>
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className="w-1.5 h-1.5 rounded-full transition-colors"
                  style={{ backgroundColor: i < tourStep ? '#00ff4e' : 'rgba(255,255,255,0.1)' }}
                />
              ))}
            </div>
          </div>

          <h4 className="text-sm font-black text-white mb-1">{step.title}</h4>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">{step.desc}</p>

          <div className="flex items-center justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); setTourStep(0); localStorage.setItem('jckrbbt_tour_done', 'true'); }}
              className="text-[10px] font-bold text-zinc-600 hover:text-zinc-400 uppercase tracking-wider transition-colors"
            >
              Skip Tour
            </button>
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                if (tourStep < steps.length) setTourStep(tourStep + 1); 
                else { setTourStep(0); localStorage.setItem('jckrbbt_tour_done', 'true'); }
              }}
              className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider text-black transition-all active:scale-95"
              style={{ backgroundColor: '#00ff4e' }}
            >
              {tourStep < steps.length ? 'Next' : 'Got It'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
})()}
</AnimatePresence>

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
        <img src="/jckrbbt_logo.png" alt="Logo" className="h-8 md:h-16 w-auto object-contain" />
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
    <div className="flex items-center gap-3 md:gap-6">
      {/* Search Icon */}
      <button
  onClick={() => setShowSearch(!showSearch)}
  className="mobile-header-btn md:p-3 md:rounded-lg md:border md:bg-black md:border-zinc-800 md:hover:border-zinc-700 transition-all active:scale-95"
>
        <Search size={18} className="md:w-5 md:h-5" />
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
      <SearchOverlay
        onClose={() => { setShowSearch(false); setUserSearchTerm(''); setSearchResults([]); }}
        userSearchTerm={userSearchTerm}
        setUserSearchTerm={setUserSearchTerm}
        searchResults={searchResults}
        setSearchResults={setSearchResults}
        loadingDiscover={loadingDiscover}
        handleSearchUsers={handleSearchUsers}
        handleViewUserProfile={handleViewUserProfile}
        publicWatchlists={publicWatchlists}
        setShowSearch={setShowSearch}
        onSelectStock={(sym) => { setSelectedStock(sym); setShowSearch(false); setUserSearchTerm(''); setSearchResults([]); }}
        polygonKey={POLYGON_KEY}
      />
    )}
  </AnimatePresence>
</header>


{/* Market Indices Bar */}
<div className="mb-6 md:mb-8">
<div className={`rounded-xl p-3 md:p-4 overflow-hidden transition-all duration-500 glass-card ${
    isMarketOpen
  ? 'md:border-2 md:border-[#00ff4e]/60'
  : ''
  }`} style={{background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)'}}>
    
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
        data-tour={tab.id === 'MY LISTS' ? 'lists-tab' : tab.id === 'MY POSITIONS' ? 'portfolio-tab' : undefined}
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
<div className="md:hidden mobile-bottom-nav">
  <div className="mobile-nav-inner">
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
          data-tour={tab.id === 'MY LISTS' ? 'lists-tab' : tab.id === 'MY POSITIONS' ? 'portfolio-tab' : undefined}
          onClick={() => setActiveTab(tab.id)}
          className={`mobile-nav-tab ${isActive ? 'active' : ''}`}
        >
          <Icon size={22} strokeWidth={isActive ? 2.2 : 1.5} className="nav-icon" />
          <span className="mobile-nav-label">{tab.label}</span>
          <span className="mobile-nav-dot" />
        </button>
      );
    })}
  </div>
</div>


{activeTab === "DASHBOARD" && (
  <div className="space-y-4 md:space-y-6 mb-6 md:mb-8">
    
    {/* Page Title */}
    <h1 className="text-2xl md:text-3xl font-black md:text-[#00ff4e] text-white uppercase tracking-tight flex items-center gap-3 mobile-page-title" style={{textShadow: '0 0 10px rgba(0,255,78,0.4)'}}>
  <LayoutDashboard size={28} className="md:w-8 md:h-8 text-[#00ff4e] page-title-icon" style={{filter: 'drop-shadow(0 0 8px rgba(0,255,78,0.5))'}} />Dashboard
</h1>

  <div className="p-4 md:p-5 rounded-xl" style={{background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)'}}>
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
      </div>

      <button 
        data-tour="scan-market"
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
      {(recentlyScanned.size > 0 || scanHistory.length > 0) && !loading && (
        <button
          onClick={async () => {
            setRecentlyScanned(new Set());
            localStorage.removeItem('recentlyScanned');
            setScanHistory([]);
            if (user?.uid && db) {
              try {
                const { doc, setDoc } = await import('firebase/firestore');
                const histRef = doc(db, 'users', user.uid, 'scanHistory', 'recent');
                await setDoc(histRef, { scans: [] });
              } catch (e) {
                console.error('Failed to clear Firebase scan history:', e);
              }
            }
          }}
          className="w-full text-zinc-600 hover:text-zinc-400 text-[10px] font-bold tracking-wider uppercase transition-colors py-1"
        >
          CLEAR SCAN HISTORY ({recentlyScanned.size + scanHistory.filter(s => new Date(s.timestamp) > new Date(Date.now() - 24*60*60*1000)).length} tickers)
        </button>
      )}
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
        Scan History ({scanHistory.filter(s => new Date(s.timestamp) > new Date(Date.now() - 24*60*60*1000)).length} in 24hr){scanAccuracy.stats ? ` • ${scanAccuracy.stats.hitRate}% hit rate` : ''}
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
              const age = Date.now() - new Date(scan.timestamp).getTime();
              const timeAgo = (() => {
                const diff = age;
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                return `${Math.floor(hrs / 24)}d ago`;
              })();
              const change = parseFloat(scan.change);
              const acc = scanAccuracy.byTicker[scan.symbol];
              const hasResult = acc && age > 60 * 60 * 1000; // 1h+ old
              
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
                    {/* Accuracy dot */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      hasResult 
                        ? (Math.abs(acc.pctChange) >= 2 
                          ? (acc.hit ? 'bg-[#00ff4e]' : 'bg-yellow-500') 
                          : 'bg-zinc-700')
                        : 'bg-zinc-800'
                    }`} title={hasResult ? `${acc.pctChange >= 0 ? '+' : ''}${acc.pctChange.toFixed(1)}% since detected` : 'Pending'} />
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-white">{scan.symbol}</span>
                      <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">{scan.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm font-black text-white">${scan.price}</span>
                      <span className={`text-xs font-bold ml-2 ${change >= 0 ? 'text-[#00ff4e]' : 'text-[#FF4B2B]'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                      </span>
                    </div>
                    {hasResult ? (
                      <div className="flex flex-col items-end min-w-[52px]">
                        <span className={`text-[10px] font-black ${acc.pctChange >= 0 ? 'text-[#00ff4e]' : 'text-[#FF4B2B]'}`}>
                          {acc.pctChange >= 0 ? '+' : ''}{acc.pctChange.toFixed(1)}%
                        </span>
                        <span className="text-[8px] text-zinc-600">{timeAgo}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end min-w-[52px]">
                        <span className={`text-[9px] font-bold ${isRecent ? 'text-[#00ff4e]' : 'text-zinc-600'}`}>
                          {timeAgo}
                        </span>
                        {age < 60 * 60 * 1000 && (
                          <span className="text-[8px] text-zinc-700 uppercase">tracking</span>
                        )}
                      </div>
                    )}
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
        onAddToList={(stock) => setAddToListStock(stock)}
        onSetAlert={(stock) => setAlertStock(stock)}
        user={user}
        onOpenChat={(stock) => setShowStockChat(stock)}
        onOpenDetail={(sym) => setSelectedStock(sym)}
        onScanSimilar={handleScanSimilar}
        aiModel={aiModel}
        connectedBrokerages={connectedBrokerages}
  db={db}
      />
    ))}
  </div>
)}

  
  </div>
)}


{/* SORT & FILTER BAR */}
      {activeTab === "DASHBOARD" && stocks.length > 0 && (
<div className="rounded-lg p-3 md:p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4" style={{background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)'}}>          <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
            Filters:
          </span>
          
          <div className="grid grid-cols-1 sm:flex gap-2 md:gap-4 w-full sm:w-auto">
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
                { value: 'early_signal', label: 'Early Signal' },
                { value: 'pre_move', label: '🎯 Pre-Move' },
                { value: 'news', label: 'News' },
                { value: 'bullish', label: '▲ Bullish' },
                { value: 'bearish', label: '▼ Bearish' },
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
          <div className="sm:ml-auto flex items-center gap-1.5">
            <button
              onClick={generateShareImage}
              title="Download as image"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff4e]/10 border border-[#00ff4e]/30 hover:bg-[#00ff4e]/20 rounded-md text-[#00ff4e] text-[10px] md:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap"
            >
              <Share2 size={12} />
              <span className="hidden sm:inline">Image</span>
            </button>
            <button
              onClick={copyForReddit}
              title="Copy for Reddit"
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-[10px] md:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${copiedReddit ? 'bg-[#00ff4e]/20 border-[#00ff4e]/50 text-[#00ff4e]' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'}`}
            >
              {copiedReddit ? <Check size={12} /> : <Copy size={12} />}
              <span className="hidden sm:inline">{copiedReddit ? 'Copied!' : 'Reddit'}</span>
            </button>
            <button
              onClick={copyForTwitter}
              title="Copy for X/Twitter"
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-[10px] md:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${copiedTwitter ? 'bg-[#00ff4e]/20 border-[#00ff4e]/50 text-[#00ff4e]' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'}`}
            >
              {copiedTwitter ? <Check size={12} /> : <Copy size={12} />}
              <span className="hidden sm:inline">{copiedTwitter ? 'Copied!' : '𝕏'}</span>
            </button>
          </div>
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

{/* ACCURACY BANNER */}
{!isManualResult && !loading && scanComplete && stocks.length > 0 && scanAccuracy.stats && (
  <div className="mb-4 px-4 py-3 rounded-lg border" style={{ 
    background: 'linear-gradient(135deg, rgba(0,255,78,0.03) 0%, rgba(0,0,0,0.4) 100%)',
    borderColor: 'rgba(0,255,78,0.15)'
  }}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#00ff4e] animate-pulse" />
        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-400">
          Scanner Accuracy
        </span>
      </div>
      <span className="text-[9px] text-zinc-600">
        Last {scanAccuracy.stats.totalChecked} picks (4h+ old)
      </span>
    </div>
    <div className="flex items-center gap-4 mt-2">
      <div className="flex items-center gap-2">
        <span className="text-xl md:text-2xl font-black text-[#00ff4e]">
          {scanAccuracy.stats.hitRate}%
        </span>
        <span className="text-[10px] text-zinc-500 leading-tight">
          moved 2%+<br/>after detection
        </span>
      </div>
      <div className="w-px h-8 bg-zinc-800" />
      <div className="flex items-center gap-2">
        <span className="text-xl md:text-2xl font-black text-white">
          {scanAccuracy.stats.hit2pct}/{scanAccuracy.stats.totalChecked}
        </span>
        <span className="text-[10px] text-zinc-500 leading-tight">
          picks hit<br/>2%+ move
        </span>
      </div>
      {scanAccuracy.stats.directionalRate > 0 && (
        <>
          <div className="w-px h-8 bg-zinc-800 hidden md:block" />
          <div className="items-center gap-2 hidden md:flex">
            <span className="text-xl md:text-2xl font-black text-white">
              {scanAccuracy.stats.directionalRate}%
            </span>
            <span className="text-[10px] text-zinc-500 leading-tight">
              correct<br/>direction
            </span>
          </div>
        </>
      )}
    </div>
  </div>
)}

{!isManualResult && displayedStocks.map((stock, index) => {
  const acc = scanAccuracy.byTicker[stock.symbol];
  return (
    <div key={stock.symbol}>
      {acc && (
        <div className="flex items-center gap-2 mb-2 px-3">
          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Since detected</span>
          <span className={`text-xs font-black ${acc.pctChange >= 0 ? 'text-[#00ff4e]' : 'text-[#FF4B2B]'}`}>
            {acc.pctChange >= 0 ? '↑' : '↓'} {acc.pctChange >= 0 ? '+' : ''}{acc.pctChange.toFixed(2)}%
          </span>
          <span className="text-[9px] text-zinc-700">
            from ${acc.entryPrice.toFixed(2)} → ${acc.currentPrice.toFixed(2)}
          </span>
          {Math.abs(acc.pctChange) >= 2 && (
            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${acc.hit ? 'bg-[#00ff4e]/10 text-[#00ff4e] border border-[#00ff4e]/20' : 'bg-[#FF4B2B]/10 text-[#FF4B2B] border border-[#FF4B2B]/20'}`}>
              {acc.hit ? '✓ Hit' : 'Moved'}
            </span>
          )}
        </div>
      )}
    <MetricCard 
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
      onAddToList={(stock) => setAddToListStock(stock)}
      onSetAlert={(stock) => setAlertStock(stock)}
      user={user}
      onOpenChat={(stock) => setShowStockChat(stock)}
        onOpenDetail={(sym) => setSelectedStock(sym)}
      onScanSimilar={handleScanSimilar}
       aiModel={aiModel}
  db={db}
  connectedBrokerages={connectedBrokerages}
    />
    </div>
  );
})}

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
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={generateShareImage}
          title="Download as image"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#00ff4e]/10 border border-[#00ff4e]/30 hover:bg-[#00ff4e]/20 rounded-lg text-[#00ff4e] text-xs font-bold uppercase tracking-wider transition-all"
        >
          <Share2 size={13} />
          Image
        </button>
        <button
          onClick={copyForReddit}
          title="Copy for Reddit"
          className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${copiedReddit ? 'bg-[#00ff4e]/20 border-[#00ff4e]/50 text-[#00ff4e]' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'}`}
        >
          {copiedReddit ? <Check size={13} /> : <Copy size={13} />}
          {copiedReddit ? 'Copied!' : 'Reddit'}
        </button>
        <button
          onClick={copyForTwitter}
          title="Copy for X/Twitter"
          className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${copiedTwitter ? 'bg-[#00ff4e]/20 border-[#00ff4e]/50 text-[#00ff4e]' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'}`}
        >
          {copiedTwitter ? <Check size={13} /> : <Copy size={13} />}
          {copiedTwitter ? 'Copied!' : '𝕏'}
        </button>
      </div>
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
        <Newspaper size={16} className={`${showDashboardNews ? 'text-[#00ff4e]' : 'text-zinc-600 group-hover:text-zinc-400'} transition-colors`} />
<span className={`text-sm md:text-3xl font-semibold md:font-black uppercase tracking-wider md:tracking-tight ${showDashboardNews ? 'text-[#00ff4e]' : 'text-zinc-400 md:text-white group-hover:text-zinc-300'} transition-colors`}>Market News
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
                <NewsCard key={article.id} article={article} aiModel={aiModel} />
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
                    <NewsCard key={article.id} article={article} aiModel={aiModel} />
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
      <div className="p-4 rounded-xl" style={{background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)'}}>
        <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">
          Find Users
        </h3>
        <input
          type="text"
          placeholder="Search by username..."
          value={userSearchTerm}
          onChange={(e) => handleSearchUsers(e.target.value)}
          className="w-full bg-black/50 border border-zinc-700/50 text-white px-4 py-3 rounded-lg outline-none transition-all font-mono text-sm placeholder:text-zinc-600 focus:border-[#00ff4e]/50"
        />
        
        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map(searchUser => (
              <div
                key={searchUser.id}
                className="flex items-center justify-between p-3 bg-black/70 border border-zinc-700 rounded-lg hover:border-[#00ff4e]/50 transition-all cursor-pointer"
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
              className="rounded-xl p-6 transition-all duration-300"
              style={{background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)'}}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)'; e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.08)'; }}
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
                      className="text-xs font-black bg-black/70 text-[#00ff4e] px-3 py-1 rounded border border-zinc-700 uppercase"
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
<h1 className="text-2xl md:text-3xl font-black md:text-[#00ff4e] text-white uppercase tracking-tight flex items-center gap-3 mobile-page-title" style={{textShadow: '0 0 10px rgba(0,255,78,0.4)'}}> <Flame size={28} className="md:w-8 md:h-8 text-[#00ff4e] page-title-icon" style={{filter: 'drop-shadow(0 0 8px rgba(0,255,78,0.5))'}} />Trending
</h1>

    {/* Interval Filter */}
    <div className="mb-6">
      <div className="p-4 rounded-xl" style={{background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)'}}>
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
                  : 'bg-black text-zinc-500 hover:text-white border border-zinc-800'
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
            className="rounded-xl p-6 transition-all duration-300 cursor-pointer glass-card mobile-trending-card"
            style={{background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)'}}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)'; e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.08)'; }}
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
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight cursor-pointer hover:text-[#00ff4e] transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedStock(stock.symbol); }}>{stock.symbol}</h3>
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
    {/* ── Header ── */}
    <h1 className="text-2xl md:text-3xl font-black md:text-[#00ff4e] text-white uppercase tracking-tight flex items-center gap-3 mobile-page-title" style={{textShadow: '0 0 10px rgba(0,255,78,0.4)'}}>
      <List size={28} className="md:w-8 md:h-8 text-[#00ff4e] page-title-icon" style={{filter: 'drop-shadow(0 0 8px rgba(0,255,78,0.5))'}} />Lists
    </h1>

    {!user ? (
      <>
        <div
          onClick={() => setShowAuthModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: 'rgba(0,255,78,0.04)', border: '1px solid rgba(0,255,78,0.12)', marginBottom: 20, cursor: 'pointer' }}
        >
          <LogIn size={16} color="#00ff4e" />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 12, color: '#888', flex: 1 }}>Sign in to create and manage watchlists</span>
          <ChevronRight size={16} color="#333" />
        </div>
        <div style={{ paddingTop: 80, paddingBottom: 80, textAlign: 'center', border: '2px dashed #1a1a1a', borderRadius: 12, opacity: 0.6 }}>
          <List size={32} color="#333" style={{ marginBottom: 16 }} />
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 14, color: '#8a8a8a', marginBottom: 8 }}>No Lists Yet</p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 12, color: '#737373' }}>Sign in to create your first watchlist.</p>
        </div>
      </>
    ) : (
      <>
        {/* ── Create Button ── */}
        <button
          onClick={() => { setShowListsCreate(v => !v); setListsNewName(''); setListsNewDesc(''); setListsNewPublic(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#00ff4e', paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, borderRadius: 12, border: 'none', cursor: 'pointer', marginBottom: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: '#000', textTransform: 'uppercase', letterSpacing: 0.5 }}
        >
          {showListsCreate ? <X size={16} color="#000" /> : <Plus size={16} color="#000" />}
          {showListsCreate ? 'Cancel' : 'Create New List'}
        </button>

        {/* ── Inline Create Form ── */}
        {showListsCreate && (
          <div className="mobile-create-form" style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 20, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)', padding: 16 }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 10, color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>List Name</p>
              <input
                value={listsNewName}
                onChange={e => setListsNewName(e.target.value)}
                placeholder="e.g. Meme Stocks"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 14, color: '#fff', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px', marginBottom: 12, width: '100%', boxSizing: 'border-box', outline: 'none' }}
              />
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 10, color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>Description (optional)</p>
              <input
                value={listsNewDesc}
                onChange={e => setListsNewDesc(e.target.value)}
                placeholder="What's this list about?"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 14, color: '#fff', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px', marginBottom: 12, width: '100%', boxSizing: 'border-box', outline: 'none' }}
              />
              <div
                onClick={() => setListsNewPublic(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}
              >
                <div style={{ width: 20, height: 20, borderRadius: 4, border: listsNewPublic ? 'none' : '2px solid #333', backgroundColor: listsNewPublic ? '#00ff4e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {listsNewPublic && <Check size={12} color="#000" />}
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 12, color: '#888' }}>Make this list public</span>
              </div>
              <button
                onClick={async () => {
                  if (!listsNewName.trim()) return;
                  try {
                    await handleCreateWatchlist({ name: listsNewName.trim(), description: listsNewDesc.trim(), isPublic: listsNewPublic });
                    setShowListsCreate(false);
                    setListsNewName(''); setListsNewDesc(''); setListsNewPublic(false);
                  } catch (e) { alert('Failed to create list'); }
                }}
                style={{ backgroundColor: '#00ff4e', borderRadius: 10, paddingTop: 14, paddingBottom: 14, width: '100%', border: 'none', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 14, color: '#000', textTransform: 'uppercase', letterSpacing: 2 }}
              >
                Create List
              </button>
          </div>
        )}

        {/* ── My Watchlists ── */}
        {watchlists.length === 0 ? (
          <div style={{ paddingTop: 80, paddingBottom: 80, textAlign: 'center', border: '2px dashed #1a1a1a', borderRadius: 12, opacity: 0.6 }}>
            <List size={32} color="#333" style={{ marginBottom: 16 }} />
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 14, color: '#8a8a8a', marginBottom: 8 }}>No Lists Yet</p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 12, color: '#737373' }}>Create your first watchlist to start tracking stocks.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {watchlists.map((list) => {
              const isExpanded = expandedListId === list.id;
              return (
                <div key={list.id} className="mobile-list-card" style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)', padding: 16 }}>
                    {/* List header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span
                            onClick={() => { setExpandedListId(isExpanded ? null : list.id); setSelectedWatchlist(isExpanded ? null : list); }}
                            style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 18, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer' }}
                          >{list.name}</span>
                          <span style={{ padding: '3px 8px', borderRadius: 4, border: list.isPublic ? '1px solid rgba(0,255,78,0.2)' : '1px solid rgba(255,255,255,0.06)', backgroundColor: list.isPublic ? 'rgba(0,255,78,0.06)' : 'rgba(255,255,255,0.03)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, color: list.isPublic ? '#00ff4e' : '#8a8a8a' }}>
                            {list.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>
                        {list.description && <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 13, color: '#71717a', marginBottom: 4 }}>{list.description}</p>}
                        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 12, color: '#737373', marginTop: 2 }}>{list.stocks?.length || 0} stocks</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => { navigator.share ? navigator.share({ text: `${list.name} — ${list.stocks?.length || 0} stocks on jckrbbt.io` }) : navigator.clipboard?.writeText(`${list.name} on jckrbbt.io`); }} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#8a8a8a' }} title="Share">
                          <Share size={14} />
                        </button>
                        <button onClick={() => handleDeleteWatchlist(list.id)} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#8a8a8a' }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => { setExpandedListId(isExpanded ? null : list.id); setSelectedWatchlist(isExpanded ? null : list); }}
                          style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 10, color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: 1, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          {isExpanded ? 'Hide ▲' : 'View ▼'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded stocks */}
                    {isExpanded && (
                      <div style={{ marginTop: 12 }}>
                        {list.stocks?.length === 0 ? (
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 12, color: '#333', textAlign: 'center', paddingTop: 20, paddingBottom: 20 }}>No stocks in this list yet. Scan a stock and add it!</p>
                        ) : (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                              {list.stocks.map((stock) => {
                                const wsData = livePrices?.[stock.symbol];
                                const snapData = watchlistPrices?.[stock.symbol];
                                const currentPrice = wsData?.price ?? snapData?.price ?? parseFloat(stock.price || 0);
                                const prevClose = snapData?.prevClose ?? (stock.prevClose ? parseFloat(stock.prevClose) : null);
                                const dayChange = prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : parseFloat(stock.change || 0);
                                const addedPrice = parseFloat(stock.addedPrice || stock.price || 0);
                                const sinceAdded = addedPrice > 0 && currentPrice > 0 ? ((currentPrice - addedPrice) / addedPrice) * 100 : null;
                                const addedAgo = stock.addedAt ? (() => {
                                  const diff = Date.now() - new Date(stock.addedAt).getTime();
                                  const mins = Math.floor(diff / 60000);
                                  if (mins < 60) return `${mins}m`;
                                  const hrs = Math.floor(mins / 60);
                                  if (hrs < 24) return `${hrs}h`;
                                  const days = Math.floor(hrs / 24);
                                  if (days < 30) return `${days}d`;
                                  return `${Math.floor(days / 30)}mo`;
                                })() : null;
                                return (
                                  <div
                                    key={stock.symbol}
                                    onClick={() => setSelectedStock(stock.symbol)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, cursor: 'pointer' }}
                                  >
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 14, color: '#fff' }}>{stock.symbol}</span>
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 14, color: '#fff' }}>${currentPrice.toFixed(2)}</span>
                                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 12, color: dayChange >= 0 ? '#00ff4e' : '#FF4B2B' }}>{dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)}%</span>
                                      </div>
                                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 10, color: '#8a8a8a', marginTop: 2, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                                      {sinceAdded !== null && (
                                        <div style={{ textAlign: 'right' }}>
                                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 10, color: sinceAdded >= 0 ? '#00ff4e' : '#FF4B2B' }}>{sinceAdded >= 0 ? '+' : ''}{sinceAdded.toFixed(1)}%</p>
                                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 8, color: '#737373', textTransform: 'uppercase' }}>{addedAgo ? `since ${addedAgo}` : 'since add'}</p>
                                        </div>
                                      )}
                                      <button
                                        onClick={() => removeStockFromList(list.id, stock.symbol)}
                                        style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#737373' }}
                                        title="Remove"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {list.stocks?.length > 5 && (
                              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 9, color: '#737373', textAlign: 'center', marginTop: 8, letterSpacing: 1 }}>↕ Scroll · {list.stocks.length} stocks</p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Lists I Follow ── */}
        {followedListsData.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Heart size={16} color="#a1a1aa" />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600 }}>Following</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {followedListsData.map((list) => {
                const isExpanded = expandedListId === list.id;
                return (
                  <div key={list.id} className="mobile-list-card" style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)', padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span
                              onClick={() => { setExpandedListId(isExpanded ? null : list.id); setSelectedWatchlist(isExpanded ? null : list); }}
                              style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 18, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer' }}
                            >{list.name}</span>
                          </div>
                          {list.description && <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 13, color: '#71717a', marginBottom: 4 }}>{list.description}</p>}
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 12, color: '#737373', marginTop: 2 }}>{list.stocks?.length || 0} stocks · by {list.ownerUsername || 'Anonymous'} · {list.followerCount || 0} followers</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={async () => {
                              if (!window.confirm('Unfollow this list?')) return;
                              try {
                                const { toggleFollowWatchlist } = await import('./watchlistService');
                                await toggleFollowWatchlist(user.uid, list.id, false);
                                setFollowedLists(prev => prev.filter(id => id !== list.id));
                              } catch (e) { console.error('Unfollow error:', e); }
                            }}
                            style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#FF4B2B' }}
                            title="Unfollow"
                          >
                            <Heart size={14} fill="#FF4B2B" />
                          </button>
                          <button
                            onClick={() => { setExpandedListId(isExpanded ? null : list.id); setSelectedWatchlist(isExpanded ? null : list); }}
                            style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 10, color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: 1, background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            {isExpanded ? 'Hide ▲' : 'View ▼'}
                          </button>
                        </div>
                      </div>

                      {isExpanded && list.stocks && (
                        <div style={{ marginTop: 12 }}>
                          {list.stocks.length === 0 ? (
                            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 12, color: '#333', textAlign: 'center', paddingTop: 20, paddingBottom: 20 }}>No stocks in this list yet.</p>
                          ) : (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                                {list.stocks.map((stock) => {
                                  const wsData = livePrices?.[stock.symbol];
                                  const snapData = watchlistPrices?.[stock.symbol];
                                  const currentPrice = wsData?.price ?? snapData?.price ?? parseFloat(stock.price || 0);
                                  const prevClose = snapData?.prevClose ?? (stock.prevClose ? parseFloat(stock.prevClose) : null);
                                  const dayChange = prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : parseFloat(stock.change || 0);
                                  return (
                                    <div
                                      key={stock.symbol}
                                      onClick={() => setSelectedStock(stock.symbol)}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, cursor: 'pointer' }}
                                    >
                                      <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 14, color: '#fff' }}>{stock.symbol}</span>
                                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 14, color: '#fff' }}>${currentPrice.toFixed(2)}</span>
                                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: 12, color: dayChange >= 0 ? '#00ff4e' : '#FF4B2B' }}>{dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)}%</span>
                                        </div>
                                        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 10, color: '#8a8a8a', marginTop: 2, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {list.stocks.length > 5 && (
                                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, fontSize: 9, color: '#737373', textAlign: 'center', marginTop: 8, letterSpacing: 1 }}>↕ Scroll · {list.stocks.length} stocks</p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                </div>
                );
              })}
            </div>
          </div>
        )}


      </>
    )}
  </>

) : activeTab === "FEED" ? (
  <>
<h1 className="text-2xl md:text-3xl font-black md:text-[#00ff4e] text-white uppercase tracking-tight flex items-center gap-3 mobile-page-title" style={{textShadow: '0 0 10px rgba(0,255,78,0.4)'}}> <Activity size={28} className="md:w-8 md:h-8 text-[#00ff4e] page-title-icon" style={{filter: 'drop-shadow(0 0 8px rgba(0,255,78,0.5))'}} />Feed
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
                      onClick={() => setSelectedStock(activity.targetSymbol)}
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
              className="rounded-xl p-4 transition-all duration-300 glass-card mobile-feed-card"
              style={{background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)'}}
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
                      setSelectedStock(activity.targetSymbol);
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
<h1 className="text-2xl md:text-3xl font-black md:text-[#00ff4e] text-white uppercase tracking-tight flex items-center gap-3 mobile-page-title" style={{textShadow: '0 0 10px rgba(0,255,78,0.4)'}}>  <Briefcase size={28} className="md:w-8 md:h-8 text-[#00ff4e] page-title-icon" style={{filter: 'drop-shadow(0 0 8px rgba(0,255,78,0.5))'}} />Portfolio
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
        <div className="rounded-xl p-4 md:p-6 mb-6" style={{background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)'}}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
<h3 
  className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-2 cursor-pointer flex items-center gap-2"
  onClick={() => setAccountsExpanded(!accountsExpanded)}
>
  Connected Accounts
  <ChevronDown size={14} className={`transition-transform ${accountsExpanded ? 'rotate-180' : ''}`} />
</h3>              <p className="text-xs text-zinc-600">
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
  <div 
    style={{
      maxHeight: accountsExpanded ? '1000px' : '0px',
      opacity: accountsExpanded ? 1 : 0,
      overflow: 'hidden',
      transition: 'max-height 0.3s ease, opacity 0.2s ease'
    }}
  >
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

<PortfolioPerformanceChart 
  positions={positions} 
  polygonKey={POLYGON_KEY} 
  user={user} 
  db={db} 
  livePrices={livePrices}
  brokerageName={connectedBrokerages.find(b => b.id === selectedBrokerage)?.name || 'Portfolio'}
  onRefresh={() => fetchAllPositions()}
  refreshing={loadingPositions}
/>

<PortfolioAnalytics 
  positions={positions} 
  polygonKey={POLYGON_KEY} 
/>                
                  {/* Sort Bar */}
<div className="rounded-lg p-3 md:p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4" style={{background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)'}}>
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                      Sort:
                    </span>
                    <div className="grid grid-cols-1 sm:flex gap-2 md:gap-4 w-full sm:w-auto">
                      <CustomDropdown
                        value={positionSortBy}
                        onChange={setPositionSortBy}
                        label="Sort"
                        options={[
                          { value: 'value-high', label: 'Value ↓' },
                          { value: 'value-low', label: 'Value ↑' },
                          { value: 'gain-high', label: 'Gain % ↓' },
                          { value: 'gain-low', label: 'Gain % ↑' },
                          { value: 'price-high', label: 'Price ↓' },
                          { value: 'price-low', label: 'Price ↑' },
                          { value: 'alpha', label: 'A → Z' },
                        ]}
                      />
                    </div>
                    {positionSortBy !== 'value-high' && (
                      <button
                        onClick={() => setPositionSortBy('value-high')}
                        className="text-zinc-500 hover:text-[#00ff4e] text-[10px] md:text-xs font-black uppercase tracking-wider transition-colors whitespace-nowrap"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                {/* Position Cards */}
                {sortedPositions.map((position, index) => {
                  const isPositionAdded = flattenedWatchlist.some(s => s.symbol === position.symbol);
                  const isHoveringThisPosition = hoveringPositionSymbol === position.symbol;
                  
                  return (
                    <PositionCard
                      editingCostBasis={editingCostBasis}
                      setEditingCostBasis={setEditingCostBasis}
                      costBasisInput={costBasisInput}
                      setCostBasisInput={setCostBasisInput}
                      saveCostBasisOverride={saveCostBasisOverride}
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
                      isMarketOpen={isMarketOpen}
                      connectedBrokerages={connectedBrokerages}
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
        <NewsCard key={article.id} article={article} aiModel={aiModel} />
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
      userAvatar: userProfile?.profilePicUrl || user.photoURL,
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

{/* ADD TO LIST MODAL */}
<AddToListModal
  visible={!!addToListStock}
  onClose={() => setAddToListStock(null)}
  stock={addToListStock}
  user={user}
  db={db}
  userProfile={userProfile}
  watchlists={watchlists}
  setWatchlists={setWatchlists}
  addStockToWatchlist={addStockToWatchlist}
  createWatchlist={createWatchlist}
  getUserWatchlists={getUserWatchlists}
  logActivity={logActivity}
/>

{/* PRICE ALERT MODAL */}
<PriceAlertModal
  visible={!!alertStock}
  onClose={() => setAlertStock(null)}
  symbol={alertStock?.symbol || alertStock?.ticker}
  companyName={alertStock?._company?.name || alertStock?.name || alertStock?.companyName || alertStock?.symbol}
  currentPrice={parseFloat(alertStock?.price) || 0}
  user={user}
  createPriceAlert={async (uid, data) => {
    const { doc, setDoc, collection } = await import('firebase/firestore');
    const ref = doc(collection(db, 'users', uid, 'priceAlerts'));
    await setDoc(ref, { ...data, createdAt: new Date().toISOString(), active: true, id: ref.id });
  }}
  getSymbolAlerts={async (uid, sym) => {
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const q = query(collection(db, 'users', uid, 'priceAlerts'), where('symbol', '==', sym), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }}
  deletePriceAlert={async (uid, alertId) => {
    const { doc, deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'users', uid, 'priceAlerts', alertId));
  }}
/>

{/* STOCK DETAIL PAGE */}
{selectedStock && (
  <StockDetailPage
    symbol={selectedStock}
    onClose={() => setSelectedStock(null)}
    polygonKey={POLYGON_KEY}
    finnhubKey={FINNHUB_KEY}
    aiModel={aiModel}
    user={user}
    isMarketOpen={isMarketOpen}
    onOpenDetail={(sym) => setSelectedStock(sym)}
    onAddToList={(stock) => setAddToListStock(stock)}
    onSetAlert={(stock) => setAlertStock(stock)}
    watchlists={watchlists}
    flattenedWatchlist={flattenedWatchlist}
    addStockToList={addStockToList}
  />
)}

{/* STOCK CHAT MODAL */}
<StockChatModal
  isOpen={!!showStockChat}
  onClose={() => setShowStockChat(null)}
  stock={showStockChat}
  aiModel={aiModel}
/>

{/* Footer */}
<footer className="mt-16 pt-8 border-t-2 border-zinc-900 text-center flex items-center justify-center gap-4 md:gap-6">
  <a 
    href="/privacy"
    className="text-zinc-600 hover:text-[#00ff4e] text-xs font-bold uppercase tracking-wider transition-colors"
  >
    Privacy Policy
  </a>
  <span className="text-zinc-800">•</span>
  <a 
    href="/terms"
    className="text-zinc-600 hover:text-[#00ff4e] text-xs font-bold uppercase tracking-wider transition-colors"
  >
    Terms of Service
  </a>
</footer>

    </div>
  );
}
// ============================================================
// STOCK DETAIL PAGE
// Full-screen overlay — mirrors [symbol].js from the native app
// ============================================================

// ─── SearchOverlay ─────────────────────────────────────────────────────────────
function SearchOverlay({
  onClose, userSearchTerm, setUserSearchTerm, searchResults, setSearchResults,
  loadingDiscover, handleSearchUsers, handleViewUserProfile,
  publicWatchlists, setShowSearch, onSelectStock, polygonKey,
}) {
  const [stockResults, setStockResults]   = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const searchTimeoutRef                   = React.useRef(null);
  const inputRef                           = React.useRef(null);

  React.useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleInput = (raw) => {
    const value = raw.toUpperCase();
    setUserSearchTerm(value);
    clearTimeout(searchTimeoutRef.current);
    if (value.length < 1) { setStockResults([]); setSearchResults([]); return; }
    if (value.length >= 2) handleSearchUsers(value);
    else setSearchResults([]);
    setLoadingStocks(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const [tickerRes, nameRes] = await Promise.all([
          fetch(`https://api.polygon.io/v3/reference/tickers?ticker=${value}&active=true&limit=1&apiKey=${polygonKey}`),
          fetch(`https://api.polygon.io/v3/reference/tickers?search=${value}&active=true&market=stocks&limit=8&apiKey=${polygonKey}`),
        ]);
        const [td, nd] = await Promise.all([tickerRes.json(), nameRes.json()]);
        const seen = new Set(); const combined = [];
        (td.results || []).forEach(r => { if (!seen.has(r.ticker)) { seen.add(r.ticker); combined.push(r); } });
        const sorted = (nd.results || []).sort((a, b) => {
          if (a.ticker.startsWith(value) && !b.ticker.startsWith(value)) return -1;
          if (b.ticker.startsWith(value) && !a.ticker.startsWith(value)) return 1;
          return a.ticker.length - b.ticker.length;
        });
        sorted.forEach(r => { if (!seen.has(r.ticker)) { seen.add(r.ticker); combined.push(r); } });
        setStockResults(combined.slice(0, 6));
      } catch (e) { setStockResults([]); }
      setLoadingStocks(false);
    }, 300);
  };

  const hasQuery = userSearchTerm.length > 0;
  const hasStocks = stockResults.length > 0;
  const hasUsers  = searchResults.length > 0;

  return ReactDOM.createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      className="mobile-search-overlay" style={{ position: 'fixed', inset: 0, zIndex: 9990, backgroundColor: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Search bar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '10px 14px', border: '0.5px solid rgba(255,255,255,0.08)' }}>
          <Search size={16} color="#00ff4e" style={{ flexShrink: 0 }} />
          <input ref={inputRef} value={userSearchTerm} onChange={e => handleInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && stockResults.length > 0) onSelectStock(stockResults[0].ticker); }}
            placeholder="Search stocks & users..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 16, caretColor: '#00ff4e', fontFamily: 'JetBrains Mono, monospace' }} />
          {userSearchTerm && (
            <button onClick={() => { setUserSearchTerm(''); setStockResults([]); setSearchResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
              <X size={16} color="#555" />
            </button>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00ff4e', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.5, flexShrink: 0 }}>Cancel</button>
      </div>

      {/* Results */}
      <div style={{ flex: 1, padding: '12px 16px' }}>
        {/* Stocks */}
        {(loadingStocks || hasStocks) && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 10, color: '#555', letterSpacing: 2, fontFamily: 'JetBrains Mono, monospace', marginBottom: 8, textTransform: 'uppercase' }}>Stocks</p>
            {loadingStocks && !hasStocks ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#555', fontSize: 12, fontFamily: 'monospace' }}>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(0,255,78,0.2)', borderTopColor: '#00ff4e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Searching...
              </div>
            ) : stockResults.map(r => (
              <button key={r.ticker} onClick={() => onSelectStock(r.ticker)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 14px', marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.08)', cursor: 'pointer', textAlign: 'left' }}>
                <div>
                  <p style={{ fontSize: 15, fontFamily: 'JetBrains Mono, monospace', color: '#00ff4e', fontWeight: 700, margin: 0 }}>{r.ticker}</p>
                  <p style={{ fontSize: 11, color: '#8a8a8a', margin: '2px 0 0', fontFamily: 'JetBrains Mono, monospace' }}>{r.name}</p>
                </div>
                <ArrowUpRight size={14} color="#333" />
              </button>
            ))}
          </div>
        )}
        {/* Users */}
        {hasQuery && (hasUsers || loadingDiscover) && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 10, color: '#555', letterSpacing: 2, fontFamily: 'JetBrains Mono, monospace', marginBottom: 8, textTransform: 'uppercase' }}>Users</p>
            {loadingDiscover && !hasUsers ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: '#555', fontSize: 12, fontFamily: 'monospace' }}>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(0,255,78,0.2)', borderTopColor: '#00ff4e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Searching...
              </div>
            ) : searchResults.map(u => (
              <button key={u.id} onClick={() => { handleViewUserProfile(u.id); onClose(); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 14px', marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.08)', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {u.profilePicUrl
                    ? <img src={u.profilePicUrl} alt={u.username} style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover' }} />
                    : <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={16} color="#555" /></div>
                  }
                  <div>
                    <p style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: '#fff', fontWeight: 700, margin: 0 }}>{u.username}</p>
                    <p style={{ fontSize: 11, color: '#555', margin: '2px 0 0', fontFamily: 'JetBrains Mono, monospace' }}>{u.followerCount || 0} followers</p>
                  </div>
                </div>
                {u.watchlistCount > 0 && <span style={{ fontSize: 10, padding: '3px 8px', backgroundColor: 'rgba(0,255,78,0.08)', color: '#00ff4e', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace' }}>{u.watchlistCount} {u.watchlistCount === 1 ? 'list' : 'lists'}</span>}
              </button>
            ))}
          </div>
        )}
        {/* No results */}
        {hasQuery && !loadingStocks && !loadingDiscover && !hasStocks && !hasUsers && (
          <div style={{ paddingTop: 48, textAlign: 'center', color: '#333', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>No results for "{userSearchTerm}"</div>
        )}
        {/* Empty — popular watchlists */}
        {!hasQuery && publicWatchlists.length > 0 && (
          <div>
            <p style={{ fontSize: 10, color: '#555', letterSpacing: 2, fontFamily: 'JetBrains Mono, monospace', marginBottom: 8, textTransform: 'uppercase' }}>Popular Watchlists</p>
            {publicWatchlists.slice(0, 5).map(list => (
              <button key={list.id} onClick={() => { handleViewUserProfile(list.ownerId); onClose(); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 14px', marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.08)', cursor: 'pointer', textAlign: 'left' }}>
                <div>
                  <p style={{ fontSize: 14, color: '#fff', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, margin: 0 }}>{list.name}</p>
                  <p style={{ fontSize: 11, color: '#555', margin: '3px 0 0', fontFamily: 'JetBrains Mono, monospace' }}>by {list.ownerUsername || 'Anonymous'} · {list.stocks?.length || 0} stocks</p>
                </div>
                <span style={{ fontSize: 10, color: '#555', fontFamily: 'JetBrains Mono, monospace' }}>{list.followerCount || 0} followers</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>,
    document.body
  );
}

function StockDetailPage({ symbol, onClose, polygonKey, finnhubKey, aiModel, user, isMarketOpen, onOpenDetail, onAddToList, onSetAlert, watchlists, flattenedWatchlist, addStockToList }) {
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState(0);
  const [change, setChange] = useState(0);
  const [details, setDetails] = useState(null);
  const [news, setNews] = useState([]);
  const [ratings, setRatings] = useState(null);
  const [bio, setBio] = useState(null);
  const [bioLoading, setBioLoading] = useState(false);
  const [technicals, setTechnicals] = useState(null);
  const [techLoading, setTechLoading] = useState(false);
  const [financials, setFinancials] = useState(null);
  const [finLoading, setFinLoading] = useState(false);
  const [related, setRelated] = useState(null);
  const [dividendInfo, setDividendInfo] = useState(null);
  const [insiders, setInsiders] = useState(null);
  const [optionsData, setOptionsData] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef(null);
  const scrollRef = useRef(null);
  const ideaSubmitRef = useRef(false);

  const isPositive = change >= 0;
  const accent = isPositive ? '#00ff4e' : '#FF4B2B';
  const companyName = details?.results?.name || symbol;
  const d = details?.results || {};

  function formatDate(daysAgo) {
    const dt = new Date();
    dt.setDate(dt.getDate() - daysAgo);
    return dt.toISOString().split('T')[0];
  }

  function sdFormatNum(n) {
    if (!n) return '—';
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toLocaleString()}`;
  }

  function sdFormatVol(n) {
    if (!n) return '—';
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
    return String(n);
  }

  function sdFormatFin(n) {
    if (n == null || isNaN(n)) return '—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  function sdTimeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() / 1000 - ts;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function getFinVal(filing, key) {
    const stmts = ['income_statement', 'balance_sheet', 'cash_flow_statement', 'comprehensive_income'];
    for (const s of stmts) {
      const v = filing?.financials?.[s]?.[key]?.value;
      if (v != null) return v;
    }
    return null;
  }

  function getFinPeriodLabel(filing) {
    const fp = filing?.fiscal_period || '';
    const fy = filing?.fiscal_year || '';
    return fp && fy ? `${fp} ${fy}` : filing?.end_date || '';
  }

  function getRsiLabel(rsi) {
    if (rsi >= 70) return { text: 'OVERBOUGHT', color: '#FF4B2B' };
    if (rsi >= 60) return { text: 'BULLISH', color: '#4ade80' };
    if (rsi >= 40) return { text: 'NEUTRAL', color: '#facc15' };
    if (rsi >= 30) return { text: 'BEARISH', color: '#f97316' };
    return { text: 'OVERSOLD', color: '#FF4B2B' };
  }

  function getMacdSignal(macd) {
    if (!macd) return null;
    if (macd.histogram > 0 && macd.value > macd.signal) return { text: 'BULLISH', color: '#00ff4e' };
    if (macd.histogram < 0 && macd.value < macd.signal) return { text: 'BEARISH', color: '#FF4B2B' };
    return { text: 'NEUTRAL', color: '#facc15' };
  }

  function getSmaSignal(currentPrice, smaValue) {
    if (!smaValue || !currentPrice) return null;
    const pct = ((currentPrice - smaValue) / smaValue) * 100;
    return { above: currentPrice >= smaValue, pct };
  }

  // ===== CORE DATA FETCH =====
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetails(null); setNews([]); setRatings(null);
    setTechnicals(null); setFinancials(null); setRelated(null);
    setInsiders(null); setOptionsData(null); setBio(null);
    setPrice(0); setChange(0);

    (async () => {
      try {
        const [snapRes, detailsRes, newsRes, ratingsRes] = await Promise.allSettled([
          fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${symbol}&apiKey=${polygonKey}`).then(r => r.json()),
          fetch(`https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${polygonKey}`).then(r => r.json()),
          fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${formatDate(30)}&to=${formatDate(0)}&token=${finnhubKey}`).then(r => r.json()),
          fetch(`https://finnhub.io/api/v1/recommendation?symbol=${symbol}&token=${finnhubKey}`).then(r => r.json()),
        ]);

        if (cancelled) return;

        if (snapRes.status === 'fulfilled') {
          const tickers = snapRes.value?.tickers || [];
          const snap = tickers[0];
          if (snap) {
            const regularClose = snap.day?.c;
            const lastTrade = snap.lastTrade?.p;
            const prevClose = snap.prevDay?.c || 0;
            const cur = regularClose || lastTrade || prevClose;
            setPrice(cur);
            if (prevClose > 0) setChange(((cur - prevClose) / prevClose) * 100);
            else setChange(snap.todaysChangePerc || 0);
          }
        }
        if (detailsRes.status === 'fulfilled') setDetails(detailsRes.value);
        if (newsRes.status === 'fulfilled' && Array.isArray(newsRes.value)) setNews(newsRes.value.slice(0, 10));
        if (ratingsRes.status === 'fulfilled' && Array.isArray(ratingsRes.value)) setRatings(ratingsRes.value.slice(0, 3));
      } catch (e) { console.error('StockDetail fetch error:', e); }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [symbol]);

  // ===== BIO =====
  useEffect(() => {
    if (!details) return;
    setBioLoading(true);
    (async () => {
      try {
        const model = aiModel;
        const result = await model.generateContent(`Give a 2-3 sentence company overview of ${companyName} (${symbol}). Include what the company does, its sector, and what makes it notable. Be concise and factual. No disclaimers.`);
        setBio(result.response.text() || 'No bio available.');
      } catch (e) { setBio('Unable to load company bio.'); }
      setBioLoading(false);
    })();
  }, [details]);

  // ===== TECHNICALS =====
  useEffect(() => {
    if (loading || !price) return;
    let cancelled = false;
    setTechLoading(true);
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const [rsiRes, sma20Res, sma50Res, sma200Res, macdRes] = await Promise.allSettled([
          fetch(`https://api.polygon.io/v1/indicators/rsi/${symbol}?timespan=day&adjusted=true&window=14&series_type=close&order=desc&limit=1&apiKey=${polygonKey}`).then(r => r.json()),
          fetch(`https://api.polygon.io/v1/indicators/sma/${symbol}?timespan=day&adjusted=true&window=20&series_type=close&order=desc&limit=1&apiKey=${polygonKey}`).then(r => r.json()),
          fetch(`https://api.polygon.io/v1/indicators/sma/${symbol}?timespan=day&adjusted=true&window=50&series_type=close&order=desc&limit=1&apiKey=${polygonKey}`).then(r => r.json()),
          fetch(`https://api.polygon.io/v1/indicators/sma/${symbol}?timespan=day&adjusted=true&window=200&series_type=close&order=desc&limit=1&apiKey=${polygonKey}`).then(r => r.json()),
          fetch(`https://api.polygon.io/v1/indicators/macd/${symbol}?timespan=day&adjusted=true&short_window=12&long_window=26&signal_window=9&series_type=close&order=desc&limit=1&apiKey=${polygonKey}`).then(r => r.json()),
        ]);
        if (cancelled) return;
        const getV = (r, path) => r.status === 'fulfilled' ? r.value?.results?.values?.[0]?.[path || 'value'] : null;
        const macdV = macdRes.status === 'fulfilled' ? macdRes.value?.results?.values?.[0] : null;
        setTechnicals({
          rsi: getV(rsiRes),
          sma20: getV(sma20Res),
          sma50: getV(sma50Res),
          sma200: getV(sma200Res),
          macd: macdV ? { value: macdV.value, signal: macdV.signal, histogram: macdV.histogram } : null,
        });
      } catch (e) { console.error('Technicals error:', e); }
      if (!cancelled) setTechLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loading, price, symbol]);

  // ===== FINANCIALS + RELATED + DIVIDENDS + INSIDERS =====
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    setFinLoading(true);
    (async () => {
      try {
        const expDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const [finRes, relRes, divRes, insiderRes] = await Promise.allSettled([
          fetch(`https://api.polygon.io/vX/reference/financials?ticker=${symbol}&limit=4&sort=period_of_report_date&order=desc&apiKey=${polygonKey}`).then(r => r.json()),
          fetch(`https://api.polygon.io/v1/related-companies/${symbol}?apiKey=${polygonKey}`).then(r => r.json()),
          fetch(`https://api.polygon.io/v3/reference/dividends?ticker=${symbol}&limit=1&sort=ex_dividend_date&order=desc&apiKey=${polygonKey}`).then(r => r.json()),
          fetch(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&token=${finnhubKey}`).then(r => r.json()),
        ]);
        if (cancelled) return;

        if (finRes.status === 'fulfilled' && finRes.value?.results?.length > 0) setFinancials(finRes.value.results);
        if (relRes.status === 'fulfilled' && relRes.value?.results?.length > 0) {
          const seen = new Set();
          const unique = relRes.value.results.filter(r => {
            if (!r.ticker || r.ticker === symbol || seen.has(r.ticker)) return false;
            seen.add(r.ticker); return true;
          });
          setRelated(unique.slice(0, 6));
        }
        if (divRes.status === 'fulfilled' && divRes.value?.results?.length > 0) setDividendInfo(divRes.value.results[0]);
        if (insiderRes.status === 'fulfilled' && insiderRes.value?.data?.length > 0) {
          const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
          const recent = insiderRes.value.data.filter(t => {
            return new Date(t.transactionDate).getTime() > sixMonthsAgo && ['P','S','A','M'].includes(t.transactionCode) && t.change !== 0;
          }).slice(0, 15);
          if (recent.length > 0) setInsiders(recent);
        }
      } catch (e) { console.error('Financials error:', e); }
      if (!cancelled) setFinLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loading, symbol]);

  // ===== OPTIONS =====
  useEffect(() => {
    if (loading || !price) return;
    let cancelled = false;
    setOptionsLoading(true);
    (async () => {
      try {
        const expDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const [callRes, putRes] = await Promise.all([
          fetch(`https://api.polygon.io/v3/snapshot/options/${symbol}?contract_type=call&expiration_date.lte=${expDate}&limit=50&apiKey=${polygonKey}`).then(r => r.json()),
          fetch(`https://api.polygon.io/v3/snapshot/options/${symbol}?contract_type=put&expiration_date.lte=${expDate}&limit=50&apiKey=${polygonKey}`).then(r => r.json()),
        ]);
        if (cancelled || (!callRes?.results?.length && !putRes?.results?.length)) { if (!cancelled) setOptionsLoading(false); return; }
        const contracts = [...(callRes.results || []), ...(putRes.results || [])];
        const calls = contracts.filter(c => c.details?.contract_type === 'call');
        const puts = contracts.filter(c => c.details?.contract_type === 'put');
        const callVol = calls.reduce((s, c) => s + (c.day?.volume || 0), 0);
        const putVol = puts.reduce((s, c) => s + (c.day?.volume || 0), 0);
        const totalVol = callVol + putVol;
        const callOI = calls.reduce((s, c) => s + (c.open_interest || 0), 0);
        const putOI = puts.reduce((s, c) => s + (c.open_interest || 0), 0);
        const ivsAll = contracts.filter(c => c.implied_volatility != null).map(c => c.implied_volatility);
        const avgIV = ivsAll.length > 0 ? ivsAll.reduce((a, b) => a + b, 0) / ivsAll.length : null;
        const topByVolume = [...contracts].filter(c => (c.day?.volume || 0) > 0).sort((a, b) => (b.day?.volume || 0) - (a.day?.volume || 0)).slice(0, 6);
        const unusual = [...contracts].filter(c => (c.day?.volume || 0) > 0 && (c.open_interest || 0) > 0)
          .map(c => ({ ...c, volOiRatio: (c.day?.volume || 0) / (c.open_interest || 1) }))
          .filter(c => c.volOiRatio > 1).sort((a, b) => b.volOiRatio - a.volOiRatio).slice(0, 4);
        if (!cancelled) setOptionsData({ callVol, putVol, totalVol, pcRatio: callVol > 0 ? putVol / callVol : null, callOI, putOI, avgIV, topByVolume, unusual, contractCount: contracts.length });
      } catch (e) { console.error('Options error:', e); }
      if (!cancelled) setOptionsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loading, price, symbol]);

  // ===== AI CHAT =====
  const sendMessage = async (text) => {
    if (!text?.trim()) return;
    const userMsg = { role: 'user', text: text.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const techCtx = technicals ? `\nRSI(14): ${technicals.rsi?.toFixed(1) || 'N/A'}\nSMA20: $${technicals.sma20?.toFixed(2) || 'N/A'} | SMA50: $${technicals.sma50?.toFixed(2) || 'N/A'} | SMA200: $${technicals.sma200?.toFixed(2) || 'N/A'}` : '';
      const optCtx = optionsData ? `\nOptions: Call Vol ${sdFormatVol(optionsData.callVol)} | Put Vol ${sdFormatVol(optionsData.putVol)} | P/C Ratio ${optionsData.pcRatio?.toFixed(2) || 'N/A'}` : '';
      const ctx = `Stock: ${symbol} (${companyName})\nPrice: $${price.toFixed(2)}\nChange: ${isPositive ? '+' : ''}${change.toFixed(2)}%\nMarket Cap: ${sdFormatNum(d.market_cap)}\nSector: ${d.sic_description || 'N/A'}${techCtx}${optCtx}`;
      const prompt = `You are an AI stock analyst assistant. Context:\n${ctx}\n\nUser: ${text.trim()}\n\nProvide a concise, helpful answer. No disclaimers. Be specific and actionable.`;
      const result = await aiModel.generateContent(prompt);
      setChatMessages([...newMessages, { role: 'assistant', text: result.response.text() || 'No response.' }]);
      setTimeout(() => chatScrollRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 100);
    } catch (e) {
      setChatMessages([...newMessages, { role: 'assistant', text: 'Unable to get a response. Try again.' }]);
    }
    setChatLoading(false);
  };

  // ===== STATS =====
  const stats = [
    { label: 'MKT CAP', value: sdFormatNum(d.market_cap) },
    { label: 'SHARES OUT', value: d.share_class_shares_outstanding ? sdFormatVol(d.share_class_shares_outstanding) : '—' },
    { label: 'EMPLOYEES', value: d.total_employees ? d.total_employees.toLocaleString() : '—' },
    { label: 'SECTOR', value: d.sic_description?.split(' ').slice(0, 2).join(' ') || '—' },
    { label: '52W HIGH', value: d.branding ? '—' : '—' },
    { label: 'LISTED', value: d.list_date || '—' },
  ];

  const latestRating = ratings?.[0];
  const ratingTotal = latestRating ? (latestRating.strongBuy + latestRating.buy + latestRating.hold + latestRating.sell + latestRating.strongSell) : 0;

  const latestFin = financials?.[0] || null;
  const revenue = latestFin ? getFinVal(latestFin, 'revenues') : null;
  const netIncome = latestFin ? getFinVal(latestFin, 'net_income_loss') : null;
  const eps = latestFin ? getFinVal(latestFin, 'basic_earnings_per_share') : null;
  const grossProfit = latestFin ? getFinVal(latestFin, 'gross_profit') : null;
  const profitMargin = (revenue && netIncome) ? ((netIncome / revenue) * 100) : null;
  const grossMargin = (revenue && grossProfit) ? ((grossProfit / revenue) * 100) : null;

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ===== GLASS BOX =====
  const GlassBox = ({ title, children }) => (
    <div className="mobile-stock-glassbox" style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.4)', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)', padding: 16 }}>
      {title && <div className="mobile-stock-glassbox-title" style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>{title}</div>}
      {children}
    </div>
  );

  const monoMd = { fontFamily: 'JetBrains Mono, monospace', fontSize: 13 };
  const monoSm = { fontFamily: 'JetBrains Mono, monospace', fontSize: 11 };
  const monoXs = { fontFamily: 'JetBrains Mono, monospace', fontSize: 9 };

  return (
    <div className="mobile-stock-detail" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0a0a0a', display: 'flex', flexDirection: 'column', fontFamily: 'JetBrains Mono, monospace' }}>
      {/* HEADER */}
      <div className="mobile-stock-header" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 10px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} className="mobile-stock-back" style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ArrowLeft size={18} color="#fff" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mobile-stock-ticker" style={{ fontSize: 22, fontFamily: 'JetBrains Mono, monospace', color: '#fff', letterSpacing: 0.5, fontWeight: 700 }}>{symbol}</div>
          <div className="mobile-stock-name" style={{ fontSize: 12, color: '#8a8a8a', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 300 }}>{companyName}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="mobile-stock-price" style={{ fontSize: 22, fontFamily: 'JetBrains Mono, monospace', color: '#fff', fontWeight: 700 }}>
            {price > 0 ? `$${price.toFixed(2)}` : '—'}
          </div>
          <div className={`mobile-stock-change ${isPositive ? 'up' : 'down'}`} style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: accent, marginTop: 2 }}>
            {isPositive ? '+' : ''}{change.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* BODY */}
      <div ref={scrollRef} className="mobile-stock-body" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 16px 80px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 80 }}>
            <div style={{ width: 36, height: 36, border: '3px solid #00ff4e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 12, color: '#8a8a8a', letterSpacing: 2, textTransform: 'uppercase' }}>Loading {symbol}...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* ACTION BAR — compact pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
              {[
                {
                  icon: <Pin size={14} color={isPinned ? '#00ff4e' : '#aaa'} fill={isPinned ? '#00ff4e' : 'none'} />,
                  label: isPinned ? 'Pinned' : 'Pin',
                  onClick: () => {
                    setIsPinned(p => !p);
                    if (onAddToList) {
                      const pinList = watchlists?.find(w => w.name?.toLowerCase() === 'pinned' || w.isPinned);
                      if (pinList) onAddToList({ symbol, name: companyName, price });
                    }
                  },
                  active: isPinned,
                },
                {
                  icon: <Share2 size={14} color="#aaa" />,
                  label: 'Share',
                  onClick: () => {
                    const text = `${symbol} — $${price.toFixed(2)} (${isPositive ? '+' : ''}${change.toFixed(2)}%)\n\n${companyName}\n\njckrbbt.io`;
                    if (navigator.share) navigator.share({ title: symbol, text });
                    else navigator.clipboard.writeText(text);
                  },
                },
                {
                  icon: <Plus size={14} color="#aaa" />,
                  label: 'Add',
                  onClick: () => onAddToList?.({ symbol, name: companyName, price }),
                },
                {
                  icon: <Bell size={14} color="#00ff4e" />,
                  label: 'Set Alerts',
                  onClick: () => onSetAlert?.({ symbol, name: companyName, price }),
                  primary: true,
                },
                {
                  icon: <Cpu size={14} color="#00ff4e" />,
                  label: 'Ask AI',
                  onClick: () => setChatOpen(o => !o),
                  active: chatOpen,
                  primary: true,
                },
                {
                  icon: <Lightbulb size={14} color="#00ff4e" />,
                  label: 'Idea',
                  onClick: () => {
                    setChatOpen(true);
                    setTimeout(() => {
                      setChatInput(`Give me a trade idea for ${symbol} based on current technicals and recent news.`);
                    }, 150);
                  },
                  primary: true,
                },
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={btn.onClick}
                  className="mobile-action-pill"
                  style={{
                    flex: '0 0 auto',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px',
                    borderRadius: 20,
                    border: `0.5px solid ${btn.active ? 'rgba(0,255,78,0.4)' : btn.primary ? 'rgba(0,255,78,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    background: btn.active ? 'rgba(0,255,78,0.12)' : btn.primary ? 'rgba(0,255,78,0.06)' : 'rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                  }}
                >
                  {btn.icon}
                  <span style={{ fontSize: 11, color: btn.primary || btn.active ? '#00ff4e' : '#ccc', letterSpacing: 0.3, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>{btn.label}</span>
                </button>
              ))}
            </div>

            {/* CHART */}
            <GlassBox title="PRICE CHART">
              <div style={{ overflow: 'hidden' }}>
                <MiniChart symbol={symbol} livePrice={price} liveChange={change} isMarketOpen={isMarketOpen} />
              </div>
            </GlassBox>

            {/* ABOUT */}
            {(bio || bioLoading) && (
              <GlassBox title="ABOUT">
                {bioLoading && !bio ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ width: 16, height: 16, border: '2px solid #00ff4e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 11, color: '#555' }}>Generating overview...</span>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, margin: 0 }}>{bio}</p>
                )}
              </GlassBox>
            )}

            {/* KEY STATS */}
            <GlassBox title="KEY STATS">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                {stats.map(s => (
                  <div key={s.label} style={{ padding: '10px 0' }}>
                    <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: 16, color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </GlassBox>

            {/* TECHNICALS */}
            {(technicals || techLoading) && (
              <GlassBox title="TECHNICALS">
                {techLoading && !technicals ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 0' }}>
                    <div style={{ width: 16, height: 16, border: '2px solid #00ff4e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 11, color: '#555' }}>Loading indicators...</span>
                  </div>
                ) : technicals ? (
                  <div>
                    {/* RSI */}
                    {technicals.rsi != null && (() => {
                      const label = getRsiLabel(technicals.rsi);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                          <div style={{ width: 56 }}>
                            <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 2 }}>RSI (14)</div>
                            <div style={{ fontSize: 20, color: label.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{technicals.rsi.toFixed(1)}</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(technicals.rsi, 100)}%`, background: 'linear-gradient(to right, #FF4B2B, #f97316, #facc15, #4ade80, #00ff4e)', borderRadius: 3 }} />
                              <div style={{ position: 'absolute', left: '30%', top: 0, width: 1, height: '100%', background: 'rgba(255,255,255,0.2)' }} />
                              <div style={{ position: 'absolute', left: '70%', top: 0, width: 1, height: '100%', background: 'rgba(255,255,255,0.2)' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                              {['Oversold', 'Neutral', 'Overbought'].map(l => <span key={l} style={{ fontSize: 7, color: '#444' }}>{l}</span>)}
                            </div>
                          </div>
                          <div style={{ padding: '4px 10px', borderRadius: 6, background: label.color + '20', border: `1px solid ${label.color}40` }}>
                            <span style={{ fontSize: 9, color: label.color, letterSpacing: 1 }}>{label.text}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Moving Averages */}
                    {(technicals.sma20 || technicals.sma50 || technicals.sma200) && (
                      <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: 8, color: '#555', letterSpacing: 2, marginBottom: 10 }}>MOVING AVERAGES</div>
                        {[{ label: 'SMA 20', val: technicals.sma20 }, { label: 'SMA 50', val: technicals.sma50 }, { label: 'SMA 200', val: technicals.sma200 }].filter(m => m.val != null).map(ma => {
                          const sig = getSmaSignal(price, ma.val);
                          return (
                            <div key={ma.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span style={{ fontSize: 12, color: '#8a8a8a', width: 60 }}>{ma.label}</span>
                              <span style={{ fontSize: 13, color: '#fff', flex: 1 }}>${ma.val.toFixed(2)}</span>
                              {sig && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: sig.above ? 'rgba(0,255,78,0.1)' : 'rgba(255,75,43,0.1)' }}>
                                  {sig.above ? <ArrowUp size={10} color="#00ff4e" /> : <ArrowDown size={10} color="#FF4B2B" />}
                                  <span style={{ fontSize: 10, color: sig.above ? '#00ff4e' : '#FF4B2B' }}>{sig.above ? 'Above' : 'Below'} {Math.abs(sig.pct).toFixed(1)}%</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* MACD */}
                    {technicals.macd && (() => {
                      const sig = getMacdSignal(technicals.macd);
                      return (
                        <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ fontSize: 8, color: '#555', letterSpacing: 2, marginBottom: 10 }}>MACD (12, 26, 9)</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            {[{ label: 'MACD', val: technicals.macd.value, colored: true }, { label: 'Signal', val: technicals.macd.signal }, { label: 'Histogram', val: technicals.macd.histogram, colored: true }].map(item => (
                              <div key={item.label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 8, color: '#555', letterSpacing: 1, marginBottom: 2 }}>{item.label}</div>
                                <div style={{ fontSize: 13, color: item.colored ? (item.val >= 0 ? '#00ff4e' : '#FF4B2B') : '#fff' }}>{item.val.toFixed(3)}</div>
                              </div>
                            ))}
                            {sig && (
                              <div style={{ padding: '4px 10px', borderRadius: 6, background: sig.color + '20', border: `1px solid ${sig.color}40` }}>
                                <span style={{ fontSize: 9, color: sig.color, letterSpacing: 1 }}>{sig.text}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </GlassBox>
            )}

            {/* OPTIONS ACTIVITY */}
            {(optionsData || optionsLoading) && (
              <GlassBox title="OPTIONS ACTIVITY">
                {optionsLoading && !optionsData ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 0' }}>
                    <div style={{ width: 16, height: 16, border: '2px solid #00ff4e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 11, color: '#555' }}>Loading options...</span>
                  </div>
                ) : optionsData ? (
                  <div>
                    {/* Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 12 }}>
                      {[
                        { label: 'CALL VOL', val: sdFormatVol(optionsData.callVol), color: '#00ff4e' },
                        { label: 'PUT VOL', val: sdFormatVol(optionsData.putVol), color: '#FF4B2B' },
                        { label: 'P/C RATIO', val: optionsData.pcRatio != null ? optionsData.pcRatio.toFixed(2) : '—', color: optionsData.pcRatio > 1 ? '#FF4B2B' : optionsData.pcRatio < 0.7 ? '#00ff4e' : '#facc15' },
                        { label: 'AVG IV', val: optionsData.avgIV != null ? `${(optionsData.avgIV * 100).toFixed(0)}%` : '—', color: '#fff' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: '#555', letterSpacing: 1.5, marginBottom: 4 }}>{s.label}</div>
                          <div style={{ fontSize: 16, color: s.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{s.val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Volume bar */}
                    {optionsData.totalVol > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ flex: optionsData.callVol || 1, background: '#00ff4e' }} />
                          <div style={{ flex: optionsData.putVol || 1, background: '#FF4B2B' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 8, color: '#00ff4e' }}>Calls {optionsData.totalVol > 0 ? `${((optionsData.callVol / optionsData.totalVol) * 100).toFixed(0)}%` : ''}</span>
                          <span style={{ fontSize: 8, color: '#FF4B2B' }}>Puts {optionsData.totalVol > 0 ? `${((optionsData.putVol / optionsData.totalVol) * 100).toFixed(0)}%` : ''}</span>
                        </div>
                      </div>
                    )}

                    {/* OI row */}
                    <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 4 }}>
                      {[{ label: 'CALL OI', val: sdFormatVol(optionsData.callOI) }, { label: 'PUT OI', val: sdFormatVol(optionsData.putOI) }, { label: 'CONTRACTS', val: optionsData.contractCount }].map(s => (
                        <div key={s.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: '#555', letterSpacing: 1.5, marginBottom: 3 }}>{s.label}</div>
                          <div style={{ fontSize: 13, color: '#8a8a8a' }}>{s.val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Most active */}
                    {optionsData.topByVolume.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: 8, color: '#555', letterSpacing: 2, marginBottom: 10 }}>MOST ACTIVE</div>
                        {optionsData.topByVolume.map((c, i) => {
                          const isCall = c.details?.contract_type === 'call';
                          const expiry = c.details?.expiration_date;
                          const shortExp = expiry ? `${expiry.slice(5,7)}/${expiry.slice(8,10)}` : '';
                          const lastPrice = c.day?.close || 0;
                          const dayChg = c.day?.change_percent;
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < optionsData.topByVolume.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCall ? 'rgba(0,255,78,0.12)' : 'rgba(255,75,43,0.12)' }}>
                                    <span style={{ fontSize: 10, color: isCall ? '#00ff4e' : '#FF4B2B', fontWeight: 700 }}>{isCall ? 'C' : 'P'}</span>
                                  </div>
                                  <span style={{ fontSize: 14, color: '#fff' }}>${c.details?.strike_price}</span>
                                  <span style={{ fontSize: 11, color: '#555' }}>{shortExp}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, paddingLeft: 30 }}>
                                  <span style={{ fontSize: 10, color: '#666' }}>Vol: {sdFormatVol(c.day?.volume || 0)}</span>
                                  <span style={{ fontSize: 10, color: '#444' }}>·</span>
                                  <span style={{ fontSize: 10, color: '#666' }}>OI: {sdFormatVol(c.open_interest || 0)}</span>
                                  {c.implied_volatility != null && <><span style={{ fontSize: 10, color: '#444' }}>·</span><span style={{ fontSize: 10, color: '#666' }}>IV: {(c.implied_volatility * 100).toFixed(0)}%</span></>}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 14, color: '#fff' }}>${lastPrice.toFixed(2)}</div>
                                {dayChg != null && <div style={{ fontSize: 10, color: dayChg >= 0 ? '#00ff4e' : '#FF4B2B', marginTop: 2 }}>{dayChg >= 0 ? '+' : ''}{dayChg.toFixed(1)}%</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Unusual activity */}
                    {optionsData.unusual.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ fontSize: 8, color: '#555', letterSpacing: 2 }}>UNUSUAL ACTIVITY</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.2)' }}>
                            <Zap size={9} color="#facc15" />
                            <span style={{ fontSize: 8, color: '#facc15', letterSpacing: 1 }}>VOL {'>'} OI</span>
                          </div>
                        </div>
                        {optionsData.unusual.map((c, i) => {
                          const isCall = c.details?.contract_type === 'call';
                          const expiry = c.details?.expiration_date;
                          const shortExp = expiry ? `${expiry.slice(5,7)}/${expiry.slice(8,10)}` : '';
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < optionsData.unusual.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCall ? 'rgba(0,255,78,0.12)' : 'rgba(255,75,43,0.12)' }}>
                                    <span style={{ fontSize: 10, color: isCall ? '#00ff4e' : '#FF4B2B', fontWeight: 700 }}>{isCall ? 'C' : 'P'}</span>
                                  </div>
                                  <span style={{ fontSize: 14, color: '#fff' }}>${c.details?.strike_price}</span>
                                  <span style={{ fontSize: 11, color: '#555' }}>{shortExp}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, paddingLeft: 30 }}>
                                  <span style={{ fontSize: 10, color: '#666' }}>Vol: {sdFormatVol(c.day?.volume || 0)}</span>
                                  <span style={{ fontSize: 10, color: '#444' }}>·</span>
                                  <span style={{ fontSize: 10, color: '#666' }}>OI: {sdFormatVol(c.open_interest || 0)}</span>
                                  <span style={{ fontSize: 10, color: '#444' }}>·</span>
                                  <span style={{ fontSize: 10, color: '#facc15' }}>{c.volOiRatio.toFixed(1)}x</span>
                                </div>
                              </div>
                              <div style={{ fontSize: 14, color: '#fff' }}>${(c.day?.close || 0).toFixed(2)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </GlassBox>
            )}

            {/* FINANCIALS */}
            {(latestFin || finLoading) && (
              <GlassBox title={`FINANCIALS${latestFin ? ` · ${getFinPeriodLabel(latestFin)}` : ''}`}>
                {finLoading && !latestFin ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 0' }}>
                    <div style={{ width: 16, height: 16, border: '2px solid #00ff4e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 11, color: '#555' }}>Loading financials...</span>
                  </div>
                ) : latestFin ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                      {[
                        { label: 'REVENUE', value: sdFormatFin(revenue) },
                        { label: 'NET INCOME', value: sdFormatFin(netIncome), color: netIncome != null ? (netIncome >= 0 ? '#00ff4e' : '#FF4B2B') : '#fff' },
                        { label: 'EPS', value: eps != null ? `$${eps.toFixed(2)}` : '—', color: eps != null ? (eps >= 0 ? '#00ff4e' : '#FF4B2B') : '#fff' },
                        { label: 'GROSS MARGIN', value: grossMargin != null ? `${grossMargin.toFixed(1)}%` : '—' },
                        { label: 'PROFIT MARGIN', value: profitMargin != null ? `${profitMargin.toFixed(1)}%` : '—', color: profitMargin != null ? (profitMargin >= 0 ? '#00ff4e' : '#FF4B2B') : '#fff' },
                        { label: 'GROSS PROFIT', value: sdFormatFin(grossProfit) },
                      ].map(s => (
                        <div key={s.label} style={{ padding: '10px 0' }}>
                          <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 4 }}>{s.label}</div>
                          <div style={{ fontSize: 16, color: s.color || '#fff', fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Revenue trend */}
                    {financials && financials.length > 1 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: 8, color: '#555', letterSpacing: 2, marginBottom: 8 }}>REVENUE TREND</div>
                        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: 80 }}>
                          {[...financials].reverse().map((q, i) => {
                            const rev = getFinVal(q, 'revenues');
                            const maxRev = Math.max(...financials.map(f => Math.abs(getFinVal(f, 'revenues') || 0)));
                            const barH = maxRev > 0 && rev ? Math.max(4, (Math.abs(rev) / maxRev) * 56) : 4;
                            return (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                <div style={{ fontSize: 9, color: '#8a8a8a', marginBottom: 4 }}>{rev ? sdFormatFin(rev) : '—'}</div>
                                <div style={{ width: 24, height: barH, background: rev >= 0 ? '#00ff4e' : '#FF4B2B', borderRadius: 4 }} />
                                <div style={{ fontSize: 8, color: '#444', marginTop: 4, textAlign: 'center' }}>{getFinPeriodLabel(q)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {dividendInfo && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <DollarSign size={12} color="#00ff4e" />
                        <span style={{ fontSize: 11, color: '#8a8a8a' }}>
                          Dividend: ${dividendInfo.cash_amount?.toFixed(2)}/share
                          {dividendInfo.ex_dividend_date ? ` · Ex-Date: ${dividendInfo.ex_dividend_date}` : ''}
                          {dividendInfo.frequency ? ` · ${dividendInfo.frequency === 4 ? 'Quarterly' : dividendInfo.frequency === 12 ? 'Monthly' : dividendInfo.frequency === 1 ? 'Annual' : `${dividendInfo.frequency}x/yr`}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}
              </GlassBox>
            )}

            {/* INSIDER ACTIVITY */}
            {insiders && insiders.length > 0 && (() => {
              const buys = insiders.filter(t => t.change > 0);
              const sells = insiders.filter(t => t.change < 0);
              const buyValue = buys.reduce((s, t) => s + Math.abs(t.change) * (t.transactionPrice || 0), 0);
              const sellValue = sells.reduce((s, t) => s + Math.abs(t.change) * (t.transactionPrice || 0), 0);
              const netBuy = buyValue >= sellValue;
              return (
                <GlassBox title="INSIDER ACTIVITY">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowUpRight size={14} color="#00ff4e" />
                      <span style={{ fontSize: 12, color: '#00ff4e' }}>{buys.length} Buy{buys.length !== 1 ? 's' : ''}</span>
                      {buyValue > 0 && <span style={{ fontSize: 10, color: '#00ff4e', opacity: 0.7 }}>{sdFormatFin(buyValue)}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowDown size={14} color="#FF4B2B" />
                      <span style={{ fontSize: 12, color: '#FF4B2B' }}>{sells.length} Sell{sells.length !== 1 ? 's' : ''}</span>
                      {sellValue > 0 && <span style={{ fontSize: 10, color: '#FF4B2B', opacity: 0.7 }}>{sdFormatFin(sellValue)}</span>}
                    </div>
                    <div style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 4, background: netBuy ? 'rgba(0,255,78,0.1)' : 'rgba(255,75,43,0.1)' }}>
                      <span style={{ fontSize: 9, color: netBuy ? '#00ff4e' : '#FF4B2B', letterSpacing: 1 }}>NET {netBuy ? 'BUYING' : 'SELLING'}</span>
                    </div>
                  </div>
                  {insiders.slice(0, 8).map((t, i) => {
                    const isBuy = t.change > 0;
                    const shares = Math.abs(t.change);
                    const txValue = shares * (t.transactionPrice || 0);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', gap: 10, borderBottom: i < Math.min(insiders.length, 8) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div style={{ width: 6, height: 6, borderRadius: 3, background: isBuy ? '#00ff4e' : '#FF4B2B', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                          <div style={{ fontSize: 9, color: '#444', marginTop: 2 }}>{t.transactionDate}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: isBuy ? '#00ff4e' : '#FF4B2B' }}>{isBuy ? 'BUY' : 'SELL'} {sdFormatVol(shares)}</div>
                          {txValue > 0 && <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>{t.transactionPrice ? `@$${t.transactionPrice.toFixed(2)}` : ''} · {sdFormatFin(txValue)}</div>}
                        </div>
                      </div>
                    );
                  })}
                </GlassBox>
              );
            })()}

            {/* ANALYST RATINGS */}
            {latestRating && (
              <GlassBox title="ANALYST RATINGS">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 4, marginBottom: 8 }}>
                  {[
                    { label: 'Strong Buy', count: latestRating.strongBuy, color: '#00ff4e' },
                    { label: 'Buy', count: latestRating.buy, color: '#4ade80' },
                    { label: 'Hold', count: latestRating.hold, color: '#facc15' },
                    { label: 'Sell', count: latestRating.sell, color: '#f97316' },
                    { label: 'Strong Sell', count: latestRating.strongSell, color: '#FF4B2B' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ width: '80%', height: ratingTotal > 0 ? Math.max(4, (r.count / ratingTotal) * 60) : 4, background: r.color, borderRadius: 3, marginBottom: 6 }} />
                      <div style={{ fontSize: 14, color: r.color, fontFamily: 'JetBrains Mono, monospace' }}>{r.count}</div>
                      <div style={{ fontSize: 8, color: '#555', textAlign: 'center', marginTop: 2 }}>{r.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: '#333', textAlign: 'center', marginTop: 4 }}>{latestRating.period}</div>
              </GlassBox>
            )}

            {/* AI CHAT */}
            {chatOpen && (
              <GlassBox title={`AI RESEARCH · ${symbol}`}>
                <div ref={chatScrollRef} style={{ maxHeight: 250, overflowY: 'auto', marginBottom: 8 }}>
                  {chatMessages.length === 0 && (
                    <div style={{ fontSize: 12, color: '#444', textAlign: 'center', padding: '20px 0' }}>Ask anything about {symbol}...</div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                      <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 10, background: msg.role === 'user' ? '#00ff4e' : 'rgba(255,255,255,0.06)', color: msg.role === 'user' ? '#000' : '#ddd', fontSize: 13, lineHeight: 1.5 }}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}><div style={{ width: 20, height: 20, border: '2px solid #00ff4e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>}
                </div>

                {/* Quick prompts */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8, paddingBottom: 4 }}>
                  {['Bull case?', 'Bear case?', 'Key risks?', 'Recent catalysts?', 'Options flow?', 'Fair value?'].map(q => (
                    <button key={q} onClick={() => sendMessage(q)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(0,255,78,0.2)', background: 'rgba(0,255,78,0.04)', cursor: 'pointer', fontSize: 11, color: '#00ff4e' }}>{q}</button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput); } }}
                    placeholder={`Ask about ${symbol}...`}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#fff', fontFamily: 'JetBrains Mono, monospace', outline: 'none' }}
                  />
                  <button onClick={() => sendMessage(chatInput)} disabled={!chatInput.trim() || chatLoading} style={{ width: 36, height: 36, borderRadius: 18, background: '#00ff4e', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!chatInput.trim() || chatLoading) ? 0.3 : 1 }}>
                    <Send size={14} color="#000" />
                  </button>
                </div>
                <div style={{ fontSize: 9, color: '#333', marginTop: 8, textAlign: 'center' }}>AI analysis is for informational purposes only. Not financial advice.</div>
              </GlassBox>
            )}

            {/* NEWS */}
            {news.length > 0 && (
              <GlassBox title="RECENT NEWS">
                {(newsExpanded ? news : news.slice(0, 3)).map((item, i, arr) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', textDecoration: 'none' }}>
                    <div style={{ fontSize: 13, color: '#ddd', lineHeight: 1.5, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.headline}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: '#00ff4e', textTransform: 'uppercase', letterSpacing: 1 }}>{item.source}</span>
                      <span style={{ fontSize: 10, color: '#555' }}>{sdTimeAgo(item.datetime)}</span>
                    </div>
                  </a>
                ))}
                {news.length > 3 && (
                  <button onClick={() => setNewsExpanded(!newsExpanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 8, padding: '10px 0', borderRadius: 8, border: '1px solid rgba(0,255,78,0.2)', background: 'rgba(0,255,78,0.04)', cursor: 'pointer', fontSize: 11, color: '#00ff4e' }}>
                    {newsExpanded ? <ChevronUp size={14} color="#00ff4e" /> : <ChevronDown size={14} color="#00ff4e" />}
                    {newsExpanded ? 'Show Less' : `View ${news.length - 3} More`}
                  </button>
                )}
              </GlassBox>
            )}

            {/* RELATED COMPANIES */}
            {related && related.length > 0 && (
              <GlassBox title="RELATED COMPANIES">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {related.map(r => (
                    <button key={r.ticker} onClick={() => onOpenDetail(r.ticker)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 14, color: '#00ff4e', fontFamily: 'JetBrains Mono, monospace' }}>
                      {r.ticker}
                      <ArrowUpRight size={12} color="#525252" />
                    </button>
                  ))}
                </div>
              </GlassBox>
            )}

            <div style={{ fontSize: 9, color: '#333', textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>
              Data provided for informational purposes only. Not financial advice. Always do your own research.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Mini inline chart for stock detail page
function SDChart({ symbol, polygonKey, price, change, accent }) {
  const [chartData, setChartData] = useState([]);
  const [range, setRange] = useState('1D');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let url;
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const ranges = {
          '1D': `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/5/minute/${today}/${today}?adjusted=true&sort=asc&limit=390&apiKey=${polygonKey}`,
          '1W': `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${new Date(Date.now()-7*86400000).toISOString().split('T')[0]}/${today}?adjusted=true&sort=asc&apiKey=${polygonKey}`,
          '1M': `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${new Date(Date.now()-30*86400000).toISOString().split('T')[0]}/${today}?adjusted=true&sort=asc&apiKey=${polygonKey}`,
          '3M': `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${new Date(Date.now()-90*86400000).toISOString().split('T')[0]}/${today}?adjusted=true&sort=asc&apiKey=${polygonKey}`,
          '1Y': `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${new Date(Date.now()-365*86400000).toISOString().split('T')[0]}/${today}?adjusted=true&sort=asc&apiKey=${polygonKey}`,
        };
        const res = await fetch(url || ranges[range]).then(r => r.json());
        if (!cancelled && res.results?.length > 0) {
          setChartData(res.results.map(b => ({ time: b.t, price: b.c })));
        }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [symbol, range, polygonKey]);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const url = range === '1D'
          ? `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/5/minute/${today}/${today}?adjusted=true&sort=asc&limit=390&apiKey=${polygonKey}`
          : range === '1W' ? `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${new Date(Date.now()-7*86400000).toISOString().split('T')[0]}/${today}?adjusted=true&sort=asc&apiKey=${polygonKey}`
          : range === '1M' ? `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${new Date(Date.now()-30*86400000).toISOString().split('T')[0]}/${today}?adjusted=true&sort=asc&apiKey=${polygonKey}`
          : range === '3M' ? `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${new Date(Date.now()-90*86400000).toISOString().split('T')[0]}/${today}?adjusted=true&sort=asc&apiKey=${polygonKey}`
          : `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${new Date(Date.now()-365*86400000).toISOString().split('T')[0]}/${today}?adjusted=true&sort=asc&apiKey=${polygonKey}`;
        const res = await fetch(url).then(r => r.json());
        if (res.results?.length > 0) setChartData(res.results.map(b => ({ time: b.t, price: b.c })));
      } catch(e) {}
    })();
  }, [symbol, range]);

  const minP = chartData.length ? Math.min(...chartData.map(d => d.price)) : 0;
  const maxP = chartData.length ? Math.max(...chartData.map(d => d.price)) : 0;
  const rangeP = maxP - minP || 1;

  return (
    <div>
      {/* Range buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['1D','1W','1M','3M','1Y'].map(r => (
          <button key={r} onClick={() => setRange(r)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${range === r ? accent : 'rgba(255,255,255,0.08)'}`, background: range === r ? accent + '20' : 'transparent', cursor: 'pointer', fontSize: 10, color: range === r ? accent : '#555', fontFamily: 'JetBrains Mono, monospace' }}>{r}</button>
        ))}
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="sdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accent} stopOpacity={0.3} />
                <stop offset="95%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <RechartsTooltip
              contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              formatter={(val) => [`$${val.toFixed(2)}`, 'Price']}
              labelFormatter={() => ''}
            />
            <Area type="monotone" dataKey="price" stroke={accent} strokeWidth={1.5} fill="url(#sdGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 24, height: 24, border: '2px solid #00ff4e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {price > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 10, color: '#555' }}>Low: ${minP.toFixed(2)}</span>
          <span style={{ fontSize: 12, color: accent, fontFamily: 'JetBrains Mono, monospace' }}>${price.toFixed(2)}</span>
          <span style={{ fontSize: 10, color: '#555' }}>High: ${maxP.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}