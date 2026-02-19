-- ============================================================
-- Permitir que staff do restaurante e super_admin excluam pedidos
-- (necessário para a opção "Resetar dados" da dashboard)
-- Execute no Supabase: SQL Editor → New query → Cole → Run
-- ============================================================

DROP POLICY IF EXISTS "Restaurant staff can delete their orders" ON orders;
CREATE POLICY "Restaurant staff can delete their orders"
  ON orders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.restaurant_id = orders.restaurant_id
        OR users.role = 'super_admin'
      )
    )
  );

SELECT 'Política de DELETE em orders aplicada.' AS mensagem;
