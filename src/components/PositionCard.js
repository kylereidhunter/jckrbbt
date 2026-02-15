// components/PositionCard.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import MiniChart from './MiniChart';
import TradeButton from './TradeButton';
import StockChart from './StockChart';
import { POLYGON_KEY } from '../config/constants';

const PositionCard = React.memo(function PositionCard({
  position,
  index,
  livePrices,
  isMarketOpen,
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
  runScanner,
  editingCostBasis,
  setEditingCostBasis,
  costBasisInput,
  setCostBasisInput,
  saveCostBasisOverride,
  connectedBrokerages,
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
      className="rounded-xl p-6 transition-all duration-300 relative"
      style={{background: 'linear-gradient(135deg, rgba(40,40,40,0.9) 0%, rgba(15,15,15,0.95) 50%), radial-gradient(ellipse at 10% 0%, rgba(255,255,255,0.04) 0%, transparent 50%)', boxShadow: '0 0 20px rgba(0,255,78,0.03), inset 0 1px 0 rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderTop: '1px solid rgba(0,255,78,0.15)'}}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 30px rgba(0,255,78,0.08), inset 0 1px 0 rgba(255,255,255,0.07)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.borderTop = '1px solid rgba(0,255,78,0.25)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(0,255,78,0.03), inset 0 1px 0 rgba(255,255,255,0.05)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)'; e.currentTarget.style.borderTop = '1px solid rgba(0,255,78,0.15)'; }}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-zinc-700/50">
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
            <div className="flex items-center gap-2">
              {editingCostBasis === position.symbol ? (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">$</span>
                  <input
                    type="number"
                    value={costBasisInput}
                    onChange={(e) => setCostBasisInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveCostBasisOverride(position.symbol, costBasisInput);
                      if (e.key === 'Escape') setEditingCostBasis(null);
                    }}
                    autoFocus
                    className="w-24 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-sm font-mono focus:outline-none focus:border-[#00ff4e]/50"
                  />
                  <button
                    onClick={() => saveCostBasisOverride(position.symbol, costBasisInput)}
                    className="text-[#00ff4e] text-xs font-black px-2 py-1 hover:bg-[#00ff4e]/10 rounded"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setEditingCostBasis(null)}
                    className="text-zinc-500 text-xs font-black px-2 py-1 hover:bg-zinc-800 rounded"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-lg font-black text-white">${position.costBasis?.toLocaleString() ?? '0'}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCostBasisInput(position.costBasis?.toFixed(2) ?? '0');
                      setEditingCostBasis(position.symbol);
                    }}
                    className="text-zinc-700 hover:text-[#00ff4e] transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-600 mb-1">Gain/Loss</p>
            <p className={`text-lg font-black ${position.gain >= 0 ? 'text-[#00ff4e]' : 'text-red-500'}`}>
              {position.gain >= 0 ? '+' : ''}${Math.abs(position.gain ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
          <TradeButton symbol={position.symbol} connectedBrokerages={connectedBrokerages} />
        </div>

      {/* Chart Toggle Section */}
      <div className="mt-6 pt-4 border-t border-zinc-700/50">
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
<StockChart symbol={position.symbol} polygonKey={process.env.REACT_APP_POLYGON_KEY} isMarketOpen={isMarketOpen} livePrice={livePrices?.[position.symbol]?.price} />              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

export default PositionCard;
