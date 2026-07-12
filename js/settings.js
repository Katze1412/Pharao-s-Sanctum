/* ============================================================
   EINSTELLUNGEN — Zahnrad-Menü: Lagerorte, Backup-Export/Import
   ============================================================ */
function openSettingsMenu(){
  settingsMenuOpen = true;
  renderSettingsMenu();
}

function closeSettingsMenu(){
  settingsMenuOpen = false;
  renderSettingsMenu();
}

function renderSettingsMenu(){
  const root = document.getElementById('settingsmodal-root');
  if(!root) return;
  if(!settingsMenuOpen){ root.innerHTML = ''; return; }

  root.innerHTML = '' +
  '<div class="modal-overlay" id="settingsmodal-overlay" style="z-index:70;">' +
    '<div class="modal" style="max-width:380px;">' +
      '<div class="modal-head"><h2>Einstellungen</h2><button class="modal-close" id="settingsmodal-close">×</button></div>' +
      '<button class="btn btn-secondary" id="settings-batch-archetype" type="button" style="margin-bottom:10px;">🔍 Alle Archetypen automatisch ermitteln</button>' +
      '<div id="batch-archetype-status" style="display:none;margin-bottom:10px;">' +
        '<div class="hint" id="batch-archetype-text"></div>' +
        '<div style="background:var(--border);border-radius:4px;height:8px;margin-top:6px;overflow:hidden;">' +
          '<div id="batch-archetype-bar" style="height:8px;background:linear-gradient(90deg,var(--gold),var(--gold-bright));border-radius:4px;width:0%;transition:width .3s;"></div>' +
        '</div>' +
      '</div>' +
      '<button class="btn btn-secondary" id="settings-locations" type="button" style="margin-bottom:10px;">📦 Lagerorte verwalten</button>' +
      '<div class="field" style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
        '<span style="flex:1;font-size:13px;">Als "lange verliehen" markieren nach</span>' +
        '<input id="lent-threshold-input" type="number" min="1" value="' + settings.lentWarningDays + '" style="width:56px;background:var(--panel);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 6px;text-align:center;">' +
        '<span style="font-size:13px;">Tagen</span>' +
      '</div>' +
      '<button class="btn btn-secondary" id="settings-selection" type="button" style="margin-bottom:10px;">🗑️ Mehrere Karten auswählen &amp; löschen</button>' +
      '<button class="btn btn-secondary" id="settings-backup-export" type="button" style="margin-bottom:10px;">⤓ Sammlung sichern (JSON)</button>' +
      '<button class="btn btn-secondary" id="settings-backup-import" type="button">⤒ Sicherung wiederherstellen</button>' +
      '<input type="file" id="settings-backup-file" accept="application/json" style="display:none">' +
      '<div class="hint" style="margin-top:12px;">Backup speichert deine komplette Sammlung als Datei — gut für den Notfall, falls mal was schiefgeht.</div>' +
    '</div>' +
  '</div>';

  document.getElementById('settingsmodal-overlay').onclick = function(e){ if(e.target.id==='settingsmodal-overlay') closeSettingsMenu(); };
  document.getElementById('settingsmodal-close').onclick = closeSettingsMenu;
  const batchArchetypeBtn = document.getElementById('settings-batch-archetype');
  const batchStatus = document.getElementById('batch-archetype-status');
      const batchText = document.getElementById('batch-archetype-text');
      const batchBar = document.getElementById('batch-archetype-bar');
      if(batchArchetypeBtn){
        batchArchetypeBtn.onclick = async function(){
          if(!window.confirm('Archetypen für alle ' + cards.length + ' Karten automatisch ermitteln?\n\nDas dauert ca. ' + Math.ceil(cards.length * 0.3 / 60) + ' Minuten. Bitte die App offen lassen.')) return;
          batchArchetypeBtn.disabled = true;
          batchStatus.style.display = '';
          batchText.textContent = 'Starte…';
          batchBar.style.width = '0%';
          const result = await batchFetchArchetypes(function(current, total, updated){
            const pct = Math.round(current/total*100);
            batchBar.style.width = pct + '%';
            batchText.textContent = current + ' / ' + total + ' verarbeitet, ' + updated + ' aktualisiert…';
          });
          batchBar.style.width = '100%';
          batchArchetypeBtn.disabled = false;
          batchText.textContent = '✅ Fertig!';
          render();
          // Ergebnis-Modal öffnen falls Karten ohne Archetyp übrig sind
          const missing = cards.filter(function(c){ return !c.archetype || !c.archetype.trim(); });
          if(missing.length > 0){
            openMissingArchetypeModal(missing, result);
          } else {
            showToast(result.updated + ' Archetypen aktualisiert – alle Karten haben jetzt einen Archetyp! 🎉');
          }
        };
      }

  document.getElementById('settings-locations').onclick = function(){ closeSettingsMenu(); openLocManager(); };

  const lentThresholdInput = document.getElementById('lent-threshold-input');
  if(lentThresholdInput){
    lentThresholdInput.onchange = function(e){
      const val = parseInt(e.target.value, 10);
      settings.lentWarningDays = (isNaN(val) || val < 1) ? 1 : val;
      DataLayer.saveSettings(settings);
      render();
    };
  }
  document.getElementById('settings-selection').onclick = function(){
    closeSettingsMenu();
    selectionMode = true;
    selectedIds.clear();
    currentTab = 'sammlung';
    render();
  };
  document.getElementById('settings-backup-export').onclick = exportBackup;

  const importBtn = document.getElementById('settings-backup-import');
  const importInput = document.getElementById('settings-backup-file');
  importBtn.onclick = function(){ importInput.click(); };
  importInput.onchange = function(){
    const file = importInput.files[0];
    if(file) importBackup(file);
  };
}


function openMissingArchetypeModal(missing, result){
  closeSettingsMenu();
  const root = document.getElementById('modal-root');
  if(!root) return;

  const listHtml = missing.slice(0,200).map(function(c){
    return '<div class="card-row" style="cursor:pointer;" data-edit="' + c.id + '">' +
      '<div class="info">' +
        '<div class="name">' + escapeHtml(c.name||'(ohne Namen)') + '</div>' +
        '<div class="meta">' + escapeHtml(c.setCode||'') + (c.cardNumber?' · '+escapeHtml(c.cardNumber):'') + '</div>' +
      '</div>' +
      '<div style="color:var(--gold-bright);font-size:12px;flex-shrink:0;">✏️ Nachtragen</div>' +
    '</div>';
  }).join('');

  const mehr = missing.length > 200 ? '<div class="hint" style="margin-top:8px;">+ ' + (missing.length-200) + ' weitere – nutze den Filter "Ohne Archetyp" in der Sammlung.</div>' : '';

  root.innerHTML = '' +
  '<div class="modal-overlay" id="missing-arch-overlay" style="z-index:60;">' +
    '<div class="modal" style="max-width:480px;max-height:80vh;display:flex;flex-direction:column;">' +
      '<div class="modal-head">' +
        '<h2>⚠️ Karten ohne Archetyp (' + missing.length + ')</h2>' +
        '<button class="modal-close" id="missing-arch-close" title="Schließen und Filter aktivieren">×</button>' +
      '</div>' +
      '<div class="hint" style="margin-bottom:10px;">' + (result ? result.updated + ' aktualisiert · ' : '') + missing.length + ' noch offen · Karte anklicken zum Nachtragen</div>' +
      '<div style="overflow-y:auto;flex:1;">' + listHtml + mehr + '</div>' +
    '</div>' +
  '</div>';

  document.getElementById('missing-arch-close').onclick = function(){
    root.innerHTML = '';
    filterNoArchetype = true;
    render();
  };

  root.querySelectorAll('[data-edit]').forEach(function(el){
    el.onclick = function(){
      const id = el.getAttribute('data-edit');
      root.innerHTML = '';
      openModalForEdit(id);
      window.__afterEditCallback = function(){
        const stillMissing = cards.filter(function(c){ return !c.archetype || !c.archetype.trim(); });
        if(stillMissing.length > 0){
          openMissingArchetypeModal(stillMissing, null);
        } else {
          filterNoArchetype = false;
          render();
        }
      };
    };
  });
}

function exportBackup(){
  const payload = { cards: cards, locations: locations, settings: settings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ygo-kartenarchiv-backup-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Sicherung wird heruntergeladen');
}

function importBackup(file){
  const reader = new FileReader();
  reader.onload = async function(){
    try{
      const parsed = JSON.parse(reader.result);
      if(Array.isArray(parsed)){
        cards = parsed;
      } else if(parsed && Array.isArray(parsed.cards)){
        cards = parsed.cards;
        if(Array.isArray(parsed.locations)) locations = parsed.locations;
        if(parsed.settings && typeof parsed.settings.lentWarningDays === 'number') settings = parsed.settings;
      } else {
        throw new Error('unbekanntes Format');
      }
      const ok1 = await persist();
      const ok2 = await DataLayer.saveLocations(locations);
      const ok3 = await DataLayer.saveSettings(settings);
      closeSettingsMenu();
      render();
      showToast((ok1 && ok2 && ok3) ? 'Sicherung wiederhergestellt' : 'Wiederherstellt im Browser, Sync teilweise fehlgeschlagen — bitte erneut versuchen');
    } catch(e){
      console.error('Wiederherstellung fehlgeschlagen', e);
      showToast('Datei konnte nicht gelesen werden — ist es eine gültige Sicherung?');
    }
  };
  reader.readAsText(file);
}
