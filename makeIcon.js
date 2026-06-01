const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
  const { createStickyIcon } = require('./src/main/iconMaker');
  const png = createStickyIcon(256).toPNG();
  fs.writeFileSync(path.join(__dirname, 'src', 'assets', 'icon.png'), png);
  console.log('icon.png generated');
  app.quit();
});
