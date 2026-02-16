import { supabase } from '@/lib/supabase';

const WEBP_QUALITY = 0.8;
const BUCKET = 'product-images';

/**
 * Converte um arquivo de imagem (PNG, JPG, etc.) para WebP com 80% de qualidade,
 * reduzindo tamanho e mantendo boa qualidade visual.
 */
export function convertToWebP(file: File, quality: number = WEBP_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas não suportado'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Falha ao converter para WebP'));
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar a imagem'));
    };
    img.src = url;
  });
}

/**
 * Faz upload de uma imagem para o Supabase Storage: converte para WebP 80%,
 * envia para o bucket e retorna a URL pública.
 * @param restaurantId ID do restaurante (pasta no bucket)
 * @param file Arquivo de imagem (PNG, JPG, JPEG ou GIF)
 * @returns URL pública da imagem ou erro
 */
export async function uploadProductImage(
  restaurantId: string,
  file: File
): Promise<string> {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Formato não suportado. Use PNG, JPG ou GIF.');
  }

  const blob = await convertToWebP(file);
  const ext = 'webp';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const path = `${restaurantId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}
