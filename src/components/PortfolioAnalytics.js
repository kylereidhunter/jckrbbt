// components/PortfolioAnalytics.js
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { Target, TrendingUp, Wallet, BarChart3 } from 'lucide-react';

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
        <div className="rounded-xl p-4 md:p-5 relative overflow-hidden group transition-all" style={{background: 'linear-gradient(135deg, rgba(50,50,50,0.95) 0%, rgba(25,25,25,0.98) 50%), radial-gradient(ellipse at 10% 0%, rgba(255,255,255,0.06) 0%, transparent 50%)', boxShadow: '0 4px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0,255,78,0.03), inset 0 1px 0 rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)'}}>
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
        <div className="rounded-xl p-4 md:p-5 relative overflow-hidden group transition-all" style={{background: 'linear-gradient(135deg, rgba(50,50,50,0.95) 0%, rgba(25,25,25,0.98) 50%), radial-gradient(ellipse at 10% 0%, rgba(255,255,255,0.06) 0%, transparent 50%)', boxShadow: '0 4px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0,255,78,0.03), inset 0 1px 0 rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)'}}>
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
        <div className="rounded-xl p-4 md:p-5 relative overflow-hidden group transition-all" style={{background: 'linear-gradient(135deg, rgba(50,50,50,0.95) 0%, rgba(25,25,25,0.98) 50%), radial-gradient(ellipse at 10% 0%, rgba(255,255,255,0.06) 0%, transparent 50%)', boxShadow: '0 4px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0,255,78,0.03), inset 0 1px 0 rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)'}}>
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
        <div className="rounded-xl p-4 md:p-5 relative overflow-hidden group transition-all" style={{background: 'linear-gradient(135deg, rgba(50,50,50,0.95) 0%, rgba(25,25,25,0.98) 50%), radial-gradient(ellipse at 10% 0%, rgba(255,255,255,0.06) 0%, transparent 50%)', boxShadow: '0 4px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0,255,78,0.03), inset 0 1px 0 rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)'}}>
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
      <div className="rounded-xl p-4 md:p-5" style={{background: 'linear-gradient(135deg, rgba(40,40,40,0.9) 0%, rgba(15,15,15,0.95) 50%), radial-gradient(ellipse at 10% 0%, rgba(255,255,255,0.04) 0%, transparent 50%)', boxShadow: '0 0 20px rgba(0,255,78,0.03), inset 0 1px 0 rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderTop: '1px solid rgba(0,255,78,0.15)'}}>
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
      <div className="rounded-xl p-4 md:p-6 overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(40,40,40,0.9) 0%, rgba(15,15,15,0.95) 50%), radial-gradient(ellipse at 10% 0%, rgba(255,255,255,0.04) 0%, transparent 50%)', boxShadow: '0 0 20px rgba(0,255,78,0.03), inset 0 1px 0 rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderTop: '1px solid rgba(0,255,78,0.15)'}}>
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

export default PortfolioAnalytics;
