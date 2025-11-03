import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applySavedTheme } from "./lib/theme";

async function initApp() {
  // Inicializa MSW apenas se habilitado
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW === 'true') {
    const { startMockWorker } = await import('./mocks/browser');
    await startMockWorker();
  }

  // Aplique o tema salvo (cores personalizadas) antes de renderizar
  try {
    applySavedTheme();
  } catch (err) {
    // ignora erros de leitura de localStorage em contextos não suportados
    console.warn('Não foi possível aplicar o tema salvo:', err);
  }

  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

}

initApp().catch(console.error);
