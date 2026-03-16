// components/NewsCard.js
import React, { useState } from 'react';
import { motion } from 'framer-motion';

function NewsCard({ article, aiModel }) {
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const categoryColors = {
    'Markets': '#00ff4e',
    'Stocks': '#3b82f6',
    'Crypto': '#f59e0b',
    'Tech': '#8b5cf6',
    'Economy': '#ef4444',
    'Policy': '#ec4899',
    'Earnings': '#10b981',
    'M&A': '#6366f1',
    'IPO': '#14b8a6',
    'Biotech': '#f43f5e',
    'Analyst': '#3b82f6',
    'Energy': '#eab308',
    'Layoffs': '#ef4444'
  };

  const categoryColor = categoryColors[article.category] || '#00ff4e';
  const timeAgo = new Date(article.datetime * 1000).toLocaleString();

  const handleAISummary = async (e) => {
    e.stopPropagation();
    if (summary) {
      setShowSummary(!showSummary);
      return;
    }
    setShowSummary(true);
    setSummaryLoading(true);
    try {
      const prompt = `You are a financial news analyst. Summarize this news article in 2-3 concise sentences. Focus on: what happened, why it matters for investors, and any actionable takeaway. Be direct and specific.\n\nHeadline: ${article.headline}\nDescription: ${article.summary || 'No description available.'}\nTickers mentioned: ${article.tickers?.join(', ') || 'None'}`;
      const response = await aiModel.generateContent(prompt);
      const text = response.response.text();
      setSummary(text);
    } catch (err) {
      console.error('AI summary error:', err);
      setSummary('Unable to generate summary. Try again later.');
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 md:p-6 transition-all duration-300 cursor-pointer group"
      style={{background: 'rgba(255,255,255,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.08)'}}
      onClick={() => window.open(article.url, '_blank')}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)'; e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.08)'; }}
    >
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Article Image */}
        {article.image && (
          <div className="w-full md:w-48 h-40 md:h-32 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-900">
            <img 
              src={article.image} 
              alt={article.headline}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}
        
        {/* Article Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3 flex-wrap">
            <span 
              className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.25em] md:tracking-[0.3em] px-2 md:px-3 py-1 rounded-full"
              style={{ 
                backgroundColor: `${categoryColor}20`, 
                color: categoryColor,
                border: `1px solid ${categoryColor}40`
              }}
            >
              {article.category}
            </span>
            <span className="text-zinc-600 text-[10px] md:text-xs font-bold uppercase tracking-wider">
              {article.source}
            </span>
            <span className="text-zinc-700 text-xs hidden sm:inline">•</span>
            <span className="text-zinc-600 text-[10px] md:text-xs hidden sm:inline">{timeAgo}</span>
          </div>

          {/* Headline */}
          <h3 className="text-base md:text-xl font-black text-white mb-2 md:mb-3 leading-tight group-hover:text-[#00ff4e] transition-colors">
            {article.headline}
          </h3>

          {/* Summary */}
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed mb-3 md:mb-4 line-clamp-2">
            {article.summary}
          </p>

          {/* Ticker Tags + AI Summary Button */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {article.tickers && article.tickers.length > 0 && (
                <>
                  <span className="text-[8px] md:text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                    Mentioned:
                  </span>
                  {article.tickers.map((ticker, idx) => (
                    <span 
                      key={idx}
                      className="text-[9px] md:text-[10px] font-black bg-zinc-900 text-[#00ff4e] px-2 py-1 rounded border border-zinc-800 uppercase tracking-wider"
                    >
                      ${ticker}
                    </span>
                  ))}
                </>
              )}
            </div>
            {aiModel && (
              <button
                onClick={handleAISummary}
                className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full transition-all duration-200"
                style={{
                  backgroundColor: showSummary ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)',
                  color: '#a78bfa',
                  border: `1px solid ${showSummary ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.2)'}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(139,92,246,0.25)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = showSummary ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)'; e.currentTarget.style.borderColor = showSummary ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.2)'; }}
              >
                ✦ AI Summary {showSummary && summary ? '▲' : '▼'}
              </button>
            )}
          </div>

          {/* AI Summary Dropdown */}
          {showSummary && (
            <div 
              className="mt-3 p-3 rounded-lg text-xs md:text-sm leading-relaxed"
              style={{
                backgroundColor: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.2)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {summaryLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  <span className="text-purple-300/70 text-xs font-bold">Analyzing article...</span>
                </div>
              ) : (
                <p className="text-zinc-300">{summary}</p>
              )}
            </div>
          )}
        </div>

        {/* Arrow indicator - hidden on mobile */}
        <div className="hidden md:flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[#00ff4e] text-2xl">→</span>
        </div>
      </div>
    </motion.div>
  );
}

export default NewsCard;
