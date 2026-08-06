/* ============================================================
   DECK-DATA — Supabase CRUD für Decks
   ============================================================ */
const DeckLayer = {
  async loadAll(){
    try{
      const { data, error } = await supabaseClient.from('decks').select('*').eq('user_id', currentUserId).order('updated_at', { ascending: false });
      if(error){ console.error('Deck-Ladefehler', error); return []; }
      return (data||[]).map(function(row){
        return {
          id: row.id,
          name: row.name,
          mainDeck: JSON.parse(row.main_deck||'[]'),
          extraDeck: JSON.parse(row.extra_deck||'[]'),
          sideDeck: JSON.parse(row.side_deck||'[]'),
          banlist: row.banlist || 'tcg',
          coverId: row.cover_id || null,
          updatedAt: row.updated_at
        };
      });
    } catch(e){ console.error('Deck-Ladefehler', e); return []; }
  },

  async save(deck){
    try{
      const payload = {
        id: deck.id,
        user_id: currentUserId,
        name: deck.name,
        main_deck: JSON.stringify(deck.mainDeck||[]),
        extra_deck: JSON.stringify(deck.extraDeck||[]),
        side_deck: JSON.stringify(deck.sideDeck||[]),
        banlist: deck.banlist||'tcg',
        cover_id: deck.coverId || null,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabaseClient.from('decks').upsert(payload, { onConflict: 'id' });
      if(error){ console.error('Deck-Speicherfehler', error); return false; }
      return true;
    } catch(e){ console.error('Deck-Speicherfehler', e); return false; }
  },

  async delete(id){
    try{
      const { error } = await supabaseClient.from('decks').delete().eq('id', id).eq('user_id', currentUserId);
      if(error){ console.error('Deck-Löschfehler', error); return false; }
      return true;
    } catch(e){ console.error('Deck-Löschfehler', e); return false; }
  }
};

function emptyDeck(){
  return {
    id: uid(),
    name: 'Neues Deck',
    mainDeck: [],
    extraDeck: [],
    sideDeck: [],
    banlist: 'tcg',
    coverId: null
  };
}

function getCurrentDeck(){
  return decks.find(function(d){ return d.id === currentDeckId; }) || null;
}

function getDeckSection(deck, cardType){
  // Extra-Deck-Typen
  const extraTypes = ['Fusion Monster','Synchro Monster','XYZ Monster','Link Monster','Pendulum Effect Fusion Monster','Synchro Pendulum Effect Monster','XYZ Pendulum Effect Monster'];
  if(extraTypes.some(function(t){ return (cardType||'').indexOf(t)!==-1; })){
    return 'extraDeck';
  }
  return 'mainDeck';
}

function getBanlistKey(banlist){
  if(banlist === 'ocg') return 'ban_ocg';
  if(banlist === 'goat' || banlist === 'edison') return 'ban_goat';
  return 'ban_tcg';
}

function getBanlistStatus(card, banlist){
  if(!card.banlist_info) return null;
  return card.banlist_info[getBanlistKey(banlist)] || null;
}

function getMaxCopies(card, banlist){
  const status = getBanlistStatus(card, banlist);
  if(status === 'Banned') return 0;
  if(status === 'Limited') return 1;
  if(status === 'Semi-Limited') return 2;
  return 3;
}

async function searchDeckCards(query){
  if(!query || query.trim().length < 2) return [];
  const q = encodeURIComponent(query.trim());
  try{
    const [deRes, enRes] = await Promise.all([
      fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=' + q + '&language=de').then(function(r){ return r.json(); }).catch(function(){ return null; }),
      fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=' + q).then(function(r){ return r.json(); }).catch(function(){ return null; })
    ]);
    const seen = new Set();
    const results = [];
    if(deRes && deRes.data){
      deRes.data.slice(0,15).forEach(function(c){
        seen.add(c.id);
        c._lang = 'de';
        results.push(c);
      });
    }
    if(enRes && enRes.data){
      enRes.data.forEach(function(c){
        if(!seen.has(c.id)){
          seen.add(c.id);
          c._lang = 'en';
          results.push(c);
        }
      });
    }
    return results.slice(0,30);
  } catch(e){ return []; }
}

async function saveDeckChanges(){
  const deck = getCurrentDeck();
  if(!deck) return false;
  const ok = await DeckLayer.save(deck);
  if(ok) showToast('Deck gespeichert');
  return ok;
}

async function importDeckFromYdk(file, deck){
  return new Promise(function(resolve){
    const reader = new FileReader();
    reader.onload = async function(){
      const lines = reader.result.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 0; });
      let section = 'mainDeck';
      const toFetch = { mainDeck: [], extraDeck: [], sideDeck: [] };

      lines.forEach(function(line){
        if(line === '#main'){ section = 'mainDeck'; return; }
        if(line === '#extra'){ section = 'extraDeck'; return; }
        if(line === '!side'){ section = 'sideDeck'; return; }
        if(line.startsWith('#')) return;
        const id = parseInt(line);
        if(!isNaN(id)) toFetch[section].push(id);
      });

      const allIds = [...new Set([...toFetch.mainDeck, ...toFetch.extraDeck, ...toFetch.sideDeck])];
      if(allIds.length === 0){
        showImportResultModal('Importfehler', 'Keine Karten in der .ydk-Datei gefunden.', [], []);
        resolve(false); return;
      }

      // Ladebalken anzeigen
      showImportProgressModal(allIds.length);

      const cardMap = {};
      const BATCH = 10;
      for(let i=0; i<allIds.length; i+=BATCH){
        const batch = allIds.slice(i, i+BATCH);
        try{
          const url = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?id=' + batch.join(',');
          const res = await fetch(url);
          const data = await res.json();
          if(data && data.data){
            data.data.forEach(function(c){ cardMap[c.id] = c; });
          }
        } catch(e){}
        await new Promise(function(r){ setTimeout(r, 100); });
        updateImportProgress(i+BATCH, allIds.length);
      }

      deck.mainDeck = [];
      deck.extraDeck = [];
      deck.sideDeck = [];

      const notFoundIds = [];
      function addCards(ids, targetSection){
        ids.forEach(function(id){
          const c = cardMap[id];
          if(c){
            targetSection.push({ id: c.id, name: c.name, type: c.type, level: c.level, attribute: c.attribute, atk: c.atk, def: c.def, banlist_info: c.banlist_info });
          } else {
            notFoundIds.push(id);
          }
        });
      }

      addCards(toFetch.mainDeck, deck.mainDeck);
      addCards(toFetch.extraDeck, deck.extraDeck);
      addCards(toFetch.sideDeck, deck.sideDeck);

      const found = deck.mainDeck.length + deck.extraDeck.length + deck.sideDeck.length;
      showImportResultModal('Import abgeschlossen', found + ' Karten erfolgreich importiert.', notFoundIds, []);
      resolve(true);
    };
    reader.onerror = function(){
      showImportResultModal('Importfehler', 'Datei konnte nicht gelesen werden.', [], []);
      resolve(false);
    };
    reader.readAsText(file);
  });
}

