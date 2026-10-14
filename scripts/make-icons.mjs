import { chromium } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
if (!existsSync('public/icon-512.png')) {
  const svg = readFileSync('public/icon.svg', 'utf8');
  const b = await chromium.launch(); const p = await b.newPage();
  for (const s of [192, 512]) {
    await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<style>body{margin:0}</style>${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}`);
    await p.screenshot({ path: `public/icon-${s}.png`, omitBackground: true });
  }
  await b.close();
}
