-- ============================================================
-- STORAGE: Bucket product-images (imagens do cardápio em WebP)
-- ============================================================
-- 1. No Supabase: Storage → New bucket → Nome: product-images → Public bucket → Create
-- 2. Depois execute este SQL no SQL Editor para as políticas de upload.
-- ============================================================

-- Permite admin do restaurante fazer upload na pasta do seu restaurante
-- e super_admin em qualquer pasta
DROP POLICY IF EXISTS "Admin e super_admin podem fazer upload de imagens" ON storage.objects;
CREATE POLICY "Admin e super_admin podem fazer upload de imagens"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND (
        (u.role = 'restaurant_admin' AND (storage.foldername(name))[1] = u.restaurant_id::text)
        OR u.role = 'super_admin'
      )
    )
  )
);

-- Leitura pública (útil se o bucket for público; pode já estar coberto)
DROP POLICY IF EXISTS "Leitura pública das imagens do cardápio" ON storage.objects;
CREATE POLICY "Leitura pública das imagens do cardápio"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'product-images' );
