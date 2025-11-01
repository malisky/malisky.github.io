// Global array to store all markers
let allMarkers = [];

// Import timeline function
import { initChinaTimelineOnMap } from './china-timeline.js';

// Group markers by proximity
function groupMarkersByProximity(markers, threshold = 0.5) {
  const groups = [];
  const processed = new Set();
  
  markers.forEach((marker, index) => {
    if (processed.has(index)) return;
    
    const group = [marker];
    const markerLatLng = marker.getLatLng();
    
    // Find nearby markers
    markers.forEach((otherMarker, otherIndex) => {
      if (index === otherIndex || processed.has(otherIndex)) return;
      
      const otherLatLng = otherMarker.getLatLng();
      const distance = markerLatLng.distanceTo(otherLatLng) / 1000; // Convert to km
      
      if (distance < threshold * 100) { // threshold in degrees roughly
        group.push(otherMarker);
        processed.add(otherIndex);
      }
    });
    
    processed.add(index);
    groups.push(group);
  });
  
  return groups;
}

// Create cluster tooltip content
function createClusterTooltip(markerGroup) {
  const marker = markerGroup[0];
  const data = marker._markerData;
  return `
    <div class="cluster-tooltip single-marker">
      <a href="${data.link}" class="marker-popup-card" target="_blank">
        <img src="${data.image}" alt="${data.title}" />
        <div class="text">
          <h3>${data.title}</h3>
          <p>${new Date(data.date).toDateString()}</p>
          <p>${data.location}</p>
        </div>
      </a>
    </div>
  `;
}

// Precise Kazakhstan GeoJSON border (simplified for brevity, replace with full coordinates for production)
const kazakhstanGeoJson = {
  "type": "Feature",
  "properties": {},
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [49.215607, 87.359970], [49.215607, 87.751264], [47.549480, 87.751264], [45.562584, 85.115562],
      [43.740482, 79.986404], [42.500084, 73.055419], [42.000000, 69.000000], [43.000000, 61.000000],
      [45.000000, 55.000000], [47.000000, 53.000000], [50.000000, 54.000000], [52.000000, 58.000000],
      [54.000000, 61.000000], [55.441513, 73.334503], [54.532909, 76.055603], [53.546234, 77.891602],
      [51.317139, 80.568420], [50.757446, 82.279602], [49.215607, 87.359970]
    ]]
  }
};

let kazakhstanBorderGeoJson = null;
let kazakhstanPolygonLayer = null;

function pointInPolygon(point, polygon) {
  // Ray-casting algorithm for point-in-polygon
  let x = point[1], y = point[0];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i][1], yi = polygon[i][0];
    let xj = polygon[j][1], yj = polygon[j][0];
    let intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi + 0.0000001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function swapLngLatToLatLng(coords) {
  // Handles both Polygon and MultiPolygon
  if (typeof coords[0][0] === 'number') {
    return coords.map(([lng, lat]) => [lat, lng]);
  } else {
    return coords.map(ring => swapLngLatToLatLng(ring));
  }
}

function pointInMultiPolygon(point, multiPoly) {
  // multiPoly: array of polygons (each polygon is an array of rings)
  for (const poly of multiPoly) {
    if (pointInPolygon(point, poly[0])) return true;
  }
  return false;
}

// export function addKazakhstanMapClickHandler(map) {
//   fetch('/kz_0.json')
//     .then(res => res.json())
//     .then(geojson => {
//       let multiPoly = geojson.features[0].geometry.coordinates.map(swapLngLatToLatLng);
//       map.on('click', function(e) {
//         // Check if click is on a marker (skip if so)
//         let foundMarker = false;
//         map.eachLayer(layer => {
//           if (layer instanceof L.Marker && layer.getLatLng().distanceTo(e.latlng) < 0.0005) {
//             foundMarker = true;
//           }
//         });
//         if (foundMarker) return;
//         // Check if click is inside Kazakhstan multipolygon
//         if (pointInMultiPolygon([e.latlng.lat, e.latlng.lng], multiPoly)) {
//           window.location.href = '/newsletter/kazakhstan.html';
//         }
//       });
//     });
// }

// export function addKazakhstanPolygonOnHover(map) {
//   fetch('/kz_0.json')
//     .then(res => res.json())
//     .then(geojson => {
//       kazakhstanBorderGeoJson = geojson;
//       let multiPoly = geojson.features[0].geometry.coordinates.map(swapLngLatToLatLng);
//       map.on('mousemove', function(e) {
//         if (pointInMultiPolygon([e.latlng.lat, e.latlng.lng], multiPoly)) {
//           if (!kazakhstanPolygonLayer) {
//             kazakhstanPolygonLayer = L.geoJSON(geojson, {
//               style: {
//                 color: '#00afca',
//                 weight: 3,
//                 fillColor: '#00afca',
//                 fillOpacity: 0.22
//               }
//             }).addTo(map);
//             kazakhstanPolygonLayer.bringToFront();
//           }
//         } else {
//           if (kazakhstanPolygonLayer) {
//             map.removeLayer(kazakhstanPolygonLayer);
//             kazakhstanPolygonLayer = null;
//           }
//         }
//       });
//     });
// }

let chinaPolygonLayer = null;
let chinaPolygonObserver = null;

export function addChinaPolygonOnHover(map) {
  console.log('[ChinaPolygon] Initializing polygon hover effect...');
  
  // Set up observer for dark mode changes (only once)
  if (!chinaPolygonObserver) {
    chinaPolygonObserver = new MutationObserver(() => {
      if (chinaPolygonLayer) {
        const newColor = document.body.classList.contains('dark-mode') ? '#ff5252' : '#d32f2f';
        chinaPolygonLayer.setStyle({
          color: newColor,
          fillColor: newColor
        });
      }
    });
    chinaPolygonObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
  
  fetch('/cn.json')
    .then(res => {
      console.log('[ChinaPolygon] Fetched /cn.json:', res);
      return res.json();
    })
    .then(geojson => {
      console.log('[ChinaPolygon] Loaded geojson:', geojson);
      let multiPoly = geojson.features[0].geometry.coordinates.map(swapLngLatToLatLng);
      map.on('mousemove', function(e) {
        console.log('[ChinaPolygon] Mousemove at', e.latlng);
        const inside = pointInMultiPolygon([e.latlng.lat, e.latlng.lng], multiPoly);
        console.log('[ChinaPolygon] Inside polygon?', inside, '| Layer exists?', !!chinaPolygonLayer);
        if (inside) {
          if (!chinaPolygonLayer) {
            console.log('[ChinaPolygon] Adding polygon layer');
            const strokeColor = document.body.classList.contains('dark-mode') ? '#ff5252' : '#d32f2f';
            chinaPolygonLayer = L.geoJSON(geojson, {
              style: {
                color: strokeColor,
                weight: 3,
                fillColor: strokeColor,
                fillOpacity: 0.22
              }
            }).addTo(map);
            chinaPolygonLayer.bringToFront();
            // Trigger China hover event
            map.fire('china:hover');
          }
        } else {
          if (chinaPolygonLayer) {
            console.log('[ChinaPolygon] Removing polygon layer');
            map.removeLayer(chinaPolygonLayer);
            chinaPolygonLayer = null;
            // Trigger China unhover event
            map.fire('china:unhover');
          }
        }
      });
    })
    .catch(err => {
      console.error('[ChinaPolygon] Error loading polygon:', err);
    });
}

export function getChinaPolygonLayer() {
  return chinaPolygonLayer;
}

export function addChinaMapClickHandler(map) {
  fetch('/cn.json')
    .then(res => res.json())
    .then(geojson => {
      let multiPoly = geojson.features[0].geometry.coordinates.map(swapLngLatToLatLng);
      map.on('click', function(e) {
        // Check if click is on a marker (skip if so)
        let foundMarker = false;
        map.eachLayer(layer => {
          if (layer instanceof L.Marker && layer.getLatLng().distanceTo(e.latlng) < 0.0005) {
            foundMarker = true;
          }
        });
        if (foundMarker) return;
        // Check if click is inside China multipolygon
        if (pointInMultiPolygon([e.latlng.lat, e.latlng.lng], multiPoly)) {
          window.location.href = '/newsletter/china.html';
        }
      });
    });
}

// Initialize markers on the map
export function initMapMarkers(map) {
  const markerIcon = L.divIcon({
    className: 'custom-marker-icon',
    html: '<div class="marker-dot"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
  
  // Fetch newsletter data
  fetch("/newsletter/newsletters.json")
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      console.log('Newsletter data loaded:', data);
      
      // Define favorite IDs
      const favoriteIds = [];
      
      // Create all markers first
      const markers = [];
      data.forEach(entry => {
        console.log('Processing entry:', entry.title, entry.location);
        if (
          !entry.location ||
          typeof entry.location.lat !== "number" ||
          typeof entry.location.lng !== "number"
        ) {
          console.warn("Invalid marker data:", entry);
          return;
        }
        // Custom marker icon with favorite class if needed
        const isFavorite = favoriteIds.includes(entry.id);
        const markerIcon = L.divIcon({
          className: 'custom-marker-icon',
          html: `<div class="marker-dot${isFavorite ? ' favorite' : ''}"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        const marker = L.marker([entry.location.lat, entry.location.lng], {
          icon: markerIcon,
          title: entry.title
        }).addTo(map);
        // Store marker data for easier access
        marker._markerData = {
          title: entry.title,
          date: entry.date,
          location: entry.location_name,
          image: entry.image,
          link: entry.link
        };
        marker.countryGroup = entry.countryGroup;
        markers.push(marker);
        allMarkers.push(marker);
      });
      
      // Group markers by proximity
      const markerGroups = groupMarkersByProximity(markers);
      
      // Set up hover and click behavior for each group
      markerGroups.forEach(group => {
        let clusterPopup = null;
        let spiderfied = false;
        let lastMapClickHandler = null;
        let mouseMoveHandler = null;
        let spiderCenter = null;

        const isDesktop = window.matchMedia('(pointer: fine)').matches;

        group.forEach(marker => {
          marker.on("mouseover", function(e) {
            // Just show the regular card tooltip (no spiderfier)
            if (isDesktop) {
              // Use pixel distance instead of meters
              const thisPt = map.latLngToContainerPoint(marker.getLatLng());
              const allClose = group.every(m => {
                const pt = map.latLngToContainerPoint(m.getLatLng());
                const dist = Math.sqrt(Math.pow(thisPt.x - pt.x, 2) + Math.pow(thisPt.y - pt.y, 2));
                return dist < 60; // 60px threshold (was 30)
              });
              if (group.length > 1 && allClose && !spiderfied) {
                // spiderfyMarkers(map, group); // Removed spiderfier
                spiderfied = true;
                spiderCenter = marker.getLatLng();
                // Automatically show tooltip and scale for all spiderfied markers // Removed spiderfier
                // group.forEach(m => showSpiderTooltip(map, m)); // Removed spiderfier
                mouseMoveHandler = function(ev) {
                  const centerPt = map.latLngToContainerPoint(spiderCenter);
                  const mousePt = map.mouseEventToContainerPoint(ev.originalEvent);
                  const dist = Math.sqrt(Math.pow(centerPt.x - mousePt.x, 2) + Math.pow(centerPt.y - mousePt.y, 2));
                  if (dist > 100) {
                    // unspiderfyMarkers(map, group); // Removed spiderfier
                    spiderfied = false;
                    map.off('mousemove', mouseMoveHandler);
                  }
                };
                map.on('mousemove', mouseMoveHandler);
              }
              // If spiderfied, show tooltip for this marker (redundant, but safe) // Removed spiderfier
              // if (spiderfied) { // Removed spiderfier
              //   showSpiderTooltip(map, marker); // Removed spiderfier
              // } // Removed spiderfier
            }
            
            // Add hover effect to all markers in group
            group.forEach(m => {
              const markerElement = m.getElement();
              if (markerElement) {
                markerElement.classList.add('marker-hover');
              }
            });
            
            // Close any existing cluster popup
            if (clusterPopup) {
              map.closePopup(clusterPopup);
            }
            
            // Create and show cluster tooltip
            const tooltipContent = createClusterTooltip(group);
            clusterPopup = L.popup({
              closeButton: false,
              className: "cluster-popup",
              autoPan: false,
              maxWidth: group.length > 1 ? 350 : 300,
              maxHeight: group.length > 1 ? 400 : 200
            })
            .setLatLng(this.getLatLng())
            .setContent(tooltipContent)
            .openOn(map);
          });
          
          marker.on("mouseout", function(e) {
            if (isDesktop) {
              // Hide tooltip for this marker if spiderfied // Removed spiderfier
              // if (spiderfied) { // Removed spiderfier
              //   hideSpiderTooltip(map, marker); // Removed spiderfier
              // } // Removed spiderfier
              // Don't collapse immediately; handled by mousemove
            } else {
              // On mobile, collapse immediately
              // if (spiderfied) { // Removed spiderfier
              //   unspiderfyMarkers(map, group); // Removed spiderfier
              //   spiderfied = false; // Removed spiderfier
              //   if (mouseMoveHandler) map.off('mousemove', mouseMoveHandler); // Removed spiderfier
              // } // Removed spiderfier
            }
            // Immediately close popup and remove hover effects
            group.forEach(m => {
              const markerElement = m.getElement();
              if (markerElement) {
                markerElement.classList.remove('marker-hover');
              }
            });
            if (clusterPopup) {
              map.closePopup(clusterPopup);
              clusterPopup = null;
            }
          });

          marker.on("click", function(e) {
            L.DomEvent.stopPropagation(e);
            // Open the link for this marker
            const link = marker._markerData.link;
            window.open(link, "_blank");
          });
        });
      });
      
      fitAllMarkers(map);
      
      // Initialize China timeline after markers are created
      initChinaTimelineOnMap(map, allMarkers);
    })
    .catch(err => {
      console.error("Failed to load newsletter markers:", err);
    });
    
  // Global function to fit all markers
  window.fitAllMarkers = function(map) {
    if (allMarkers.length > 0) {
      const bounds = L.featureGroup(allMarkers).getBounds();
      map.flyToBounds(bounds, {
        padding: [50, 50],
        duration: 1.5
      });
    }
  };
}
