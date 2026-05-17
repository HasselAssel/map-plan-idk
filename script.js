const map = L.map("map").setView([53.5511, 9.9937], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

const daysContainer = document.getElementById("days-container");
const addDayBtn = document.getElementById("add-day-btn");

addDayBtn.addEventListener("click", () => {
  addDay();
  updateUrlHash();
});

function addDay() {
  const dayEl = document.createElement("div");
  dayEl.className = "day";

  dayEl.innerHTML = `
    <div class="day-header">
      <span class="day-title"></span>
      <input class="day-date" type="date" value="${getTodayDateString()}" />

      <div>
        <button class="delete-day-btn danger-btn">Delete</button>
        <button class="toggle-day-btn">−</button>
      </div>
    </div>

    <div class="day-body">
      <button class="add-route-btn">+ Route</button>
      <div class="routes-container"></div>
    </div>
  `;

  const toggleBtn = dayEl.querySelector(".toggle-day-btn");
  const deleteBtn = dayEl.querySelector(".delete-day-btn");
  const addRouteBtn = dayEl.querySelector(".add-route-btn");
  const routesContainer = dayEl.querySelector(".routes-container");

  const dayDateInput = dayEl.querySelector(".day-date");

  dayDateInput.addEventListener("change", () => {
    updateDayTitle();
    updateUrlHash();
  });

  toggleBtn.addEventListener("click", () => {
    dayEl.classList.toggle("collapsed");
    toggleBtn.textContent = dayEl.classList.contains("collapsed") ? "+" : "−";
  });

  deleteBtn.addEventListener("click", () => {
    dayEl.remove();
    updateUrlHash();
  });
  addRouteBtn.addEventListener("click", () => {
    addRouteEditor(routesContainer);
    updateUrlHash();
  });

  const dayTitle = dayEl.querySelector(".day-title");
  updateDayTitle();
  function updateDayTitle() {
    dayTitle.textContent = formatDayTitle(dayDateInput.value);
  }

  function formatDayTitle(dateString) {
    if (!dateString) return "";

    return new Date(dateString + "T00:00:00")
      .toLocaleDateString("en-US", {
        weekday: "short",
      }) + ".";
  }

  daysContainer.appendChild(dayEl);
}

function addRouteEditor(container) {
  const routeEl = document.createElement("div");
  routeEl.className = "route collapsed";

  const previousRoute = container.lastElementChild;
  const previousColorPicker = previousRoute?.querySelector(".color-picker");
  const defaultHex = previousColorPicker ? previousColorPicker.value : "#ff0000";

  const defaultFrom = getLastRouteToValue();
  routeEl.innerHTML = `
    <div class="route-header">
      <div class="route-header-info">
        <span class="route-title">From - To</span>
        <span class="route-time-summary">—</span>
      </div>

      <div class="route-header-actions">
        <button class="toggle-visibility-btn">Show</button>
        <button class="delete-route-btn">Delete</button>
        <button class="toggle-route-btn">+</button>
      </div>
    </div>

    <div class="route-body">
      <label>From</label>
      <input class="from-query" placeholder="e.g. Hamburg Hauptbahnhof" value="${defaultFrom}" />

      <label>To</label>
      <input class="to-query" placeholder="e.g. Elbphilharmonie Hamburg"/>

      <label>Transport</label>
      <select class="mode">
        <option value="driving">Driving</option>
        <option value="walking">Walking</option>
        <option value="cycling">Cycling</option>
      </select>

      <label>Color</label>
      <div class="color-picker-row">
        <input class="color-picker" type="color" value="${defaultHex}" />
        <input class="alpha-picker" type="range" min="0" max="1" step="0.05" value="0.85" />
      </div>

      <label>Start time</label>
      <input class="start-time" type="time" value="09:00" />

      <div class="route-time-info">
        <div>Duration: <span class="route-duration">—</span></div>
        <div>Arrival:  <span class="route-end-time">—</span></div>
      </div>
    </div>
  `;

  const routeTitle = routeEl.querySelector(".route-title");
  const toggleRouteBtn = routeEl.querySelector(".toggle-route-btn");
  const fromInput = routeEl.querySelector(".from-query");
  const toInput = routeEl.querySelector(".to-query");

  const startTimeInput = routeEl.querySelector(".start-time");

  startTimeInput.addEventListener("change", () => {
    updateRouteTimeDisplay(routeEl);
    updateUrlHash();
  });

  let routeLayer = null;
  let fromMarker = null;
  let toMarker = null;
  routeEl._routeLayer = null;
  let isDirty = true;

  function markRouteDirty() {
    isDirty = true;

    const visibilityBtn = routeEl.querySelector(".toggle-visibility-btn");
    if (routeLayer) {
      visibilityBtn.textContent = "Update";
    }

    /*if (routeLayer && map.hasLayer(routeLayer)) {
      routeEl.style.background = "";
      routeEl.style.borderColor = "";
    }*/
  }

  function restyleRoute() {
    const color = getRgbaColor(routeEl);

    if (routeLayer) {
      routeLayer.setStyle({
        color,
        weight: 6,
        opacity: 1
      });

      applyRouteTheme(routeEl);
    }
  }

  function updateRouteTitle() {
    const from = fromInput.value.trim() || "From";
    const to = toInput.value.trim() || "To";
    routeTitle.textContent = `${from} - ${to}`;
  }

  routeTitle.textContent = "From - To";

  fromInput.addEventListener("input", () => {
    updateRouteTitle();
    markRouteDirty();
  });

  toInput.addEventListener("input", () => {
    updateRouteTitle();
    markRouteDirty();
  });

  routeEl.querySelector(".mode").addEventListener("change", markRouteDirty);
  routeEl.querySelector(".color-picker").addEventListener("input", () => {
    restyleRoute();
    updateUrlHash();
  });
  routeEl.querySelector(".alpha-picker").addEventListener("input", () => {
    restyleRoute();
    updateUrlHash();
  });

  toggleRouteBtn.addEventListener("click", () => {
    routeEl.classList.toggle("collapsed");
    toggleRouteBtn.textContent = routeEl.classList.contains("collapsed") ? "+" : "−";
  });

  routeEl.querySelector(".toggle-visibility-btn").addEventListener("click", async () => {
    const visibilityBtn = routeEl.querySelector(".toggle-visibility-btn");

    if (routeLayer && !isDirty) {
      const isVisible = map.hasLayer(routeLayer);

      if (isVisible) {
        map.removeLayer(routeLayer);
        if (fromMarker) map.removeLayer(fromMarker);
        if (toMarker) map.removeLayer(toMarker);

        visibilityBtn.textContent = "Show";
      } else {
        routeLayer.addTo(map);
        if (fromMarker) fromMarker.addTo(map);
        if (toMarker) toMarker.addTo(map);

        visibilityBtn.textContent = "Hide";
      }
      updateUrlHash();

      return;
    }

    if (routeLayer) map.removeLayer(routeLayer);
    if (fromMarker) map.removeLayer(fromMarker);
    if (toMarker) map.removeLayer(toMarker);

    routeLayer = null;
    fromMarker = null;
    toMarker = null;
    routeEl._routeLayer = null

    const fromQuery = fromInput.value;
    const toQuery = toInput.value;
    const mode = routeEl.querySelector(".mode").value;
    const color = getRgbaColor(routeEl);

    updateRouteTitle();

    const fromResult = await searchPlace(fromQuery);
    if (!fromResult.ok) {
      alert(`From failed: ${fromResult.error}`);
      return;
    }

    const toResult = await searchPlace(toQuery);
    if (!toResult.ok) {
      alert(`To failed: ${toResult.error}`);
      return;
    }

    fromInput.value = fromResult.place.name;
    toInput.value = toResult.place.name;
    updateRouteTitle();

    fromMarker = L.marker([fromResult.place.lat, fromResult.place.lng])
      .addTo(map)
      .bindPopup(`From: ${fromResult.place.name}`);

    toMarker = L.marker([toResult.place.lat, toResult.place.lng])
      .addTo(map)
      .bindPopup(`To: ${toResult.place.name}`);

    const routeResult = await addRoute(
      fromResult.place,
      toResult.place,
      color,
      mode
    );

    if (!routeResult.ok) {
      alert(routeResult.error);
      return;
    }

    routeLayer = routeResult.layer;
    routeEl._routeLayer = routeLayer;
    isDirty = false;
    visibilityBtn.textContent = "Hide";
    applyRouteTheme(routeEl);

    routeEl.dataset.durationSeconds = routeResult.duration;
    updateRouteTimeDisplay(routeEl);

    updateUrlHash();
  });

  routeEl.querySelector(".delete-route-btn").addEventListener("click", () => {
    if (routeLayer) map.removeLayer(routeLayer);
    if (fromMarker) map.removeLayer(fromMarker);
    if (toMarker) map.removeLayer(toMarker);

    routeEl.remove();

    updateUrlHash();
  });

  updateRouteTitle();
  container.appendChild(routeEl);
}

async function searchPlace(query) {
  if (!query.trim()) {
    return {
      ok: false,
      error: "Search query is empty"
    };
  }

  try {
    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?q=${encodeURIComponent(query)}` +
      "&format=json" +
      "&limit=1";

    const response = await fetch(url);

    if (!response.ok) {
      return {
        ok: false,
        error: `Search failed with status ${response.status}`
      };
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return {
        ok: false,
        error: `No place found for "${query}"`
      };
    }

    return {
      ok: true,
      place: {
        lat: Number(data[0].lat),
        lng: Number(data[0].lon),
        name: data[0].display_name
      }
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message
    };
  }
}

async function addRoute(from, to, color, mode = "driving") {
  const profileMap = {
    driving: {
      server: "routed-car",
      profile: "car"
    },
    walking: {
      server: "routed-foot",
      profile: "foot"
    },
    cycling: {
      server: "routed-bike",
      profile: "bike"
    }
  };

  const selectedProfile = profileMap[mode];

  if (!selectedProfile) {
    return {
      ok: false,
      error: `Invalid mode "${mode}". Use: ${Object.keys(profileMap).join(", ")}`
    };
  }

  try {
    const url =
      `https://routing.openstreetmap.de/${selectedProfile.server}/route/v1/${selectedProfile.profile}/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`;

    const response = await fetch(url);

    if (!response.ok) {
      return {
        ok: false,
        error: `Route failed with status ${response.status}`
      };
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      return {
        ok: false,
        error: "No route found"
      };
    }

    const routeLayer = L.geoJSON(data.routes[0].geometry, {
      style: {
        color,
        weight: 6,
        opacity: 0.85
      }
    }).addTo(map);

    map.fitBounds(routeLayer.getBounds(), {
      padding: [40, 40]
    });

    return {
      ok: true,
      layer: routeLayer,
      mode,
      distance: data.routes[0].distance,
      duration: data.routes[0].duration
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message
    };
  }
}

function getRgbaColor(routeEl) {
  const hex = routeEl.querySelector(".color-picker").value;
  const alpha = routeEl.querySelector(".alpha-picker").value;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbFromHex(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function applyRouteTheme(routeEl) {
  const hex = routeEl.querySelector(".color-picker").value;
  const { r, g, b } = rgbFromHex(hex);

  routeEl.style.background = `rgba(${r}, ${g}, ${b}, 0.14)`;
  routeEl.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
}

function getLastRouteToValue() {
  const allRoutes = document.querySelectorAll(".route");
  const lastRoute = allRoutes[allRoutes.length - 1];

  if (!lastRoute) return "";

  return lastRoute.querySelector(".to-query")?.value.trim() || "";
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayDateForRoute(routeEl) {
  const dayEl = routeEl.closest(".day");
  return dayEl.querySelector(".day-date").value;
}

function formatDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function updateRouteTimeDisplay(routeEl) {
  const durationSeconds = Number(routeEl.dataset.durationSeconds);

  const durationEl = routeEl.querySelector(".route-duration");
  const endTimeEl = routeEl.querySelector(".route-end-time");
  const summaryEl = routeEl.querySelector(".route-time-summary");

  const startTime = routeEl.querySelector(".start-time").value;
  const date = getDayDateForRoute(routeEl);

  if (!durationSeconds || !startTime || !date) {
    durationEl.textContent = "—";
    endTimeEl.textContent = "—";
    summaryEl.textContent = "—";
    return;
  }

  const startDateTime = new Date(`${date}T${startTime}`);
  const endDateTime = new Date(startDateTime.getTime() + durationSeconds * 1000);

  const startText = formatTimeOnly(startDateTime);
  const endText = formatTimeOnly(endDateTime);

  const dayOffset = getDayOffset(startDateTime, endDateTime);
  const dayOffsetText = dayOffset > 0 ? ` +${dayOffset}` : "";

  durationEl.textContent = formatDuration(durationSeconds);
  endTimeEl.textContent = `${endText}${dayOffsetText}`;
  summaryEl.textContent = `${startText} - ${endText}${dayOffsetText}`;
}

function formatTimeOnly(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getDayOffset(startDate, endDate) {
  const startDay = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );

  const endDay = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  return Math.round((endDay - startDay) / 86400000);
}

function clearState() {
  map.eachLayer(layer => {
    if (!(layer instanceof L.TileLayer)) {
      map.removeLayer(layer);
    }
  });

  daysContainer.innerHTML = "";
}

function getState() {
  return {
    version: 1,
    days: Array.from(document.querySelectorAll(".day")).map(dayEl => {
      return {
        date: dayEl.querySelector(".day-date")?.value || "",
        collapsed: dayEl.classList.contains("collapsed"),

        routes: Array.from(dayEl.querySelectorAll(".route")).map(routeEl => {
          const routeLayer = routeEl._routeLayer || null;

          return {
            from: routeEl.querySelector(".from-query")?.value || "",
            to: routeEl.querySelector(".to-query")?.value || "",
            mode: routeEl.querySelector(".mode")?.value || "driving",
            startTime: routeEl.querySelector(".start-time")?.value || "",
            color: routeEl.querySelector(".color-picker")?.value || "#ff0000",
            alpha: routeEl.querySelector(".alpha-picker")?.value || "0.85",
            collapsed: routeEl.classList.contains("collapsed"),
            hidden: routeLayer ? !map.hasLayer(routeLayer) : true
          };
        })
      };
    })
  };
}

function encodeStateHash() {
  const json = JSON.stringify(getState());
  const bytes = new TextEncoder().encode(json);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeStateHash(encoded) {
  encoded = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (encoded.length % 4 !== 0) {
    encoded += "=";
  }

  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);

  return JSON.parse(json);
}

function updateUrlHash() {
  const encoded = encodeStateHash();
  history.replaceState(null, "", `#${encoded}`);
}

function loadRoute(dayContainer, routeState) {
  addRouteEditor(dayContainer);

  const routeEl = dayContainer.lastElementChild;

  routeEl.querySelector(".from-query").value = routeState.from;
  routeEl.querySelector(".to-query").value = routeState.to;
  routeEl.querySelector(".mode").value = routeState.mode;
  routeEl.querySelector(".start-time").value = routeState.startTime;
  routeEl.querySelector(".color-picker").value = routeState.color;
  routeEl.querySelector(".alpha-picker").value = routeState.alpha;

  if (!routeState.collapsed) {
    routeEl.classList.remove("collapsed");
    routeEl.querySelector(".toggle-route-btn").textContent = "−";
  }

  routeEl.querySelector(".from-query").dispatchEvent(new Event("input"));
  routeEl.querySelector(".to-query").dispatchEvent(new Event("input"));

  if (!routeState.hidden) {
    routeEl.querySelector(".toggle-visibility-btn").click();
  }
}

function loadDay(dayState) {
  addDay();

  const dayEl = daysContainer.lastElementChild;

  dayEl.querySelector(".day-date").value = dayState.date;

  if (dayState.collapsed) {
    dayEl.classList.add("collapsed");
    dayEl.querySelector(".toggle-day-btn").textContent = "+";
  }

  const routesContainer = dayEl.querySelector(".routes-container");

  for (const routeState of dayState.routes) {
    loadRoute(routesContainer, routeState);
  }
}

function loadState(stateObj) {
  clearState();
  for (const dayState of stateObj.days) {
    loadDay(dayState);
  }
}

const hashData = window.location.hash.slice(1);

if (hashData) {
  try {
    const stateObj = decodeStateHash(hashData);
    loadState(stateObj);
  } catch (err) {
    console.error("Invalid route state:", err);
  }
}