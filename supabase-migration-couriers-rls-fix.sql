-- =====================================================
-- Migration: Garantir políticas RLS corretas para couriers
-- Garante que restaurant_admin e super_admin possam gerenciar entregadores
-- =====================================================

-- Garantir que RLS está habilitado
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;

-- SELECT: restaurant_admin do restaurante OU super_admin
DROP POLICY IF EXISTS "Restaurant staff can read their couriers" ON couriers;
DROP POLICY IF EXISTS "Admin or super_admin read couriers" ON couriers;
CREATE POLICY "Admin or super_admin read couriers"
  ON couriers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = couriers.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );

-- INSERT: restaurant_admin do restaurante OU super_admin
DROP POLICY IF EXISTS "Restaurant staff can insert their couriers" ON couriers;
DROP POLICY IF EXISTS "Admin or super_admin insert couriers" ON couriers;
CREATE POLICY "Admin or super_admin insert couriers"
  ON couriers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = couriers.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );

-- UPDATE: restaurant_admin do restaurante OU super_admin
DROP POLICY IF EXISTS "Restaurant staff can update their couriers" ON couriers;
DROP POLICY IF EXISTS "Admin or super_admin update couriers" ON couriers;
CREATE POLICY "Admin or super_admin update couriers"
  ON couriers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = couriers.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = couriers.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );

-- DELETE: restaurant_admin do restaurante OU super_admin
DROP POLICY IF EXISTS "Restaurant staff can delete their couriers" ON couriers;
DROP POLICY IF EXISTS "Admin or super_admin delete couriers" ON couriers;
CREATE POLICY "Admin or super_admin delete couriers"
  ON couriers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'restaurant_admin' AND u.restaurant_id = couriers.restaurant_id)
        OR u.role = 'super_admin'
      )
    )
  );

SELECT 'Políticas RLS para couriers atualizadas (restaurant_admin + super_admin).' AS mensagem;
