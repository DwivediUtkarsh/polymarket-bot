import React from 'react';

interface LiveOdds {
  tokenId: string;
  probability: number;
  midPrice: number;
  spread: number;
  americanOdds: number;
  europeanOdds: number;
  bestBid: number;
  bestAsk: number;
  timestamp: number;
}

interface ExecutedTrade {
  id: string;
  tokenId: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  timestamp: number;
}

interface LiveOddsDisplayProps {
  liveOdds: Record<string, LiveOdds>;
  executedTrades: ExecutedTrade[];
  outcomes: string[];
  tokenIds: string[];
  isConnected: boolean;
  connectionStatus: string;
  lastUpdate: number | null;
}

export function LiveOddsDisplay({ 
  liveOdds, 
  executedTrades, 
  outcomes, 
  tokenIds, 
  isConnected, 
  connectionStatus,
  lastUpdate 
}: LiveOddsDisplayProps) {
  // Create token-to-outcome mapping
  const tokenToOutcome: Record<string, string> = {};
  tokenIds.forEach((tokenId, index) => {
    tokenToOutcome[tokenId] = outcomes[index] || `Option ${index + 1}`;
  });

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatAmericanOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'reconnecting': return 'text-orange-500';
      default: return 'text-red-500';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'reconnecting': return '🟠';
      default: return '🔴';
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getConnectionStatusIcon()}</span>
            <span className={`font-medium ${getConnectionStatusColor()}`}>
              {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
            </span>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live Market Data' : 'Disconnected'}
            </span>
          </div>
          {lastUpdate && (
            <span className="text-sm text-gray-500">
              Updated: {formatTime(lastUpdate)}
            </span>
          )}
        </div>
      </div>

      {/* Live Odds Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            📊 Live Market Odds
            {isConnected && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                LIVE
              </span>
            )}
          </h3>
        </div>
        
        <div className="p-4 space-y-4">
          {tokenIds.map((tokenId, index) => {
            const odds = liveOdds[tokenId];
            const outcome = tokenToOutcome[tokenId];
            
            return (
              <div key={tokenId} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-900">
                    {outcome}
                  </h4>
                  {odds && (
                    <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded border">
                      Updated: {formatTime(odds.timestamp)}
                    </span>
                  )}
                </div>
                
                {odds ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <div className="text-2xl font-bold text-blue-600">
                          {odds.probability.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600 font-medium">Probability</div>
                      </div>
                      
                      <div className="text-center bg-green-50 p-3 rounded-lg border border-green-100">
                        <div className={`text-2xl font-bold ${
                          odds.americanOdds < 0 ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {formatAmericanOdds(odds.americanOdds)}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">American</div>
                      </div>
                      
                      <div className="text-center bg-purple-50 p-3 rounded-lg border border-purple-100">
                        <div className="text-2xl font-bold text-purple-600">
                          {odds.europeanOdds.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">European</div>
                      </div>
                      
                      <div className="text-center bg-gray-100 p-3 rounded-lg border border-gray-200">
                        <div className="text-2xl font-bold text-gray-700">
                          ${odds.midPrice.toFixed(3)}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">Mid Price</div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-300 bg-white p-3 rounded-lg">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <span className="block text-gray-600 text-xs font-medium mb-1">Best Bid</span>
                          <span className="text-lg font-semibold text-green-600">
                            ${odds.bestBid.toFixed(3)}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="block text-gray-600 text-xs font-medium mb-1">Best Ask</span>
                          <span className="text-lg font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                            ${odds.bestAsk.toFixed(3)}
                          </span>
                          <div className="text-xs text-gray-500 mt-1">Price to pay per $1</div>
                        </div>
                        <div className="text-center">
                          <span className="block text-gray-600 text-xs font-medium mb-1">Spread</span>
                          <span className="text-lg font-semibold text-blue-600">
                            {(odds.spread * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    {isConnected ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span>Loading odds...</span>
                      </div>
                    ) : (
                      <span>No data available - WebSocket disconnected</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Executed Trades Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            🔄 Recent Trades
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
              {executedTrades.length}
            </span>
          </h3>
        </div>
        
        <div className="p-4">
          {executedTrades.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {executedTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                      trade.side === 'BUY' 
                        ? 'bg-green-100 text-green-800 border-green-200' 
                        : 'bg-red-100 text-red-800 border-red-200'
                    }`}>
                      {trade.side}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {trade.outcome}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono font-bold text-gray-900 bg-white px-2 py-1 rounded border">
                      ${trade.price.toFixed(3)}
                    </span>
                    <span className="text-gray-600 font-medium">
                      {trade.size.toLocaleString()} units
                    </span>
                    <span className="text-gray-500">
                      {formatTime(trade.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              {isConnected ? (
                <span>No recent trades - waiting for market activity...</span>
              ) : (
                <span>No trade data available - WebSocket disconnected</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 