import {
  calculateBrightness,
  color2hsv,
  rgb2color,
} from 'shared/utils/colorutil';
import { posterize } from 'shared/utils/imageutil';

export interface CreateColorSchemeOptions {
  baseColor: string;
  posterizeLevel: number;
  backgroundSegment: number;
  backgroundMinBrightness: number;
  backgroundMaxBrightness: number;
  investigationStep: number;
  textMinHueDistance: number;
  titleDetectBrightnessThreshold: number;
}
export const defaultCreateColorSchemeOptions: CreateColorSchemeOptions = {
  baseColor: '#fff',
  posterizeLevel: 20,
  backgroundSegment: 13,
  backgroundMinBrightness: 32,
  backgroundMaxBrightness: 0xff - 32,
  investigationStep: 30,
  textMinHueDistance: 30,
  titleDetectBrightnessThreshold: 0.25,
};

export const createColorScheme = (
  source:
    | HTMLImageElement
    | HTMLVideoElement
    | HTMLCanvasElement
    | ImageBitmap
    | OffscreenCanvas,
  options?: Partial<CreateColorSchemeOptions>,
) => {
  const opts = { ...defaultCreateColorSchemeOptions, ...options };

  // これらの色を見つけます
  let backgroundColor = 0xffffff;
  let titleColor = 0x555555;
  let textColor = 0x000000;

  // ソースの幅と高さ
  const sw = source.width;
  const sh = source.height;

  // 処理しやすいように最大300x300にリサイズする
  const scale = Math.min(1, Math.min(300 / sw, 300 / sh));

  // 作業用画像の幅と高さ
  const dw = Math.floor(sw * scale);
  const dh = Math.floor(sh * scale);

  // canvas を用意
  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  // defaultBackgroundColorで塗りつぶす
  // 透明かもしれないから
  context.fillStyle = opts.baseColor;
  context.beginPath();
  context.rect(0, 0, dw, dh);
  context.closePath();
  context.fill();

  // canvas に転写
  context.drawImage(source, 0, 0, sw, sh, 0, 0, dw, dh);
  const sourceImageData = context.getImageData(0, 0, dw, dh).data;
  const destImageData = Uint8ClampedArray.from(sourceImageData);
  posterize(sourceImageData, destImageData, dw, dh, opts.posterizeLevel);

  // 1. 背景色を決定
  // 雑だけど小さくリサイズして左上の色をとる
  backgroundColor = (() => {
    const segment = opts.backgroundSegment;
    const canvas = document.createElement('canvas');
    canvas.width = segment;
    canvas.height = segment;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.fillStyle = opts.baseColor;
    context.beginPath();
    context.rect(0, 0, segment, segment);
    context.closePath();
    context.fill();
    context.drawImage(source, 0, 0, sw, sh, 0, 0, segment, segment);
    const imageData = context.getImageData(0, 0, segment, segment).data;

    for (let x = 1; x < segment; x++) {
      for (let y = 1; y < segment; y++) {
        const backgroundColor = getPixel(imageData, 1, x, y);
        const backgroundBrightness = calculateBrightness(backgroundColor);
        if (
          backgroundBrightness < opts.backgroundMinBrightness ||
          backgroundBrightness > opts.backgroundMaxBrightness
        ) {
          canvas.width = 0;
          canvas.height = 0;
          return backgroundColor;
        }
      }
    }

    const backgroundColor = getPixel(imageData, 1, 0, 0);
    canvas.width = 0;
    canvas.height = 0;
    return backgroundColor;
  })();
  const backgroundBrightness = calculateBrightness(backgroundColor);
  const backgroundHue = color2hsv(backgroundColor).h;
  const isDark = backgroundBrightness < 0xff / 2;

  // 2. テキストとタイトルの候補になる色を抽出する
  const colorsDic: {
    [key: string]: { brightness: number; color: number; count: number };
  } = {};

  // 全部捜査すると膨大になるから間引く
  const stepX = Math.ceil(Math.max(1, dw / opts.investigationStep));
  const stepY = Math.ceil(Math.max(1, dh / opts.investigationStep));

  for (let x = 0; x < dw; x += stepX) {
    for (let y = 0; y < dh; y += stepY) {
      const color = getPixel(destImageData, dw, x, y);
      if (isNaN(color) || color === 0x000000 || color === 0xffffff) continue;
      const brightness = calculateBrightness(color);
      if (isDark && brightness < 0xff * 0.3) continue;
      if (!isDark && brightness >= 0xff * 0.7) continue;

      const hue = color2hsv(color).h;
      const hueDistance = Math.abs(backgroundHue - hue);
      if (hueDistance < opts.textMinHueDistance) continue;

      if (colorsDic[color]) {
        colorsDic[color].count++;
      } else {
        colorsDic[color] = {
          brightness,
          color,
          count: 1,
        };
      }
    }
  }

  // 使用する色をフィルタリングする
  // 使用率が10%以下の色は使用しない
  const colorCount = Object.keys(colorsDic).length;
  const colors = Object.values(colorsDic).filter(
    (color) => color.count <= colorCount * 0.1,
  );

  // 明度で並び替える
  if (isDark) colors.sort((a, b) => a.brightness - b.brightness);
  else colors.sort((a, b) => b.brightness - a.brightness);

  // 3. テキスト色を決定
  // 背景色との明度差が一番大きいものを抽出する
  textColor = (() => {
    let textColor = isDark ? 0xffffff : 0x000000;

    if (colors.length > 0) {
      textColor = colors[colors.length - 1].color;
    }

    return textColor;
  })();

  // 4. タイトル色を決定
  titleColor = (() => {
    let titleColor = textColor;

    if (colors.length > 0) {
      const textHue = color2hsv(textColor).h;

      // 使用率で並び替え
      colors.sort((a, b) => b.count - a.count);

      const startIndex = Math.floor(colors.length * 0.05);

      for (let i = startIndex; i < colors.length; i++) {
        const color = colors[i];
        const titleHue = color2hsv(color.color).h;
        const hueDisatnce = Math.abs(textHue - titleHue);
        if (hueDisatnce >= opts.textMinHueDistance) {
          titleColor = color.color;
          break;
        }
      }
    }

    return titleColor;
  })();

  // 開放
  canvas.width = 0;
  canvas.height = 0;

  return {
    backgroundColor,
    titleColor,
    textColor,
  };
};

// ImageData から色を取得する
function getPixel(
  imageData: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
) {
  const index = (x + y * width) * 4;
  const r = imageData[index + 0];
  const g = imageData[index + 1];
  const b = imageData[index + 2];

  return rgb2color(r, g, b);
}
