// components/PortfolioPerformanceChart.js
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const PortfolioPerformanceChart = React.memo(function PortfolioPerformanceChart({ positions, polygonKey, user, db, livePrices, brokerageName, onRefresh, refreshing }) {

  const totalCost = positions.reduce((sum, p) => sum + (p.costBasis ?? 0), 0);
  
  // Live total value using WebSocket prices when available
  const totalValue = positions.reduce((sum, p) => {
    const live = livePrices?.[p.symbol];
    const price = live?.price ?? p.price ?? 0;
    return sum + (price * (p.quantity ?? 0));
  }, 0);

  // Save daily snapshot to Firestore
  useEffect(() => {
    if (!user?.uid || !db || positions.length === 0 || totalValue === 0) return;
    
    const saveSnapshot = async () => {
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const today = new Date().toISOString().split('T')[0];
        await setDoc(doc(db, 'users', user.uid, 'portfolioSnapshots', today), {
          date: today,
          totalValue,
          totalCost,
          positionCount: positions.length,
          positions: positions.map(p => ({ 
            symbol: p.symbol, 
            quantity: p.quantity, 
            price: livePrices?.[p.symbol]?.price || p.price 
          })),
          timestamp: Date.now()
        }, { merge: true });
      } catch (e) {
        console.error('Failed to save portfolio snapshot:', e);
      }
    };
    
    saveSnapshot();
  }, [user, db, totalValue]);

  if (positions.length === 0) return null;

  const totalGain = positions.reduce((sum, p) => sum + (p.gain ?? 0), 0);
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  return (
    <div className="rounded-xl p-4 md:p-6 mb-4" style={{background: 'linear-gradient(135deg, rgba(40,40,40,0.9) 0%, rgba(15,15,15,0.95) 50%), radial-gradient(ellipse at 10% 0%, rgba(255,255,255,0.04) 0%, transparent 50%)', boxShadow: '0 0 20px rgba(0,255,78,0.03), inset 0 1px 0 rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderTop: '1px solid rgba(0,255,78,0.15)'}}>
      {/* Header with brokerage name + refresh */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">
            {brokerageName} Summary
          </h3>
          <p className="text-[9px] text-zinc-700 mt-0.5">Positions sync daily via Plaid · Recent trades may take up to 24 hours</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-[#00ff4e] transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Main Value */}
      <div className="mb-4">
        <p className="text-3xl md:text-4xl font-black text-white tabular-nums leading-none">
          ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider mb-1">Total Gain/Loss</p>
          <p className={`text-lg md:text-xl font-black tabular-nums ${totalGain >= 0 ? 'text-[#00ff4e]' : 'text-red-500'}`}>
            {totalGain >= 0 ? '+' : ''}${Math.abs(totalGain).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-zinc-600 tabular-nums">
            {totalGainPercent >= 0 ? '+' : ''}{totalGainPercent.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider mb-1">Cost Basis</p>
          <p className="text-lg md:text-xl font-black text-white tabular-nums">
            ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-wider mb-1">Positions</p>
          <p className="text-lg md:text-xl font-black text-white">{positions.length}</p>
        </div>
      </div>
    </div>
  );
});

export default PortfolioPerformanceChart;
