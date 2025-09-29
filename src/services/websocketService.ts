// WebSocket Service for Real-time Updates
// Handles live content streaming and real-time notifications

import React from 'react';

interface WebSocketMessage {
  type: 'content_update' | 'moderation_action' | 'platform_status' | 'analytics_update';
  data: any;
  timestamp: string;
}

interface ContentUpdate {
  platform: string;
  content: any;
  action: 'new' | 'updated' | 'deleted';
}

interface ModerationAction {
  contentId: string;
  action: 'approved' | 'rejected' | 'flagged';
  userId: string;
  timestamp: string;
}

interface PlatformStatus {
  platform: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: string;
}

type WebSocketEventHandler = (message: WebSocketMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private isConnecting = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.connect();
  }

  // Connect to WebSocket server
  connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = `ws://localhost:3001/ws`; // WebSocket endpoint

    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('🔗 WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connection', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('connection', { status: 'disconnected' });
        
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnecting = false;
        this.emit('connection', { status: 'error', error });
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  // Disconnect from WebSocket
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  // Send message to server
  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  // Subscribe to content updates for specific platforms
  subscribeToContentUpdates(platforms: string[]): void {
    this.send({
      type: 'content_update',
      data: { action: 'subscribe', platforms },
      timestamp: new Date().toISOString()
    });
  }

  // Unsubscribe from content updates
  unsubscribeFromContentUpdates(): void {
    this.send({
      type: 'content_update',
      data: { action: 'unsubscribe' },
      timestamp: new Date().toISOString()
    });
  }

  // Send moderation action
  sendModerationAction(action: ModerationAction): void {
    this.send({
      type: 'moderation_action',
      data: action,
      timestamp: new Date().toISOString()
    });
  }

  // Request platform status
  requestPlatformStatus(): void {
    this.send({
      type: 'platform_status',
      data: { action: 'request' },
      timestamp: new Date().toISOString()
    });
  }

  // Event handling
  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const message: WebSocketMessage = {
        type: event as any,
        data,
        timestamp: new Date().toISOString()
      };
      handlers.forEach(handler => handler(message));
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('📨 WebSocket message received:', message.type);
    
    switch (message.type) {
      case 'content_update':
        this.emit('content_update', message.data);
        break;
      case 'moderation_action':
        this.emit('moderation_action', message.data);
        break;
      case 'platform_status':
        this.emit('platform_status', message.data);
        break;
      case 'analytics_update':
        this.emit('analytics_update', message.data);
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'analytics_update',
          data: { action: 'ping' },
          timestamp: new Date().toISOString()
        });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Get connection status
  getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (this.isConnecting) return 'connecting';
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'error';
    }
  }
}

// Singleton instance
export const websocketService = new WebSocketService();

// React hook for WebSocket
export const useWebSocket = () => {
  const [connectionStatus, setConnectionStatus] = React.useState(websocketService.getConnectionStatus());
  const [lastMessage, setLastMessage] = React.useState<WebSocketMessage | null>(null);

  React.useEffect(() => {
    const handleConnection = (message: WebSocketMessage) => {
      setConnectionStatus(message.data.status);
    };

    const handleMessage = (message: WebSocketMessage) => {
      setLastMessage(message);
    };

    websocketService.on('connection', handleConnection);
    websocketService.on('content_update', handleMessage);
    websocketService.on('moderation_action', handleMessage);
    websocketService.on('platform_status', handleMessage);
    websocketService.on('analytics_update', handleMessage);

    return () => {
      websocketService.off('connection', handleConnection);
      websocketService.off('content_update', handleMessage);
      websocketService.off('moderation_action', handleMessage);
      websocketService.off('platform_status', handleMessage);
      websocketService.off('analytics_update', handleMessage);
    };
  }, []);

  return {
    connectionStatus,
    lastMessage,
    send: websocketService.send.bind(websocketService),
    subscribe: websocketService.subscribeToContentUpdates.bind(websocketService),
    unsubscribe: websocketService.unsubscribeFromContentUpdates.bind(websocketService)
  };
};

export type { WebSocketMessage, ContentUpdate, ModerationAction, PlatformStatus };
