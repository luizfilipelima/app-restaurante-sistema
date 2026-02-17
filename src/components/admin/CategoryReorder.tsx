import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types';
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
import { toast } from '@/hooks/use-toast';
import { GripVertical, Loader2, Check, X } from 'lucide-react';

interface CategoryReorderProps {
  restaurantId: string;
}

interface SortableCategoryItemProps {
  category: Category;
}

function SortableCategoryItem({ category }: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-lg border ${
        isDragging ? 'border-primary shadow-lg' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="font-medium text-foreground">{category.name}</div>
        <div className="text-xs text-muted-foreground">
          Posição: {category.order_index + 1}
        </div>
      </div>
    </div>
  );
}

export default function CategoryReorder({ restaurantId }: CategoryReorderProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (restaurantId) {
      loadCategories();
    }
  }, [restaurantId]);

  const loadCategories = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      setCategories(data || []);
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Atualizar order_index localmente
        const updatedItems = newItems.map((item, index) => ({
          ...item,
          order_index: index,
        }));
        
        setHasChanges(true);
        return updatedItems;
      });
    }
  };

  const handleSave = async () => {
    if (!restaurantId || !hasChanges) return;

    try {
      setSaving(true);

      // Atualizar em lote usando múltiplas queries
      // Nota: Se a função RPC não existir, fazer updates individuais
      const updatePromises = categories.map((category, index) =>
        supabase
          .from('categories')
          .update({ order_index: index })
          .eq('id', category.id)
          .eq('restaurant_id', restaurantId)
      );

      const results = await Promise.all(updatePromises);
      const errors = results.filter((r) => r.error);
      
      if (errors.length > 0) {
        throw new Error(errors[0].error?.message || 'Erro ao atualizar ordem');
      }

      // Atualizar estado local
      setHasChanges(false);

      toast({
        title: 'Ordem salva com sucesso!',
        description: 'A nova ordem das categorias foi aplicada ao cardápio.',
      });
    } catch (error) {
      console.error('Erro ao salvar ordem:', error);
      
      // Reverter para ordem original em caso de erro
      await loadCategories();
      
      toast({
        title: 'Erro ao salvar ordem',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    await loadCategories();
    toast({
      title: 'Alterações canceladas',
      description: 'A ordem foi revertida para a última versão salva.',
    });
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

  if (categories.length === 0) {
    return (
      <Card className="dark:bg-slate-900">
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Nenhuma categoria encontrada. Crie produtos para gerar categorias automaticamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dark:bg-slate-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Reordenar Categorias</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Arraste as categorias para reordená-las. A ordem será refletida no cardápio público.
            </p>
          </div>
          {hasChanges && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Salvar Ordem
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {categories.map((category) => (
                <SortableCategoryItem key={category.id} category={category} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        
        {!hasChanges && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Arraste uma categoria para cima ou para baixo para alterar a ordem
          </p>
        )}
      </CardContent>
    </Card>
  );
}
