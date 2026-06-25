async function fetchYgoCard(name){
  async function tryUrl(url){
    try{
      const res = await fetch(url);
      const raw = await res.text();
      let data;
      try{ data = JSON.parse(raw); } catch(e){ return null; }
      if(!data || !data.data || !data.data[0]) return null;
      return data.data[0];
    } catch(e){
      return null;
    }
  }
  const deUrl = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?name=' + encodeURIComponent(name) + '&language=de';
  let card = await tryUrl(deUrl);
  if(!card){
    const enUrl = 'https://db.ygoprodeck.com/api/v7/cardinfo.php?name=' + encodeURIComponent(name);
    card = await tryUrl(enUrl);
  }
  return card;
}

async function fetchArchetype(){
  const statusEl = document.getElementById('archetype-status');
  const lookupName = draft.name.trim();
  if(!lookupName){
    statusEl.textContent = 'Bitte zuerst einen Kartennamen eingeben.';
    return;
  }
  statusEl.textContent = 'Archetyp wird gesucht für "' + lookupName + '"…';
  try{
    const card = await fetchYgoCard(lookupName);
    if(!card){
      statusEl.textContent = 'Karte nicht gefunden (DE/EN). Bitte manuell eintragen.';
      return;
    }
    if(!card.archetype){
      statusEl.textContent = 'Kein offizieller Archetyp gefunden.';
      return;
    }
    draft.archetype = card.archetype;
    statusEl.textContent = 'Übernommen: ' + card.archetype;
    const archInput = document.getElementById('f-archetype');
    if(archInput) archInput.value = draft.archetype;
  } catch(e){
    console.error('Archetyp-Suche fehlgeschlagen', e);
    statusEl.textContent = 'Archetyp konnte nicht ermittelt werden. Bitte manuell eintragen.';
  }
}

async function fetchCardmarketPrice(){
  const statusEl = document.getElementById('price-status');
  const lookupName = draft.name.trim();
  if(!lookupName){
    statusEl.textContent = 'Bitte zuerst einen Kartennamen eingeben.';
    return;
  }
  statusEl.textContent = 'Preis wird gesucht für "' + lookupName + '"…';
  try{
    const card = await fetchYgoCard(lookupName);
    if(!card){
      statusEl.textContent = 'Karte nicht gefunden (DE/EN). Bitte manuell eintragen.';
      return;
    }
    const prices = card.card_prices && card.card_prices[0];
    const price = prices ? parseFloat(prices.cardmarket_price) : NaN;
    if(!prices || isNaN(price) || price === 0){
      statusEl.textContent = 'Kein Cardmarket-Preis verfügbar.';
      return;
    }
    draft.value = price.toFixed(2);
    statusEl.textContent = 'Übernommen: ' + price.toFixed(2) + ' € (' + card.name + ')';
    const valueInput = document.getElementById('f-value');
    if(valueInput) valueInput.value = draft.value;
  } catch(e){
    console.error('Preisabruf-Fehler', e);
    statusEl.textContent = 'Preis konnte nicht abgerufen werden. Bitte manuell eintragen.';
  }
}
