#!/usr/bin/env node
/**
 * Converte public/og-image.svg em public/og-image.png
 * para uso em og:image (Facebook, WhatsApp, Twitter, etc).
 * Execute: node scripts/generate-og-image.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'public', 'og-image.svg');
const pngPath = join(root, 'public', 'og-image.png');

const svg = readFileSync(svgPath);
await sharp(svg)
  .png()
  .toFile(pngPath);

console.log('✅ og-image.png gerado em public/og-image.png');
