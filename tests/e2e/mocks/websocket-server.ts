import WebSocket from 'ws';

export interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp: number;
  id: string;
}

export class MockWebSocketServer {
  private server: WebSocket.Server | null = null;
  private port: number = 3002;
  private clients: Set<WebSocket> = new Set();
  private messages: WebSocketMessage[] = [];
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> = new Map();

  constructor(port: number = 3002) {
    this.port = port;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = new WebSocket.Server({ 
        port: this.port,
        verifyClient: (info) => this.verifyClient(info)
      });

      this.server.on('connection', (ws, req) => {
        this.handleConnection(ws, req);
      });

      this.server.on('listening', () => {
        console.log(`Mock WebSocket server started on port ${this.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock WebSocket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Send message to all connected clients
   */
  async sendMessage(message: object): Promise<void> {
    const wsMessage: WebSocketMessage = {
      type: typeof message === 'object' && 'type' in message ? (message as any).type : 'message',
      payload: message,
      timestamp: Date.now(),
      id: this.generateMessageId()
    };

    this.messages.push(wsMessage);

    // Broadcast to all connected clients
    const messageData = JSON.stringify(wsMessage);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageData);
      }
    });
  }

  /**
   * Wait for specific message type from client
   */
  async waitForMessage(messageType: string, timeout: number = 5000): Promise<WebSocketMessage | null> {
    return new Promise((resolve) => {
      const handler = (message: WebSocketMessage) => {
        if (message.type === messageType) {
          this.messageHandlers.delete(messageType);
          resolve(message);
        }
      };

      this.messageHandlers.set(messageType, handler);

      setTimeout(() => {
        this.messageHandlers.delete(messageType);
        resolve(null);
      }, timeout);
    });
  }

  /**
   * Simulate WebSocket authentication
   */
  private verifyClient(info: { origin: string; secure: boolean; req: any }): boolean {
    const authHeader = info.req.headers.authorization;
    
    // Simulate JWT token validation
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      return this.validateJWTToken(token);
    }

    // Allow connections without auth for basic testing
    return true;
  }

  /**
   * Mock JWT token validation
   */
  private validateJWTToken(token: string): boolean {
    // Simulate JWT validation logic
    if (token === 'mock-jwt-token-123') {
      return true;
    }
    
    if (token === 'expired-token') {
      return false;
    }

    return token.length > 10; // Basic validation for testing
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: any): void {
    console.log('New WebSocket connection established');
    this.clients.add(ws);

    // Send connection acknowledgment
    const welcomeMessage: WebSocketMessage = {
      type: 'connection_established',
      payload: { status: 'connected' },
      timestamp: Date.now(),
      id: this.generateMessageId()
    };
    ws.send(JSON.stringify(welcomeMessage));

    // Handle messages from client
    ws.on('message', (data) => {
      this.handleClientMessage(ws, data);
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      this.clients.delete(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.clients.delete(ws);
    });

    // Start heartbeat for this connection
    this.startHeartbeat(ws);
  }

  /**
   * Handle incoming messages from clients
   */
  private handleClientMessage(ws: WebSocket, data: Buffer | string): void {
    try {
      const message = JSON.parse(data.toString());
      const wsMessage: WebSocketMessage = {
        ...message,
        timestamp: Date.now(),
        id: this.generateMessageId()
      };

      // Handle specific message types
      switch (message.type) {
        case 'heartbeat': {
          this.handleHeartbeat(ws, wsMessage);
          break;
        }
        case 'authenticate': {
          this.handleAuthentication(ws, wsMessage);
          break;
        }
        case 'subscribe': {
          this.handleSubscription(ws, wsMessage);
          break;
        }
        default: {
          // Forward to message handlers
          const handler = this.messageHandlers.get(message.type);
          if (handler) {
            handler(wsMessage);
          }
          break;
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Invalid JSON' },
        timestamp: Date.now(),
        id: this.generateMessageId()
      }));
    }
  }

  /**
   * Handle heartbeat messages
   */
  private handleHeartbeat(ws: WebSocket, message: WebSocketMessage): void {
    const response: WebSocketMessage = {
      type: 'heartbeat_response',
      payload: { 
        server_time: Date.now(),
        client_time: message.payload?.timestamp 
      },
      timestamp: Date.now(),
      id: this.generateMessageId()
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Handle authentication messages
   */
  private handleAuthentication(ws: WebSocket, message: WebSocketMessage): void {
    const token = message.payload?.token;
    const isValid = this.validateJWTToken(token);

    const response: WebSocketMessage = {
      type: 'auth_response',
      payload: { 
        authenticated: isValid,
        expires_at: isValid ? Date.now() + 3600000 : null // 1 hour
      },
      timestamp: Date.now(),
      id: this.generateMessageId()
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Handle subscription messages
   */
  private handleSubscription(ws: WebSocket, message: WebSocketMessage): void {
    const topics = message.payload?.topics || [];
    
    const response: WebSocketMessage = {
      type: 'subscription_response',
      payload: { 
        subscribed_topics: topics,
        status: 'subscribed'
      },
      timestamp: Date.now(),
      id: this.generateMessageId()
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Start heartbeat interval for connection
   */
  private startHeartbeat(ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const heartbeat: WebSocketMessage = {
          type: 'server_heartbeat',
          payload: { timestamp: Date.now() },
          timestamp: Date.now(),
          id: this.generateMessageId()
        };
        ws.send(JSON.stringify(heartbeat));
      } else {
        clearInterval(interval);
      }
    }, 30000); // 30 second heartbeat
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get message history
   */
  getMessages(): WebSocketMessage[] {
    return [...this.messages];
  }

  /**
   * Clear message history
   */
  clearMessages(): void {
    this.messages = [];
  }

  /**
   * Simulate connection failure
   */
  async simulateConnectionFailure(): Promise<void> {
    this.clients.forEach(client => {
      client.close(1006, 'Connection failed');
    });
    this.clients.clear();
  }

  /**
   * Simulate server error
   */
  async simulateError(errorType: string): Promise<void> {
    const errorMessage: WebSocketMessage = {
      type: 'error',
      payload: { 
        error_type: errorType,
        message: `Simulated error: ${errorType}`
      },
      timestamp: Date.now(),
      id: this.generateMessageId()
    };

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(errorMessage));
      }
    });
  }

  /**
   * Simulate network latency
   */
  async sendMessageWithLatency(message: object, latencyMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(async () => {
        await this.sendMessage(message);
        resolve();
      }, latencyMs);
    });
  }

  /**
   * Test connection limits
   */
  async testConnectionLimit(maxConnections: number): Promise<boolean> {
    // Simulate enforcing connection limits
    return this.clients.size < maxConnections;
  }

  /**
   * Simulate token expiration and re-authentication
   */
  async simulateTokenExpiration(): Promise<void> {
    const expirationMessage: WebSocketMessage = {
      type: 'token_expired',
      payload: { 
        message: 'Authentication token has expired',
        expires_at: Date.now() - 1000 // Past timestamp
      },
      timestamp: Date.now(),
      id: this.generateMessageId()
    };

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(expirationMessage));
      }
    });
  }

  /**
   * Test message ordering and sequence
   */
  async testMessageOrdering(messageCount: number): Promise<void> {
    for (let i = 0; i < messageCount; i++) {
      const message = {
        type: 'sequence_test',
        payload: { sequence: i, total: messageCount },
        expected_order: i
      };
      
      await this.sendMessage(message);
      
      // Small delay to ensure ordering
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Simulate high-frequency message sending for performance testing
   */
  async testHighFrequencyMessages(messagesPerSecond: number, durationSeconds: number): Promise<void> {
    const interval = 1000 / messagesPerSecond;
    const totalMessages = messagesPerSecond * durationSeconds;
    
    for (let i = 0; i < totalMessages; i++) {
      setTimeout(async () => {
        await this.sendMessage({
          type: 'high_frequency_test',
          payload: { 
            sequence: i, 
            timestamp: Date.now(),
            rate: messagesPerSecond 
          }
        });
      }, i * interval);
    }
  }

  /**
   * Test concurrent message handling
   */
  async testConcurrentMessages(messageCount: number): Promise<void> {
    const promises = [];
    
    for (let i = 0; i < messageCount; i++) {
      promises.push(
        this.sendMessage({
          type: 'concurrent_test',
          payload: { 
            id: i,
            timestamp: Date.now()
          }
        })
      );
    }
    
    await Promise.all(promises);
  }
}