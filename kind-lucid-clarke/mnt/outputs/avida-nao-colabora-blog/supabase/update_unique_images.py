#!/usr/bin/env python3
"""
update_unique_images.py

Atualiza image_url e image_alt dos 7 artigos para garantir imagens únicas.
Usa apenas urllib (sem dependências externas).
"""

import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://lejvvhzluggyxlfwfoxl.supabase.co"
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

IMAGE_UPDATES = {
    "vivendo-no-automatico": {
        "image_url": "https://images.unsplash.com/photo-1474418397713-003ec9d0c68e?w=800&q=80",
        "image_alt": "Pessoa parada no meio de uma cidade movimentada, olhar reflexivo",
    },
    "plano-simples-de-autocuidado": {
        "image_url": "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&q=80",
        "image_alt": "Caderno de planejamento aberto com marcadores coloridos e caneta",
    },
    "rotina-emocional-sem-pressao": {
        "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
        "image_alt": "Vista de montanhas ao amanhecer, transmitindo calma e recomeço",
    },
    "autoestima-em-dias-dificeis": {
        "image_url": "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&q=80",
        "image_alt": "Pessoa sentada sozinha em área verde, momento de reflexão e cuidado",
    },
    "padroes-emocionais-repetidos": {
        "image_url": "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=800&q=80",
        "image_alt": "Espiral de pedras na praia simbolizando padrões e ciclos",
    },
    "pequenas-conquistas-importam": {
        "image_url": "https://images.unsplash.com/photo-1492552181161-62217fc3076d?w=800&q=80",
        "image_alt": "Planta pequena brotando entre pedras, símbolo de crescimento gradual",
    },
    "descansar-sem-culpa": {
        "image_url": "https://images.unsplash.com/photo-1512438248247-f0f2a5a8b7f0?w=800&q=80",
        "image_alt": "Livro aberto ao lado de xícara de chá em ambiente aconchegante",
    },
}


def check_exists(slug: str) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/articles?slug=eq.{slug}&select=id"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            return len(data) > 0
    except urllib.error.HTTPError as e:
        print(f"  Erro ao verificar {slug}: {e.code} {e.read().decode()}")
        return False


def patch_image(slug: str, image_url: str, image_alt: str):
    url = f"{SUPABASE_URL}/rest/v1/articles?slug=eq.{slug}"
    body = json.dumps({"image_url": image_url, "image_alt": image_alt}).encode("utf-8")
    headers = {**HEADERS, "Prefer": "return=minimal"}
    req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"  IMAGEM ATUALIZADA: {slug} (status {resp.status})")
    except urllib.error.HTTPError as e:
        print(f"  ERRO ao atualizar imagem de {slug}: {e.code} {e.read().decode()}")


def main():
    print("=== Atualizando imagens únicas dos artigos ===\n")
    for slug, img_data in IMAGE_UPDATES.items():
        print(f"Processando: {slug}")
        if check_exists(slug):
            patch_image(slug, img_data["image_url"], img_data["image_alt"])
        else:
            print(f"  Artigo não encontrado — pulando.")
    print("\n=== Concluído ===")


if __name__ == "__main__":
    main()
