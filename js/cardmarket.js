async function fetchYgoCard(name){
  const cleanName = name.trim().replace(/\s+/g, ' ');
  async function tryUrl(url){
    try{
      const res = await fetch(url);
      const raw = await res.text();
      let data;
      try{ data = JSON.parse(raw); } catch(e){ return null; }
      if(!data || !data.data || data.data.length===0) return null;
      const exact = data.data.find(function(c){ return c.name.toLowerCase() === cleanName.toLowerCase(); });
      return exact || data.data[0];
    } catch(e){
      return null;
    }
  }

  // 1. Exakte Suche auf Deutsch
  let card = await tryUrl('https://db.ygoprodeck.com/api/v7/cardinfo.php?name=' + encodeURIComponent(cleanName) + '&language=de');
  if(card && card.archetype) return card;

  // 2. Fuzzy-Suche auf Deutsch
  if(!card) card = await tryUrl('https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=' + encodeURIComponent(cleanName) + '&language=de');

  // 3. Falls DE-Suche die Karte gefunden hat aber kein Archetyp vorhanden:
  //    englischen Namen aus dem DE-Ergebnis holen und damit EN-Datenbank anfragen
  if(card && !card.archetype && card.name){
    const enName = card.name;
    const enCard = await tryUrl('https://db.ygoprodeck.com/api/v7/cardinfo.php?name=' + encodeURIComponent(enName));
    if(enCard && enCard.archetype) return enCard;
    if(!enCard){
      const enFuzzy = await tryUrl('https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=' + encodeURIComponent(enName));
      if(enFuzzy) return enFuzzy;
    }
  }

  // 4. DE-Suche hat gar nichts gefunden: direkt englisch versuchen (letzter Fallback)
  if(!card){
    card = await tryUrl('https://db.ygoprodeck.com/api/v7/cardinfo.php?name=' + encodeURIComponent(cleanName));
    if(!card) card = await tryUrl('https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=' + encodeURIComponent(cleanName));
  }

  return card || null;
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

async function batchFetchArchetypes(onProgress){
  const DELAY_MS = 300; // API-Rate-Limit schonen
  const todo = cards.filter(function(c){ return c.name && c.name.trim(); });
  let updated = 0;
  let notFound = 0;
  const updatedIds = [];

  for(let i=0; i<todo.length; i++){
    const c = todo[i];
    if(onProgress) onProgress(i+1, todo.length, updated);
    try{
      const apiCard = await fetchYgoCard(c.name.trim());
      if(apiCard && apiCard.archetype){
        const newArchetype = apiCard.archetype;
        // Nur updaten wenn leer ODER abweichend (normalisiert auf englisch)
        if(!c.archetype || c.archetype.trim() !== newArchetype){
          const idx = cards.findIndex(function(x){ return x.id===c.id; });
          if(idx!==-1){
            cards[idx].archetype = newArchetype;
            updatedIds.push(c.id);
            updated++;
          }
        }
      } else {
        notFound++;
      }
    } catch(e){
      notFound++;
    }
    // Kurze Pause um API nicht zu überlasten
    await new Promise(function(r){ setTimeout(r, DELAY_MS); });
  }

  // Alle geänderten Karten in Batches speichern
  if(updatedIds.length > 0){
    await persist(updatedIds);
  }
  return { updated, notFound, total: todo.length };
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
