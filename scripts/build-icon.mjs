import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import toIco from "to-ico";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const buildDir = path.join(root, "build");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
    Math.round(lerp(a[3], b[3], t))
  ];
}

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }

  const idx = (png.width * y + x) * 4;
  png.data[idx] = color[0];
  png.data[idx + 1] = color[1];
  png.data[idx + 2] = color[2];
  png.data[idx + 3] = color[3];
}

function alphaBlendPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
    return;
  }

  const idx = (png.width * y + x) * 4;
  const srcA = color[3] / 255;
  const dstA = png.data[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);

  if (outA <= 0) {
    return;
  }

  png.data[idx] = Math.round((color[0] * srcA + png.data[idx] * dstA * (1 - srcA)) / outA);
  png.data[idx + 1] = Math.round((color[1] * srcA + png.data[idx + 1] * dstA * (1 - srcA)) / outA);
  png.data[idx + 2] = Math.round((color[2] * srcA + png.data[idx + 2] * dstA * (1 - srcA)) / outA);
  png.data[idx + 3] = Math.round(outA * 255);
}

function fillBackground(png, topColor, bottomColor) {
  for (let y = 0; y < png.height; y += 1) {
    const t = y / (png.height - 1);
    const rowColor = mixColor(topColor, bottomColor, t);
    for (let x = 0; x < png.width; x += 1) {
      setPixel(png, x, y, rowColor);
    }
  }
}

function insideRoundedRect(x, y, rectX, rectY, rectW, rectH, radius) {
  const localX = x - rectX;
  const localY = y - rectY;

  if (localX < 0 || localY < 0 || localX >= rectW || localY >= rectH) {
    return false;
  }

  const r = Math.min(radius, rectW / 2, rectH / 2);
  const dx = Math.max(Math.abs(localX - rectW / 2) - rectW / 2 + r, 0);
  const dy = Math.max(Math.abs(localY - rectH / 2) - rectH / 2 + r, 0);
  return dx * dx + dy * dy <= r * r;
}

function fillRoundedRect(png, rectX, rectY, rectW, rectH, radius, colorOrFn) {
  const minX = Math.floor(rectX);
  const minY = Math.floor(rectY);
  const maxX = Math.ceil(rectX + rectW);
  const maxY = Math.ceil(rectY + rectH);

  for (let y = minY; y < maxY; y += 1) {
    for (let x = minX; x < maxX; x += 1) {
      if (!insideRoundedRect(x + 0.5, y + 0.5, rectX, rectY, rectW, rectH, radius)) {
        continue;
      }

      const color = typeof colorOrFn === "function"
        ? colorOrFn((x - rectX) / rectW, (y - rectY) / rectH)
        : colorOrFn;
      alphaBlendPixel(png, x, y, color);
    }
  }
}

function fillCircle(png, cx, cy, radius, color) {
  const minX = Math.floor(cx - radius);
  const minY = Math.floor(cy - radius);
  const maxX = Math.ceil(cx + radius);
  const maxY = Math.ceil(cy + radius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        alphaBlendPixel(png, x, y, color);
      }
    }
  }
}

function drawLine(png, x0, y0, x1, y1, thickness, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = lerp(x0, x1, t);
    const y = lerp(y0, y1, t);
    fillCircle(png, x, y, thickness / 2, color);
  }
}

function renderIcon(size) {
  const png = new PNG({ width: size, height: size });
  const transparent = [0, 0, 0, 0];
  png.data.fill(0);

  const shadowOffset = size * 0.03;
  fillRoundedRect(
    png,
    size * 0.12 + shadowOffset,
    size * 0.1 + shadowOffset,
    size * 0.76,
    size * 0.76,
    size * 0.18,
    [106, 72, 49, 45]
  );

  fillRoundedRect(
    png,
    size * 0.12,
    size * 0.1,
    size * 0.76,
    size * 0.76,
    size * 0.18,
    (tx, ty) => {
      const base = mixColor([123, 87, 64, 255], [231, 179, 126, 255], ty);
      const glow = mixColor(base, [255, 237, 208, 255], clamp((1 - tx) * 0.35, 0, 0.35));
      return glow;
    }
  );

  fillCircle(png, size * 0.28, size * 0.22, size * 0.12, [255, 255, 255, 28]);

  const noteX = size * 0.25;
  const noteY = size * 0.2;
  const noteW = size * 0.5;
  const noteH = size * 0.56;
  const noteRadius = size * 0.06;

  fillRoundedRect(png, noteX, noteY, noteW, noteH, noteRadius, [255, 249, 240, 255]);
  fillRoundedRect(png, noteX, noteY, noteW, noteH, noteRadius, [255, 255, 255, 25]);

  const foldSize = size * 0.11;
  for (let y = 0; y < foldSize; y += 1) {
    for (let x = 0; x < foldSize; x += 1) {
      if (x + y < foldSize) {
        alphaBlendPixel(
          png,
          Math.round(noteX + noteW - foldSize + x),
          Math.round(noteY + y),
          [242, 226, 209, 255]
        );
      }
    }
  }

  const lineColor = [215, 197, 179, 255];
  const textLeft = noteX + size * 0.07;
  const textRight = noteX + noteW - size * 0.11;
  const lineYs = [0.15, 0.27, 0.39].map((v) => noteY + noteH * v);
  for (const y of lineYs) {
    drawLine(png, textLeft, y, textRight, y, size * 0.018, lineColor);
  }

  fillCircle(png, noteX + noteW * 0.32, noteY + noteH * 0.7, size * 0.075, [244, 197, 164, 255]);
  drawLine(
    png,
    noteX + noteW * 0.27,
    noteY + noteH * 0.7,
    noteX + noteW * 0.31,
    noteY + noteH * 0.74,
    size * 0.022,
    [255, 255, 255, 255]
  );
  drawLine(
    png,
    noteX + noteW * 0.31,
    noteY + noteH * 0.74,
    noteX + noteW * 0.39,
    noteY + noteH * 0.64,
    size * 0.022,
    [255, 255, 255, 255]
  );

  drawLine(
    png,
    noteX + noteW * 0.47,
    noteY + noteH * 0.67,
    noteX + noteW * 0.74,
    noteY + noteH * 0.67,
    size * 0.018,
    lineColor
  );
  drawLine(
    png,
    noteX + noteW * 0.47,
    noteY + noteH * 0.79,
    noteX + noteW * 0.7,
    noteY + noteH * 0.79,
    size * 0.018,
    lineColor
  );

  fillRoundedRect(
    png,
    size * 0.22,
    size * 0.77,
    size * 0.56,
    size * 0.08,
    size * 0.04,
    [255, 250, 244, 180]
  );

  return PNG.sync.write(png);
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = sizes.map((size) => renderIcon(size));
  const icoBuffer = await toIco(buffers);
  const previewBuffer = renderIcon(1024);
  const tileBuffer = renderIcon(256);

  await fs.writeFile(path.join(buildDir, "icon.ico"), icoBuffer);
  await fs.writeFile(path.join(buildDir, "icon.png"), previewBuffer);
  await fs.writeFile(path.join(buildDir, "icon-preview.png"), tileBuffer);

  console.log("Icon assets written to", buildDir);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
