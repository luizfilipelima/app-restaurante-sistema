-- =============================================================================
-- Migration: RPC get_restaurant_menu — uma única chamada para carregar cardápio
-- Data: 2026-02-87
-- =============================================================================
--
-- Reduz múltiplas requisições HTTP (11+) para uma única chamada RPC.
-- Retorna todos os dados necessários para exibir o cardápio: restaurante,
-- produtos, categorias, subcategorias, opções de pizza/marmita, combos, adicionais.
--
-- Uso: SELECT * FROM get_restaurant_menu('meatburger');
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

  -- 4. Produtos ativos (ordem)
  SELECT COALESCE(jsonb_agg(row_to_json(p.*) ORDER BY
    COALESCE((SELECT order_index FROM categories cat WHERE cat.name = p.category AND cat.restaurant_id = v_rid LIMIT 1), 999),
    p.order_index), '[]'::jsonb)
  INTO v_products
  FROM products p
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

  -- 8. Adicionais: mapa product_id -> array de grupos com items
  SELECT COALESCE(
    (SELECT jsonb_object_agg(ag.product_id, groups)
     FROM (
       SELECT ag.product_id,
              jsonb_agg(
                (SELECT jsonb_build_object(
                  'id', ag.id, 'product_id', ag.product_id, 'name', ag.name, 'order_index', ag.order_index,
                  'items', COALESCE((
                    SELECT jsonb_agg(row_to_json(ai.*) ORDER BY ai.order_index)
                    FROM product_addon_items ai WHERE ai.addon_group_id = ag.id
                  ), '[]'::jsonb)
                ))
                ORDER BY ag.order_index
              ) AS groups
       FROM product_addon_groups ag
       WHERE ag.product_id IN (SELECT id FROM products WHERE restaurant_id = v_rid)
       GROUP BY ag.product_id
     ) sub),
    '{}'::jsonb
  ) INTO v_addon_map;

  -- 9. categories = nomes únicos dos produtos, ordenados por order_index da tabela categories
  WITH prod_cats AS (
    SELECT DISTINCT p->>'category' AS cat FROM jsonb_array_elements(COALESCE(v_products, '[]'::jsonb)) AS p WHERE p->>'category' IS NOT NULL
  )
  SELECT COALESCE(
    jsonb_agg(pc.cat ORDER BY COALESCE((SELECT c.order_index FROM categories c WHERE c.restaurant_id = v_rid AND c.name = pc.cat LIMIT 1), 999)),
    '[]'::jsonb
  ) INTO v_cats_arr
  FROM prod_cats pc;
  v_cats_arr := COALESCE(v_cats_arr, '[]'::jsonb);

  -- 10. Montar resposta final
  v_result := jsonb_build_object(
    'restaurant', v_restaurant,
    'products', v_products,
    'categories', v_cats_arr,
    'categoriesFromDb', v_categories,
    'subcategories', v_subcats,
    'pizzaSizes', v_pizza_sizes,
    'pizzaFlavors', v_pizza_flav,
    'pizzaDoughs', v_pizza_dough,
    'pizzaEdges', v_pizza_edge,
    'marmitaSizes', v_marm_sizes,
    'marmitaProteins', v_marm_prot,
    'marmitaSides', v_marm_sides,
    'productComboItemsMap', COALESCE(v_combo_map, '{}'::jsonb),
    'productAddonsMap', COALESCE(v_addon_map, '{}'::jsonb)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_restaurant_menu(text) IS 'Retorna dados completos do cardápio para exibição pública. Uma única chamada substitui 11+ queries.';

GRANT EXECUTE ON FUNCTION public.get_restaurant_menu(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_menu(text) TO authenticated;
