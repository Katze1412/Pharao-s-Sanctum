/* ============================================================
   BINDER — digitale Binder-Ansicht für Ordner (Lagerorte)
   Pro Ordner: Modus (box = Liste | binder = Doppelseite),
   Spalten/Zeilen, Seitenzahl, Größe und Slot-Belegung.
   Gespeichert in settings.folderBinder (Supabase: settings.folder_binder).
   Slot-Schlüssel = fortlaufender Index über alle Seiten
   (Seite * Slots-pro-Seite + Position) -> Layout-Änderungen sind verlustfrei.
   ============================================================ */
let binderPageIdx = {};        // pro Ordner: aktuell linke Seite (0-basiert)
let binderSettingsOpen = false;
let binderFlipping = false;
let binderSaveTimer = null;
let binderImgCache = null;
let binderImgQueue = [];
let binderImgMiss = {};      // nur für diese Sitzung: Karten ohne Treffer (wird nicht gespeichert)
let binderImgBusy = false;

const BINDER_DEFAULTS = { mode: 'binder', cols: 3, rows: 3, spread: 0, maxPages: 10, size: 90 };

/* ---------- Konfiguration ---------- */
function getBinderCfg(folder){
  const stored = (settings.folderBinder && settings.folderBinder[folder]) || {};
  const cfg = Object.assign({}, BINDER_DEFAULTS, stored);
  cfg.slots = stored.slots || {};
  cfg.art = stored.art || {};   // gewähltes Artwork pro Karte: { kartenId: bildId }
  cfg.mode = (stored.mode === 'list') ? 'list' : 'binder';   // frühere Werte (z. B. 'box') -> Binder
  if(cfg.spread !== 1 && cfg.spread !== 2){
    cfg.spread = (window.innerWidth >= 640) ? 2 : 1;
  }
  return cfg;
}

function setBinderCfg(folder, patch){
  if(!settings.folderBinder) settings.folderBinder = {};
  const cur = settings.folderBinder[folder] || {};
  settings.folderBinder[folder] = Object.assign({}, cur, patch);
  persistBinder();
}

function persistBinder(){
  clearTimeout(binderSaveTimer);
  binderSaveTimer = setTimeout(async function(){
    const ok = await DataLayer.saveBinder(settings.folderBinder || {});
    if(!ok) showToast('Binder nicht gespeichert – Spalte folder_binder in Supabase anlegen (siehe schema.sql)');
  }, 400);
}

/* ---------- Hilfsfunktionen ---------- */
function binderPerPage(cfg){ return cfg.cols * cfg.rows; }

function binderMaxUsedPage(cfg){
  const per = binderPerPage(cfg);
  let m = -1;
  Object.keys(cfg.slots).forEach(function(k){
    const p = Math.floor(parseInt(k, 10) / per);
    if(p > m) m = p;
  });
  return m;
}

function binderTotalPages(cfg){
  return Math.max(cfg.maxPages, binderMaxUsedPage(cfg) + 1);
}

// Ein Slot enthält eine Liste von Karten-IDs (vorderste zuerst). Ältere Daten: einzelne ID als Text.
function binderSlotIds(cfg, idx){
  const v = cfg.slots[idx];
  if(!v) return [];
  return Array.isArray(v) ? v : [v];
}

function binderSetSlot(folder, idx, ids){
  const cur = getBinderCfg(folder);
  const slots = Object.assign({}, cur.slots);
  if(ids.length === 0) delete slots[idx]; else slots[idx] = ids;
  setBinderCfg(folder, { slots: slots });
}

function binderPlacedCount(cfg, cardId){
  let n = 0;
  Object.keys(cfg.slots).forEach(function(k){
    binderSlotIds(cfg, k).forEach(function(id){ if(id === cardId) n++; });
  });
  return n;
}

function binderFolderCards(folder){
  return cards.filter(function(c){ return c.box === folder; });
}

function binderById(folderCards){
  const m = {};
  folderCards.forEach(function(c){ m[c.id] = c; });
  return m;
}

function binderCurrentPage(folder, cfg, total){
  let cur = binderPageIdx[folder] || 0;
  if(cfg.spread === 2) cur -= cur % 2;
  if(cur > total - 1) cur = Math.max(0, total - 1);
  if(cfg.spread === 2) cur -= cur % 2;
  return Math.max(0, cur);
}

function binderUnplacedCount(cfg, folderCards){
  let free = 0;
  folderCards.forEach(function(c){
    const q = parseInt(c.quantity, 10) || 1;
    free += Math.max(0, q - binderPlacedCount(cfg, c.id));
  });
  return free;
}

/* ---------- Rendering ---------- */
function renderBinderModeToggle(folder, cfg){
  return '' +
  '<div class="binder-toolbar">' +
    '<div class="grouptoggle">' +
      '<button type="button" data-binder-mode="binder" class="' + (cfg.mode === 'binder' ? 'active' : '') + '">📖 Binder</button>' +
      '<button type="button" data-binder-mode="list" class="' + (cfg.mode === 'list' ? 'active' : '') + '">☰ Liste</button>' +
    '</div>' +
    (cfg.mode === 'binder'
      ? '<button type="button" id="btn-binder-settings" class="btn btn-secondary" style="width:auto;padding:5px 10px;font-size:12px;">⚙ Binder-Einstellungen</button>'
      : '') +
  '</div>';
}

function renderBinderSettings(cfg){
  function stepper(label, key, val, min, max, step){
    return '<div class="binder-set-row"><span>' + label + '</span>' +
      '<div class="binder-stepper">' +
        '<button type="button" data-bset="' + key + '" data-bdelta="' + (-step) + '" data-bmin="' + min + '" data-bmax="' + max + '">−</button>' +
        '<b>' + val + '</b>' +
        '<button type="button" data-bset="' + key + '" data-bdelta="' + step + '" data-bmin="' + min + '" data-bmax="' + max + '">+</button>' +
      '</div></div>';
  }
  const hasCards = Object.keys(cfg.slots).length > 0;
  return '' +
  '<div class="binder-settings">' +
    stepper('Spalten', 'cols', cfg.cols, 1, 6, 1) +
    stepper('Zeilen', 'rows', cfg.rows, 1, 6, 1) +
    '<div class="binder-set-row"><span>Angezeigte Seiten</span>' +
      '<div class="grouptoggle">' +
        '<button type="button" data-bspread="1" class="' + (cfg.spread === 1 ? 'active' : '') + '">1</button>' +
        '<button type="button" data-bspread="2" class="' + (cfg.spread === 2 ? 'active' : '') + '">2</button>' +
      '</div></div>' +
    stepper('Max. Seiten', 'maxPages', cfg.maxPages, 1, 60, 1) +
    stepper('Größe (px)', 'size', cfg.size, 50, 140, 10) +
    (hasCards ? '<div class="hint" style="margin-top:8px;">Ändern von Spalten oder Zeilen verschiebt bereits platzierte Karten fortlaufend auf die neuen Plätze.</div>' : '') +
  '</div>';
}

function renderBinderSlot(list, idx, cfg){
  if(!list || list.length === 0){
    return '<button type="button" class="binder-slot empty" data-bslot="' + idx + '" aria-label="Leerer Slot"><span>+</span></button>';
  }
  const c = list[0];
  const stacked = list.length > 1;
  const art = (cfg && cfg.art && cfg.art[c.id]) ? cfg.art[c.id] : '';
  const names = list.map(function(x){ return x.name; }).join(' · ');
  return '<button type="button" class="binder-slot filled' + (stacked ? ' stacked' : '') + '" data-bslot="' + idx + '" data-bname="' + escapeAttr(c.name) + '" data-bsc="' + escapeAttr(c.setCode || '') + '" data-bcn="' + escapeAttr(c.cardNumber || '') + '"' + (art ? ' data-bart="' + escapeAttr(art) + '"' : '') + ' title="' + escapeAttr(names) + '">' +
    '<span class="binder-slot-name">' + escapeHtml(c.name) + '</span>' +
    (stacked ? '<span class="binder-slot-count">×' + list.length + '</span>' : '') +
  '</button>';
}

function renderBinderPage(cfg, p, total, byId, side){
  if(p < 0 || p >= total){
    return '<div class="binder-page binder-page-void ' + side + '"></div>';
  }
  const per = binderPerPage(cfg);
  let slotsHtml = '';
  for(let i = 0; i < per; i++){
    const idx = p * per + i;
    const list = binderSlotIds(cfg, idx).map(function(id){ return byId[id]; }).filter(Boolean);
    slotsHtml += renderBinderSlot(list, idx, cfg);
  }
  return '<div class="binder-page ' + side + '" style="grid-template-columns:repeat(' + cfg.cols + ',minmax(0,1fr));">' +
    slotsHtml +
    '<div class="binder-pageno">' + (p + 1) + '</div>' +
  '</div>';
}

function renderBinderSpreadHtml(cfg, cur, total, byId){
  if(cfg.spread === 2){
    return '' +
      renderBinderPage(cfg, cur, total, byId, 'left') +
      '<div class="binder-spine"><i class="binder-ring" style="top:16%"></i><i class="binder-ring" style="top:50%"></i><i class="binder-ring" style="top:84%"></i></div>' +
      renderBinderPage(cfg, cur + 1, total, byId, 'right');
  }
  return renderBinderPage(cfg, cur, total, byId, 'single');
}

function binderWidthPx(cfg){
  const pageW = cfg.cols * (cfg.size + 5) + 21;
  return cfg.spread === 2 ? pageW * 2 + 14 + 20 : pageW + 20;
}

function renderBinderView(folder, folderCards, cfg){
  const total = binderTotalPages(cfg);
  const cur = binderCurrentPage(folder, cfg, total);
  const byId = binderById(folderCards);
  const unplaced = binderUnplacedCount(cfg, folderCards);
  const last = cfg.spread === 2 ? Math.min(cur + 2, total) : cur + 1;
  const label = (cfg.spread === 2 && cur + 2 <= total) ? ('Seite ' + (cur + 1) + '–' + (cur + 2)) : ('Seite ' + (cur + 1));
  const atStart = cur <= 0;
  const atEnd = last >= total;

  return '' +
  (binderSettingsOpen ? renderBinderSettings(cfg) : '') +
  '<div class="binder-wrap">' +
    '<div class="binder-spread" id="binder-root" style="width:min(100%,' + binderWidthPx(cfg) + 'px);">' +
      '<div class="binder-pages" id="binder-pages">' + renderBinderSpreadHtml(cfg, cur, total, byId) + '</div>' +
    '</div>' +
    '<div class="binder-nav">' +
      '<button type="button" id="binder-prev" class="binder-navbtn" ' + (atStart ? 'disabled' : '') + ' aria-label="Zurück">‹</button>' +
      '<div class="binder-pagelabel">' + label + ' / ' + total + '</div>' +
      '<button type="button" id="binder-next" class="binder-navbtn" ' + (atEnd ? 'disabled' : '') + ' aria-label="Weiter">›</button>' +
    '</div>' +
    '<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:6px;">' +
      '<button type="button" id="binder-last" class="btn btn-secondary" style="width:auto;padding:5px 12px;font-size:12px;">📖 Zur letzten belegten Seite</button>' +
    '</div>' +
    '<div class="hint" style="text-align:center;margin-top:8px;">' +
      (unplaced > 0 ? unplaced + ' Karte' + (unplaced === 1 ? '' : 'n') + ' in diesem Ordner noch nicht im Binder' : 'Alle Karten dieses Ordners liegen im Binder') +
    '</div>' +
  '</div>';
}

/* ---------- Listenansicht (gleiche Daten wie der Binder) ---------- */
function renderBinderListView(folder, folderCards, cfg){
  if(folderCards.length === 0){
    return '<div class="empty-state"><p>Dieser Ordner ist leer.</p></div>';
  }
  const per = binderPerPage(cfg);
  const posByCard = {};
  const nameById = {};
  folderCards.forEach(function(c){ nameById[c.id] = c.name; });
  Object.keys(cfg.slots).map(function(k){ return parseInt(k, 10); }).sort(function(a, b){ return a - b; }).forEach(function(idx){
    const ids = binderSlotIds(cfg, idx).filter(function(id){ return nameById[id] !== undefined; });
    const seen = {};
    ids.forEach(function(id){
      if(seen[id]) return;
      seen[id] = true;
      const same = ids.filter(function(x){ return x === id; }).length;
      const others = [];
      ids.forEach(function(x){ if(x !== id && others.indexOf(nameById[x]) === -1) others.push(nameById[x]); });
      if(!posByCard[id]) posByCard[id] = [];
      posByCard[id].push('S. ' + (Math.floor(idx / per) + 1) + ' · Platz ' + ((idx % per) + 1) +
        (same > 1 ? ' ×' + same : '') + (others.length ? ' · mit ' + others.join(', ') : ''));
    });
  });

  const placed = [];
  const unplaced = [];
  folderCards.forEach(function(c){
    const q = parseInt(c.quantity, 10) || 1;
    const free = Math.max(0, q - binderPlacedCount(cfg, c.id));
    if(posByCard[c.id]) placed.push({ c: c, free: free });
    else unplaced.push({ c: c, free: free });
  });
  // platzierte Karten nach erstem Platz, übrige nach Name
  placed.sort(function(a, b){ return cfgFirstIdx(cfg, a.c.id) - cfgFirstIdx(cfg, b.c.id); });
  unplaced.sort(function(a, b){ return a.c.name.localeCompare(b.c.name, 'de'); });

  function row(item){
    const c = item.c;
    const pos = posByCard[c.id] ? posByCard[c.id].join('  |  ') : '';
    const meta = [c.setCode, c.rarity, c.condition].filter(Boolean).join(' · ');
    return '<div class="card-row" data-edit="' + escapeAttr(c.id) + '">' +
      '<div class="info" style="flex:1;min-width:0;">' +
        '<div style="font-weight:600;word-break:break-word;">' + escapeHtml(c.name) + '</div>' +
        '<div style="font-size:12px;color:var(--text-muted);">' + escapeHtml(meta) + '</div>' +
        (pos ? '<div class="mono" style="font-size:11.5px;color:var(--gold-bright);margin-top:2px;">' + escapeHtml(pos) + '</div>' : '') +
      '</div>' +
      '<div class="qty">×' + (parseInt(c.quantity, 10) || 1) + '</div>' +
      (item.free > 0 ? '<div class="qty" style="color:var(--text-muted);">' + (pos ? item.free + ' frei' : 'nicht im Binder') + '</div>' : '') +
    '</div>';
  }

  return '<div id="folder-card-list" style="padding-top:8px;">' +
    placed.map(row).join('') +
    (unplaced.length ? '<div class="groupbar"><span class="label">Noch nicht im Binder (' + unplaced.length + ')</span></div>' + unplaced.map(row).join('') : '') +
  '</div>';
}

function cfgFirstIdx(cfg, cardId){
  let min = Infinity;
  Object.keys(cfg.slots).forEach(function(k){ if(binderSlotIds(cfg, k).indexOf(cardId) !== -1){ min = Math.min(min, parseInt(k, 10)); } });
  return min;
}

/* ---------- Blättern (mit Animation) ---------- */
function binderGo(folder, target){
  if(binderFlipping) return;
  const cfg = getBinderCfg(folder);
  const total = binderTotalPages(cfg);
  const cur = binderCurrentPage(folder, cfg, total);
  target = Math.max(0, Math.min(target, total - 1));
  if(cfg.spread === 2) target -= target % 2;
  if(target === cur) return;

  const pagesEl = document.getElementById('binder-pages');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!pagesEl || reduce){
    binderPageIdx[folder] = target;
    render();
    return;
  }

  const byId = binderById(binderFolderCards(folder));
  const fwd = target > cur;
  let html;
  let overlay;

  if(cfg.spread === 2){
    const spine = '<div class="binder-spine"><i class="binder-ring" style="top:16%"></i><i class="binder-ring" style="top:50%"></i><i class="binder-ring" style="top:84%"></i></div>';
    if(fwd){
      // unten: links bleibt, rechts = Zielseite rechts; oben klappt die rechte Seite nach links
      html = renderBinderPage(cfg, cur, total, byId, 'left') + spine + renderBinderPage(cfg, target + 1, total, byId, 'right');
      overlay = '<div class="binder-flip fwd double" id="binder-flip">' +
        '<div class="binder-flip-face front">' + renderBinderPage(cfg, cur + 1, total, byId, 'right') + '</div>' +
        '<div class="binder-flip-face back">' + renderBinderPage(cfg, target, total, byId, 'left') + '</div>' +
      '</div>';
    } else {
      html = renderBinderPage(cfg, target, total, byId, 'left') + spine + renderBinderPage(cfg, cur + 1, total, byId, 'right');
      overlay = '<div class="binder-flip bwd double" id="binder-flip">' +
        '<div class="binder-flip-face front">' + renderBinderPage(cfg, cur, total, byId, 'left') + '</div>' +
        '<div class="binder-flip-face back">' + renderBinderPage(cfg, target + 1, total, byId, 'right') + '</div>' +
      '</div>';
    }
  } else {
    html = renderBinderPage(cfg, target, total, byId, 'single');
    overlay = '<div class="binder-flip ' + (fwd ? 'fwd' : 'bwd') + ' single" id="binder-flip">' +
      '<div class="binder-flip-face front">' + renderBinderPage(cfg, cur, total, byId, 'single') + '</div>' +
    '</div>';
  }

  binderFlipping = true;
  pagesEl.innerHTML = html + overlay;
  binderApplyImages();
  const flipEl = document.getElementById('binder-flip');
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ if(flipEl) flipEl.classList.add('go'); });
  });
  setTimeout(function(){
    binderFlipping = false;
    binderPageIdx[folder] = target;
    render();
  }, 760);
}

/* ---------- Karten-Bilder (YGOPRODeck, lokal gecacht) ---------- */
function binderImgGet(){
  if(!binderImgCache){
    try { binderImgCache = JSON.parse(localStorage.getItem('ps_binder_img_v2') || '{}'); }
    catch(e){ binderImgCache = {}; }
  }
  return binderImgCache;
}
function binderImgSave(){
  try { localStorage.setItem('ps_binder_img_v2', JSON.stringify(binderImgCache)); } catch(e){}
}
function binderImgUrl(id){
  return 'https://images.ygoprodeck.com/images/cards_small/' + id + '.jpg';
}
/* ---- Lokaler Bildspeicher (IndexedDB, nur dieses Gerät) ----
   Jedes Bild wird einmal von YGOPRODeck geladen und danach aus dem Gerät angezeigt.
   Erlaubt der Bildserver das Speichern nicht (CORS), wird das Bild wie bisher direkt eingebunden. */
let binderDbPromise = null;
let binderObjUrls = {};
let binderCorsOk = null;      // null = unbekannt, true/false = Ergebnis dieser Sitzung
let binderNetChain = Promise.resolve();

function binderDb(){
  if(!binderDbPromise){
    binderDbPromise = new Promise(function(resolve){
      try {
        const req = indexedDB.open('ps_binder_images', 1);
        req.onupgradeneeded = function(){ req.result.createObjectStore('img'); };
        req.onsuccess = function(){ resolve(req.result); };
        req.onerror = function(){ resolve(null); };
      } catch(e){ resolve(null); }
    });
  }
  return binderDbPromise;
}
function binderIdbGet(id){
  return binderDb().then(function(db){
    if(!db) return null;
    return new Promise(function(resolve){
      try {
        const r = db.transaction('img').objectStore('img').get(String(id));
        r.onsuccess = function(){ resolve(r.result || null); };
        r.onerror = function(){ resolve(null); };
      } catch(e){ resolve(null); }
    });
  });
}
function binderIdbPut(id, blob){
  return binderDb().then(function(db){
    if(!db) return false;
    return new Promise(function(resolve){
      try {
        const tx = db.transaction('img', 'readwrite');
        tx.objectStore('img').put(blob, String(id));
        tx.oncomplete = function(){ resolve(true); };
        tx.onerror = function(){ resolve(false); };
      } catch(e){ resolve(false); }
    });
  });
}
// Netzwerkzugriffe nacheinander mit kleiner Pause (YGOPRODeck: max. 20 Anfragen pro Sekunde)
function binderSerial(fn){
  const p = binderNetChain.then(fn, fn);
  binderNetChain = p.then(function(){ return new Promise(function(r){ setTimeout(r, 80); }); },
                          function(){ return new Promise(function(r){ setTimeout(r, 80); }); });
  return p;
}
async function binderImageSrc(id){
  if(binderObjUrls[id]) return binderObjUrls[id];
  const stored = await binderIdbGet(id);
  if(stored){
    binderObjUrls[id] = URL.createObjectURL(stored);
    return binderObjUrls[id];
  }
  if(binderCorsOk !== false){
    const blob = await binderSerial(async function(){
      try {
        const res = await fetch(binderImgUrl(id));
        if(!res.ok) return null;
        const b = await res.blob();
        binderCorsOk = true;
        return (b && b.size > 0) ? b : null;
      } catch(e){
        binderCorsOk = false;   // Server erlaubt kein Speichern -> bis zum Neuladen nicht mehr versuchen
        return null;
      }
    });
    if(blob){
      await binderIdbPut(id, blob);
      binderObjUrls[id] = URL.createObjectURL(blob);
      return binderObjUrls[id];
    }
  }
  return binderImgUrl(id);   // Notlösung: direkt von YGOPRODeck einbinden
}
function binderShowImage(el, imageId){
  binderImageSrc(imageId).then(function(src){
    if(!el.isConnected) return;
    el.style.backgroundImage = 'url("' + src + '")';
    el.classList.add('has-img');
  });
}

function binderApplyImages(){
  const cache = binderImgGet();
  document.querySelectorAll('.binder-slot.filled[data-bname]').forEach(function(el){
    const art = el.getAttribute('data-bart');
    if(art){ binderShowImage(el, art); return; }          // gewähltes Artwork
    const name = el.getAttribute('data-bname');
    const v = cache[name];
    if(v){
      binderShowImage(el, v);
    } else if(!binderImgMiss[name]){
      const known = binderImgQueue.some(function(q){ return q.name === name; });
      if(!known){
        binderImgQueue.push({ name: name, setCode: el.getAttribute('data-bsc') || '', cardNumber: el.getAttribute('data-bcn') || '' });
      }
    }
  });
  binderRunQueue();
}
async function binderRunQueue(){
  if(binderImgBusy || binderImgQueue.length === 0) return;
  binderImgBusy = true;
  while(binderImgQueue.length){
    const job = binderImgQueue.shift();
    const name = job.name;
    let id = 0;
    try {
      const c = await fetchYgoCard(name, { setCode: job.setCode, cardNumber: job.cardNumber });
      if(c){
        id = (c.card_images && c.card_images[0] && c.card_images[0].id) || c.id || 0;
      }
    } catch(e){
      continue; // Netzwerkfehler: nicht merken, beim nächsten Rendern erneut versuchen
    }
    if(id){
      binderImgGet()[name] = id;
      binderImgSave();
    } else {
      binderImgMiss[name] = true;   // nur bis zum Neuladen merken, damit spätere Fixes greifen
    }
    document.querySelectorAll('.binder-slot.filled[data-bname]').forEach(function(el){
      if(el.getAttribute('data-bname') === name && id && !el.getAttribute('data-bart')){
        binderShowImage(el, id);
      }
    });
    await new Promise(function(r){ setTimeout(r, 120); });
  }
  binderImgBusy = false;
}

/* ---------- Bild-Diagnose (zeigt, an welchem Schritt die Suche scheitert) ---------- */
async function binderDiagnose(c){
  const lines = [];
  const base = 'https://db.ygoprodeck.com/api/v7/';
  const name = c.name.trim();

  async function probe(label, url, pick){
    try{
      const res = await fetch(url);
      const raw = await res.text();
      let data = null;
      try{ data = JSON.parse(raw); } catch(e){}
      const info = pick(data);
      lines.push((info.ok ? '✓ ' : '✗ ') + label + ': ' + info.text + ' (HTTP ' + res.status + ')');
      return info;
    } catch(e){
      lines.push('✗ ' + label + ': Anfrage blockiert oder kein Netz (' + ((e && e.message) || 'Fehler') + ')');
      return { ok: false };
    }
  }
  function cardPick(d){
    if(d && d.data && d.data.length){
      const x = d.data[0];
      return { ok: true, text: 'gefunden – ' + x.name + ', ID ' + x.id, id: x.id };
    }
    return { ok: false, text: 'nichts gefunden' };
  }

  let id = 0;
  let r = await probe('Name (Deutsch)', base + 'cardinfo.php?name=' + encodeURIComponent(name) + '&language=de', cardPick);
  if(r.ok) id = r.id;
  if(!id){
    r = await probe('Name (Englisch)', base + 'cardinfo.php?name=' + encodeURIComponent(name), cardPick);
    if(r.ok) id = r.id;
  }
  if(!id){
    const en = ygoEnglishSetCode({ setCode: c.setCode, cardNumber: c.cardNumber });
    if(!en){
      lines.push('✗ Set-Code: Set-Kürzel oder Kartennummer fehlt bzw. hat ein ungewohntes Format (erwartet z. B. PHHY + DE043)');
    } else {
      r = await probe('Set-Code ' + en, base + 'cardsetsinfo.php?setcode=' + encodeURIComponent(en), function(d){
        if(d && d.id) return { ok: true, text: 'ID ' + d.id + ' (' + d.name + ')', id: d.id };
        return { ok: false, text: 'kein Eintrag' };
      });
      if(r.ok) id = r.id;
    }
  }
  if(!id){
    lines.push('→ Kein Treffer, die Karte bekommt kein Bild.');
    return { lines: lines, id: 0 };
  }
  const imgOk = await new Promise(function(resolve){
    const im = new Image();
    im.onload = function(){ resolve(true); };
    im.onerror = function(){ resolve(false); };
    im.src = binderImgUrl(id);
  });
  lines.push((imgOk ? '✓ ' : '✗ ') + 'Bilddatei ' + id + '.jpg: ' + (imgOk ? 'lädt' : 'lädt nicht'));
  let canStore = false;
  if(imgOk){
    try {
      const r = await fetch(binderImgUrl(id));
      const b = await r.blob();
      canStore = r.ok && b.size > 0;
    } catch(e){}
    lines.push((canStore ? '✓ ' : '✗ ') + 'Lokal speichern: ' + (canStore ? 'möglich' : 'vom Bildserver nicht erlaubt, Bilder werden direkt eingebunden'));
  }
  return { lines: lines, id: imgOk ? id : 0 };
}

/* ---------- Slot-Dialoge ---------- */
function closeBinderModal(){
  const root = document.getElementById('settingsmodal-root');
  if(root) root.innerHTML = '';
}

function openBinderPicker(folder, slotIdx){
  const root = document.getElementById('settingsmodal-root');
  if(!root) return;
  const cfg = getBinderCfg(folder);
  const existing = binderSlotIds(cfg, slotIdx);
  const candidates = binderFolderCards(folder).map(function(c){
    return { c: c, free: (parseInt(c.quantity, 10) || 1) - binderPlacedCount(cfg, c.id) };
  }).filter(function(x){ return x.free > 0; }).sort(function(a, b){ return a.c.name.localeCompare(b.c.name, 'de'); });
  const picked = [];   // Reihenfolge der Auswahl = Reihenfolge im Slot (zuerst gewählt liegt vorne)

  function countOf(id){ return picked.filter(function(x){ return x === id; }).length; }

  root.innerHTML = '' +
  '<div class="modal-overlay" id="binder-modal-overlay" style="z-index:70;">' +
    '<div class="modal" style="max-width:460px;max-height:85vh;display:flex;flex-direction:column;">' +
      '<div class="modal-head"><h2>' + (existing.length ? 'Karten hinter die Slot-Karte legen' : 'Karten in Slot legen') + '</h2><button class="modal-close" id="binder-modal-close" type="button">×</button></div>' +
      '<div class="searchbar" style="margin-top:0;margin-bottom:10px;">' +
        '<input id="binder-pick-search" type="text" placeholder="Kartenname suchen…" autocomplete="off">' +
      '</div>' +
      '<div id="binder-pick-list" style="overflow-y:auto;flex:1;"></div>' +
      '<button class="btn btn-primary" id="binder-pick-confirm" type="button" style="margin-top:10px;" disabled>Karten auswählen</button>' +
      '<div class="hint" style="margin-top:8px;">Tippe auf Karten, um sie in den Slot zu legen. Mit + und − wählst du mehrere Exemplare. Die zuerst gewählte Karte liegt vorne. Es erscheinen nur Karten aus diesem Ordner mit freien Exemplaren.</div>' +
    '</div>' +
  '</div>';

  function updateFooter(){
    const btn = document.getElementById('binder-pick-confirm');
    btn.disabled = picked.length === 0;
    btn.textContent = picked.length ? ('In Slot legen (' + picked.length + ')') : 'Karten auswählen';
  }

  function fillList(){
    const q = (document.getElementById('binder-pick-search').value || '').toLowerCase().trim();
    const list = candidates.filter(function(x){ return !q || x.c.name.toLowerCase().indexOf(q) !== -1; });
    const el = document.getElementById('binder-pick-list');
    const scroll = el.scrollTop;
    if(list.length === 0){
      el.innerHTML = '<div class="empty-state"><p>' + (candidates.length === 0 ? 'Keine freien Karten in diesem Ordner.' : 'Keine Treffer.') + '</p></div>';
      return;
    }
    el.innerHTML = list.slice(0, 60).map(function(x){
      const c = x.c;
      const n = countOf(c.id);
      return '<div class="card-row" data-bpick="' + escapeAttr(c.id) + '" style="cursor:pointer;' + (n ? 'border-color:var(--gold);' : '') + '">' +
        '<div class="info" style="flex:1;min-width:0;">' +
          '<div style="font-weight:600;word-break:break-word;">' + escapeHtml(c.name) + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);">' + escapeHtml([c.setCode, c.rarity].filter(Boolean).join(' · ')) + ' · frei ×' + x.free + '</div>' +
        '</div>' +
        '<div class="binder-stepper">' +
          '<button type="button" data-bminus="' + escapeAttr(c.id) + '">−</button>' +
          '<b>' + n + '</b>' +
          '<button type="button" data-bplus="' + escapeAttr(c.id) + '">+</button>' +
        '</div>' +
      '</div>';
    }).join('');
    el.scrollTop = scroll;

    function add(id){
      const item = candidates.filter(function(x){ return x.c.id === id; })[0];
      if(item && countOf(id) < item.free){ picked.push(id); fillList(); updateFooter(); }
    }
    function remove(id){
      const i = picked.lastIndexOf(id);
      if(i !== -1){ picked.splice(i, 1); fillList(); updateFooter(); }
    }
    el.querySelectorAll('[data-bpick]').forEach(function(row){
      row.onclick = function(){ add(row.getAttribute('data-bpick')); };
    });
    el.querySelectorAll('[data-bplus]').forEach(function(btn){
      btn.onclick = function(e){ e.stopPropagation(); add(btn.getAttribute('data-bplus')); };
    });
    el.querySelectorAll('[data-bminus]').forEach(function(btn){
      btn.onclick = function(e){ e.stopPropagation(); remove(btn.getAttribute('data-bminus')); };
    });
  }

  document.getElementById('binder-modal-close').onclick = closeBinderModal;
  document.getElementById('binder-modal-overlay').onclick = function(e){ if(e.target.id === 'binder-modal-overlay') closeBinderModal(); };
  document.getElementById('binder-pick-search').oninput = fillList;
  document.getElementById('binder-pick-confirm').onclick = function(){
    if(picked.length === 0) return;
    binderSetSlot(folder, slotIdx, existing.concat(picked));
    closeBinderModal();
    render();
  };
  fillList();
  updateFooter();
  document.getElementById('binder-pick-search').focus();
}

function openBinderSlotActions(folder, slotIdx){
  const root = document.getElementById('settingsmodal-root');
  if(!root) return;
  const cfg = getBinderCfg(folder);
  const ids = binderSlotIds(cfg, slotIdx);
  const entries = [];
  ids.forEach(function(id, i){
    const c = cards.find(function(x){ return x.id === id; });
    if(c) entries.push({ c: c, i: i });
  });
  if(entries.length === 0) return;
  const per = binderPerPage(cfg);
  const page = Math.floor(slotIdx / per) + 1;
  const pos = (slotIdx % per) + 1;
  const title = entries.length === 1 ? entries[0].c.name : ('Slot mit ' + entries.length + ' Karten');

  root.innerHTML = '' +
  '<div class="modal-overlay" id="binder-modal-overlay" style="z-index:70;">' +
    '<div class="modal" style="max-width:420px;max-height:85vh;display:flex;flex-direction:column;">' +
      '<div class="modal-head"><h2>' + escapeHtml(title) + '</h2><button class="modal-close" id="binder-modal-close" type="button">×</button></div>' +
      '<div class="hint" style="margin-bottom:10px;">Seite ' + page + ', Platz ' + pos + (entries.length > 1 ? ' · vorderste Karte zuerst' : '') + '</div>' +
      '<div style="overflow-y:auto;flex:1;">' +
        entries.map(function(en, n){
          const c = en.c;
          const meta = [c.setCode, c.rarity, c.condition].filter(Boolean).join(' · ');
          return '<div class="card-row" style="align-items:center;">' +
            '<div class="info" style="flex:1;min-width:0;">' +
              '<div style="font-weight:600;word-break:break-word;">' + (n + 1) + '. ' + escapeHtml(c.name) + '</div>' +
              (meta ? '<div style="font-size:12px;color:var(--text-muted);">' + escapeHtml(meta) + '</div>' : '') +
            '</div>' +
            '<div style="display:flex;gap:6px;">' +
              '<button type="button" class="btn btn-secondary" data-bartbtn="' + escapeAttr(c.id) + '" title="Artwork wählen" style="width:auto;padding:5px 10px;font-size:12px;">🖼</button>' +
              '<button type="button" class="btn btn-secondary" data-bdiag="' + escapeAttr(c.id) + '" title="Bildsuche prüfen" style="width:auto;padding:5px 10px;font-size:12px;">🔍</button>' +
              '<button type="button" class="btn btn-secondary" data-bedit="' + escapeAttr(c.id) + '" style="width:auto;padding:5px 10px;font-size:12px;">✎</button>' +
              '<button type="button" class="btn btn-danger" data-brem="' + en.i + '" style="width:auto;padding:5px 10px;font-size:12px;">Entfernen</button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div id="binder-diag" class="mono" style="display:none;margin-top:10px;padding:8px 10px;font-size:11.5px;line-height:1.5;background:var(--panel);border:1px solid var(--border);border-radius:8px;word-break:break-word;"></div>' +
      '<button class="btn btn-secondary" id="binder-act-add" type="button" style="margin-top:10px;">+ Karte dahinter legen</button>' +
    '</div>' +
  '</div>';

  document.getElementById('binder-modal-close').onclick = closeBinderModal;
  document.getElementById('binder-modal-overlay').onclick = function(e){ if(e.target.id === 'binder-modal-overlay') closeBinderModal(); };
  document.querySelectorAll('[data-bedit]').forEach(function(btn){
    btn.onclick = function(){ const id = btn.getAttribute('data-bedit'); closeBinderModal(); openModalForEdit(id); };
  });
  document.querySelectorAll('[data-bartbtn]').forEach(function(btn){
    btn.onclick = function(){ const id = btn.getAttribute('data-bartbtn'); openBinderArtworkPicker(folder, id); };
  });
  document.querySelectorAll('[data-bdiag]').forEach(function(btn){
    btn.onclick = async function(){
      const c = cards.find(function(x){ return x.id === btn.getAttribute('data-bdiag'); });
      const box = document.getElementById('binder-diag');
      if(!c || !box) return;
      box.style.display = 'block';
      box.textContent = 'Prüfe …';
      const res = await binderDiagnose(c);
      box.innerHTML = res.lines.map(escapeHtml).join('<br>') +
        (res.id ? '<br><button type="button" class="btn btn-primary" id="binder-diag-apply" style="margin-top:8px;padding:6px 12px;font-size:12px;">Bild übernehmen</button>' : '');
      const apply = document.getElementById('binder-diag-apply');
      if(apply){
        apply.onclick = function(){
          binderImgGet()[c.name] = res.id;
          binderImgSave();
          delete binderImgMiss[c.name];
          closeBinderModal();
          render();
        };
      }
    };
  });
  document.querySelectorAll('[data-brem]').forEach(function(btn){
    btn.onclick = function(){
      const i = parseInt(btn.getAttribute('data-brem'), 10);
      const cur = binderSlotIds(getBinderCfg(folder), slotIdx).slice();
      cur.splice(i, 1);
      binderSetSlot(folder, slotIdx, cur);
      closeBinderModal();
      render();
    };
  });
  document.getElementById('binder-act-add').onclick = function(){ closeBinderModal(); openBinderPicker(folder, slotIdx); };
}

/* ---------- Artwork wählen ---------- */
async function openBinderArtworkPicker(folder, cardId){
  const root = document.getElementById('settingsmodal-root');
  const c = cards.find(function(x){ return x.id === cardId; });
  if(!root || !c) return;
  root.innerHTML = '' +
  '<div class="modal-overlay" id="binder-modal-overlay" style="z-index:70;">' +
    '<div class="modal" style="max-width:460px;max-height:85vh;display:flex;flex-direction:column;">' +
      '<div class="modal-head"><h2>Artwork wählen</h2><button class="modal-close" id="binder-modal-close" type="button">×</button></div>' +
      '<div class="hint" style="margin-bottom:10px;">' + escapeHtml(c.name) + '</div>' +
      '<div id="binder-art-body" style="overflow-y:auto;flex:1;"><div class="hint">Lade Artworks …</div></div>' +
    '</div>' +
  '</div>';
  document.getElementById('binder-modal-close').onclick = closeBinderModal;
  document.getElementById('binder-modal-overlay').onclick = function(e){ if(e.target.id === 'binder-modal-overlay') closeBinderModal(); };

  let card = null;
  try { card = await fetchYgoCard(c.name, { setCode: c.setCode, cardNumber: c.cardNumber }); } catch(e){}
  let imgs = (card && card.card_images) ? card.card_images : [];
  if(!imgs.length && card && card.id){   // nur Basisdaten vorhanden -> vollständige Karte über die ID holen
    try {
      const res = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?id=' + encodeURIComponent(card.id));
      const d = JSON.parse(await res.text());
      if(d && d.data && d.data[0]) imgs = d.data[0].card_images || [];
    } catch(e){}
  }
  const body = document.getElementById('binder-art-body');
  if(!body) return;   // Dialog wurde inzwischen geschlossen
  if(imgs.length === 0){ body.innerHTML = '<div class="hint">Zu dieser Karte wurden keine Artworks gefunden.</div>'; return; }
  if(imgs.length === 1){ body.innerHTML = '<div class="hint">Diese Karte hat nur ein Artwork.</div>'; return; }

  const cfg = getBinderCfg(folder);
  const current = cfg.art[cardId] ? String(cfg.art[cardId]) : String(imgs[0].id);
  body.innerHTML = '<div class="binder-art-grid">' + imgs.map(function(im, i){
    return '<button type="button" class="binder-art-item' + (String(im.id) === current ? ' sel' : '') + '" data-bartpick="' + escapeAttr(im.id) + '" aria-label="Artwork ' + (i + 1) + '">' +
      (i === 0 ? '<span class="binder-art-tag">Standard</span>' : '') + '</button>';
  }).join('') + '</div>' +
  '<div class="hint" style="margin-top:10px;">Gilt für alle Exemplare dieser Karte im Binder. Die Seltenheits-Optik (Folie) zeigt die Datenbank nicht.</div>';
  body.querySelectorAll('[data-bartpick]').forEach(function(btn){
    binderShowImage(btn, btn.getAttribute('data-bartpick'));
    btn.onclick = function(){
      const id = btn.getAttribute('data-bartpick');
      const art = Object.assign({}, getBinderCfg(folder).art);
      if(String(id) === String(imgs[0].id)) delete art[cardId]; else art[cardId] = id;
      setBinderCfg(folder, { art: art });
      closeBinderModal();
      render();
    };
  });
}

/* ---------- Listener ---------- */
function attachBinderListeners(){
  if(!openFolderId) return;
  const folder = openFolderId;

  document.querySelectorAll('[data-binder-mode]').forEach(function(el){
    el.onclick = function(){
      setBinderCfg(folder, { mode: el.getAttribute('data-binder-mode') });
      binderSettingsOpen = false;
      render();
    };
  });

  const setBtn = document.getElementById('btn-binder-settings');
  if(setBtn){ setBtn.onclick = function(){ binderSettingsOpen = !binderSettingsOpen; render(); }; }

  document.querySelectorAll('[data-bset]').forEach(function(el){
    el.onclick = function(){
      const key = el.getAttribute('data-bset');
      const delta = parseInt(el.getAttribute('data-bdelta'), 10);
      let min = parseInt(el.getAttribute('data-bmin'), 10);
      const max = parseInt(el.getAttribute('data-bmax'), 10);
      const cfg = getBinderCfg(folder);
      let v = cfg[key] + delta;
      if(key === 'maxPages') min = Math.max(min, binderMaxUsedPage(cfg) + 1);
      v = Math.max(min, Math.min(max, v));
      if(v === cfg[key]) return;
      const patch = {};
      patch[key] = v;
      if(key === 'cols' || key === 'rows'){
        // sicherstellen, dass alle belegten Slots in die neue Seitenzahl passen
        const newPer = (key === 'cols' ? v : cfg.cols) * (key === 'rows' ? v : cfg.rows);
        let maxIdx = -1;
        Object.keys(cfg.slots).forEach(function(k){ maxIdx = Math.max(maxIdx, parseInt(k, 10)); });
        const needed = maxIdx >= 0 ? Math.floor(maxIdx / newPer) + 1 : 1;
        if(needed > 60){ showToast('Zu viele belegte Plätze für dieses Layout'); return; }
        if(needed > cfg.maxPages) patch.maxPages = needed;
      }
      setBinderCfg(folder, patch);
      render();
    };
  });

  document.querySelectorAll('[data-bspread]').forEach(function(el){
    el.onclick = function(){
      setBinderCfg(folder, { spread: parseInt(el.getAttribute('data-bspread'), 10) });
      render();
    };
  });

  document.querySelectorAll('[data-bslot]').forEach(function(el){
    el.onclick = function(){
      const idx = parseInt(el.getAttribute('data-bslot'), 10);
      if(el.classList.contains('filled')) openBinderSlotActions(folder, idx);
      else openBinderPicker(folder, idx);
    };
  });

  const cfg = getBinderCfg(folder);
  if(cfg.mode !== 'binder') return;
  const total = binderTotalPages(cfg);
  const cur = binderCurrentPage(folder, cfg, total);
  const step = cfg.spread === 2 ? 2 : 1;

  const prev = document.getElementById('binder-prev');
  if(prev){ prev.onclick = function(){ binderGo(folder, cur - step); }; }
  const next = document.getElementById('binder-next');
  if(next){ next.onclick = function(){ binderGo(folder, cur + step); }; }
  const lastBtn = document.getElementById('binder-last');
  if(lastBtn){
    lastBtn.onclick = function(){
      const used = binderMaxUsedPage(cfg);
      binderGo(folder, Math.max(0, used));
    };
  }

  // Wischen am Handy
  const root = document.getElementById('binder-root');
  if(root){
    let sx = null, sy = null;
    root.addEventListener('touchstart', function(e){
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    root.addEventListener('touchend', function(e){
      if(sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      sx = null; sy = null;
      if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5){
        binderGo(folder, dx < 0 ? cur + step : cur - step);
      }
    }, { passive: true });
  }

  binderApplyImages();
}
