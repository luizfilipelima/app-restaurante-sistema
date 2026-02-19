-- ─────────────────────────────────────────────────────────────────────────────
-- Campos extras da landing page principal (quiero.food / rota "/")
-- Novos campos adicionados ao editor:
--   • Header: nav_items (JSON com label + href)
--   • Hero: cta_link, social_avatar_1/2/3/4
--   • Bento: card2_icon–card6_icon, card5_title/desc, card6_title/desc
--   • Depoimentos: image_url nos itens (via JSON)
--   • Preços: já existente, sem novos campos de DB
--   • Rodapé: footer_logo_url
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.landing_page_content (section, key, value, content_type) values

  -- ── main_header – nav items com links ────────────────────────────────────
  ('main_header', 'nav_items', '[
    {"label":"Funcionalidades","href":"#features"},
    {"label":"Preços","href":"#pricing"},
    {"label":"FAQ","href":"#faq"}
  ]', 'json'),

  -- ── main_hero – link do CTA e avatares da prova social ───────────────────
  ('main_hero', 'cta_link',        '', 'url'),
  ('main_hero', 'social_avatar_1', '', 'url'),
  ('main_hero', 'social_avatar_2', '', 'url'),
  ('main_hero', 'social_avatar_3', '', 'url'),
  ('main_hero', 'social_avatar_4', '', 'url'),

  -- ── main_problem – ícones customizáveis e cards 5 e 6 ───────────────────
  ('main_problem', 'card2_icon',  'Printer',    'text'),
  ('main_problem', 'card3_icon',  'QrCode',     'text'),
  ('main_problem', 'card4_icon',  'BarChart',   'text'),
  ('main_problem', 'card5_title', 'Entregas em Tempo Real',                        'text'),
  ('main_problem', 'card5_desc',  'Acompanhe cada pedido até a porta do cliente.', 'text'),
  ('main_problem', 'card5_icon',  'Zap',        'text'),
  ('main_problem', 'card6_title', 'Relatórios Inteligentes',                       'text'),
  ('main_problem', 'card6_desc',  'Dados e insights para crescer mais rápido.',    'text'),
  ('main_problem', 'card6_icon',  'TrendingUp', 'text'),

  -- ── main_footer – logo exclusiva do rodapé ───────────────────────────────
  ('main_footer', 'footer_logo_url', '', 'url')

on conflict (section, key) do nothing;
