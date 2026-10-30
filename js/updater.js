// Atualizações do app instalado. No iPhone o app volta de onde parou em vez de recarregar,
// então verificamos a versão publicada sempre que ele é aberto ou volta para a tela.
import { APP_VERSION } from './version.js';
import { toast } from './util.js';

let reg = null, shown = false;

export async function initUpdates() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  // um service worker novo assumiu: os arquivos novos valem a partir do próximo carregamento
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showBanner(); });
  reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => null);
  checkForUpdate();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
}

// Retorna a versão publicada (ou null sem internet) e mostra o aviso se ela for diferente da atual
export async function checkForUpdate() {
  reg?.update().catch(() => {});
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const { version } = await r.json();
    if (version && version !== APP_VERSION) showBanner();
    return version || null;
  } catch { return null; }
}

function showBanner() {
  if (shown) return;
  shown = true;
  const b = document.createElement('div');
  b.className = 'update-bar';
  b.innerHTML = '<span>Nova versão do Olimpo disponível</span><button class="btn sm" type="button">Atualizar</button>';
  b.querySelector('button').onclick = forceUpdate;
  document.body.appendChild(b);
}

// Apaga os arquivos guardados do app (não os dados) e recarrega tudo do servidor
export async function forceUpdate() {
  toast('Atualizando…');
  try {
    for (const k of await caches.keys()) await caches.delete(k);
    await reg?.update();
    // se já tentamos nesta sessão e ainda está desatualizado, remove o service worker para recomeçar do zero
    if (sessionStorage.getItem('forced-update')) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    sessionStorage.setItem('forced-update', '1');
  } catch { /* segue para recarregar mesmo assim */ }
  location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`);
}

export { APP_VERSION };
