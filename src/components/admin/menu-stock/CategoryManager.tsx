import { useState, useEffect } from 'react';
import { supabase } from '@/lib/core/supabase';
import { Category, Subcategory } from '@/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/shared/use-toast';
import { GripVertical, Loader2, Check, X, Plus, Trash2, ChevronDown, ChevronRight, Pencil, Upload } from 'lucide-react';
import { uploadProductImage } from '@/lib/imageUpload';
import CategoryIconPicker from './CategoryIconPicker';
import { getCategoryIconComponent } from '@/lib/menu/categoryIcons';

const CATEGORY_TYPES = [
  { id: 'default', label: 'Padrão', is_pizza: false, is_marmita: false, extra_field: null, extra_label: null, extra_placeholder: null },
  { id: 'pizza', label: 'Custom', is_pizza: true, is_marmita: false, extra_field: null, extra_label: null, extra_placeholder: null },
  { id: 'volume', label: 'Bebidas (volume)', is_pizza: false, is_marmita: false, extra_field: 'volume', extra_label: 'Volume ou medida', extra_placeholder: 'Ex: 350ml, 1L, 2L' },
  { id: 'portion', label: 'Sobremesas (porção)', is_pizza: false, is_marmita: false, extra_field: 'portion', extra_label: 'Porção', extra_placeholder: 'Ex: individual, fatia, 500g' },
  { id: 'detail', label: 'Combos (detalhe)', is_pizza: false, is_marmita: false, extra_field: 'detail', extra_label: 'Detalhe do combo', extra_placeholder: 'Ex: Pizza + Refrigerante' },
] as const;

interface CategoryManagerProps {
  restaurantId: string;
  onCategoriesChange?: () => void;
}

interface SortableCategoryRowProps {
  category: Category;
  subcategories: Subcategory[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSubcategoriesChange: () => void;
}

function SortableCategoryRow({
  category,
  subcategories,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onSubcategoriesChange,
}: SortableCategoryRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const [subs, setSubs] = useState<Subcategory[]>(subcategories);
  const [savingSubs, setSavingSubs] = useState(false);
  const [hasSubChanges, setHasSubChanges] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [addingSub, setAddingSub] = useState(false);

  useEffect(() => {
    setSubs(subcategories);
  }, [subcategories]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSubDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSubs((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, order_index: index }));
      setHasSubChanges(true);
      return reordered;
    });
  };

  const saveSubOrder = async () => {
    if (!hasSubChanges) return;
    setSavingSubs(true);
    try {
      const updatePromises = subs.map((sub, index) =>
        supabase.from('subcategories').update({ order_index: index }).eq('id', sub.id)
      );
      const results = await Promise.all(updatePromises);
      const err = results.find((r) => r.error);
      if (err?.error) throw new Error(err.error.message);
      setHasSubChanges(false);
      onSubcategoriesChange();
      toast({ title: 'Ordem das subcategorias salva!' });
    } catch (e) {
      toast({ title: 'Erro ao salvar ordem', variant: 'destructive' });
    } finally {
      setSavingSubs(false);
    }
  };

  const addSubcategory = async () => {
    const name = newSubName.trim();
    if (!name) return;
    try {
      const nextOrder = subs.length;
      const { data, error } = await supabase
        .from('subcategories')
        .insert({
          restaurant_id: category.restaurant_id,
          category_id: category.id,
          name,
          order_index: nextOrder,
        })
        .select('*')
        .single();
      if (error) throw error;
      setSubs((prev) => [...prev, data]);
      setNewSubName('');
      setAddingSub(false);
      onSubcategoriesChange();
      toast({ title: 'Subcategoria adicionada!' });
    } catch (e) {
      toast({ title: 'Erro ao adicionar subcategoria', variant: 'destructive' });
    }
  };

  const deleteSubcategory = async (sub: Subcategory) => {
    if (!confirm(`Remover subcategoria "${sub.name}"? Produtos vinculados ficarão sem subcategoria.`)) return;
    try {
      const { error } = await supabase.from('subcategories').delete().eq('id', sub.id);
      if (error) throw error;
      await supabase.from('products').update({ subcategory_id: null }).eq('subcategory_id', sub.id);
      setSubs((prev) => prev.filter((s) => s.id !== sub.id));
      onSubcategoriesChange();
      toast({ title: 'Subcategoria removida!' });
    } catch (e) {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div
        className={`flex items-center gap-3 p-4 bg-white dark:bg-slate-900 ${
          isDragging ? 'border-primary shadow-lg' : ''
        }`}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <button
          type="button"
          onClick={onToggleExpand}
          className="p-0.5 text-slate-500 hover:text-foreground"
          aria-label={expanded ? 'Recolher' : 'Expandir'}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {category.image_url ? (
              <img src={category.image_url} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
                {(() => {
                  const IconComp = getCategoryIconComponent(category.icon);
                  return <IconComp className="h-5 w-5" />;
                })()}
              </div>
            )}
            <div>
              <div className="font-medium text-foreground">{category.name}</div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {category.is_pizza && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">Custom</span>}
                {category.extra_field && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Extra</span>}
                <span className="text-xs text-muted-foreground">Posição: {category.order_index + 1}</span>
              </div>
            </div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onEdit} title="Editar categoria">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete} title="Excluir categoria">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Subcategorias</span>
            {hasSubChanges && (
              <Button size="sm" variant="outline" onClick={saveSubOrder} disabled={savingSubs}>
                {savingSubs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Salvar ordem
              </Button>
            )}
          </div>
          {addingSub ? (
            <div className="flex gap-2">
              <Input
                placeholder="Nome da subcategoria"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubcategory()}
              />
              <Button size="sm" onClick={addSubcategory} disabled={!newSubName.trim()}>
                Adicionar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingSub(false); setNewSubName(''); }}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAddingSub(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova subcategoria
            </Button>
          )}
          <SubcategorySortableList
            subcategories={subs}
            onDragEnd={handleSubDragEnd}
            onDelete={deleteSubcategory}
            onOrderChange={() => setHasSubChanges(true)}
          />
        </div>
      )}
    </div>
  );
}

function SubcategorySortableItem({
  subcategory,
  onDelete,
}: {
  subcategory: Subcategory;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: subcategory.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-2 px-3 rounded border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
      <div {...attributes} {...listeners} className="cursor-grab text-slate-400">
        <GripVertical className="h-4 w-4" />
      </div>
      <span className="flex-1 text-sm">{subcategory.name}</span>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SubcategorySortableList({
  subcategories,
  onDragEnd,
  onDelete,
  onOrderChange,
}: {
  subcategories: Subcategory[];
  onDragEnd: (event: DragEndEvent) => void;
  onDelete: (sub: Subcategory) => void;
  onOrderChange: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  if (subcategories.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma subcategoria. Adicione uma para agrupar produtos (ex: configurações de pizza).</p>;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => { onDragEnd(e); onOrderChange(); }}>
      <SortableContext items={subcategories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {subcategories.map((sub) => (
            <SubcategorySortableItem key={sub.id} subcategory={sub} onDelete={() => onDelete(sub)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export default function CategoryManager({ restaurantId, onCategoriesChange }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Record<string, Subcategory[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<string>(CATEGORY_TYPES[0].id);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formIcon, setFormIcon] = useState<string>('');
  const [imageUploading, setImageUploading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; type: string; image_url: string; icon: string }>({ name: '', type: CATEGORY_TYPES[0].id, image_url: '', icon: '' });
  const [editImageUploading, setEditImageUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadData = async () => {
    if (!restaurantId) return;
    try {
      setLoading(true);
      const [catRes, subRes] = await Promise.all([
        supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('order_index', { ascending: true }),
        supabase.from('subcategories').select('*').eq('restaurant_id', restaurantId).order('order_index', { ascending: true }),
      ]);
      if (catRes.error) throw catRes.error;
      if (subRes.error) throw subRes.error;
      setCategories(catRes.data || []);
      const byCat: Record<string, Subcategory[]> = {};
      (subRes.data || []).forEach((s) => {
        if (!byCat[s.category_id]) byCat[s.category_id] = [];
        byCat[s.category_id].push(s);
      });
      setSubcategoriesByCategory(byCat);
      setHasChanges(false);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast({
        title: 'Erro ao carregar categorias',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (restaurantId) loadData();
  }, [restaurantId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, order_index: index }));
        setHasChanges(true);
        return newItems;
      });
    }
  };

  const handleSaveOrder = async () => {
    if (!restaurantId || !hasChanges) return;
    try {
      setSaving(true);
      const updatePromises = categories.map((cat, index) =>
        supabase.from('categories').update({ order_index: index }).eq('id', cat.id).eq('restaurant_id', restaurantId)
      );
      const results = await Promise.all(updatePromises);
      const err = results.find((r) => r.error);
      if (err?.error) throw new Error(err.error.message);
      setHasChanges(false);
      onCategoriesChange?.();
      toast({ title: 'Ordem das categorias salva!' });
    } catch (error) {
      toast({ title: 'Erro ao salvar ordem', variant: 'destructive' });
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    loadData();
    toast({ title: 'Alterações canceladas' });
  };

  const handleAddCategory = async () => {
    const name = formName.trim();
    if (!name) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      toast({ title: 'Já existe uma categoria com esse nome', variant: 'destructive' });
      return;
    }
    const preset = CATEGORY_TYPES.find((t) => t.id === formType) || CATEGORY_TYPES[0];
    try {
      const nextOrder = categories.length;
      const { error } = await supabase.from('categories').insert({
        restaurant_id: restaurantId,
        name,
        order_index: nextOrder,
        image_url: formImageUrl.trim() || null,
        icon: formIcon.trim() || null,
        is_pizza: preset.is_pizza,
        is_marmita: preset.is_marmita,
        extra_field: preset.extra_field,
        extra_label: preset.extra_label,
        extra_placeholder: preset.extra_placeholder,
      });
      if (error) throw error;
      setModalOpen(false);
      setFormName('');
      setFormType(CATEGORY_TYPES[0].id);
      setFormImageUrl('');
      setFormIcon('');
      await loadData();
      onCategoriesChange?.();
      toast({ title: 'Categoria adicionada!' });
    } catch (e) {
      toast({ title: 'Erro ao adicionar categoria', variant: 'destructive' });
    }
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    const typeId = cat.is_pizza ? 'pizza' : (cat.extra_field || 'default');
    setEditForm({
      name: cat.name,
      type: CATEGORY_TYPES.some((t) => t.id === typeId) ? typeId : 'default',
      image_url: cat.image_url || '',
      icon: cat.icon || '',
    });
    setEditModalOpen(true);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !restaurantId) return;
    const name = editForm.name.trim();
    if (!name) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    const existing = categories.find((c) => c.id !== editingCategory.id && c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      toast({ title: 'Já existe uma categoria com esse nome', variant: 'destructive' });
      return;
    }
    const preset = CATEGORY_TYPES.find((t) => t.id === editForm.type) || CATEGORY_TYPES[0];
    try {
      const { error } = await supabase.from('categories').update({
        name,
        image_url: editForm.image_url.trim() || null,
        icon: editForm.icon.trim() || null,
        is_pizza: preset.is_pizza,
        is_marmita: preset.is_marmita,
        extra_field: preset.extra_field,
        extra_label: preset.extra_label,
        extra_placeholder: preset.extra_placeholder,
      }).eq('id', editingCategory.id).eq('restaurant_id', restaurantId);
      if (error) throw error;
      setEditModalOpen(false);
      setEditingCategory(null);
      await loadData();
      onCategoriesChange?.();
      toast({ title: 'Categoria atualizada!' });
    } catch (e) {
      toast({ title: 'Erro ao atualizar categoria', variant: 'destructive' });
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    const { data: productsInCat } = await supabase
      .from('products')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('category', category.name)
      .limit(1);
    const hasProducts = (productsInCat?.length ?? 0) > 0;
    const fallback = categories.find((c) => c.id !== category.id && c.name === 'Outros') || categories.find((c) => c.id !== category.id);
    const targetCategory = fallback?.name ?? 'Outros';

    const message = hasProducts
      ? `Existem produtos em "${category.name}". Eles serão movidos para "${targetCategory}". Deseja continuar?`
      : `Remover a categoria "${category.name}"?`;
    if (!confirm(message)) return;

    try {
      if (hasProducts) {
        await supabase
          .from('products')
          .update({ category: targetCategory, subcategory_id: null })
          .eq('restaurant_id', restaurantId)
          .eq('category', category.name);
      }
      await supabase.from('categories').delete().eq('id', category.id).eq('restaurant_id', restaurantId);
      await loadData();
      onCategoriesChange?.();
      toast({ title: 'Categoria removida!' });
    } catch (e) {
      toast({ title: 'Erro ao remover categoria', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card className="dark:bg-slate-900">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="dark:bg-slate-900">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Categorias e Subcategorias</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Adicione, remova ou reordene categorias. Expanda uma categoria para gerenciar subcategorias (ex.: configurações de pizza).
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova categoria
              </Button>
              {hasChanges && (
                <>
                  <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSaveOrder} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Salvar ordem
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="mb-4">Nenhuma categoria. Crie uma para organizar seu cardápio.</p>
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova categoria
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <SortableCategoryRow
                      key={category.id}
                      category={category}
                      subcategories={subcategoriesByCategory[category.id] || []}
                      expanded={expandedId === category.id}
                      onToggleExpand={() => setExpandedId((id) => (id === category.id ? null : category.id))}
                      onEdit={() => openEditModal(category)}
                      onDelete={() => handleDeleteCategory(category)}
                      onSubcategoriesChange={loadData}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0">
                <Label className="text-xs text-muted-foreground">Imagem</Label>
                <label className="cursor-pointer block mt-1">
                  <input type="file" accept="image/*" className="sr-only" disabled={imageUploading || !restaurantId}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !restaurantId) return;
                      setImageUploading(true);
                      try {
                        const url = await uploadProductImage(restaurantId, file);
                        setFormImageUrl(url);
                        toast({ title: 'Imagem enviada!' });
                      } catch (err) {
                        toast({ title: 'Erro ao enviar imagem', description: err instanceof Error ? err.message : 'Tente outro arquivo.', variant: 'destructive' });
                      } finally {
                        setImageUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                  <div className={`relative w-20 h-20 rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all ${
                    formImageUrl ? 'border-border hover:border-primary/40' : 'border-dashed border-border bg-muted/40'
                  }`}>
                    {imageUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : formImageUrl ? (
                      <img src={formImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  {formImageUrl && (
                    <button type="button" onClick={() => setFormImageUrl('')} className="mt-1 text-[10px] text-muted-foreground hover:text-destructive">Remover</button>
                  )}
                </label>
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                <div className="space-y-2">
                  <Label>Nome da categoria</Label>
                  <Input
                    placeholder="Ex: Pizza, Bebidas, Sobremesas"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo / Comportamento</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_TYPES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CategoryIconPicker value={formIcon || 'Utensils'} onChange={setFormIcon} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); setFormImageUrl(''); setFormIcon(''); }}>Cancelar</Button>
            <Button onClick={handleAddCategory} disabled={!formName.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editModalOpen} onOpenChange={(open) => { setEditModalOpen(open); if (!open) setEditingCategory(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0">
                <Label className="text-xs text-muted-foreground">Imagem</Label>
                <label className="cursor-pointer block mt-1">
                  <input type="file" accept="image/*" className="sr-only" disabled={editImageUploading || !restaurantId}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !restaurantId) return;
                      setEditImageUploading(true);
                      try {
                        const url = await uploadProductImage(restaurantId, file);
                        setEditForm((f) => ({ ...f, image_url: url }));
                        toast({ title: 'Imagem enviada!' });
                      } catch (err) {
                        toast({ title: 'Erro ao enviar imagem', description: err instanceof Error ? err.message : 'Tente outro arquivo.', variant: 'destructive' });
                      } finally {
                        setEditImageUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                  <div className={`relative w-20 h-20 rounded-lg border-2 overflow-hidden flex items-center justify-center transition-all ${
                    editForm.image_url ? 'border-border hover:border-primary/40' : 'border-dashed border-border bg-muted/40'
                  }`}>
                    {editImageUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : editForm.image_url ? (
                      <img src={editForm.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  {editForm.image_url && (
                    <button type="button" onClick={() => setEditForm((f) => ({ ...f, image_url: '' }))} className="mt-1 text-[10px] text-muted-foreground hover:text-destructive">Remover</button>
                  )}
                </label>
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                <div className="space-y-2">
                  <Label>Nome da categoria</Label>
                  <Input
                    placeholder="Ex: Pizza, Bebidas"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo / Comportamento</Label>
                  <Select value={editForm.type} onValueChange={(v) => setEditForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_TYPES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CategoryIconPicker value={editForm.icon || 'Utensils'} onChange={(v) => setEditForm((f) => ({ ...f, icon: v }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateCategory} disabled={!editForm.name.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
