import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Product } from '@/types';
import { formatPrice, type CurrencyCode } from '@/lib/priceHelper';
import {
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GripVertical, Edit, Copy, Trash2, Pizza, UtensilsCrossed } from 'lucide-react';

interface ProductRowProps {
  product: Product;
  currency: CurrencyCode;
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onDelete: (productId: string) => void;
  onToggleActive: (productId: string, isActive: boolean) => void;
}

export default function ProductRow({
  product,
  currency,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleActive,
}: ProductRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'bg-muted/80 z-10' : ''}
    >
      <TableCell className="w-10 p-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50"
          title="Arrastar para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </TableCell>
      <TableCell className="w-[52px] p-2">
        <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0 border">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              {product.is_pizza ? (
                <Pizza className="h-5 w-5" />
              ) : product.is_marmita ? (
                <UtensilsCrossed className="h-5 w-5" />
              ) : (
                <span className="text-lg">🍽</span>
              )}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="min-w-0">
        <div>
          <div className="font-medium text-foreground truncate">{product.name}</div>
          <div className="text-xs text-muted-foreground">{product.category}</div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap font-medium tabular-nums">
        {formatPrice(Number(product.price), currency)}
      </TableCell>
      <TableCell className="w-14">
        <Switch
          checked={product.is_active}
          onCheckedChange={() => onToggleActive(product.id, product.is_active)}
          title={product.is_active ? 'Ativo' : 'Inativo'}
        />
      </TableCell>
      <TableCell className="w-[140px] p-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(product)}
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDuplicate(product)}
            title="Duplicar"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(product.id)}
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
