import { kv } from '@vercel/kv';
import { createClient, RedisClientType } from 'redis';

// Session management types
export interface SessionData {
  userId: string;
  marketId: string;
  discordUser?: any;
  guildName?: string;
  status: 'UNUSED' | 'USED';
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

// Local Redis client for development
let redisClient: RedisClientType | null = null;

const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

/**
 * Initialize storage client based on environment
 */
async function getStorageClient() {
  if (isProduction || isVercel) {
    // Use Vercel KV in production
    return 'vercel-kv';
  } else {
    // Use Redis in development
    if (!redisClient || !redisClient.isOpen) {
      redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB || '0'),
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              console.error('❌ Too many Redis reconnection attempts');
              return new Error('Too many retries');
            }
            return Math.min(retries * 100, 1000);
          },
          connectTimeout: 5000,
          lazyConnect: true,
        },
      });

      await redisClient.connect();
      console.log('✅ Connected to local Redis for development');
    }
    return redisClient;
  }
}

/**
 * Set session data with expiry
 */
export async function setSession(jti: string, data: SessionData, expirySeconds: number = 300): Promise<boolean> {
  try {
    const client = await getStorageClient();
    const key = `session:${jti}`;
    const value = JSON.stringify(data);

    if (client === 'vercel-kv') {
      // Use Vercel KV
      const result = await kv.set(key, value, { 
        ex: expirySeconds,
        nx: true // Only set if key doesn't exist (single-use enforcement)
      });
      return result === 'OK';
    } else {
      // Use Redis for development
      const result = await (client as RedisClientType).setNX(key, value);
      if (result) {
        await (client as RedisClientType).expire(key, expirySeconds);
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error('Error setting session:', error);
    throw error;
  }
}

/**
 * Get session data
 */
export async function getSession(jti: string): Promise<SessionData | null> {
  try {
    const client = await getStorageClient();
    const key = `session:${jti}`;

    let data: string | null = null;

    if (client === 'vercel-kv') {
      // Use Vercel KV
      data = await kv.get(key);
    } else {
      // Use Redis for development
      data = await (client as RedisClientType).get(key);
    }

    if (data) {
      return JSON.parse(data) as SessionData;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting session:', error);
    throw error;
  }
}

/**
 * Use session (mark as used and return original data)
 */
export async function useSession(jti: string): Promise<SessionData | null> {
  try {
    const client = await getStorageClient();
    const key = `session:${jti}`;
    
    // Get current session data
    const sessionData = await getSession(jti);
    
    if (!sessionData) {
      return null; // Session doesn't exist
    }
    
    if (sessionData.status === 'USED') {
      return null; // Session already used
    }
    
    // Mark as used
    const usedData: SessionData = { 
      ...sessionData, 
      status: 'USED', 
      usedAt: new Date().toISOString() 
    };
    
    if (client === 'vercel-kv') {
      // Use Vercel KV - overwrite existing key
      await kv.set(key, JSON.stringify(usedData));
    } else {
      // Use Redis for development
      await (client as RedisClientType).set(key, JSON.stringify(usedData), { XX: true });
    }
    
    return sessionData; // Return original session data
  } catch (error) {
    console.error('Error using session:', error);
    throw error;
  }
}

/**
 * Get session TTL (time to live)
 */
export async function getSessionTTL(jti: string): Promise<number> {
  try {
    const client = await getStorageClient();
    const key = `session:${jti}`;

    if (client === 'vercel-kv') {
      // Vercel KV doesn't have direct TTL, but we can check if key exists
      const exists = await kv.exists(key);
      return exists ? 300 : -1; // Return default or -1 if not exists
    } else {
      // Use Redis for development
      return await (client as RedisClientType).ttl(key);
    }
  } catch (error) {
    console.error('Error getting session TTL:', error);
    throw error;
  }
}

/**
 * Delete session
 */
export async function deleteSession(jti: string): Promise<boolean> {
  try {
    const client = await getStorageClient();
    const key = `session:${jti}`;

    if (client === 'vercel-kv') {
      // Use Vercel KV
      const result = await kv.del(key);
      return result > 0;
    } else {
      // Use Redis for development
      const result = await (client as RedisClientType).del(key);
      return result > 0;
    }
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
}

/**
 * Health check for storage
 */
export async function healthCheck(): Promise<{ status: string; storage: string }> {
  try {
    const client = await getStorageClient();
    
    if (client === 'vercel-kv') {
      // Test Vercel KV with a simple operation
      const testKey = `health:${Date.now()}`;
      await kv.set(testKey, 'ok', { ex: 10 });
      await kv.del(testKey);
      return { status: 'healthy', storage: 'vercel-kv' };
    } else {
      // Test Redis
      await (client as RedisClientType).ping();
      return { status: 'healthy', storage: 'redis' };
    }
  } catch (error) {
    console.error('Storage health check failed:', error);
    return { status: 'unhealthy', storage: isProduction ? 'vercel-kv' : 'redis' };
  }
} 