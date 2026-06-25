function renderScanForm(){
  let preview = '';
  if(scanImagePreview){
    preview = '<img class="scan-preview" src="' + scanImagePreview + '">';
  }

  let status = '';
  if(scanBusy){
    status = '<div class="scan-status">' + escapeHtml(scanProgress || 'Karte wird gelesen…') + '</div>';
  } else if(scanResult){
    status = '<div class="scan-status">Übernommen — Set-Kürzel, Nummer & Rarität bitte direkt von der Karte ablesen.</div>';
  } else if(scanCandidates.length > 1){
    status = '<div class="scan-status">Mehrere mögliche Treffer — bitte auswählen:</div>';
  } else if(scanAttempted){
    status = '<div class="scan-status">Keine passende Karte gefunden. Bitte manuell eintragen oder ein schärferes Foto versuchen.</div>';
  }

  let candidateList = '';
  if(scanCandidates.length > 1 && !scanResult){
    candidateList = '<div class="scan-candidates">' + scanCandidates.map(function(c, idx){
      return '<button type="button" class="scan-candidate-btn" data-candidate="' + idx + '">' + escapeHtml(c.name) + '</button>';
    }).join('') + '</div>';
  }

  let confirmForm = '';
  if(scanResult){
    confirmForm = '' +
    '<div class="field"><label>Kartenname</label><input id="s-name" type="text" value="' + escapeAttr(scanResult.name) + '"></div>' +
    '<div class="field-row">' +
      '<div class="field"><label>Set-Kürzel</label><input id="s-setcode" type="text" class="mono" placeholder="von der Karte ablesen"></div>' +
      '<div class="field"><label>Kartennummer</label><input id="s-cardnumber" type="text" class="mono" placeholder="von der Karte ablesen"></div>' +
    '</div>' +
    '<div class="field"><label>Rarität</label><input id="s-rarity" type="text" placeholder="von der Karte ablesen"></div>' +
    '<button class="btn btn-primary" id="btn-scan-confirm" type="button">Übernehmen & weiter ausfüllen</button>';
  }

  return '' +
  '<div class="scan-drop" id="scan-drop">' +
    (preview || 'Foto einer Karte aufnehmen oder auswählen') +
    '<input type="file" id="scan-input" accept="image/*" capture="environment" style="display:none">' +
  '</div>' +
  '<div class="hint">Kostenlose Texterkennung im Browser (kein Account nötig) — funktioniert am besten bei scharfen, gut beleuchteten Fotos ohne Spiegelung. Set-Kürzel/Nummer/Rarität lassen sich daraus nicht zuverlässig auslesen, bitte von Hand ergänzen.</div>' +
  status +
  candidateList +
  confirmForm;
}

function attachScanListeners(){
  const drop = document.getElementById('scan-drop');
  const input = document.getElementById('scan-input');
  drop.onclick = function(){ input.click(); };
  input.onchange = function(){
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async function(){
      scanImagePreview = reader.result;
      scanBusy = true;
      scanResult = null;
      scanCandidates = [];
      scanAttempted = false;
      scanProgress = 'Text wird erkannt…';
      renderModal();
      await runOcrScan(reader.result);
      scanBusy = false;
      scanAttempted = true;
      renderModal();
    };
    reader.readAsDataURL(file);
  };
  document.querySelectorAll('[data-candidate]').forEach(function(el){
    el.onclick = function(){
      const idx = parseInt(el.getAttribute('data-candidate'), 10);
      const chosen = scanCandidates[idx];
      if(chosen){
        scanResult = { name: chosen.name, archetype: chosen.archetype || '' };
        renderModal();
      }
    };
  });
  const confirmBtn = document.getElementById('btn-scan-confirm');
  if(confirmBtn){
    confirmBtn.onclick = function(){
      draft = Object.assign(emptyDraft(), {
        name: document.getElementById('s-name').value,
        setCode: document.getElementById('s-setcode').value,
        cardNumber: document.getElementById('s-cardnumber').value,
        rarity: document.getElementById('s-rarity').value,
        archetype: (scanResult && scanResult.archetype) ? scanResult.archetype : ''
      });
      modalTab = 'manuell';
      renderModal();
    };
  }
}

async function runOcrScan(imageDataUrl){
  try{
    const result = await Tesseract.recognize(imageDataUrl, 'eng+deu', {
      logger: function(m){
        if(m.status === 'recognizing text'){
          scanProgress = 'Text wird erkannt… ' + Math.round((m.progress || 0) * 100) + '%';
        }
      }
    });
    const text = (result && result.data && result.data.text) ? result.data.text : '';
    const guess = guessCardNameFromOcrText(text);
    if(!guess){ scanCandidates = []; return; }
    scanProgress = 'Suche Karte: "' + guess + '"…';
    const matches = await lookupCardsByFuzzyName(guess);
    if(matches.length === 1){
      scanResult = { name: matches[0].name, archetype: matches[0].archetype || '' };
      scanCandidates = [];
    } else if(matches.length > 1){
      scanCandidates = matches.slice(0, 8);
    } else {
      scanCandidates = [];
    }
  } catch(e){
    console.error('OCR-Fehler', e);
    scanCandidates = [];
  }
}

function guessCardNameFromOcrText(text){
  const lines = text.split(/\r?\n/)
    .map(function(l){ return l.trim(); })
    .filter(function(l){ return l.length >= 3 && l.length <= 40; });
  if(lines.length === 0) return '';
  const candidates = lines.slice(0, 3).slice();
  candidates.sort(function(a,b){ return b.length - a.length; });
  return candidates[0].replace(/[^\p{L}\p{N}\s\-'!.,:]/gu, '').trim();
}

async function lookupCardsByFuzzyName(text){
  async function tryUrl(url){
    try{
      const res = await fetch(url);
      const raw = await res.text();
      let data;
      try{ data = JSON.parse(raw); } catch(e){ return []; }
      if(!data || !Array.isArray(data.data)) return [];
      return data.data;
    } catch(e){
      return [];
    }
  }
  const deUrl = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=' + encodeURIComponent(text) + '&language=de';
  let matches = await tryUrl(deUrl);
  if(matches.length === 0){
    const enUrl = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=' + encodeURIComponent(text);
    matches = await tryUrl(enUrl);
  }
  return matches;
}
