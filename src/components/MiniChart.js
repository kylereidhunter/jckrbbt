// components/MiniChart.js
// Web port of PositionChart.js — custom SVG chart via Polygon proxy
// Matches mobile app: time range tabs, SMA overlays, volume bars, crosshair
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const FUNCTIONS_URL = 'https://us-central1-jckrbbt-869de.cloudfunctions.net';

const TIME_RANGES = [
  { label: '1D', multiplier: 5,  timespan: 'minute', days: 1   },
  { label: '1W', multiplier: 15, timespan: 'minute', days: 7   },
  { label: '1M', multiplier: 1,  timespan: 'hour',   days: 30  },
  { label: '3M', multiplier: 1,  timespan: 'day',    days: 90  },
  { label: '6M', multiplier: 1,  timespan: 'day',    days: 180 },
  { label: '1Y', multiplier: 1,  timespan: 'day',    days: 365 },
];

const SMA_OPTIONS = {
  '3M': [20, 50],
  '6M': [20, 50],
  '1Y': [20, 50, 200],
};

const SMA_COLORS = {
  20:  '#38bdf8',
  50:  '#facc15',
  200: '#c084fc',
};

const CHART_HEIGHT  = 160;
const PADDING       = { top: 10, right: 10, bottom: 20, left: 50 };
const VOL_HEIGHT    = 28;

function calcSMA(prices, window) {
  if (prices.length < window) return [];
  const result = new Array(window - 1).fill(null);
  let sum = 0;
  for (let i = 0; i < window; i++) sum += prices[i];
  result.push(sum / window);
  for (let i = window; i < prices.length; i++) {
    sum += prices[i] - prices[i - window];
    result.push(sum / window);
  }
  return result;
}

const MiniChart = ({ symbol, livePrice, liveChange, isMarketOpen }) => {
  const cleanSymbol = symbol ? symbol.split(/[^a-zA-Z]/)[0].toUpperCase() : '';

  const containerRef = useRef(null);
  const [width, setWidth]           = useState(600);
  const [chartData, setChartData]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [timeRange, setTimeRange]   = useState('1M');
  const [priceChange, setPriceChange] = useState(null);
  const [activeSMAs, setActiveSMAs] = useState({});
  const [showVolume, setShowVolume] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);

  // Responsive width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width || 600);
    });
    ro.observe(el);
    setWidth(el.clientWidth || 600);
    return () => ro.disconnect();
  }, []);

  // Fetch chart data
  const fetchChartData = useCallback(async (range) => {
    if (!cleanSymbol) return;
    setLoading(true);

    const config = TIME_RANGES.find(r => r.label === range);
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - config.days);

    const smaOpts = SMA_OPTIONS[range];
    if (smaOpts) {
      const maxWindow = Math.max(...smaOpts);
      from.setDate(from.getDate() - Math.ceil(maxWindow * 1.5));
    }

    if (range === '1D') {
      const day = to.getDay();
      if (day === 0) from.setDate(from.getDate() - 2);
      if (day === 6) from.setDate(from.getDate() - 1);
    }

    const fromStr = from.toISOString().split('T')[0];
    const toStr   = to.toISOString().split('T')[0];
    const path    = `/v2/aggs/ticker/${cleanSymbol}/range/${config.multiplier}/${config.timespan}/${fromStr}/${toStr}`;

    try {
      const params = new URLSearchParams({ path, adjusted: 'true', sort: 'asc', limit: '5000' });
      const res  = await fetch(`${FUNCTIONS_URL}/polygonProxy?${params.toString()}`);
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        setChartData([]);
        setLoading(false);
        return;
      }

      let formatted = data.results.map((bar) => {
        const date = new Date(bar.t);
        let label;
        if (range === '1D')               label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        else if (range === '1W')          label = date.toLocaleDateString([], { weekday: 'short' });
        else if (range === '1M' || range === '3M') label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        else                              label = date.toLocaleDateString([], { month: 'short', year: '2-digit' });
        return { time: label, timestamp: bar.t, price: bar.c, volume: bar.v };
      });

      let prevClose = null;
      if (range === '1D') {
        const todayStr  = new Date().toLocaleDateString();
        const prevBars  = formatted.filter(b => new Date(b.timestamp).toLocaleDateString() !== todayStr);
        if (prevBars.length > 0) prevClose = prevBars[prevBars.length - 1].price;
        const todayBars = formatted.filter(b => new Date(b.timestamp).toLocaleDateString() === todayStr);
        if (todayBars.length > 0) formatted = todayBars;
      }

      if (formatted.length >= 2) {
        const last = formatted[formatted.length - 1].price;
        let base;
        if (range === '1D' && prevClose) {
          base = prevClose;
        } else {
          const rangeStart  = Date.now() - (config.days * 24 * 60 * 60 * 1000);
          const visibleBars = formatted.filter(b => b.timestamp >= rangeStart);
          base = (visibleBars.length > 0 ? visibleBars[0] : formatted[0]).price;
        }
        setPriceChange(((last - base) / base) * 100);
      }

      setChartData(formatted);
    } catch (e) {
      console.error('MiniChart fetch error:', e);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [cleanSymbol]);

  useEffect(() => { fetchChartData(timeRange); }, [timeRange, fetchChartData]);

  useEffect(() => {
    if (!SMA_OPTIONS[timeRange]) setActiveSMAs({});
    setActiveIndex(null);
  }, [timeRange]);

  const toggleSMA = (w) => {
    const supported = SMA_OPTIONS[timeRange];
    if (!supported || !supported.includes(w)) {
      setTimeRange('3M');
      setActiveSMAs({ [w]: true });
      return;
    }
    setActiveSMAs(prev => ({ ...prev, [w]: !prev[w] }));
  };

  const effectiveChange = (timeRange === '1D' && liveChange != null) ? liveChange : priceChange;
  const isPositive  = effectiveChange === null ? true : effectiveChange >= 0;
  const chartColor  = isPositive ? '#00ff4e' : '#FF4B2B';
  const smaOptions  = SMA_OPTIONS[timeRange] || [];
  const hasSMASupport = smaOptions.length > 0;

  const displayStart = useMemo(() => {
    if (!hasSMASupport || chartData.length === 0) return 0;
    const targetBars = timeRange === '3M' ? 63 : timeRange === '6M' ? 126 : 252;
    return Math.max(0, chartData.length - targetBars);
  }, [chartData, timeRange, hasSMASupport]);

  const smaData = useMemo(() => {
    if (!hasSMASupport || chartData.length < 2) return {};
    const prices = chartData.map(d => d.price);
    const result = {};
    for (const w of smaOptions) result[w] = calcSMA(prices, w);
    return result;
  }, [chartData, smaOptions, hasSMASupport]);

  const drawW = width - PADDING.left - PADDING.right;
  const drawH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const { linePath, areaPath, yLabels, minPrice, maxPrice, smaPaths, displayData } = useMemo(() => {
    if (chartData.length < 2) return { linePath: '', areaPath: '', yLabels: [], minPrice: 0, maxPrice: 0, smaPaths: {}, displayData: [] };

    const dd = chartData.slice(displayStart);
    if (dd.length < 2) return { linePath: '', areaPath: '', yLabels: [], minPrice: 0, maxPrice: 0, smaPaths: {}, displayData: [] };

    let allValues = dd.map(d => d.price);
    for (const w of smaOptions) {
      if (activeSMAs[w] && smaData[w]) {
        smaData[w].slice(displayStart).forEach(v => { if (v != null) allValues.push(v); });
      }
    }

    const min  = Math.min(...allValues);
    const max  = Math.max(...allValues);
    const pad  = (max - min) * 0.1 || 1;
    const yMin = min - pad;
    const yMax = max + pad;

    const toX = (i) => PADDING.left + (i / (dd.length - 1)) * drawW;
    const toY = (v) => PADDING.top + drawH - ((v - yMin) / (yMax - yMin)) * drawH;

    let line = `M ${toX(0)} ${toY(dd[0].price)}`;
    for (let i = 1; i < dd.length; i++) line += ` L ${toX(i)} ${toY(dd[i].price)}`;
    const area = `${line} L ${toX(dd.length - 1)} ${CHART_HEIGHT - PADDING.bottom} L ${toX(0)} ${CHART_HEIGHT - PADDING.bottom} Z`;

    const mid    = (min + max) / 2;
    const labels = [max, mid, min].map(val => ({
      y: toY(val),
      label: val >= 100 ? `$${val.toFixed(0)}` : `$${val.toFixed(2)}`,
    }));

    const smaPts = {};
    for (const w of smaOptions) {
      if (!activeSMAs[w] || !smaData[w]) continue;
      const slice = smaData[w].slice(displayStart);
      let started = false, path = '';
      for (let i = 0; i < slice.length; i++) {
        if (slice[i] == null) continue;
        if (!started) { path = `M ${toX(i)} ${toY(slice[i])}`; started = true; }
        else          path += ` L ${toX(i)} ${toY(slice[i])}`;
      }
      if (path) smaPts[w] = path;
    }

    return { linePath: line, areaPath: area, yLabels: labels, minPrice: min, maxPrice: max, smaPaths: smaPts, displayData: dd };
  }, [chartData, displayStart, activeSMAs, smaData, smaOptions, drawW, drawH]);

  // Volume bars
  const volBars = useMemo(() => {
    if (!showVolume || !linePath || !displayData?.length) return [];
    const dd   = displayData;
    const maxV = Math.max(...dd.map(d => d.volume || 0)) || 1;
    const bW   = Math.max(2, (drawW / dd.length) - 0.5);
    const top  = CHART_HEIGHT + 4;
    return dd.map((d, i) => {
      const x  = PADDING.left + (dd.length > 1 ? (i / (dd.length - 1)) * drawW : drawW / 2) - bW / 2;
      const h  = ((d.volume || 0) / maxV) * VOL_HEIGHT;
      const up = i > 0 ? d.price >= dd[i - 1].price : true;
      return { x, y: top + VOL_HEIGHT - h, w: bW, h, color: up ? 'rgba(0,255,78,0.5)' : 'rgba(255,75,43,0.5)' };
    });
  }, [displayData, showVolume, drawW, linePath]);

  const totalHeight = showVolume ? CHART_HEIGHT + VOL_HEIGHT + 8 : CHART_HEIGHT;

  // Crosshair active point
  const activePoint = useMemo(() => {
    if (activeIndex === null || !linePath || !displayData?.length) return null;
    const d = displayData[activeIndex];
    if (!d) return null;
    const pad  = (maxPrice - minPrice) * 0.1 || 1;
    const yMin = minPrice - pad;
    const yMax = maxPrice + pad;
    const x = PADDING.left + (activeIndex / (displayData.length - 1)) * drawW;
    const y = PADDING.top + drawH - ((d.price - yMin) / (yMax - yMin)) * drawH;
    return { x, y, price: d.price, time: d.timestamp, volume: d.volume };
  }, [activeIndex, displayData, drawW, drawH, minPrice, maxPrice, linePath]);

  // Last price dot coords
  const lastDot = useMemo(() => {
    if (!linePath || !displayData?.length || activePoint) return null;
    const pad  = (maxPrice - minPrice) * 0.1 || 1;
    const yMin = minPrice - pad;
    const yMax = maxPrice + pad;
    const last = displayData[displayData.length - 1];
    const x = PADDING.left + drawW;
    const y = PADDING.top + drawH - ((last.price - yMin) / (yMax - yMin)) * drawH;
    return { x, y };
  }, [linePath, displayData, drawW, drawH, minPrice, maxPrice, activePoint]);

  // Mouse/touch interaction
  const handlePointer = useCallback((e) => {
    if (!displayData?.length || displayData.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const tx = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (tx - PADDING.left) / drawW));
    setActiveIndex(Math.round(ratio * (displayData.length - 1)));
  }, [displayData, drawW]);

  const fmtVol = (v) => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : String(v);
  const fmtDate = (t) => {
    const d = new Date(t);
    return timeRange === '1D'
      ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const lastPrice    = chartData[chartData.length - 1]?.price;
  const headerPrice  = (timeRange === '1D' && livePrice)  ? livePrice  : lastPrice;
  const headerChange = (timeRange === '1D' && liveChange != null) ? liveChange : priceChange;

  if (!cleanSymbol) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', borderRadius: 8, color: '#3f3f46', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 2 }}>
        Invalid Ticker
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {isMarketOpen && <span style={{ ...styles.dot, backgroundColor: chartColor, boxShadow: `0 0 6px ${chartColor}` }} />}
          <span style={styles.symbolText}>{cleanSymbol}</span>
          {headerPrice != null && (
            <span style={styles.priceText}>${headerPrice.toFixed(2)}</span>
          )}
          {headerChange != null && (
            <span style={{ ...styles.changeText, color: chartColor }}>
              {headerChange >= 0 ? '+' : ''}{headerChange.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* Time Range Tabs */}
      <div style={styles.tabs}>
        {TIME_RANGES.map(({ label }) => (
          <button
            key={label}
            onClick={() => setTimeRange(label)}
            style={{
              ...styles.tab,
              ...(timeRange === label ? { backgroundColor: chartColor, color: '#000' } : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* SMA + Volume Toggles */}
      {!loading && chartData.length > 0 && (
        <div style={styles.smaRow}>
          {/* Volume toggle */}
          <button
            onClick={() => setShowVolume(v => !v)}
            style={{
              ...styles.smaToggle,
              ...(showVolume ? { backgroundColor: 'rgba(0,255,78,0.08)', borderColor: 'rgba(0,255,78,0.3)' } : {}),
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: showVolume ? '#00ff4e' : '#333', display: 'inline-block', marginRight: 5 }} />
            <span style={{ ...styles.smaLabel, ...(showVolume ? { color: '#00ff4e' } : {}) }}>VOL</span>
          </button>

          {/* SMA 20 & 50 always shown */}
          {[20, 50].map(w => (
            <button
              key={w}
              onClick={() => toggleSMA(w)}
              style={{
                ...styles.smaToggle,
                ...(activeSMAs[w] ? { backgroundColor: SMA_COLORS[w] + '20', borderColor: SMA_COLORS[w] + '60' } : {}),
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: activeSMAs[w] ? SMA_COLORS[w] : '#333', display: 'inline-block', marginRight: 5 }} />
              <span style={{ ...styles.smaLabel, ...(activeSMAs[w] ? { color: SMA_COLORS[w] } : {}) }}>SMA {w}</span>
            </button>
          ))}

          {/* SMA 200 only on 1Y */}
          {smaOptions.includes(200) && (
            <button
              onClick={() => toggleSMA(200)}
              style={{
                ...styles.smaToggle,
                ...(activeSMAs[200] ? { backgroundColor: SMA_COLORS[200] + '20', borderColor: SMA_COLORS[200] + '60' } : {}),
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: activeSMAs[200] ? SMA_COLORS[200] : '#333', display: 'inline-block', marginRight: 5 }} />
              <span style={{ ...styles.smaLabel, ...(activeSMAs[200] ? { color: SMA_COLORS[200] } : {}) }}>SMA 200</span>
            </button>
          )}
        </div>
      )}

      {/* Chart Area */}
      {loading ? (
        <div style={styles.loadingWrap}>
          <span style={styles.spinner} />
          <span style={styles.loadingText}>Loading chart...</span>
        </div>
      ) : chartData.length === 0 ? (
        <div style={styles.loadingWrap}>
          <span style={styles.loadingText}>No data available</span>
        </div>
      ) : (
        <div>
          {/* Touch info bar */}
          {activePoint && (
            <div style={styles.touchInfo}>
              <span style={styles.touchPrice}>${activePoint.price.toFixed(2)}</span>
              <span style={styles.touchDate}>{fmtDate(activePoint.time)}</span>
              {activePoint.volume > 0 && <span style={styles.touchVol}>Vol: {fmtVol(activePoint.volume)}</span>}
            </div>
          )}

          {/* SVG Chart */}
          <svg
            width={width}
            height={totalHeight}
            style={{ display: 'block', cursor: 'crosshair', userSelect: 'none' }}
            onMouseMove={handlePointer}
            onMouseLeave={() => setActiveIndex(null)}
            onTouchMove={(e) => { e.preventDefault(); handlePointer(e); }}
            onTouchEnd={() => setActiveIndex(null)}
          >
            <defs>
              <linearGradient id={`grad-${cleanSymbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Y-axis grid + labels */}
            {yLabels.map((tick, i) => (
              <React.Fragment key={i}>
                <line x1={PADDING.left} y1={tick.y} x2={width - PADDING.right} y2={tick.y}
                  stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                <text x={PADDING.left - 6} y={tick.y + 3} fill="#737373" fontSize={9}
                  fontFamily="monospace" textAnchor="end">
                  {tick.label}
                </text>
              </React.Fragment>
            ))}

            {/* Area fill */}
            <path d={areaPath} fill={`url(#grad-${cleanSymbol})`} />

            {/* Price line */}
            <path d={linePath} stroke={chartColor} strokeWidth={1.5} fill="none" />

            {/* SMA overlay lines */}
            {Object.entries(smaPaths || {}).map(([w, path]) => (
              <path
                key={`sma-${w}`}
                d={path}
                stroke={SMA_COLORS[Number(w)]}
                strokeWidth={1}
                strokeOpacity={0.8}
                fill="none"
                strokeDasharray={w === '200' ? '4,3' : undefined}
              />
            ))}

            {/* Volume bars */}
            {showVolume && volBars.map((b, i) => (
              <rect key={i} x={b.x} y={b.y} width={b.w} height={Math.max(0, b.h)} fill={b.color} rx={0.5} />
            ))}

            {/* Crosshair */}
            {activePoint && (
              <>
                <line x1={activePoint.x} y1={PADDING.top} x2={activePoint.x}
                  y2={showVolume ? CHART_HEIGHT + VOL_HEIGHT + 4 : CHART_HEIGHT - PADDING.bottom}
                  stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="3,3" />
                <line x1={PADDING.left} y1={activePoint.y} x2={width - PADDING.right} y2={activePoint.y}
                  stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3,3" />
                <circle cx={activePoint.x} cy={activePoint.y} r={4} fill={chartColor} />
                <circle cx={activePoint.x} cy={activePoint.y} r={7} fill={chartColor} opacity={0.15} />
              </>
            )}

            {/* Last price dot */}
            {lastDot && (
              <>
                <circle cx={lastDot.x} cy={lastDot.y} r={3} fill={chartColor} />
                <circle cx={lastDot.x} cy={lastDot.y} r={6} fill={chartColor} opacity={0.2} />
              </>
            )}
          </svg>

          {/* Footer stats */}
          <div style={styles.footer}>
            <div style={styles.footerStat}>
              <span style={styles.footerLabel}>High</span>
              <span style={styles.footerValue}>${maxPrice.toFixed(2)}</span>
            </div>
            <div style={styles.footerStat}>
              <span style={styles.footerLabel}>Low</span>
              <span style={styles.footerValue}>${minPrice.toFixed(2)}</span>
            </div>
            {Object.keys(smaPaths || {}).length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.keys(smaPaths).map(w => {
                  const slice   = smaData[Number(w)]?.slice(displayStart) || [];
                  const lastVal = [...slice].reverse().find(v => v != null);
                  return (
                    <span key={w} style={{ fontSize: 8, fontFamily: 'monospace', color: SMA_COLORS[Number(w)] }}>
                      SMA{w}: ${lastVal?.toFixed(2) || '—'}
                    </span>
                  );
                })}
              </div>
            )}
            <span style={styles.footerMeta}>
              {timeRange} · {(displayData?.length || 0)} bars
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    background: 'transparent',
    borderRadius: 8,
    padding: '8px 0 4px',
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 8px',
    marginBottom: 8,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    display: 'inline-block',
  },
  symbolText: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#8a8a8a',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  priceText: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#fff',
  },
  changeText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    padding: '0 8px',
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    padding: '5px 0',
    borderRadius: 6,
    border: 'none',
    background: 'rgba(255,255,255,0.03)',
    color: '#8a8a8a',
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    cursor: 'pointer',
  },
  smaRow: {
    display: 'flex',
    gap: 6,
    padding: '0 8px',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  smaToggle: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.02)',
    cursor: 'pointer',
  },
  smaLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#555',
    letterSpacing: 0.5,
  },
  loadingWrap: {
    height: 160,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  spinner: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '2px solid rgba(0,255,78,0.2)',
    borderTopColor: '#00ff4e',
    display: 'inline-block',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  touchInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 8px',
    marginBottom: 6,
  },
  touchPrice: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#fff',
  },
  touchDate: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#a1a1aa',
  },
  touchVol: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#525252',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: '8px 8px 4px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    marginTop: 4,
    gap: 4,
  },
  footerStat: {
    marginRight: 12,
    display: 'flex',
    flexDirection: 'column',
  },
  footerLabel: {
    fontSize: 8,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#737373',
    textTransform: 'uppercase',
  },
  footerValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#fff',
  },
  footerMeta: {
    fontSize: 8,
    fontFamily: 'monospace',
    color: '#333',
    marginLeft: 'auto',
  },
};

// Inject spinner keyframes once
if (typeof document !== 'undefined' && !document.getElementById('minichart-spin')) {
  const style = document.createElement('style');
  style.id = 'minichart-spin';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}

export default MiniChart;
