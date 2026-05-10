const FEEDS = {
  general:  'https://feeds.bbci.co.uk/news/rss.xml',
  tech:     'https://feeds.feedburner.com/TechCrunch',
  germany:  'https://www.tagesschau.de/xml/rss2/',
  business: 'https://feeds.bloomberg.com/markets/news.rss',
  science:  'https://www.sciencedaily.com/rss/all.xml',
  sports:   'https://www.skysports.com/rss/12040',
};

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const titleMatch = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(block);
    const linkMatch  = /<link>([\s\S]*?)<\/link>/i.exec(block);
    const descMatch  = /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(block);
    const dateMatch  = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(block);

    const title = titleMatch?.[1]?.trim() || '';
    const link  = linkMatch?.[1]?.trim() || '';
    const desc  = (descMatch?.[1] || '').replace(/<[^>]*>/g, '').trim().slice(0, 250);
    const date  = dateMatch?.[1]?.trim() || '';

    if (title) items.push({ title, link, description: desc, date });
  }
  return items;
}

async function getNews({ topic = 'general', source, limit = 10 }) {
  const limitN = Math.min(Number(limit) || 10, 30);
  const feedUrl = source || FEEDS[topic.toLowerCase()] || FEEDS.general;

  try {
    const res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'JARVIS/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
    });
    if (!res.ok) throw new Error(`RSS Feed nicht erreichbar (${res.status})`);
    const xml = await res.text();
    const items = parseRSS(xml).slice(0, limitN);
    return { articles: items, count: items.length, source: feedUrl, topic };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { getNews, FEEDS };
