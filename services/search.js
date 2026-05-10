async function webSearch({ query, limit = 5 }) {
  try {
    const limitN = Math.min(Number(limit) || 5, 10);

    // DuckDuckGo Instant Answer API
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'JARVIS/1.0' } });
    const data = await res.json();

    const results = [];

    // Abstract (best single result)
    if (data.AbstractText) {
      results.push({
        title:   data.Heading || query,
        snippet: data.AbstractText,
        url:     data.AbstractURL || '',
        source:  data.AbstractSource || 'DuckDuckGo',
      });
    }

    // Answer (quick fact)
    if (data.Answer) {
      results.push({
        title:   'Direkte Antwort',
        snippet: data.Answer,
        url:     '',
        source:  'DuckDuckGo',
      });
    }

    // Related topics
    for (const topic of (data.RelatedTopics || [])) {
      if (results.length >= limitN) break;
      if (topic.Text && topic.FirstURL) {
        results.push({
          title:   topic.Text.split(' - ')[0] || topic.Text.slice(0, 60),
          snippet: topic.Text,
          url:     topic.FirstURL,
          source:  'DuckDuckGo',
        });
      }
    }

    if (!results.length) {
      return {
        results: [],
        suggestion: `Keine direkten Ergebnisse. Versuche google_search für "${query}".`,
        query,
      };
    }

    return { results: results.slice(0, limitN), query, count: results.length };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { webSearch };
