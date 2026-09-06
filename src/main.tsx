import React from "react";
import { createRoot } from "react-dom/client";

// Шрифты и иконки — локальные пакеты (работают офлайн).
import "@fontsource-variable/roboto-flex";
import "material-symbols/outlined.css";
import "./styles/globals.css";

import { App } from "./App";
import { bootstrapServices } from "./services/active";

// Регистрируем адаптеры сервисов до первого рендера.
bootstrapServices();

// Без StrictMode: двойной вызов эффектов в dev ломал бы синглтоны
// аудиодвижка и подписок плеера.
const root = createRoot(document.getElementById("root")!);
root.render(
  <React.Suspense fallback={null}>
    <App />
  </React.Suspense>
);
