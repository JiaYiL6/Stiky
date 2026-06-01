const { nativeImage } = require('electron');

function createStickyIcon(size) {
  const s = size;
  const buf = Buffer.alloc(s * s * 4, 0); // 全部初始化为透明

  const lightR = 255, lightG = 250, lightB = 205; // #FFFACD
  const darkR = 255, darkG = 224, darkB = 137;    // #FFE089

  const cornerR = Math.floor(s * 0.14);  // 圆角半径
  const topH = Math.floor(s * 0.2);       // 顶部深色条高度
  const gradH = 3;                         // 渐变带高度（每侧）

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // 圆角处理：四个角超出半径的像素保持透明
      let cornerDist = 0;
      if (x < cornerR && y < cornerR) {
        cornerDist = Math.sqrt((cornerR - x) ** 2 + (cornerR - y) ** 2);
      } else if (x >= s - cornerR && y < cornerR) {
        cornerDist = Math.sqrt((x - (s - cornerR - 1)) ** 2 + (cornerR - y) ** 2);
      } else if (x < cornerR && y >= s - cornerR) {
        cornerDist = Math.sqrt((cornerR - x) ** 2 + (y - (s - cornerR - 1)) ** 2);
      } else if (x >= s - cornerR && y >= s - cornerR) {
        cornerDist = Math.sqrt((x - (s - cornerR - 1)) ** 2 + (y - (s - cornerR - 1)) ** 2);
      }
      if (cornerDist > cornerR) continue; // 圆角外 → 透明

      const i = (y * s + x) * 4;
      let r, g, b;

      if (y < topH - gradH) {
        // 顶部深色区
        r = darkR; g = darkG; b = darkB;
      } else if (y < topH + gradH) {
        // 渐变带：深色 → 浅色
        const t = (y - topH + gradH) / (gradH * 2);
        r = Math.round(darkR + (lightR - darkR) * t);
        g = Math.round(darkG + (lightG - darkG) * t);
        b = Math.round(darkB + (lightB - darkB) * t);
      } else {
        // 主体浅色区
        r = lightR; g = lightG; b = lightB;
      }

      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }

  return nativeImage.createFromBuffer(buf, { width: s, height: s });
}

module.exports = { createStickyIcon };
