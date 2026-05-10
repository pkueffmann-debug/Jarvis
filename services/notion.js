async function notionFetch(path, method = 'GET', body = null) {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error('NOTION_API_KEY nicht gesetzt.');

  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`https://api.notion.com/v1${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Notion API ${res.status}`);
  }
  return res.json();
}

function isConfigured() {
  return !!process.env.NOTION_API_KEY;
}

async function searchNotion({ query, limit = 10 }) {
  if (!isConfigured()) return { error: 'NOTION_API_KEY nicht gesetzt.' };
  try {
    const data = await notionFetch('/search', 'POST', {
      query,
      page_size: Math.min(Number(limit) || 10, 20),
      filter: { value: 'page', property: 'object' },
    });

    const pages = (data.results || []).map(p => ({
      id: p.id,
      title: p.properties?.title?.title?.[0]?.plain_text
          || p.properties?.Name?.title?.[0]?.plain_text
          || '(kein Titel)',
      url: p.url,
      lastEdited: p.last_edited_time,
    }));
    return { pages, count: pages.length };
  } catch (e) {
    return { error: e.message };
  }
}

async function getPage({ pageId }) {
  if (!isConfigured()) return { error: 'NOTION_API_KEY nicht gesetzt.' };
  try {
    const [page, blocks] = await Promise.all([
      notionFetch(`/pages/${pageId}`),
      notionFetch(`/blocks/${pageId}/children?page_size=50`),
    ]);

    const title = page.properties?.title?.title?.[0]?.plain_text
               || page.properties?.Name?.title?.[0]?.plain_text
               || '(kein Titel)';

    const content = (blocks.results || []).map(b => {
      const type = b.type;
      const text = b[type]?.rich_text?.map(t => t.plain_text).join('') || '';
      return text;
    }).filter(Boolean).join('\n');

    return { title, content, url: page.url };
  } catch (e) {
    return { error: e.message };
  }
}

async function createPage({ title, content = '', databaseId }) {
  if (!isConfigured()) return { error: 'NOTION_API_KEY nicht gesetzt.' };
  const dbId = databaseId || process.env.NOTION_DATABASE_ID;
  if (!dbId) return { error: 'Keine NOTION_DATABASE_ID angegeben.' };

  try {
    const page = await notionFetch('/pages', 'POST', {
      parent: { database_id: dbId },
      properties: {
        title: { title: [{ text: { content: title } }] },
      },
      children: content ? [{
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content } }] },
      }] : [],
    });
    return { created: true, id: page.id, url: page.url, title };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { searchNotion, getPage, createPage, isConfigured };
