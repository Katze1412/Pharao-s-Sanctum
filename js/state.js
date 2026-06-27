/* ============================================================
   STATE
   ============================================================ */
let cards = [];
let locations = [];
let locModalOpen = false;
let settings = { lentWarningDays: 30 };
let currentTab = 'sammlung';      // sammlung | verliehen | verkauf
let groupBy = 'set';              // set | box
let sammlungView = 'uebersicht';  // uebersicht | archetypen
let searchQuery = '';
let collapsedGroups = {};
let modalOpen = false;
let modalTab = 'manuell';         // manuell | csv | scan
let editingId = null;
let duplicateMatch = null;
let scanResult = null;
let scanBusy = false;
let scanImagePreview = null;
let scanCandidates = [];
let scanProgress = '';
let scanAttempted = false;
let isOffline = false;
let offlineNoteModalOpen = false;
let settingsMenuOpen = false;
let selectionMode = false;
let selectedIds = new Set();
let lastFilteredIds = [];

const RARITIES = ["Common","Rare","Super Rare","Ultra Rare","Secret Rare","Ultimate Rare","Ghost Rare","Starlight Rare","Andere"];
const CONDITIONS = ["Poor","Lightly Played","Played","Good","Excellent","Near Mint","Mint","Gem Mint"];
const CONDITION_NUMBER_MAP = {1:"Poor",2:"Lightly Played",3:"Played",4:"Good",5:"Excellent",6:"Near Mint",7:"Mint",8:"Gem Mint"};

function uid(){
  if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(ch){
    const r = Math.random()*16|0;
    const v = ch==='x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}

function emptyDraft(){
  return {
    id: null, name:'', setCode:'', cardNumber:'', rarity:'', condition:'',
    quantity:1, value:'', box:'', archetype:'',
    isLent:false, lentTo:'', lentSince:'',
    saleStatus:'frei', salePrice:''
  };
}
let draft = emptyDraft();
function escapeHtml(s){
  return String(s==null?'':s).replace(/[&<>"]/g, function(ch){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[ch];
  });
}
function escapeAttr(s){ return escapeHtml(s); }
