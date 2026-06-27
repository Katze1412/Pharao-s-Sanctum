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

  const csvExportBtn = document.getElementById('btn-csv-export');
  if(csvExportBtn){ csvExportBtn.onclick = exportCsv; }
}
