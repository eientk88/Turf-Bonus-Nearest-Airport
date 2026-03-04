/* global L, turf */

const DATA_URL = "./data/airports.geojson";

// -------------------------
// Map setup
// -------------------------
const map = L.map("map", { worldCopyJump: true }).setView([20, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Scale bar (bottom-right so it won't overlap the legend bottom-left)
L.control.scale({ position: "bottomright", imperial: false }).addTo(map);

let airportsFC = null;
let airportsLayer = null;

// Symbology (kept simple/cartographic)
const clickStyle = { radius: 6, weight: 2, fillOpacity: 0.1 };
const nearestStyle = { radius: 7, weight: 2, fillOpacity: 0.2 };
const pointStyle = { radius: 3, weight: 0, fillOpacity: 0.55 };
const lineStyle = { weight: 3, opacity: 0.75 };

// Interactive layers
const clickedMarker = L.circleMarker([0, 0], clickStyle).addTo(map);
const nearestMarker = L.circleMarker([0, 0], nearestStyle).addTo(map);
let connectLine = L.polyline([], lineStyle).addTo(map);

// -------------------------
// UI Controls (non-overlapping)
// -------------------------
addTitleBlock();
const searchControl = addSearchControl();
addLegend();
addNorthArrow();

// -------------------------
// Load data + init click
// -------------------------
init().catch((err) => {
  console.error(err);
  alert(err.message || "Failed to load airports dataset.");
});

async function init() {
  airportsFC = await loadGeoJSON(DATA_URL);
  validatePointFeatureCollection(airportsFC);

  // Draw airports (893 points is fine)
  airportsLayer = L.geoJSON(airportsFC, {
    pointToLayer: (_f, latlng) => L.circleMarker(latlng, pointStyle),
  }).addTo(map);

  const bounds = airportsLayer.getBounds();
  if (bounds && bounds.isValid()) map.fitBounds(bounds.pad(0.15));

  map.on("click", onMapClick);

  // Populate search index once data is ready
  searchControl.setData(airportsFC);
}

async function loadGeoJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
  return res.json();
}

function validatePointFeatureCollection(fc) {
  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    throw new Error("GeoJSON must be a FeatureCollection.");
  }
  const bad = fc.features.some(
    (f) => !f || f.type !== "Feature" || !f.geometry || f.geometry.type !== "Point"
  );
  if (bad) throw new Error("All features must be GeoJSON Point features.");
}

// -------------------------
// Click -> nearest + line + popup
// -------------------------
function onMapClick(e) {
  if (!airportsFC) return;

  const clicked = turf.point([e.latlng.lng, e.latlng.lat]);
  const nearest = turf.nearestPoint(clicked, airportsFC);

  clickedMarker.setLatLng(e.latlng);

  const [lng, lat] = nearest.geometry.coordinates;
  const nearestLatLng = L.latLng(lat, lng);
  nearestMarker.setLatLng(nearestLatLng);

  // Draw connecting line (click -> nearest)
  connectLine.setLatLngs([e.latlng, nearestLatLng]);

  // Distance
  const km = turf.distance(clicked, nearest, { units: "kilometers" });

  // Popup fields (clean)
  const props = nearest.properties || {};
  const title =
    props.name_en || props.name || props.abbrev || props.iata_code || "Nearest airport";

  const iata = props.iata_code ? escapeHtml(props.iata_code) : "—";
  const icao = props.gps_code ? escapeHtml(props.gps_code) : "—";
  const abbrev = props.abbrev ? escapeHtml(props.abbrev) : "—";

  const wiki = props.wikipedia
    ? `<a href="${escapeAttr(props.wikipedia)}" target="_blank" rel="noopener">Wikipedia</a>`
    : "—";

  const html = `
    <div style="min-width:240px">
      <div class="popup-title">${escapeHtml(title)}</div>
      <p class="popup-meta">
        <b>IATA</b>: ${iata}<br>
        <b>GPS/ICAO</b>: ${icao}<br>
        <b>Abbrev</b>: ${abbrev}<br>
        <b>Link</b>: ${wiki}<br>
        <b>Distance</b>: ${km.toFixed(2)} km<br>
        <b>Coords</b>: ${lat.toFixed(4)}, ${lng.toFixed(4)}
      </p>
    </div>
  `;

  L.popup({ autoPanPadding: [24, 24] })
    .setLatLng(e.latlng)
    .setContent(html)
    .openOn(map);
}

// -------------------------
// Search control (top-right)
// -------------------------
function addSearchControl() {
  const Search = L.Control.extend({
    options: { position: "topright" },

    onAdd() {
      const container = L.DomUtil.create("div", "map-panel search");
      container.innerHTML = `
        <label class="search__label">Search airports</label>
        <div class="search__row">
          <input class="search__input" type="text" placeholder="Name, IATA, ICAO…" />
          <button class="search__btn" type="button">Go</button>
        </div>
        <div class="search__small">Tip: try “PDX” or “McNary”.</div>
        <div class="search__results" aria-label="Search results"></div>
      `;

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      this._input = container.querySelector(".search__input");
      this._btn = container.querySelector(".search__btn");
      this._results = container.querySelector(".search__results");

      this._data = null;
      this._index = [];

      const run = () => this._runSearch(this._input.value);

      this._btn.addEventListener("click", run);
      this._input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") run();
      });
      this._input.addEventListener("input", () => this._runSearch(this._input.value));

      return container;
    },

    setData(fc) {
      this._data = fc;
      this._index = (fc.features || []).map((f) => {
        const p = f.properties || {};
        const name = (p.name_en || p.name || "").toString();
        const abbrev = (p.abbrev || "").toString();
        const iata = (p.iata_code || "").toString();
        const gps = (p.gps_code || "").toString();

        const haystack = `${name} ${abbrev} ${iata} ${gps}`.toLowerCase();
        return { f, name, abbrev, iata, gps, haystack };
      });
      this._results.innerHTML = "";
    },

    _runSearch(raw) {
      const q = (raw || "").trim().toLowerCase();
      this._results.innerHTML = "";
      if (!q) return;

      const matches = this._index
        .filter((d) => d.haystack.includes(q))
        .slice(0, 10);

      if (matches.length === 0) {
        this._results.innerHTML = `<div class="search__result">No matches.</div>`;
        return;
      }

      for (const m of matches) {
        const div = document.createElement("div");
        div.className = "search__result";

        const labelName = m.name || "(Unnamed airport)";
        const code = m.iata || m.gps || m.abbrev || "";
        div.textContent = code ? `${labelName} (${code})` : labelName;

        div.addEventListener("click", () => {
          const [lng, lat] = m.f.geometry.coordinates;
          const ll = L.latLng(lat, lng);

          map.setView(ll, Math.max(map.getZoom(), 8));

          nearestMarker.setLatLng(ll);
          connectLine.setLatLngs([]); // clear click-line
          clickedMarker.setLatLng([0, 0]); // move offscreen-ish

          const props = m.f.properties || {};
          const title =
            props.name_en || props.name || props.abbrev || props.iata_code || "Airport";

          const iata = props.iata_code ? escapeHtml(props.iata_code) : "—";
          const icao = props.gps_code ? escapeHtml(props.gps_code) : "—";
          const abbrev = props.abbrev ? escapeHtml(props.abbrev) : "—";
          const wiki = props.wikipedia
            ? `<a href="${escapeAttr(props.wikipedia)}" target="_blank" rel="noopener">Wikipedia</a>`
            : "—";

          const html = `
            <div style="min-width:240px">
              <div class="popup-title">${escapeHtml(title)}</div>
              <p class="popup-meta">
                <b>IATA</b>: ${iata}<br>
                <b>GPS/ICAO</b>: ${icao}<br>
                <b>Abbrev</b>: ${abbrev}<br>
                <b>Link</b>: ${wiki}<br>
                <b>Coords</b>: ${lat.toFixed(4)}, ${lng.toFixed(4)}
              </p>
            </div>
          `;

          L.popup({ autoPanPadding: [24, 24] })
            .setLatLng(ll)
            .setContent(html)
            .openOn(map);
        });

        this._results.appendChild(div);
      }
    },
  });

  const control = new Search();
  map.addControl(control);
  return control;
}

// -------------------------
// Title block (top-left)
// -------------------------
function addTitleBlock() {
  const Title = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const div = L.DomUtil.create("div", "map-panel title-block");
      div.innerHTML = `
        <div class="title-block__title">Nearest Airport Finder</div>
        <p class="title-block__meta">
          <b>Author:</b> Athanasios Karageorgos<br>
          <b>Date:</b> 3/4/2026
        </p>
      `;
      L.DomEvent.disableClickPropagation(div);
      return div;
    },
  });

  map.addControl(new Title());
}

// -------------------------
// Legend (bottom-left)
// -------------------------
function addLegend() {
  const Legend = L.Control.extend({
    options: { position: "bottomleft" },
    onAdd() {
      const div = L.DomUtil.create("div", "map-panel legend");
      div.innerHTML = `
        <div class="legend__title">Legend</div>
        <div class="legend__item"><span class="swatch swatch--points"></span> Airports</div>
        <div class="legend__item"><span class="swatch swatch--click"></span> Click location</div>
        <div class="legend__item"><span class="swatch swatch--nearest"></span> Nearest airport</div>
        <div class="legend__item"><span class="swatch swatch--line"></span> Distance line</div>
      `;
      L.DomEvent.disableClickPropagation(div);
      return div;
    },
  });

  map.addControl(new Legend());
}

// -------------------------
// North arrow (bottom-right, above scale bar)
// -------------------------
function addNorthArrow() {
  const North = L.Control.extend({
    options: { position: "bottomright" },

    onAdd() {
      const div = L.DomUtil.create("div", "map-panel north-arrow");

      div.innerHTML = `
        <div class="north-arrow__n">N</div>
        <svg class="north-arrow__svg" viewBox="0 0 64 64" aria-label="North arrow">
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="2"/>
          <path d="M32 10 L44 40 L32 34 L20 40 Z" fill="rgba(0,0,0,0.80)"/>
          <path d="M32 14 L39 36 L32 32 L25 36 Z" fill="rgba(255,255,255,0.90)"/>
        </svg>
      `;

      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    },
  });

  map.addControl(new North());
}

// -------------------------
// Escape helpers
// -------------------------
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(str) {
  return escapeHtml(str).replaceAll("`", "&#096;");
}