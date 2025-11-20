// CONFIG
const GOOGLE_API_KEY = "AIzaSyBaNL6CmJdxhlk_FHtzcHj78oNAvjAjw3Q";
const CSV_URL = "data/venues-updated.csv";
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
    const script = document.createElement('script');
    script.src = "https://maps.googleapis.com/maps/api/js?key=" + GOOGLE_API_KEY + "&libraries=places&v=weekly";
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
    console.error(e);
    alert('Error initializing map: ' + e.message);
  }
}
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM
  });
  placesService = new google.maps.places.PlacesService(map);
}
// Load CSV from repo or uploaded file
function loadCsvFromUrl(url) {
  return fetch(url).then(r => {
    if (!r.ok) throw new Error('CSV not found at ' + url + ' (HTTP ' + r.status + ')');
    return r.text();
  }).then(text => new Promise(res => {
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    res(parsed.data);
  }));
}
function normalizeRows(rows) {
  return rows.map((r, idx) => {
    const lat = parseFloat(r.latitude || r.lat || r.Latitude || '');
    const lng = parseFloat(r.longitude || r.lng || r.Longitude || '');
    return {
      id: idx,
      latitude: lat,
      longitude: lng,
      name: (r.name || r.Name || '').trim(),
      email: (r.email || r.Email || '').trim(),
      genre: (r.genre || r.Genre || '').trim(),
      raw: r
    };
  }).filter(v => !Number.isNaN(v.latitude) && !Number.isNaN(v.longitude));
}
function createMarker(v) {
  const pos = { lat: v.latitude, lng: v.longitude };
  const marker = new google.maps.Marker({ position: pos, map, title: v.name });
  const infoDiv = document.createElement('div');
  infoDiv.innerHTML = "<h3>" + escapeHtml(v.name) + "</h3>" +
                       "<p><a href='mailto:" + escapeHtml(v.email) + "'>" + escapeHtml(v.email) + "</a></p>" +
                       "<div class='photos' id='photos-" + v.id + "'>Loading photos…</div>" +
                       "<p><small>Genre: <em>" + escapeHtml(v.genre || '') + "</em></small></p>" +
                       "<p><button data-id='" + v.id + "' class='edit-genre'>Edit genre</button></p>";
  const iw = new google.maps.InfoWindow({ content: infoDiv });
  marker.addListener('click', function() { iw.open(map, marker); });
  markers.push({ marker: marker, iw: iw, venue: v });
  fetchPlacePhotos(v);
}
function escapeHtml(s) { return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
// Try to find place photos using Places APIs
function fetchPlacePhotos(venue) {
  var container = document.getElementById('photos-' + venue.id);
  if (!placesService) { if (container) container.innerText = 'Places service unavailable'; return; }
  var loc = new google.maps.LatLng(venue.latitude, venue.longitude);
  var req = { location: loc, radius: 100, keyword: venue.name };
  placesService.nearbySearch(req, function(results, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length) {
      var place = results[0];
      placesService.getDetails({ placeId: place.place_id, fields: ['photos','name'] }, function(d, s2) {
        if (s2 === google.maps.places.PlacesServiceStatus.OK && d.photos && d.photos.length) { renderPhotos(d.photos, container); }
        else if (place.photos && place.photos.length) { renderPhotos(place.photos, container); }
        else { container.innerText = 'No photos found'; }
      });
    } else {
      var q = venue.name + " " + venue.latitude + ", " + venue.longitude;
      placesService.findPlaceFromQuery({ query: q, fields: ['photos','place_id','name'] }, function(res2, st2) {
        if (st2 === google.maps.places.PlacesServiceStatus.OK && res2 && res2.length && res2[0].photos) { renderPhotos(res2[0].photos, container); }
        else { container.innerText = 'No photos found'; }
      });
    }
  });
}
function renderPhotos(photos, container) {
  container.innerHTML = '';
  var max = Math.min(3, photos.length);
  for (var i=0;i<max;i++) {
    try {
      var url = photos[i].getUrl({ maxWidth: 400 });
      var img = document.createElement('img');
      img.src = url;
      img.alt = 'photo';
      container.appendChild(img);
    } catch(e) { console.warn('photo render error', e); }
  }
}
// Build venue list
function buildList(list) {
  var ul = document.getElementById('venueList');
  ul.innerHTML = '';
  list.forEach(function(v) {
    var li = document.createElement('li');
    li.className = 'venueItem';
    li.innerHTML = "<div class='meta'><strong>" + escapeHtml(v.name) + "</strong><br/><small>" + escapeHtml(v.email) + "</small><br/><small><em>" + escapeHtml(v.genre || '') + "</em></small></div>" +
                   "<div class='actions'><button data-id='" + v.id + "' class='zoomBtn'>Zoom</button>" +
                   "<button data-id='" + v.id + "' class='editBtn'>Edit</button></div>";
    ul.appendChild(li);
    li.querySelector('.zoomBtn').addEventListener('click', function() {
      map.setCenter({ lat: v.latitude, lng: v.longitude});
      map.setZoom(16);
      var m = markers.find(function(x){ return x.venue.id === v.id; });
      if (m) m.iw.open(map, m.marker);
    });
    li.querySelector('.editBtn').addEventListener('click', function(){ openEditModal(v); });
  });
}
// Genre management (manual dropdown values stored locally)
function loadGenres() { var raw = localStorage.getItem('gigmap_genres'); if (raw) return JSON.parse(raw); return ['Rock','Jazz','Electronic','Folk','All']; }
function saveGenres(arr) { localStorage.setItem('gigmap_genres', JSON.stringify(arr)); }
function buildGenreDropdown() { var sel = document.getElementById('genreSelect'); sel.innerHTML = '<option value="all">All</option>'; var genres = loadGenres().filter(function(g){ return g && g.toLowerCase()!=='all'; }); genres.forEach(function(g){ var opt = document.createElement('option'); opt.value = g; opt.textContent = g; sel.appendChild(opt); }); }
function applyFilter() { var val = document.getElementById('genreSelect').value; var visible = new Set(venues.filter(function(v){ return (val==='all' || (v.genre||'')===val); }).map(function(v){ return v.id; })); markers.forEach(function(m){ if (visible.has(m.venue.id)) m.marker.setMap(map); else m.marker.setMap(null); }); buildList(venues.filter(function(v){ return visible.has(v.id); })); }
// Edit venue genre modal
var editingVenue = null;
function setupEditModal() { document.getElementById('cancelVenueGenreBtn').addEventListener('click', closeEditModal); document.getElementById('saveVenueGenreBtn').addEventListener('click', function(){ var sel = document.getElementById('venueGenreSelect'); if (editingVenue) { editingVenue.genre = sel.value; editingVenue.raw.genre = sel.value; buildGenreDropdown(); applyFilter(); } closeEditModal(); }); }
function openEditModal(venue) { editingVenue = venue; document.getElementById('editVenueName').textContent = venue.name; var sel = document.getElementById('venueGenreSelect'); sel.innerHTML = '<option value="">(none)</option>'; loadGenres().filter(function(g){return g.toLowerCase()!=='all';}).forEach(function(g){ var opt = document.createElement('option'); opt.value=g; opt.textContent=g; sel.appendChild(opt); }); sel.value = venue.genre || ''; document.getElementById('editModal').classList.remove('hidden'); }
function closeEditModal() { editingVenue=null; document.getElementById('editModal').classList.add('hidden'); }
// Manage genres modal
function setupGenresModal() { document.getElementById('manageGenresBtn').addEventListener('click', function(){ var arr = loadGenres().filter(function(g){ return g.toLowerCase()!=='all'; }); document.getElementById('genresText').value = arr.join('\n'); document.getElementById('genresModal').classList.remove('hidden'); }); document.getElementById('closeGenresBtn').addEventListener('click', function(){ document.getElementById('genresModal').classList.add('hidden'); }); document.getElementById('saveGenresBtn').addEventListener('click', function(){ var txt = document.getElementById('genresText').value; var arr = txt.split('\n').map(function(s){ return s.trim(); }).filter(function(s){ return s; }); saveGenres(arr); buildGenreDropdown(); document.getElementById('genresModal').classList.add('hidden'); }); }
// CSV download: reconstruct CSV with optional genre column
function downloadCsv() { if (!venues.length) return alert('No venue data to download'); var headers = Object.keys(venues[0].raw || {}).filter(Boolean); var core = ['latitude','longitude','name','email']; core.forEach(function(c){ if (!headers.includes(c)) headers.unshift(c); }); if (!headers.includes('genre')) headers.push('genre'); var rows = [headers.join(',')]; venues.forEach(function(v){ var raw = v.raw || {}; var vals = headers.map(function(h){ var val = raw[h]; if (h==='latitude') val = v.latitude; if (h==='longitude') val = v.longitude; if (h==='name') val = v.name; if (h==='email') val = v.email; if (h==='genre') val = v.genre || ''; return '"' + String(val||'').replace(/"/g,'""') + '"'; }); rows.push(vals.join(',')); }); var blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' }); var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'venues-updated.csv'; a.click(); URL.revokeObjectURL(url); }
async function loadAndRender(file) { var rows; if (file) { rows = await new Promise(function(res){ Papa.parse(file, { header:true, skipEmptyLines:true, complete: function(p){ res(p.data); } }); }); } else { rows = await loadCsvFromUrl(CSV_URL); } venues = normalizeRows(rows); markers.forEach(function(m){ m.marker.setMap(null); if (m.iw) m.iw.close(); }); markers = []; venues.forEach(function(v){ createMarker(v); }); buildGenreDropdown(); applyFilter(); }
function setupControls() { document.getElementById('downloadCsvBtn').addEventListener('click', downloadCsv); var csvInput = document.getElementById('csvFileInput'); csvInput.addEventListener('change', function(e){ var f = e.target.files[0]; if (f) loadAndRender(f).catch(function(err){ alert('CSV load error: '+err.message); }); }); document.getElementById('genreSelect').addEventListener('change', applyFilter); document.addEventListener('click', function(e){ if (e.target && e.target.matches && e.target.matches('.edit-genre')) { var id = Number(e.target.getAttribute('data-id')); var v = venues.find(function(x){ return x.id===id; }); if (v) openEditModal(v); } }); setupEditModal(); setupGenresModal(); }
window.addEventListener('load', init);
