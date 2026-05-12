import { api } from './api';

export const watchlistService = {
  getWatchlist: () => api.get('/watchlist'),

  // addTicker accepts either a plain ticker string (backwards compatible with
  // the "add from screener table" buttons) or a full payload object used by
  // the V2 watchlist creation flow.
  addTicker: (tickerOrPayload) => {
    const body =
      typeof tickerOrPayload === 'string'
        ? { ticker: tickerOrPayload }
        : tickerOrPayload;
    return api.post('/watchlist', body);
  },

  removeTicker: (ticker) =>
    api.delete(`/watchlist?ticker=${encodeURIComponent(ticker)}`),

  // Update the sell price for a watchlist entry so the Gain% column reflects
  // the realised return. Passing sell_price=0 clears a previously recorded
  // sell.
  updateSellPrice: (ticker, sellPrice) =>
    api.patch('/watchlist', { ticker, sell_price: sellPrice }),
};
