import json
import os
from http.server import BaseHTTPRequestHandler
from openai import OpenAI

ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.environ.get("ALLOWED_ORIGIN", "*").split(",")
    if origin.strip()
]

# Límite de carga: 4 MB (Vercel corta conexiones por encima de 4.5 MB)
MAX_BODY_BYTES = 4 * 1024 * 1024
MAX_PROMPT_LENGTH = 500

SYSTEM_INSTRUCTIONS = """
Eres un asistente de visión artificial especializado en detección y análisis de objetos.
El usuario te proporcionará una imagen y una indicación de los objetos específicos que busca.
Tu tarea consiste en:
1. Confirmar con exactitud si los objetos solicitados están presentes o ausentes.
2. Si están presentes, indicar su ubicación relativa (ej. arriba a la derecha, en primer plano, al fondo), cantidad aproximada y detalles relevantes (color, estado, interacción).
3. Si no están presentes o la imagen no es clara, indícalo de manera precisa.
4. Responde en español de forma directa, concisa y ordenada con viñetas.
"""

class handler(BaseHTTPRequestHandler):

    def add_cors_headers(self):
        origin = self.headers.get("Origin", "")
        if "*" in ALLOWED_ORIGINS or origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin if origin else "*")
            self.send_header("Vary", "Origin")

    def send_json(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.add_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.add_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_GET(self):
        self.send_json(405, {"error": "Solo se admite el método POST."})

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))

            if content_length <= 0 or content_length > MAX_BODY_BYTES:
                self.send_json(
                    413,
                    {"error": "El archivo es demasiado grande (máximo 4 MB permitido)."}
                )
                return

            raw_body = self.rfile.read(content_length)
            data = json.loads(raw_body.decode("utf-8"))

            image_data = data.get("image", "").strip()
            prompt = data.get("prompt", "").strip()

            if not image_data:
                self.send_json(400, {"error": "No se recibió ninguna imagen."})
                return

            if not prompt:
                prompt = "Detecta e identifica los objetos principales en la imagen."
            elif len(prompt) > MAX_PROMPT_LENGTH:
                self.send_json(
                    400,
                    {"error": f"El texto supera el límite de {MAX_PROMPT_LENGTH} caracteres."}
                )
                return

            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                self.send_json(500, {"error": "Variable OPENAI_API_KEY no configurada."})
                return

            client = OpenAI(api_key=api_key)

            user_content = [
                {
                    "type": "text",
                    "text": f"Por favor localiza y analiza lo siguiente: {prompt}"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_data,
                        "detail": "low"  # 'low' reduce tokens y agiliza; usa 'high' si requieres detalles diminutos
                    }
                }
            ]

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_INSTRUCTIONS},
                    {"role": "user", "content": user_content}
                ],
                max_tokens=600,
                temperature=0.2
            )

            reply = response.choices[0].message.content
            self.send_json(200, {"reply": reply})

        except json.JSONDecodeError:
            self.send_json(400, {"error": "El cuerpo de la petición no es un JSON válido."})
        except Exception as error:
            print(f"Error en endpoint /api/analyze: {error}")
            self.send_json(500, {"error": f"Error interno: {str(error)}"})