/* ============================================================
   RENDER — Hauptansicht
   ============================================================ */
function render(){
  const app = document.getElementById('app');
  app.innerHTML =
    renderOfflineBanner() +
    renderTopbar() +
    renderTabs() +
    renderTabContent();
  attachMainListeners();
  renderModal();
  renderNoteModal();
}

function renderTopbar(){
  return '' +
  '<div class="topbar">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;">' +
      '<h1><span class="eye"></span>Kartenarchiv</h1>' +
      '<button id="btn-logout" class="btn btn-secondary" type="button" style="width:auto;padding:6px 12px;font-size:12px;">Abmelden</button>' +
    '</div>' +
    '<div class="searchbar">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input id="search-input" type="text" placeholder="Karte, Set, Box, Person suchen…" value="' + escapeAttr(searchQuery) + '">' +
    '</div>' +
  '</div>';
}

function renderTabs(){
  const lentCount = cards.filter(c=>c.isLent).length;
  const saleCount = cards.filter(c=>c.saleStatus && c.saleStatus!=='frei').length;
  const tabDef = [
    {id:'sammlung', label:'Sammlung', count: cards.length},
    {id:'verliehen', label:'Verliehen', count: lentCount},
    {id:'verkauf', label:'Zum Verkauf', count: saleCount}
  ];
  const items = tabDef.map(function(t){
    const active = currentTab===t.id ? ' active' : '';
    return '<div class="tab' + active + '" data-tab="' + t.id + '">' + t.label + ' <span class="count">' + t.count + '</span></div>';
  }).join('');
  return '<div class="tabs">' + items + '</div>';
}

function renderTabContent(){
  if(currentTab==='sammlung') return renderSammlung();
  if(currentTab==='verliehen') return renderSimpleList(cards.filter(c=>c.isLent), 'verliehen');
  return renderSimpleList(cards.filter(c=>c.saleStatus && c.saleStatus!=='frei'), 'verkauf');
}

function matchesSearch(c){
  if(!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  const haystack = [c.name,c.setCode,c.cardNumber,c.box,c.lentTo,c.rarity,c.archetype].join(' ').toLowerCase();
  return haystack.indexOf(q) !== -1;
}

function renderFab(){
  if(isOffline){
    return '<div class="fab" id="fab-note" title="Notiz hinterlassen">📝</div>';
  }
  return '<div class="fab" id="fab-add">+</div>';
}

function renderSammlung(){
  const submenu = '' +
  '<div class="subtabs">' +
    '<button data-subtab="uebersicht" class="' + (sammlungView==='uebersicht'?'active':'') + '">Übersicht</button>' +
    '<button data-subtab="archetypen" class="' + (sammlungView==='archetypen'?'active':'') + '">Archetypen</button>' +
  '</div>';

  if(sammlungView==='archetypen'){
    return submenu + renderArchetypenView();
  }
  return submenu + renderSammlungUebersicht();
}

function renderSammlungUebersicht(){
  const filtered = cards.filter(matchesSearch);
  const totalValue = filtered.reduce(function(sum,c){ return sum + (parseFloat(c.value)||0) * (parseInt(c.quantity)||1); }, 0);

  const groupbar = '' +
  '<div class="groupbar">' +
    '<span class="label">Gruppiert nach</span>' +
    '<div class="grouptoggle">' +
      '<button data-group="set" class="' + (groupBy==='set'?'active':'') + '">Set-Kürzel</button>' +
      '<button data-group="box" class="' + (groupBy==='box'?'active':'') + '">Lagerort</button>' +
    '</div>' +
  '</div>';

  const stats = '' +
  '<div class="stats-row">' +
    '<div class="stat"><div class="num">' + filtered.length + '</div><div class="lbl">Einträge</div></div>' +
    '<div class="stat"><div class="num">' + filtered.reduce(function(s,c){return s+(parseInt(c.quantity)||1);},0) + '</div><div class="lbl">Karten gesamt</div></div>' +
    '<div class="stat"><div class="num">' + totalValue.toFixed(2) + ' €</div><div class="lbl">Geschätzter Wert</div></div>' +
  '</div>' +
  '<div class="backup-row">' +
    '<button id="btn-csv-export">⤓ Als CSV exportieren</button>' +
  '</div>';

  const fabHtml = renderFab();

  if(filtered.length===0){
    return stats + groupbar + renderEmpty('sammlung', true);
  }

  const groups = {};
  filtered.forEach(function(c){
    let key;
    if(groupBy==='set'){
      key = c.setCode ? c.setCode.toUpperCase() : 'Ohne Set';
    } else {
      key = c.box || 'Ohne Lagerort';
    }
    if(!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  const groupKeys = Object.keys(groups).sort();
  const groupsHtml = groupKeys.map(function(key){
    const list = groups[key];
    const isCollapsed = collapsedGroups[key];
    const itemsHtml = list.map(function(c){ return renderCardRow(c); }).join('');
    return '' +
    '<div class="group' + (isCollapsed?' collapsed':'') + '" data-groupkey="' + escapeAttr(key) + '">' +
      '<div class="group-header" data-toggle-group="' + escapeAttr(key) + '">' +
        '<div><span class="title">' + escapeHtml(key) + '</span><span class="sub">' + list.length + ' Eintrag' + (list.length===1?'':'e') + '</span></div>' +
        '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</div>' +
      '<div class="group-items">' + itemsHtml + '</div>' +
    '</div>';
  }).join('');

  return stats + groupbar + groupsHtml + fabHtml;
}

function renderArchetypenView(){
  const filtered = cards.filter(matchesSearch).filter(function(c){ return c.archetype && c.archetype.trim(); });
  const fabHtml = renderFab();

  if(filtered.length===0){
    return renderEmpty('archetypen', true);
  }

  const groups = {};
  filtered.forEach(function(c){
    const key = c.archetype.trim();
    if(!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  const groupKeys = Object.keys(groups).sort();
  const groupsHtml = groupKeys.map(function(key){
    const list = groups[key];
    const gkey = 'arch:' + key;
    const isCollapsed = collapsedGroups[gkey];
    const itemsHtml = list.map(function(c){ return renderCardRow(c); }).join('');
    return '' +
    '<div class="group' + (isCollapsed?' collapsed':'') + '" data-groupkey="' + escapeAttr(gkey) + '">' +
      '<div class="group-header" data-toggle-group="' + escapeAttr(gkey) + '">' +
        '<div><span class="title">' + escapeHtml(key) + '</span><span class="sub">' + list.length + ' Eintrag' + (list.length===1?'':'e') + '</span></div>' +
        '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</div>' +
      '<div class="group-items">' + itemsHtml + '</div>' +
    '</div>';
  }).join('');

  return '<div class="groupbar"><span class="label">' + groupKeys.length + ' Archetyp' + (groupKeys.length===1?'':'en') + '</span></div>' + groupsHtml + fabHtml;
}

function renderSimpleList(list, mode){
  if(list.length===0){
    return renderEmpty(mode, false);
  }
  let header = '<div class="groupbar"><span class="label">' + list.length + ' Eintrag' + (list.length===1?'':'e') + '</span></div>';
  if(mode==='verliehen'){
    header += '' +
    '<div class="hint" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
      '<span>Als "lange verliehen" markieren nach</span>' +
      '<input id="lent-threshold-input" type="number" min="1" value="' + settings.lentWarningDays + '" style="width:56px;background:var(--panel);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 6px;text-align:center;">' +
      '<span>Tagen</span>' +
    '</div>';
  }
  return header + list.map(function(c){ return renderCardRow(c, mode); }).join('');
}

function renderEmpty(mode, showFab){
  const texts = {
    sammlung: ["Noch keine Karten erfasst", "Tippe unten rechts auf + um die erste Karte hinzuzufügen."],
    archetypen: ["Noch keine Archetypen erkannt", "Trage bei einer Karte ein Deck-Thema ein oder nutze \"Archetyp ermitteln\", dann erscheint sie hier gruppiert."],
    verliehen: ["Aktuell ist nichts verliehen", "Markiere eine Karte als verliehen, dann erscheint sie hier."],
    verkauf: ["Nichts zum Verkauf markiert", "Setze bei einer Karte den Verkaufsstatus, dann erscheint sie hier."]
  };
  const t = texts[mode];
  return '<div class="empty-state"><h3>' + t[0] + '</h3><p>' + t[1] + '</p></div>' + (showFab ? renderFab() : '');
}

function renderCardRow(c, mode){
  const metaParts = [];
  if(c.setCode) metaParts.push('<span class="mono">' + escapeHtml(c.setCode.toUpperCase()) + (c.cardNumber?('-'+escapeHtml(c.cardNumber)):'') + '</span>');
  if(c.rarity) metaParts.push(escapeHtml(c.rarity));
  if(c.condition) metaParts.push(escapeHtml(c.condition));
  let overdueDays = null;
  if(mode==='verliehen' && c.isLent){
    metaParts.push('an ' + escapeHtml(c.lentTo||'?') + (c.lentSince?(' seit '+escapeHtml(c.lentSince)):''));
    if(c.lentSince){
      const parsedDate = new Date(c.lentSince);
      if(!isNaN(parsedDate.getTime())){
        overdueDays = Math.floor((Date.now() - parsedDate.getTime()) / 86400000);
      }
    }
  }
  if(mode==='verkauf' && c.saleStatus!=='frei'){
    metaParts.push(c.saleStatus + (c.salePrice ? (' · ' + parseFloat(c.salePrice).toFixed(2) + ' €') : ''));
  }
  if(!mode && c.box){
    metaParts.push(c.box);
  }

  const isOverdue = overdueDays !== null && overdueDays >= settings.lentWarningDays;

  const badges = [];
  if(c.isLent) badges.push('<span class="badge lent">Verliehen</span>');
  if(isOverdue) badges.push('<span class="badge lent-overdue">Lange verliehen · ' + overdueDays + ' Tage</span>');
  if(c.saleStatus && c.saleStatus!=='frei') badges.push('<span class="badge sale">' + (c.saleStatus==='verkauft'?'Verkauft':'Zum Verkauf') + '</span>');

  const qtyControl = isOffline ? '' : '' +
  '<div class="qty-control">' +
    '<button type="button" class="qty-btn" data-qty-minus="' + c.id + '">−</button>' +
    '<div class="qty">×' + (c.quantity||1) + '</div>' +
    '<button type="button" class="qty-btn" data-qty-plus="' + c.id + '">+</button>' +
  '</div>';
  const qtyDisplayOffline = isOffline ? '<div class="qty mono" style="flex-shrink:0;">×' + (c.quantity||1) + '</div>' : '';

  return '' +
  '<div class="card-row' + (isOverdue?' overdue':'') + '"' + (isOffline ? '' : ' data-edit="' + c.id + '"') + '>' +
    qtyControl + qtyDisplayOffline +
    '<div class="info">' +
      '<div class="name">' + escapeHtml(c.name||'(ohne Namen)') + '</div>' +
      '<div class="meta">' + metaParts.join(' · ') + '</div>' +
    '</div>' +
    '<div class="badges">' + badges.join('') + '</div>' +
  '</div>';
}
