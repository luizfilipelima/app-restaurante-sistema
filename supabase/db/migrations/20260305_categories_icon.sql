-- Migration: Ícone customizável para categorias sem imagem
-- Data: 2026-02-22
-- Descrição: Permite que o restaurante defina um ícone para categorias sem imagem (ex: Bebidas, Sobremesas)
-- Valores: nome do ícone Lucide (Coffee, Wine, UtensilsCrossed, Pizza, etc.)

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS icon TEXT;

COMMENT ON COLUMN categories.icon IS 'Ícone Lucide para categoria sem imagem: Coffee, Wine, Beer, UtensilsCrossed, Pizza, Cake, Salad, Sandwich, IceCream, Utensils';
