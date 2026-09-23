/* ============================================================
   INIT
   ============================================================ */
async function init(){
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  initOfflineHandling();
  if(isOffline) return;

  // Password Recovery Token aus URL verarbeiten
  const hash = window.location.hash;
  if(hash && hash.includes('type=recovery')){
    showPasswordResetScreen();
    return;
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if(sessionData && sessionData.session && sessionData.session.user){
    currentUserId = sessionData.session.user.id;
    await loadAppData();
  } else {
    showLoginScreen();
  }

  supabaseClient.auth.onAuthStateChange(function(event, session){
    if(event === 'PASSWORD_RECOVERY'){
      showPasswordResetScreen();
      return;
    }
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
  decks = await DeckLayer.loadAll();
  const loadedSettings = await DataLayer.loadSettings();
  if(loadedSettings && typeof loadedSettings.lentWarningDays === 'number'){
    settings = loadedSettings;
  }
  render();
  saveOfflineSnapshot();
}

/* ============================================================
   PASSWORD RESET
   ============================================================ */
function showPasswordResetScreen(){
  const app = document.getElementById('app');
  app.innerHTML = '' +
  '<div class="login-screen">' +
    '<div style="text-align:center;margin-bottom:16px;"><div class="title-cartouche"><span class="hiero hiero-eye">𓂀</span><h1>Pharao\'s Sanctum</h1></div></div>' +
    '<p class="hint" style="text-align:center;">Neues Passwort festlegen.</p>' +
    '<div class="field"><input id="reset-password" type="password" placeholder="Neues Passwort" autocomplete="new-password"></div>' +
    '<div class="field"><input id="reset-password2" type="password" placeholder="Passwort wiederholen" autocomplete="new-password"></div>' +
    '<button class="btn btn-primary" id="btn-reset-submit" type="button">Passwort speichern</button>' +
    '<div id="login-status" class="hint" style="text-align:center;margin-top:10px;"></div>' +
  '</div>';

  document.getElementById('btn-reset-submit').onclick = async function(){
    const pw   = document.getElementById('reset-password').value;
    const pw2  = document.getElementById('reset-password2').value;
    const statusEl = document.getElementById('login-status');
    if(pw.length < 6){ statusEl.textContent = 'Mindestens 6 Zeichen.'; return; }
    if(pw !== pw2){ statusEl.textContent = 'Passwörter stimmen nicht überein.'; return; }
    statusEl.textContent = 'Wird gespeichert…';
    const { error } = await supabaseClient.auth.updateUser({ password: pw });
    if(error){ statusEl.textContent = 'Fehler: ' + error.message; }
    else{
      statusEl.textContent = 'Passwort gesetzt! Du wirst eingeloggt…';
      setTimeout(function(){ window.location.hash = ''; loadAppData(); }, 1500);
    }
  };
}

/* ============================================================
   LOGIN-SCREEN
   loginMode: 'login' | 'register' | 'magic'
   ============================================================ */
let loginMode = 'login';

function showLoginScreen(){
  const app = document.getElementById('app');
  app.innerHTML = renderLoginScreen();
  attachLoginListeners();
}

function renderLoginScreen(){
  const isLogin    = loginMode === 'login';
  const isRegister = loginMode === 'register';
  const isMagic    = loginMode === 'magic';

  const title = isRegister ? 'Registrieren' : 'Anmelden';

  const passwordFields = (isLogin || isRegister) ? (
    '<div class="field"><input id="login-password" type="password" placeholder="Passwort" autocomplete="' + (isLogin ? 'current-password' : 'new-password') + '"></div>' +
    (isRegister ? '<div class="field"><input id="login-password2" type="password" placeholder="Passwort wiederholen" autocomplete="new-password"></div>' : '')
  ) : '';

  const mainBtn = isMagic
    ? '<button class="btn btn-primary" id="btn-magic-link" type="button">Magic Link senden</button>'
    : '<button class="btn btn-primary" id="btn-auth-submit" type="button">' + title + '</button>';

  const toggleHtml = isLogin
    ? '<div class="hint" style="text-align:center;margin-top:12px;">Noch kein Konto? <a href="#" id="link-to-register" style="color:var(--gold-bright);">Registrieren</a></div>'
    : isRegister
      ? '<div class="hint" style="text-align:center;margin-top:12px;">Bereits registriert? <a href="#" id="link-to-login" style="color:var(--gold-bright);">Anmelden</a></div>'
      : '<div class="hint" style="text-align:center;margin-top:12px;"><a href="#" id="link-to-login" style="color:var(--gold-bright);">← Zurück zur Anmeldung</a></div>';

  const magicLinkToggle = !isMagic
    ? '<div class="hint" style="text-align:center;margin-top:8px;"><a href="#" id="link-to-magic" style="color:var(--text-muted);font-size:12px;">Kein Passwort? Magic Link verwenden</a></div>'
    : '';

  return '' +
  '<div class="login-screen">' +
    '<div style="text-align:center;margin-bottom:16px;"><div class="title-cartouche"><span class="hiero hiero-eye">𓂀</span><h1>Pharao\'s Sanctum</h1></div></div>' +
    '<p class="hint" style="text-align:center;">Melde dich an, um auf deine Sammlung zuzugreifen — auf jedem Gerät.</p>' +
    '<div class="field"><input id="login-email" type="email" placeholder="deine@email.de" autocomplete="email"></div>' +
    passwordFields +
    mainBtn +
    '<div id="login-status" class="hint" style="text-align:center;margin-top:10px;"></div>' +
    toggleHtml +
    magicLinkToggle +
  '</div>';
}

function attachLoginListeners(){
  const submitBtn = document.getElementById('btn-auth-submit');
  if(submitBtn){
    submitBtn.onclick = loginMode === 'login' ? doLogin : doRegister;
  }

  const magicBtn = document.getElementById('btn-magic-link');
  if(magicBtn) magicBtn.onclick = sendMagicLink;

  const toRegister = document.getElementById('link-to-register');
  if(toRegister) toRegister.onclick = function(e){ e.preventDefault(); loginMode = 'register'; showLoginScreen(); };

  const toLogin = document.getElementById('link-to-login');
  if(toLogin) toLogin.onclick = function(e){ e.preventDefault(); loginMode = 'login'; showLoginScreen(); };

  const toMagic = document.getElementById('link-to-magic');
  if(toMagic) toMagic.onclick = function(e){ e.preventDefault(); loginMode = 'magic'; showLoginScreen(); };

  document.querySelectorAll('.login-screen input').forEach(function(el){
    el.onkeydown = function(e){
      if(e.key !== 'Enter') return;
      if(loginMode === 'login') doLogin();
      else if(loginMode === 'register') doRegister();
      else sendMagicLink();
    };
  });
}

async function doLogin(){
  const email    = (document.getElementById('login-email')    || {}).value.trim();
  const password = (document.getElementById('login-password') || {}).value;
  const statusEl = document.getElementById('login-status');
  if(!email || !password){ statusEl.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
  statusEl.textContent = 'Wird angemeldet…';
  try{
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(error){ statusEl.textContent = 'Fehler: ' + error.message; }
  } catch(e){
    statusEl.textContent = 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.';
  }
}

async function doRegister(){
  const email     = (document.getElementById('login-email')     || {}).value.trim();
  const password  = (document.getElementById('login-password')  || {}).value;
  const password2 = (document.getElementById('login-password2') || {}).value;
  const statusEl  = document.getElementById('login-status');
  if(!email || !password){ statusEl.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
  if(password.length < 6){ statusEl.textContent = 'Passwort muss mindestens 6 Zeichen lang sein.'; return; }
  if(password !== password2){ statusEl.textContent = 'Passwörter stimmen nicht überein.'; return; }
  statusEl.textContent = 'Konto wird erstellt…';
  try{
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if(error){ statusEl.textContent = 'Fehler: ' + error.message; }
    else { statusEl.textContent = 'Konto erstellt! Du kannst dich jetzt einloggen.'; loginMode = 'login'; showLoginScreen(); }
  } catch(e){
    statusEl.textContent = 'Registrierung fehlgeschlagen. Bitte erneut versuchen.';
  }
}

async function sendMagicLink(){
  const email    = (document.getElementById('login-email') || {}).value.trim();
  const statusEl = document.getElementById('login-status');
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
  loginMode = 'login';
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
