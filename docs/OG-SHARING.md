# Open Graph / Preview de Links nas Redes Sociais

Quando um link do cardápio ou de qualquer página vinculada a um restaurante é compartilhado no **WhatsApp**, **Facebook**, **Twitter**, **LinkedIn**, etc., a plataforma exibe um preview com:

- **Título**: Nome do restaurante + "— Cardápio"
- **Descrição**: "Confira o cardápio de [Nome]. Peça online com facilidade."
- **Imagem**: Logo do restaurante (ou favicon como fallback)

## Como funciona

O arquivo `middleware.ts` na raiz do projeto roda no **Vercel Edge** e:

1. Detecta se o request vem de um **crawler** (User-Agent: facebookexternalhit, WhatsApp, Twitterbot, etc.)
2. Extrai o **slug** do restaurante da URL (path ou subdomínio)
3. Busca os dados do restaurante (nome, logo) no Supabase
4. Retorna HTML com meta tags **Open Graph** e **Twitter Card**

## URLs suportadas

| Formato | Exemplo |
|---------|---------|
| Path no app | `https://app.quiero.food/pizzaria-da-vitoria` |
| Path + subrota | `https://app.quiero.food/pizzaria-da-vitoria/menu` |
| Subdomínio | `https://pizzaria.quiero.food/` |
| Domínio personalizado | `https://cardapio.seudominio.com.br` (RPC `get_restaurant_slug_by_hostname`) |

## Variáveis de ambiente

As mesmas do app: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O Vercel já as injeta no Edge.

## Como testar

1. Use o [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
2. Ou o [Twitter Card Validator](https://cards-dev.twitter.com/validator)
3. Cole a URL do cardápio e confira o preview

## Imagem recomendada

Para melhor resultado: **1200×630px**, JPG ou PNG. Se o restaurante não tiver logo, é usado o favicon como fallback.
