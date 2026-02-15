// components/MiniChart.js
import React from 'react';

const MiniChart = ({ symbol }) => {
  const cleanSymbol = symbol ? symbol.split(/[^a-zA-Z]/)[0].toUpperCase() : "";

  const settings = {
    "symbol": cleanSymbol,
    "width": "100%",
    "height": 220,
    "locale": "en",
    "dateRange": "1D",
    "colorTheme": "dark",
    "trendLineColor": "#00ff4e",
    "underLineColor": "rgba(0, 255, 78, 0.3)",
    "underLineBottomColor": "rgba(0, 0, 0, 0)",
    "isTransparent": true,
    "autosize": false
  };

  const encodedSettings = encodeURIComponent(JSON.stringify(settings));
  const chartUrl = `https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=en#${encodedSettings}`;

  return (
    <div style={{ height: '220px', width: '100%', overflow: 'hidden', background: '#000', borderRadius: '8px' }}>
      {cleanSymbol ? (
        <iframe
          key={cleanSymbol}
          title={`chart-${cleanSymbol}`}
          src={chartUrl}
          width="100%"
          height="220"
          style={{ border: 'none' }}
          allowtransparency="true" 
          scrolling="no"
        />
      ) : (
        <div className="flex items-center justify-center h-full text-zinc-800 text-[10px] uppercase font-black">
          Invalid Ticker
        </div>
      )}
    </div>
  );
};

export default MiniChart;
