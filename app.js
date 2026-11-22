const ipForm = document.getElementById("ip-form");
const ipInput = document.getElementById("ip-input");
const errorMessage = document.getElementById("error-message");

const ipValue = document.getElementById("ip-value");
const locationValue = document.getElementById("location-value");
const timezoneValue = document.getElementById("timezone-value");
const ispValue = document.getElementById("isp-value");

const defaultCoords = [37.3861, -122.0839];

const customIcon = L.icon({
  iconUrl: "./images/icon-location.svg",
  iconSize: [46, 56],
  iconAnchor: [23, 56],
});

const map = L.map("map", {
  zoomControl: false,
  worldCopyJump: true,
}).setView(defaultCoords, 13);

const primaryTileUrl =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const fallbackTileUrl =
  "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";

let activeLayer = L.tileLayer(primaryTileUrl, {
  attribution: "Tiles &copy; Esri",
  maxZoom: 18,
  minZoom: 2,
});

let tileErrorCount = 0;
let switchedToFallback = false;

function switchToFallbackLayer() {
  if (switchedToFallback) return;
  switchedToFallback = true;
  map.removeLayer(activeLayer);
  activeLayer = L.tileLayer(fallbackTileUrl, {
    attribution:
      "&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team",
    maxZoom: 18,
    minZoom: 2,
  });
  activeLayer.addTo(map);
  map.invalidateSize();
}

function attachTileErrorHandler(layer) {
  layer.on("tileerror", () => {
    tileErrorCount += 1;
    if (tileErrorCount >= 3) {
      switchToFallbackLayer();
    }
  });
}

attachTileErrorHandler(activeLayer);
activeLayer.addTo(map);

const marker = L.marker(defaultCoords, { icon: customIcon }).addTo(map);

function refreshMapSize() {
  requestAnimationFrame(() => {
    map.invalidateSize({ pan: false });
  });
}

window.addEventListener("resize", refreshMapSize);
map.on("moveend", refreshMapSize);
map.on("zoomend", refreshMapSize);

function isValidCoordinates(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
    return false;
  }
  if (numLat < -85.0511 || numLat > 85.0511) {
    return false;
  }
  if (numLng < -180 || numLng > 180) {
    return false;
  }
  if (numLat === 0 && numLng === 0) {
    return false;
  }
  return true;
}

function isValidIP(value) {
  const ipv4Regex =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(value) || ipv6Regex.test(value);
}

function cleanDomain(value) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function isValidDomain(value) {
  const domainRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z]{2,})+$/i;
  return domainRegex.test(value);
}

async function resolveDomainToIP(domain) {
  const response = await fetch(
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`
  );
  if (!response.ok) {
    throw new Error("Domain could not be resolved.");
  }
  const data = await response.json();
  const record = data.Answer && data.Answer.find((item) => item.type === 1);
  if (!record || !record.data) {
    throw new Error("No IP address found for this domain.");
  }
  return record.data;
}

function formatTimezone(utcOffset) {
  if (!utcOffset) return "-";
  return utcOffset.startsWith("UTC") ? utcOffset : `UTC ${utcOffset}`;
}

function updateUI(data) {
  ipValue.textContent = data.ip || "-";

  const city = data.city || "";
  const region = data.region || "";
  const postal = data.postal ? ` ${data.postal}` : "";
  const locationText = [city, region].filter(Boolean).join(", ") + postal;
  locationValue.textContent = locationText || data.country || "-";

  const utc = data.timezone && data.timezone.utc ? data.timezone.utc : "";
  timezoneValue.textContent = formatTimezone(utc);

  const isp =
    (data.connection && (data.connection.isp || data.connection.org)) || "-";
  ispValue.textContent = isp;

  if (isValidCoordinates(data.latitude, data.longitude)) {
    const coords = [Number(data.latitude), Number(data.longitude)];
    marker.setLatLng(coords);
    map.setView(coords, 13, { animate: true });
    refreshMapSize();
  } else {
    marker.setLatLng(defaultCoords);
    map.setView(defaultCoords, 4, { animate: false });
    refreshMapSize();
  }
}

async function fetchIPData(query = "") {
  errorMessage.textContent = "";

  try {
    let targetIP = "";

    if (query) {
      const cleaned = cleanDomain(query);
      if (isValidIP(cleaned)) {
        targetIP = cleaned;
      } else if (isValidDomain(cleaned)) {
        targetIP = await resolveDomainToIP(cleaned);
      } else {
        errorMessage.textContent = "Please enter a valid IP address or domain.";
        return;
      }
    }

    const endpoint = targetIP
      ? `https://ipwho.is/${encodeURIComponent(targetIP)}`
      : "https://ipwho.is/";

    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error("Network response was not ok.");
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || "Unable to fetch IP details.");
    }

    updateUI(data);
  } catch (error) {
    errorMessage.textContent =
      error.message || "Something went wrong. Please try again.";
  }
}

ipForm.addEventListener("submit", (event) => {
  event.preventDefault();
  fetchIPData(ipInput.value);
});

window.addEventListener("DOMContentLoaded", () => {
  fetchIPData();
  refreshMapSize();
});