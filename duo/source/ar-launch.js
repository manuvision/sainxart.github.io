// Native viewers provide camera permission, surface finding, and placement.
// No camera access is requested by the webpage itself.
export function setupARLink() {
  const link = document.getElementById('ar-link');
  const status = document.getElementById('ar-status');
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(navigator.userAgent);
  if (!ios && !android) return;
  const nativeAsset = new URL('./ar/assets/duo-fold.usdz', document.baseURI);
  nativeAsset.hash = 'allowsContentScaling=0';
  const quickLook = document.createElement('a');
  quickLook.rel = 'ar';
  quickLook.href = nativeAsset.href;
  // Safari requires a direct image child on its AR link. Keep the displayed
  // trigger text-only, and activate this link within the same tap gesture.
  const thumbnail = document.createElement('img');
  thumbnail.src = new URL('./assets/outer-light.webp', document.baseURI).href;
  thumbnail.alt = '';
  quickLook.appendChild(thumbnail);
  quickLook.hidden = true;
  document.body.appendChild(quickLook);
  const explain = message => {
    status.textContent = message;
    status.hidden = false;
    window.dispatchEvent(new Event('resize'));
  };
  if (ios) {
    link.href = nativeAsset.href;
    link.addEventListener('click', event => {
      event.preventDefault();
      if (quickLook.relList?.supports?.('ar')) quickLook.click();
      else explain('Open this page in Safari to place the phone in your space.');
    });
  } else {
    const model = new URL('./ar/assets/duo-fold.glb', document.baseURI).href;
    const fallback = new URL('./?ar=unavailable', document.baseURI).href;
    const query = new URLSearchParams({file:model,mode:'ar_preferred',resizable:'false',title:'iPhone Duo'});
    link.href = `intent://arvr.google.com/scene-viewer/1.0?${query}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(fallback)};end;`;
    if (new URLSearchParams(location.search).get('ar') === 'unavailable') {
      explain('AR could not open on this device. You can still explore the phone here.');
    }
  }
  link.addEventListener('click',()=>window.dispatchEvent(new Event('duo:ar-launch')));
  link.hidden = false;
}
