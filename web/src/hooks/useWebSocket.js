import { useState, useEffect, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://0.0.0.0:8080/ws/stream';

export const useWebSocket = () => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);
  
  useEffect(() => {
    const connect = () => {
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
          const customEvent = new CustomEvent(`ws_${data.topic}`, { detail: data });
          window.dispatchEvent(customEvent);
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        console.log("WebSocket Disconnected. Reconnecting in 3s...");
        setTimeout(connect, 3000); // Auto reconnect
      };
      
      ws.current.onerror = (err) => {
        console.error("WebSocket Error: ", err);
        ws.current.close();
      }
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return { messages, isConnected };
};
