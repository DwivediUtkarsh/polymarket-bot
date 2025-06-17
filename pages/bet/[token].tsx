import { GetServerSideProps } from 'next';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import toast, { Toaster } from 'react-hot-toast';
import React from 'react';
import OddsCard from '../../components/OddsCard';

import BettingInterface from '../../components/BettingInterface';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useWebSocket } from '../../hooks/useWebSocket';
import { validateSession, placeBet } from '../../lib/api';
import { Market, SessionData, BetOutcome } from '../../types';

interface BettingPageProps {
  token: string;
  initialSessionData: SessionData;
  initialMarket: Market;
  error?: string;
}

export default function BettingPage({ 
  token, 
  initialSessionData, 
  initialMarket, 
  error 
}: BettingPageProps) {
  const router = useRouter();
  
  // State management
  const [market, setMarket] = useState<Market>(initialMarket);
  const [sessionData, setSessionData] = useState<SessionData>(initialSessionData);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isRefreshingOdds, setIsRefreshingOdds] = useState(false);
  
  // WebSocket for live odds
  const { isConnected, connectionStatus, lastMessage } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || 'wss://stream.polymarket.com/markets',
    marketId: market?.id,
    autoReconnect: true,
  });

  // Session expiry timer
  const timerRef = useRef<NodeJS.Timeout>();
  // Price refresh timer
  const priceRefreshRef = useRef<NodeJS.Timeout>();

  // Helper function to parse and convert odds
  const parseMarketOdds = (marketData: any) => {
    try {
      let outcomes: string[] = [];
      let prices: number[] = [];

      // Parse outcomes
      if (typeof marketData.outcomes === 'string') {
        outcomes = JSON.parse(marketData.outcomes);
      } else if (Array.isArray(marketData.outcomes)) {
        outcomes = marketData.outcomes;
      }

      // Parse outcome prices
      if (typeof marketData.outcomePrices === 'string') {
        const priceStrings = JSON.parse(marketData.outcomePrices);
        prices = priceStrings.map((p: string) => parseFloat(p));
      } else if (Array.isArray(marketData.outcomePrices)) {
        prices = marketData.outcomePrices.map((p: any) => typeof p === 'string' ? parseFloat(p) : p);
      }

      if (outcomes.length === prices.length && outcomes.length > 0) {
        return outcomes.map((outcome, index) => ({
          id: `outcome_${index}`,
          title: outcome,
          price: prices[index],
          name: outcome,
          description: undefined,
        }));
      }
    } catch (parseError) {
      console.warn('Failed to parse market odds:', parseError);
    }

    // Fallback to default structure
    return [
      { id: 'yes', title: 'YES', price: 0.5, name: 'YES', description: undefined },
      { id: 'no', title: 'NO', price: 0.5, name: 'NO', description: undefined }
    ];
  };

  // Function to refresh market prices
  const refreshMarketPrices = async () => {
    if (!market?.id || isRefreshingOdds) return;

    try {
      setIsRefreshingOdds(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_POLYMARKET_API_URL || 'https://gamma-api.polymarket.com'}/markets/${market.id}`,
        { timeout: 5000 }
      );

      if (response.data) {
        const newOutcomes = parseMarketOdds(response.data);
        
        setMarket(prev => ({
          ...prev,
          outcomes: newOutcomes,
          lastUpdated: new Date().toISOString(),
        }));

        // Show subtle notification for price updates (only if prices actually changed)
        const oldPrices = market.outcomes?.map(o => o.price).join(',') || '';
        const newPrices = newOutcomes.map(o => o.price).join(',');
        
        if (oldPrices !== newPrices) {
          toast.success('Live odds updated', {
            duration: 1500,
            icon: '📈',
            style: {
              background: '#10B981',
              color: 'white',
              fontSize: '14px',
            },
          });
        }
      }
    } catch (error) {
      console.warn('Failed to refresh market prices:', error);
      // Don't show error toast for failed refreshes to avoid spam
    } finally {
      setIsRefreshingOdds(false);
    }
  };

  // Set up price refresh interval
  useEffect(() => {
    if (!market?.id) return;

    // Refresh immediately on mount
    refreshMarketPrices();

    // Set up 2-second interval
    priceRefreshRef.current = setInterval(refreshMarketPrices, 2000);

    return () => {
      if (priceRefreshRef.current) {
        clearInterval(priceRefreshRef.current);
      }
    };
  }, [market?.id]); // Only depend on market ID to avoid recreating interval

  // Handle errors
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/expired')}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Update market data when WebSocket message received
  useEffect(() => {
    if (lastMessage?.type === 'priceUpdate' && lastMessage.marketId === market.id) {
      setMarket(prev => ({
        ...prev,
        outcomes: lastMessage.outcomes || prev.outcomes,
        lastUpdated: new Date().toISOString(),
      }));
      
      // Show visual feedback for price update
      toast.success('Odds updated!', {
        duration: 2000,
        icon: '📈',
      });
    }
  }, [lastMessage, market.id]);

  // Session expiry countdown
  useEffect(() => {
    if (!sessionData?.expiresAt) return;

    const checkExpiry = () => {
      const now = new Date().getTime();
      const expiry = new Date(sessionData.expiresAt).getTime();
      const timeLeft = expiry - now;

      if (timeLeft <= 0) {
        setIsSessionExpired(true);
        toast.error('Session expired! Redirecting...', { duration: 3000 });
        setTimeout(() => router.push('/expired'), 3000);
      } else if (timeLeft <= 60000) { // 1 minute warning
        toast.error(`Session expires in ${Math.ceil(timeLeft / 1000)} seconds`, {
          duration: 5000,
        });
      }
    };

    checkExpiry();
    timerRef.current = setInterval(checkExpiry, 10000); // Check every 10 seconds

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionData, router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (priceRefreshRef.current) {
        clearInterval(priceRefreshRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Handle bet placement
  const handlePlaceBet = async (outcome: BetOutcome, amount: number) => {
    if (isSessionExpired) {
      toast.error('Session has expired!');
      return;
    }

    setIsPlacingBet(true);
    
    try {
      const response = await placeBet(token, {
        outcome,
        amount,
      });

      if (response.success && response.data) {
        toast.success('Bet placed successfully! 🎉', {
          duration: 5000,
        });

        // Redirect back to Discord after a delay
        setTimeout(() => {
          if (response.data?.redirect) {
            window.location.href = response.data.redirect;
          } else {
            router.push('/success');
          }
        }, 3000);
      } else {
        toast.error(response.error || 'Failed to place bet');
      }
    } catch (error: any) {
      console.error('Bet placement error:', error);
      toast.error(error.response?.data?.error || 'Failed to place bet');
    } finally {
      setIsPlacingBet(false);
    }
  };

  if (!market || !sessionData) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <Head>
        <title>Place Bet - {market.question || market.title}</title>
        <meta name="description" content="Place your bet on Polymarket" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />

        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">P</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900">Polymarket Betting</h1>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Connection Status */}
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm text-gray-600">
                    {connectionStatus}
                  </span>
                </div>

                {/* Live refresh indicator */}
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isRefreshingOdds ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                  }`} />
                  <span className="text-sm text-gray-600">
                    Live odds
                  </span>
                </div>

                {/* Session Timer */}
                {sessionData.expiresAt && (
                  <SessionTimer expiresAt={sessionData.expiresAt} />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Market Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {market.question || market.title}
                  </h2>
                  <p className="text-gray-600">
                    Market ID: {market.id}
                  </p>
                </div>
                
                {market.lastUpdated && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Last updated</p>
                    <p className="text-sm font-medium text-gray-700">
                      {new Date(market.lastUpdated).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Live Odds Display */}
              <div className="grid md:grid-cols-2 gap-6">
                {market.outcomes?.map((outcome, idx) => (
                  <OddsCard
                    key={outcome.id}
                    title={outcome.title}
                    probability={outcome.price || 0}
                    accentColor={idx === 0 ? 'green' : 'red'}
                  />
                ))}
              </div>
            </div>

            {/* Betting Interface */}
            <BettingInterface
              market={market}
              onPlaceBet={handlePlaceBet}
              isPlacingBet={isPlacingBet}
              sessionData={sessionData}
            />
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="text-center text-sm text-gray-500">
              <p>Powered by Polymarket • Secure betting from Discord</p>
              <p className="mt-1">
                Session ID: {sessionData.jti?.substring(0, 8)}...
              </p>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

// Session Timer Component
function SessionTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const left = Math.max(0, expiry - now);
      setTimeLeft(left);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <div className="text-sm text-gray-600">
      <span className="font-medium">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

// Server-side props with session validation
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { token } = context.params as { token: string };

  if (!token) {
    return {
      redirect: {
        destination: '/expired',
        permanent: false,
      },
    };
  }

  try {
    // Validate session token using our new Next.js API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const sessionResponse = await axios.get(
      `${baseUrl}/api/session/validate/${token}`,
      {
        timeout: 10000,
      }
    );

    if (!sessionResponse.data.success || !sessionResponse.data.valid) {
      return {
        redirect: {
          destination: '/expired',
          permanent: false,
        },
      };
    }

    const { jti, userId, marketId, sessionData } = sessionResponse.data.data;

    // Fetch market data
    let market;
    try {
      const marketResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_POLYMARKET_API_URL}/markets/${marketId}`,
        {
          timeout: 10000,
        }
      );
      market = marketResponse.data;
    } catch (marketError) {
      console.warn('Failed to fetch market data, using fallback:', marketError);
    }

    // Ensure market has proper structure with fallback
    const processedMarket = {
      id: marketId,
      question: market?.question || 'Sample Market Question',
      title: market?.title || market?.question || 'Sample Market',
      description: market?.description || null,
      active: market?.active !== false,
      volume: market?.volume ? parseFloat(market.volume) : null,
      liquidity: market?.liquidity ? parseFloat(market.liquidity) : null,
      endDate: market?.endDate || null,
      lastUpdated: new Date().toISOString(),
      outcomes: (() => {
        // Parse real market data from Polymarket API format
        try {
          let outcomes: string[] = [];
          let prices: number[] = [];

          // Parse outcomes - could be JSON string or array
          if (typeof market?.outcomes === 'string') {
            outcomes = JSON.parse(market.outcomes);
          } else if (Array.isArray(market?.outcomes)) {
            outcomes = market.outcomes;
          }

          // Parse outcome prices - could be JSON string or array
          if (typeof market?.outcomePrices === 'string') {
            const priceStrings = JSON.parse(market.outcomePrices);
            prices = priceStrings.map((p: string) => parseFloat(p));
          } else if (Array.isArray(market?.outcomePrices)) {
            prices = market.outcomePrices.map((p: any) => typeof p === 'string' ? parseFloat(p) : p);
          }

          // If we successfully parsed both and they match in length
          if (outcomes.length === prices.length && outcomes.length > 0) {
            return outcomes.map((outcome, index) => ({
              id: `outcome_${index}`,
              title: outcome,
              price: prices[index],
              name: outcome,
              description: undefined,
          }));
          }
        } catch (parseError) {
          console.warn('Failed to parse market data on server:', parseError);
        }

        // Check for alternative structure with tokens array
        if (market?.tokens && Array.isArray(market.tokens)) {
          return market.tokens.map((token: any, index: number) => ({
            id: token.id || `token_${index}`,
            title: token.outcome || (index === 0 ? 'Option A' : 'Option B'),
            price: typeof token.price === 'string' ? parseFloat(token.price) : (token.price || 0.5),
            name: token.outcome || (index === 0 ? 'Option A' : 'Option B'),
            description: token.description || null,
          }));
        } else {
          // Final fallback to neutral structure (avoid showing fake 65%/35%)
          return [
            {
              id: 'yes',
              title: 'Option A',
              price: 0.5,
              name: 'Option A',
              description: undefined,
            },
            {
              id: 'no',
              title: 'Option B', 
              price: 0.5,
              name: 'Option B',
              description: undefined,
            }
          ];
        }
      })()
    };

    return {
      props: {
        token,
        initialSessionData: {
          jti,
          userId,
          marketId,
          expiresAt: sessionData?.expiresAt || new Date(Date.now() + 300000).toISOString(), // 5 min default
          discordUser: sessionData?.discordUser || null,
          guildName: sessionData?.guildName || null,
          // Clean sessionData to remove undefined values
          ...(sessionData ? Object.fromEntries(
            Object.entries(sessionData).filter(([_, value]) => value !== undefined)
          ) : {}),
        },
        initialMarket: processedMarket,
      },
    };

  } catch (error: any) {
    console.error('Server-side validation error:', error.message);

    return {
      props: {
        token,
        initialSessionData: null,
        initialMarket: null,
        error: 'Session validation failed. Please try again.',
      },
    };
  }
}; 