/**
 * Map initialization and configuration
 * Sets up the Leaflet map with basic options and controls
 */
function initMap() {
  // Initialize the map centered on Europe/Asia region
  const map = L.map('newsletter-map', {
    zoomControl: false, // We'll add a custom zoom control
    scrollWheelZoom: true, // Enable scroll wheel zooming
    maxZoom: 18,
    minZoom: 2,  // Allow zooming out to see the whole world
    attributionControl: false,
    doubleClickZoom: true,
  }).setView([45, 60], 4);  // Centered between Europe and Asia with closer zoom level
  
  // Store map reference globally so we can access it for dark mode toggle
  window.leafletMap = map;
  map._loaded = true; // Mark map as loaded
  
  // Add custom zoom control with better positioning
  L.control.zoom({
    position: 'topright',
    zoomInTitle: 'Zoom in - see more detail',
    zoomOutTitle: 'Zoom out - see more area'
  }).addTo(map);
  
  // Check current theme and add appropriate tile layer
  const isDarkMode = document.body.classList.contains('dark-mode');
  const tileUrl = isDarkMode 
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  
  L.tileLayer(tileUrl, {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);
  
  // Add small attribution in bottom corner
  L.control.attribution({
    position: 'bottomright',
    prefix: false
  }).addTo(map);
  
  // Handle window resize
  window.addEventListener('resize', function() {
    map.invalidateSize();
  });
  
  // Initialize markers using the separate mapMarkers.js function
  if (typeof initMapMarkers === 'function') {
    initMapMarkers(map);
  }
  
  return map;
}
