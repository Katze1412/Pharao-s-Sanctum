/* ============================================================
   OFFLINE-DATA — Snapshot, Notiz-Persistenz, Online/Offline-Erkennung
   ============================================================ */
const OFFLINE_SNAPSHOT_KEY = 'ygo_offline_snapshot';
const OFFLINE_NOTE_KEY = 'ygo_offline_note';

function saveOfflineSnapshot(){
  try{
    const payload = { cards: cards, locations: locations, settings: settings, savedAt: new Date().toISOString() };
    localStorage.setItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify(payload));
  } catch(e){
    console.error('Snapshot konnte nicht gespeichert werden', e);
  }
}

function loadOfflineSnapshot(){
  try{
    const raw = localStorage.getItem(OFFLINE_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e){
    return null;
  }
}

function saveOfflineNote(text){
  const trimmed = text ? text.trim() : '';
  settings.offlineNoteText = trimmed;
  settings.offlineNoteSavedAt = trimmed ? new Date().toISOString() : null;
  try{
    if(trimmed){
      localStorage.setItem(OFFLINE_NOTE_KEY, JSON.stringify({ text: trimmed, savedAt: settings.offlineNoteSavedAt }));
    } else {
      localStorage.removeItem(OFFLINE_NOTE_KEY);
    }
  } catch(e){
    console.error('Notiz-Puffer konnte nicht gespeichert werden', e);
  }
  if(!isOffline && currentUserId){
    DataLayer.saveSettings(settings);
  }
}

function loadOfflineNote(){
  if(settings.offlineNoteText){
    return { text: settings.offlineNoteText, savedAt: settings.offlineNoteSavedAt };
  }
  return null;
}

function clearOfflineNote(){
  settings.offlineNoteText = '';
  settings.offlineNoteSavedAt = null;
  try{ localStorage.removeItem(OFFLINE_NOTE_KEY); } catch(e){}
  if(!isOffline && currentUserId){
    DataLayer.saveSettings(settings);
  }
}

function initOfflineHandling(){
  window.addEventListener('offline', handleGoOffline);
  window.addEventListener('online', handleGoOnline);
  if(!navigator.onLine){
    handleGoOffline();
  }
}

function handleGoOffline(){
  if(isOffline) return;
  isOffline = true;
  const snap = loadOfflineSnapshot();
  if(snap){
    cards = snap.cards || [];
    locations = snap.locations || [];
    if(snap.settings) settings = snap.settings;
  }
  try{
    const raw = localStorage.getItem(OFFLINE_NOTE_KEY);
    if(raw){
      const pending = JSON.parse(raw);
      if(pending && pending.text){
        settings.offlineNoteText = pending.text;
        settings.offlineNoteSavedAt = pending.savedAt;
      }
    }
  } catch(e){}
  render();
}

async function handleGoOnline(){
  if(!isOffline) return;
  isOffline = false;
  let pendingNote = null;
  try{
    const raw = localStorage.getItem(OFFLINE_NOTE_KEY);
    pendingNote = raw ? JSON.parse(raw) : null;
  } catch(e){}
  if(currentUserId){
    await loadAppData();
    if(pendingNote && pendingNote.text){
      settings.offlineNoteText = pendingNote.text;
      settings.offlineNoteSavedAt = pendingNote.savedAt;
      await DataLayer.saveSettings(settings);
      try{ localStorage.removeItem(OFFLINE_NOTE_KEY); } catch(e){}
      render();
    }
  } else {
    render();
  }
  const note = loadOfflineNote();
  if(note && note.text){
    showToast('Wieder online — Notiz vorhanden: "' + note.text + '"');
  }
}
