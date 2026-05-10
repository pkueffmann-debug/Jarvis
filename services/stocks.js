async function getStock({ symbol }) {
  if (!symbol) return { error: 'Symbol fehlt (z.B. AAPL, TSLA, MSFT).' };
  const sym = symbol.toUpperCase().trim();

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`Yahoo Finance ${res.status} für ${sym}`);
    const data = await res.json();

    const result = data?.chart?.result?.[0];
    if (!result) return { error: `Keine Daten für ${sym} gefunden.` };

    const meta     = result.meta;
    const closes   = result.indicators?.quote?.[0]?.close?.filter(Boolean) || [];
    const prevClose = closes[closes.length - 2] ?? meta.previousClose;
    const price     = meta.regularMarketPrice ?? closes[closes.length - 1];
    const change    = price && prevClose ? price - prevClose : null;
    const changePct = change !== null && prevClose ? (change / prevClose) * 100 : null;

    return {
      symbol:    meta.symbol,
      name:      meta.longName || meta.shortName || sym,
      price:     price?.toFixed(2),
      currency:  meta.currency,
      change:    change?.toFixed(2),
      changePct: changePct?.toFixed(2),
      high52w:   meta.fiftyTwoWeekHigh?.toFixed(2),
      low52w:    meta.fiftyTwoWeekLow?.toFixed(2),
      marketCap: meta.marketCap,
      exchange:  meta.exchangeName,
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function getMultipleStocks({ symbols }) {
  if (!Array.isArray(symbols) || !symbols.length) return { error: 'Symbole fehlen.' };
  const results = await Promise.all(symbols.map(s => getStock({ symbol: s })));
  return { stocks: results };
}

module.exports = { getStock, getMultipleStocks };
