async function searchWikipedia({ query, limit = 5, language = 'de' }) {
  if (!query) return { error: 'Suchanfrage fehlt.' };
  const limitN = Math.min(Number(limit) || 5, 10);
  const lang = language === 'german' ? 'de' : language === 'english' ? 'en' : language;

  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limitN}&format=json&origin=*`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'JARVIS/1.0' } });
    if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
    const [, titles, descriptions, links] = await res.json();

    const results = titles.map((title, i) => ({
      title,
      description: descriptions[i] || '',
      url:         links[i] || '',
    }));
    return { results, count: results.length, language: lang };
  } catch (e) {
    return { error: e.message };
  }
}

async function getWikipediaSummary({ title, language = 'de' }) {
  if (!title) return { error: 'Titel fehlt.' };
  const lang = language === 'german' ? 'de' : language === 'english' ? 'en' : language;

  try {
    const slug = encodeURIComponent(title.replace(/ /g, '_'));
    const url  = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug}`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'JARVIS/1.0' } });
    if (!res.ok) throw new Error(`"${title}" nicht gefunden auf ${lang}.wikipedia.org`);
    const data = await res.json();

    return {
      title:     data.title,
      summary:   data.extract,
      url:       data.content_urls?.desktop?.page || '',
      thumbnail: data.thumbnail?.source || null,
      language:  lang,
    };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { searchWikipedia, getWikipediaSummary };
