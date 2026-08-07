# Mi Generador de Álbumes — VERSIÓN FINAL

Un álbum distinto cada día, elegido de un catálogo amplio y diverso.
Inspirado en 1001albumsgenerator.com, pero corrigiendo su sesgo hacia el
rock/pop anglosajón: acá la selección es mucho más pareja entre géneros,
décadas y países de origen.

## Catálogo

**1089 álbumes**, sin duplicados, todos con ficha completa (artista, año,
género, origen, reseña y dato curioso). Cobertura: cientos de géneros
distintos y más de 90 países/regiones de origen, desde los años 40 hasta
2024.

Se construyó en tandas sucesivas combinando dos criterios:
- **Consenso de crítica**: RYM, AOTY, Rolling Stone, Pitchfork, NME y
  listas especializadas por género/región.
- **Relevancia fundacional**: discos que definieron o fundaron un
  género o escena, aunque no aparezcan en listas anglosajonas.

La última tanda estuvo dedicada a Thom Yorke: sus discos solistas, Atoms
for Peace, The Smile, varios discos adicionales de Radiohead, bandas
sonoras de Jonny Greenwood, y una selección de influencias que él mismo
ha citado en entrevistas (Joanna Newsom, Scott Walker, Aphex Twin, Björk,
PJ Harvey, Penderecki, Messiaen, entre otros).

## Cómo funciona la app

- Cada día (hora de Chile) asigna un álbum, calculado a partir de la
  fecha — el mismo día, en cualquier dispositivo, se ve el mismo álbum.
- Calificación con medias estrellas, cuadro de comentarios.
- Recordatorio en "Hoy" si el día anterior quedó sin calificar.
- Aviso a las 23:00 (hora de Chile) para marcar el álbum de ayer como
  escuchado o no.
- Botón "☕ Álbum sorpresa" para un álbum al azar fuera de la rotación.
- Historial con filtros rápidos (Todos / Calificados / No escuchados) y
  estadísticas, incluida una de diversidad (géneros y orígenes distintos
  escuchados).
- Enlaces de Spotify, Bandcamp y YouTube por álbum, como alternativa si
  uno no está disponible en alguna plataforma.
- Exportar/importar respaldo (las calificaciones quedan guardadas por
  dispositivo, no hay servidor).
- Tema café claro/oscuro, cambia automático según la hora.

## Cómo subir esta versión al repositorio

Para evitar mezclar archivos viejos y nuevos: entra al repositorio,
selecciona todos los archivos existentes y bórralos en un commit: luego
sube estos 9 archivos juntos, en un solo commit nuevo:

`index.html`, `style.css`, `app.js`, `albums.json`, `manifest.json`,
`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `README.md`.

Todos van sueltos en la raíz del repositorio, sin subcarpetas.

## Portadas

Cada álbum en `albums.json` tiene un campo `"cover"`, opcional. Si está
vacío, se muestra el recuadro en blanco. Para poner una portada real,
pegá ahí la URL de una imagen — no hace falta subir archivos:

```json
"cover": "https://ejemplo.com/portada.jpg"
```

## Próximos pasos posibles

Quedan algunas regiones con cobertura débil o nula por falta de fuentes
lo bastante confiables al momento de construir el catálogo (Bangladesh,
partes de Asia Central, varias islas del Pacífico) — quedan como huecos
honestos, no rellenados con datos inciertos. También queda pendiente,
si se quiere, una tanda futura enfocada solo en música chilena reciente
o en cualquier otro recorte específico.
