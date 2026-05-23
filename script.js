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
      <input class="day-date" type="date" value="${getNextDateString()}" />

      <div>
        <button class="delete-day-btn danger-btn">Delete</button>
        <button class="toggle-day-btn">−</button>
      </div>
    </div>

    <div class="day-body">
      <div class="routes-container"></div>
      <button class="add-route-btn">+ Route</button>
      <button class="add-pin-btn">+ Pin</button>
    </div>
  `;

  const toggleBtn = dayEl.querySelector(".toggle-day-btn");
  const deleteBtn = dayEl.querySelector(".delete-day-btn");
  const addRouteBtn = dayEl.querySelector(".add-route-btn");
  const addPinBtn = dayEl.querySelector(".add-pin-btn");
  const routesContainer = dayEl.querySelector(".routes-container");

  const dayDateInput = dayEl.querySelector(".day-date");

  dayDateInput.addEventListener("change", () => {
    updateDayTitle();
    updateUrlHash();
  });

  toggleBtn.addEventListener("click", () => {
    dayEl.classList.toggle("collapsed");
    toggleBtn.textContent = dayEl.classList.contains("collapsed") ? "+" : "−";
    updateUrlHash();
  });

  deleteBtn.addEventListener("click", () => {
    routesContainer.querySelectorAll(".route, .pin").forEach((element) => element.removeCleanup())
    dayEl.remove();
    updateUrlHash();
  });

  addRouteBtn.addEventListener("click", () => {
    addRouteEditor(routesContainer);
    updateUrlHash();
  });

  addPinBtn.addEventListener("click", () => {
    addPinEditor(routesContainer);
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

function addPinEditor(container) {
  const pinEl = document.createElement("div");
  pinEl.className = "pin collapsed";

  
  const defaultPlace = getLastRouteToValue();
  const defaultTime = getLastRouteEndTime();
  pinEl.innerHTML = `
    <div class="pin-header">
      <div class="pin-header-info">
        <span class="pin-title">Pin</span>
        <span class="pin-time-summary">—</span>
      </div>

      <div class="pin-header-actions">
        <button class="toggle-visibility-btn">Show</button>
        <button class="delete-pin-btn">Delete</button>
        <button class="toggle-pin-btn">+</button>
      </div>
    </div>

    <div class="pin-body">
      <label>Place</label>
      <input class="pin-query" placeholder="Where?" value="${defaultPlace}"/>

      <label>Emoji</label>
      <div class="emoji-picker-row">
        <input class="pin-emoji" value="🏠" />
        <button class="emoji-option">🏠</button>
        <button class="emoji-option">🛏️</button>
        <button class="emoji-option">🍽️</button>
        <button class="emoji-option">🚗</button>
        <button class="emoji-option">⭐</button>
        <button class="emoji-option">📍</button>
      </div>

      <label>Start time</label>
      <input class="start-time" type="time" value="${defaultTime}" />

      <label>Duration at place</label>
      <div class="pin-duration-row">
        <input class="pin-duration-hours" type="number" min="0" step="1" value="0" />
        <span>h</span>
        <input class="pin-duration-minutes" type="number" min="0" max="59" step="5" value="0" />
        <span>min</span>
      </div>

      <div class="pin-time-info">
        <div>Start: <span class="pin-start-time">${defaultTime}</span></div>
        <div>End: <span class="pin-end-time">${defaultTime}</span></div>
      </div>
    </div>
  `;

  const pinTitle = pinEl.querySelector(".pin-title");
  const timeSummary = pinEl.querySelector(".pin-time-summary");
  const toggleRouteBtn = pinEl.querySelector(".toggle-pin-btn");
  const visibilityBtn = pinEl.querySelector(".toggle-visibility-btn");

  const pinInput = pinEl.querySelector(".pin-query");
  const emojiInput = pinEl.querySelector(".pin-emoji");
  const startTimeInput = pinEl.querySelector(".start-time");
  const pinStartTime = pinEl.querySelector(".pin-start-time");
  const pinEndTime = pinEl.querySelector(".pin-end-time");
  const durationHoursInput = pinEl.querySelector(".pin-duration-hours");
  const durationMinutesInput = pinEl.querySelector(".pin-duration-minutes");

  let pinMarker = null;
  pinEl._pinMarker = null;
  let isDirty = true;

  function updatePinTitle() {
    const place = pinInput.value.trim() || "Pin";
    const emoji = emojiInput.value.trim() || "";
    pinTitle.textContent = `${emoji} ${place}`;
  }

  function updatePinTimeDisplay() {
    const startTime = startTimeInput.value;
    const durationHours = Number(durationHoursInput.value || 0);
    const durationMins = Number(durationMinutesInput.value || 0);
    const durationMinutes = durationHours * 60 + durationMins;
    const date = getDayDateForRoute(pinEl);

    if (!startTime || !date) {
      timeSummary.textContent = "—";
      pinStartTime.textContent = "—";
      pinEndTime.textContent = "—";
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);

    const startText = formatTimeOnly(startDateTime);
    const endText = formatTimeOnly(endDateTime);

    const dayOffset = getDayOffset(startDateTime, endDateTime);
    const dayOffsetText = dayOffset > 0 ? ` +${dayOffset}` : "";

    timeSummary.textContent = `${startText} - ${endText}${dayOffsetText}`;

    pinStartTime.textContent = startText;
    pinEndTime.textContent = `${endText}${dayOffsetText}`;
  }

  function markPinDirty() {
    isDirty = true;

    if (pinMarker) {
      visibilityBtn.textContent = "Update";
    }
  }

  function createEmojiIcon(emoji) {
    return L.divIcon({
      html: `<span class="emoji-marker">${emoji}</span>`,
      className: "emoji-icon",
      iconSize: [64, 64],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  }

  pinInput.addEventListener("input", () => {
    updatePinTitle();
    markPinDirty();
  });

  emojiInput.addEventListener("input", markPinDirty);

  startTimeInput.addEventListener("change", () => {
    updatePinTimeDisplay();
    markPinDirty();
    updateUrlHash();
  });

  toggleRouteBtn.addEventListener("click", () => {
    pinEl.classList.toggle("collapsed");
    toggleRouteBtn.textContent = pinEl.classList.contains("collapsed") ? "+" : "−";
    updateUrlHash();
  });

  visibilityBtn.addEventListener("click", async () => {
    if (pinMarker && !isDirty) {
      const isVisible = map.hasLayer(pinMarker);

      if (isVisible) {
        map.removeLayer(pinMarker);
        visibilityBtn.textContent = "Show";
      } else {
        pinMarker.addTo(map);
        visibilityBtn.textContent = "Hide";
      }

      updateUrlHash();
      return;
    }

    if (pinMarker) map.removeLayer(pinMarker);

    pinMarker = null;
    pinEl._pinMarker = null;

    const placeQuery = pinInput.value;
    const emoji = emojiInput.value.trim() || "📍";

    const placeResult = await searchPlace(placeQuery);
    if (!placeResult.ok) {
      alert(`Place failed: ${placeResult.error}`);
      return;
    }

    pinInput.value = placeResult.place.name;
    updatePinTitle();
    updatePinTimeDisplay();

    pinMarker = L.marker(
      [placeResult.place.lat, placeResult.place.lng],
      {
        icon: createEmojiIcon(emoji),
        zIndexOffset: 999999
      }
    )
      .addTo(map)
      .bindPopup(`
        ${emoji} ${placeResult.place.name}<br>
        ${timeSummary.textContent}
      `);

    pinEl._pinMarker = pinMarker;

    isDirty = false;
    visibilityBtn.textContent = "Hide";

    updateUrlHash();
  });

  [durationHoursInput, durationMinutesInput].forEach((input) => {
    input.addEventListener("input", () => {
      updatePinTimeDisplay();
      markPinDirty();
      updateUrlHash();
    });
  });

  pinEl.querySelectorAll(".emoji-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      emojiInput.value = btn.textContent;
      updatePinTitle();
      markPinDirty();
      updateUrlHash();
    });
  });

  pinEl.removeCleanup = function() {
    if (pinMarker) map.removeLayer(pinMarker);

    pinEl.remove();
  }

  pinEl.querySelector(".delete-pin-btn").addEventListener("click", () => {
    pinEl.removeCleanup();
    updateUrlHash();
  });

  updatePinTitle();
  container.appendChild(pinEl);
}

function addRouteEditor(container) {
  const routeEl = document.createElement("div");
  routeEl.className = "route collapsed";

  const previousRoute = container.lastElementChild;
  const previousColorPicker = previousRoute?.querySelector(".color-picker");
  const defaultHex = previousColorPicker ? previousColorPicker.value : "#ff0000";

  const defaultFrom = getLastRouteToValue();
  const defaultStartTime = getLastRouteEndTime();
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
      <input class="from-query" placeholder="From Where?" value="${defaultFrom}" />

      <label>To</label>
      <input class="to-query" placeholder="To Where?"/>

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
      <input class="start-time" type="time" value="${defaultStartTime}" />

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
    updateUrlHash();
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
      .bindPopup(fromResult.place.name);

    toMarker = L.marker([toResult.place.lat, toResult.place.lng])
      .addTo(map)
      .bindPopup(toResult.place.name);

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

  routeEl.removeCleanup = function () {
    if (routeLayer) map.removeLayer(routeLayer);
    if (fromMarker) map.removeLayer(fromMarker);
    if (toMarker) map.removeLayer(toMarker);

    routeEl.remove();
  }

  routeEl.querySelector(".delete-route-btn").addEventListener("click", () => {
    routeEl.removeCleanup();
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
  const allRoutes = document.querySelectorAll(".route, .pin");
  const lastRoute = allRoutes[allRoutes.length - 1];

  return lastRoute?.querySelector(".to-query, .pin-query")?.value.trim() || "";
}

function getLastRouteEndTime() {
  const defaultTime = "00:00";
  const allRoutes = document.querySelectorAll(".route, .pin");
  const lastRoute = allRoutes[allRoutes.length - 1];

  const text = lastRoute?.querySelector(".route-end-time, .pin-end-time")?.textContent.trim();

  if (text == "—") return defaultTime;

  return text || defaultTime;
}

function getNextDateString() {
  const lastDay = daysContainer.lastElementChild;

  let dayDate = null;

  if (lastDay) {
    const lastDayDateInput = lastDay.querySelector(".day-date");
    dayDate = new Date(lastDayDateInput.value + "T00:00:00");
    dayDate.setDate(dayDate.getDate() + 1);
  } else {
    dayDate = new Date();
  }

  const year = dayDate.getFullYear();
  const month = String(dayDate.getMonth() + 1).padStart(2, "0");
  const day = String(dayDate.getDate()).padStart(2, "0");
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

function getStateV1() {
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

function getStateV2() {
  return {
    version: 2,
    days: Array.from(document.querySelectorAll(".day")).map(dayEl => {
      return {
        date: dayEl.querySelector(".day-date")?.value || "",
        collapsed: dayEl.classList.contains("collapsed"),

        items: Array.from(dayEl.querySelectorAll(".route, .pin")).map(itemEl => {
          if (itemEl.classList.contains("route")) {
            const routeLayer = itemEl._routeLayer || null;

            return {
              type: "route",
              from: itemEl.querySelector(".from-query")?.value || "",
              to: itemEl.querySelector(".to-query")?.value || "",
              mode: itemEl.querySelector(".mode")?.value || "driving",
              startTime: itemEl.querySelector(".start-time")?.value || "",
              color: itemEl.querySelector(".color-picker")?.value || "#ff0000",
              alpha: itemEl.querySelector(".alpha-picker")?.value || "0.85",
              collapsed: itemEl.classList.contains("collapsed"),
              hidden: routeLayer ? !map.hasLayer(routeLayer) : true
            };
          }

          if (itemEl.classList.contains("pin")) {
            const pinLayer = itemEl._pinMarker || null;

            return {
              type: "pin",
              place: itemEl.querySelector(".pin-query")?.value || "",
              emoji: itemEl.querySelector(".pin-emoji")?.value || "",
              startTime: itemEl.querySelector(".start-time")?.value || "",
              durationHours: itemEl.querySelector(".pin-duration-hours")?.value || "",
              durationMinutes: itemEl.querySelector(".pin-duration-minutes")?.value || "",
              collapsed: itemEl.classList.contains("collapsed"),
              hidden: pinLayer ? !map.hasLayer(pinLayer) : true
            };
          }
        })
      };
    })
  };
}

function encodeStateHash() {
  const json = JSON.stringify(getStateV2());
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

function loadPin(dayContainer, pinState) {
  addPinEditor(dayContainer);

  const pinEl = dayContainer.lastElementChild;

  pinEl.querySelector(".pin-query").value = pinState.place;
  pinEl.querySelector(".pin-emoji").value = pinState.emoji;
  pinEl.querySelector(".start-time").value = pinState.startTime;
  pinEl.querySelector(".pin-duration-hours").value = pinState.durationHoursInput;
  pinEl.querySelector(".pin-duration-minutes").value = pinState.durationMinutesInput;

  if (!pinState.collapsed) {
    pinEl.classList.remove("collapsed");
    pinEl.querySelector(".toggle-route-btn").textContent = "−";
  }

  pinEl.querySelector(".pin-query").dispatchEvent(new Event("input"));
  pinEl.querySelector(".pin-emoji").dispatchEvent(new Event("input"));

  if (!pinState.hidden) {
    pinEl.querySelector(".toggle-visibility-btn").click();
  }
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

  const dateInput = dayEl.querySelector(".day-date");
  dateInput.value = dayState.date;
  dateInput.dispatchEvent(new Event("change"));

  if (dayState.collapsed) {
    dayEl.classList.add("collapsed");
    dayEl.querySelector(".toggle-day-btn").textContent = "+";
  }

  const container = dayEl.querySelector(".routes-container");

  dayState.items.forEach(state => {
  if (state.type === "route") {
    loadRoute(container, state);
  }

  if (state.type === "pin") {
    loadPin(container, state);
  }
});
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