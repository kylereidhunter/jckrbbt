import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageCircle, ExternalLink } from 'lucide-react';

const StockChatModal = ({ isOpen, onClose, stock, aiModel }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef(null);
  const isUserScrolledUp = useRef(false);

  // Auto-scroll chat container only
  useEffect(() => {
    if (!isUserScrolledUp.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Lock page scroll completely when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (scrollY) window.scrollTo(0, parseInt(scrollY) * -1);
    };
  }, [isOpen]);

  // Reset when stock changes + handle suggested prompt
  useEffect(() => {
    if (isOpen && stock) {
      setMessages([{
        role: 'assistant',
        text: `I can help you research **${stock.symbol}** (${stock.name}). I have access to web search for the latest data.\n\nCurrently trading at $${stock.price} (${parseFloat(stock.change) >= 0 ? '+' : ''}${stock.change}%)${stock.catalyst ? `\n\n**What's happening:** ${stock.catalyst}` : ''}\n\nWhat would you like to know?`
      }]);
      
      if (stock.suggestedPrompt) {
        setInput(stock.suggestedPrompt);
        setTimeout(() => {
          sendMessageDirect(stock.suggestedPrompt);
        }, 500);
      } else {
        setInput('');
      }
    }
  }, [isOpen, stock?.symbol, stock?.suggestedPrompt]);

  const buildContext = (userQuestion) => {
    const dataPoints = [];
    dataPoints.push(`Price: $${stock.price}`);
    dataPoints.push(`Change: ${parseFloat(stock.change) >= 0 ? '+' : ''}${stock.change}%`);
    if (stock.catalyst) dataPoints.push(`Catalyst: ${stock.catalyst}`);
    if (stock.catalystType) dataPoints.push(`Trigger Type: ${stock.catalystType}`);
    if (stock.volume) dataPoints.push(`Volume: ${stock.volume.toLocaleString()}`);
    if (stock.volumeRatio) dataPoints.push(`Volume vs Average: ${stock.volumeRatio}x`);
    if (stock.industry) dataPoints.push(`Industry: ${stock.industry}`);
    if (stock.newsCount) dataPoints.push(`Recent articles: ${stock.newsCount}`);
    if (stock.headline) dataPoints.push(`Latest headline: "${stock.headline}"`);
    if (stock.newsSource) dataPoints.push(`Source: ${stock.newsSource}`);
    
    let newsContext = '';
    if (stock.news && stock.news.length > 0) {
      newsContext = '\n\nRECENT NEWS ARTICLES:\n' + stock.news.map((n, i) => 
        `${i + 1}. "${n.title}" (${n.publisher?.name || 'Unknown'}, ${n.published_utc ? new Date(n.published_utc).toLocaleDateString() : 'Recent'})`
      ).join('\n');
    }

    return `You are an expert stock analyst helping a trader research ${stock.symbol} (${stock.name}). You have access to web search to find any information not provided below.

CURRENT DATA:
${dataPoints.join('\n')}
${newsContext}

User question: ${userQuestion}

INSTRUCTIONS:
- Be direct and actionable (2-5 sentences unless the question warrants more detail)
- If the question requires information NOT in the data above (earnings dates, financials, analyst ratings, company background, etc.), use web search
- When using web search, search for specific things like "${stock.symbol} earnings date 2025", "${stock.symbol} analyst price target", "${stock.name} revenue growth"
- Always cite sources when using search results
- Frame insights in terms of actionable trading decisions
- Be honest about uncertainty — say "I'd need to verify" rather than guessing
- Never give direct buy/sell recommendations, but DO give the information needed to make a decision`;
  };

  const sendMessageDirect = async (messageText) => {
    if (!messageText.trim() || isLoading) return;
    
    const userMessage = { role: 'user', text: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    isUserScrolledUp.current = false;

    try {
      const context = buildContext(messageText);
      
      const response = await aiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: context }] }],
        tools: [{ googleSearch: {} }]
      });
      const aiText = await response.response.text();
      
      setMessages(prev => [...prev, { role: 'assistant', text: aiText }]);
    } catch (error) {
      console.error('AI chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    await sendMessageDirect(input);
  };

  const suggestedQuestions = [
    { text: "Why is this moving?", icon: "🔍" },
    { text: "What's the bull case?", icon: "🐂" },
    { text: "What are the key risks?", icon: "⚠️" },
    { text: "Good entry point?", icon: "🎯" },
    { text: "What do analysts say?", icon: "📊" },
    { text: "Upcoming catalysts or events?", icon: "📅" },
  ];

  if (!isOpen || !stock) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-[100000] flex items-center justify-center p-4"
      style={{ overscrollBehavior: 'contain' }}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-[#050505] border-2 border-zinc-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={{ overscrollBehavior: 'contain' }}
      >
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b-2 border-zinc-900 flex justify-between items-start flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">{stock.symbol}</h3>
              <span className="text-[8px] font-black bg-[#00ff4e]/10 text-[#00ff4e] px-2 py-1 rounded border border-[#00ff4e]/30 uppercase tracking-wider">
                AI Research
              </span>
            </div>
            <p className="text-xs md:text-sm text-zinc-500 mt-1">{stock.name}</p>
            <div className="flex gap-3 mt-2">
              <span className="text-xs font-black text-white">${stock.price}</span>
              <span className={`text-xs font-black ${parseFloat(stock.change) >= 0 ? 'text-[#00ff4e]' : 'text-red-500'}`}>
                {parseFloat(stock.change) >= 0 ? '+' : ''}{stock.change}%
              </span>
              {stock.catalystType && (
                <span className="text-xs font-bold text-zinc-500 uppercase">
                  · {stock.catalystType}
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-500 hover:text-white transition-colors p-2"
          >
            <X size={24} />
          </button>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          onScroll={(e) => {
            const { scrollTop, scrollHeight, clientHeight } = e.target;
            isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 100;
          }}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
          style={{ overscrollBehavior: 'contain' }}
        >
          {messages.length === 1 && !stock.suggestedPrompt && (
            <div className="space-y-2 mb-6">
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em] font-black mb-3">
                Quick Research
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestedQuestions.map((q, i) => (
                  <button 
                    key={i}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setInput(q.text);
                      sendMessageDirect(q.text);
                    }}
                    className="text-left px-4 py-3 text-xs md:text-sm bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-[#00ff4e]/50 transition-all text-zinc-300 flex items-center gap-2"
                  >
                    <span>{q.icon}</span>
                    <span>{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-[#00ff4e]/10 text-white border border-[#00ff4e]/20' 
                  : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
              }`}>
                <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">
                  {msg.text.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={j} className="text-white font-black">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                  })}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[#00ff4e] rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
                    <span className="w-1.5 h-1.5 bg-[#00ff4e] rounded-full animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
                    <span className="w-1.5 h-1.5 bg-[#00ff4e] rounded-full animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
                  </div>
                  <span className="text-sm text-zinc-500">Researching...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 md:p-6 border-t-2 border-zinc-900 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={`Ask anything about ${stock.symbol}...`}
              disabled={isLoading}
              className="flex-1 bg-zinc-900 border-2 border-zinc-800 rounded-lg px-4 py-3 text-white text-sm md:text-base focus:outline-none focus:border-[#00ff4e]/50 transition-colors disabled:opacity-50 font-mono"
              style={{ caretColor: '#00ff4e' }}
            />
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                sendMessage();
              }}
              disabled={!input.trim() || isLoading}
              className="px-4 md:px-6 py-3 bg-[#00ff4e]/10 border-2 border-[#00ff4e]/50 text-[#00ff4e] rounded-lg font-black text-sm md:text-base hover:bg-[#00ff4e]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2"
            >
              <span className="hidden md:inline">Send</span>
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 text-center">
            AI-powered research with web search · Not financial advice
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockChatModal;