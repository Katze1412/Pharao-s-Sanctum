/* ============================================================
   SUPABASE-KONFIGURATION
   Diese beiden Werte aus deinem Supabase-Projekt eintragen:
   Dashboard → Project Settings → API → "Project URL" und "anon public" Key
   ============================================================ */
const SUPABASE_URL = 'DEINE_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'DEIN_SUPABASE_ANON_KEY';

let supabaseClient = null;
let currentUserId = null;

/* ============================================================
   PWA — Service Worker registrieren (Offline-Grundfunktion)
   ============================================================ */
if('serviceWorker' in navigator){
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js').catch(function(e){ console.error('SW-Registrierung fehlgeschlagen', e); });
  });
}
