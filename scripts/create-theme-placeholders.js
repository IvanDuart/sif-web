/**
 * Create placeholder theme screenshots for common/ directory
 * Run with: node scripts/create-theme-placeholders.js
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const OUTPUT_DIR = path.join('src', 'assets', 'help', 'screenshots', 'common');

// Light theme placeholder - light background with "Light Theme" text
async function createLightPlaceholder() {
  const width = 1440;
  const height = 900;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8fafc"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-family="system-ui, sans-serif" font-size="48" fill="#64748b">
        Light Theme Preview
      </text>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
            font-family="system-ui, sans-serif" font-size="24" fill="#94a3b8">
        Help Center - Light Mode
      </text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(OUTPUT_DIR, 'light', 'desktop', 'theme-light.png'));

  console.log('✓ Created light theme placeholder');
}

// Dark theme placeholder - dark background with "Dark Theme" text
async function createDarkPlaceholder() {
  const width = 1440;
  const height = 900;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0f172a"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-family="system-ui, sans-serif" font-size="48" fill="#94a3b8">
        Dark Theme Preview
      </text>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
            font-family="system-ui, sans-serif" font-size="24" fill="#64748b">
        Help Center - Dark Mode
      </text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(OUTPUT_DIR, 'dark', 'desktop', 'theme-dark.png'));

  console.log('✓ Created dark theme placeholder');
}

async function main() {
  console.log('🎨 Creating common theme placeholders...\n');

  // Ensure directories exist
  fs.mkdirSync(path.join(OUTPUT_DIR, 'light', 'desktop'), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT_DIR, 'dark', 'desktop'), { recursive: true });

  await createLightPlaceholder();
  await createDarkPlaceholder();

  console.log('\n✅ Theme placeholders created');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});