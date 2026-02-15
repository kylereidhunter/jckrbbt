// config/constants.js
// Extracted constants, configs, and utility functions

export const FINNHUB_KEY = process.env.REACT_APP_FINNHUB_KEY;
export const GEN_AI_KEY = process.env.REACT_APP_GEN_AI_KEY;
export const ALPHA_VANTAGE_KEY = process.env.REACT_APP_ALPHA_VANTAGE_KEY;
export const TWELVE_DATA_KEY = process.env.REACT_APP_TWELVE_DATA_KEY;
export const POLYGON_KEY = process.env.REACT_APP_POLYGON_KEY;

// ========== NEWS SOURCES FOR SCANNING ==========
export const NEWS_SOURCES = [
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

export const REPUTABLE_SOURCES = [
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

export const sourceString = REPUTABLE_SOURCES.map(s => `site:${s}`).join(" OR ");

export const cleanCompanyName = (name) => {
  if (!name) return name;
  return name
    .replace(/,?\s*(common\s+stock|class\s+[a-z](\s+common\s+stock)?|ordinary\s+shares?|american\s+depositary\s+(shares?|receipts?)|ads|adr|warrant.*|units?|series\s+[a-z]).*$/gi, '')
    .replace(/,?\s*(inc\.?|corp\.?|ltd\.?|llc\.?|plc\.?|n\.?v\.?|s\.?a\.?|co\.?|group|holdings?|enterprises?|international|&\s*co\.?)$/gi, '')
    .replace(/,?\s*$/, '')
    .trim();
};






export const extract = (tag, text) => {
  const regex = new RegExp(`\\[${tag}\\]\\s*([\\s\\S]*?)\\s*\\[\\/${tag}\\]`, "i");
  const match = text.match(regex);
  return (match && match[1]) ? match[1].trim() : "";
};

export const clean = (val) => {
  if (!val) return "";
  return val.replace(/["':`|]/g, "").trim(); // Removed \- to keep hyphens
};

export const formatText = (text) => {
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
export const calculateHV = (closePrices) => {
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
export const calculateSignalStrength = (newsData, priceData, currentPrice, volatility, aiCatalystScore, volumeRatio = 1) => {
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
export const BROKERAGE_LOGOS = {
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

export const BROKERAGE_TRADE_URLS = {
  'robinhood': (symbol) => `https://robinhood.com/stocks/${symbol}`,
  'webull': (symbol) => `https://www.webull.com/quote/${symbol.toLowerCase()}`,
  'fidelity': (symbol) => `https://digital.fidelity.com/prgw/digital/research/quote/dashboard/summary?symbol=${symbol}`,
  'schwab': (symbol) => `https://www.schwab.com/research/stocks/quotes/summary/${symbol}`,
  'charles schwab': (symbol) => `https://www.schwab.com/research/stocks/quotes/summary/${symbol}`,
  'e*trade': (symbol) => `https://us.etrade.com/etx/mkt/quotes?symbol=${symbol}`,
  'etrade': (symbol) => `https://us.etrade.com/etx/mkt/quotes?symbol=${symbol}`,
  'td ameritrade': (symbol) => `https://research.tdameritrade.com/grid/public/research/stocks/summary?symbol=${symbol}`,
  'interactive brokers': (symbol) => `https://www.interactivebrokers.com/en/index.php?f=46777&symbology=IB&symbol=${symbol}`,
  'sofi': (symbol) => `https://www.sofi.com/invest/stocks/${symbol.toLowerCase()}`,
  'public': (symbol) => `https://public.com/stocks/${symbol}`,
  'vanguard': (symbol) => `https://investor.vanguard.com/investment-products/stocks/profile/${symbol.toLowerCase()}`,
  'ally': (symbol) => `https://www.ally.com/invest/stocks/${symbol}`,
  'm1 finance': (symbol) => `https://m1.com/invest/stocks/${symbol}`,
  'm1': (symbol) => `https://m1.com/invest/stocks/${symbol}`,
};

export const getTradeUrl = (brokerageName, symbol) => {
  const lowerName = brokerageName?.toLowerCase() || '';
  for (const [key, urlFn] of Object.entries(BROKERAGE_TRADE_URLS)) {
    if (lowerName.includes(key)) return urlFn(symbol);
  }
  return null;
};

// Fallback emoji icons
export const BROKERAGE_ICONS = {
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

export const getBrokerageLogo = (name) => {
  const lowerName = name?.toLowerCase() || '';
  for (const [key, url] of Object.entries(BROKERAGE_LOGOS)) {
    if (lowerName.includes(key)) {
      return url;
    }
  }
  return null;
};

export const getBrokerageIcon = (name) => {
  const lowerName = name?.toLowerCase() || '';
  for (const [key, icon] of Object.entries(BROKERAGE_ICONS)) {
    if (lowerName.includes(key)) {
      return icon;
    }
  }
  return BROKERAGE_ICONS.default;
};





// --- TRADINGVIEW MINI CHART COMPONENT ---
