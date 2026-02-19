-- =====================================================
-- Migration: Super admin pode CRIAR, ATUALIZAR e EXCLUIR restaurantes
-- Se você rodou supabase-rls-completo ou super-admin-policies, o super_admin
-- só tinha SELECT em restaurants. Esta migration libera INSERT, UPDATE e DELETE.
-- =====================================================

-- INSERT: super_admin pode criar novo restaurante
DROP POLICY IF EXISTS "Super admin can insert restaurants" ON restaurants;
CREATE POLICY "Super admin can insert restaurants"
  ON restaurants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

-- UPDATE: super_admin pode editar qualquer restaurante
DROP POLICY IF EXISTS "Super admin can update restaurants" ON restaurants;
CREATE POLICY "Super admin can update restaurants"
  ON restaurants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

-- DELETE: super_admin pode excluir restaurante
DROP POLICY IF EXISTS "Super admin can delete restaurants" ON restaurants;
CREATE POLICY "Super admin can delete restaurants"
  ON restaurants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

SELECT 'Políticas INSERT/UPDATE/DELETE para super_admin em restaurants aplicadas.' AS mensagem;
