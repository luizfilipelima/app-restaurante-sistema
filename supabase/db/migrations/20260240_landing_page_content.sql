-- ─────────────────────────────────────────────────────────────────────────────
-- landing_page_content
-- Armazena o conteúdo editável da landing page (QuieroFoodLanding).
-- O super-admin pode editar textos, links e listas via painel.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.landing_page_content (
  id           uuid         default gen_random_uuid() primary key,
  section      text         not null,
  key          text         not null,
  value        text,
  content_type text         not null default 'text', -- text | url | json
  updated_at   timestamptz  default now(),
  unique (section, key)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.landing_page_content enable row level security;

-- Leitura pública — a landing page é acessada sem autenticação
create policy "landing_content_public_read"
  on public.landing_page_content
  for select
  using (true);

-- Escrita exclusiva para super_admin
create policy "landing_content_super_admin_write"
  on public.landing_page_content
  for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'super_admin'
    )
  );

-- ── updated_at automático ─────────────────────────────────────────────────────

create or replace function public.set_landing_page_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists landing_page_content_updated_at on public.landing_page_content;
create trigger landing_page_content_updated_at
  before update on public.landing_page_content
  for each row execute function public.set_landing_page_updated_at();

-- ── Seed: valores padrão ──────────────────────────────────────────────────────

insert into public.landing_page_content (section, key, value, content_type) values

  -- ── Hero ────────────────────────────────────────────────────────────────────
  ('hero', 'badge_text',          'Exclusivo para Restaurantes da Tríplice Fronteira',                    'text'),
  ('hero', 'headline',            'Pare de Dividir Seu Lucro com Apps e Acabe com o Caos na Cozinha.',    'text'),
  ('hero', 'headline_highlight',  'Lucro',                                                                'text'),
  ('hero', 'subheadline',         'Do QR Code na mesa à tela da cozinha — gerencie pedidos em Reais e Guaraníes sem pagar 1% de comissão.', 'text'),
  ('hero', 'cta_primary_label',   'Testar 7 Dias Grátis',                                                'text'),
  ('hero', 'cta_secondary_label', 'Entrar na Plataforma',                                                'text'),
  ('hero', 'stat_1_value',        '500+',                                                                 'text'),
  ('hero', 'stat_1_label',        'Restaurantes',                                                         'text'),
  ('hero', 'stat_2_value',        'R$0',                                                                  'text'),
  ('hero', 'stat_2_label',        'Comissão',                                                             'text'),
  ('hero', 'stat_3_value',        '3 Países',                                                             'text'),
  ('hero', 'stat_3_label',        'BR · PY · AR',                                                         'text'),
  ('hero', 'wa_link',             'https://wa.me/5575992776610?text=Ol%C3%A1%20Filipe%2C%20gostaria%20de%20implementar%20o%20QuieroFood%20no%20meu%20neg%C3%B3cio%20com%20o%20plano%20gratuito%20de%207%20dias', 'url'),
  ('hero', 'app_link',            'https://app.quiero.food',                                              'url'),
  ('hero', 'notification_text',   'Novo pedido! 🎉',                                                      'text'),

  -- ── Social Strip ────────────────────────────────────────────────────────────
  ('social_strip', 'items', '["Cardápio Digital","Pedidos em Tempo Real","KDS — Cozinha","Impressão Térmica","Multi-moeda BRL/PYG","Motoboys & Zonas","QR Code na Mesa","Offline-First","BI & Analytics","Comandas Digitais"]', 'json'),

  -- ── Problema ────────────────────────────────────────────────────────────────
  ('problem', 'headline',      'Você é refém do seu restaurante?',                                        'text'),
  ('problem', 'subheadline',   'Nós conhecemos a realidade de Ciudad del Este, Foz e Puerto Iguazú.',     'text'),
  ('problem', 'pains',         '[{"emoji":"📱","text":"O WhatsApp não para de apitar e pedidos chegam errados."},{"emoji":"💸","text":"O iFood e o PedidosYa devoram até 20% da sua margem."},{"emoji":"🌐","text":"O sistema que você usa não entende Guaraníes nem a Fronteira."},{"emoji":"🔌","text":"Qualquer queda de internet paralisa toda a operação."}]', 'json'),
  ('problem', 'closing_text',  'O sistema genérico que você usa hoje trava sua operação em vez de libertá-la.', 'text'),

  -- ── Features ────────────────────────────────────────────────────────────────
  ('features', 'section_label', 'A Solução',                                 'text'),
  ('features', 'headline',      'Gestão Sem Fronteiras, Lucro Sem Limites.', 'text'),

  -- ── Pricing ─────────────────────────────────────────────────────────────────
  ('pricing', 'section_label', 'Planos',                                                      'text'),
  ('pricing', 'headline',      'Escolha o seu nível de poder.',                               'text'),
  ('pricing', 'subtext',       'Sem taxas escondidas. Sem comissão sobre as suas vendas.',    'text'),

  -- ── Testimonials ────────────────────────────────────────────────────────────
  ('testimonials', 'section_label', 'Depoimentos',            'text'),
  ('testimonials', 'headline',      'Quem usa, recomenda.',   'text'),
  ('testimonials', 'items', '[{"quote":"Desde que usamos o Quiero, nossos pedidos saem 30% mais rápido. O suporte local faz a diferença.","name":"Carlos Benitez","role":"Pizzaria Bella Italia","initials":"CB"},{"quote":"A integração com a impressora térmica é perfeita. Não perdemos mais nenhum pedido no horário de pico.","name":"Maria González","role":"Burger House CDE","initials":"MG"},{"quote":"O cardápio em Guarani e Reais facilitou muito para nossos clientes brasileiros e paraguaios.","name":"Fernando Silva","role":"Sushi House","initials":"FS"}]', 'json'),

  -- ── Final CTA ───────────────────────────────────────────────────────────────
  ('final_cta', 'headline',        'Sua transformação começa agora.',                                    'text'),
  ('final_cta', 'body',            'Você pode continuar pagando 20% para aplicativos, ou pode transformar seu restaurante em uma máquina lucrativa e silenciosa hoje.', 'text'),
  ('final_cta', 'cta_label',       'Quero Assumir o Controle do Meu Restaurante',                       'text'),
  ('final_cta', 'guarantee_text',  'Nossa equipe fará um diagnóstico rápido. Se a QuieroFood não for perfeita para você, nós mesmos diremos isso. Risco zero.', 'text'),

  -- ── Navbar ──────────────────────────────────────────────────────────────────
  ('navbar', 'nav_items', '["Funcionalidades","Planos","Contato"]', 'json'),

  -- ── Footer ──────────────────────────────────────────────────────────────────
  ('footer', 'copyright_text', 'QuieroFood. Todos os direitos reservados. Feito para a Tríplice Fronteira.', 'text')

on conflict (section, key) do nothing;
