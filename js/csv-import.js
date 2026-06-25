function renderCsvImport(){
  return '' +
  '<div class="hint">Erwartete Spalten (Komma-getrennt, erste Zeile = Überschrift):<br>name, setCode, cardNumber, rarity, condition, quantity, value, archetype, box</div>' +
  '<div class="field"><textarea id="csv-text" class="csv-input" placeholder="name,setCode,cardNumber,rarity,condition,quantity,value,archetype,box\nDark Magician,LOB,DE005,Ultra Rare,Sehr gut,1,12.50,,Box 1"></textarea></div>' +
  '<button class="btn btn-primary" id="btn-csv-import">Importieren</button>' +
  '<div id="csv-status" class="scan-status"></div>';
}

function attachCsvListeners(){
  document.getElementById('btn-csv-import').onclick = async function(){
    const text = document.getElementById('csv-text').value.trim();
    if(!text){ showToast('Bitte CSV-Text einfügen'); return; }
    const result = parseCsv(text);
    if(result.rows.length===0){ document.getElementById('csv-status').textContent = 'Keine gültigen Zeilen gefunden.'; return; }
    result.rows.forEach(function(row){
      cards.push(Object.assign(emptyDraft(), row, {id: uid()}));
    });
    await persist();
    document.getElementById('csv-status').textContent = result.rows.length + ' Karte(n) importiert.';
    render();
    setTimeout(closeModal, 700);
  };
}

function parseCsv(text){
  const lines = text.split(/\r?\n/).filter(function(l){ return l.trim().length>0; });
  if(lines.length<2) return {rows:[]};
  const headers = lines[0].split(',').map(function(h){ return h.trim().toLowerCase(); });
  const fieldMap = {
    name:'name', setcode:'setCode', 'set-kürzel':'setCode', set:'setCode',
    cardnumber:'cardNumber', kartennummer:'cardNumber', nummer:'cardNumber',
    rarity:'rarity', rarität:'rarity', condition:'condition', zustand:'condition',
    quantity:'quantity', anzahl:'quantity', value:'value', wert:'value',
    box:'box', folder:'box', ordner:'box', lagerort:'box',
    archetype:'archetype', archetyp:'archetype', deckthema:'archetype', thema:'archetype'
  };
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cells = lines[i].split(',').map(function(c){ return c.trim(); });
    const row = {};
    headers.forEach(function(h, idx){
      const key = fieldMap[h];
      if(key) row[key] = cells[idx] || '';
    });
    if(row.name) rows.push(row);
  }
  return {rows: rows};
}

/* ----- Foto-Scan ----- */
