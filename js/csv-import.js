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
        const buffer = reader.result;
        let text = new TextDecoder('utf-8').decode(buffer);
        // Mojibake-Heuristik: Datei war wahrscheinlich Windows-1252 (typisch bei deutschen Excel-Tools wie Cardcluster)
        if(/Ã¤|Ã¶|Ã¼|Ã„|Ã–|ÃŸ/.test(text)){
          text = new TextDecoder('windows-1252').decode(buffer);
        }
        const result = parseCsv(text);
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
      reader.readAsArrayBuffer(file);
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
    let newLocationsAdded = 0;
    rows.forEach(function(row){
      const card = Object.assign(emptyDraft(), row, {id: uid()});
      cards.push(card);
      newIds.push(card.id);
      if(card.box && locations.indexOf(card.box)===-1){
        locations.push(card.box);
        newLocationsAdded++;
      }
    });
    await persist(newIds);
    if(newLocationsAdded>0){
      await DataLayer.saveLocations(locations);
    }
    document.getElementById('csv-status').textContent = rows.length + ' Karte(n) aus ' + sourceLabel + ' importiert' + (newLocationsAdded>0 ? (' (' + newLocationsAdded + ' neue Lagerort(e) angelegt)') : '') + '.';
    pendingCsvRows = null;
    pendingCsvFileName = '';
    render();
    setTimeout(closeModal, 700);
  };
}

function splitCsvLine(line){
  const result = [];
  let cur = '';
  let inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(inQuotes){
      if(ch === '"'){
        if(line[i+1] === '"'){ cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if(ch === '"'){ inQuotes = true; }
      else if(ch === ','){ result.push(cur); cur=''; }
      else { cur += ch; }
    }
  }
  result.push(cur);
  return result.map(function(c){ return c.trim(); });
}

function splitSetCodeAndNumber(raw){
  if(!raw) return { setCode:'', cardNumber:'' };
  const s = raw.trim();
  // Bekanntes YGO-Muster: SETCODE + Sprachkürzel + Nummer, mit oder ohne Trenner (z.B. "DABL-DE030", "LOB DE005", "SDYEN006")
  let m = s.match(/^(.+?)[\s-]?(DE|EN|FR|IT|SP|PT|JP|KR|AE|TC|SC)(\d{2,4}[A-Za-z]?)$/i);
  if(m){
    return { setCode: m[1].toUpperCase(), cardNumber: (m[2]+m[3]).toUpperCase() };
  }
  // Generischer Fallback: nur bei eindeutigem Trenner trennen (z.B. "ABC-123")
  m = s.match(/^([A-Za-z0-9]{2,8})[\s-]+(.+)$/);
  if(m){
    return { setCode: m[1].toUpperCase(), cardNumber: m[2].toUpperCase() };
  }
  // Kein Trenner erkennbar — unverändert lassen, um nicht falsch zu raten
  return { setCode: s, cardNumber: '' };
}

function parseCsv(text){
  const lines = text.split(/\r?\n/).filter(function(l){ return l.trim().length>0; });
  if(lines.length<2) return {rows:[]};
  const headers = splitCsvLine(lines[0]).map(function(h){ return h.toLowerCase(); });
  const fieldMap = {
    name:'name', setcode:'setCode', 'set-kürzel':'setCode', set:'setCode',
    cardnumber:'cardNumber', kartennummer:'cardNumber', nummer:'cardNumber',
    rarity:'rarity', 'rarität':'rarity', condition:'condition', zustand:'condition',
    quantity:'quantity', anzahl:'quantity', haves:'quantity',
    value:'value', wert:'value', einkaufspreis:'value',
    box:'box', folder:'box', ordner:'box', lagerort:'box', 'einsortiert in':'box',
    archetype:'archetype', archetyp:'archetype', deckthema:'archetype', thema:'archetype'
  };
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cells = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach(function(h, idx){
      const key = fieldMap[h];
      if(key) row[key] = cells[idx] || '';
    });
    if(row.condition && CONDITION_NUMBER_MAP[row.condition.trim()]){
      row.condition = CONDITION_NUMBER_MAP[row.condition.trim()];
    }
    if(row.setCode && !row.cardNumber){
      const split = splitSetCodeAndNumber(row.setCode);
      row.setCode = split.setCode;
      row.cardNumber = split.cardNumber;
    }
    if(row.name) rows.push(row);
  }
  return {rows: rows};
}

/* ----- Foto-Scan ----- */
