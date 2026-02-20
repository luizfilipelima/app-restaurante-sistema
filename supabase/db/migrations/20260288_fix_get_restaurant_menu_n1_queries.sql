-- =============================================================================
-- Migration: Corrigir N+1 queries na RPC get_restaurant_menu
-- Data: 2026-02-20
-- =============================================================================
--
-- Problemas identificados na versão anterior:
--
-- 1. ORDENAÇÃO DE PRODUTOS (N+1):
--    A ORDER BY usava correlated subquery executada uma vez por produto:
--    ORDER BY (SELECT order_index FROM categories WHERE name = p.category ...)
--    → substituído por LEFT JOIN (executa 1 JOIN ao invés de N subqueries)
--
-- 2. ARRAY DE CATEGORIAS v_cats_arr (N+1):
--    Usava CTE sobre jsonb já agregado + correlated subquery por categoria.
--    → substituído por GROUP BY diretamente na tabela products + LEFT JOIN categories
--
-- 3. MAPA DE ADICIONAIS v_addon_map (N+1 por grupo):
--    Para cada addon_group, executava uma subquery separada para buscar items.
--    → substituído por LEFT JOIN LATERAL (1 scan ao invés de N subqueries)
--
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_restaurant_menu(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rid         uuid;
  v_restaurant  jsonb;
  v_categories  jsonb;
  v_subcats     jsonb;
  v_products    jsonb;
  v_pizza_sizes jsonb;
  v_pizza_flav  jsonb;
  v_pizza_dough jsonb;
  v_pizza_edge  jsonb;
  v_marm_sizes  jsonb;
  v_marm_prot   jsonb;
  v_marm_sides  jsonb;
  v_combo_map   jsonb;
  v_addon_map   jsonb;
  v_cats_arr    jsonb;
  v_result      jsonb;
BEGIN
  -- 1. Restaurante por slug
  SELECT id, to_jsonb(r.*) INTO v_rid, v_restaurant
  FROM restaurants r
  WHERE r.slug = p_slug AND r.is_active = true;

  IF v_rid IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Categorias (ordem)
  SELECT COALESCE(jsonb_agg(row_to_json(c.*) ORDER BY c.order_index), '[]'::jsonb)
  INTO v_categories
  FROM categories c
  WHERE c.restaurant_id = v_rid;

  -- 3. Subcategorias
  SELECT COALESCE(jsonb_agg(row_to_json(s.*) ORDER BY s.order_index), '[]'::jsonb)
  INTO v_subcats
  FROM subcategories s
  WHERE s.restaurant_id = v_rid;

  -- 4. Produtos ativos — LEFT JOIN elimina a correlated subquery por produto na ORDER BY
  SELECT COALESCE(
    jsonb_agg(row_to_json(p.*) ORDER BY COALESCE(cat.order_index, 999), p.order_index),
    '[]'::jsonb
  )
  INTO v_products
  FROM products p
  LEFT JOIN categories cat ON cat.name = p.category AND cat.restaurant_id = v_rid
  WHERE p.restaurant_id = v_rid AND p.is_active = true;

  -- 5. Pizza
  SELECT COALESCE(jsonb_agg(row_to_json(ps.*) ORDER BY ps.order_index), '[]'::jsonb) INTO v_pizza_sizes FROM pizza_sizes ps WHERE ps.restaurant_id = v_rid;
  SELECT COALESCE(jsonb_agg(row_to_json(pf.*) ORDER BY pf.name), '[]'::jsonb) INTO v_pizza_flav FROM pizza_flavors pf WHERE pf.restaurant_id = v_rid AND pf.is_active = true;
  SELECT COALESCE(jsonb_agg(row_to_json(pd.*) ORDER BY pd.name), '[]'::jsonb) INTO v_pizza_dough FROM pizza_doughs pd WHERE pd.restaurant_id = v_rid AND pd.is_active = true;
  SELECT COALESCE(jsonb_agg(row_to_json(pe.*) ORDER BY pe.name), '[]'::jsonb) INTO v_pizza_edge FROM pizza_edges pe WHERE pe.restaurant_id = v_rid AND pe.is_active = true;

  -- 6. Marmita
  SELECT COALESCE(jsonb_agg(row_to_json(ms.*) ORDER BY ms.order_index), '[]'::jsonb) INTO v_marm_sizes FROM marmita_sizes ms WHERE ms.restaurant_id = v_rid AND ms.is_active = true;
  SELECT COALESCE(jsonb_agg(row_to_json(mp.*) ORDER BY mp.name), '[]'::jsonb) INTO v_marm_prot FROM marmita_proteins mp WHERE mp.restaurant_id = v_rid AND mp.is_active = true;
  SELECT COALESCE(jsonb_agg(row_to_json(ms2.*) ORDER BY ms2.category, ms2.name), '[]'::jsonb) INTO v_marm_sides FROM marmita_sides ms2 WHERE ms2.restaurant_id = v_rid AND ms2.is_active = true;

  -- 7. Combos: mapa combo_product_id -> array de itens com product
  SELECT COALESCE(
    (SELECT jsonb_object_agg(combo_product_id, items)
     FROM (
       SELECT pci.combo_product_id,
              jsonb_agg(
                jsonb_build_object(
                  'id', pci.id, 'combo_product_id', pci.combo_product_id, 'product_id', pci.product_id,
                  'quantity', pci.quantity, 'sort_order', pci.sort_order,
                  'product', jsonb_build_object('id', pr.id, 'name', pr.name, 'price', pr.price, 'price_sale', pr.price_sale)
                ) ORDER BY pci.sort_order
              ) AS items
       FROM product_combo_items pci
       JOIN products pr ON pr.id = pci.product_id
       WHERE pci.combo_product_id IN (SELECT id FROM products WHERE restaurant_id = v_rid AND is_combo = true)
       GROUP BY pci.combo_product_id
     ) sub),
    '{}'::jsonb
  ) INTO v_combo_map;

  -- 8. Adicionais: LEFT JOIN LATERAL elimina a correlated subquery por grupo
  SELECT COALESCE(
    (SELECT jsonb_object_agg(ag_data.product_id, ag_data.groups)
     FROM (
       SELECT ag.product_id,
              jsonb_agg(
                jsonb_build_object(
                  'id',          ag.id,
                  'product_id',  ag.product_id,
                  'name',        ag.name,
                  'order_index', ag.order_index,
                  'items',       COALESCE(ai_agg.items, '[]'::jsonb)
                )
                ORDER BY ag.order_index
              ) AS groups
       FROM product_addon_groups ag
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(row_to_json(ai.*) ORDER BY ai.order_index) AS items
         FROM product_addon_items ai
         WHERE ai.addon_group_id = ag.id
       ) ai_agg ON true
       WHERE ag.product_id IN (SELECT id FROM products WHERE restaurant_id = v_rid)
       GROUP BY ag.product_id
     ) ag_data),
    '{}'::jsonb
  ) INTO v_addon_map;

  -- 9. categories = nomes únicos dos produtos, ordenados — GROUP BY + LEFT JOIN elimina correlated subquery por categoria
  SELECT COALESCE(
    jsonb_agg(cat_name ORDER BY min_order),
    '[]'::jsonb
  )
  INTO v_cats_arr
  FROM (
    SELECT p.category AS cat_name, MIN(COALESCE(cat.order_index, 999)) AS min_order
    FROM products p
    LEFT JOIN categories cat ON cat.name = p.category AND cat.restaurant_id = v_rid
    WHERE p.restaurant_id = v_rid AND p.is_active = true AND p.category IS NOT NULL
    GROUP BY p.category
  ) sub;

  v_cats_arr := COALESCE(v_cats_arr, '[]'::jsonb);

  -- 10. Montar resposta final
  v_result := jsonb_build_object(
    'restaurant',        v_restaurant,
    'products',          v_products,
    'categories',        v_cats_arr,
    'categoriesFromDb',  v_categories,
    'subcategories',     v_subcats,
    'pizzaSizes',        v_pizza_sizes,
    'pizzaFlavors',      v_pizza_flav,
    'pizzaDoughs',       v_pizza_dough,
    'pizzaEdges',        v_pizza_edge,
    'marmitaSizes',      v_marm_sizes,
    'marmitaProteins',   v_marm_prot,
    'marmitaSides',      v_marm_sides,
    'productComboItemsMap', COALESCE(v_combo_map, '{}'::jsonb),
    'productAddonsMap',     COALESCE(v_addon_map, '{}'::jsonb)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_restaurant_menu(text) IS 'Retorna dados completos do cardápio para exibição pública. N+1 eliminado: JOIN em vez de correlated subquery para produtos e categorias; LEFT JOIN LATERAL para adicionais.';

GRANT EXECUTE ON FUNCTION public.get_restaurant_menu(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_menu(text) TO authenticated;
