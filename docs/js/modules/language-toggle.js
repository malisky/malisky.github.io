// Language Toggle Module with smooth page transitions
export function initLanguageToggle() {
  const toggleLink = document.querySelector('.language-toggle');
  
  if (!toggleLink) {
    return; // No language toggle on this page
  }
  
  // Check if View Transitions API is supported
  const supportsViewTransitions = 'startViewTransition' in document;
  
  if (supportsViewTransitions) {
    toggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      const targetUrl = toggleLink.href;
      
      // Start the view transition
      document.startViewTransition(() => {
        // Navigate to the new page
        window.location.href = targetUrl;
      });
    });
  } else {
    // Fallback: Add a simple fade effect using CSS
    toggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      const targetUrl = toggleLink.href;
      
      // Fade out
      document.body.style.transition = 'opacity 0.3s ease';
      document.body.style.opacity = '0';
      
      // Navigate after fade
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 300);
    });
  }
}

// Auto-initialize if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLanguageToggle);
} else {
  initLanguageToggle();
}

