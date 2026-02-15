// components/StockChart.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Bar } from 'recharts';

const StockChart = ({ symbol, polygonKey, isMarketOpen, livePrice }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1D');
  const [showVolume, setShowVolume] = useState(false);
  const [priceChange, setPriceChange] = useState(null);
  const [hoverData, setHoverData] = useState(null);
  const [chartPrevClose, setChartPrevClose] = useState(null);
  

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

      let formatted = data.results.map((bar) => {
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

      // For 1D, filter to only today's bars and use prevClose for change
      if (range === '1D') {
        const todayStr = new Date().toLocaleDateString();
        const todayBars = formatted.filter(bar => new Date(bar.timestamp).toLocaleDateString() === todayStr);
        if (todayBars.length > 0) formatted = todayBars;
        
        // Fetch prevClose from snapshot for accurate 1D change
        try {
          const snapRes = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${symbol}&apiKey=${polygonKey}`);
          const snapData = await snapRes.json();
          const prevClose = snapData.tickers?.[0]?.prevDay?.c;
          if (prevClose) {
            setChartPrevClose(prevClose);
            const last = formatted[formatted.length - 1].price;
            setPriceChange(((last - prevClose) / prevClose) * 100);
          } else if (formatted.length >= 2) {
            const first = formatted[0].price;
            const last = formatted[formatted.length - 1].price;
            setPriceChange(((last - first) / first) * 100);
          }
        } catch {
          if (formatted.length >= 2) {
            const first = formatted[0].price;
            const last = formatted[formatted.length - 1].price;
            setPriceChange(((last - first) / first) * 100);
          }
        }
      } else if (formatted.length >= 2) {
        const first = formatted[0].price;
        const last = formatted[formatted.length - 1].price;
        setPriceChange(((last - first) / first) * 100);
      }

      setChartData(formatted);
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

  // Recalculate 1D change when livePrice updates
  useEffect(() => {
    if (timeRange === '1D' && livePrice && chartPrevClose) {
      setPriceChange(((livePrice - chartPrevClose) / chartPrevClose) * 100);
    }
  }, [livePrice, chartPrevClose, timeRange]);

  // For 1D, append live price as the latest data point if it's newer
  const displayChartData = useMemo(() => {
    if (timeRange !== '1D' || !livePrice || chartData.length === 0) return chartData;
    const lastBar = chartData[chartData.length - 1];
    // Only add if live price differs meaningfully from last bar
    if (Math.abs(livePrice - lastBar.price) < 0.001) return chartData;
    const now = new Date();
    return [...chartData, {
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: now.getTime(),
      price: livePrice,
      volume: 0,
    }];
  }, [chartData, livePrice, timeRange]);

  const isPositive = priceChange === null ? true : priceChange >= 0;
  const chartColor = isPositive ? '#00ff4e' : '#FF4B2B';
  const gradientId = `gradient-${symbol}-${timeRange}`;
  const volumeGradientId = `vol-gradient-${symbol}`;

  // Display price from hover or latest (prefer livePrice for real-time accuracy)
  const lastBarPrice = chartData[chartData.length - 1]?.price;
  const currentBestPrice = (timeRange === '1D' && livePrice) ? livePrice : lastBarPrice;
  const displayPrice = hoverData?.price ?? currentBestPrice;
  const displayTime = hoverData?.time ?? null;

  // Format volume for tooltip
  const formatVol = (v) => {
    if (!v) return '0';
    if (v >= 1000000000) return (v / 1000000000).toFixed(1) + 'B';
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
    return v.toString();
  };

  // Custom tooltip - shows price at cursor position
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      // Update hover state for header display
      if (!hoverData || hoverData.timestamp !== data.timestamp) {
        setTimeout(() => setHoverData(data), 0);
      }
      return (
        <div className="bg-black/90 border border-zinc-700 rounded px-2 py-1 shadow-lg" style={{ pointerEvents: 'none' }}>
          <p className="text-xs font-black text-white tabular-nums">${data.price?.toFixed(2)}</p>
          <p className="text-[9px] text-zinc-500 font-mono">{data.time}</p>
        </div>
      );
    }
    return null;
  };

  // Calculate Y-axis domain with padding
  const prices = displayChartData.map(d => d.price).filter(Boolean);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const pricePadding = (maxPrice - minPrice) * 0.1 || 1;

  return (
<div className="bg-black/70 border border-zinc-700 rounded-xl p-3 md:p-4">     
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
                  {/* Live indicator */}
        <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
          isMarketOpen ? 'text-[#00ff4e]' : 'text-zinc-600'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${
            isMarketOpen 
              ? 'bg-[#00ff4e] shadow-[0_0_6px_#00ff4e] animate-pulse' 
              : 'bg-zinc-700'
          }`} />
          {isMarketOpen ? 'LIVE' : 'CLOSED'}
        </span>
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
      ) : displayChartData.length === 0 ? (
        <div className="h-[200px] md:h-[260px] flex items-center justify-center">
          <span className="text-xs text-zinc-600 font-bold uppercase tracking-wider">No data available</span>
        </div>
      ) : (
        <div 
          className="h-[200px] md:h-[260px]"
          onMouseLeave={() => setHoverData(null)}
        >
         <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart 
              data={displayChartData} 
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
              <RechartsTooltip 
                content={<CustomTooltip />}
                cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer Stats */}
      {displayChartData.length > 0 && (
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
          <span className="text-[8px] text-zinc-700 font-mono">{timeRange} · {displayChartData.length} bars</span>
        </div>
      )}
    </div>
  );
};

export default StockChart;
