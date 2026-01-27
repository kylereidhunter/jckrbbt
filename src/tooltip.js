import React, { useState } from 'react';

const Tooltip = ({ content, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="relative inline-block">
      <span
        className="ml-1 text-zinc-600 cursor-help text-[10px]"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        ⓘ
      </span>
      {isVisible && (
        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-900 text-white text-[10px] rounded-lg shadow-xl z-50 border border-zinc-800">
          {content}
          <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900"></span>
        </span>
      )}
    </span>
  );
};

export default Tooltip;