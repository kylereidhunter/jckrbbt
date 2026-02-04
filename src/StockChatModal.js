import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';

const StockChatModal = ({ isOpen, onClose, stock, aiModel }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset messages when stock changes
  useEffect(() => {
    if (isOpen && stock) {
      setMessages([{
        role: 'assistant',
        text: `Hi! I'm here to answer questions about ${stock.symbol} (${stock.name}). What would you like to know?`
      }]);
    }
  }, [isOpen, stock?.symbol]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build context about the stock
const stockContext = `
You are an expert stock analyst with access to web search. Answer questions about ${stock.symbol} (${stock.name}).

CURRENT DATA (from our analysis):
- Price: $${stock.price}
- Change: ${stock.change}%
- Signal: ${stock.rating}
- Momentum: ${stock.momentum}
- Catalyst: ${stock.catalyst}
- Volatility: ${stock.volatility}%
- Signal Strength: ${stock.confidence}%
- Timing: ${stock.timing || 'N/A'}
- 52-Week Range: ${stock.range}

KEY INSIGHTS:
${stock.insights.map((insight, i) => `${i + 1}. ${insight}`).join('\n')}

User question: ${input}

IMPORTANT INSTRUCTIONS:
- If the user asks for information NOT in the data above (like company description, today's volume, current news, earnings dates, etc.), YOU MUST use web search to find it
- Search queries examples: "${stock.symbol} company description", "${stock.symbol} stock volume today", "${stock.symbol} latest news"
- Always cite your sources when using web search results
- Be direct and actionable in your response (2-4 sentences)
- If you cannot find specific data even after searching, acknowledge that clearly
      `;

      const response = await aiModel.generateContent({
    contents: [{ role: "user", parts: [{ text: stockContext }] }],
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

  const suggestedQuestions = [
    "What's driving the recent price movement?",
    "What are the main risks?",
    "When should I enter this position?",
    "What's the upside potential?",
    "How does the timing look?"
  ];

  if (!isOpen || !stock) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100000] flex items-center justify-center p-4">
      <div className="bg-[#050505] border-2 border-zinc-800 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 md:p-6 border-b-2 border-zinc-900 flex justify-between items-start">
          <div>
            <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">{stock.symbol}</h3>
            <p className="text-xs md:text-sm text-zinc-500 mt-1">{stock.name}</p>
            <div className="flex gap-3 mt-2">
              <span className="text-xs font-black text-white">${stock.price}</span>
              <span className={`text-xs font-black ${stock.isPositive ? 'text-[#00ff4e]' : 'text-red-500'}`}>
                {stock.isPositive ? '+' : ''}{stock.change}%
              </span>
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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 1 && (
            <div className="space-y-2 mb-6">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-black mb-3">Suggested Questions:</p>
              {suggestedQuestions.map((question, i) => (
                <button 
                  key={i}
                  onClick={() => setInput(question)}
                  className="block w-full text-left px-4 py-2.5 text-xs md:text-sm bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-[#00ff4e]/50 transition-all text-zinc-300"
                >
                  {question}
                </button>
              ))}
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-[#00ff4e]/10 text-white border border-[#00ff4e]/20' 
                  : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
              }`}>
                <p className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-lg">
                <p className="text-sm text-zinc-500">Thinking...</p>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 md:p-6 border-t-2 border-zinc-900">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={`Ask about ${stock.symbol}...`}
              disabled={isLoading}
              className="flex-1 bg-zinc-900 border-2 border-zinc-800 rounded-lg px-4 py-3 text-white text-sm md:text-base focus:outline-none focus:border-[#00ff4e]/50 transition-colors disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="px-4 md:px-6 py-3 bg-[#00ff4e]/10 border-2 border-[#00ff4e]/50 text-[#00ff4e] rounded-lg font-black text-sm md:text-base hover:bg-[#00ff4e]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2"
            >
              <span className="hidden md:inline">Send</span>
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 text-center">
            AI responses are for informational purposes only. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockChatModal;