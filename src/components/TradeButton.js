// components/TradeButton.js
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, ChevronDown } from 'lucide-react';
import { getTradeUrl, getBrokerageLogo } from '../config/constants';

const TradeButton = ({ symbol, connectedBrokerages = [] }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const brokeragesWithUrls = connectedBrokerages
    .map(b => ({ ...b, url: getTradeUrl(b.name, symbol) }))
    .filter(b => b.url);


  if (brokeragesWithUrls.length === 0) return null;

  // Single brokerage — just link directly
  if (brokeragesWithUrls.length === 1) {
    return (
      <a
        href={brokeragesWithUrls[0].url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg border border-[#00ff4e]/30 bg-[#00ff4e]/5 hover:bg-[#00ff4e]/15 hover:border-[#00ff4e] transition-all active:scale-95"
      >
        <Briefcase size={12} className="text-[#00ff4e]" />
        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-[#00ff4e]">
          Trade on {brokeragesWithUrls[0].name}
        </span>
      </a>
    );
  }

  // Multiple brokerages — dropdown
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg border border-[#00ff4e]/30 bg-[#00ff4e]/5 hover:bg-[#00ff4e]/15 hover:border-[#00ff4e] transition-all active:scale-95"
      >
        <Briefcase size={12} className="text-[#00ff4e]" />
        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-[#00ff4e]">
          Trade
        </span>
        <ChevronDown size={12} className={`text-[#00ff4e] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-2 right-0 bg-black border-2 border-zinc-800 rounded-lg shadow-2xl overflow-hidden z-50 min-w-[200px]"
          >
            {brokeragesWithUrls.map((b) => (
              <a
                key={b.id}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors border-b border-zinc-900 last:border-0"
              >
                <Briefcase size={14} className="text-[#00ff4e]" />
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  {b.name}
                </span>
                <span className="ml-auto text-zinc-600 text-[10px]">→</span>
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TradeButton;
