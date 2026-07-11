/* ============================================================
   SUPABASE-KONFIGURATION
   Diese beiden Werte aus deinem Supabase-Projekt eintragen:
   Dashboard → Project Settings → API → "Project URL" und "anon public" Key
   ============================================================ */
const SUPABASE_URL = 'https://uldatiqgnpgkitvpyded.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZGF0aXFnbnBna2l0dnB5ZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzkwNjEsImV4cCI6MjA5Nzk1NTA2MX0.fCO7hJTW2YKkZGTPMVKaj_3JdshyEv4Sxj0UgzuIR0E';

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
