import { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_TRADING_API_URL || 'http://localhost:8000';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws/live';

/**
 * Connects to the trading backend's WebSocket and keeps the latest
 * snapshot (price, indicators, position, KPIs, price history) in state.
 * Falls back to polling REST if the socket can't connect, and reports
 * connection status so the UI can show a clear "backend not running" state.
 */
export function useTradingSocket() {
  const [snapshot, setSnapshot] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting | open | closed | error
  const [trades, setTrades] = useState([]);
  const [daily, setDaily] = useState([]);
  const socketRef = useRef(null);
  const pollRef = useRef(null);

  const fetchRestFallback = async () => {
    try {
      const [statusRes, tradesRes, dailyRes] = await Promise.all([
        fetch(`${API_URL}/api/status`),
        fetch(`${API_URL}/api/trades`),
        fetch(`${API_URL}/api/daily`),
      ]);
      if (statusRes.ok) setSnapshot(await statusRes.json());
      if (tradesRes.ok) setTrades(await tradesRes.json());
      if (dailyRes.ok) setDaily(await dailyRes.json());
      setConnectionStatus((prev) => (prev === 'open' ? prev : 'polling'));
    } catch {
      setConnectionStatus('error');
    }
  };

  const fetchTrades = async () => {
    try {
      const res = await fetch(`${API_URL}/api/trades`);
      if (res.ok) setTrades(await res.json());
    } catch {
      // ignore, socket/poll loop will retry
    }
  };

  const fetchDaily = async () => {
    try {
      const res = await fetch(`${API_URL}/api/daily`);
      if (res.ok) setDaily(await res.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;
    let ws;

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(WS_URL);
        socketRef.current = ws;

        ws.onopen = () => {
          setConnectionStatus('open');
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          fetchTrades();
          fetchDaily();
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'snapshot') {
            setSnapshot(msg.data);
          }
        };

        ws.onclose = () => {
          if (cancelled) return;
          setConnectionStatus('closed');
          startPolling();
          setTimeout(connect, 4000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        startPolling();
      }
    };

    const startPolling = () => {
      if (pollRef.current) return;
      fetchRestFallback();
      pollRef.current = setInterval(fetchRestFallback, 5000);
    };

    connect();

    return () => {
      cancelled = true;
      if (socketRef.current) socketRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh trade log / daily summary whenever a new trade likely happened
  useEffect(() => {
    if (!snapshot) return;
    fetchTrades();
    fetchDaily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.kpis?.total_trades]);

  return { snapshot, trades, daily, connectionStatus };
}
