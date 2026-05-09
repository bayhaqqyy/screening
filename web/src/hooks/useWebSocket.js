import { useState, useEffect, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8088/ws/stream';

export const useWebSocket = (enabled = true) => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);
  
  useEffect(() => {
    if (!enabled) {
      // Don't connect if not enabled (e.g. user not authenticated)
      return;
    }

    // Tracks whether this effect instance still wants reconnects. The
    // onclose handler schedules a reconnect via setTimeout(connect, 3000),
    // and without this guard a cleanup that closes the socket (e.g. when
    // `enabled` flips to false on logout) would still trigger a zombie
    // reconnect 3 s later that nothing ever closes.
    let shouldReconnect = true;

    const connect = () => {
      if (!shouldReconnect) return;
      // Create WebSocket connection.
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        setIsConnected(true);
        console.log("WebSocket Connected");
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [data, ...prev].slice(0, 50)); // Keep last 50 messages
          
          // Optionally dispatch custom events so individual components can listen
          const topicName = data.type || data.topic;
          const customEvent = new CustomEvent(`ws_${topicName}`, { detail: data });
          window.dispatchEvent(customEvent);
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        if (shouldReconnect) {
          console.log("WebSocket Disconnected. Reconnecting in 3s...");
          setTimeout(connect, 3000);
        }
      };
      
      ws.current.onerror = (err) => {
        console.error("WebSocket Error: ", err);
        ws.current.close();
      }
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [enabled]);

  return { messages, isConnected };
};
