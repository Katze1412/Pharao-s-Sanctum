/* ============================================================
   START
   ============================================================ */

function showErrorScreen(message){
  document.body.innerHTML = '' +
  '<div style="min-height:100vh;background:#0d0a06;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Rajdhani,sans-serif;">' +
    '<div style="text-align:center;max-width:480px;">' +
      '<div style="font-family:\'Noto Sans Egyptian Hieroglyphs\',sans-serif;font-size:96px;color:#c9a227;opacity:.45;margin-bottom:24px;">𓇯</div>' +
      '<h1 style="color:#e8c468;font-family:Cinzel,serif;font-size:32px;line-height:1.2;margin-bottom:14px;">Die Grabkammer<br>ist eingestürzt</h1>' +
      '<p style="color:#a8967a;font-size:18px;margin-bottom:20px;">Sie wird gerade ausgegraben</p>' +
      '<div style="background:#1c150c;border:1px solid #3a2c16;border-radius:8px;padding:12px;margin-bottom:24px;text-align:left;">' +
        '<div style="color:#f0a3ad;font-size:12px;font-family:\'JetBrains Mono\',monospace;word-break:break-all;">' + (message||'Unbekannter Fehler') + '</div>' +
      '</div>' +
      '<button onclick="location.reload()" style="background:linear-gradient(180deg,#e8c468,#c9a227);color:#1a1206;border:none;border-radius:8px;padding:12px 28px;font-family:Rajdhani,sans-serif;font-size:16px;font-weight:700;cursor:pointer;">🔄 Neu laden</button>' +
    '</div>' +
  '</div>';
}

window.addEventListener('unhandledrejection', function(e){
  console.error('Unhandled Promise Rejection:', e.reason);
  showErrorScreen(e.reason && e.reason.message ? e.reason.message : String(e.reason));
});

window.onerror = function(msg, src, line, col, err){
  console.error('Global Error:', msg, src, line, col, err);
  showErrorScreen(msg);
  return true;
};

window.addEventListener('DOMContentLoaded', function(){
  try {
    const p = init();
    if(p && typeof p.catch === 'function'){
      p.catch(function(e){ showErrorScreen(e && e.message ? e.message : String(e)); });
    }
  } catch(e) {
    showErrorScreen(e && e.message ? e.message : String(e));
  }
});
