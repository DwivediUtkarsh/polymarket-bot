// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Session Types
export interface SessionData {
  jti: string;
  userId: string;
  marketId: string;
  status?: 'UNUSED' | 'USED';
  createdAt?: string;
  expiresAt: string;
  usedAt?: string;
  discordUser?: DiscordUser;
  guildName?: string;
}

// Market Types
export interface Market {
  id: string;
  question?: string;
  title: string;
  description?: string;
  outcomes: MarketOutcome[];
  active: boolean;
  volume?: number;
  liquidity?: number;
  endDate?: string;
  lastUpdated?: string;
}

export interface MarketOutcome {
  id: string;
  title: string;
  price: number;
  name?: string;
  description?: string;
}

// Betting Types
export type BetOutcome = MarketOutcome;

export interface BetRequest {
  outcome: BetOutcome;
  amount: number;
}

export interface Bet {
  id: string;
  userId: string;
  marketId: string;
  outcome: BetOutcome;
  amount: number;
  price: number;
  potentialPayout: number;
  status: 'placed' | 'active' | 'settled' | 'cancelled';
  placedAt: string;
  settledAt?: string;
  market: {
    question: string;
    title: string;
  };
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'priceUpdate' | 'marketUpdate' | 'error' | 'connected' | 'disconnected';
  marketId?: string;
  outcomes?: MarketOutcome[];
  timestamp?: string;
  error?: string;
}

export interface WebSocketConfig {
  url: string;
  marketId?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketState {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
  lastMessage: WebSocketMessage | null;
  error: string | null;
}

// Component Props
export interface BettingInterfaceProps {
  market: Market;
  onPlaceBet: (outcome: BetOutcome, amount: number) => Promise<void>;
  isPlacingBet: boolean;
  isSessionExpired: boolean;
}

// Utility Types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Discord Types
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
}

// JWT Payload Types
export interface SessionJWTPayload {
  jti: string;
  userId: string;
  marketId: string;
  iat: number;
  exp: number;
  type: 'betting_session';
} 