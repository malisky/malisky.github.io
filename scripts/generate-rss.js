// RSS feed from docs/newsletter/newsletters.json
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio'); // best cereal eva

function rfc822(dateStr) {
  const d = new Date(dateStr);
  return d.toUTCString();
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

(function main() {
  const repoRoot = process.cwd();
  const siteUrl = 'https://michaelalisky.com';
  const jsonPath = path.join(repoRoot, 'docs', 'newsletter', 'newsletters.json');
  const outPath1 = path.join(repoRoot, 'docs', 'feed.xml');
  const outPath2 = path.join(repoRoot, 'docs', 'rss.xml');

  function toAbsoluteUrl(src) { // bunch of regex for relative -> absolute paths
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return src;
    let clean = src.replace(/^\.\.\//, '/');
    if (!clean.startsWith('/')) clean = '/' + clean;
    return siteUrl + clean;
  }

  if (!fs.existsSync(jsonPath)) {
    console.error('Could not find newsletters.json at', jsonPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  let items = JSON.parse(raw);

  // Sort newest first by date
  items.sort((a, b) => new Date(b.date) - new Date(a.date));

  const lastBuildDate = new Date().toUTCString();

  const channelTitle = 'Michael Alisky — Travel Newsletter';
  const channelDescription = 'Dispatches from the road: essays, photos, and updates.';
  const channelLink = siteUrl + '/';
  const selfLink = siteUrl + '/feed.xml';

  const itemXml = items.map(it => {
    const title = escapeXml(it.title || it.id);
    const link = siteUrl + (it.link || `/newsletter/${it.id}.html`);
    const guid = link;
    const pubDate = rfc822(it.date || new Date().toISOString());
    let description = escapeXml((it.location_name ? `${it.location_name}` : ''));

    // Attempt to pull HTML content and images from the source HTML
    let contentHtml = '';
    try {
      // Resolve the newsletter HTML path
      const rel = (it.link || `/newsletter/${it.id}.html`).replace(/^\//, '');
      const htmlPath = path.join(repoRoot, 'docs', rel);
      if (fs.existsSync(htmlPath)) {
        const htmlRaw = fs.readFileSync(htmlPath, 'utf8');
        const $ = cheerio.load(htmlRaw);

        // Featured image (if present)
        const featured = $('.featured-image img').first();
        const parts = [];
        if (featured && featured.attr('src')) {
          const src = toAbsoluteUrl(featured.attr('src'));
          const alt = featured.attr('alt') || '';
          parts.push(`<p><img src="${src}" alt="${escapeXml(alt)}" style="max-width:100%;height:auto"/></p>`);
        }

        // Main content from the newsletter card
        const card = $('.newsletter-card').first();
        if (card && card.length) {
          // Rewrite images inside the card to absolute URLs and add responsive style
          card.find('img').each((_, el) => {
            const $el = $(el);
            const src = $el.attr('src');
            if (src) $el.attr('src', toAbsoluteUrl(src));
            if (!$el.attr('alt')) $el.attr('alt', '');
            const style = $el.attr('style') || '';
            if (!/max-width/i.test(style)) {
              $el.attr('style', `${style ? style + ';' : ''}max-width:100%;height:auto`);
            }
          });

          parts.push(card.html() || '');
        }

        // Fallback: if still empty, try to get some paragraphs from body
        if (parts.length === 0) {
          const paragraphs = $('p').slice(0, 3).map((_, el) => $.html(el)).get();
          contentHtml = paragraphs.join('\n');
        } else {
          contentHtml = parts.join('\n');
        }
      }
    } catch (e) {
      console.warn('RSS: Failed to extract content for', it.id || it.link, e.message);
    }

    return [
      '    <item>',
      `      <title>${title}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${guid}</guid>`,
      `      <pubDate>${pubDate}</pubDate>`,
      description ? `      <description>${description}</description>` : null,
      contentHtml ? `      <content:encoded><![CDATA[${contentHtml}]]></content:encoded>` : null,
      '    </item>'
    ].filter(Boolean).join('\n');
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
`<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n` +
`  <channel>\n` +
`    <title>${escapeXml(channelTitle)}</title>\n` +
`    <link>${channelLink}</link>\n` +
`    <description>${escapeXml(channelDescription)}</description>\n` +
`    <language>en</language>\n` +
`    <lastBuildDate>${lastBuildDate}</lastBuildDate>\n` +
`    <atom:link href="${selfLink}" rel="self" type="application/rss+xml" />\n` +
`${itemXml}\n` +
`  </channel>\n` +
`</rss>\n`;

  fs.writeFileSync(outPath1, xml, 'utf8');
  fs.writeFileSync(outPath2, xml, 'utf8');
  console.log('RSS written to:', outPath1, 'and', outPath2);
})();
