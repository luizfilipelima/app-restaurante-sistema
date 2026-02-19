-- ─────────────────────────────────────────────────────────────────────────────
-- Conteúdo da landing page principal (quiero.food / rota "/")
-- Seções prefixadas com "main_" para não colidir com a landing premium.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.landing_page_content (section, key, value, content_type) values

  -- ── main_colors ─────────────────────────────────────────────────────────────
  ('main_colors', 'primary_hex',   '#ea580c', 'text'),   -- orange-600
  ('main_colors', 'bg_hex',        '#f8fafc', 'text'),   -- slate-50
  ('main_colors', 'logo_url',      '/quierofood-logo-f.svg', 'url'),

  -- ── main_header ─────────────────────────────────────────────────────────────
  ('main_header', 'wa_link',   'https://wa.me/5575992776610?text=Hola%20Filipe%2C%20me%20gustaria%20testar%20gratis%20el%20sistema%20Quiero%20Food', 'url'),
  ('main_header', 'app_link',  'https://app.quiero.food', 'url'),
  ('main_header', 'cta_label', 'Testar Grátis', 'text'),
  ('main_header', 'nav_item_1','Funcionalidades', 'text'),
  ('main_header', 'nav_item_2','Preços', 'text'),
  ('main_header', 'nav_item_3','FAQ', 'text'),
  ('main_header', 'login_label','Entrar', 'text'),

  -- ── main_hero ────────────────────────────────────────────────────────────────
  ('main_hero', 'badge_text',         'Novo: Modo Cozinha Inteligente v2.0',                                                                        'text'),
  ('main_hero', 'headline',           'O Delivery que vende sozinho no WhatsApp.',                                                                   'text'),
  ('main_hero', 'headline_highlight', 'WhatsApp',                                                                                                    'text'),
  ('main_hero', 'subheadline',        'Cardápio digital, pedidos em tempo real, zonas de entrega, motoboys, cupom térmico e impressão automática. Tudo em um só lugar.', 'text'),
  ('main_hero', 'cta_label',          'Criar Cardápio Grátis',                                                                                       'text'),
  ('main_hero', 'email_placeholder',  'seu@email.com',                                                                                               'text'),
  ('main_hero', 'social_proof_text',  'Usado por <strong>+100 restaurantes</strong> no Paraguai',                                                    'text'),
  ('main_hero', 'social_proof_count', '+100',                                                                                                         'text'),
  ('main_hero', 'hero_image_url',     '',                                                                                                             'url'),
  ('main_hero', 'hero_image_alt',     'Dashboard do QuieroFood',                                                                                     'text'),
  ('main_hero', 'hero_image_label',   'Dashboard Screenshot Mockup',                                                                                 'text'),

  -- ── main_problem (bento) ─────────────────────────────────────────────────────
  ('main_problem', 'section_title',    'Adeus, caderninho.',                                                                                          'text'),
  ('main_problem', 'section_subtitle', 'Automatize o processo desde o pedido até a entrega.',                                                         'text'),
  ('main_problem', 'card1_title',      'Fim do Caos no WhatsApp',                                                                                     'text'),
  ('main_problem', 'card1_desc',       'Organize todos os pedidos em um único painel. Sem prints, sem áudios perdidos.',                              'text'),
  ('main_problem', 'card1_cta',        'Ver Demo',                                                                                                    'text'),
  ('main_problem', 'card2_title',      'Impressão Automática',                                                                                        'text'),
  ('main_problem', 'card2_desc',       'O pedido sai direto na cozinha.',                                                                             'text'),
  ('main_problem', 'card3_title',      'QR Code na Mesa',                                                                                             'text'),
  ('main_problem', 'card3_desc',       'Cardápio digital sem contato.',                                                                               'text'),
  ('main_problem', 'card4_title',      'Mapa de Calor',                                                                                               'text'),
  ('main_problem', 'card4_desc',       'Saiba onde seus clientes estão.',                                                                             'text'),

  -- ── main_features ────────────────────────────────────────────────────────────
  ('main_features', 'section_title',    'Tudo o que você precisa para vender mais.',                                                                   'text'),
  ('main_features', 'section_subtitle', 'Um único sistema: cardápio, pedidos, cozinha, entrega e impressão. Sem mensalidades escondidas.',             'text'),
  ('main_features', 'footer_cta',       '+ Modo Cozinha em tela cheia · QR Code na mesa · Logo e cores do seu negócio · Suporte para crescer.',       'text'),
  ('main_features', 'groups', '[
    {"title":"Venda e cardápio","description":"Seu negócio online profissional, sem complicação.","color":"orange","items":["Cardápio digital com seu link (ex: sua-loja.quiero.food)","Categorias, fotos e descrições dos produtos","Montagem de pizzas: tamanhos, sabores, massas e bordas","Retirada ou entrega; cliente escolhe no checkout","Multi-moeda: Reais e Guaranies no mesmo cardápio"]},
    {"title":"Pedidos em tempo real","description":"Nada se perde. Tudo num só lugar.","color":"amber","items":["Kanban visual: Pendente → Preparando → Pronto → Entrega → Concluído","Pedidos chegam na hora (Realtime); sem F5","Modo Cozinha: tela dedicada para a equipe de produção","Marcar como pago e acompanhar status em um clique"]},
    {"title":"Entrega sob controle","description":"Taxas certas e entregadores organizados.","color":"blue","items":["Zonas de entrega com taxa por bairro (Centro, Km 7, etc.)","Gestão de motoboys: cadastro, status e atribuição ao pedido","Select no pedido para definir quem vai entregar","Endereço e bairro no resumo para o entregador"]},
    {"title":"Impressão e operação","description":"Cozinha e caixa alinhados, sem papel em branco.","color":"slate","items":["Cupom não fiscal para impressoras térmicas (58mm e 80mm)","Impressão automática ao receber pedido (opcional)","Botão imprimir em qualquer pedido quando quiser","Layout pronto: itens, totais, endereço e observações"]},
    {"title":"Horário e disponibilidade","description":"Você decide quando está aberto.","color":"emerald","items":["Horário de funcionamento por dia da semana","Opção \"Sempre aberto (24h)\" para quem não para","Fechado manualmente: um clique e o cardápio mostra \"Fechado\"","Cliente não finaliza pedido fora do horário"]},
    {"title":"Pagamento e WhatsApp","description":"Cliente paga como preferir; você recebe o pedido formatado.","color":"green","items":["PIX, cartão na entrega e dinheiro com campo de troco","Ao finalizar, mensagem pronta para enviar no WhatsApp do restaurante","Resumo do pedido, endereço e total na mensagem","Integração pensada para a fronteira (BR/PY)"]},
    {"title":"Painel e relatórios","description":"Visão clara do seu negócio.","color":"violet","items":["Dashboard com métricas: pedidos, faturamento e ticket médio","Gráficos e indicadores por período","Configurações: logo, cores, telefone, Instagram","Domínio e link do cardápio na mão"]},
    {"title":"Segurança e multi-marca","description":"Cada restaurante vê só o que é seu.","color":"red","items":["Sistema multi-tenant: um plano, vários restaurantes (super admin)","Favicon dinâmico: cliente vê a logo do seu restaurante na aba","Controle de acesso por perfil (admin, cozinha)","Dados na nuvem (Supabase) com políticas de segurança"]}
  ]', 'json'),

  -- ── main_testimonials ────────────────────────────────────────────────────────
  ('main_testimonials', 'section_title',    'Quem usa, recomenda.',                                                'text'),
  ('main_testimonials', 'section_subtitle', 'Junte-se aos melhores restaurantes da fronteira.',                   'text'),
  ('main_testimonials', 'items', '[
    {"name":"Carlos Benitez","role":"Dono, Pizzaria Bella Italia","content":"Desde que usamos o Quiero, nossos pedidos saem 30% mais rápido. O suporte local faz a diferença.","rating":5},
    {"name":"Maria González","role":"Gerente, Burger King CDE","content":"A integração com a impressora térmica é perfeita. Não perdemos mais nenhum pedido no horário de pico.","rating":5},
    {"name":"Fernando Silva","role":"Sushi House","content":"O cardápio em Guarani e Reais facilitou muito para nossos clientes brasileiros e paraguaios.","rating":5}
  ]', 'json'),

  -- ── main_pricing ─────────────────────────────────────────────────────────────
  ('main_pricing', 'section_title',    'Investimento que se paga com mais pedidos.',                              'text'),
  ('main_pricing', 'section_subtitle', 'Um preço fixo. Todas as funções do sistema. Sem surpresas na fatura.',   'text'),
  ('main_pricing', 'price_basic',      '$15',                                                                     'text'),
  ('main_pricing', 'price_pro',        '$100',                                                                    'text'),
  ('main_pricing', 'price_enterprise', '$70+',                                                                    'text'),
  ('main_pricing', 'plans', '[
    {"name":"Iniciante","price":"Grátis","period":"Para sempre","features":["Até 50 pedidos/mês","Cardápio digital básico","Recebimento via WhatsApp","1 usuário admin"],"cta":"Começar agora","popular":false},
    {"name":"Pro","price":"$100","period":"/mês","features":["Pedidos ilimitados","Cardápio digital com seu link (sualoja.quiero.food)","Pedidos em tempo real (Kanban + Modo Cozinha)","Zonas de entrega e taxa por bairro","Gestão de motoboys e atribuição ao pedido","Impressão de cupom térmico (58mm/80mm)","Impressão automática ao receber pedido","Horário de funcionamento e opção 24h","Multi-moeda (Reais e Guaranies)","PIX, cartão e dinheiro com troco","Dashboard com métricas e relatórios","Logo, cores e favicon do seu restaurante","Suporte prioritário","Até 3 usuários admin"],"cta":"Testar 7 dias grátis","popular":true},
    {"name":"Enterprise","price":"Consultar","period":"","features":["Tudo do Pro","Múltiplas filiais","App na loja (sob consulta)","API de integração","Gerente de conta dedicado","Treinamento presencial"],"cta":"Falar com vendas","popular":false}
  ]', 'json'),
  ('main_pricing', 'comparison_features', '[
    {"name":"Cardápio Digital","basic":true,"pro":true,"enterprise":true},
    {"name":"Pedidos via WhatsApp","basic":true,"pro":true,"enterprise":true},
    {"name":"Zonas de entrega (taxa por bairro)","basic":false,"pro":true,"enterprise":true},
    {"name":"Gestão de motoboys","basic":false,"pro":true,"enterprise":true},
    {"name":"Impressão automática (cupom térmico)","basic":false,"pro":true,"enterprise":true},
    {"name":"Pedidos em tempo real (Kanban + Cozinha)","basic":false,"pro":true,"enterprise":true},
    {"name":"Dashboard e BI (métricas)","basic":false,"pro":true,"enterprise":true},
    {"name":"BI avançado e relatórios custom","basic":false,"pro":false,"enterprise":true},
    {"name":"Domínio próprio (.com)","basic":false,"pro":false,"enterprise":true}
  ]', 'json'),

  -- ── main_faq ─────────────────────────────────────────────────────────────────
  ('main_faq', 'section_title',    'Dúvidas frequentes.',                                  'text'),
  ('main_faq', 'section_subtitle', 'Tudo o que você precisa saber antes de começar.',      'text'),
  ('main_faq', 'items', '[
    {"question":"Preciso de cartão de crédito para testar?","answer":"Não. Você pode criar sua conta e testar o plano Pro por 7 dias grátis. Só pedimos o cartão se decidir continuar após o período de teste."},
    {"question":"Funciona em celular e tablet?","answer":"Sim! O sistema é 100% responsivo e funciona em qualquer dispositivo com navegador (Chrome, Safari, etc). O painel do restaurante é otimizado para tablets e computadores."},
    {"question":"O que está incluso nos $100/mês?","answer":"Tudo: cardápio digital com seu link, pedidos em tempo real (Kanban + Modo Cozinha), zonas de entrega, gestão de motoboys, impressão de cupom térmico (inclusive automática), horário de funcionamento, multi-moeda, dashboard com métricas e até 3 usuários. Sem custos escondidos."},
    {"question":"Como funciona a impressão automática?","answer":"No painel você ativa a opção ''Impressão automática ao receber pedido'' e escolhe a largura do papel (58mm ou 80mm). Quando um novo pedido chega, o navegador abre a janela de impressão e você seleciona a impressora térmica. O cupom sai com itens, totais e endereço."},
    {"question":"Posso usar meu próprio domínio .com?","answer":"No plano Pro você usa seu link no formato sualoja.quiero.food. Domínio próprio (.com) pode ser disponibilizado em versões Enterprise; consulte-nos."}
  ]', 'json'),

  -- ── main_footer ──────────────────────────────────────────────────────────────
  ('main_footer', 'tagline',        'O sistema de delivery mais amado da fronteira. Feito para quem tem fome de crescer.', 'text'),
  ('main_footer', 'instagram_url',  '#', 'url'),
  ('main_footer', 'facebook_url',   '#', 'url'),
  ('main_footer', 'twitter_url',    '#', 'url'),
  ('main_footer', 'copyright_text', 'Quiero Food. Todos os direitos reservados.', 'text'),
  ('main_footer', 'made_in_text',   'Feito com ❤️ em Ciudad del Este', 'text'),
  ('main_footer', 'product_cols',   '[{"title":"Produto","links":[{"label":"Cardápio Digital","href":"#"},{"label":"Gestão de Pedidos","href":"#"},{"label":"Integração WhatsApp","href":"#"},{"label":"Impressão Térmica","href":"#"}]},{"title":"Empresa","links":[{"label":"Sobre Nós","href":"#"},{"label":"Carreiras","href":"#"},{"label":"Blog","href":"#"},{"label":"Contato","href":"#"}]},{"title":"Legal","links":[{"label":"Termos de Uso","href":"#"},{"label":"Privacidade","href":"#"},{"label":"Cookies","href":"#"}]}]', 'json')

on conflict (section, key) do nothing;
