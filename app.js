const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const GEOCODING_INTERVAL_MS = 1100;

const form = document.querySelector("#route-form");
const originInput = document.querySelector("#origin");
const destinationInput = document.querySelector("#destination");
const submitButton = document.querySelector("#submit-button");
const swapButton = document.querySelector("#swap-button");
const statusMessage = document.querySelector("#status-message");
const resultPanel = document.querySelector("#result-panel");
const routeLabel = document.querySelector("#route-label");
const distanceValue = document.querySelector("#distance-value");
const distanceUnit = document.querySelector("#distance-unit");
const mapLink = document.querySelector("#map-link");

let lastGeocodingRequestAt = 0;
let map;
let routeLayer;
let markersLayer;

function setStatus(message, isLoading = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-loading", isLoading);
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function fetchJson(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`요청에 실패했어요. 잠시 후 다시 시도해 주세요. (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("응답 시간이 초과됐어요. 네트워크를 확인하고 다시 시도해 주세요.");
    }
    if (error instanceof TypeError) {
      throw new Error("서비스에 연결할 수 없어요. 네트워크를 확인하고 다시 시도해 주세요.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function geocode(place) {
  const elapsed = Date.now() - lastGeocodingRequestAt;
  if (elapsed < GEOCODING_INTERVAL_MS) {
    await wait(GEOCODING_INTERVAL_MS - elapsed);
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", place);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ko");
  lastGeocodingRequestAt = Date.now();

  const results = await fetchJson(url);
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`“${place}” 장소를 찾지 못했어요. 이름이나 주소를 확인해 주세요.`);
  }

  const result = results[0];
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`“${place}”의 위치 정보를 확인할 수 없어요.`);
  }

  return {
    latitude,
    longitude,
    name: result.name || result.display_name.split(",")[0],
    displayName: result.display_name,
  };
}

async function getRoute(origin, destination) {
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${OSRM_URL}/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const data = await fetchJson(url);

  if (data.code !== "Ok" || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error("두 장소 사이의 운전 경로를 찾지 못했어요. 다른 검색어를 입력해 주세요.");
  }

  return data.routes[0];
}

function formatDistance(meters) {
  if (meters < 1000) {
    return {
      value: new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(meters),
      unit: "m",
    };
  }
  return {
    value: new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(meters / 1000),
    unit: "km",
  };
}

function renderMap(origin, destination, route) {
  if (!window.L) {
    throw new Error("지도를 불러오지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.");
  }

  if (!map) {
    map = window.L.map("map", { scrollWheelZoom: false });
    window.L
      .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      })
      .addTo(map);
    routeLayer = window.L.layerGroup().addTo(map);
    markersLayer = window.L.layerGroup().addTo(map);
  }

  routeLayer.clearLayers();
  markersLayer.clearLayers();

  const coordinates = route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]);
  const line = window.L.polyline(coordinates, {
    color: "#397452",
    weight: 5,
    opacity: 0.88,
    lineJoin: "round",
  }).addTo(routeLayer);

  const markerIcon = (color) => window.L.divIcon({
    className: "route-marker",
    html: `<span style="--marker-color:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
  window.L.marker([origin.latitude, origin.longitude], { icon: markerIcon("#5c9568") })
    .bindTooltip("출발", { direction: "top", offset: [0, -8] })
    .addTo(markersLayer);
  window.L.marker([destination.latitude, destination.longitude], { icon: markerIcon("#d18866") })
    .bindTooltip("도착", { direction: "top", offset: [0, -8] })
    .addTo(markersLayer);

  map.invalidateSize();
  map.fitBounds(line.getBounds(), { padding: [35, 35], maxZoom: 13 });
}

function createMapUrl(origin, destination) {
  const route = `${origin.latitude},${origin.longitude};${destination.latitude},${destination.longitude}`;
  const url = new URL("https://www.openstreetmap.org/directions");
  url.searchParams.set("engine", "fossgis_osrm_car");
  url.searchParams.set("route", route);
  return url.href;
}

function showResult(origin, destination, route) {
  const distance = formatDistance(route.distance);
  routeLabel.textContent = `${origin.name} → ${destination.name}`;
  distanceValue.textContent = distance.value;
  distanceUnit.textContent = distance.unit;
  mapLink.href = createMapUrl(origin, destination);
  resultPanel.hidden = false;
  renderMap(origin, destination, route);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const originQuery = originInput.value.trim();
  const destinationQuery = destinationInput.value.trim();
  if (!originQuery || !destinationQuery) return;

  submitButton.disabled = true;
  resultPanel.hidden = true;
  setStatus("장소를 확인하고 운전 경로를 찾고 있어요.", true);

  try {
    const origin = await geocode(originQuery);
    const destination = await geocode(destinationQuery);
    const route = await getRoute(origin, destination);
    showResult(origin, destination, route);
    setStatus("");
  } catch (error) {
    setStatus(error.message || "거리를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
  } finally {
    submitButton.disabled = false;
  }
});

swapButton.addEventListener("click", () => {
  const origin = originInput.value;
  originInput.value = destinationInput.value;
  destinationInput.value = origin;
  originInput.focus();
});
