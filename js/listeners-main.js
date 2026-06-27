async function adjustQuantity(id, delta){
  const idx = cards.findIndex(function(c){ return c.id===id; });
  if(idx===-1) return;
  const current = parseInt(cards[idx].quantity, 10) || 1;
  const next = current + delta;
  if(next < 1) return;
  cards[idx].quantity = next;
  render();
  const ok = await persist(id);
  if(!ok) showToast('Geändert im Browser, Sync fehlgeschlagen — bitte erneut versuchen');
}
/* ============================================================
   LISTENERS — Hauptansicht
   ============================================================ */
function attachMainListeners(){
  const logoutBtn = document.getElementById('btn-logout');
  if(logoutBtn){ logoutBtn.onclick = logout; }
  const settingsBtn = document.getElementById('btn-settings');
  if(settingsBtn){ settingsBtn.onclick = openSettingsMenu; }
  document.querySelectorAll('.tab').forEach(function(el){
    el.onclick = function(){ currentTab = el.getAttribute('data-tab'); render(); };
  });
  const searchInput = document.getElementById('search-input');
  if(searchInput){
    searchInput.oninput = function(e){ searchQuery = e.target.value; render(); restoreFocus('search-input'); };
  }
  document.querySelectorAll('[data-group]').forEach(function(el){
    el.onclick = function(){ groupBy = el.getAttribute('data-group'); render(); };
  });
  document.querySelectorAll('[data-subtab]').forEach(function(el){
    el.onclick = function(){ sammlungView = el.getAttribute('data-subtab'); render(); };
  });
  document.querySelectorAll('[data-toggle-group]').forEach(function(el){
    el.onclick = function(){
      const key = el.getAttribute('data-toggle-group');
      collapsedGroups[key] = !collapsedGroups[key];
      render();
    };
  });
  document.querySelectorAll('[data-edit]').forEach(function(el){
    el.onclick = function(){ openModalForEdit(el.getAttribute('data-edit')); };
  });
  document.querySelectorAll('[data-qty-plus]').forEach(function(el){
    el.onclick = function(e){ e.stopPropagation(); adjustQuantity(el.getAttribute('data-qty-plus'), 1); };
  });
  document.querySelectorAll('[data-qty-minus]').forEach(function(el){
    el.onclick = function(e){ e.stopPropagation(); adjustQuantity(el.getAttribute('data-qty-minus'), -1); };
  });
  const lentThresholdInput = document.getElementById('lent-threshold-input');
  if(lentThresholdInput){
    lentThresholdInput.onchange = function(e){
      const val = parseInt(e.target.value, 10);
      settings.lentWarningDays = (isNaN(val) || val < 1) ? 1 : val;
      DataLayer.saveSettings(settings);
      render();
    };
  }
  const fab = document.getElementById('fab-add');
  if(fab){ fab.onclick = function(){ openModalForNew(); }; }
  const fabNote = document.getElementById('fab-note');
  if(fabNote){ fabNote.onclick = function(){ openNoteModal(); }; }
  const fabBell = document.getElementById('fab-bell');
  if(fabBell){ fabBell.onclick = function(){ openNoteModal(); }; }

  document.querySelectorAll('.select-checkbox').forEach(function(el){
    el.onchange = function(){
      const id = el.getAttribute('data-select');
      if(el.checked) selectedIds.add(id); else selectedIds.delete(id);
      render();
    };
  });
  document.querySelectorAll('[data-select-group]').forEach(function(el){
    el.onclick = function(e){
      e.stopPropagation();
      const key = el.getAttribute('data-select-group');
      cards.filter(matchesSearch).forEach(function(c){
        const groupKey = groupBy==='set' ? (c.setCode ? c.setCode.toUpperCase() : 'Ohne Set') : (c.box || 'Ohne Lagerort');
        if(groupKey===key) selectedIds.add(c.id);
      });
      render();
    };
  });
  const selAllBtn = document.getElementById('sel-all-visible');
  if(selAllBtn){ selAllBtn.onclick = function(){ lastFilteredIds.forEach(function(id){ selectedIds.add(id); }); render(); }; }
  const selClearBtn = document.getElementById('sel-clear');
  if(selClearBtn){ selClearBtn.onclick = function(){ selectedIds.clear(); render(); }; }
  const selCancelBtn = document.getElementById('sel-cancel');
  if(selCancelBtn){ selCancelBtn.onclick = function(){ selectionMode = false; selectedIds.clear(); render(); }; }
  const selDeleteBtn = document.getElementById('sel-delete');
  if(selDeleteBtn){
    selDeleteBtn.onclick = async function(){
      if(selectedIds.size===0) return;
      const count = selectedIds.size;
      if(!window.confirm('Wirklich ' + count + ' Karte(n) dauerhaft löschen? Das kann nicht rückgängig gemacht werden.')) return;
      const ids = Array.from(selectedIds);
      selDeleteBtn.disabled = true;
      selDeleteBtn.textContent = 'Lösche … (kann bei vielen Karten etwas dauern)';
      const deletedIds = await DataLayer.deleteCards(ids);
      const deletedSet = new Set(deletedIds);
      cards = cards.filter(function(c){ return !deletedSet.has(c.id); });
      deletedSet.forEach(function(id){ selectedIds.delete(id); });
      saveOfflineSnapshot();
      render();
      if(deletedIds.length === ids.length){
        showToast(deletedIds.length + ' Karte(n) gelöscht');
      } else if(deletedIds.length > 0){
        showToast(deletedIds.length + ' von ' + ids.length + ' gelöscht — Rest ist noch ausgewählt, bitte erneut auf Löschen klicken');
      } else {
        showToast('Löschen fehlgeschlagen — bitte erneut versuchen');
      }
    };
  }

  const csvExportBtn = document.getElementById('btn-csv-export');
  if(csvExportBtn){ csvExportBtn.onclick = exportCsv; }
}
