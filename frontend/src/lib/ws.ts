import { api, WS_URL } from "./api";

type WsCallback = (data: any) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private isConnecting: boolean = false;
  private ticketPromise: Promise<string> | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private subscribers: Set<WsCallback> = new Set();
  private initialMessages: Set<string> = new Set();

  public subscribe(callback: WsCallback) {
    this.subscribers.add(callback);
    if (!this.ws && !this.isConnecting) {
      this.connect();
    }
    return () => {
      this.subscribers.delete(callback);
      if (this.subscribers.size === 0) {
        this.disconnect();
      }
    };
  }

  public sendMessage(msg: any) {
    const msgStr = JSON.stringify(msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msgStr);
    } else {
      this.initialMessages.add(msgStr);
      if (!this.ws && !this.isConnecting) {
        this.connect();
      }
    }
  }

  private async connect() {
    if (this.isConnecting || this.ws) return;
    this.isConnecting = true;

    try {
      if (!this.ticketPromise) {
        this.ticketPromise = api.getWsTicket().then(res => res.ticket);
      }
      const ticket = await this.ticketPromise;
      
      this.ws = new WebSocket(`${WS_URL}?ticket=${ticket}`);
      
      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.initialMessages.forEach(msg => this.ws?.send(msg));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.subscribers.forEach(cb => cb(data));
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.isConnecting = false;
        this.ticketPromise = null;
        if (this.subscribers.size > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 1000 * Math.pow(2, this.reconnectAttempts));
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
      
    } catch (error) {
      this.isConnecting = false;
      this.ticketPromise = null;
      console.warn("Failed to connect WebSocket (retrying in 5s):", error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnecting = false;
    this.ticketPromise = null;
    this.initialMessages.clear();
  }
}

export const wsManager = new WebSocketManager();
