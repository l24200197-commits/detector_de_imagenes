let optimizedBase64 = "";

const fileInput = document.getElementById("imageInput");
const previewContainer = document.getElementById("previewContainer");
const previewImage = document.getElementById("previewImage");
const resultBox = document.getElementById("resultContainer");
const submitBtn = document.getElementById("submitBtn");

// Redimensiona y comprime la imagen en el navegador
fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Redimensionar si excede 1280px para ahorrar ancho de banda
      const MAX_WIDTH = 1280;
      const MAX_HEIGHT = 1280;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Comprimir a JPEG al 80% de calidad
      optimizedBase64 = canvas.toDataURL("image/jpeg", 0.8);

      previewImage.src = optimizedBase64;
      previewContainer.style.display = "block";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

async function analizarFoto() {
  const promptText = document.getElementById("promptInput").value.trim();

  if (!optimizedBase64) {
    alert("Por favor selecciona una imagen primero.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = "Analizando con la IA...";
  resultBox.style.display = "block";
  resultBox.innerText = "Procesando la imagen, por favor espera...";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: optimizedBase64,
        prompt: promptText
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Ocurrió un error al procesar.");
    }

    resultBox.innerText = data.reply;
  } catch (error) {
    resultBox.innerText = "Error: " + error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Analizar Imagen";
  }
}