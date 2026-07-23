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
    banlist: 'tcg'
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

function getBanlistStatus(card, banlist){
  if(!card.banlist_info) return null;
  const key = 'ban_' + banlist;
  return card.banlist_info[key] || null;
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
  try{
    const url = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=' + encodeURIComponent(query.trim()) + '&language=de';
    const res = await fetch(url);
    const data = await res.json();
    if(!data || !data.data) return [];
    return data.data.slice(0, 20);
  } catch(e){ return []; }
}

async function saveDeckChanges(){
  const deck = getCurrentDeck();
  if(!deck) return false;
  const ok = await DeckLayer.save(deck);
  if(ok) showToast('Deck gespeichert');
  return ok;
}
