import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketConfig, WebSocketState, WebSocketMessage } from '../types';

export function useWebSocket(config: WebSocketConfig): WebSocketState {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    connectionStatus: 'disconnected',
    lastMessage: null,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  const {
    url,
    marketId,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = config;

  const updateState = useCallback((updates: Partial<WebSocketState>) => {
    if (mountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      updateState({ connectionStatus: 'connecting', error: null });

      // Create WebSocket connection
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔗 WebSocket connected');
        reconnectAttemptsRef.current = 0;
        
        updateState({
          isConnected: true,
          connectionStatus: 'connected',
          error: null,
        });

        // Subscribe to market updates if marketId provided
        if (marketId) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            marketId,
            timestamp: new Date().toISOString(),
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          updateState({
            lastMessage: {
              ...message,
              timestamp: new Date().toISOString(),
            },
          });

          console.log('📊 WebSocket message received:', message.type);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
          updateState({
            error: 'Failed to parse message',
            lastMessage: {
              type: 'error',
              error: 'Invalid message format',
              timestamp: new Date().toISOString(),
            },
          });
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        
        updateState({
          isConnected: false,
          connectionStatus: 'disconnected',
        });

        wsRef.current = null;

        // Handle reconnection
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttemptsRef.current), 30000);
          
          updateState({ connectionStatus: 'reconnecting' });
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              reconnectAttemptsRef.current++;
              console.log(`🔄 Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
              connect();
            }
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          updateState({
            error: 'Max reconnection attempts reached',
            connectionStatus: 'error',
          });
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        updateState({
          error: 'Connection error',
          connectionStatus: 'error',
          lastMessage: {
            type: 'error',
            error: 'Connection error',
            timestamp: new Date().toISOString(),
          },
        });
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      updateState({
        error: 'Failed to connect',
        connectionStatus: 'error',
      });
    }
  }, [url, marketId, autoReconnect, reconnectInterval, maxReconnectAttempts, updateState]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Disconnect requested');
      wsRef.current = null;
    }

    updateState({
      isConnected: false,
      connectionStatus: 'disconnected',
      error: null,
    });
  }, [updateState]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && state.isConnected) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
        updateState({
          error: 'Failed to send message',
        });
      }
    }
  }, [state.isConnected, updateState]);

  // Connect on mount and when URL changes
  useEffect(() => {
    if (url) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [url, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle market ID changes
  useEffect(() => {
    if (marketId && wsRef.current && state.isConnected) {
      sendMessage({
        type: 'subscribe',
        marketId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [marketId, state.isConnected, sendMessage]);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
  } as WebSocketState & {
    connect: () => void;
    disconnect: () => void;
    sendMessage: (message: any) => void;
  };
} 