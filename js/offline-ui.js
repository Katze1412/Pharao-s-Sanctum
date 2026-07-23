/* ============================================================
   OFFLINE-UI — Banner, Bell-FAB, Notiz-Modal
   ============================================================ */
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
