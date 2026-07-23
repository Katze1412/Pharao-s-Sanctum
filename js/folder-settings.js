/* ============================================================
   FOLDER-SETTINGS — Ordner-Reiter konfigurieren (Sichtbarkeit + Reihenfolge)
   ============================================================ */
function openFolderSettingsModal(){
  const root = document.getElementById('settingsmodal-root');
  if(!root) return;

  let visible = (settings.folderVisible || []).slice();
  let order = (settings.folderOrder || []).slice();
  let dragSrc = null;

  function renderFolderModal(){
    const ordered = order.filter(function(l){ return visible.indexOf(l)!==-1; });
    visible.forEach(function(l){ if(ordered.indexOf(l)===-1) ordered.push(l); });
    const allLocs = locations.slice();

    const checkboxes = allLocs.map(function(loc){
      const checked = visible.indexOf(loc)!==-1;
      return '<label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;">' +
        '<input type="checkbox" data-loc="' + escapeAttr(loc) + '" ' + (checked?'checked':'') + ' style="width:18px;height:18px;accent-color:var(--gold);">' +
        '<span>' + escapeHtml(loc) + '</span>' +
      '</label>';
    }).join('');

    const dragItems = ordered.map(function(loc){
      return '<div class="drag-item" draggable="true" data-drag-loc="' + escapeAttr(loc) + '" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--panel-2);border-radius:8px;margin-bottom:6px;cursor:grab;">' +
        '<span style="color:var(--text-muted);font-size:18px;">☰</span>' +
        '<span>' + escapeHtml(loc) + '</span>' +
      '</div>';
    }).join('');

    root.innerHTML = '' +
    '<div class="modal-overlay" id="folder-settings-overlay" style="z-index:70;">' +
      '<div class="modal" style="max-width:420px;max-height:85vh;display:flex;flex-direction:column;">' +
        '<div class="modal-head"><h2>📁 Ordner-Reiter verwalten</h2><button class="modal-close" id="folder-settings-close">×</button></div>' +
        '<div style="overflow-y:auto;flex:1;">' +
          '<div class="hint" style="margin-bottom:8px;">Welche Lagerorte sollen als Ordner erscheinen?</div>' +
          '<div id="folder-checkboxes">' + checkboxes + '</div>' +
          (ordered.length > 1 ? '<div class="hint" style="margin:12px 0 8px;">Reihenfolge der Ordner (ziehen zum Sortieren):</div><div id="folder-drag-list">' + dragItems + '</div>' : '') +
        '</div>' +
        '<button class="btn btn-primary" id="folder-settings-save" type="button" style="margin-top:12px;">Speichern</button>' +
      '</div>' +
    '</div>';

    document.getElementById('folder-settings-close').onclick = function(){ root.innerHTML = ''; };
    document.getElementById('folder-settings-overlay').onclick = function(e){ if(e.target.id==='folder-settings-overlay') root.innerHTML = ''; };

    root.querySelectorAll('[data-loc]').forEach(function(el){
      el.onchange = function(){
        const loc = el.getAttribute('data-loc');
        if(el.checked){ if(visible.indexOf(loc)===-1) visible.push(loc); }
        else { visible = visible.filter(function(l){ return l!==loc; }); }
        renderFolderModal();
      };
    });

    root.querySelectorAll('[data-drag-loc]').forEach(function(el){
      el.ondragstart = function(){ dragSrc = el.getAttribute('data-drag-loc'); el.style.opacity='0.4'; };
      el.ondragend = function(){ el.style.opacity='1'; };
      el.ondragover = function(e){ e.preventDefault(); el.style.background='var(--panel-3)'; };
      el.ondragleave = function(){ el.style.background='var(--panel-2)'; };
      el.ondrop = function(e){
        e.preventDefault();
        el.style.background='var(--panel-2)';
        const target = el.getAttribute('data-drag-loc');
        if(dragSrc && dragSrc !== target){
          const currentOrdered = order.filter(function(l){ return visible.indexOf(l)!==-1; });
          visible.forEach(function(l){ if(currentOrdered.indexOf(l)===-1) currentOrdered.push(l); });
          const fromIdx = currentOrdered.indexOf(dragSrc);
          const toIdx = currentOrdered.indexOf(target);
          if(fromIdx!==-1 && toIdx!==-1){
            currentOrdered.splice(fromIdx, 1);
            currentOrdered.splice(toIdx, 0, dragSrc);
            order = currentOrdered;
          }
          renderFolderModal();
        }
      };
    });

    document.getElementById('folder-settings-save').onclick = async function(){
      const finalOrdered = order.filter(function(l){ return visible.indexOf(l)!==-1; });
      visible.forEach(function(l){ if(finalOrdered.indexOf(l)===-1) finalOrdered.push(l); });
      settings.folderVisible = visible;
      settings.folderOrder = finalOrdered;
      await DataLayer.saveSettings(settings);
      root.innerHTML = '';
      render();
      showToast('Ordner gespeichert');
    };
  }

  renderFolderModal();
}
