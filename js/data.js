/* ============================================================
   DATENSCHICHT — zentrale Stelle für Speicherung.
   Aktuell: Claude Artifact Storage. Später einfach durch
   Supabase-Calls ersetzen (gleiche Funktionssignaturen behalten!).
   ============================================================ */
function cardToRow(c){
  return {
    id: c.id,
    user_id: currentUserId,
    name: c.name || '',
    set_code: c.setCode || null,
    card_number: c.cardNumber || null,
    rarity: c.rarity || null,
    condition: c.condition || null,
    quantity: parseInt(c.quantity, 10) || 1,
    value: (c.value !== '' && c.value !== null && c.value !== undefined) ? parseFloat(c.value) : null,
    archetype: c.archetype || null,
    box: c.box || null,
    is_lent: !!c.isLent,
    lent_to: c.lentTo || null,
    lent_since: c.lentSince || null,
    sale_status: c.saleStatus || 'frei',
    sale_price: (c.salePrice !== '' && c.salePrice !== null && c.salePrice !== undefined) ? parseFloat(c.salePrice) : null
  };
}

function rowToCard(r){
  return {
    id: r.id,
    name: r.name || '',
    setCode: r.set_code || '',
    cardNumber: r.card_number || '',
    rarity: r.rarity || '',
    condition: r.condition || '',
    quantity: r.quantity || 1,
    value: (r.value !== null && r.value !== undefined) ? String(r.value) : '',
    archetype: r.archetype || '',
    box: r.box || '',
    isLent: !!r.is_lent,
    lentTo: r.lent_to || '',
    lentSince: r.lent_since || '',
    saleStatus: r.sale_status || 'frei',
    salePrice: (r.sale_price !== null && r.sale_price !== undefined) ? String(r.sale_price) : ''
  };
}

const DataLayer = {
  async loadAll() {
    try {
      const { data, error } = await supabaseClient.from('cards').select('*').order('created_at', { ascending: true });
      if (error) { console.error('Ladefehler (Karten)', error); return []; }
      return (data || []).map(rowToCard);
    } catch (e) {
      console.error('Ladefehler (Karten)', e);
      return [];
    }
  },
  async saveAll(cardsArr) {
    if (!cardsArr || cardsArr.length === 0) return true;
    try {
      const rows = cardsArr.map(cardToRow);
      const { error } = await supabaseClient.from('cards').upsert(rows, { onConflict: 'id' });
      if (error) { console.error('Speicherfehler', error); return false; }
      return true;
    } catch (e) {
      console.error('Speicherfehler', e);
      return false;
    }
  },
  async deleteCard(id) {
    try {
      const { error } = await supabaseClient.from('cards').delete().eq('id', id);
      if (error) { console.error('Löschfehler', error); return false; }
      return true;
    } catch (e) {
      console.error('Löschfehler', e);
      return false;
    }
  },
  async loadLocations() {
    try {
      const { data, error } = await supabaseClient.from('locations').select('*').order('name', { ascending: true });
      if (error) { console.error('Ladefehler (Lagerorte)', error); return []; }
      return (data || []).map(function(r){ return r.name; });
    } catch (e) {
      console.error('Ladefehler (Lagerorte)', e);
      return [];
    }
  },
  async saveLocations(locs) {
    try {
      await supabaseClient.from('locations').delete().eq('user_id', currentUserId);
      if (locs.length > 0) {
        const rows = locs.map(function(name){ return { user_id: currentUserId, name: name }; });
        const { error } = await supabaseClient.from('locations').insert(rows);
        if (error) { console.error('Speicherfehler (Lagerorte)', error); return false; }
      }
      return true;
    } catch (e) {
      console.error('Speicherfehler (Lagerorte)', e);
      return false;
    }
  },
  async loadSettings() {
    try {
      const { data, error } = await supabaseClient.from('settings').select('*').eq('user_id', currentUserId).maybeSingle();
      if (error || !data) return null;
      return { lentWarningDays: data.lent_warning_days };
    } catch (e) {
      return null;
    }
  },
  async saveSettings(settingsObj) {
    try {
      const { error } = await supabaseClient.from('settings').upsert(
        { user_id: currentUserId, lent_warning_days: settingsObj.lentWarningDays },
        { onConflict: 'user_id' }
      );
      if (error) { console.error('Speicherfehler (Einstellungen)', error); return false; }
      return true;
    } catch (e) {
      console.error('Speicherfehler (Einstellungen)', e);
      return false;
    }
  }
};
async function persist(){
  const ok = await DataLayer.saveAll(cards);
  if(ok) saveOfflineSnapshot();
  return ok;
}

function csvEscape(value){
  const s = (value===undefined || value===null) ? '' : String(value);
  if(/[",\n]/.test(s)){
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function exportCsv(){
  const headers = ['name','setCode','cardNumber','rarity','condition','quantity','value','archetype','box','isLent','lentTo','lentSince','saleStatus','salePrice'];
  const lines = [headers.join(',')];
  cards.forEach(function(c){
    lines.push(headers.map(function(h){ return csvEscape(c[h]); }).join(','));
  });
  const csv = lines.join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ygo-kartenarchiv-' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV-Export gestartet');
}
