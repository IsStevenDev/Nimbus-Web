import { defineConfig } from "vite";

// base: "./" → los assets se referencian con rutas relativas.
// Necesario para GitHub Pages, donde la web vive en un subdirectorio
// (https://isstevendev.github.io/Nimbus-Web/) en lugar de la raíz.
export default defineConfig({
  base: "./",
});
