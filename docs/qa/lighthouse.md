# Lighthouse: public site (mobile)

- **Setup:** in the VS Code terminal in the repo root, build with `npx vite build`, serve it with `npx vite preview --port 4173`, then run, with `CHROME_PATH` set to Playwright's Chromium:

  ```bash
  npx lighthouse http://localhost:4173/ --form-factor=mobile --only-categories=performance,accessibility,best-practices,seo
  ```
- **Run 1 (M4, 30 Oct 2026):** Performance **94**, Accessibility **100**, Best practices 96, SEO 92. The gates are Performance 90 or more and Accessibility 95 or more, so both pass.
- **Notes:**
  - The preview build has no real Firebase project id, so the feed request fails and the page falls back to its static parts. That failure is the console error that costs Best practices points. Production reads the real feed.
  - LCP is 2.8 s on the simulated mobile connection. The largest paint is the hero image (`building.webp`, 173 kB at 1600 px), and Lighthouse estimates 227 kB of savings from a smaller mobile copy. It is not needed for the gate, so it stays in the backlog.
  - SEO lost points for `robots.txt` because the preview server returned the HTML page for it. `public/robots.txt` now exists: it allows the public site and disallows `/app/`.
