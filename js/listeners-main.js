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
  document.querySelectorAll('[data-folder]').forEach(function(el){
    el.onclick = function(){ openFolderId = el.getAttribute('data-folder'); render(); };
  });
  const backBtn = document.getElementById('btn-folder-back');
  if(backBtn){ backBtn.onclick = function(){ openFolderId = null; folderSortMode = false; render(); }; }
  const sortStartBtn = document.getElementById('btn-sort-start');
  if(sortStartBtn){ sortStartBtn.onclick = function(){ folderSortMode = true; render(); }; }
  const sortDoneBtn = document.getElementById('btn-sort-done');
  if(sortDoneBtn){ sortDoneBtn.onclick = function(){ folderSortMode = false; render(); }; }
  attachFolderDragListeners();

  const filterNoArchBtn = document.getElementById('btn-filter-no-archetype');
  if(filterNoArchBtn){ filterNoArchBtn.onclick = function(){ filterNoArchetype = !filterNoArchetype; render(); }; }

  const fab = document.getElementById('fab-add');
  if(fab){ fab.onclick = function(){ openModalForNew(fab.getAttribute('data-preset-box') || undefined); }; }
  const fabNewDeck = document.getElementById('fab-new-deck');
  if(fabNewDeck){ fabNewDeck.onclick = function(){ showFormatPickerModal(); }; }

  const fabImportYdk = document.getElementById('fab-import-ydk');
  const importFileList = document.getElementById('deck-import-file-list');
  if(fabImportYdk && importFileList){
    fabImportYdk.onclick = function(){ importFileList.click(); };
    importFileList.onchange = async function(){
      const file = importFileList.files[0];
      if(!file) return;
      const newDeck = emptyDeck();
      newDeck.name = file.name.replace('.ydk','');
      decks.unshift(newDeck);
      currentDeckId = newDeck.id;
      deckSubtab = 'main';
      render();
      const ok = await importDeckFromYdk(file, newDeck);
      if(ok){
        await DeckLayer.save(newDeck);
        render();
      } else {
        decks = decks.filter(function(d){ return d.id !== newDeck.id; });
        currentDeckId = null;
        render();
      }
    };
  }
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
  const selMoveBtn = document.getElementById('sel-move');
  if(selMoveBtn){
    selMoveBtn.onclick = async function(){
      if(selectedIds.size===0) return;
      const select = document.getElementById('sel-move-target');
      let target = select.value;
      if(!target){ showToast('Bitte einen Lagerort auswählen'); return; }
      if(target === '__new__'){
        target = window.prompt('Name des neuen Lagerorts:');
        if(!target || !target.trim()) return;
        target = target.trim();
        if(locations.indexOf(target)===-1){
          locations.push(target);
          await DataLayer.saveLocations(locations);
        }
      }
      const ids = Array.from(selectedIds);
      ids.forEach(function(id){
        const card = cards.find(function(c){ return c.id===id; });
        if(card) card.box = target;
      });
      await persist(ids);
      render();
      showToast(ids.length + ' Karte(n) nach "' + target + '" verschoben');
    };
  }

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

/* ============================================================
   DRAG & DROP — Ordner-Karten-Reihenfolge
   ============================================================ */
function attachFolderDragListeners(){
  const list = document.getElementById('folder-card-list');
  if(!list || !folderSortMode) return;

  let dragSrcId = null;
  let dragOverEl = null;

  list.querySelectorAll('.card-row[draggable]').forEach(function(row){
    row.addEventListener('dragstart', function(e){
      dragSrcId = row.getAttribute('data-card-id');
      row.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', function(){
      row.style.opacity = '';
      if(dragOverEl) dragOverEl.classList.remove('drag-over');
      dragOverEl = null;
      dragSrcId = null;
    });
    row.addEventListener('dragover', function(e){
      if(!dragSrcId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if(dragOverEl && dragOverEl !== row) dragOverEl.classList.remove('drag-over');
      dragOverEl = row;
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', function(){
      row.classList.remove('drag-over');
    });
    row.addEventListener('drop', async function(e){
      e.preventDefault();
      row.classList.remove('drag-over');
      const targetId = row.getAttribute('data-card-id');
      if(!dragSrcId || dragSrcId === targetId) return;
      const rows = Array.from(list.querySelectorAll('.card-row[data-card-id]'));
      let order = rows.map(function(r){ return r.getAttribute('data-card-id'); });
      order = order.filter(function(id){ return id !== dragSrcId; });
      const targetIdx = order.indexOf(targetId);
      order.splice(targetIdx, 0, dragSrcId);
      if(!settings.folderCardOrder) settings.folderCardOrder = {};
      settings.folderCardOrder[openFolderId] = order;
      await DataLayer.saveSettings(settings);
      render();
    });
  });

  // Touch-Drag für Mobile
  let touchDragId = null;
  let touchClone = null;

  list.querySelectorAll('.drag-handle').forEach(function(handle){
    handle.addEventListener('touchstart', function(e){
      e.stopPropagation();
      touchDragId = handle.getAttribute('data-drag-id');
      const row = handle.closest('.card-row');
      touchClone = row.cloneNode(true);
      touchClone.style.cssText = 'position:fixed;left:0;right:0;z-index:999;opacity:0.7;pointer-events:none;background:var(--panel-3);border:1px solid var(--gold);border-radius:8px;';
      touchClone.style.top = row.getBoundingClientRect().top + 'px';
      document.body.appendChild(touchClone);
      row.style.opacity = '0.3';
    }, {passive:true});

    handle.addEventListener('touchmove', function(e){
      if(!touchClone) return;
      e.preventDefault();
      const y = e.touches[0].clientY;
      touchClone.style.top = (y - 30) + 'px';
      list.querySelectorAll('.card-row[data-card-id]').forEach(function(r){ r.classList.remove('drag-over'); });
      const el = document.elementFromPoint(e.touches[0].clientX, y);
      if(el){ const t = el.closest('.card-row[data-card-id]'); if(t) t.classList.add('drag-over'); }
    }, {passive:false});

    handle.addEventListener('touchend', async function(e){
      if(touchClone){ touchClone.remove(); touchClone = null; }
      const srcRow = list.querySelector('.card-row[data-card-id="' + touchDragId + '"]');
      if(srcRow) srcRow.style.opacity = '';
      const y = e.changedTouches[0].clientY;
      const el = document.elementFromPoint(e.changedTouches[0].clientX, y);
      const targetRow = el && el.closest('.card-row[data-card-id]');
      list.querySelectorAll('.card-row').forEach(function(r){ r.classList.remove('drag-over'); });
      if(!targetRow || !touchDragId) return;
      const targetId = targetRow.getAttribute('data-card-id');
      if(touchDragId === targetId) return;
      const rows = Array.from(list.querySelectorAll('.card-row[data-card-id]'));
      let order = rows.map(function(r){ return r.getAttribute('data-card-id'); });
      order = order.filter(function(id){ return id !== touchDragId; });
      order.splice(order.indexOf(targetId), 0, touchDragId);
      if(!settings.folderCardOrder) settings.folderCardOrder = {};
      settings.folderCardOrder[openFolderId] = order;
      await DataLayer.saveSettings(settings);
      render();
    }, {passive:true});
  });
}

/* ============================================================
   FORMAT-PICKER — beim Erstellen eines neuen Decks
   ============================================================ */
function showFormatPickerModal(){
  const root = document.getElementById('modal-root');
  if(!root) return;

  const formats = [
    { value: 'tcg',     label: 'TCG',     desc: 'Standard TCG Banlist' },
    { value: 'ocg',     label: 'OCG',     desc: 'OCG Banlist' },
    { value: 'goat',    label: 'Goat',    desc: 'April 2005 Format' },
    { value: 'edison',  label: 'Edison',  desc: 'September 2010 Format' },
    { value: 'genesys', label: 'Genesys', desc: 'Punktesystem (max. 100 Pkt.)' }
  ];

  root.innerHTML = '' +
  '<div class="modal-overlay" id="format-picker-overlay" style="z-index:60;">' +
    '<div class="modal" style="max-width:380px;">' +
      '<div class="modal-head"><h2>Format wählen</h2><button class="modal-close" id="format-picker-close">×</button></div>' +
      '<p class="hint">Welches Format soll dieses Deck nutzen?</p>' +
      '<div style="display:flex;flex-direction:column;gap:8px;">' +
        formats.map(function(f){
          return '' +
          '<button type="button" class="btn btn-secondary" data-pick-format="' + f.value + '" style="text-align:left;padding:12px 14px;">' +
            '<div style="font-size:15px;font-weight:700;color:var(--text);">' + f.label + '</div>' +
            '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">' + f.desc + '</div>' +
          '</button>';
        }).join('') +
      '</div>' +
    '</div>' +
  '</div>';

  function closeModal(){ root.innerHTML = ''; }
  document.getElementById('format-picker-close').onclick = closeModal;
  document.getElementById('format-picker-overlay').onclick = function(e){ if(e.target.id==='format-picker-overlay') closeModal(); };

  root.querySelectorAll('[data-pick-format]').forEach(function(btn){
    btn.onclick = function(){
      const format = btn.getAttribute('data-pick-format');
      closeModal();
      const newDeck = emptyDeck(format);
      decks.unshift(newDeck);
      currentDeckId = newDeck.id;
      currentGenesysFormat = format === 'genesys';
      deckSubtab = 'suchen';
      render();
    };
  });
}
