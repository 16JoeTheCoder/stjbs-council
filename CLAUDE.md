## STJBS Council: working rules

- **Design:** follow `design/fiatlux/DESIGN.md` (Fiat Lux: dark first, Berchmans red, school photography). App CSS lives in `src/app.css`, tokens only, `fl-` prefix. Do not use the retired builtbyjosef brand.
- **Before finishing:** run `npm run check` (design lint, build, and the check that keeps Firebase off the public page) and `npm run test:rules`, both in the VS Code terminal in the repo root.
- **Firebase setup:** keep it as configured. Do not change `src/firebase.js`, `.env.example`, `.env.emulator`, `.firebaserc` or the emulator and Firestore sections of `firebase.json`. `firestore.rules` is the permission layer; hidden buttons are cosmetic.
- **Data:** never rename or remove a collection or field that production uses. New fields are optional, and readers treat a missing value as the default.
- **Commands:** say exactly where each one runs (VS Code terminal in the repo root, Firebase console in the browser).
- **Builds and deploys:** only when told to.
