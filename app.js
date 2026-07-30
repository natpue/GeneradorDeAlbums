const STORAGE_KEY = "albumGen_v1";

function keyOf(a){ return a.title + "|" + a.artist; }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function loadState(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  }catch(e){ return {}; }
}
function saveState(s){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

let ALBUMS = [];
let ALBUM_MAP = {};
let state = loadState();

function ensureAssignment(){
  state.assigned = state.assigned || {};   // { dateStr: albumKey }
  state.ratings  = state.ratings  || {};   // { albumKey: { rating, date } }
  state.queue    = state.queue    || [];   // upcoming shuffled keys, not yet assigned

  const allKeys = ALBUMS.map(keyOf);
  const assignedKeys = new Set(Object.values(state.assigned));

  // drop queue entries that no longer exist in the catalog
  state.queue = state.queue.filter(k => ALBUM_MAP[k]);

  // find keys never assigned and not already queued -> add them (new additions to the catalog)
  const known = new Set([...state.queue, ...assignedKeys]);
  const fresh = shuffle(allKeys.filter(k => !known.has(k)));
  state.queue = state.queue.concat(fresh);

  const t = todayStr();
  if(!state.assigned[t]){
    if(state.queue.length === 0){
      // catalog exhausted -> start a new round
      state.queue = shuffle(allKeys.filter(k => k !== Object.values(state.assigned).slice(-1)[0]));
    }
    const next = state.queue.shift();
    state.assigned[t] = next;
  }
  saveState(state);
}

function spotifySearchUrl(a){
  const q = encodeURIComponent(a.artist + " " + a.title);
  return "https://open.spotify.com/search/" + q;
}

function renderHoy(){
  const t = todayStr();
  const key = state.assigned[t];
  const a = ALBUM_MAP[key];
  if(!a) return;

  document.getElementById("cover").src = a.cover;
  document.getElementById("albumTitle").textContent = a.title;
  document.getElementById("albumArtist").textContent = a.artist;
  document.getElementById("albumCatalog").textContent = `${a.year} · ${a.genre} · ${a.origin}`;
  document.getElementById("albumBlurb").textContent = a.blurb;
  document.getElementById("spotifyLink").href = spotifySearchUrl(a);

  const rated = state.ratings[key]?.rating || 0;
  document.querySelectorAll(".groove").forEach(btn=>{
    btn.classList.toggle("filled", Number(btn.dataset.v) <= rated);
  });

  const dayNum = Object.keys(state.assigned).length;
  document.getElementById("dayCount").textContent = "Día " + dayNum;
}

function renderHistorial(){
  const list = document.getElementById("historyList");
  const entries = Object.entries(state.assigned)
    .sort((a,b)=> b[0].localeCompare(a[0]));

  if(entries.length === 0){
    list.innerHTML = '<p class="empty-note">Todavía no hay historial.</p>';
    return;
  }

  list.innerHTML = entries.map(([date, key])=>{
    const a = ALBUM_MAP[key];
    if(!a) return "";
    const r = state.ratings[key]?.rating;
    return `<div class="history-item">
      <div class="history-main">
        <span class="history-title">${a.title}</span>
        <span class="history-meta">${a.artist} · ${date}</span>
      </div>
      <span class="history-rating">${r ? r + "/5" : "—"}</span>
    </div>`;
  }).join("");
}

function renderStats(){
  const ratingsArr = Object.values(state.ratings).map(r=>r.rating);
  document.getElementById("statRated").textContent = ratingsArr.length;
  document.getElementById("statTotal").textContent = ALBUMS.length;
  document.getElementById("statAvg").textContent = ratingsArr.length
    ? (ratingsArr.reduce((s,v)=>s+v,0)/ratingsArr.length).toFixed(2)
    : "—";
}

function renderAll(){
  renderHoy();
  renderHistorial();
  renderStats();
}

function setupTabs(){
  document.querySelectorAll(".tab").forEach(tab=>{
    tab.addEventListener("click", ()=>{
      document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
      document.getElementById("view-"+tab.dataset.view).classList.remove("hidden");
    });
  });
}

function setupRating(){
  document.getElementById("rateRow").addEventListener("click", (e)=>{
    const btn = e.target.closest(".groove");
    if(!btn) return;
    const v = Number(btn.dataset.v);
    const key = state.assigned[todayStr()];
    state.ratings[key] = { rating: v, date: todayStr() };
    saveState(state);
    renderAll();
  });
}

fetch("albums.json")
  .then(r=>r.json())
  .then(data=>{
    ALBUMS = data;
    ALBUM_MAP = Object.fromEntries(ALBUMS.map(a=>[keyOf(a), a]));
    ensureAssignment();
    setupTabs();
    setupRating();
    renderAll();
  });
