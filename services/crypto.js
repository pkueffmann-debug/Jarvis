// CoinGecko free API — no key required, rate limit: 10-30 req/min
const COIN_IDS = {
  btc: 'bitcoin', bitcoin: 'bitcoin',
  eth: 'ethereum', ethereum: 'ethereum',
  bnb: 'binancecoin',
  sol: 'solana', solana: 'solana',
  xrp: 'ripple',
  ada: 'cardano',
  doge: 'dogecoin',
  dot: 'polkadot',
  avax: 'avalanche-2',
  matic: 'matic-network',
  link: 'chainlink',
};

function resolveCoinId(coin) {
  const lower = coin.toLowerCase();
  return COIN_IDS[lower] || lower;
}

async function getCryptoPrice({ coin, currency = 'eur' }) {
  if (!coin) return { error: 'Coin fehlt (z.B. bitcoin, BTC, ethereum).' };
  const id  = resolveCoinId(coin);
  const cur = currency.toLowerCase();

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${cur}&include_24hr_change=true&include_market_cap=true`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'JARVIS/1.0' } });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();

    if (!data[id]) return { error: `Coin "${coin}" (ID: ${id}) nicht gefunden.` };

    return {
      coin: id,
      symbol: coin.toUpperCase(),
      price: data[id][cur],
      currency: cur.toUpperCase(),
      change24h: data[id][`${cur}_24h_change`]?.toFixed(2),
      marketCap: data[id][`${cur}_market_cap`],
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function getTopCrypto({ limit = 10, currency = 'eur' }) {
  const limitN = Math.min(Number(limit) || 10, 50);
  const cur = currency.toLowerCase();

  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${cur}&order=market_cap_desc&per_page=${limitN}&page=1`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'JARVIS/1.0' } });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();

    const coins = data.map(c => ({
      rank:       c.market_cap_rank,
      name:       c.name,
      symbol:     c.symbol.toUpperCase(),
      price:      c.current_price,
      change24h:  c.price_change_percentage_24h?.toFixed(2),
      marketCap:  c.market_cap,
      currency:   cur.toUpperCase(),
    }));
    return { coins, count: coins.length };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { getCryptoPrice, getTopCrypto };
