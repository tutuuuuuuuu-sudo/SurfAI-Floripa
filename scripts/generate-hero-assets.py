#!/usr/bin/env python3
"""
Gera os assets do hero da landing (fundo aereo da ilha + video de onda quebrando)
usando o Gemini (Nano Banana Pro para imagem, Veo 3.1 para video).

Requer:
    pip install google-genai pillow
    export GEMINI_API_KEY="sua-chave-aqui"   (console.cloud.google.com/apis -> Gemini API)

Uso:
    python generate-hero-assets.py

Gera 3 arquivos na pasta atual:
    aerial-floripa.jpg      -- fundo em tela cheia (9:16), ~1000px de largura
    wave-break-raw.mp4      -- video bruto do Veo (720x1280, 8s)
    wave-break-poster.jpg   -- frame de poster extraido do video (precisa de ffmpeg)

Depois de gerar, comprima o video antes de usar no site:
    ffmpeg -y -i wave-break-raw.mp4 -c:v libx264 -crf 28 -preset slow -an \
        -movflags +faststart wave-break.mp4
"""

import os
import time
import subprocess
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image

OUT_DIR = Path(__file__).parent
IMAGE_MODEL = "gemini-3-pro-image-preview"  # "Nano Banana Pro" -- 4K, thinking mode
VIDEO_MODEL = "veo-3.1-lite-generate-preview"

# Ajuste esses prompts pra trocar o visual sem mexer no resto do script.
AERIAL_PROMPT = (
    "Aerial drone photograph looking straight down at Florianopolis Island, Brazil, "
    "tropical coastal landscape from directly above: turquoise and deep blue ocean "
    "meeting white sand beaches, green forested hills, natural coastline curves, a few "
    "visible surf breaks with white wave lines, soft golden late-afternoon light, ultra "
    "realistic professional drone photography, high detail, cinematic, no people, no "
    "boats, no text, no watermark, no logos"
)

WAVE_VIDEO_PROMPT = (
    "Cinematic slow-motion realistic ocean wave rising and breaking directly toward the "
    "camera, close low angle from just above the water surface, crystal clear turquoise "
    "water with white foam spray, professional surf videography, soft natural sunlight, "
    "ultra realistic, high quality, empty ocean with no people, no surfers, no boats, no "
    "on-screen text, no watermark, no logos"
)


def generate_aerial_background(client: genai.Client) -> None:
    print("Gerando imagem de fundo (Nano Banana Pro)...")
    response = client.models.generate_images(
        model=IMAGE_MODEL,
        prompt=AERIAL_PROMPT,
        config=types.GenerateImagesConfig(
            aspect_ratio="9:16",
            image_size="2K",
        ),
    )
    image_bytes = response.generated_images[0].image.image_bytes
    raw_path = OUT_DIR / "aerial-floripa-raw.jpg"
    raw_path.write_bytes(image_bytes)

    # Redimensiona pra tamanho de web (a imagem 2K/4K original e pesada demais pro bundle).
    im = Image.open(raw_path).convert("RGB")
    target_w = 1000
    ratio = target_w / im.width
    im = im.resize((target_w, int(im.height * ratio)), Image.LANCZOS)
    out_path = OUT_DIR / "aerial-floripa.jpg"
    im.save(out_path, quality=80, optimize=True)
    raw_path.unlink()
    print(f"  -> {out_path} ({out_path.stat().st_size // 1024} KB)")


def generate_wave_video(client: genai.Client) -> None:
    print("Gerando video da onda (Veo 3.1)...")
    operation = client.models.generate_videos(
        model=VIDEO_MODEL,
        prompt=WAVE_VIDEO_PROMPT,
        config=types.GenerateVideosConfig(
            aspect_ratio="9:16",
            duration_seconds=8,
            resolution="720p",
        ),
    )

    print("  Aguardando renderizacao (pode levar alguns minutos)...")
    while not operation.done:
        time.sleep(10)
        operation = client.operations.get(operation)

    if not operation.response or not operation.response.generated_videos:
        raise RuntimeError(
            "Geracao falhou ou foi bloqueada pelo filtro de seguranca. "
            "Tente simplificar o prompt e rodar de novo."
        )

    video = operation.response.generated_videos[0].video
    raw_path = OUT_DIR / "wave-break-raw.mp4"
    client.files.download(file=video)
    video.save(str(raw_path))
    print(f"  -> {raw_path} ({raw_path.stat().st_size // 1024} KB, bruto)")

    # Comprime (reduz de ~7MB pra ~2MB sem perda visivel perceptivel).
    compressed_path = OUT_DIR / "wave-break.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(raw_path),
            "-c:v", "libx264", "-crf", "28", "-preset", "slow", "-an",
            "-movflags", "+faststart", str(compressed_path),
        ],
        check=True,
    )
    print(f"  -> {compressed_path} ({compressed_path.stat().st_size // 1024} KB, comprimido)")

    # Poster: um frame do meio da quebra, pra fallback de prefers-reduced-motion.
    poster_path = OUT_DIR / "wave-break-poster.jpg"
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(compressed_path),
            "-vf", "select=eq(n\\,96)", "-vsync", "0", str(poster_path),
        ],
        check=True,
    )
    print(f"  -> {poster_path}")


def main() -> None:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("Defina a variavel de ambiente GEMINI_API_KEY antes de rodar.")

    client = genai.Client(api_key=api_key)
    generate_aerial_background(client)
    generate_wave_video(client)
    print("\nPronto. Copie aerial-floripa.jpg, wave-break.mp4 e wave-break-poster.jpg")
    print("para src/assets/landing/ substituindo os arquivos existentes.")


if __name__ == "__main__":
    main()
