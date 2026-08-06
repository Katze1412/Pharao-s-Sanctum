/* ============================================================
   DECK-BUILDER — UI: Deck-Liste, Editor, Suche, Statistiken
   ============================================================ */

/* ---------- DECK-LISTE ---------- */
function renderDeckListView(){
  const importInput = '<input type="file" id="deck-import-file-list" accept=".ydk" style="display:none">';
  const importFab = '<div class="fab fab-bell" id="fab-import-ydk" title=".ydk importieren" style="bottom:96px;">⤒</div>';

  if(decks.length === 0){
    return '<div class="empty-state"><span class="hiero hiero-glyph">𓂀</span><h3>Noch keine Decks erstellt</h3><p>Tippe auf + um dein erstes Deck zu bauen oder importiere eine .ydk-Datei.</p></div>' +
    importInput + importFab + renderFab();
  }

  const tiles = decks.map(function(d){
    const total = (d.mainDeck||[]).length + (d.extraDeck||[]).length;
    const coverImg = d.coverId
      ? '<img src="https://images.ygoprodeck.com/images/cards/small/' + d.coverId + '.jpg" alt="" style="width:100%;height:120px;object-fit:cover;object-position:center top;border-radius:8px 8px 0 0;display:block;" onerror="this.style.display=\'none\'">'
      : '<div style="height:120px;background:linear-gradient(135deg,var(--panel-2),var(--panel-3));border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;"><span style="font-size:48px;opacity:.4;">⚔</span></div>';

    return '' +
    '<div class="deck-tile" data-open-deck="' + d.id + '">' +
      coverImg +
      '<div style="padding:10px 12px;">' +
        '<div class="folder-name" style="margin-bottom:4px;">' + escapeHtml(d.name) + '</div>' +
        '<div class="folder-count">' + total + ' Karten · ' + d.banlist.toUpperCase() + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  return '<div class="folder-grid">' + tiles + '</div>' + importInput + importFab + renderFab();
}

/* ---------- DECK-EDITOR WRAPPER ---------- */
function renderDeckEditor(){
  const deck = getCurrentDeck();
  if(!deck) return '<div class="empty-state"><h3>Deck nicht gefunden</h3></div>';

  const subtabs = [
    {id:'suchen', label:'🔍 Suchen'},
    {id:'main', label:'Hauptdeck (' + deck.mainDeck.length + ')'},
    {id:'extra', label:'Extra (' + deck.extraDeck.length + ')'},
    {id:'side', label:'Side (' + deck.sideDeck.length + ')'},
    {id:'want', label:'🛒 Want'},
    {id:'stats', label:'📊 Statistiken'}
  ];
  const tabHtml = subtabs.map(function(t){
    return '<button data-deck-subtab="' + t.id + '" class="' + (deckSubtab===t.id?'active':'') + '">' + t.label + '</button>';
  }).join('');

  const BANLIST_OPTIONS = [
    { value: 'tcg',    label: 'TCG Banlist (Mai 2026)',    key: 'ban_tcg' },
    { value: 'ocg',    label: 'OCG Banlist (April 2026)',  key: 'ban_ocg' },
    { value: 'goat',   label: 'Goat Format (April 2005)',  key: 'ban_goat' },
    { value: 'edison', label: 'Edison Format (Sept. 2010)', key: 'ban_goat' }
  ];

  const banlistHtml = '' +
  '<select id="deck-banlist-select" style="background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:12px;max-width:220px;">' +
    BANLIST_OPTIONS.map(function(opt){
      return '<option value="' + opt.value + '" ' + (deck.banlist===opt.value?'selected':'') + '>' + opt.label + '</option>';
    }).join('') +
  '</select>';

  return '' +
  '<div style="padding:10px 14px 0;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
      '<button type="button" id="btn-deck-back" style="background:none;border:none;color:var(--gold-bright);font-size:14px;cursor:pointer;">← Decks</button>' +
      '<input id="deck-name-input" type="text" value="' + escapeAttr(deck.name) + '" style="flex:1;background:var(--panel);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:15px;font-weight:600;">' +
      banlistHtml +
      '<button type="button" id="btn-deck-save" class="btn btn-primary" style="width:auto;padding:6px 14px;font-size:13px;">💾 Speichern</button>' +
    '</div>' +
    '<div class="subtabs">' + tabHtml + '</div>' +
  '</div>' +
  renderDeckSubtabContent(deck) +
  '<div style="padding:10px 14px;">' +
    '<button type="button" id="btn-deck-export-ydk" class="btn btn-secondary" style="margin-bottom:8px;">⤓ Als .ydk exportieren</button>' +
    '<button type="button" id="btn-deck-import-ydk" class="btn btn-secondary" style="margin-bottom:8px;">⤒ .ydk importieren</button>' +
    '<input type="file" id="deck-import-file" accept=".ydk" style="display:none">' +
    '<button type="button" id="btn-deck-export-txt" class="btn btn-secondary" style="margin-bottom:8px;">⤓ Als Text exportieren</button>' +
    '<button type="button" id="btn-deck-delete" class="btn btn-danger">🗑️ Deck löschen</button>' +
  '</div>';
}

function renderDeckSubtabContent(deck){
  if(deckSubtab === 'suchen') return renderDeckSearch(deck);
  if(deckSubtab === 'main') return renderDeckSection(deck, 'mainDeck', 'Hauptdeck', 40, 60);
  if(deckSubtab === 'extra') return renderDeckSection(deck, 'extraDeck', 'Extra Deck', 0, 15);
  if(deckSubtab === 'side') return renderDeckSection(deck, 'sideDeck', 'Side Deck', 0, 15);
  if(deckSubtab === 'pool') return renderDeckWant(deck);
  if(deckSubtab === 'want') return renderDeckWant(deck);
  if(deckSubtab === 'stats') return renderDeckStats(deck);
  return '';
}

/* ---------- SUCHE ---------- */
function renderDeckSearch(deck){
  const resultsHtml = deckSearchLoading
    ? '<div class="hint" style="padding:16px;text-align:center;">Suche läuft…</div>'
    : deckSearchResults.length === 0
      ? (deckSearchQuery.length > 1 ? '<div class="hint" style="padding:16px;text-align:center;">Keine Ergebnisse</div>' : '')
      : deckSearchResults.map(function(card){
          return renderDeckSearchResult(card, deck);
        }).join('');

  return '' +
  '<div style="padding:10px 14px 0;">' +
    '<div class="searchbar" style="margin-bottom:10px;">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input id="deck-search-input" type="text" dir="ltr" placeholder="Karte suchen (min. 2 Zeichen)…" value="' + escapeAttr(deckSearchQuery) + '">' +
    '</div>' +
    '<div id="deck-search-results">' + resultsHtml + '</div>' +
  '</div>';
}

function renderDeckSearchResult(card, deck){
  const banStatus = getBanlistStatus(card, deck.banlist);
  const maxCopies = getMaxCopies(card, deck.banlist);
  const section = getDeckSection(deck, card.type);
  const currentCount = (deck[section]||[]).filter(function(c){ return c.id === card.id; }).length;
  const inCollection = cards.some(function(c){ return c.name && card.name && c.name.toLowerCase() === card.name.toLowerCase(); });
  const canAdd = maxCopies > 0 && currentCount < maxCopies && (section === 'extraDeck' ? deck.extraDeck.length < 15 : deck.mainDeck.length < 60);

  let banBadge = '';
  if(banStatus === 'Banned') banBadge = '<span class="badge" style="background:rgba(138,35,50,.25);color:#f0a3ad;border:1px solid var(--crimson-bright);">Verboten</span>';
  else if(banStatus === 'Limited') banBadge = '<span class="badge" style="background:rgba(201,162,39,.15);color:var(--gold-bright);border:1px solid var(--gold);">Limitiert</span>';
  else if(banStatus === 'Semi-Limited') banBadge = '<span class="badge" style="background:rgba(201,162,39,.08);color:var(--gold);border:1px solid var(--border);">Semi-Limit</span>';

  const isExtraType = getDeckSection(deck, card.type) === 'extraDeck';
  const mainLabel = isExtraType ? 'E' : 'M';
  const mainSection = isExtraType ? 'extraDeck' : 'mainDeck';
  const mainMax = isExtraType ? 15 : 60;
  const mainCount = (deck[mainSection]||[]).filter(function(c){ return c.id === card.id; }).length;
  const sideCount = (deck.sideDeck||[]).filter(function(c){ return c.id === card.id; }).length;
  const canAddMain = maxCopies > 0 && mainCount < maxCopies && deck[mainSection].length < mainMax;
  const canAddSide = maxCopies > 0 && sideCount < maxCopies && deck.sideDeck.length < 15;

  return '' +
  '<div class="card-row" style="' + (maxCopies===0?'opacity:.5;':'') + '">' +
    '<div class="info">' +
      '<div class="name">' + escapeHtml(card.name) +
        (card._lang === 'en' ? ' <span style="color:var(--lapis-bright);font-size:11px;">EN</span>' : '') +
        (inCollection ? ' <span style="color:var(--teal-bright);font-size:11px;">✓</span>' : '') +
      '</div>' +
      '<div class="meta">' + escapeHtml(card.type||'') + (card.atk!==undefined?' · ATK ' + card.atk:'') + (card.def!==undefined?' / DEF ' + card.def:'') + '</div>' +
      '<div class="meta">' + banBadge + (mainCount > 0 ? ' <span style="color:var(--text-muted);font-size:11px;">' + mainCount + 'x ' + mainLabel + '</span>' : '') + (sideCount > 0 ? ' <span style="color:var(--text-muted);font-size:11px;">' + sideCount + 'x S</span>' : '') + '</div>' +
    '</div>' +
    '<div style="display:flex;gap:4px;flex-shrink:0;">' +
      '<button type="button" class="btn btn-secondary" data-deck-add="' + card.id + '" data-deck-target-section="' + mainSection + '" style="width:36px;padding:6px 0;font-size:13px;font-weight:700;" ' + (!canAddMain?'disabled':'') + ' title="' + (isExtraType?'Extra Deck':'Main Deck') + '">' + mainLabel + '</button>' +
      '<button type="button" class="btn btn-secondary" data-deck-add="' + card.id + '" data-deck-target-section="sideDeck" style="width:36px;padding:6px 0;font-size:13px;font-weight:700;" ' + (!canAddSide?'disabled':'') + ' title="Side Deck">S</button>' +
    '</div>' +
  '</div>';
}

/* ---------- DECK-SEKTION (Main/Extra/Side) ---------- */
function banBadgeHtml(card, banlist){
  const s=getBanlistStatus(card,banlist);
  if(s==='Banned') return '<span class="badge" style="background:rgba(138,35,50,.25);color:#f0a3ad;border:1px solid var(--crimson-bright);">Verboten</span>';
  if(s==='Limited') return '<span class="badge" style="background:rgba(201,162,39,.15);color:var(--gold-bright);border:1px solid var(--gold);">Limitiert</span>';
  if(s==='Semi-Limited') return '<span class="badge" style="background:rgba(201,162,39,.08);color:var(--gold);border:1px solid var(--border);">Semi-Limit</span>';
  return '';
}

function renderDeckSection(deck, section, label, minCards, maxCards){
  const sc=deck[section]||[];
  const col=sc.length>maxCards?'var(--crimson-bright)':sc.length<minCards&&minCards>0?'var(--gold)':'var(--teal-bright)';
  const grouped={};
  sc.forEach(function(c){ if(!grouped[c.id]) grouped[c.id]={card:c,count:0}; grouped[c.id].count++; });
  const rows=Object.values(grouped).map(function(e){
    const c=e.card;
    const owned=cards.some(function(x){ return x.name&&c.name&&x.name.toLowerCase()===c.name.toLowerCase(); });
    const isCover=deck.coverId===c.id;
    return '<div class="card-row"><div class="qty-control"><button type="button" class="qty-btn" data-deck-remove="'+c.id+'" data-deck-section="'+section+'">−</button><div class="qty">×'+e.count+'</div><button type="button" class="qty-btn" data-deck-add-section="'+c.id+'" data-deck-section="'+section+'">+</button></div><div class="info"><div class="name">'+escapeHtml(c.name||'')+(owned?' <span style="color:var(--teal-bright);font-size:11px;">✓</span>':'')+'</div><div class="meta">'+escapeHtml(c.type||'')+' '+banBadgeHtml(c,deck.banlist)+'</div></div>'+(section!=='sideDeck'?'<button type="button" class="btn btn-secondary" data-set-cover="'+c.id+'" style="width:auto;padding:4px 8px;font-size:11px;flex-shrink:0;">'+(isCover?'🖼️✓':'🖼️')+'</button>':'')+'</div>';
  }).join('');
  return '<div style="padding:10px 14px 0;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="color:var(--text-muted);font-size:13px;">'+label+'</span><span style="color:'+col+';font-size:13px;font-weight:600;">'+sc.length+(maxCards?' / '+maxCards:'')+'</span></div>'+(rows||'<div class="hint" style="padding:16px;text-align:center;">Noch keine Karten in diesem Bereich</div>')+'</div>';
}

/* ---------- WANT-LISTE ---------- */
function renderDeckWant(deck){
  const allDeckCards = (deck.mainDeck||[]).concat(deck.extraDeck||[]).concat(deck.sideDeck||[]);
  if(allDeckCards.length === 0){
    return '<div class="empty-state"><h3>Noch keine Karten im Deck</h3><p>Füge Karten hinzu um zu sehen, was du noch brauchst.</p></div>';
  }

  // Pro Kartenname: wie viele brauche ich gesamt, wie viele habe ich
  const needed = {};
  allDeckCards.forEach(function(c){
    const key = c.name.toLowerCase();
    if(!needed[key]){ needed[key] = { name: c.name, required: 0, owned: 0 }; }
    needed[key].required++;
  });

  // Sammlung abgleichen
  cards.forEach(function(c){
    if(!c.name) return;
    const key = c.name.toLowerCase();
    if(needed[key]){
      needed[key].owned += (parseInt(c.quantity) || 1);
    }
  });

  const missing = Object.values(needed).filter(function(e){ return e.owned < e.required; });
  const complete = Object.values(needed).filter(function(e){ return e.owned >= e.required; });

  if(missing.length === 0){
    return '' +
    '<div style="padding:14px;">' +
      '<div style="background:rgba(63,143,134,.12);border:1px solid var(--teal-bright);border-radius:8px;padding:14px;text-align:center;color:var(--teal-bright);font-weight:600;margin-bottom:12px;">✅ Du hast alle Karten für dieses Deck!</div>' +
      '<div class="hint">' + complete.length + ' verschiedene Karten · alle in deiner Sammlung</div>' +
    '</div>';
  }

  const missingHtml = missing.map(function(e){
    const still = e.required - Math.min(e.owned, e.required);
    return '' +
    '<div class="card-row">' +
      '<div class="info">' +
        '<div class="name">' + escapeHtml(e.name) + '</div>' +
        '<div class="meta">' +
          'Benötigt: <strong style="color:var(--text);">' + e.required + 'x</strong> · ' +
          'Vorhanden: <strong style="color:' + (e.owned > 0 ? 'var(--gold-bright)' : 'var(--crimson-bright)') + ';">' + e.owned + 'x</strong> · ' +
          'Fehlend: <strong style="color:var(--crimson-bright);">' + still + 'x</strong>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  const totalMissing = missing.reduce(function(sum, e){ return sum + (e.required - Math.min(e.owned, e.required)); }, 0);

  return '' +
  '<div style="padding:10px 14px 0;">' +
    '<div style="display:flex;gap:12px;margin-bottom:12px;">' +
      '<div class="stat"><div class="num" style="color:var(--crimson-bright);">' + missing.length + '</div><div class="lbl">Fehlende Karten</div></div>' +
      '<div class="stat"><div class="num" style="color:var(--crimson-bright);">' + totalMissing + 'x</div><div class="lbl">Fehlende Kopien</div></div>' +
      '<div class="stat"><div class="num" style="color:var(--teal-bright);">' + complete.length + '</div><div class="lbl">Vorhanden</div></div>' +
    '</div>' +
    missingHtml +
  '</div>';
}

/* ---------- STATISTIKEN ---------- */
function renderDeckStats(deck){
  const all = (deck.mainDeck||[]).concat(deck.extraDeck||[]).concat(deck.sideDeck||[]);
  if(!all.length) return '<div class="hint" style="padding:24px;text-align:center;">Noch keine Karten im Deck</div>';

  // Zählungen aufbauen
  const count = function(arr, key){ const r={}; arr.forEach(function(c){ const v=c[key]||'?'; r[v]=(r[v]||0)+1; }); return r; };
  const typeCounts = count(all, 'type');
  const attrCounts = count(all.filter(function(c){ return c.attribute; }), 'attribute');
  const levelCounts = count(deck.mainDeck.filter(function(c){ return c.level; }), 'level');

  // Validierung
  const problems = [];
  if(deck.mainDeck.length < 40) problems.push('Hauptdeck < 40 Karten (' + deck.mainDeck.length + ')');
  if(deck.mainDeck.length > 60) problems.push('Hauptdeck > 60 Karten (' + deck.mainDeck.length + ')');
  if(deck.extraDeck.length > 15) problems.push('Extra Deck > 15 Karten');
  if(deck.sideDeck.length > 15) problems.push('Side Deck > 15 Karten');
  all.forEach(function(c){ if(getBanlistStatus(c,deck.banlist)==='Banned') problems.push(c.name + ' ist verboten'); });

  const validHtml = problems.length
    ? '<div style="background:rgba(138,35,50,.15);border:1px solid var(--crimson-bright);border-radius:8px;padding:10px 14px;margin-bottom:12px;"><div style="color:#f0a3ad;font-weight:600;margin-bottom:6px;">⚠️ ' + problems.length + ' Problem(e)</div>' + problems.map(function(p){ return '<div style="color:var(--text-muted);font-size:13px;">· ' + escapeHtml(p) + '</div>'; }).join('') + '</div>'
    : '<div style="background:rgba(63,143,134,.12);border:1px solid var(--teal-bright);border-radius:8px;padding:10px 14px;margin-bottom:12px;color:var(--teal-bright);">✅ Deck ist regelkonform</div>';

  function barChart(counts, title){
    const sorted = Object.entries(counts).sort(function(a,b){ return b[1]-a[1]; });
    const max = sorted[0]?sorted[0][1]:1;
    return '<div style="margin-bottom:16px;"><div style="color:var(--text-muted);font-size:12px;font-weight:600;margin-bottom:8px;">' + title + '</div>' +
      sorted.map(function(e){ return '<div style="margin-bottom:5px;"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:2px;"><span>' + escapeHtml(String(e[0])) + '</span><span>' + e[1] + '</span></div><div style="background:var(--border);border-radius:3px;height:6px;"><div style="background:var(--gold);border-radius:3px;height:6px;width:' + Math.round(e[1]/max*100) + '%;"></div></div></div>'; }).join('') + '</div>';
  }

  return '<div style="padding:10px 14px 0;"><div style="display:flex;gap:12px;margin-bottom:12px;"><div class="stat"><div class="num">' + deck.mainDeck.length + '</div><div class="lbl">Hauptdeck</div></div><div class="stat"><div class="num">' + deck.extraDeck.length + '</div><div class="lbl">Extra</div></div><div class="stat"><div class="num">' + deck.sideDeck.length + '</div><div class="lbl">Side</div></div></div>' + validHtml + barChart(typeCounts,'Kartentypen') + (Object.keys(levelCounts).length ? barChart(levelCounts,'Level/Rang') : '') + (Object.keys(attrCounts).length ? barChart(attrCounts,'Attribute') : '') + '</div>';
}

/* ---------- EXPORT ---------- */
function exportDeckAsYdk(deck){
  const lines = ['#main'];
  deck.mainDeck.forEach(function(c){ if(c.id) lines.push(String(c.id)); });
  lines.push('#extra');
  deck.extraDeck.forEach(function(c){ if(c.id) lines.push(String(c.id)); });
  lines.push('!side');
  deck.sideDeck.forEach(function(c){ if(c.id) lines.push(String(c.id)); });
  const blob = new Blob([lines.join('\n')], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (deck.name||'deck') + '.ydk';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('.ydk exportiert');
}

function exportDeckAsTxt(deck){
  const lines = ['=== ' + deck.name + ' ===', '', 'Hauptdeck (' + deck.mainDeck.length + '):'];
  const mainCounts = {};
  deck.mainDeck.forEach(function(c){ mainCounts[c.name] = (mainCounts[c.name]||0)+1; });
  Object.entries(mainCounts).forEach(function(e){ lines.push(e[1] + 'x ' + e[0]); });
  if(deck.extraDeck.length > 0){
    lines.push('', 'Extra Deck (' + deck.extraDeck.length + '):');
    const exCounts = {};
    deck.extraDeck.forEach(function(c){ exCounts[c.name] = (exCounts[c.name]||0)+1; });
    Object.entries(exCounts).forEach(function(e){ lines.push(e[1] + 'x ' + e[0]); });
  }
  if(deck.sideDeck.length > 0){
    lines.push('', 'Side Deck (' + deck.sideDeck.length + '):');
    const sideCounts = {};
    deck.sideDeck.forEach(function(c){ sideCounts[c.name] = (sideCounts[c.name]||0)+1; });
    Object.entries(sideCounts).forEach(function(e){ lines.push(e[1] + 'x ' + e[0]); });
  }
  const blob = new Blob([lines.join('\n')], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (deck.name||'deck') + '.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Text exportiert');
}

/* ---------- LISTENER ---------- */
function attachDeckAddListeners(container, deck){
  container.querySelectorAll('[data-deck-add]').forEach(function(btn){
    btn.onclick = function(){
      const cardId = parseInt(btn.getAttribute('data-deck-add'));
      const targetSection = btn.getAttribute('data-deck-target-section');
      const apiCard = deckSearchResults.find(function(c){ return c.id === cardId; });
      if(!apiCard) return;
      const section = targetSection || getDeckSection(deck, apiCard.type);
      const maxCopies = getMaxCopies(apiCard, deck.banlist);
      const currentCount = deck[section].filter(function(c){ return c.id === cardId; }).length;
      const sectionMax = (section === 'extraDeck' || section === 'sideDeck') ? 15 : 60;
      if(currentCount >= maxCopies){ showToast('Maximum für diese Karte erreicht'); return; }
      if(deck[section].length >= sectionMax){ showToast('Maximale Kartenanzahl erreicht'); return; }
      deck[section].push({ id: apiCard.id, name: apiCard.name, type: apiCard.type, level: apiCard.level, attribute: apiCard.attribute, atk: apiCard.atk, def: apiCard.def, banlist_info: apiCard.banlist_info });
      const el = document.getElementById('deck-search-results');
      if(el){
        el.innerHTML = deckSearchResults.map(function(c){ return renderDeckSearchResult(c, deck); }).join('');
        attachDeckAddListeners(el, deck);
      }
      document.querySelectorAll('[data-deck-subtab]').forEach(function(t){
        const st = t.getAttribute('data-deck-subtab');
        if(st === 'main') t.textContent = 'Hauptdeck (' + deck.mainDeck.length + ')';
        if(st === 'extra') t.textContent = 'Extra (' + deck.extraDeck.length + ')';
        if(st === 'side') t.textContent = 'Side (' + deck.sideDeck.length + ')';
      });
    };
  });
}

function attachDeckListeners(){
  function bind(id, ev, fn){ const el=document.getElementById(id); if(el) el[ev]=fn; }

  document.querySelectorAll('[data-open-deck]').forEach(function(el){
    el.onclick = function(){ currentDeckId = el.getAttribute('data-open-deck'); deckSubtab = 'suchen'; render(); };
  });
  document.querySelectorAll('[data-deck-subtab]').forEach(function(el){
    el.onclick = function(){ deckSubtab = el.getAttribute('data-deck-subtab'); render(); };
  });

  bind('btn-deck-back', 'onclick', function(){ currentDeckId = null; render(); });
  bind('btn-deck-save', 'onclick', async function(){ await saveDeckChanges(); });
  bind('btn-deck-export-ydk', 'onclick', function(){ const d=getCurrentDeck(); if(d) exportDeckAsYdk(d); });
  bind('btn-deck-export-txt', 'onclick', function(){ const d=getCurrentDeck(); if(d) exportDeckAsTxt(d); });

  bind('deck-name-input', 'oninput', function(){ const d=getCurrentDeck(); if(d) d.name=document.getElementById('deck-name-input').value; });
  bind('deck-banlist-select', 'onchange', function(){ const d=getCurrentDeck(); if(d){ d.banlist=document.getElementById('deck-banlist-select').value; render(); } });

  bind('btn-deck-delete', 'onclick', async function(){
    const deck=getCurrentDeck(); if(!deck) return;
    if(!window.confirm('Deck "' + deck.name + '" wirklich löschen?')) return;
    if(await DeckLayer.delete(deck.id)){ decks=decks.filter(function(d){ return d.id!==deck.id; }); currentDeckId=null; render(); showToast('Deck gelöscht'); }
  });

  const importYdkBtn=document.getElementById('btn-deck-import-ydk');
  const importYdkInput=document.getElementById('deck-import-file');
  if(importYdkBtn && importYdkInput){
    importYdkBtn.onclick = function(){ importYdkInput.click(); };
    importYdkInput.onchange = async function(){
      const file=importYdkInput.files[0]; if(!file) return;
      const deck=getCurrentDeck(); if(!deck) return;
      if((deck.mainDeck.length||deck.extraDeck.length) && !window.confirm('Das aktuelle Deck wird überschrieben. Fortfahren?')) return;
      importYdkBtn.disabled=true; importYdkBtn.textContent='⏳ Importiere…';
      const ok=await importDeckFromYdk(file, deck);
      importYdkBtn.disabled=false; importYdkBtn.textContent='⤒ .ydk importieren';
      if(ok) render();
    };
  }

  // Suche
  const searchInput = document.getElementById('deck-search-input');
  let searchTimer = null;
  if(searchInput){
    searchInput.oninput = function(){
      deckSearchQuery = searchInput.value;
      clearTimeout(searchTimer);
      if(deckSearchQuery.length < 2){
        deckSearchResults = [];
        const resultsEl = document.getElementById('deck-search-results');
        if(resultsEl) resultsEl.innerHTML = '';
        return;
      }
      const resultsEl = document.getElementById('deck-search-results');
      if(resultsEl) resultsEl.innerHTML = '<div class="hint" style="padding:16px;text-align:center;">Suche läuft…</div>';
      searchTimer = setTimeout(async function(){
        deckSearchResults = await searchDeckCards(deckSearchQuery);
        const deck = getCurrentDeck();
        const el = document.getElementById('deck-search-results');
        if(el && deck){
          el.innerHTML = deckSearchResults.length === 0
            ? '<div class="hint" style="padding:16px;text-align:center;">Keine Ergebnisse</div>'
            : deckSearchResults.map(function(card){ return renderDeckSearchResult(card, deck); }).join('');
          attachDeckAddListeners(el, deck);
        }
      }, 400);
    };
    searchInput.focus();
  }

  // Cover setzen
  document.querySelectorAll('[data-set-cover]').forEach(function(el){
    el.onclick = function(){
      const deck = getCurrentDeck();
      if(!deck) return;
      const id = parseInt(el.getAttribute('data-set-cover'));
      deck.coverId = deck.coverId === id ? null : id;
      render();
    };
  });

  // Karte aus Deck entfernen (−)
  document.querySelectorAll('[data-deck-remove]').forEach(function(el){
    el.onclick = function(){
      const cardId = parseInt(el.getAttribute('data-deck-remove'));
      const section = el.getAttribute('data-deck-section');
      const deck = getCurrentDeck();
      if(!deck) return;
      const idx = deck[section].findIndex(function(c){ return c.id === cardId; });
      if(idx !== -1){ deck[section].splice(idx, 1); render(); }
    };
  });

  // Karte aus Deck erhöhen (+)
  document.querySelectorAll('[data-deck-add-section]').forEach(function(el){
    el.onclick = function(){
      const cardId = parseInt(el.getAttribute('data-deck-add-section'));
      const section = el.getAttribute('data-deck-section');
      const deck = getCurrentDeck();
      if(!deck) return;
      const card = deck[section].find(function(c){ return c.id === cardId; });
      if(!card) return;
      const maxCopies = getMaxCopies(card, deck.banlist);
      const currentCount = deck[section].filter(function(c){ return c.id === cardId; }).length;
      const sectionMax = section === 'extraDeck' ? 15 : 60;
      if(currentCount >= maxCopies){ showToast('Maximum für diese Karte erreicht'); return; }
      if(deck[section].length >= sectionMax){ showToast('Maximale Kartenanzahl erreicht'); return; }
      deck[section].push(Object.assign({}, card));
      render();
    };
  });
}


function showImportProgressModal(total){
  const root = document.getElementById('modal-root');
  if(!root) return;
  root.innerHTML = '' +
  '<div class="modal-overlay" style="z-index:80;">' +
    '<div class="modal" style="max-width:380px;text-align:center;">' +
      '<h2 style="color:var(--gold-bright);margin-bottom:16px;">⏳ Importiere Deck</h2>' +
      '<div class="hint" id="import-progress-text">0 / ' + total + ' Karten geladen…</div>' +
      '<div style="background:var(--border);border-radius:4px;height:10px;margin-top:12px;overflow:hidden;">' +
        '<div id="import-progress-bar" style="height:10px;background:linear-gradient(90deg,var(--gold),var(--gold-bright));border-radius:4px;width:0%;transition:width .2s;"></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function updateImportProgress(current, total){
  const text = document.getElementById('import-progress-text');
  const bar = document.getElementById('import-progress-bar');
  if(text) text.textContent = Math.min(current, total) + ' / ' + total + ' Karten geladen…';
  if(bar) bar.style.width = Math.min(100, Math.round(current/total*100)) + '%';
}

function showImportResultModal(title, message, notFoundIds, warnings){
  const root = document.getElementById('modal-root');
  if(!root) return;

  const notFoundHtml = notFoundIds.length > 0 ? '' +
  '<div style="margin-top:14px;background:rgba(138,35,50,.15);border:1px solid var(--crimson-bright);border-radius:8px;padding:12px;">' +
    '<div style="color:#f0a3ad;font-weight:600;margin-bottom:8px;">⚠️ ' + notFoundIds.length + ' Karte(n) nicht gefunden:</div>' +
    '<div style="color:var(--text-muted);font-size:12px;font-family:\'JetBrains Mono\',monospace;max-height:120px;overflow-y:auto;">' +
      notFoundIds.map(function(id){ return '<div>ID: ' + id + '</div>'; }).join('') +
    '</div>' +
    '<div class="hint" style="margin-top:8px;">Diese Karten sind möglicherweise noch nicht in der YGOPRODeck-Datenbank vorhanden oder die ID ist ungültig.</div>' +
  '</div>' : '';

  root.innerHTML = '' +
  '<div class="modal-overlay" id="import-result-overlay" style="z-index:80;">' +
    '<div class="modal" style="max-width:420px;">' +
      '<div class="modal-head"><h2>' + escapeHtml(title) + '</h2><button class="modal-close" id="import-result-close">×</button></div>' +
      '<p style="color:var(--text);margin-bottom:4px;">' + escapeHtml(message) + '</p>' +
      notFoundHtml +
      '<button class="btn btn-primary" id="import-result-ok" type="button" style="margin-top:14px;">OK</button>' +
    '</div>' +
  '</div>';

  function closeModal(){ root.innerHTML = ''; }
  document.getElementById('import-result-close').onclick = closeModal;
  document.getElementById('import-result-ok').onclick = closeModal;
  document.getElementById('import-result-overlay').onclick = function(e){ if(e.target.id==='import-result-overlay') closeModal(); };
}
