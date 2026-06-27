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
      '<button class="btn btn-secondary" id="settings-locations" type="button" style="margin-bottom:10px;">📦 Lagerorte verwalten</button>' +
      '<button class="btn btn-secondary" id="settings-selection" type="button" style="margin-bottom:10px;">🗑️ Mehrere Karten auswählen &amp; löschen</button>' +
      '<button class="btn btn-secondary" id="settings-backup-export" type="button" style="margin-bottom:10px;">⤓ Sammlung sichern (JSON)</button>' +
      '<button class="btn btn-secondary" id="settings-backup-import" type="button">⤒ Sicherung wiederherstellen</button>' +
      '<input type="file" id="settings-backup-file" accept="application/json" style="display:none">' +
      '<div class="hint" style="margin-top:12px;">Backup speichert deine komplette Sammlung als Datei — gut für den Notfall, falls mal was schiefgeht.</div>' +
    '</div>' +
  '</div>';

  document.getElementById('settingsmodal-overlay').onclick = function(e){ if(e.target.id==='settingsmodal-overlay') closeSettingsMenu(); };
  document.getElementById('settingsmodal-close').onclick = closeSettingsMenu;
  document.getElementById('settings-locations').onclick = function(){ closeSettingsMenu(); openLocManager(); };
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
      // Bewusster Komplett-Restore: hier ist das Senden der vollen Sammlung beabsichtigt.
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
