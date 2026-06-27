function restoreFocus(id){
  const el = document.getElementById(id);
  if(el){ el.focus(); const v = el.value; el.value=''; el.value=v; }
}
/* ============================================================
   MODAL — Hinzufügen / Bearbeiten
   ============================================================ */
function openModalForNew(){
  draft = emptyDraft();
  editingId = null;
  modalTab = 'manuell';
  scanResult = null;
  scanImagePreview = null;
  duplicateMatch = null;
  modalOpen = true;
  renderModal();
}

function openModalForEdit(id){
  const c = cards.find(function(x){ return x.id===id; });
  if(!c) return;
  draft = Object.assign({}, c);
  editingId = id;
  modalTab = 'manuell';
  duplicateMatch = null;
  modalOpen = true;
  renderModal();
}

function closeModal(){
  modalOpen = false;
  document.getElementById('modal-root').innerHTML = '';
}

function renderModal(){
  const root = document.getElementById('modal-root');
  if(!modalOpen){ root.innerHTML=''; return; }

  const tabsHtml = '' +
  '<div class="modal-tabs">' +
    '<button data-mtab="manuell" class="' + (modalTab==='manuell'?'active':'') + '">Manuell</button>' +
    '<button data-mtab="csv" class="' + (modalTab==='csv'?'active':'') + '" ' + (editingId?'disabled':'') + '>CSV-Import</button>' +
    '<button data-mtab="scan" class="' + (modalTab==='scan'?'active':'') + '" ' + (editingId?'disabled':'') + '>Foto-Scan</button>' +
  '</div>';

  let body = '';
  if(modalTab==='manuell') body = renderManualForm();
  else if(modalTab==='csv') body = renderCsvImport();
  else body = renderScanForm();

  root.innerHTML = '' +
  '<div class="modal-overlay" id="modal-overlay">' +
    '<div class="modal">' +
      '<div class="modal-head"><h2>' + (editingId?'Karte bearbeiten':'Karte hinzufügen') + '</h2><button class="modal-close" id="modal-close">×</button></div>' +
      tabsHtml +
      body +
    '</div>' +
  '</div>';

  document.getElementById('modal-overlay').onclick = function(e){ if(e.target.id==='modal-overlay') closeModal(); };
  document.getElementById('modal-close').onclick = closeModal;
  document.querySelectorAll('[data-mtab]').forEach(function(el){
    el.onclick = function(){
      if(el.disabled) return;
      modalTab = el.getAttribute('data-mtab');
      renderModal();
    };
  });

  if(modalTab==='manuell') attachManualListeners();
  if(modalTab==='csv') attachCsvListeners();
  if(modalTab==='scan') attachScanListeners();
}

function renderManualForm(){
  const rarityOptions = RARITIES.map(function(r){
    return '<option value="' + r + '" ' + (draft.rarity===r?'selected':'') + '>' + r + '</option>';
  }).join('');
  const conditionOptions = CONDITIONS.map(function(c){
    return '<option value="' + c + '" ' + (draft.condition===c?'selected':'') + '>' + c + '</option>';
  }).join('');
  const locationPool = locations.slice();
  if(draft.box && locationPool.indexOf(draft.box)===-1) locationPool.push(draft.box);
  const boxOptions = '<option value="">– kein Lagerort –</option>' + locationPool.map(function(loc){
    return '<option value="' + escapeAttr(loc) + '" ' + (draft.box===loc?'selected':'') + '>' + escapeHtml(loc) + '</option>';
  }).join('');

  return '' +
  '<div class="field"><label>Kartenname</label><input id="f-name" type="text" value="' + escapeAttr(draft.name) + '" placeholder="z.B. Blue-Eyes White Dragon"></div>' +
  '<div class="field-row">' +
    '<div class="field"><label>Set-Kürzel</label><input id="f-setcode" type="text" class="mono" value="' + escapeAttr(draft.setCode) + '" placeholder="LOB"></div>' +
    '<div class="field"><label>Kartennummer</label><input id="f-cardnumber" type="text" class="mono" value="' + escapeAttr(draft.cardNumber) + '" placeholder="DE001"></div>' +
  '</div>' +
  '<div class="field-row">' +
    '<div class="field"><label>Rarität</label><select id="f-rarity"><option value="">– wählen –</option>' + rarityOptions + '</select></div>' +
    '<div class="field"><label>Zustand</label><select id="f-condition"><option value="">– wählen –</option>' + conditionOptions + '</select></div>' +
  '</div>' +
  '<div class="field-row">' +
    '<div class="field"><label>Anzahl</label><input id="f-quantity" type="number" min="1" value="' + (draft.quantity||1) + '"></div>' +
    '<div class="field"><label>Geschätzter Wert (€/Stk.)</label><input id="f-value" type="number" min="0" step="0.01" value="' + escapeAttr(draft.value) + '"></div>' +
  '</div>' +
  '<div class="field"><button class="btn btn-secondary" id="btn-fetch-price" type="button">Preis suchen (YGOPRODeck/Cardmarket)</button>' +
    '<div id="price-status" class="hint" style="margin-top:6px;"></div>' +
  '</div>' +

  '<div class="field"><label>Deck-Thema / Archetyp</label><input id="f-archetype" type="text" value="' + escapeAttr(draft.archetype) + '" placeholder="z.B. Sky Striker"></div>' +
  '<div class="field"><button class="btn btn-secondary" id="btn-fetch-archetype" type="button">Archetyp ermitteln (YGOPRODeck)</button>' +
    '<div id="archetype-status" class="hint" style="margin-top:6px;"></div>' +
  '</div>' +

  '<div class="field"><label>Lagerort</label>' +
    '<div style="display:flex;gap:8px;">' +
      '<select id="f-box" style="flex:1;">' + boxOptions + '</select>' +
      '<button type="button" id="btn-manage-locations" class="btn btn-secondary" style="width:auto;padding:0 14px;">Verwalten</button>' +
    '</div>' +
  '</div>' +

  '<div class="field"><label>Verliehen</label></div>' +
  '<div class="toggle-row">' +
    '<button id="f-lent-no" class="' + (!draft.isLent?'active':'') + '">Nein</button>' +
    '<button id="f-lent-yes" class="' + (draft.isLent?'active':'') + '">Ja</button>' +
  '</div>' +
  '<div id="lent-fields" style="' + (draft.isLent?'':'display:none') + '">' +
    '<div class="field-row">' +
      '<div class="field"><label>Verliehen an</label><input id="f-lentto" type="text" value="' + escapeAttr(draft.lentTo) + '"></div>' +
      '<div class="field"><label>Seit</label><input id="f-lentsince" type="date" value="' + escapeAttr(draft.lentSince) + '"></div>' +
    '</div>' +
  '</div>' +

  '<div class="field"><label>Verkaufsstatus</label></div>' +
  '<div class="toggle-row">' +
    '<button id="f-sale-frei" class="' + (draft.saleStatus==='frei'?'active':'') + '">Frei</button>' +
    '<button id="f-sale-verkaufen" class="' + (draft.saleStatus==='verkaufen'?'active':'') + '">Soll verkauft werden</button>' +
    '<button id="f-sale-verkauft" class="' + (draft.saleStatus==='verkauft'?'active':'') + '">Verkauft</button>' +
  '</div>' +
  '<div class="field" id="saleprice-field" style="' + (draft.saleStatus!=='frei'?'':'display:none') + '">' +
    '<label>Verkaufspreis (€)</label><input id="f-saleprice" type="number" min="0" step="0.01" value="' + escapeAttr(draft.salePrice) + '">' +
  '</div>' +

  renderFormActions();
}

function renderFormActions(){
  if(duplicateMatch !== null && cards[duplicateMatch]){
    const existing = cards[duplicateMatch];
    return '' +
    '<div class="hint" style="color:var(--gold-bright);font-size:13px;">Diese Karte gibt es schon: ' + (existing.quantity||1) + '× im Lagerort "' + escapeHtml(existing.box||'kein Lagerort') + '". Was möchtest du tun?</div>' +
    '<div class="btn-row">' +
      '<button class="btn btn-secondary" id="btn-dup-cancel" type="button">Zurück</button>' +
      '<button class="btn btn-primary" id="btn-dup-merge" type="button">Anzahl erhöhen</button>' +
    '</div>' +
    '<button class="btn btn-secondary" id="btn-dup-forcenew" type="button" style="margin-top:8px;">Trotzdem als neuen Eintrag anlegen</button>';
  }
  if(editingId){
    return '' +
    '<div class="btn-row">' +
      '<button class="btn btn-danger" id="btn-delete" type="button">Löschen</button>' +
      '<button class="btn btn-primary" id="btn-save" type="button">Speichern</button>' +
    '</div>';
  }
  return '' +
  '<div class="btn-row">' +
    '<button class="btn btn-secondary" id="btn-done" type="button">Fertig</button>' +
    '<button class="btn btn-primary" id="btn-save" type="button">Hinzufügen</button>' +
  '</div>';
}

function attachManualListeners(){
  const ids = ['f-name','f-setcode','f-cardnumber','f-rarity','f-condition','f-quantity','f-value','f-archetype','f-box','f-lentto','f-lentsince','f-saleprice'];
  ids.forEach(function(id){
    const el = document.getElementById(id);
    if(el){ el.oninput = function(){ syncDraftField(id, el.value); }; }
  });

  document.getElementById('f-lent-no').onclick = function(){ draft.isLent=false; renderModal(); };
  document.getElementById('f-lent-yes').onclick = function(){ draft.isLent=true; renderModal(); };

  document.getElementById('f-sale-frei').onclick = function(){ draft.saleStatus='frei'; renderModal(); };
  document.getElementById('f-sale-verkaufen').onclick = function(){ draft.saleStatus='verkaufen'; renderModal(); };
  document.getElementById('f-sale-verkauft').onclick = function(){ draft.saleStatus='verkauft'; renderModal(); };

  const saveBtn = document.getElementById('btn-save');
  if(saveBtn){ saveBtn.onclick = function(){ saveDraft(false); }; }
  const delBtn = document.getElementById('btn-delete');
  if(delBtn){ delBtn.onclick = deleteCurrentCard; }
  const doneBtn = document.getElementById('btn-done');
  if(doneBtn){ doneBtn.onclick = closeModal; }
  const dupCancel = document.getElementById('btn-dup-cancel');
  if(dupCancel){ dupCancel.onclick = function(){ duplicateMatch = null; renderModal(); }; }
  const dupMerge = document.getElementById('btn-dup-merge');
  if(dupMerge){ dupMerge.onclick = mergeDuplicateAndContinue; }
  const dupForceNew = document.getElementById('btn-dup-forcenew');
  if(dupForceNew){ dupForceNew.onclick = function(){ saveDraft(true); }; }
  const priceBtn = document.getElementById('btn-fetch-price');
  if(priceBtn){ priceBtn.onclick = fetchCardmarketPrice; }
  const archBtn = document.getElementById('btn-fetch-archetype');
  if(archBtn){ archBtn.onclick = fetchArchetype; }
  const locBtn = document.getElementById('btn-manage-locations');
  if(locBtn){ locBtn.onclick = openLocManager; }
}
function syncDraftField(id, value){
  const map = {
    'f-name':'name','f-setcode':'setCode','f-cardnumber':'cardNumber','f-rarity':'rarity',
    'f-condition':'condition','f-quantity':'quantity','f-value':'value','f-archetype':'archetype','f-box':'box',
    'f-lentto':'lentTo','f-lentsince':'lentSince','f-saleprice':'salePrice'
  };
  const key = map[id];
  if(key) draft[key] = value;
}

function findDuplicateIndex(){
  const name = draft.name.trim().toLowerCase();
  const set = (draft.setCode||'').trim().toLowerCase();
  const num = (draft.cardNumber||'').trim().toLowerCase();
  for(let i=0;i<cards.length;i++){
    const c = cards[i];
    if((c.name||'').trim().toLowerCase()===name &&
       (c.setCode||'').trim().toLowerCase()===set &&
       (c.cardNumber||'').trim().toLowerCase()===num){
      return i;
    }
  }
  return -1;
}

async function mergeDuplicateAndContinue(){
  const existing = cards[duplicateMatch];
  if(!existing){ duplicateMatch = null; renderModal(); return; }
  existing.quantity = (parseInt(existing.quantity)||1) + (parseInt(draft.quantity)||1);
  const ok = await persist(existing.id);
  duplicateMatch = null;
  render();
  draft = emptyDraft();
  renderModal();
  showToast(ok ? 'Anzahl erhöht — nächste Karte?' : 'Aktualisiert im Browser, Sync fehlgeschlagen — bitte erneut versuchen');
  const nameInput = document.getElementById('f-name');
  if(nameInput) nameInput.focus();
}

async function saveDraft(forceNew){
  if(!draft.name || !draft.name.trim()){
    showToast('Bitte einen Kartennamen eingeben');
    return;
  }
  if(!editingId && !forceNew){
    const dupIdx = findDuplicateIndex();
    if(dupIdx !== -1){
      duplicateMatch = dupIdx;
      renderModal();
      return;
    }
  }
  let savedId;
  if(editingId){
    const idx = cards.findIndex(function(c){ return c.id===editingId; });
    if(idx!==-1) cards[idx] = Object.assign({}, draft, {id: editingId});
    savedId = editingId;
  } else {
    const newCard = Object.assign({}, draft, {id: uid()});
    cards.push(newCard);
    savedId = newCard.id;
  }
  const ok = await persist(savedId);
  duplicateMatch = null;

  if(editingId){
    closeModal();
    render();
    showToast(ok ? 'Karte aktualisiert' : 'Gespeichert im Browser, aber Sync fehlgeschlagen — bitte Seite nicht schließen und nochmal versuchen');
  } else {
    render();
    draft = emptyDraft();
    renderModal();
    showToast(ok ? 'Karte hinzugefügt — nächste Karte?' : 'Gespeichert im Browser, aber Sync fehlgeschlagen — bitte erneut versuchen');
    const nameInput = document.getElementById('f-name');
    if(nameInput) nameInput.focus();
  }
}

async function deleteCurrentCard(){
  const idToDelete = editingId;
  cards = cards.filter(function(c){ return c.id!==idToDelete; });
  await DataLayer.deleteCard(idToDelete);
  closeModal();
  render();
  showToast('Karte gelöscht');
}

/* ----- CSV Import ----- */
