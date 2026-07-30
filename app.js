const STORAGE_KEY = "albumGen_v2";
const ANCHOR = new Date("2026-01-01T00:00:00Z"); // fecha fija de referencia: no cambiar

function keyOf(a){ return a.title + "|" + a.artist; }

// Fecha de hoy en huso horario de Chile, formato YYYY-MM-DD, sin importar el
// dispositivo o su zona horaria local.
function chileDateStr(date = new Date()){
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(date);
}
function chileHour(date = new Date()){
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago", hour: "2-digit", hour12: false
  }).format(date));
}
function addDaysStr(dateStr, delta){
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0,10);
}

// El álbum del día se calcula a partir de la fecha, no de un sorteo local.
// Esto hace que cualquier dispositivo que abra la app el mismo día (hora de
// Chile) vea el mismo álbum, sin necesidad de sincronizar nada entre ellos.
function dayIndexForDate(dateStr, total){
  const d = new Date(dateStr + "T00:00:00Z");
  const diffDays = Math.floor((d - ANCHOR) / 86400000);
  return ((diffDays % total) + total) % total;
}

function loadState(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch(e){ return {}; }
}
function saveState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

let ALBUMS = [];
let state = loadState();
state.entries = state.entries || {}; // { dateStr: { rating, comment, listened } }

function albumForDate(dateStr){
  return ALBUMS[dayIndexForDate(dateStr, ALBUMS.length)];
}
function entryFor(dateStr){
  if(!state.entries[dateStr]) state.entries[dateStr] = { rating: null, comment: "", listened: null };
  return state.entries[dateStr];
}

function spotifySearchUrl(a){
  return "https://open.spotify.com/search/" + encodeURIComponent(a.artist + " " + a.title);
}

// ---------- Vista Hoy ----------
function renderHoy(){
  const t = chileDateStr();
  const a = albumForDate(t);
  const entry = entryFor(t);

  document.getElementById("cover").src = a.cover;
  document.getElementById("albumTitle").textContent = a.title;
  document.getElementById("albumArtist").textContent = a.artist;
  document.getElementById("albumCatalog").textContent = `${a.year} · ${a.genre} · ${a.origin}`;
  document.getElementById("albumBlurb").textContent = a.blurb;
  document.getElementById("spotifyLink").href = spotifySearchUrl(a);
  document.getElementById("comment").value = entry.comment || "";
  paintStars(entry.rating || 0);

  const dayNum = Math.floor((new Date(t+"T00:00:00Z") - ANCHOR) / 86400000) + 1;
  document.getElementById("dayCount").textContent = "Día " + dayNum;
}

function paintStars(value){
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100;
  document.getElementById("starsInner").style.width = pct + "%";
  document.getElementById("ratingValue").textContent = value ? value.toFixed(1).replace(".0","") + " / 5" : "Sin calificar";
}

function setupStars(){
  const row = document.getElementById("starRow");
  row.addEventListener("click", (e)=>{
    const rect = row.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let raw = (x / rect.width) * 5;
    let value = Math.round(raw * 2) / 2; // pasos de 0.5
    value = Math.max(0.5, Math.min(5, value));
    const t = chileDateStr();
    entryFor(t).rating = value;
    saveState(state);
    paintStars(value);
    renderHistorial();
    renderStats();
  });
}

function setupComment(){
  const box = document.getElementById("comment");
  let timer;
  box.addEventListener("input", ()=>{
    clearTimeout(timer);
    timer = setTimeout(()=>{
      const t = chileDateStr();
      entryFor(t).comment = box.value;
      saveState(state);
      renderHistorial();
    }, 400);
  });
}

// ---------- Aviso de las 23:00 (hora de Chile) ----------
function maybeShowCheckin(){
  const today = chileDateStr();
  const yesterday = addDaysStr(today, -1);
  const entry = state.entries[yesterday];
  const alreadyAnswered = entry && entry.listened !== null && entry.listened !== undefined;

  if(chileHour() >= 23 && !alreadyAnswered){
    const a = albumForDate(yesterday);
    document.getElementById("checkinText").textContent =
      `¿Escuchaste "${a.title}" de ${a.artist} (el álbum de ayer)?`;
    document.getElementById("checkinModal").classList.remove("hidden");

    document.getElementById("btnListened").onclick = ()=>{
      entryFor(yesterday).listened = true;
      saveState(state);
      document.getElementById("checkinModal").classList.add("hidden");
      renderStats(); renderHistorial();
    };
    document.getElementById("btnNotListened").onclick = ()=>{
      entryFor(yesterday).listened = false;
      saveState(state);
      document.getElementById("checkinModal").classList.add("hidden");
      renderStats(); renderHistorial();
    };
  }
}

// ---------- Historial ----------
function renderHistorial(){
  const list = document.getElementById("historyList");
  const dates = Object.keys(state.entries).sort((a,b)=> b.localeCompare(a));

  if(dates.length === 0){
    list.innerHTML = '<p class="empty-note">Todavía no hay historial.</p>';
    return;
  }

  list.innerHTML = dates.map(date=>{
    const a = albumForDate(date);
    const e = state.entries[date];
    const r = e.rating ? e.rating.toFixed(1).replace(".0","") : null;
    const status = e.listened === false ? " · no escuchado" : "";
    return `<div class="history-item">
      <div class="history-main">
        <span class="history-title">${a.title}</span>
        <span class="history-meta">${a.artist} · ${date}${status}</span>
        ${e.comment ? `<span class="history-meta">"${escapeHtml(e.comment)}"</span>` : ""}
      </div>
      <span class="history-rating">${r ? r + "/5" : "—"}</span>
    </div>`;
  }).join("");
}
function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// ---------- Stats ----------
function renderStats(){
  const entries = Object.values(state.entries);
  const rated = entries.filter(e=>e.rating);
  const skipped = entries.filter(e=>e.listened === false).length;

  document.getElementById("statRated").textContent = rated.length;
  document.getElementById("statAvg").textContent = rated.length
    ? (rated.reduce((s,e)=>s+e.rating,0)/rated.length).toFixed(2)
    : "—";
  document.getElementById("statSkipped").textContent = skipped;
}

// ---------- Respaldo ----------
function setupBackup(){
  document.getElementById("exportBtn").addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "respaldo-albumes-" + chileDateStr() + ".json";
    link.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importInput").addEventListener("change", (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const imported = JSON.parse(reader.result);
        imported.entries = imported.entries || {};
        state.entries = { ...state.entries, ...imported.entries }; // fusiona, no borra lo existente
        saveState(state);
        renderAll();
        alert("Respaldo importado correctamente.");
      }catch(err){
        alert("Ese archivo no se pudo leer como respaldo válido.");
      }
    };
    reader.readAsText(file);
  });
}

// ---------- Tabs ----------
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

function renderAll(){
  renderHoy();
  renderHistorial();
  renderStats();
}

fetch("albums.json")
  .then(r=>r.json())
  .then(data=>{
    ALBUMS = data;
    setupTabs();
    setupStars();
    setupComment();
    setupBackup();
    renderAll();
    maybeShowCheckin();
  });
