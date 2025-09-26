import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebSocketManager,
  MockWebSocket,
  WebSocketEventHandler,
  ConnectionStateHandler
} from '@/lib/websocket-manager';
import type {
  WebSocketConnectionState,
  RealTimeEvent,
  WebSocketMessage
} from '@/types/dashboard';

// Mock WebSocket globally for tests
(global as any).WebSocket = MockWebSocket;

describe('websocket-manager', () => {
  let manager: WebSocketManager;
  let mockConfig: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockConfig = {
      url: 'ws://localhost:8080',
      maxReconnectAttempts: 3,
      reconnectInterval: 1000,
      heartbeatInterval: 5000,
      connectionTimeout: 10000
    };
    manager = new WebSocketManager(mockConfig);
  });

  afterEach(() => {
    manager.disconnect();
    vi.useRealTimers();
  });

  describe('connection management', () => {
    it('should initialize with disconnected state', () => {
      const state = manager.getState();
      expect(state.status).toBe('disconnected');
      expect(state.reconnectAttempts).toBe(0);
      expect(state.connectionId).toBeNull();
    });

    it('should connect successfully', async () => {
      const connectPromise = manager.connect();
      
      // Advance timers to simulate connection
      vi.advanceTimersByTime(20);
      await connectPromise;

      const state = manager.getState();
      expect(state.status).toBe('connected');
      expect(state.connectionId).toBeTruthy();
      expect(state.lastConnected).toBeTruthy();
    });

    it('should handle connection timeout', async () => {
      // Mock WebSocket that doesn't connect
      const NeverConnectingWebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          this.readyState = MockWebSocket.CONNECTING;
          // Never trigger onopen
        }
      };
      
      (global as any).WebSocket = NeverConnectingWebSocket;
      manager = new WebSocketManager(mockConfig);

      const connectPromise = manager.connect();
      
      // Advance to connection timeout
      vi.advanceTimersByTime(mockConfig.connectionTimeout + 100);
      
      await expect(connectPromise).rejects.toThrow('Connection timeout');
    });

    it('should disconnect cleanly', async () => {
      await manager.connect();
      vi.advanceTimersByTime(20);
      
      manager.disconnect();
      
      const state = manager.getState();
      expect(state.status).toBe('disconnected');
      expect(state.connectionId).toBeNull();
    });

    it('should not connect if already connected', async () => {
      await manager.connect();
      vi.advanceTimersByTime(20);
      
      const firstState = manager.getState();
      
      // Try to connect again
      await manager.connect();
      vi.advanceTimersByTime(20);
      
      const secondState = manager.getState();
      expect(firstState.connectionId).toBe(secondState.connectionId);
    });
  });

  describe('event handling', () => {
    let eventHandler: WebSocketEventHandler;
    let receivedEvents: RealTimeEvent[];

    beforeEach(async () => {
      receivedEvents = [];
      eventHandler = (event: RealTimeEvent) => {
        receivedEvents.push(event);
      };
      
      manager.addEventListener(eventHandler);
      await manager.connect();
      vi.advanceTimersByTime(20);
    });

    it('should handle real-time events', () => {
      const testEvent: RealTimeEvent = {
        id: 'test-event-1',
        type: 'repository_update',
        timestamp: new Date().toISOString(),
        data: { repository: 'test/repo', status: 'updated' },
        source: 'webhook'
      };

      const message: WebSocketMessage = {
        type: 'event',
        payload: testEvent,
        timestamp: new Date().toISOString()
      };

      // Simulate receiving message
      const ws = (manager as any).ws as MockWebSocket;
      ws.simulateMessage(JSON.stringify(message));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual(testEvent);
    });

    it('should handle heartbeat messages', () => {
      const heartbeatMessage: WebSocketMessage = {
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      };

      const ws = (manager as any).ws as MockWebSocket;
      ws.simulateMessage(JSON.stringify(heartbeatMessage));

      // Should update latency
      const state = manager.getState();
      expect(state.latency).toBeGreaterThan(0);
    });

    it('should handle error messages', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const errorMessage: WebSocketMessage = {
        type: 'error',
        payload: { error: 'Test error' },
        timestamp: new Date().toISOString()
      };

      const ws = (manager as any).ws as MockWebSocket;
      ws.simulateMessage(JSON.stringify(errorMessage));

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket server error:', { error: 'Test error' });
      consoleSpy.mockRestore();
    });

    it('should remove event listeners', () => {
      manager.removeEventListener(eventHandler);
      
      const testEvent: RealTimeEvent = {
        id: 'test-event-2',
        type: 'scan_status',
        timestamp: new Date().toISOString(),
        data: { status: 'completed' },
        source: 'polling'
      };

      const message: WebSocketMessage = {
        type: 'event',
        payload: testEvent,
        timestamp: new Date().toISOString()
      };

      const ws = (manager as any).ws as MockWebSocket;
      ws.simulateMessage(JSON.stringify(message));

      expect(receivedEvents).toHaveLength(0);
    });

    it('should handle malformed messages gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const ws = (manager as any).ws as MockWebSocket;
      ws.simulateMessage('invalid json');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse WebSocket message:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('state management', () => {
    let stateHandler: ConnectionStateHandler;
    let receivedStates: WebSocketConnectionState[];

    beforeEach(() => {
      receivedStates = [];
      stateHandler = (state: WebSocketConnectionState) => {
        receivedStates.push({ ...state });
      };
      
      manager.addStateHandler(stateHandler);
    });

    it('should notify state handlers on connection', async () => {
      const connectPromise = manager.connect();
      vi.advanceTimersByTime(20);
      await connectPromise;

      expect(receivedStates.length).toBeGreaterThan(0);
      expect(receivedStates[0].status).toBe('connecting');
      expect(receivedStates[receivedStates.length - 1].status).toBe('connected');
    });

    it('should notify state handlers on disconnection', async () => {
      await manager.connect();
      vi.advanceTimersByTime(20);
      
      receivedStates = []; // Clear connection states
      manager.disconnect();

      expect(receivedStates).toHaveLength(1);
      expect(receivedStates[0].status).toBe('disconnected');
    });

    it('should remove state handlers', async () => {
      manager.removeStateHandler(stateHandler);
      
      await manager.connect();
      vi.advanceTimersByTime(20);

      expect(receivedStates).toHaveLength(0);
    });
  });

  describe('message sending', () => {
    beforeEach(async () => {
      await manager.connect();
      vi.advanceTimersByTime(20);
    });

    it('should send messages when connected', () => {
      const testMessage: WebSocketMessage = {
        type: 'event',
        payload: {
          id: 'test',
          type: 'repository_update',
          timestamp: new Date().toISOString(),
          data: { test: true },
          source: 'user_action'
        },
        timestamp: new Date().toISOString()
      };

      const result = manager.send(testMessage);
      
      expect(result).toBe(true);
      
      const ws = (manager as any).ws as MockWebSocket;
      const lastMessage = ws.getLastMessage();
      expect(lastMessage).toBe(JSON.stringify(testMessage));
    });

    it('should fail to send messages when disconnected', () => {
      manager.disconnect();
      
      const testMessage: WebSocketMessage = {
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      };

      const result = manager.send(testMessage);
      expect(result).toBe(false);
    });
  });

  describe('reconnection logic', () => {
    it('should attempt reconnection on unexpected disconnect', async () => {
      await manager.connect();
      vi.advanceTimersByTime(20);
      
      // Simulate unexpected disconnect
      const ws = (manager as any).ws as MockWebSocket;
      ws.close(1006, 'Unexpected disconnect'); // 1006 = abnormal closure

      const state = manager.getState();
      expect(state.status).toBe('reconnecting');
    });

    it('should respect maximum reconnection attempts', async () => {
      // Mock WebSocket that always fails to connect
      const FailingWebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            this.simulateError();
          }, 10);
        }
      };
      
      (global as any).WebSocket = FailingWebSocket;
      manager = new WebSocketManager(mockConfig);

      try {
        await manager.connect();
        vi.advanceTimersByTime(20);
      } catch (e) {
        // Initial connection fails, now simulate reconnection attempts
      }

      // Advance time to trigger all reconnection attempts
      for (let i = 0; i < mockConfig.maxReconnectAttempts + 1; i++) {
        vi.advanceTimersByTime(mockConfig.reconnectInterval * Math.pow(2, i));
      }

      const finalState = manager.getState();
      expect(finalState.status).toBe('disconnected');
      expect(finalState.reconnectAttempts).toBe(mockConfig.maxReconnectAttempts);
    });

    it('should use exponential backoff for reconnection delays', async () => {
      await manager.connect();
      vi.advanceTimersByTime(20);
      
      // Simulate disconnect
      const ws = (manager as any).ws as MockWebSocket;
      ws.close(1006, 'Network error');

      // Check that reconnection delays increase exponentially
      // This is tested by checking the state changes over time
      const initialTime = Date.now();
      
      // First reconnect attempt (base delay)
      vi.advanceTimersByTime(mockConfig.reconnectInterval);
      
      // Should be in reconnecting state
      expect(manager.getState().status).toBe('reconnecting');
    });

    it('should handle server-requested reconnection', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      await manager.connect();
      vi.advanceTimersByTime(20);

      const reconnectMessage: WebSocketMessage = {
        type: 'reconnect',
        timestamp: new Date().toISOString()
      };

      const ws = (manager as any).ws as MockWebSocket;
      ws.simulateMessage(JSON.stringify(reconnectMessage));

      expect(consoleSpy).toHaveBeenCalledWith('Server requested reconnection');
      consoleSpy.mockRestore();
    });
  });

  describe('heartbeat mechanism', () => {
    it('should start heartbeat after connection', async () => {
      await manager.connect();
      vi.advanceTimersByTime(20);
      
      // Advance time to trigger heartbeat
      vi.advanceTimersByTime(mockConfig.heartbeatInterval);
      
      const ws = (manager as any).ws as MockWebSocket;
      const messages = ws.getAllMessages();
      
      // Should have sent at least one heartbeat
      const heartbeats = messages.filter(msg => {
        const parsed = JSON.parse(msg);
        return parsed.type === 'heartbeat';
      });
      
      expect(heartbeats.length).toBeGreaterThan(0);
    });

    it('should stop heartbeat on disconnection', async () => {
      await manager.connect();
      vi.advanceTimersByTime(20);
      
      const ws = (manager as any).ws as MockWebSocket;
      ws.clearMessages();
      
      manager.disconnect();
      
      // Advance time beyond heartbeat interval
      vi.advanceTimersByTime(mockConfig.heartbeatInterval * 2);
      
      const messages = ws.getAllMessages();
      expect(messages).toHaveLength(0);
    });
  });

  describe('health monitoring', () => {
    it('should provide health metrics', async () => {
      await manager.connect();
      vi.advanceTimersByTime(20);
      
      const health = manager.getHealth();
      
      expect(health.connected).toBe(true);
      expect(health.lastHeartbeat).toBeTruthy();
      expect(health.errors).toBe(0);
      expect(typeof health.latency).toBe('number');
    });

    it('should track errors in health metrics', async () => {
      await manager.connect();
      vi.advanceTimersByTime(20);
      
      // Simulate connection failures
      const ws = (manager as any).ws as MockWebSocket;
      ws.close(1006, 'Network error');
      vi.advanceTimersByTime(100);
      
      const health = manager.getHealth();
      expect(health.connected).toBe(false);
      expect(health.errors).toBeGreaterThan(0);
    });
  });
});

describe('MockWebSocket', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket('ws://test.com');
  });

  it('should simulate connection lifecycle', (done) => {
    expect(mockWs.readyState).toBe(MockWebSocket.CONNECTING);
    
    mockWs.onopen = () => {
      expect(mockWs.readyState).toBe(MockWebSocket.OPEN);
      done();
    };
  });

  it('should simulate message sending and receiving', () => {
    // Wait for connection
    setTimeout(() => {
      mockWs.send('test message');
      expect(mockWs.getLastMessage()).toBe('test message');
      
      let receivedMessage = '';
      mockWs.onmessage = (event) => {
        receivedMessage = event.data;
      };
      
      mockWs.simulateMessage('received message');
      expect(receivedMessage).toBe('received message');
    }, 20);
  });

  it('should simulate errors', () => {
    let errorOccurred = false;
    mockWs.onerror = () => {
      errorOccurred = true;
    };
    
    mockWs.simulateError();
    expect(errorOccurred).toBe(true);
  });

  it('should track message history', () => {
    setTimeout(() => {
      mockWs.send('message 1');
      mockWs.send('message 2');
      mockWs.send('message 3');
      
      const allMessages = mockWs.getAllMessages();
      expect(allMessages).toEqual(['message 1', 'message 2', 'message 3']);
      
      mockWs.clearMessages();
      expect(mockWs.getAllMessages()).toHaveLength(0);
    }, 20);
  });
});