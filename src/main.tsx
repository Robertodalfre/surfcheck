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

// Logs simples do service worker já gerenciado pelo Vite PWA (sem reload forçado)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(reg => {
    // console.log('[PWA] serviceWorker.ready', reg?.active?.scriptURL);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
