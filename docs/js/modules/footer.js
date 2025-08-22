/**
 * Footer module
 * Handles footer generation and common divs (theme-transition, scroll-top)
 */

// Prevent duplicate execution
if (document.querySelector('footer') || document.querySelector('.theme-transition')) {
  console.log('Footer.js: Footer elements already exist, skipping');
} else {
  // Determine if we're in a newsletter page (subdirectory)
  const isNewsletterPage = window.location.pathname.includes('/newsletter/');
  const iconPath = isNewsletterPage ? '../images-optimized/' : 'images-optimized/';

  const footer = document.createElement('footer');
  footer.innerHTML = `
    <div class="icon-group">
      <a href="https://github.com/malisky" target="_blank">
        <img src="${iconPath}github-icon.svg" alt="GitHub" />
      </a>
      <a href="https://www.linkedin.com/in/michaelalisky" target="_blank">
        <img src="${iconPath}linkedin-icon.svg" alt="LinkedIn" />
      </a>
      <a href="https://scholar.google.com/citations?user=b4EtdL4AAAAJ&hl=en" target="_blank">
        <img src="${iconPath}scholar-icon.svg" alt="Google Scholar" />
      </a>
      <a href="${isNewsletterPage ? '../feed.xml' : 'feed.xml'}" target="_blank" title="RSS Feed" aria-label="RSS Feed">
        <img src="${iconPath}rss-icon.svg" alt="RSS" />
      </a>
    </div>
  `;

  // Try to append to container first, then body as fallback
  const container = document.querySelector('.container');
  if (container) {
    container.appendChild(footer);
  } else {
    document.body.appendChild(footer);
  }

  // Add theme transition and scroll top divs
  const themeTransition = document.createElement('div');
  themeTransition.className = 'theme-transition';
  document.body.appendChild(themeTransition);

  const scrollTop = document.createElement('div');
  scrollTop.className = 'scroll-top';
  scrollTop.textContent = '↑';
  document.body.appendChild(scrollTop);
}
