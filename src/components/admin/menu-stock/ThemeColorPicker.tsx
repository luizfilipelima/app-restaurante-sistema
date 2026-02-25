/**
 * Seletor de cor estilo Photoshop (quadrado S/L + slider H + input HEX).
 * Usado na configuração de tema quando o usuário escolhe cor personalizada.
 */
import { HslColorPicker, HexColorInput } from 'react-colorful';
import { Label } from '@/components/ui/label';
import { hslToCustomAccent, hslToHex, hexToHsl, parseCustomAccent } from '@/lib/menu/menuThemes';

interface ThemeColorPickerProps {
  /** Valor atual: custom:H,S,L ou custom#RRGGBB */
  value: string | null | undefined;
  /** Callback com novo valor custom (custom:H,S,L) */
  onChange: (value: string) => void;
  /** Label opcional */
  label?: string;
  /** Classe para o container */
  className?: string;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

const DEFAULT_HSL: HslColor = { h: 350, s: 40, l: 90 };

function customToHsl(value: string | null | undefined): HslColor {
  const parsed = parseCustomAccent(value);
  if (parsed) return { h: parsed.h, s: parsed.s, l: parsed.l };
  return DEFAULT_HSL;
}

export default function ThemeColorPicker({
  value,
  onChange,
  label = 'Cor personalizada',
  className = '',
}: ThemeColorPickerProps) {
  const hsl = customToHsl(value);

  const handleHslChange = (color: HslColor) => {
    onChange(hslToCustomAccent(color.h, color.s, color.l));
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="space-y-3">
        <div
          className="rounded-xl overflow-hidden border border-border bg-card"
          style={{ maxWidth: 260 }}
        >
          <HslColorPicker
            color={hsl}
            onChange={handleHslChange}
            className="w-full !h-40"
            style={{ width: '100%', height: 160 }}
          />
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg shrink-0 border border-border shadow-sm"
            style={{
              backgroundColor: hslToHex(hsl.h, hsl.s, hsl.l),
            }}
          />
          <HexColorInput
            color={hslToHex(hsl.h, hsl.s, hsl.l)}
            onChange={(hex) => {
              const parsed = hexToHsl(hex.startsWith('#') ? hex : `#${hex}`);
              if (parsed) onChange(hslToCustomAccent(parsed.h, parsed.s, parsed.l));
            }}
            prefixed
            className="flex-1 h-9 px-3 rounded-lg border border-input bg-background text-sm font-mono"
          />
        </div>
      </div>
    </div>
  );
}
