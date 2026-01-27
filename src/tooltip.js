import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Tooltip({ content, children }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
        <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full border border-zinc-700 text-zinc-500 hover:border-[#00ff4e] hover:text-[#00ff4e] transition-all cursor-help"
        style={{ paddingTop: '1px' }}
        >
        <span className="text-[8px] font-black leading-none">i</span>
        </button>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-64 p-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl left-1/2 transform -translate-x-1/2 bottom-full mb-2"
          >
            {/* Arrow pointing down */}
            <div className="absolute left-1/2 transform -translate-x-1/2 top-full">
              <div className="border-8 border-transparent border-t-zinc-900" style={{ marginTop: '-1px' }}></div>
              <div className="absolute left-1/2 transform -translate-x-1/2 -top-[17px]">
                <div className="border-8 border-transparent border-t-zinc-800"></div>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {content}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}