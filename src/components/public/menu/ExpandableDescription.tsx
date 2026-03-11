/**
 * Descrição expansível: limita a 2 linhas e mostra "Ver mais" quando ultrapassar.
 * Usa text-primary para se adaptar ao tema do restaurante.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ExpandableDescriptionProps {
  children: string;
  className?: string;
}

export default function ExpandableDescription({ children, className = '' }: ExpandableDescriptionProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLParagraphElement>(null);
  const [isClamped, setIsClamped] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) {
      if (expanded) setIsClamped(true);
      return;
    }
    const check = () => setIsClamped(el.scrollHeight > el.clientHeight);
    check();
    const raf = requestAnimationFrame(() => requestAnimationFrame(check));
    return () => cancelAnimationFrame(raf);
  }, [children, expanded]);

  return (
    <div className="space-y-0.5">
      <p
        ref={ref}
        className={`text-sm text-muted-foreground leading-relaxed pt-1 ${className} ${
          !expanded ? 'line-clamp-2' : ''
        }`}
      >
        {children}
      </p>
      {isClamped && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-xs text-primary/90 hover:text-primary hover:underline focus:outline-none focus:ring-0 transition-colors touch-manipulation"
          aria-expanded={expanded}
        >
          {expanded ? t('productCard.readLess') : t('productCard.readMore')}
        </button>
      )}
    </div>
  );
}
