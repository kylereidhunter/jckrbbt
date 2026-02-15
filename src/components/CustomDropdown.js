// components/CustomDropdown.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import { ChevronDown } from 'lucide-react';

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

export default CustomDropdown;
