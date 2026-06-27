let pendingCsvRows = null;
let pendingCsvFileName = '';

function renderCsvImport(){
  return '' +
  '<div class="hint">Erwartete Spalten (Komma-getrennt, erste Zeile = Überschrift):<br>name, setCode, cardNumber, rarity, condition, quantity, value, archetype, box</div>' +
  '<div class="field">' +
    '<button type="button" class="btn btn-secondary" id="btn-csv-file">📁 CSV-Datei auswählen</button>' +
    '<input type="file" id="csv-file-input" accept=".csv,text/csv,text/plain" style="display:none">' +
  '</div>' +
  '<div class="hint" style="margin-top:-4px;">Oder Text direkt einfügen (für kleinere Mengen):</div>' +
  '<div class="field"><textarea id="csv-text" class="csv-input" placeholder="name,setCode,cardNumber,rarity,condition,quantity,value,archetype,box\nDark Magician,LOB,DE005,Ultra Rare,Sehr gut,1,12.50,,Box 1"></textarea></div>' +
  '<button class="btn btn-primary" id="btn-csv-import">Importieren</button>' +
  '<div id="csv-status" class="scan-status"></div>';
}

function attachCsvListeners(){
  const fileBtn = document.getElementById('btn-csv-file');
  const fileInput = document.getElementById('csv-file-input');
  const textArea = document.getElementById('csv-text');
  const statusEl = document.getElementById('csv-status');

  if(fileBtn && fileInput){
    fileBtn.onclick = function(){ fileInput.click(); };
    fileInput.onchange = function(){
      const file = fileInput.files[0];
      if(!file) return;
      statusEl.textContent = 'Lese "' + file.name + '" …';
      const reader = new FileReader();
      reader.onload = function(){
        const result = parseCsv(reader.result);
        if(result.rows.length===0){
          statusEl.textContent = 'Keine gültigen Zeilen in der Datei gefunden.';
          pendingCsvRows = null;
          return;
        }
        pendingCsvRows = result.rows;
        pendingCsvFileName = file.name;
        textArea.value = '';
        textArea.placeholder = '📁 "' + file.name + '" geladen — Textfeld wird ignoriert, solange eine Datei ausgewählt ist.';
        statusEl.textContent = pendingCsvRows.length + ' Karte(n) aus "' + file.name + '" bereit. Klicke auf Importieren.';
      };
      reader.onerror = function(){
        showToast('Datei konnte nicht gelesen werden');
        pendingCsvRows = null;
      };
      reader.readAsText(file, 'utf-8');
    };
  }

  if(textArea){
    textArea.oninput = function(){
      // Manuelle Eingabe hat Vorrang — vorherige Datei-Auswahl verwerfen
      pendingCsvRows = null;
      textArea.placeholder = 'name,setCode,cardNumber,rarity,condition,quantity,value,archetype,box\nDark Magician,LOB,DE005,Ultra Rare,Sehr gut,1,12.50,,Box 1';
    };
  }

  document.getElementById('btn-csv-import').onclick = async function(){
    let rows;
    let sourceLabel;
    if(pendingCsvRows && pendingCsvRows.length>0){
      rows = pendingCsvRows;
      sourceLabel = pendingCsvFileName;
    } else {
      const text = document.getElementById('csv-text').value.trim();
      if(!text){ showToast('Bitte eine CSV-Datei auswählen oder Text einfügen'); return; }
      rows = parseCsv(text).rows;
      sourceLabel = 'Texteingabe';
    }
    if(rows.length===0){ document.getElementById('csv-status').textContent = 'Keine gültigen Zeilen gefunden.'; return; }
    const newIds = [];
    rows.forEach(function(row){
      const card = Object.assign(emptyDraft(), row, {id: uid()});
      cards.push(card);
      newIds.push(card.id);
    });
    await persist(newIds);
    document.getElementById('csv-status').textContent = rows.length + ' Karte(n) aus ' + sourceLabel + ' importiert.';
    pendingCsvRows = null;
    pendingCsvFileName = '';
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
