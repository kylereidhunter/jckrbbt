// hooks/usePolygonWebSocket.js
import { useState, useEffect, useCallback, useRef } from 'react';

const usePolygonWebSocket = (apiKey, tickers, enabled = true) => {
  const [livePrices, setLivePrices] = useState({});
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const subscribedTickers = useRef(new Set());
  const enabledRef = useRef(enabled);
  const tickersRef = useRef(tickers);
  const connectRef = useRef(null);
  enabledRef.current = enabled;
  tickersRef.current = tickers;

  // Store connect in a ref to avoid useCallback/dependency issues
  connectRef.current = () => {
    const currentTickers = tickersRef.current;
    if (!apiKey || !enabledRef.current || currentTickers.length === 0) return;
    
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    if (wsRef.current) {
      const old = wsRef.current;
      wsRef.current = null;
      old.onclose = null;
      old.close();
    }

    setWsStatus('connecting');
    const ws = new WebSocket('wss://socket.polygon.io/stocks');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to Polygon');
      ws.send(JSON.stringify({ action: 'auth', params: apiKey }));
    };

    ws.onmessage = (event) => {
      const messages = JSON.parse(event.data);
      messages.forEach((msg) => {
        if (msg.ev === 'status' && msg.status === 'auth_success') {
          console.log('[WS] Authenticated');
          setWsStatus('connected');
          const subs = tickersRef.current.map(t => `A.${t}`).join(',');
          ws.send(JSON.stringify({ action: 'subscribe', params: subs }));
          subscribedTickers.current = new Set(tickersRef.current);
          console.log(`[WS] Subscribed to ${tickersRef.current.length} tickers`);
        }
        if (msg.ev === 'status' && msg.status === 'auth_failed') {
          console.error('[WS] Auth failed');
          setWsStatus('disconnected');
        }
        if (msg.ev === 'A') {
          setLivePrices(prev => {
            const prevPrice = prev[msg.sym]?.price;
            const newPrice = msg.c;
            return {
              ...prev,
              [msg.sym]: {
                price: newPrice,
                prevPrice: prevPrice ?? newPrice,
                volume: msg.v,
                vwap: msg.vw,
                open: msg.o,
                high: msg.h,
                low: msg.l,
                timestamp: msg.s,
                direction: newPrice > (prevPrice ?? newPrice) ? 'up' : newPrice < (prevPrice ?? newPrice) ? 'down' : 'flat',
                updatedAt: Date.now()
              }
            };
          });
        }
      });
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };

   ws.onclose = (event) => {
      // Only handle if this is still the active socket
      if (wsRef.current !== ws) return;
      console.log(`[WS] Disconnected - code: ${event.code}, reason: ${event.reason || 'none'}`);
      setWsStatus('disconnected');
      wsRef.current = null;
      
      // Don't reconnect if no tickers are needed
      if (tickersRef.current.length === 0) return;
      
      const now = new Date();
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const day = et.getDay();
      const hour = et.getHours();
      const isMarketDay = day >= 1 && day <= 5;
      const isMarketWindow = hour >= 4 && hour <= 20;
      
      if (enabledRef.current && isMarketDay && isMarketWindow) {
        // Exponential backoff: 5s, 10s, 20s, 40s, max 60s
        const attempts = (ws._reconnectAttempts || 0) + 1;
        const delay = Math.min(5000 * Math.pow(2, attempts - 1), 60000);
        console.log(`[WS] Reconnecting in ${delay/1000}s (attempt ${attempts})...`);
        reconnectTimeout.current = setTimeout(() => {
          const newWs = connectRef.current?.();
          if (wsRef.current) wsRef.current._reconnectAttempts = attempts;
        }, delay);
      }
    };
  };

  // Connect once on mount, disconnect on unmount
  useEffect(() => {
    if (!enabled) return;
    // Small delay to let tickers populate
    const timer = setTimeout(() => {
      if (tickersRef.current.length > 0) {
        connectRef.current?.();
      }
    }, 1000);
    
    return () => {
      clearTimeout(timer);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        ws.onclose = null;
        ws.close();
      }
    };
  }, [enabled]); // ONLY depends on enabled, not tickers

  // Handle ticker changes by subscribing/unsubscribing
  useEffect(() => {
    // If WS is not open but we have tickers, reconnect
    if ((!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) && tickers.length > 0) {
      connectRef.current?.();
      return;
    }
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    // If no tickers needed, unsubscribe all and close
    if (tickers.length === 0) {
      const toUnsub = [...subscribedTickers.current];
      if (toUnsub.length > 0) {
        wsRef.current.send(JSON.stringify({ 
          action: 'unsubscribe', 
          params: toUnsub.map(t => `A.${t}`).join(',') 
        }));
        console.log(`[WS] Unsubscribed all ${toUnsub.length} tickers (tab inactive)`);
      }
      subscribedTickers.current = new Set();
      // Close WS cleanly when no tickers needed
      const ws = wsRef.current;
      wsRef.current = null;
      ws.onclose = null;
      ws.close();
      setWsStatus('disconnected');
      return;
    }
    
    const currentSubs = subscribedTickers.current;
    const newTickers = new Set(tickers);
    
    const toUnsub = [...currentSubs].filter(t => !newTickers.has(t));
    if (toUnsub.length > 0) {
      wsRef.current.send(JSON.stringify({ 
        action: 'unsubscribe', 
        params: toUnsub.map(t => `A.${t}`).join(',') 
      }));
      console.log(`[WS] Removed ${toUnsub.length} tickers`);
    }
    
    const toSub = [...newTickers].filter(t => !currentSubs.has(t));
    if (toSub.length > 0) {
      wsRef.current.send(JSON.stringify({ 
        action: 'subscribe', 
        params: toSub.map(t => `A.${t}`).join(',') 
      }));
      console.log(`[WS] Subscribed to ${toSub.length} tickers (total: ${newTickers.size})`);
    }
    
    subscribedTickers.current = newTickers;
  }, [tickers]);

  return { livePrices, wsStatus };
};




export default usePolygonWebSocket;
