let optimizedBase64 = "";
let loadedImageObj = null;

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const viewer = document.getElementById("viewer");
const canvas = document.getElementById("canvasDisplay");
const ctx = canvas.getContext("2d");
const btnChange = document.getElementById("btnChange");
const btnDownload = document.getElementById("btnDownload");
const btnAnalyze = document.getElementById("btnAnalyze");
const promptInput = document.getElementById("promptInput");
const errorBox = document.getElementById("errorBox");
const resultsSection = document.getElementById("resultsSection");
const generalDesc = document.getElementById("generalDesc");
const cardsGrid = document.getElementById("cardsGrid");

// --- Reto 3: Manejo de Drag and Drop ---
["dragenter", "dragover"].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (e) => {
  const files = e.dataTransfer.files;
  if (files.length > 0) validarYProcesarArchivo(files[0]);
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) validarYProcesarArchivo(e.target.files[0]);
});

btnChange.addEventListener("click", () => {
  optimizedBase64 = "";
  loadedImageObj = null;
  fileInput.value = "";
  viewer.style.display = "none";
  dropzone.style.display = "block";
  resultsSection.style.display = "none";
  ocultarError();
});

// --- Reto 5: Validación de archivos en el cliente ---
function validarYProcesarArchivo(file) {
  ocultarError();
  const validTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!validTypes.includes(file.type)) {
    mostrarError("Formato de archivo no soportado. Debe ser JPEG, PNG o WEBP.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      loadedImageObj = img;
      
      // Ajuste de resolución máxima para mantener fluidez
      const MAX_SIDE = 1200;
      let w = img.width;
      let h = img.height;

      if (w > h && w > MAX_SIDE) {
        h = Math.round((h * MAX_SIDE) / w);
        w = MAX_SIDE;
      } else if (h > MAX_SIDE) {
        w = Math.round((w * MAX_SIDE) / h);
        h = MAX_SIDE;
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      optimizedBase64 = canvas.toDataURL("image/jpeg", 0.85);
      dropzone.style.display = "none";
      viewer.style.display = "block";
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// --- Reto 7: Dibujar círculos sobre el canvas ---
function dibujarCirculos(coordenadasLista, etiqueta = "") {
  if (!loadedImageObj) return;

  // Redibujar imagen base limpia
  ctx.drawImage(loadedImageObj, 0, 0, canvas.width, canvas.height);

  coordenadasLista.forEach((coord, idx) => {
    const cx = (coord.center_x / 100) * canvas.width;
    const cy = (coord.center_y / 100) * canvas.height;
    const r = ((coord.radius || 10) / 100) * Math.min(canvas.width, canvas.height);

    // Círculo exterior brillante
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI, false);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ec4899"; // Fucsia neón
    ctx.stroke();

    // Relleno suave
    ctx.fillStyle = "rgba(236, 72, 153, 0.15)";
    ctx.fill();

    // Etiqueta numerada
    const labelText = etiqueta ? `${etiqueta} #${idx + 1}` : `#${idx + 1}`;
    ctx.font = "bold 13px system-ui";
    ctx.fillStyle = "#ffffff";
    const textWidth = ctx.measureText(labelText).width;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(cx - (textWidth / 2) - 6, cy - r - 24, textWidth + 12, 20);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(labelText, cx - (textWidth / 2), cy - r - 10);
  });
}

// --- Reto 7: Descarga de la imagen rotulada ---
btnDownload.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `analisis_hardware_${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// --- Reto 4 y 5: Envío, renderizado estructurado y manejo de errores ---
async function analizarHardware() {
  ocultarError();
  const prompt = promptInput.value.trim();

  if (!optimizedBase64) {
    mostrarError("Debes cargar una imagen antes de analizar.");
    return;
  }

  btnAnalyze.disabled = true;
  btnAnalyze.innerText = "Inspeccionando circuito...";
  resultsSection.style.display = "none";
  cardsGrid.innerHTML = "";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: optimizedBase64,
        prompt: prompt
      })
    });

    const data = await response.json();

    // Reto 5: Manejo granular de códigos de estado HTTP
    if (!response.ok) {
      if (response.status === 400) {
        throw new Error(data.error || "Petición incorrecta o parámetros inválidos (400).");
      } else if (response.status === 403) {
        throw new Error("Acceso no autorizado por política de orígenes CORS (403).");
      } else if (response.status === 413) {
        throw new Error("La imagen enviada excede el límite máximo permitido por el servidor (413).");
      } else if (response.status === 500) {
        throw new Error(data.error || "Fallo en el servicio del modelo de lenguaje o servidor (500).");
      } else {
        throw new Error(`Error inesperado (Código: ${response.status}).`);
      }
    }

    const payload = data.analisis;

    // Reto 4: Renderizar descripción general
    generalDesc.innerText = payload.descripcion_general || "Inspección finalizada con éxito.";

    // Reto 2 y 4: Construir tarjetas dinámicas y recolectar coordenadas
    let todasLasCoordenadas = [];

    payload.categorias.forEach((item) => {
      const card = document.createElement("div");
      card.className = "item-card";

      card.innerHTML = `
        <div class="item-title">
          <span>${item.patron_objeto}</span>
          <span class="badge badge-${item.certeza}">${item.certeza}</span>
        </div>
        <div>
          <span class="badge badge-cat">${item.categoria}</span>
          <span style="font-size: 0.8rem; color: #cbd5e1; margin-left: 6px;">Cantidad: <strong>${item.cantidad_estimada}</strong></span>
        </div>
        <p class="item-info"><strong>Evidencia:</strong> ${item.evidencia}</p>
      `;

      cardsGrid.appendChild(card);

      if (Array.isArray(item.coordenadas)) {
        todasLasCoordenadas.push(...item.coordenadas);
      }
    });

    resultsSection.style.display = "block";

    // Reto 7: Ejecutar marcado de círculos en el canvas
    if (todasLasCoordenadas.length > 0) {
      dibujarCirculos(todasLasCoordenadas, prompt ? prompt.split(" ")[0] : "Objeto");
    }

  } catch (err) {
    mostrarError(err.message);
  } finally {
    btnAnalyze.disabled = false;
    btnAnalyze.innerText = "Auditar y Circular Componentes";
  }
}

function mostrarError(mensaje) {
  errorBox.className = "alert-box alert-error";
  errorBox.innerText = `⚠️ ${mensaje}`;
  errorBox.style.display = "block";
}

function ocultarError() {
  errorBox.style.display = "none";
}