/**
 * China Timeline - Draws chronological dotted lines connecting China newsletter markers on the map
 * Only visible when hovering over China on the map (along with the red outline)
 */

let chinaTimelinePolylines = [];

export function initChinaTimelineOnMap(map, allMarkers) {
  // Filter China markers and sort by date
  const chinaMarkers = allMarkers
    .filter(marker => marker.countryGroup === 'China')
    .sort((a, b) => {
      const dateA = new Date(a._markerData.date);
      const dateB = new Date(b._markerData.date);
      return dateA - dateB;
    });

  if (chinaMarkers.length < 2) return;

  // Function to show timeline lines
  const showTimeline = () => {
    // Clear existing lines first
    hideTimeline();
    
    const strokeColor = document.body.classList.contains('dark-mode') ? '#ff5252' : '#d32f2f';
    
    // Draw lines between consecutive markers
    for (let i = 0; i < chinaMarkers.length - 1; i++) {
      const currentMarker = chinaMarkers[i];
      const nextMarker = chinaMarkers[i + 1];
      
      const currentLatLng = currentMarker.getLatLng();
      const nextLatLng = nextMarker.getLatLng();
      
      // Create polyline with dashed style
      const polyline = L.polyline([currentLatLng, nextLatLng], {
        color: strokeColor,
        weight: 2,
        opacity: 0.6,
        dashArray: '4, 4',
        interactive: false
      }).addTo(map);
      
      chinaTimelinePolylines.push(polyline);
    }
  };

  // Function to hide timeline lines
  const hideTimeline = () => {
    chinaTimelinePolylines.forEach(polyline => {
      map.removeLayer(polyline);
    });
    chinaTimelinePolylines = [];
  };

  // Listen for China hover events
  map.on('china:hover', showTimeline);
  map.on('china:unhover', hideTimeline);

  // Update colors on dark mode toggle
  const observer = new MutationObserver(() => {
    if (chinaTimelinePolylines.length > 0) {
      const strokeColor = document.body.classList.contains('dark-mode') ? '#ff5252' : '#d32f2f';
      chinaTimelinePolylines.forEach(polyline => {
        polyline.setStyle({ color: strokeColor });
      });
    }
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
}

