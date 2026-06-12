// ── API Key desde variables de entorno de Vite ──────────────
const API_KEY = import.meta.env.VITE_API_KEY;
// ── Selección de elementos del HTML ─────────────────────────
const inputCiudad = document.querySelector(".search-box input");
const botonBuscar = document.querySelector(".search-box button");

const notFound = document.querySelector(".not-found");
const weatherBox = document.querySelector(".weather-box");
const weatherDetails = document.querySelector(".weather-details");

const weatherImg = document.querySelector(".weather-box img");
const temperature = document.querySelector(".temperature");
const description = document.querySelector(".description");

const humedad = document.querySelector(".humidity .text span");
const viento = document.querySelector(".wind .text span");

// ── Función para obtener el ícono del clima ──────────────────
// OpenWeatherMap devuelve un "id" de condición climática
// Lo usamos para mostrar el ícono oficial de la API
function getWeatherIcon(iconCode) {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

// ── Función principal: buscar clima ─────────────────────────
async function buscarClima() {
  const ciudad = inputCiudad.value.trim();

  // Validar que no esté vacío
  if (!ciudad) return;

  try {
    // Construimos la URL con la ciudad, la key, unidades métricas y español
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${ciudad}&appid=${API_KEY}&units=metric&lang=es`;

    const response = await fetch(url);
    const data = await response.json();

    // Si la ciudad no existe, la API devuelve cod 404
    if (data.cod === "404") {
      mostrarNoEncontrado();
      return;
    }

    // Si llegamos aquí, la búsqueda fue exitosa
    mostrarClima(data);
  } catch (error) {
    // Error de red o de conexión
    console.error("Error al buscar el clima:", error);
    mostrarNoEncontrado();
  }
}

// ── Mostrar los datos del clima ──────────────────────────────
function mostrarClima(data) {
  // Llenamos los elementos con la información de la API
  temperature.textContent = `${Math.round(data.main.temp)}°C`;
  description.textContent = data.weather[0].description;
  humedad.textContent = `${data.main.humidity}%`;
  viento.textContent = `${Math.round(data.wind.speed)} km/h`;
  weatherImg.src = getWeatherIcon(data.weather[0].icon);

  // Ocultamos el not-found y mostramos el clima
  notFound.classList.remove("active");
  weatherBox.classList.add("active");
  weatherDetails.classList.add("active");
}

// ── Mostrar pantalla de error ────────────────────────────────
function mostrarNoEncontrado() {
  // Ocultamos los datos y mostramos el 404
  weatherBox.classList.remove("active");
  weatherDetails.classList.remove("active");
  notFound.classList.add("active");
}

// ── Eventos ──────────────────────────────────────────────────

// Click en el botón lupa
botonBuscar.addEventListener("click", buscarClima);

// Presionar Enter en el input
inputCiudad.addEventListener("keypress", (e) => {
  if (e.key === "Enter") buscarClima();
});
