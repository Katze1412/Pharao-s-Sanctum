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
let binderImgBusy = false;

const BINDER_DEFAULTS = { mode: 'binder', cols: 3, rows: 3, spread: 0, maxPages: 10, size: 90 };

/* ---------- Konfiguration ---------- */
function getBinderCfg(folder){
  const stored = (settings.folderBinder && settings.folderBinder[folder]) || {};
  const cfg = Object.assign({}, BINDER_DEFAULTS, stored);
  cfg.slots = stored.slots || {};
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

function binderPlacedCount(cfg, cardId){
  let n = 0;
  Object.keys(cfg.slots).forEach(function(k){ if(cfg.slots[k] === cardId) n++; });
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

function renderBinderSlot(c, idx){
  if(!c){
    return '<button type="button" class="binder-slot empty" data-bslot="' + idx + '" aria-label="Leerer Slot"><span>+</span></button>';
  }
  return '<button type="button" class="binder-slot filled" data-bslot="' + idx + '" data-bname="' + escapeAttr(c.name) + '" title="' + escapeAttr(c.name) + '">' +
    '<span class="binder-slot-name">' + escapeHtml(c.name) + '</span>' +
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
    const cid = cfg.slots[idx];
    const c = cid ? byId[cid] : null;
    slotsHtml += renderBinderSlot(c, idx);
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
  Object.keys(cfg.slots).map(function(k){ return parseInt(k, 10); }).sort(function(a, b){ return a - b; }).forEach(function(idx){
    const id = cfg.slots[idx];
    if(!posByCard[id]) posByCard[id] = [];
    posByCard[id].push('S. ' + (Math.floor(idx / per) + 1) + ' · Platz ' + ((idx % per) + 1));
  });

  const placed = [];
  const unplaced = [];
  folderCards.forEach(function(c){
    const q = parseInt(c.quantity, 10) || 1;
    const free = Math.max(0, q - (posByCard[c.id] ? posByCard[c.id].length : 0));
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
  Object.keys(cfg.slots).forEach(function(k){ if(cfg.slots[k] === cardId){ min = Math.min(min, parseInt(k, 10)); } });
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
    try { binderImgCache = JSON.parse(localStorage.getItem('ps_binder_img') || '{}'); }
    catch(e){ binderImgCache = {}; }
  }
  return binderImgCache;
}
function binderImgSave(){
  try { localStorage.setItem('ps_binder_img', JSON.stringify(binderImgCache)); } catch(e){}
}
function binderImgUrl(id){
  return 'https://images.ygoprodeck.com/images/cards_small/' + id + '.jpg';
}
function binderApplyImages(){
  const cache = binderImgGet();
  document.querySelectorAll('.binder-slot.filled[data-bname]').forEach(function(el){
    const name = el.getAttribute('data-bname');
    const v = cache[name];
    if(v){
      el.style.backgroundImage = 'url(' + binderImgUrl(v) + ')';
      el.classList.add('has-img');
    } else if(v === undefined){
      if(binderImgQueue.indexOf(name) === -1) binderImgQueue.push(name);
    }
  });
  binderRunQueue();
}
async function binderRunQueue(){
  if(binderImgBusy || binderImgQueue.length === 0) return;
  binderImgBusy = true;
  while(binderImgQueue.length){
    const name = binderImgQueue.shift();
    let id = 0;
    try {
      const c = await fetchYgoCard(name);
      if(c){
        id = (c.card_images && c.card_images[0] && c.card_images[0].id) || c.id || 0;
      }
    } catch(e){
      continue; // Netzwerkfehler: nicht cachen, beim nächsten Rendern erneut versuchen
    }
    binderImgGet()[name] = id;
    binderImgSave();
    document.querySelectorAll('.binder-slot.filled[data-bname]').forEach(function(el){
      if(el.getAttribute('data-bname') === name && id){
        el.style.backgroundImage = 'url(' + binderImgUrl(id) + ')';
        el.classList.add('has-img');
      }
    });
    await new Promise(function(r){ setTimeout(r, 120); });
  }
  binderImgBusy = false;
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
  const candidates = binderFolderCards(folder).filter(function(c){
    const q = parseInt(c.quantity, 10) || 1;
    return q - binderPlacedCount(cfg, c.id) > 0;
  }).sort(function(a, b){ return a.name.localeCompare(b.name, 'de'); });

  root.innerHTML = '' +
  '<div class="modal-overlay" id="binder-modal-overlay" style="z-index:70;">' +
    '<div class="modal" style="max-width:460px;max-height:85vh;display:flex;flex-direction:column;">' +
      '<div class="modal-head"><h2>Karte in Slot legen</h2><button class="modal-close" id="binder-modal-close" type="button">×</button></div>' +
      '<div class="searchbar" style="margin-top:0;margin-bottom:10px;">' +
        '<input id="binder-pick-search" type="text" placeholder="Kartenname suchen…" autocomplete="off">' +
      '</div>' +
      '<div id="binder-pick-list" style="overflow-y:auto;flex:1;"></div>' +
      '<div class="hint" style="margin-top:8px;">Es werden nur Karten aus diesem Ordner angezeigt, die noch freie Exemplare haben. Weitere Karten legst du über das + unten rechts an.</div>' +
    '</div>' +
  '</div>';

  function fillList(){
    const q = (document.getElementById('binder-pick-search').value || '').toLowerCase().trim();
    const list = candidates.filter(function(c){ return !q || c.name.toLowerCase().indexOf(q) !== -1; });
    const el = document.getElementById('binder-pick-list');
    if(list.length === 0){
      el.innerHTML = '<div class="empty-state"><p>' + (candidates.length === 0 ? 'Keine freien Karten in diesem Ordner.' : 'Keine Treffer.') + '</p></div>';
      return;
    }
    el.innerHTML = list.slice(0, 60).map(function(c){
      const free = (parseInt(c.quantity, 10) || 1) - binderPlacedCount(cfg, c.id);
      return '<div class="card-row" data-bpick="' + escapeAttr(c.id) + '" style="cursor:pointer;">' +
        '<div class="info" style="flex:1;min-width:0;">' +
          '<div style="font-weight:600;word-break:break-word;">' + escapeHtml(c.name) + '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);">' + escapeHtml([c.setCode, c.rarity].filter(Boolean).join(' · ')) + '</div>' +
        '</div>' +
        '<div class="qty">frei ×' + free + '</div>' +
      '</div>';
    }).join('');
    el.querySelectorAll('[data-bpick]').forEach(function(row){
      row.onclick = function(){
        const cur = getBinderCfg(folder);
        const slots = Object.assign({}, cur.slots);
        slots[slotIdx] = row.getAttribute('data-bpick');
        setBinderCfg(folder, { slots: slots });
        closeBinderModal();
        render();
      };
    });
  }

  document.getElementById('binder-modal-close').onclick = closeBinderModal;
  document.getElementById('binder-modal-overlay').onclick = function(e){ if(e.target.id === 'binder-modal-overlay') closeBinderModal(); };
  document.getElementById('binder-pick-search').oninput = fillList;
  fillList();
  document.getElementById('binder-pick-search').focus();
}

function openBinderSlotActions(folder, slotIdx){
  const root = document.getElementById('settingsmodal-root');
  if(!root) return;
  const cfg = getBinderCfg(folder);
  const c = cards.find(function(x){ return x.id === cfg.slots[slotIdx]; });
  if(!c) return;
  const per = binderPerPage(cfg);
  const page = Math.floor(slotIdx / per) + 1;
  const pos = (slotIdx % per) + 1;
  const meta = [c.setCode, c.rarity, c.condition].filter(Boolean).join(' · ');

  root.innerHTML = '' +
  '<div class="modal-overlay" id="binder-modal-overlay" style="z-index:70;">' +
    '<div class="modal" style="max-width:380px;">' +
      '<div class="modal-head"><h2>' + escapeHtml(c.name) + '</h2><button class="modal-close" id="binder-modal-close" type="button">×</button></div>' +
      '<div class="hint" style="margin-bottom:14px;">Seite ' + page + ', Platz ' + pos + (meta ? ' · ' + escapeHtml(meta) : '') + '</div>' +
      '<button class="btn btn-secondary" id="binder-act-edit" type="button" style="margin-bottom:8px;">✎ Karte bearbeiten</button>' +
      '<button class="btn btn-danger" id="binder-act-remove" type="button">Aus Slot entfernen</button>' +
    '</div>' +
  '</div>';

  document.getElementById('binder-modal-close').onclick = closeBinderModal;
  document.getElementById('binder-modal-overlay').onclick = function(e){ if(e.target.id === 'binder-modal-overlay') closeBinderModal(); };
  document.getElementById('binder-act-edit').onclick = function(){ closeBinderModal(); openModalForEdit(c.id); };
  document.getElementById('binder-act-remove').onclick = function(){
    const cur = getBinderCfg(folder);
    const slots = Object.assign({}, cur.slots);
    delete slots[slotIdx];
    setBinderCfg(folder, { slots: slots });
    closeBinderModal();
    render();
  };
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
