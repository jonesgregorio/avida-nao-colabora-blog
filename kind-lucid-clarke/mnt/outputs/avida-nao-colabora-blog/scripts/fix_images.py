"""
Script para atualizar imagens únicas de cada artigo via Supabase REST API.
"""
import json
import urllib.request

SUPABASE_URL = "https://lejvvhzluggyxlfwfoxl.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlanZ2aHpsdWdneXhsZndmb3hsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTM4NjgyMiwiZXhwIjoyMDk2OTYyODIyfQ.yfQaMFSumWQfTDDPpH6UJJdvGKVifSQz8EuhQWo-NZg"

IMAGES = {
  "como-entender-o-que-voce-sente": ("https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&q=80", "Pessoa em reflexão olhando para o horizonte"),
  "quando-a-cabeca-nao-desliga": ("https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=800&q=80", "Pessoa deitada com expressão pensativa"),
  "pequenos-rituais-para-dias-dificeis": ("https://images.unsplash.com/photo-1544376664-80b17f09d399?w=800&q=80", "Xícara de chá sobre mesa de madeira"),
  "rotina-emocional-sem-pressao": ("https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80", "Caderno aberto com luz natural"),
  "cansado-de-tentar": ("https://images.unsplash.com/photo-1541199249251-f713e6145474?w=800&q=80", "Pessoa apoiada na janela com olhar distante"),
  "diario-para-organizar-pensamentos": ("https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80", "Mão escrevendo em caderno"),
  "autocuidado-nao-precisa-ser-perfeito": ("https://images.unsplash.com/photo-1515023115689-589c33041d3c?w=800&q=80", "Luz suave entrando pela janela"),
  "perceber-gatilhos-emocionais": ("https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=800&q=80", "Ondas do mar em movimento"),
  "sobrecarregado": ("https://images.unsplash.com/photo-1471286174890-9c112ac6a852?w=800&q=80", "Pessoa com mãos no rosto em pausa"),
  "autocobranca-no-dia-a-dia": ("https://images.unsplash.com/photo-1534330207526-8e81f10ec6fc?w=800&q=80", "Relógio sobre mesa"),
  "pequenas-conquistas-importam": ("https://images.unsplash.com/photo-1492552181161-62217fc3076d?w=800&q=80", "Planta pequena crescendo entre pedras"),
  "descansar-sem-culpa": ("https://images.unsplash.com/photo-1511376777868-611b54f68947?w=800&q=80", "Pessoa relaxada em rede"),
  "limites-sem-culpa": ("https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80", "Duas pessoas conversando em ambiente tranquilo"),
  "ansiedade-nas-pequenas-coisas": ("https://images.unsplash.com/photo-1474418397713-003ec9d0c68e?w=800&q=80", "Cidade movimentada vista de longe"),
  "pensamentos-confusos-em-palavras": ("https://images.unsplash.com/photo-1455711110434-b55cd8a56149?w=800&q=80", "Mão escrevendo com luz suave"),
  "o-que-escrever-no-diario": ("https://images.unsplash.com/photo-1519791883288-dc8bd696e667?w=800&q=80", "Caderno aberto vazio sobre mesa"),
  "autoestima-em-dias-dificeis": ("https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80", "Pôr do sol refletido em lago calmo"),
  "padroes-emocionais-repetidos": ("https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=800&q=80", "Espelho refletindo imagem"),
  "plano-simples-de-autocuidado": ("https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80", "Pessoa caminhando em trilha na natureza"),
  "vivendo-no-automatico": ("https://images.unsplash.com/photo-1528716321680-815a8cdb8cbe?w=800&q=80", "Estrada com reflexos de luz"),
  "quando-voce-esta-cansado-ate-de-tentar": ("https://images.unsplash.com/photo-1483354483454-4cd359948304?w=800&q=80", "Pessoa descansando no sofá com expressão cansada"),
  "como-impor-limites-sem-se-sentir-uma-pessoa-ruim": ("https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80", "Pessoa em posição de escuta e diálogo"),
  "como-criar-uma-rotina-emocional-sem-pressao": ("https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&q=80", "Mesa organizada com agenda e café"),
  "o-que-fazer-quando-a-cabeca-nao-desliga": ("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80", "Pessoa em reflexão com luz suave"),
  "o-que-escrever-no-diario-quando-voce-nao-sabe-por-onde-comecar": ("https://images.unsplash.com/photo-1516414447565-b14be0adf13e?w=800&q=80", "Caderno aberto com caneta em mesa aconchegante"),
}

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

def patch_article(slug, image_url, image_alt):
    url = f"{SUPABASE_URL}/rest/v1/articles?slug=eq.{slug}"
    data = json.dumps({"image_url": image_url, "image_alt": image_alt}).encode()
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="PATCH")
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            print(f"  [{status}] {slug}")
    except Exception as e:
        print(f"  [ERRO] {slug}: {e}")

def main():
    print(f"Atualizando imagens de {len(IMAGES)} artigos...\n")
    for slug, (image_url, image_alt) in IMAGES.items():
        patch_article(slug, image_url, image_alt)
    print("\nConcluído!")

if __name__ == "__main__":
    main()
