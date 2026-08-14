const STORAGE_KEY = "albumGen_v2";
const ANCHOR = new Date("2026-08-07T00:00:00Z"); // fecha de referencia: día 1 = reinicio

let toastTimer;
function showToast(msg){
  const el = document.getElementById("toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove("show"), 1400);
}

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
  // Independiente del ANCHOR: se basa en la fecha en que el usuario empezó
  // a usar la app (o la reinició por última vez), no en una fecha fija.
  return Math.floor((new Date(dateStr+"T00:00:00Z") - new Date(state.startDate+"T00:00:00Z")) / 86400000) + 1;
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return {};
    const parsed = JSON.parse(raw);
    if(typeof parsed !== "object" || parsed === null) throw new Error("formato inesperado");
    return parsed;
  }catch(e){
    console.warn("No se pudieron leer los datos guardados, se empieza de cero:", e);
    return { corrupted: true };
  }
}
function saveState(s){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return true;
  }catch(e){
    console.error("No se pudo guardar:", e);
    return false;
  }
}

let ALBUMS = [];
let ALBUM_MAP = {};
let state = loadState();
const wasCorrupted = !!state.corrupted;
delete state.corrupted;
state.entries = state.entries || {}; // { dateStr: { rating, comment, listened, albumKey } }
if(!state.startDate){
  state.startDate = chileDateStr();
  saveState(state);
}
let historyFilter = "todos";

function albumForDate(dateStr){
  return ALBUMS[dayIndexForDate(dateStr, ALBUMS.length)];
}
function entryFor(dateStr){
  if(!state.entries[dateStr]) state.entries[dateStr] = { rating: null, comment: "", listened: null, albumKey: null };
  return state.entries[dateStr];
}
// El álbum de un día se fija la primera vez que ese día se muestra, y desde
// ahí queda guardado en el propio registro — así el historial nunca cambia
// retroactivamente si el catálogo crece o se reordena más adelante.
function resolveAlbum(dateStr){
  const entry = entryFor(dateStr);
  if(!entry.albumKey || !ALBUM_MAP[entry.albumKey]){
    const a = albumForDate(dateStr);
    entry.albumKey = keyOf(a);
    saveState(state);
    return a;
  }
  return ALBUM_MAP[entry.albumKey];
}

function spotifySearchUrl(a){
  return "https://open.spotify.com/search/" + encodeURIComponent(a.artist + " " + a.title);
}
function bandcampSearchUrl(a){
  return "https://bandcamp.com/search?q=" + encodeURIComponent(a.artist + " " + a.title);
}
function youtubeSearchUrl(a){
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(a.artist + " " + a.title);
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
  const a = resolveAlbum(t);
  const entry = entryFor(t);

  const coverEl = document.getElementById("cover");
  coverEl.style.backgroundImage = a.cover ? `url("${a.cover}")` : "none";

  document.getElementById("albumTitle").textContent = a.title || "Álbum sin título";
  document.getElementById("albumArtist").textContent = a.artist || "Artista desconocido";
  document.getElementById("albumCatalog").textContent = `${a.year || "—"} · ${a.genre || "—"} · ${a.origin || "—"}`;
  document.getElementById("albumBlurb").textContent = a.blurb || "";
  document.getElementById("spotifyLink").href = spotifySearchUrl(a);
  document.getElementById("bandcampLink").href = bandcampSearchUrl(a);
  document.getElementById("youtubeLink").href = youtubeSearchUrl(a);
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
    showToast("Calificación guardada");
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
      showToast("Comentario guardado");
      renderHistorial();
    }, 400);
  });
}

// ---------- Recordatorio del día anterior (en la vista Hoy) ----------
function renderReminder(today){
  const yesterday = addDaysStr(today, -1);
  const entry = state.entries[yesterday];
  const banner = document.getElementById("reminderBanner");

  const alreadyResolved = entry && (entry.rating || entry.listened === true || entry.listened === false);
  if(alreadyResolved){
    banner.classList.add("hidden");
    return;
  }
  const a = resolveAlbum(yesterday);
  document.getElementById("reminderText").textContent =
    `Ayer sonó "${a.title}" de ${a.artist} — todavía no lo marcaste.`;
  banner.classList.remove("hidden");
}

function setupReminderActions(){
  document.getElementById("reminderListenedBtn").addEventListener("click", ()=>{
    const yesterday = addDaysStr(chileDateStr(), -1);
    entryFor(yesterday).listened = true;
    saveState(state);
    showToast("Marcado como escuchado");
    renderReminder(chileDateStr());
    renderHistorial();
    renderStats();
  });
  document.getElementById("reminderNotListenedBtn").addEventListener("click", ()=>{
    const yesterday = addDaysStr(chileDateStr(), -1);
    entryFor(yesterday).listened = false;
    saveState(state);
    showToast("Marcado como no escuchado");
    renderReminder(chileDateStr());
    renderHistorial();
    renderStats();
  });
}

// ---------- Aviso de las 23:00 (hora de Chile) ----------
function maybeShowCheckin(){
  const today = chileDateStr();
  const yesterday = addDaysStr(today, -1);
  const entry = state.entries[yesterday];
  const alreadyAnswered = entry && entry.listened !== null && entry.listened !== undefined;

  if(chileHour() >= 23 && !alreadyAnswered){
    const a = resolveAlbum(yesterday);
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

let editingDate = null;

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
    const a = resolveAlbum(date);
    const e = state.entries[date];
    const r = e.rating ? e.rating.toFixed(1).replace(".0","") + " / 5" : "—";
    const num = dayNumberForDate(date);
    const skip = e.listened === false ? '<span class="hist-skip">No escuchado</span>' : "";
    const isEditing = date === editingDate;

    if(isEditing){
      return `<div class="hist-row hist-row-editing">
        <div class="hist-date">${date}</div>
        <div class="hist-body">
          <span class="hist-num">${num}</span>
          <div class="hist-info">
            <span class="hist-title">${a.title}</span>
            <span class="hist-artist">${a.artist}</span>
          </div>
        </div>
        <div class="hist-edit">
          <div class="stars mini" id="histStarRow" data-date="${date}">
            <div class="stars-outer">★★★★★</div>
            <div class="stars-inner" id="histStarsInner"></div>
          </div>
          <div class="hist-listened-row">
            <button class="chip ${e.listened===true ? 'active':''}" id="histListenedBtn" type="button">Escuchado</button>
            <button class="chip ${e.listened===false ? 'active':''}" id="histNotListenedBtn" type="button">No escuchado</button>
          </div>
          <textarea id="histCommentBox" class="comment-box" placeholder="Tus impresiones...">${e.comment ? escapeHtml(e.comment) : ""}</textarea>
          <button class="cta secondary hist-done" id="histDoneBtn">Listo</button>
        </div>
      </div>`;
    }

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
          <div class="hist-links">
            <a href="${spotifySearchUrl(a)}" target="_blank" rel="noopener">Spotify</a>
            <a href="${bandcampSearchUrl(a)}" target="_blank" rel="noopener">BC</a>
            <a href="${youtubeSearchUrl(a)}" target="_blank" rel="noopener">YT</a>
          </div>
          <button class="hist-edit-btn" data-date="${date}">Editar</button>
        </div>
      </div>
    </div>`;
  }).join("");

  // Botones "Editar" -> entran en modo edición
  list.querySelectorAll(".hist-edit-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      editingDate = btn.dataset.date;
      renderHistorial();
    });
  });

  // Si hay una fila en edición, conectar estrellas y comentario
  if(editingDate && dates.includes(editingDate)){
    const starRow = document.getElementById("histStarRow");
    const starsInner = document.getElementById("histStarsInner");
    const commentBox = document.getElementById("histCommentBox");
    const doneBtn = document.getElementById("histDoneBtn");
    const listenedBtn = document.getElementById("histListenedBtn");
    const notListenedBtn = document.getElementById("histNotListenedBtn");

    listenedBtn.addEventListener("click", ()=>{
      const entry = entryFor(editingDate);
      entry.listened = entry.listened === true ? null : true;
      saveState(state);
      showToast(entry.listened === true ? "Marcado como escuchado" : "Marca quitada");
      renderHistorial();
      renderStats();
    });
    notListenedBtn.addEventListener("click", ()=>{
      const entry = entryFor(editingDate);
      entry.listened = entry.listened === false ? null : false;
      saveState(state);
      showToast(entry.listened === false ? "Marcado como no escuchado" : "Marca quitada");
      renderHistorial();
      renderStats();
    });

    paintStars(starsInner, entryFor(editingDate).rating || 0);

    starRow.addEventListener("click", (ev)=>{
      const rect = starRow.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      let value = Math.round((x / rect.width) * 5 * 2) / 2;
      value = Math.max(0.5, Math.min(5, value));
      entryFor(editingDate).rating = value;
      saveState(state);
      paintStars(starsInner, value);
      showToast("Calificación guardada");
      renderStats();
    });

    let timer;
    commentBox.addEventListener("input", ()=>{
      clearTimeout(timer);
      timer = setTimeout(()=>{
        entryFor(editingDate).comment = commentBox.value;
        saveState(state);
        showToast("Comentario guardado");
      }, 400);
    });

    doneBtn.addEventListener("click", ()=>{
      clearTimeout(timer);
      entryFor(editingDate).comment = commentBox.value;
      saveState(state);
      editingDate = null;
      renderHistorial();
    });
  }
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
    const a = resolveAlbum(date);
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
        const rawEntries = (imported && typeof imported.entries === "object" && imported.entries) || {};
        const cleanEntries = {};
        let skipped = 0;
        for(const [date, e] of Object.entries(rawEntries)){
          const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
          if(!validDate || typeof e !== "object" || e === null){ skipped++; continue; }
          cleanEntries[date] = {
            rating: typeof e.rating === "number" ? e.rating : null,
            comment: typeof e.comment === "string" ? e.comment : "",
            listened: e.listened === true || e.listened === false ? e.listened : null,
            albumKey: typeof e.albumKey === "string" ? e.albumKey : null
          };
        }
        state.entries = { ...state.entries, ...cleanEntries };
        saveState(state);
        renderAll();
        alert(skipped > 0
          ? `Respaldo importado. Se omitieron ${skipped} entradas con formato inválido.`
          : "Respaldo importado correctamente.");
      }catch(err){
        alert("Ese archivo no se pudo leer como respaldo válido.");
      }
    };
    reader.readAsText(file);
  });
}

// ---------- Reinicio ----------
function setupReset(){
  document.getElementById("resetBtn").addEventListener("click", ()=>{
    const ok = confirm("¿Seguro que querés borrar todo tu historial, calificaciones y comentarios? Esto no se puede deshacer.");
    if(!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
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

// Tema por defecto aplicado de inmediato, antes de que carguen los datos —
// así la app nunca se ve "en blanco sin estilos" mientras espera la red.
applyTheme();

fetch("albums.json")
  .then(r=>{
    if(!r.ok) throw new Error("No se pudo cargar albums.json (" + r.status + ")");
    return r.json();
  })
  .then(data=>{
    if(!Array.isArray(data) || data.length === 0){
      throw new Error("El catálogo está vacío o tiene un formato inválido");
    }
    ALBUMS = data;
    ALBUM_MAP = Object.fromEntries(ALBUMS.map(a=>[keyOf(a), a]));
    setInterval(applyTheme, 5*60*1000);
    setupTabs();
    setupStars();
    setupComment();
    setupReminderActions();
    setupBackup();
    setupFilters();
    setupReset();
    renderAll();
    maybeShowCheckin();
    setInterval(maybeShowCheckin, 5*60*1000);
    if(wasCorrupted){
      setTimeout(()=> alert("No se pudieron leer tus datos guardados anteriores (puede que se hayan dañado). Se empezó de cero. Si tenías un respaldo exportado, podés importarlo desde Stats."), 300);
    }
  })
  .catch(err=>{
    document.getElementById("app").innerHTML = `
      <div style="padding:60px 24px; text-align:center; color:var(--text);">
        <p style="font-size:15px; margin-bottom:8px;">No se pudo cargar el catálogo de álbumes.</p>
        <p style="font-size:13px; color:var(--muted);">Puede ser un problema de conexión, o que <code>albums.json</code> tenga un error de formato. Revisá la consola o intentá de nuevo.</p>
      </div>`;
    console.error(err);
  });
