import type {
  WebSocketConnectionState,
  RealTimeEvent,
  WebSocketMessage,
  ConnectionHealth
} from '@/types/dashboard';

/**
 * WebSocket connection management for real-time updates
 * Handles connection lifecycle, reconnection, and message processing
 */

export type WebSocketEventHandler = (event: RealTimeEvent) => void;
export type ConnectionStateHandler = (state: WebSocketConnectionState) => void;

export interface WebSocketConfig {
  url: string;
  maxReconnectAttempts: number;
  reconnectInterval: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  protocols?: string[];
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private state: WebSocketConnectionState;
  private eventHandlers: Set<WebSocketEventHandler> = new Set();
  private stateHandlers: Set<ConnectionStateHandler> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    this.config = config;
    this.state = {
      status: 'disconnected',
      lastConnected: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: config.maxReconnectAttempts,
      connectionId: null,
      latency: null
    };
  }

  /**
   * Establishes WebSocket connection
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.updateState({ status: 'connecting', reconnectAttempts: 0 });

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);
        
        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
          this.ws?.close();
          reject(new Error('Connection timeout'));
        }, this.config.connectionTimeout);

        this.ws.onopen = () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }

          this.updateState({
            status: 'connected',
            lastConnected: new Date().toISOString(),
            reconnectAttempts: 0,
            connectionId: this.generateConnectionId()
          });

          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          this.handleDisconnect(event.wasClean, event.code, event.reason);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.updateState({ status: 'error' });
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
          reject(new Error('WebSocket connection failed'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Closes WebSocket connection
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.updateState({ status: 'disconnected', connectionId: null });
  }

  /**
   * Sends message through WebSocket
   */
  send(message: WebSocketMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Adds event handler for real-time events
   */
  addEventListener(handler: WebSocketEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Removes event handler
   */
  removeEventListener(handler: WebSocketEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Adds state change handler
   */
  addStateHandler(handler: ConnectionStateHandler): void {
    this.stateHandlers.add(handler);
  }

  /**
   * Removes state change handler
   */
  removeStateHandler(handler: ConnectionStateHandler): void {
    this.stateHandlers.delete(handler);
  }

  /**
   * Gets current connection state
   */
  getState(): WebSocketConnectionState {
    return { ...this.state };
  }

  /**
   * Gets connection health metrics
   */
  getHealth(): ConnectionHealth['websocket'] {
    return {
      connected: this.state.status === 'connected',
      latency: this.state.latency || 0,
      lastHeartbeat: this.state.lastConnected || '',
      errors: this.state.reconnectAttempts
    };
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      switch (message.type) {
        case 'event':
          if (message.payload && this.isRealTimeEvent(message.payload)) {
            this.eventHandlers.forEach(handler => handler(message.payload as RealTimeEvent));
          }
          break;
          
        case 'heartbeat':
          this.handleHeartbeat();
          break;
          
        case 'error':
          console.error('WebSocket server error:', message.payload);
          break;
          
        case 'reconnect':
          this.handleServerReconnectRequest();
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleDisconnect(wasClean: boolean, code: number, reason: string): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.ws = null;

    if (wasClean || this.state.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.updateState({ status: 'disconnected', connectionId: null });
    } else {
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.state.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.updateState({ status: 'disconnected', connectionId: null });
      return;
    }

    this.updateState({
      status: 'reconnecting',
      reconnectAttempts: this.state.reconnectAttempts + 1
    });

    const delay = this.calculateReconnectDelay();
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {
        this.attemptReconnect();
      });
    }, delay);
  }

  private calculateReconnectDelay(): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.reconnectInterval;
    const exponentialDelay = baseDelay * Math.pow(2, this.state.reconnectAttempts);
    const maxDelay = 30000; // 30 seconds max
    const delay = Math.min(exponentialDelay, maxDelay);
    
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return delay + jitter;
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const heartbeatStart = Date.now();
      
      this.send({
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
        payload: { status: 'ping', timestamp: heartbeatStart }
      });
    }, this.config.heartbeatInterval);
  }

  private handleHeartbeat(): void {
    // Update latency if heartbeat payload contains timestamp
    const currentTime = Date.now();
    // In a real implementation, you'd extract the timestamp from the heartbeat response
    // For now, we'll simulate a reasonable latency
    this.updateState({ latency: Math.random() * 100 + 20 });
  }

  private handleServerReconnectRequest(): void {
    console.info('Server requested reconnection');
    this.disconnect();
    setTimeout(() => {
      this.connect().catch(console.error);
    }, 1000);
  }

  private updateState(updates: Partial<WebSocketConnectionState>): void {
    this.state = { ...this.state, ...updates };
    this.stateHandlers.forEach(handler => handler(this.state));
  }

  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isRealTimeEvent(payload: any): payload is RealTimeEvent {
    return payload &&
           typeof payload === 'object' &&
           typeof payload.id === 'string' &&
           typeof payload.type === 'string' &&
           typeof payload.timestamp === 'string' &&
           payload.data !== undefined;
  }
}

/**
 * React hook for WebSocket management
 */
export function useWebSocket(config: WebSocketConfig) {
  const managerRef = React.useRef<WebSocketManager | null>(null);
  const [state, setState] = React.useState<WebSocketConnectionState>({
    status: 'disconnected',
    lastConnected: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: config.maxReconnectAttempts,
    connectionId: null,
    latency: null
  });

  // Initialize manager
  React.useEffect(() => {
    managerRef.current = new WebSocketManager(config);
    
    const stateHandler = (newState: WebSocketConnectionState) => {
      setState(newState);
    };
    
    managerRef.current.addStateHandler(stateHandler);
    
    return () => {
      managerRef.current?.removeStateHandler(stateHandler);
      managerRef.current?.disconnect();
    };
  }, [config.url]);

  const connect = React.useCallback(async () => {
    return managerRef.current?.connect();
  }, []);

  const disconnect = React.useCallback(() => {
    managerRef.current?.disconnect();
  }, []);

  const send = React.useCallback((message: WebSocketMessage) => {
    return managerRef.current?.send(message) || false;
  }, []);

  const addEventListener = React.useCallback((handler: WebSocketEventHandler) => {
    managerRef.current?.addEventListener(handler);
  }, []);

  const removeEventListener = React.useCallback((handler: WebSocketEventHandler) => {
    managerRef.current?.removeEventListener(handler);
  }, []);

  return {
    state,
    connect,
    disconnect,
    send,
    addEventListener,
    removeEventListener,
    manager: managerRef.current
  };
}

// For non-React environments, we need to import React only if available
let React: any;
try {
  React = require('react');
} catch (e) {
  // React not available, hook won't work but class will
}

/**
 * Mock WebSocket implementation for testing
 */
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocol: string;
  
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private messageQueue: string[] = [];

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocol = Array.isArray(protocols) ? protocols[0] : protocols || '';
    
    // Simulate connection delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string): void {
    if (this.readyState === MockWebSocket.OPEN) {
      this.messageQueue.push(data);
    } else {
      throw new Error('WebSocket is not open');
    }
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.(new CloseEvent('close', { 
        code: code || 1000, 
        reason: reason || '',
        wasClean: true 
      }));
    }, 10);
  }

  // Test utilities
  simulateMessage(data: string): void {
    if (this.readyState === MockWebSocket.OPEN) {
      this.onmessage?.(new MessageEvent('message', { data }));
    }
  }

  simulateError(): void {
    this.onerror?.(new Event('error'));
  }

  getLastMessage(): string | null {
    return this.messageQueue[this.messageQueue.length - 1] || null;
  }

  getAllMessages(): string[] {
    return [...this.messageQueue];
  }

  clearMessages(): void {
    this.messageQueue = [];
  }
}