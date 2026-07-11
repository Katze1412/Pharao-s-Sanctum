/* ============================================================
   SUPABASE-KONFIGURATION
   Diese beiden Werte aus deinem Supabase-Projekt eintragen:
   Dashboard → Project Settings → API → "Project URL" und "anon public" Key
   ============================================================ */
const SUPABASE_URL = 'https://uldatiqgnpgkitvpyded.supabase.co/auth/v1/.well-known/jwks.json';
const SUPABASE_ANON_KEY = 'd63bb9ac-60a1-4d77-9745-33f3f0eb8dfa';

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
