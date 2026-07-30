const STORAGE_KEY = "albumGen_v2";
const ANCHOR = new Date("2026-01-01T00:00:00Z"); // fecha fija de referencia: no cambiar

function keyOf(a){ return a.title + "|" + a.artist; }

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
function dayIndexForDate(dateStr, total){
  const d = new Date(dateStr + "T00:00:00Z");
  const diffDays = Math.floor((d - ANCHOR) / 86400000);
  return ((diffDays % total) + total) % total;
}
function dayNumberForDate(dateStr){
  return Math.floor((new Date(dateStr+"T00:00:00Z") - ANCHOR) / 86400000) + 1;
}

function loadState(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch(e){ return {}; }
}
function saveState(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

let ALBUMS = [];
let state = loadState();
state.entries = state.entries || {}; // { dateStr: { rating, comment, listened } }
let historyFilter = "todos";

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

// ---------- Tema claro/oscuro según la hora (Chile) ----------
function applyTheme(){
  const h = chileHour();
  const light = h >= 7 && h < 19;
  document.documentElement.classList.toggle("theme-light", light);
  document.documentElement.classList.toggle("theme-dark", !light);
}

// ---------- Vista Hoy ----------
function renderHoy(){
  const t = chileDateStr();
  const a = albumForDate(t);
  const entry = entryFor(t);

  const coverEl = document.getElementById("cover");
  if(a.cover){
    coverEl.style.backgroundImage = `url("${a.cover}")`;
    coverEl.classList.remove("hidden");
  } else {
    coverEl.classList.add("hidden");
  }

  document.getElementById("albumTitle").textContent = a.title;
  document.getElementById("albumArtist").textContent = a.artist;
  document.getElementById("albumCatalog").textContent = `${a.year} · ${a.genre} · ${a.origin}`;
  document.getElementById("albumBlurb").textContent = a.blurb;
  document.getElementById("spotifyLink").href = spotifySearchUrl(a);
  document.getElementById("comment").value = entry.comment || "";
  paintStars(document.getElementById("starsInner"), entry.rating || 0);
  document.getElementById("ratingValue").textContent = entry.rating
    ? entry.rating.toFixed(1).replace(".0","") + " / 5" : "Sin calificar";

  const triviaBox = document.getElementById("triviaBox");
  if(a.trivia){
    document.getElementById("triviaText").textContent = a.trivia;
    triviaBox.classList.remove("hidden");
  } else {
    triviaBox.classList.add("hidden");
  }

  document.getElementById("dayCount").textContent = "Día " + dayNumberForDate(t);
  renderReminder(t);
}

function paintStars(el, value){
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100;
  el.style.width = pct + "%";
}

function attachStarHandler(rowEl, innerEl, getDate, onRated){
  rowEl.addEventListener("click", (e)=>{
    const rect = rowEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let raw = (x / rect.width) * 5;
    let value = Math.round(raw * 2) / 2;
    value = Math.max(0.5, Math.min(5, value));
    const d = getDate();
    entryFor(d).rating = value;
    saveState(state);
    paintStars(innerEl, value);
    if(onRated) onRated(value);
    renderHistorial();
    renderStats();
  });
}

function setupStars(){
  attachStarHandler(
    document.getElementById("starRow"),
    document.getElementById("starsInner"),
    () => chileDateStr(),
    (v) => document.getElementById("ratingValue").textContent = v.toFixed(1).replace(".0","") + " / 5"
  );
  attachStarHandler(
    document.getElementById("starRowYesterday"),
    document.getElementById("starsInnerYesterday"),
    () => addDaysStr(chileDateStr(), -1),
    () => renderReminder(chileDateStr())
  );
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

// ---------- Recordatorio del día anterior (en la vista Hoy) ----------
function renderReminder(today){
  const yesterday = addDaysStr(today, -1);
  const entry = state.entries[yesterday];
  const banner = document.getElementById("reminderBanner");

  if(entry && entry.rating){
    banner.classList.add("hidden");
    return;
  }
  const a = albumForDate(yesterday);
  document.getElementById("reminderText").textContent =
    `Ayer sonó "${a.title}" de ${a.artist} — todavía no lo calificaste.`;
  paintStars(document.getElementById("starsInnerYesterday"), (entry && entry.rating) || 0);
  banner.classList.remove("hidden");
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

// ---------- Álbum sorpresa ----------
function showSurprise(){
  const today = chileDateStr();
  const todayAlbum = albumForDate(today);
  let pick;
  do{ pick = ALBUMS[Math.floor(Math.random()*ALBUMS.length)]; }
  while(ALBUMS.length > 1 && keyOf(pick) === keyOf(todayAlbum));

  document.getElementById("surpriseTitle").textContent = pick.title;
  document.getElementById("surpriseArtist").textContent = pick.artist;
  document.getElementById("surpriseCatalog").textContent = `${pick.year} · ${pick.genre} · ${pick.origin}`;
  document.getElementById("surpriseBlurb").textContent = pick.blurb;
  document.getElementById("surpriseSpotify").href = spotifySearchUrl(pick);
  document.getElementById("surpriseModal").classList.remove("hidden");
}
function setupSurprise(){
  document.getElementById("surpriseBtn").addEventListener("click", showSurprise);
  document.getElementById("surpriseAgain").addEventListener("click", showSurprise);
  document.getElementById("surpriseClose").addEventListener("click", ()=>{
    document.getElementById("surpriseModal").classList.add("hidden");
  });
}

// ---------- Historial ----------
function setupFilters(){
  document.querySelectorAll(".chip").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      document.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      historyFilter = chip.dataset.filter;
      renderHistorial();
    });
  });
}

function renderHistorial(){
  const list = document.getElementById("historyList");
  let dates = Object.keys(state.entries).sort((a,b)=> b.localeCompare(a));

  dates = dates.filter(date=>{
    const e = state.entries[date];
    if(historyFilter === "calificados") return !!e.rating;
    if(historyFilter === "no-escuchados") return e.listened === false;
    return true;
  });

  if(dates.length === 0){
    list.innerHTML = '<p class="empty-note">No hay entradas para este filtro.</p>';
    return;
  }

  list.innerHTML = dates.map(date=>{
    const a = albumForDate(date);
    const e = state.entries[date];
    const r = e.rating ? e.rating.toFixed(1).replace(".0","") + " / 5" : "—";
    const num = dayNumberForDate(date);
    const skip = e.listened === false ? '<span class="hist-skip">No escuchado</span>' : "";
    const comment = e.comment ? `<span class="hist-comment">"${escapeHtml(e.comment)}"</span>` : "";
    return `<div class="hist-row">
      <div class="hist-date">${date}</div>
      <div class="hist-body">
        <span class="hist-num">${num}</span>
        <div class="hist-info">
          <span class="hist-title">${a.title}</span>
          <span class="hist-artist">${a.artist}</span>
          ${comment}
          ${skip}
        </div>
        <div class="hist-side">
          <span class="hist-rating">${r}</span>
          <a class="hist-link" href="${spotifySearchUrl(a)}" target="_blank" rel="noopener">Spotify</a>
        </div>
      </div>
    </div>`;
  }).join("");
}
function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// ---------- Stats ----------
function renderStats(){
  const dates = Object.keys(state.entries);
  const entries = Object.values(state.entries);
  const rated = entries.filter(e=>e.rating);
  const skipped = entries.filter(e=>e.listened === false).length;

  document.getElementById("statRated").textContent = rated.length;
  document.getElementById("statAvg").textContent = rated.length
    ? (rated.reduce((s,e)=>s+e.rating,0)/rated.length).toFixed(2)
    : "—";
  document.getElementById("statSkipped").textContent = skipped;

  const genres = new Set();
  const origins = new Set();
  dates.forEach(date=>{
    const a = albumForDate(date);
    genres.add(a.genre);
    origins.add(a.origin);
  });
  document.getElementById("statGenres").textContent = genres.size;
  document.getElementById("statOrigins").textContent = origins.size;
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
        state.entries = { ...state.entries, ...imported.entries };
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
    applyTheme();
    setInterval(applyTheme, 5*60*1000);
    setupTabs();
    setupStars();
    setupComment();
    setupBackup();
    setupFilters();
    setupSurprise();
    renderAll();
    maybeShowCheckin();
  });
