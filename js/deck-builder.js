/* ============================================================
   DECK-BUILDER — UI: Deck-Liste, Editor, Suche, Statistiken
   ============================================================ */

/* ---------- DECK-LISTE ---------- */
function renderDeckListView(){
  if(decks.length === 0){
    return '<div class="empty-state"><span class="hiero hiero-glyph">𓂀</span><h3>Noch keine Decks erstellt</h3><p>Tippe auf + um dein erstes Deck zu bauen.</p></div>' + renderFab();
  }
  const tiles = decks.map(function(d){
    const total = (d.mainDeck||[]).length + (d.extraDeck||[]).length;
    return '' +
    '<div class="folder-tile" data-open-deck="' + d.id + '">' +
      '<div class="folder-icon">⚔</div>' +
      '<div class="folder-name">' + escapeHtml(d.name) + '</div>' +
      '<div class="folder-count">' + total + ' Karten · ' + d.banlist.toUpperCase() + '</div>' +
    '</div>';
  }).join('');
  return '<div class="folder-grid">' + tiles + '</div>' + renderFab();
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
    {id:'stats', label:'📊 Statistiken'}
  ];
  const tabHtml = subtabs.map(function(t){
    return '<button data-deck-subtab="' + t.id + '" class="' + (deckSubtab===t.id?'active':'') + '">' + t.label + '</button>';
  }).join('');

  const banlistHtml = '' +
  '<select id="deck-banlist-select" style="background:var(--panel);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 8px;font-size:13px;">' +
    '<option value="tcg" ' + (deck.banlist==='tcg'?'selected':'') + '>TCG Banlist</option>' +
    '<option value="ocg" ' + (deck.banlist==='ocg'?'selected':'') + '>OCG Banlist</option>' +
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
    '<button type="button" id="btn-deck-export-txt" class="btn btn-secondary" style="margin-bottom:8px;">⤓ Als Text exportieren</button>' +
    '<button type="button" id="btn-deck-delete" class="btn btn-danger">🗑️ Deck löschen</button>' +
  '</div>';
}

function renderDeckSubtabContent(deck){
  if(deckSubtab === 'suchen') return renderDeckSearch(deck);
  if(deckSubtab === 'main') return renderDeckSection(deck, 'mainDeck', 'Hauptdeck', 40, 60);
  if(deckSubtab === 'extra') return renderDeckSection(deck, 'extraDeck', 'Extra Deck', 0, 15);
  if(deckSubtab === 'side') return renderDeckSection(deck, 'sideDeck', 'Side Deck', 0, 15);
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

  return '' +
  '<div class="card-row" style="' + (!canAdd?'opacity:.5;':'') + '">' +
    '<div class="info">' +
      '<div class="name">' + escapeHtml(card.name) +
        (card._lang === 'en' ? ' <span style="color:var(--lapis-bright);font-size:11px;">EN</span>' : '') +
        (inCollection ? ' <span style="color:var(--teal-bright);font-size:11px;">✓ in Sammlung</span>' : '') +
      '</div>' +
      '<div class="meta">' + escapeHtml(card.type||'') + (card.atk!==undefined?' · ATK ' + card.atk:'') + (card.def!==undefined?' / DEF ' + card.def:'') + '</div>' +
      '<div class="meta">' + banBadge + (currentCount > 0 ? ' <span style="color:var(--text-muted);font-size:11px;">' + currentCount + 'x im Deck</span>' : '') + '</div>' +
    '</div>' +
    '<button type="button" class="btn btn-secondary" data-deck-add="' + card.id + '" style="width:auto;padding:6px 12px;font-size:13px;flex-shrink:0;" ' + (!canAdd?'disabled':'') + '>+</button>' +
  '</div>';
}

/* ---------- DECK-SEKTION (Main/Extra/Side) ---------- */
function renderDeckSection(deck, section, label, minCards, maxCards){
  const sectionCards = deck[section] || [];
  const isValid = sectionCards.length >= minCards && sectionCards.length <= maxCards;
  const statusColor = sectionCards.length > maxCards ? 'var(--crimson-bright)' : sectionCards.length < minCards && minCards > 0 ? 'var(--gold)' : 'var(--teal-bright)';

  const grouped = {};
  sectionCards.forEach(function(c){
    if(!grouped[c.id]){ grouped[c.id] = { card: c, count: 0 }; }
    grouped[c.id].count++;
  });

  const cardsHtml = Object.values(grouped).map(function(entry){
    const c = entry.card;
    const banStatus = getBanlistStatus(c, deck.banlist);
    let banBadge = '';
    if(banStatus === 'Banned') banBadge = '<span class="badge" style="background:rgba(138,35,50,.25);color:#f0a3ad;border:1px solid var(--crimson-bright);">Verboten</span>';
    else if(banStatus === 'Limited') banBadge = '<span class="badge" style="background:rgba(201,162,39,.15);color:var(--gold-bright);border:1px solid var(--gold);">Limitiert</span>';
    else if(banStatus === 'Semi-Limited') banBadge = '<span class="badge" style="background:rgba(201,162,39,.08);color:var(--gold);border:1px solid var(--border);">Semi-Limit</span>';
    const inCollection = cards.some(function(col){ return col.name && c.name && col.name.toLowerCase() === c.name.toLowerCase(); });
    return '' +
    '<div class="card-row">' +
      '<div class="qty-control">' +
        '<button type="button" class="qty-btn" data-deck-remove="' + c.id + '" data-deck-section="' + section + '">−</button>' +
        '<div class="qty">×' + entry.count + '</div>' +
        '<button type="button" class="qty-btn" data-deck-add-section="' + c.id + '" data-deck-section="' + section + '">+</button>' +
      '</div>' +
      '<div class="info">' +
        '<div class="name">' + escapeHtml(c.name||'') + (inCollection ? ' <span style="color:var(--teal-bright);font-size:11px;">✓</span>' : '') + '</div>' +
        '<div class="meta">' + escapeHtml(c.type||'') + ' ' + banBadge + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  const emptyHtml = sectionCards.length === 0 ? '<div class="hint" style="padding:16px;text-align:center;">Noch keine Karten in diesem Bereich</div>' : '';

  return '' +
  '<div style="padding:10px 14px 0;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
      '<span style="color:var(--text-muted);font-size:13px;">' + label + '</span>' +
      '<span style="color:' + statusColor + ';font-size:13px;font-weight:600;">' + sectionCards.length + (maxCards > 0 ? ' / ' + maxCards : '') + '</span>' +
    '</div>' +
    cardsHtml + emptyHtml +
  '</div>';
}

/* ---------- STATISTIKEN ---------- */
function renderDeckStats(deck){
  const all = (deck.mainDeck||[]).concat(deck.extraDeck||[]).concat(deck.sideDeck||[]);
  if(all.length === 0) return '<div class="hint" style="padding:24px;text-align:center;">Noch keine Karten im Deck</div>';

  const total = deck.mainDeck.length + deck.extraDeck.length + deck.sideDeck.length;

  // Typ-Verteilung
  const typeCounts = {};
  all.forEach(function(c){
    const t = c.type || 'Unbekannt';
    typeCounts[t] = (typeCounts[t]||0) + 1;
  });

  // Level/Rank-Verteilung (nur Hauptdeck-Monster)
  const levelCounts = {};
  deck.mainDeck.forEach(function(c){
    if(c.level){ levelCounts[c.level] = (levelCounts[c.level]||0) + 1; }
  });

  // Attribut-Verteilung
  const attrCounts = {};
  all.forEach(function(c){
    if(c.attribute){ attrCounts[c.attribute] = (attrCounts[c.attribute]||0) + 1; }
  });

  // Banlist-Warnungen
  const banlisted = all.filter(function(c){
    const status = getBanlistStatus(c, deck.banlist);
    return status === 'Banned' || status === 'Limited' || status === 'Semi-Limited';
  });

  // Validierungsprobleme
  const problems = [];
  if(deck.mainDeck.length < 40) problems.push('Hauptdeck hat weniger als 40 Karten (' + deck.mainDeck.length + ')');
  if(deck.mainDeck.length > 60) problems.push('Hauptdeck hat mehr als 60 Karten (' + deck.mainDeck.length + ')');
  if(deck.extraDeck.length > 15) problems.push('Extra Deck hat mehr als 15 Karten (' + deck.extraDeck.length + ')');
  if(deck.sideDeck.length > 15) problems.push('Side Deck hat mehr als 15 Karten (' + deck.sideDeck.length + ')');
  banlisted.forEach(function(c){
    const status = getBanlistStatus(c, deck.banlist);
    if(status === 'Banned') problems.push(c.name + ' ist auf der Verbotsliste');
  });

  const problemsHtml = problems.length > 0
    ? '<div style="background:rgba(138,35,50,.15);border:1px solid var(--crimson-bright);border-radius:8px;padding:10px 14px;margin-bottom:12px;">' +
        '<div style="color:#f0a3ad;font-weight:600;margin-bottom:6px;">⚠️ ' + problems.length + ' Problem(e)</div>' +
        problems.map(function(p){ return '<div style="color:var(--text-muted);font-size:13px;">· ' + escapeHtml(p) + '</div>'; }).join('') +
      '</div>'
    : '<div style="background:rgba(63,143,134,.12);border:1px solid var(--teal-bright);border-radius:8px;padding:10px 14px;margin-bottom:12px;color:var(--teal-bright);">✅ Deck ist regelkonform</div>';

  function barChart(counts, title){
    const sorted = Object.entries(counts).sort(function(a,b){ return b[1]-a[1]; });
    const max = sorted[0] ? sorted[0][1] : 1;
    const bars = sorted.map(function(entry){
      const pct = Math.round(entry[1]/max*100);
      return '' +
      '<div style="margin-bottom:6px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:2px;">' +
          '<span>' + escapeHtml(String(entry[0])) + '</span><span>' + entry[1] + '</span>' +
        '</div>' +
        '<div style="background:var(--border);border-radius:3px;height:6px;">' +
          '<div style="background:var(--gold);border-radius:3px;height:6px;width:' + pct + '%;"></div>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<div style="margin-bottom:16px;"><div style="color:var(--text-muted);font-size:12px;font-weight:600;margin-bottom:8px;">' + title + '</div>' + bars + '</div>';
  }

  return '' +
  '<div style="padding:10px 14px 0;">' +
    '<div style="display:flex;gap:12px;margin-bottom:12px;">' +
      '<div class="stat"><div class="num">' + deck.mainDeck.length + '</div><div class="lbl">Hauptdeck</div></div>' +
      '<div class="stat"><div class="num">' + deck.extraDeck.length + '</div><div class="lbl">Extra</div></div>' +
      '<div class="stat"><div class="num">' + deck.sideDeck.length + '</div><div class="lbl">Side</div></div>' +
    '</div>' +
    problemsHtml +
    barChart(typeCounts, 'Kartentypen') +
    (Object.keys(levelCounts).length > 0 ? barChart(levelCounts, 'Level / Rang (Hauptdeck)') : '') +
    (Object.keys(attrCounts).length > 0 ? barChart(attrCounts, 'Attribute') : '') +
  '</div>';
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
      const apiCard = deckSearchResults.find(function(c){ return c.id === cardId; });
      if(!apiCard) return;
      const section = getDeckSection(deck, apiCard.type);
      const maxCopies = getMaxCopies(apiCard, deck.banlist);
      const currentCount = deck[section].filter(function(c){ return c.id === cardId; }).length;
      const sectionMax = section === 'extraDeck' ? 15 : 60;
      if(currentCount >= maxCopies){ showToast('Maximum für diese Karte erreicht'); return; }
      if(deck[section].length >= sectionMax){ showToast('Maximale Kartenanzahl erreicht'); return; }
      deck[section].push({ id: apiCard.id, name: apiCard.name, type: apiCard.type, level: apiCard.level, attribute: apiCard.attribute, atk: apiCard.atk, def: apiCard.def, banlist_info: apiCard.banlist_info });
      // Ergebnisliste aktualisieren ohne Fokus zu verlieren
      const el = document.getElementById('deck-search-results');
      if(el){
        el.innerHTML = deckSearchResults.map(function(c){ return renderDeckSearchResult(c, deck); }).join('');
        attachDeckAddListeners(el, deck);
      }
      // Subtab-Zähler aktualisieren
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
  // Deck öffnen
  document.querySelectorAll('[data-open-deck]').forEach(function(el){
    el.onclick = function(){ currentDeckId = el.getAttribute('data-open-deck'); deckSubtab = 'suchen'; render(); };
  });

  // Zurück zur Liste
  const backBtn = document.getElementById('btn-deck-back');
  if(backBtn){ backBtn.onclick = function(){ currentDeckId = null; render(); }; }

  // Deck-Name
  const nameInput = document.getElementById('deck-name-input');
  if(nameInput){
    nameInput.oninput = function(){
      const deck = getCurrentDeck();
      if(deck) deck.name = nameInput.value;
    };
  }

  // Banlist-Dropdown
  const banlistSelect = document.getElementById('deck-banlist-select');
  if(banlistSelect){
    banlistSelect.onchange = function(){
      const deck = getCurrentDeck();
      if(deck){ deck.banlist = banlistSelect.value; render(); }
    };
  }

  // Speichern
  const saveBtn = document.getElementById('btn-deck-save');
  if(saveBtn){ saveBtn.onclick = async function(){ await saveDeckChanges(); }; }

  // Löschen
  const deleteBtn = document.getElementById('btn-deck-delete');
  if(deleteBtn){
    deleteBtn.onclick = async function(){
      const deck = getCurrentDeck();
      if(!deck) return;
      if(!window.confirm('Deck "' + deck.name + '" wirklich löschen?')) return;
      const ok = await DeckLayer.delete(deck.id);
      if(ok){
        decks = decks.filter(function(d){ return d.id !== deck.id; });
        currentDeckId = null;
        render();
        showToast('Deck gelöscht');
      }
    };
  }

  // Export
  const exportYdkBtn = document.getElementById('btn-deck-export-ydk');
  if(exportYdkBtn){ exportYdkBtn.onclick = function(){ const d = getCurrentDeck(); if(d) exportDeckAsYdk(d); }; }
  const exportTxtBtn = document.getElementById('btn-deck-export-txt');
  if(exportTxtBtn){ exportTxtBtn.onclick = function(){ const d = getCurrentDeck(); if(d) exportDeckAsTxt(d); }; }

  // Subtabs
  document.querySelectorAll('[data-deck-subtab]').forEach(function(el){
    el.onclick = function(){ deckSubtab = el.getAttribute('data-deck-subtab'); render(); };
  });

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
