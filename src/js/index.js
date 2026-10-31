// ═══════════════════════════════════════════════════════════
//  Nimbus · Lógica principal
//  API: Open-Meteo (sin API key) + geocoding incluido
//  Efectos: canvas de partículas según el clima + temas vivos
// ═══════════════════════════════════════════════════════════

// ── Endpoints (gratuitos, sin registro) ──────────────────────
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const REVERSE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

// ── Códigos WMO de Open-Meteo → descripción y tipo de efecto ──
const CLIMAS = {
  0: { desc: "Despejado", tipo: "clear" },
  1: { desc: "Mayormente despejado", tipo: "partly" },
  2: { desc: "Parcialmente nublado", tipo: "partly" },
  3: { desc: "Nublado", tipo: "cloud" },
  45: { desc: "Niebla", tipo: "fog" },
  48: { desc: "Escarcha", tipo: "fog" },
  51: { desc: "Llovizna ligera", tipo: "drizzle" },
  53: { desc: "Llovizna", tipo: "drizzle" },
  55: { desc: "Llovizna intensa", tipo: "drizzle" },
  56: { desc: "Llovizna helada", tipo: "drizzle" },
  57: { desc: "Llovizna helada intensa", tipo: "drizzle" },
  61: { desc: "Lluvia ligera", tipo: "rain" },
  63: { desc: "Lluvia moderada", tipo: "rain" },
  65: { desc: "Lluvia intensa", tipo: "rain" },
  66: { desc: "Lluvia helada", tipo: "rain" },
  67: { desc: "Lluvia helada intensa", tipo: "rain" },
  71: { desc: "Nieve ligera", tipo: "snow" },
  73: { desc: "Nieve moderada", tipo: "snow" },
  75: { desc: "Nieve intensa", tipo: "snow" },
  77: { desc: "Granos de nieve", tipo: "snow" },
  80: { desc: "Chubascos ligeros", tipo: "rain" },
  81: { desc: "Chubascos", tipo: "rain" },
  82: { desc: "Chubascos violentos", tipo: "rain" },
  85: { desc: "Nevadas ligeras", tipo: "snow" },
  86: { desc: "Nevadas intensas", tipo: "snow" },
  95: { desc: "Tormenta", tipo: "storm" },
  96: { desc: "Tormenta con granizo", tipo: "storm" },
  99: { desc: "Tormenta intensa con granizo", tipo: "storm" },
};

// ── Cada tema de fondo tiene su modo de partículas ───────────
const PARTICULAS_POR_TEMA = {
  "clear-day": "bokeh",
  "clear-night": "stars",
  "partly-day": "clouds",
  "partly-night": "stars",
  "cloudy-day": "clouds",
  "cloudy-night": "clouds",
  rain: "rain",
  snow: "snow",
  storm: "storm",
  fog: "mist",
};

// ── Parámetros opcionales de URL ─────────────────────────────
// ?q=Bogota   → abre directamente con esa ciudad (enlaces compartibles)
// ?tema=rain  → previsualiza un fondo/paleta sin depender del clima real
const PARAMS = new URLSearchParams(location.search);
const Q_INICIAL = (PARAMS.get("q") || "").trim();
const TEMA_FORZADO = PARTICULAS_POR_TEMA[PARAMS.get("tema")]
  ? PARAMS.get("tema")
  : null;

// ── Selección de elementos del HTML ──────────────────────────
const searchForm = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const geoBtn = document.getElementById("geoBtn");
const suggestions = document.getElementById("suggestions");
const statusEl = document.getElementById("status");
const unitToggle = document.getElementById("unitToggle");

const notFound = document.getElementById("notFound");
const current = document.getElementById("current");
const details = document.getElementById("details");
const hourly = document.getElementById("hourly");
const daily = document.getElementById("daily");

const cityName = document.getElementById("cityName");
const dateText = document.getElementById("dateText");
const badgeHora = document.getElementById("badgeHora");
const weatherIcon = document.getElementById("weatherIcon");
const tempValue = document.getElementById("tempValue");
const descText = document.getElementById("descText");
const feelsText = document.getElementById("feelsText");

const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const pressureEl = document.getElementById("pressure");
const hourRail = document.getElementById("hourRail");
const daysList = document.getElementById("daysList");
const sky = document.querySelector(".sky");

// ── Estado global ────────────────────────────────────────────
const estado = {
  datos: null, // última respuesta de la API
  ubicacion: null, // { lat, lon, label }
  unidad: localStorage.getItem("weather-unidad") || "C",
};

// Ubicación guardada del usuario (si la hay)
const GUARDADA = JSON.parse(localStorage.getItem("weather-ubicacion") || "null");

document.getElementById("year").textContent = new Date().getFullYear();

// ═══ Utilidades de conversión y formato ═════════════════════
const aF = (c) => (c * 9) / 5 + 32;

function fmtTemp(celsius) {
  return estado.unidad === "F" ? Math.round(aF(celsius)) : Math.round(celsius);
}

function fmtViento(kmh) {
  return estado.unidad === "F"
    ? `${Math.round(kmh * 0.6214)} mph`
    : `${Math.round(kmh)} km/h`;
}

// Fechas: la API devuelve hora local de la ciudad ("2026-10-30")
function fechaUTC(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const fmtFechaLarga = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const fmtDiaCorto = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  timeZone: "UTC",
});

function capitalizar(txt) {
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

// ═══ Iconos SVG animados (sin dependencias externas) ════════
const nubeSVG = (fill = "#e8eef7") => `
  <g class="cloud-g" fill="${fill}">
    <circle cx="24" cy="34" r="10"/>
    <circle cx="37" cy="31" r="12"/>
    <circle cx="47" cy="39" r="8"/>
    <rect x="18" y="37" width="32" height="13" rx="6.5"/>
  </g>`;

const solSVG = (cx, cy, r, len) => {
  // distancias desde el centro: eje y diagonal (d convierte a 45°)
  const inA = r + 4;
  const outA = r + 4 + len;
  const inD = d(inA);
  const outD = d(outA);

  return `
  <g class="rays" stroke="#fbbf24" stroke-width="3.5" stroke-linecap="round">
    <line x1="${cx}" y1="${cy - outA}" x2="${cx}" y2="${cy - inA}"/>
    <line x1="${cx}" y1="${cy + inA}" x2="${cx}" y2="${cy + outA}"/>
    <line x1="${cx - inA}" y1="${cy}" x2="${cx - outA}" y2="${cy}"/>
    <line x1="${cx + inA}" y1="${cy}" x2="${cx + outA}" y2="${cy}"/>
    <line x1="${cx - inD}" y1="${cy - inD}" x2="${cx - outD}" y2="${cy - outD}"/>
    <line x1="${cx + inD}" y1="${cy + inD}" x2="${cx + outD}" y2="${cy + outD}"/>
    <line x1="${cx - inD}" y1="${cy + inD}" x2="${cx - outD}" y2="${cy + outD}"/>
    <line x1="${cx + inD}" y1="${cy - inD}" x2="${cx + outD}" y2="${cy - outD}"/>
  </g>
  <circle class="core" cx="${cx}" cy="${cy}" r="${r}" fill="#fbbf24"/>`;
};

// diagonales a 45° (0.7071 = √2/2)
const d = (v) => Math.round(v * 0.7071 * 10) / 10;

// Luna (trazado de Feather Icons escalado a 64) + estrellas fuera de la luna
const lunaSVG = `
  <path d="M56 34.11A24 24 0 1 1 29.89 8 18.67 18.67 0 0 0 56 34.11z" fill="#fde68a"/>
  <circle class="mstar" cx="54" cy="14" r="2.6" fill="#fde68a"/>
  <circle class="mstar" cx="58" cy="30" r="1.8" fill="#fde68a"/>`;

const gotasSVG = (n) => {
  const xs = n === 2 ? [30, 42] : [26, 35, 44];
  return xs
    .map(
      (x) =>
        `<line class="drop" x1="${x}" y1="49" x2="${x - 3}" y2="57"
           stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>`,
    )
    .join("");
};

const coposSVG = `
  <g class="flake" stroke="#bae6fd" stroke-width="1.7" stroke-linecap="round" fill="none">
    <path d="M21 55h10M26 50v10M22.5 51.5l7 7M22.5 58.5l7-7"/>
  </g>
  <g class="flake" stroke="#bae6fd" stroke-width="1.7" stroke-linecap="round" fill="none">
    <path d="M34 55h10M39 50v10M35.5 51.5l7 7M35.5 58.5l7-7"/>
  </g>
  <g class="flake" stroke="#bae6fd" stroke-width="1.7" stroke-linecap="round" fill="none">
    <path d="M46 55h10M51 50v10M47.5 51.5l7 7M47.5 58.5l7-7"/>
  </g>`;

function iconoSVG(codigo, esDia) {
  const info = CLIMAS[codigo] || { tipo: "cloud" };
  const nubeClara = esDia ? "#e8eef7" : "#cbd5e1";
  let interior = "";

  switch (info.tipo) {
    case "clear":
      interior = esDia ? solSVG(32, 32, 12, 7) : lunaSVG;
      break;

    case "partly":
      interior = esDia
        ? solSVG(22, 22, 8, 6) +
          nubeSVG(nubeClara).replace("g class", 'g transform="translate(6,9)" class')
        : `
          <g transform="translate(-2,-4) scale(0.62)">${lunaSVG}</g>
          ${nubeSVG(nubeClara).replace("g class", 'g transform="translate(8,12)" class')}`;
      break;

    case "cloud":
      interior = nubeSVG(nubeClara);
      break;

    case "fog":
      interior = `
        ${nubeSVG(nubeClara)}
        <line class="mist" x1="18" y1="53" x2="44" y2="53" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>
        <line class="mist" x1="26" y1="60" x2="52" y2="60" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>`;
      break;

    case "drizzle":
      interior = `${nubeSVG(nubeClara)}${gotasSVG(2)}`;
      break;

    case "rain":
      interior = `${nubeSVG(nubeClara)}${gotasSVG(3)}`;
      break;

    case "snow":
      interior = `${nubeSVG(nubeClara)}${coposSVG}`;
      break;

    case "storm":
      interior = `
        ${nubeSVG("#94a3b8")}
        <polygon class="bolt" points="34,47 26,56.5 31.5,56.5 30.5,63 40,52.5 34.5,52.5"
                 fill="#facc15"/>`;
      break;

    default:
      interior = nubeSVG(nubeClara);
  }

  return `<svg class="wico" viewBox="0 0 64 64" role="img" aria-hidden="true">${interior}</svg>`;
}

// ═══ Tema visual (fondo + acento + partículas) ══════════════
function temaPara(tipo, esDia) {
  if (tipo === "clear") return esDia ? "clear-day" : "clear-night";
  if (tipo === "partly") return esDia ? "partly-day" : "partly-night";
  if (tipo === "cloud") return esDia ? "cloudy-day" : "cloudy-night";
  if (tipo === "fog") return "fog";
  if (tipo === "rain" || tipo === "drizzle") return "rain";
  if (tipo === "snow") return "snow";
  if (tipo === "storm") return "storm";
  return "clear-day";
}

function aplicarTema(nuevoTema) {
  if (TEMA_FORZADO || document.body.dataset.theme === nuevoTema) return;

  // Crossfade suave: el cielo se atenúa, cambia y vuelve
  sky.classList.add("fade");
  setTimeout(() => {
    document.body.dataset.theme = nuevoTema;
    sky.classList.remove("fade");
  }, 430);

  fx.setMode(PARTICULAS_POR_TEMA[nuevoTema] || "bokeh");
}

// ═══ Canvas de partículas ═══════════════════════════════════
class SkyFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.modo = "bokeh";
    this.p = [];
    this.proximoRayo = 0;
    this.reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.resize();
    addEventListener("resize", () => this.resize());

    this.ultimo = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.crear();
  }

  setMode(modo) {
    if (modo === this.modo) return;
    this.modo = modo;
    this.crear();
  }

  // Crea la tanda de partículas según el modo activo
  crear() {
    const { w, h, modo } = this;
    this.p = [];

    if (modo === "rain" || modo === "storm") {
      const n = modo === "storm" ? 240 : 150;
      for (let i = 0; i < n; i++) {
        this.p.push({
          x: Math.random() * (w + 120),
          y: Math.random() * h,
          len: 12 + Math.random() * 18,
          v: 9 + Math.random() * 8 + (modo === "storm" ? 5 : 0),
          a: 0.25 + Math.random() * 0.4,
        });
      }
    } else if (modo === "snow") {
      for (let i = 0; i < 120; i++) {
        this.p.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 1 + Math.random() * 2.6,
          v: 0.5 + Math.random() * 1.1,
          sway: 0.4 + Math.random() * 1.2,
          fase: Math.random() * Math.PI * 2,
          a: 0.4 + Math.random() * 0.5,
        });
      }
    } else if (modo === "stars") {
      for (let i = 0; i < 150; i++) {
        this.p.push({
          x: Math.random() * w,
          y: Math.random() * h * 0.9,
          r: Math.random() * 1.4 + 0.3,
          tw: 0.5 + Math.random() * 2,
          fase: Math.random() * Math.PI * 2,
          a: 0.3 + Math.random() * 0.6,
        });
      }
    } else if (modo === "bokeh") {
      for (let i = 0; i < 26; i++) {
        this.p.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 8 + Math.random() * 26,
          v: 0.15 + Math.random() * 0.35,
          sway: Math.random() * Math.PI * 2,
          a: 0.04 + Math.random() * 0.07,
        });
      }
    } else if (modo === "clouds" || modo === "mist") {
      const n = modo === "mist" ? 5 : 7;
      for (let i = 0; i < n; i++) {
        this.p.push({
          x: Math.random() * w,
          y: modo === "mist" ? h * (0.45 + Math.random() * 0.5) : h * (Math.random() * 0.7),
          s: modo === "mist" ? 90 + Math.random() * 90 : 120 + Math.random() * 160,
          v: (modo === "mist" ? 0.08 : 0.18) + Math.random() * 0.2,
          a: modo === "mist" ? 0.05 + Math.random() * 0.05 : 0.05 + Math.random() * 0.06,
        });
      }
    }
  }

  dispararRelampago() {
    const el = document.querySelector(".lightning");
    el.classList.remove("flash");
    void el.offsetWidth; // reinicia la animación CSS
    el.classList.add("flash");
  }

  frame(t) {
    const dt = Math.min((t - this.ultimo) / 16.7, 3); // estable ante tirones
    this.ultimo = t;

    if (!this.reducido) this.dibujar(t, dt);
    else this.dibujar(0, 0);

    requestAnimationFrame((tt) => this.frame(tt));
  }

  dibujar(t, dt) {
    const { ctx, w, h, modo } = this;
    ctx.clearRect(0, 0, w, h);

    if (modo === "rain" || modo === "storm") {
      ctx.lineCap = "round";
      for (const g of this.p) {
        g.y += g.v * dt;
        g.x -= g.v * 0.18 * dt; // inclinación
        if (g.y > h) {
          g.y = -g.len;
          g.x = Math.random() * (w + 120);
        }
        ctx.strokeStyle = `rgba(174, 196, 239, ${g.a})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x + 3, g.y + g.len);
        ctx.stroke();
      }

      if (modo === "storm" && !this.reducido) {
        if (t > this.proximoRayo) {
          this.dispararRelampago();
          this.proximoRayo = t + 2600 + Math.random() * 5200;
        }
      }
    } else if (modo === "snow") {
      for (const f of this.p) {
        f.y += f.v * dt;
        f.x += Math.sin(t / 1400 + f.fase) * f.sway * dt;
        if (f.y > h + 4) {
          f.y = -6;
          f.x = Math.random() * w;
        }
        ctx.fillStyle = `rgba(240, 249, 255, ${f.a})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (modo === "stars") {
      for (const s of this.p) {
        const alpha = s.a * (0.55 + 0.45 * Math.sin(t / 900 * s.tw + s.fase));
        ctx.fillStyle = `rgba(226, 232, 240, ${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (modo === "bokeh") {
      for (const b of this.p) {
        b.y -= b.v * dt;
        if (b.y + b.r < 0) {
          b.y = h + b.r;
          b.x = Math.random() * w;
        }
        const x = b.x + Math.sin(t / 2600 + b.sway) * 14;
        const g = ctx.createRadialGradient(x, b.y, 0, x, b.y, b.r);
        g.addColorStop(0, `rgba(255, 251, 230, ${b.a})`);
        g.addColorStop(1, "rgba(255, 251, 230, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (modo === "clouds" || modo === "mist") {
      for (const c of this.p) {
        c.x += c.v * dt;
        const ancho = c.s * 2.2;
        if (c.x - c.s > w) c.x = -ancho;
        ctx.fillStyle =
          modo === "mist"
            ? `rgba(226, 232, 240, ${c.a})`
            : `rgba(226, 232, 240, ${c.a})`;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.s, c.s * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(c.x + c.s * 0.5, c.y - c.s * 0.2, c.s * 0.55, c.s * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

const fx = new SkyFX(document.getElementById("fx"));

// Si la URL trae un tema forzado, se aplica desde el inicio
if (TEMA_FORZADO) {
  document.body.dataset.theme = TEMA_FORZADO;
  fx.setMode(PARTICULAS_POR_TEMA[TEMA_FORZADO]);
}

// ═══ Estados visuales (carga / error / resultados) ══════════
function mostrarEstado(msg, esError = false) {
  statusEl.hidden = !msg;
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("error", esError);
}

function ocultarResultados() {
  current.hidden = true;
  details.hidden = true;
  hourly.hidden = true;
  daily.hidden = true;
  notFound.hidden = true;
}

function mostrarNoEncontrado(msg) {
  ocultarResultados();
  mostrarEstado("", false);
  notFound.hidden = false;
  notFound.querySelector("span").textContent =
    msg || "Revisa el nombre o prueba con otra ciudad";
}

function mostrarResultados() {
  notFound.hidden = true;
  mostrarEstado("");
  current.hidden = false;
  details.hidden = false;
  hourly.hidden = false;
  daily.hidden = false;
}

// Conteo animado de la temperatura (0 → valor real)
function animarTemperatura(destino) {
  const inicio = performance.now();
  const dur = 850;
  const paso = (t) => {
    const p = Math.min((t - inicio) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    tempValue.textContent = `${Math.round(destino * e)}°`;
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// ═══ Renderizado ════════════════════════════════════════════
function renderClima(datos, etiqueta) {
  const c = datos.current;
  const info = CLIMAS[c.weather_code] || { desc: "Sin datos", tipo: "cloud" };
  const esDia = c.is_day === 1;

  // Fondo + partículas del nuevo clima
  aplicarTema(temaPara(info.tipo, esDia));

  // Tarjeta principal
  weatherIcon.innerHTML = iconoSVG(c.weather_code, esDia);
  cityName.textContent = etiqueta;
  dateText.textContent = capitalizar(fmtFechaLarga.format(fechaUTC(c.time)));
  badgeHora.innerHTML = `<i class="fa-regular fa-clock"></i> ${c.time.slice(11, 16)}`;
  animarTemperatura(fmtTemp(c.temperature_2m));
  descText.textContent = info.desc;
  feelsText.textContent = `Sensación térmica ${fmtTemp(c.apparent_temperature)}°`;

  // Detalles
  humidityEl.textContent = `${c.relative_humidity_2m}%`;
  windEl.textContent = fmtViento(c.wind_speed_10m);
  pressureEl.textContent = `${Math.round(c.surface_pressure)} hPa`;

  renderHoras(datos);
  renderDias(datos);
  mostrarResultados();
}

function renderHoras(datos) {
  const { time, temperature_2m, weather_code } = datos.hourly;

  // Primer índice >= a la hora actual de la ciudad
  const clave = `${datos.current.time.slice(0, 13)}:00`;
  let i = time.findIndex((h) => h >= clave);
  if (i < 0) i = 0;

  const fin = Math.min(i + 12, time.length);
  let html = "";

  for (; i < fin; i++) {
    const hora = time[i].slice(11, 16);
    const h = Number(hora.slice(0, 2));
    const esDia = h >= 7 && h < 20;
    const esAhora = i === time.findIndex((x) => x >= clave);

    html += `
      <div class="hour${esAhora ? " now" : ""}">
        <span class="h">${esAhora ? "Ahora" : hora}</span>
        ${iconoSVG(weather_code[i], esDia)}
        <span class="t">${fmtTemp(temperature_2m[i])}°</span>
      </div>`;
  }

  hourRail.innerHTML = html;
}

function renderDias(datos) {
  const { time, weather_code, temperature_2m_max, temperature_2m_min } =
    datos.daily;

  // Escala global para las barras de rango térmico
  const gMin = Math.min(...temperature_2m_min);
  const gMax = Math.max(...temperature_2m_max);
  const rango = gMax - gMin || 1;
  const hoy = datos.current.time.slice(0, 10);

  daysList.innerHTML = time
    .map((fecha, i) => {
      const esHoy = fecha.slice(0, 10) === hoy;
      const a = ((temperature_2m_min[i] - gMin) / rango) * 100;
      const b = Math.max(((temperature_2m_max[i] - gMin) / rango) * 100, a + 8);
      const etiquetaDia = esHoy ? "Hoy" : capitalizar(fmtDiaCorto.format(fechaUTC(fecha)));

      return `
        <li>
          <span class="day-name${esHoy ? " today" : ""}">${etiquetaDia}</span>
          ${iconoSVG(weather_code[i], true)}
          <span class="min-temp">${fmtTemp(temperature_2m_min[i])}°</span>
          <span class="track"><span class="fill" style="--a:${a.toFixed(1)}%; --b:${Math.min(b, 100).toFixed(1)}%"></span></span>
          <span class="max-temp">${fmtTemp(temperature_2m_max[i])}°</span>
        </li>`;
    })
    .join("");
}

// ═══ Llamadas a la API ══════════════════════════════════════
async function obtenerClima(lat, lon, etiqueta) {
  ocultarResultados();
  mostrarEstado("Consultando el clima…");

  estado.ubicacion = { lat, lon, label: etiqueta };
  localStorage.setItem("weather-ubicacion", JSON.stringify(estado.ubicacion));

  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,surface_pressure",
      hourly: "temperature_2m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      timezone: "auto",
      forecast_days: "7",
    });

    const res = await fetch(`${WEATHER_URL}?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const datos = await res.json();
    estado.datos = datos;
    renderClima(datos, etiqueta);
  } catch (error) {
    console.error("Error al obtener el clima:", error);
    mostrarNoEncontrado("No se pudo conectar con la API. Revisa tu conexión.");
  }
}

async function geocodificar(nombre) {
  const params = new URLSearchParams({
    name: nombre,
    count: "1",
    language: "es",
    format: "json",
  });
  const res = await fetch(`${GEO_URL}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const datos = await res.json();
  return (datos.results || [])[0] || null;
}

async function buscarPorNombre(nombre) {
  ocultarResultados();
  mostrarEstado("Buscando ciudad…");

  try {
    const lugar = await geocodificar(nombre);
    if (!lugar) {
      mostrarNoEncontrado();
      return;
    }
    const etiqueta = [lugar.name, lugar.admin1].filter(Boolean).join(", ");
    await obtenerClima(lugar.latitude, lugar.longitude, etiqueta);
  } catch (error) {
    console.error("Error en la búsqueda:", error);
    mostrarNoEncontrado("No se pudo conectar con la API. Revisa tu conexión.");
  }
}

// ═══ Sugerencias de ciudades (geocoding en vivo) ════════════
let timerSugerencias = null;
let ultimaLista = [];

function ocultarSugerencias() {
  suggestions.hidden = true;
  suggestions.innerHTML = "";
}

async function pedirSugerencias(texto) {
  try {
    const params = new URLSearchParams({
      name: texto,
      count: "5",
      language: "es",
      format: "json",
    });
    const res = await fetch(`${GEO_URL}?${params}`);
    const datos = await res.json();
    ultimaLista = datos.results || [];
    renderSugerencias(ultimaLista);
  } catch {
    // silencioso: las sugerencias son un extra
  }
}

function renderSugerencias(lista) {
  if (!lista.length) {
    suggestions.innerHTML = `<li class="empty">Sin coincidencias</li>`;
    suggestions.hidden = false;
    return;
  }

  suggestions.innerHTML = lista
    .map(
      (l, i) => `
      <li role="option" tabindex="-1" data-i="${i}">
        <span class="place">${l.name}</span>
        <span class="meta">${[l.admin1, l.country].filter(Boolean).join(", ")}</span>
      </li>`,
    )
    .join("");
  suggestions.hidden = false;
}

cityInput.addEventListener("input", () => {
  const texto = cityInput.value.trim();
  clearTimeout(timerSugerencias);
  if (texto.length < 2) {
    ocultarSugerencias();
    return;
  }
  timerSugerencias = setTimeout(() => pedirSugerencias(texto), 280);
});

cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") ocultarSugerencias();
});

// mousedown (antes del blur) para que el click no se pierda
suggestions.addEventListener("mousedown", (e) => {
  const li = e.target.closest("li[data-i]");
  if (!li) return;
  e.preventDefault();

  const lugar = ultimaLista[Number(li.dataset.i)];
  if (!lugar) return;

  ocultarSugerencias();
  cityInput.value = "";
  cityInput.blur();
  const etiqueta = [lugar.name, lugar.admin1].filter(Boolean).join(", ");
  obtenerClima(lugar.latitude, lugar.longitude, etiqueta);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) ocultarSugerencias();
});

// ═══ Búsqueda manual ════════════════════════════════════════
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  ocultarSugerencias();

  const texto = cityInput.value.trim();
  if (!texto) return;

  // Si hay sugerencias visibles, toma la primera
  if (ultimaLista.length && !suggestions.hidden) {
    const lugar = ultimaLista[0];
    cityInput.value = "";
    const etiqueta = [lugar.name, lugar.admin1].filter(Boolean).join(", ");
    obtenerClima(lugar.latitude, lugar.longitude, etiqueta);
    return;
  }

  buscarPorNombre(texto);
  cityInput.value = "";
});

// ═══ Geolocalización del navegador ══════════════════════════
function nombreDeCoords(lat, lon) {
  return fetch(
    `${REVERSE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=es`,
  )
    .then((r) => r.json())
    .then((d) => {
      const partes = [d.city || d.locality, d.countryName].filter(Boolean);
      return partes.join(", ") || "Tu ubicación";
    })
    .catch(() => "Tu ubicación");
}

geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    mostrarNoEncontrado("Tu navegador no soporta geolocalización.");
    return;
  }

  geoBtn.classList.add("loading");

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      const etiqueta = await nombreDeCoords(latitude, longitude);
      geoBtn.classList.remove("loading");
      obtenerClima(latitude, longitude, etiqueta);
    },
    (err) => {
      geoBtn.classList.remove("loading");
      console.warn("Geolocalización denegada:", err.message);
      mostrarNoEncontrado(
        "No pude acceder a tu ubicación. Busca tu ciudad manualmente.",
      );
    },
    { timeout: 9000, maximumAge: 300000 },
  );
});

// ═══ Selector °C / °F ═══════════════════════════════════════
function pintarUnidad() {
  unitToggle.querySelectorAll(".unit").forEach((el) => {
    el.classList.toggle("active", el.dataset.unit === estado.unidad);
  });
}

unitToggle.addEventListener("click", () => {
  estado.unidad = estado.unidad === "C" ? "F" : "C";
  localStorage.setItem("weather-unidad", estado.unidad);
  pintarUnidad();

  // Re-render inmediato si ya hay datos cargados
  if (estado.datos && estado.ubicacion) {
    renderClima(estado.datos, estado.ubicacion.label);
  }
});

pintarUnidad();

// ═══ Arranque: ?q= → guardada → geolocalización → Madrid ════
function iniciar() {
  if (Q_INICIAL) {
    buscarPorNombre(Q_INICIAL);
    return;
  }

  if (GUARDADA) {
    obtenerClima(GUARDADA.lat, GUARDADA.lon, GUARDADA.label);
    return;
  }

  if (navigator.geolocation) {
    mostrarEstado("Detectando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const etiqueta = await nombreDeCoords(pos.coords.latitude, pos.coords.longitude);
        obtenerClima(pos.coords.latitude, pos.coords.longitude, etiqueta);
      },
      () => {
        // Sin permiso: ciudad por defecto para que la web nunca quede vacía
        buscarPorNombre("Madrid");
      },
      { timeout: 8000 },
    );
  } else {
    buscarPorNombre("Madrid");
  }
}

iniciar();
