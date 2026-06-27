/* ============================================================
   INIT
   ============================================================ */
async function init(){
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  initOfflineHandling();
  if(isOffline) return;

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if(sessionData && sessionData.session && sessionData.session.user){
    currentUserId = sessionData.session.user.id;
    await loadAppData();
  } else {
    showLoginScreen();
  }

  supabaseClient.auth.onAuthStateChange(function(event, session){
    if(session && session.user){
      currentUserId = session.user.id;
      loadAppData();
    } else if(event === 'SIGNED_OUT'){
      currentUserId = null;
      cards = [];
      locations = [];
      showLoginScreen();
    }
  });
}

async function loadAppData(){
  cards = await DataLayer.loadAll();
  locations = await DataLayer.loadLocations();
  const loadedSettings = await DataLayer.loadSettings();
  if(loadedSettings && typeof loadedSettings.lentWarningDays === 'number'){
    settings = loadedSettings;
  }
  render();
  saveOfflineSnapshot();
}

function showLoginScreen(){
  document.getElementById('app').innerHTML = '' +
  '<div class="login-screen">' +
    '<div style="text-align:center;margin-bottom:16px;"><div class="title-cartouche"><span class="hiero hiero-eye">𓂀</span><h1>Pharao\'s Sanctum</h1></div></div>' +
    '<p class="hint" style="text-align:center;">Melde dich mit deiner E-Mail an, um auf deine Sammlung zuzugreifen — auf jedem Gerät.</p>' +
    '<div class="field"><input id="login-email" type="email" placeholder="deine@email.de"></div>' +
    '<button class="btn btn-primary" id="btn-magic-link" type="button">Magic Link senden</button>' +
    '<div id="login-status" class="hint" style="text-align:center;margin-top:10px;"></div>' +
  '</div>';
  const btn = document.getElementById('btn-magic-link');
  if(btn) btn.onclick = sendMagicLink;
  const emailInput = document.getElementById('login-email');
  if(emailInput){
    emailInput.onkeydown = function(e){ if(e.key==='Enter') sendMagicLink(); };
  }
}

async function sendMagicLink(){
  const emailInput = document.getElementById('login-email');
  const statusEl = document.getElementById('login-status');
  const email = emailInput.value.trim();
  if(!email){ statusEl.textContent = 'Bitte E-Mail-Adresse eingeben.'; return; }
  statusEl.textContent = 'Link wird gesendet…';
  try{
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: window.location.href }
    });
    if(error){ statusEl.textContent = 'Fehler: ' + error.message; }
    else { statusEl.textContent = 'Link gesendet! Öffne ihn aus deinem Postfach auf diesem Gerät.'; }
  } catch(e){
    statusEl.textContent = 'Senden fehlgeschlagen. Bitte erneut versuchen.';
  }
}

async function logout(){
  await supabaseClient.auth.signOut();
}
async function addLocation(){
  const input = document.getElementById('loc-new-input');
  const val = input.value.trim();
  if(!val) return;
  if(locations.indexOf(val) === -1){
    locations.push(val);
    await DataLayer.saveLocations(locations);
  }
  input.value = '';
  renderLocManager();
}

async function removeLocation(idx){
  locations.splice(idx, 1);
  await DataLayer.saveLocations(locations);
  renderLocManager();
}

function openLocManager(){
  locModalOpen = true;
  renderLocManager();
}

function closeLocManager(){
  locModalOpen = false;
  renderLocManager();
  renderModal();
}

function renderLocManager(){
  const root = document.getElementById('locmodal-root');
  if(!locModalOpen){ root.innerHTML = ''; return; }

  const itemsHtml = locations.map(function(loc, idx){
    return '<div class="loc-item"><span>' + escapeHtml(loc) + '</span><button data-loc-del="' + idx + '" type="button">×</button></div>';
  }).join('');

  root.innerHTML = '' +
  '<div class="modal-overlay" id="locmodal-overlay" style="z-index:70;">' +
    '<div class="modal" style="max-width:420px;">' +
      '<div class="modal-head"><h2>Lagerorte verwalten</h2><button class="modal-close" id="locmodal-close">×</button></div>' +
      '<div id="loc-list">' + (itemsHtml || '<div class="hint">Noch keine Lagerorte angelegt.</div>') + '</div>' +
      '<div class="field-row" style="margin-top:10px;">' +
        '<div class="field" style="flex:1;margin-bottom:0;"><input id="loc-new-input" type="text" placeholder="z.B. Box 3"></div>' +
        '<button class="btn btn-secondary" id="loc-add-btn" type="button" style="width:auto;padding:0 16px;">+</button>' +
      '</div>' +
      '<button class="btn btn-primary" id="locmodal-done" type="button" style="margin-top:14px;">Fertig</button>' +
    '</div>' +
  '</div>';

  document.getElementById('locmodal-overlay').onclick = function(e){ if(e.target.id==='locmodal-overlay') closeLocManager(); };
  document.getElementById('locmodal-close').onclick = closeLocManager;
  document.getElementById('locmodal-done').onclick = closeLocManager;
  document.getElementById('loc-add-btn').onclick = addLocation;
  document.querySelectorAll('[data-loc-del]').forEach(function(el){
    el.onclick = function(){ removeLocation(parseInt(el.getAttribute('data-loc-del'), 10)); };
  });
}
