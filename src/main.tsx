import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// PWA debug logs (não adiciona botão; apenas loga eventos relevantes)
// beforeinstallprompt: indica que o app é potencialmente instalável
window.addEventListener('beforeinstallprompt', (e: Event) => {
  // @ts-ignore - event has prompt()
  console.log('[PWA] beforeinstallprompt disparado', {
    platforms: (e as any).platforms,
  });
});

// Log quando o SW ficar pronto/ativo controlando a página
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(reg => {
    console.log('[PWA] serviceWorker.ready', reg?.active?.scriptURL);
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] controllerchange - nova versão do SW controlando a página');
    if (reloading) return;
    reloading = true;
    // Força refresh para carregar assets novos imediatamente
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
