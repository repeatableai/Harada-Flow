import cheerio from 'cheerio';
import fetch from 'node-fetch';

const MAX_CONTENT_LENGTH = 15000; // Max chars to include in context
const MAX_PAGES = 5; // Max pages to scrape
const TIMEOUT = 10000; // 10 second timeout per request

/**
 * Scrapes a company website and returns relevant text content
 */
export async function scrapeCompanyWebsite(url) {
  if (!url) return null;

  try {
    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const baseUrl = new URL(normalizedUrl);
    const visited = new Set();
    const allContent = [];
    const pagesToVisit = [normalizedUrl];

    console.log(`Scraping company website: ${normalizedUrl}`);

    // Scrape main page and linked pages
    while (pagesToVisit.length > 0 && visited.size < MAX_PAGES) {
      const pageUrl = pagesToVisit.shift();

      if (visited.has(pageUrl)) continue;
      visited.add(pageUrl);

      try {
        const pageContent = await scrapePage(pageUrl);
        if (pageContent) {
          allContent.push(pageContent);

          // Find relevant internal links to also scrape
          const relevantLinks = findRelevantLinks(pageContent.html, baseUrl, visited);
          pagesToVisit.push(...relevantLinks);
        }
      } catch (err) {
        console.warn(`Failed to scrape ${pageUrl}:`, err.message);
      }
    }

    if (allContent.length === 0) {
      console.warn('No content scraped from website');
      return null;
    }

    // Combine and format content
    const combinedContent = formatScrapedContent(allContent, baseUrl.hostname);

    console.log(`Scraped ${visited.size} pages, ${combinedContent.length} chars of content`);

    return combinedContent;
  } catch (error) {
    console.error('Error scraping website:', error);
    return null;
  }
}

async function scrapePage(url) {
  try {
    const response = await fetch(url, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RoleDeliverablesBot/1.0; +https://roledeliverables.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, footer, header, iframe, noscript, svg, form, button, input').remove();
    $('[class*="cookie"], [class*="popup"], [class*="modal"], [class*="banner"], [class*="ad-"]').remove();
    $('[id*="cookie"], [id*="popup"], [id*="modal"], [id*="banner"]').remove();

    // Extract page title
    const title = $('title').text().trim() || $('h1').first().text().trim();

    // Extract meta description
    const metaDescription = $('meta[name="description"]').attr('content') || '';

    // Extract main content
    const mainContent = extractMainContent($);

    return {
      url,
      title,
      metaDescription,
      content: mainContent,
      html,
    };
  } catch (error) {
    throw error;
  }
}

function extractMainContent($) {
  // Try to find main content areas
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '#content',
    '#main',
    '.about',
    '.about-us',
    '.company',
    '.services',
    '.products',
    '.team',
    '.mission',
    '.values',
  ];

  let content = '';

  // First try specific content areas
  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      content += element.text().trim() + '\n\n';
    }
  }

  // If no specific areas found, get body content
  if (!content.trim()) {
    content = $('body').text();
  }

  // Clean up whitespace
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  return content;
}

function findRelevantLinks(html, baseUrl, visited) {
  const $ = cheerio.load(html);
  const links = [];

  // Keywords that indicate relevant pages
  const relevantKeywords = [
    'about', 'company', 'team', 'mission', 'values', 'culture',
    'services', 'products', 'solutions', 'what-we-do',
    'careers', 'jobs', 'work-with-us',
    'contact', 'leadership', 'story', 'history',
  ];

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;

    try {
      const linkUrl = new URL(href, baseUrl.origin);

      // Only follow internal links
      if (linkUrl.hostname !== baseUrl.hostname) return;

      // Skip already visited
      if (visited.has(linkUrl.href)) return;

      // Skip non-page resources
      if (/\.(pdf|jpg|jpeg|png|gif|svg|css|js|zip|doc|docx)$/i.test(linkUrl.pathname)) return;

      // Check if URL or link text contains relevant keywords
      const linkText = $(element).text().toLowerCase();
      const urlPath = linkUrl.pathname.toLowerCase();

      const isRelevant = relevantKeywords.some(keyword =>
        urlPath.includes(keyword) || linkText.includes(keyword)
      );

      if (isRelevant) {
        links.push(linkUrl.href);
      }
    } catch (err) {
      // Invalid URL, skip
    }
  });

  return links.slice(0, 3); // Limit links per page
}

function formatScrapedContent(pages, hostname) {
  let content = `=== COMPANY WEBSITE CONTEXT (${hostname}) ===\n\n`;

  for (const page of pages) {
    content += `--- Page: ${page.title || page.url} ---\n`;
    if (page.metaDescription) {
      content += `Description: ${page.metaDescription}\n`;
    }
    content += `\n${page.content}\n\n`;
  }

  // Truncate if too long
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.substring(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated for length...]';
  }

  return content;
}
