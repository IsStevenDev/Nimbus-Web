# Weather Web

Aplicación web del clima que permite consultar la temperatura, descripción climática, humedad y velocidad del viento de cualquier ciudad del mundo en tiempo real.

## Características

- Búsqueda de clima por ciudad
- Temperatura actual en °C
- Humedad relativa
- Velocidad del viento
- Ícono dinámico según la condición climática
- Manejo de errores para ciudades no encontradas
- Diseño en modo oscuro
- Diseño responsive

## Tecnologías

- **HTML5** — estructura semántica
- **CSS3** — estilos, variables, Flexbox, animaciones
- **JavaScript (ES Modules)** — lógica y consumo de API
- **Vite** — entorno de desarrollo y bundler
- **[OpenWeatherMap API](https://openweathermap.org/api)** — datos del clima en tiempo real
- **Font Awesome** — iconografía

## Cómo ejecutar el proyecto

1. Clona el repositorio:

   ```bash
   git clone https://github.com/IsStevenDev/Weather---Web.git
   cd Weather---Web
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Crea un archivo `.env` en la raíz del proyecto con tu propia API key de [OpenWeatherMap](https://openweathermap.org/appid):

   ```
   VITE_API_KEY=tu_api_key_aqui
   ```

4. Levanta el servidor de desarrollo:

   ```bash
   npm run dev
   ```

5. Abre el enlace que aparece en la terminal (por defecto `http://localhost:5173`).

## 📂 Estructura del proyecto

```
Weather---Web/
├── images/
│   └── 404.webp
├── src/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── index.js
├── index.html
├── package.json
└── .env (no incluido — crear manualmente)
```

## Autor

**Steven Marimón**
[GitHub](https://github.com/IsStevenDev)
