/* ============================================================
   OFFLINE — Lese-Snapshot, Online/Offline-Erkennung, Notiz-Funktion
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
  try{
    if(!text || !text.trim()){
      localStorage.removeItem(OFFLINE_NOTE_KEY);
      return;
    }
    localStorage.setItem(OFFLINE_NOTE_KEY, JSON.stringify({ text: text.trim(), savedAt: new Date().toISOString() }));
  } catch(e){
    console.error('Notiz konnte nicht gespeichert werden', e);
  }
}

function loadOfflineNote(){
  try{
    const raw = localStorage.getItem(OFFLINE_NOTE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e){
    return null;
  }
}

function clearOfflineNote(){
  try{ localStorage.removeItem(OFFLINE_NOTE_KEY); } catch(e){}
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
  render();
}

async function handleGoOnline(){
  if(!isOffline) return;
  isOffline = false;
  if(currentUserId){
    await loadAppData();
  } else {
    render();
  }
  const note = loadOfflineNote();
  if(note && note.text){
    showToast('Wieder online — Notiz vorhanden: "' + note.text + '"');
  }
}

function renderOfflineBanner(){
  if(!isOffline) return '';
  const snap = loadOfflineSnapshot();
  let dateStr = '';
  if(snap && snap.savedAt){
    const d = new Date(snap.savedAt);
    if(!isNaN(d.getTime())){
      dateStr = ' · Stand vom ' + d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});
    }
  }
  return '' +
  '<div class="offline-banner">' +
    '<span>📡 Offline — nur Ansicht' + dateStr + '</span>' +
  '</div>';
}

function renderBellFab(){
  const note = loadOfflineNote();
  if(!note || !note.text) return '';
  return '<div class="fab fab-bell" id="fab-bell" title="Offline-Notiz ansehen">🔔</div>';
}

function openNoteModal(){
  offlineNoteModalOpen = true;
  renderNoteModal();
}

function closeNoteModal(){
  offlineNoteModalOpen = false;
  render();
}

function renderNoteModal(){
  const root = document.getElementById('notemodal-root');
  if(!root) return;
  if(!offlineNoteModalOpen){ root.innerHTML = ''; return; }

  const existing = loadOfflineNote();
  const existingText = existing ? existing.text : '';

  root.innerHTML = '' +
  '<div class="modal-overlay" id="notemodal-overlay" style="z-index:70;">' +
    '<div class="modal" style="max-width:420px;">' +
      '<div class="modal-head"><h2>Notiz für später</h2><button class="modal-close" id="notemodal-close">×</button></div>' +
      '<div class="hint">Kurz festhalten, was sich geändert hat — sobald du wieder online bist, erinnern wir dich daran, es in der Sammlung einzutragen.</div>' +
      '<div class="field"><textarea id="offline-note-text" rows="4" placeholder="z.B. 2x Dark Magician verliehen an Tom">' + escapeHtml(existingText) + '</textarea></div>' +
      '<div class="btn-row">' +
        (existing ? '<button class="btn btn-danger" id="notemodal-clear" type="button">Notiz löschen</button>' : '') +
        '<button class="btn btn-primary" id="notemodal-save" type="button">Speichern</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  document.getElementById('notemodal-overlay').onclick = function(e){ if(e.target.id==='notemodal-overlay') closeNoteModal(); };
  document.getElementById('notemodal-close').onclick = closeNoteModal;
  document.getElementById('notemodal-save').onclick = function(){
    const text = document.getElementById('offline-note-text').value;
    saveOfflineNote(text);
    showToast('Notiz gespeichert');
    closeNoteModal();
  };
  const clearBtn = document.getElementById('notemodal-clear');
  if(clearBtn){
    clearBtn.onclick = function(){
      clearOfflineNote();
      showToast('Notiz gelöscht');
      closeNoteModal();
    };
  }
}
