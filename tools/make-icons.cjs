// アプリのアイコン（icon-192.png・icon-512.png）を作る。紺の地に、大きな波と速さの線（津波の速さ）。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#123554"/>
      <path d="M10 78 C30 78 34 40 58 30 C74 24 88 32 90 44 C80 38 70 42 70 52 C70 62 80 66 90 64 V90 H10Z" fill="#7fc4ef"/><g stroke="#f6d77a" stroke-width="6" stroke-linecap="round"><path d="M10 26 H34"/><path d="M6 42 H26"/><path d="M12 58 H24"/></g></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
