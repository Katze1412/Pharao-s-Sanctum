/* ============================================================
   BACKUP — Export und Import der Sammlung als JSON
   ============================================================ */
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
