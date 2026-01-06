// CONFIG
const GOOGLE_API_KEY = "AIzaSyBaNL6CmJdxhlk_FHtzcHj78oNAvjAjw3Q";

// IMPORTANT: use ./ to make path GitHub Pages–safe
const CSV_URL = "./data/venues-updated.csv";

const DEFAULT_CENTER = { lat: 51.5074, lng: -0.1278 };
const DEFAULT_ZOOM = 13;

// STATE
let map, placesService;
let markers = [];
let venues = [];

// Helpers
function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve();
    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      GOOGLE_API_KEY +
      "&libraries=places&v=weekly";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}

async function init() {
  try {
    await loadGoogleMaps();
    initMap();
    setupControls();
    await loadAndRender();
  } catch (e) {
    console.error("Init error:", e);
    alert("Error initializing map: " + e.message);
  }
}

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM
  });
  placesService = new google.maps.places.PlacesService(map);
}

// Load CSV from repo or uploaded file
async function loadCsvFromUrl(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `CSV not found at ${url} (HTTP ${response.status})`
    );
  }

  const text = await response.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true
  });

  if (!parsed.data || !parsed.data.length) {
    console.warn("CSV loaded but contains no rows");
  }

  return parsed.data;
}

function normalizeRows(rows) {
  return rows
    .map((r, idx) => {
      const lat = parseFloat(r.latitude || r.lat || r.Latitude || "");
      const lng = parseFloat(r.longitude || r.lng || r.Longitude || "");
      return {
        id: idx,
        latitude: lat,
        longitude: lng,
        name: (r.name || r.Name || "").trim(),
        email: (r.email || r.Email || "").trim(),
        genre: (r.genre || r.Genre || "").trim(),
        raw: r
      };
    })
    .filter(v => !Number.isNaN(v.latitude) && !Number.isNaN(v.longitude));
}

function createMarker(v) {
  const marker = new google.maps.Marker({
    position: { lat: v.latitude, lng: v.longitude },
    map,
    title: v.name
  });

  const infoDiv = document.createElement("div");
  infoDiv.innerHTML =
    "<h3>" + escapeHtml(v.name) + "</h3>" +
    "<p><a href='mailto:" + escapeHtml(v.email) + "'>" +
    escapeHtml(v.email) + "</a></p>" +
    "<div class='photos' id='photos-" + v.id + "'>Loading photos…</div>" +
    "<p><small>Genre: <em>" + escapeHtml(v.genre || "") +
    "</em></small></p>" +
    "<p><button data-id='" + v.id +
    "' class='edit-genre'>Edit genre</button></p>";

  const iw = new google.maps.InfoWindow({ content: infoDiv });
  marker.addListener("click", () => iw.open(map, marker));

  markers.push({ marker, iw, venue: v });
  fetchPlacePhotos(v);
}

function escapeHtml(s) {
  return (s || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Load & render
async function loadAndRender(file) {
  let rows;

  try {
    if (file) {
      rows = await new Promise(res => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: p => res(p.data)
        });
      });
    } else {
      rows = await loadCsvFromUrl(CSV_URL);
    }
  } catch (err) {
    console.error("CSV load failed:", err);
    alert("CSV load failed:\n" + err.message);
    return;
  }

  venues = normalizeRows(rows);

  if (!venues.length) {
    alert("CSV loaded but no valid venues were found.");
    return;
  }

  markers.forEach(m => {
    m.marker.setMap(null);
    if (m.iw) m.iw.close();
  });

  markers = [];
  venues.forEach(createMarker);

  buildGenreDropdown();
  applyFilter();
}


