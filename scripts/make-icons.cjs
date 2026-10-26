// Renders the PWA icons from the design system SVGs. Run once (VS Code terminal, repo root): node scripts/make-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync('design/builtbyjosef/logos/tab-icon-dark.svg', 'utf8');
const square = src.replace('rx="112"', 'rx="0"'); // maskable and Apple icons are masked by the OS
const jobs = [['icon-192.png', 192, src], ['icon-512.png', 512, src], ['icon-maskable-512.png', 512, square], ['apple-touch-icon-180.png', 180, square]];
(async () => {
  const b = await chromium.launch();
  for (const [name, px, svg] of jobs) {
    const p = await b.newPage({ viewport: { width: px, height: px } });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${px}px;height:${px}px;display:block}</style>${svg}`);
    await p.screenshot({ path: `public/icons/${name}`, omitBackground: true });
    await p.close();
  }
  await b.close();
  console.log('ok icons written to public/icons');
})();
