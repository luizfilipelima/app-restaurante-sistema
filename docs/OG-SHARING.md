# Open Graph / Preview de Links nas Redes Sociais

Quando um link do cardápio ou de qualquer página vinculada a um restaurante é compartilhado no **WhatsApp**, **Facebook**, **Twitter**, **LinkedIn**, etc., a plataforma exibe um preview com:

- **Título**: Nome do restaurante + "— Cardápio"
- **Descrição**: "Confira o cardápio de [Nome]. Peça online com facilidade."
- **Imagem**: Logo do restaurante (ou og-image.png como fallback)

## Como funciona

O arquivo `middleware.ts` na raiz do projeto roda no **Vercel Edge** e:

1. Detecta se o request vem de um **crawler** (User-Agent: facebookexternalhit, WhatsApp, Twitterbot, etc.)
2. Extrai o **slug** do restaurante da URL (path ou subdomínio)
3. Busca os dados do restaurante (nome, logo) no Supabase
4. Retorna HTML com meta tags **Open Graph** e **Twitter Card** (URLs absolutas)

## URLs suportadas

| Formato | Exemplo |
|---------|---------|
| **Brand (landing/login)** | `https://quiero.food`, `https://app.quiero.food/`, `https://app.quiero.food/login` |
| Path no app | `https://app.quiero.food/pizzaria-da-vitoria` |
| Path + subrota | `https://app.quiero.food/pizzaria-da-vitoria/menu` |
| Subdomínio | `https://pizzaria.quiero.food/` |
| Domínio personalizado | `https://cardapio.seudominio.com.br` (RPC `get_restaurant_slug_by_hostname`) |

Para landing e login, o preview usa a imagem `og-image.png` (1200×630px, logo QuieroFood em fundo laranja #F87116).

## Variáveis de ambiente (Vercel)

**Obrigatórias** para o middleware funcionar — configure em Project Settings → Environment Variables:

| Variável | Fallback |
|----------|----------|
| `VITE_SUPABASE_URL` | `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

Se essas variáveis não existirem, o middleware repassa o request ao SPA e o crawler recebe o `index.html` (com meta tags estáticas). O `index.html` já tem URLs absolutas para `og:image` (`https://app.quiero.food/og-image.png`).

## Domínios no Vercel

Configure no projeto:

- Domínio principal: `app.quiero.food` (e/ou `quiero.food`)
- Subdomínios de restaurantes: `*.quiero.food` (wildcard)

## Como testar

1. [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — testa Facebook e WhatsApp
2. [Twitter Card Validator](https://cards-dev.twitter.com/validator)
3. Cole a URL e force **"Scrape Again"** para limpar cache

## Imagem recomendada

- **og-image.png**: 1200×630px (gerado automaticamente no build via `generate:og-image`)
- Restaurante sem logo: fallback para `og-image.png`
