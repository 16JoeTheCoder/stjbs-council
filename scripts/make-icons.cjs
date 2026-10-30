// Renders the app icons and favicon from the crest: centred on the dark surface #0A0A0C, with a wider safe zone
// for the maskable icon. Run once after changing the crest (VS Code terminal, repo root): node scripts/make-icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const crest = `data:image/png;base64,${fs.readFileSync('design/fiatlux/img/crest.png').toString('base64')}`;
// [file, size in px, crest share of the canvas]: maskable icons are cropped to a circle, so the crest stays inside 64 %.
const jobs = [['icon-192.png', 192, 0.84], ['icon-512.png', 512, 0.84], ['icon-maskable-512.png', 512, 0.64], ['apple-touch-icon-180.png', 180, 0.78], ['favicon-48.png', 48, 0.96]];
(async () => {
  const b = await chromium.launch();
  for (const [name, px, share] of jobs) {
    const p = await b.newPage({ viewport: { width: px, height: px } });
    await p.setContent(`<style>html,body{margin:0;background:#0A0A0C;width:${px}px;height:${px}px;display:grid;place-items:center}img{width:${Math.round(px * share)}px}</style><img src="${crest}">`);
    await p.waitForFunction(() => document.images[0].complete);
    await p.screenshot({ path: `public/icons/${name}` });
    await p.close();
  }
  await b.close();
  console.log('ok icons written to public/icons');
})();
