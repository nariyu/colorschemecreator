import {
  calculateBrightness,
  color2hsv,
  rgb2color,
} from 'shared/utils/colorutil';
import { posterize } from 'shared/utils/imageutil';

export const createColorScheme = (
  source:
    | HTMLImageElement
    | HTMLVideoElement
    | HTMLCanvasElement
    | ImageBitmap
    | OffscreenCanvas,
) => {
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

  // 下地
  const baseColor = '#fff';

  // canvas を用意
  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  // defaultBackgroundColorで塗りつぶす
  // 透明かもしれないからね
  context.fillStyle = baseColor;
  context.beginPath();
  context.rect(0, 0, dw, dh);
  context.closePath();
  context.fill();

  // canvas に転写
  context.drawImage(source, 0, 0, sw, sh, 0, 0, dw, dh);
  const sourceImageData = context.getImageData(0, 0, dw, dh).data;
  const destImageData = Uint8ClampedArray.from(sourceImageData);
  posterize(sourceImageData, destImageData, dw, dh, 5);

  // 1. 背景色を決定
  // 雑だけど小さくリサイズして左上の色をとります。
  backgroundColor = (() => {
    const size = 9;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.fillStyle = baseColor;
    context.beginPath();
    context.rect(0, 0, size, size);
    context.closePath();
    context.fill();
    context.drawImage(source, 0, 0, sw, sh, 0, 0, size, size);
    const imageData = context.getImageData(0, 0, size, size).data;

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const backgroundColor = getPixel(imageData, 1, x, y);
        const backgroundBrightness = calculateBrightness(backgroundColor);
        if (backgroundBrightness < 64 || backgroundBrightness > 192) {
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
  const isDark = backgroundBrightness < 128;

  // 取得した色は再度取得しなくてもいいようにキャッシュして使い回しましょう
  const colors: number[] = [];

  // 最大明度差
  let textBrightDistance = -1;

  // 2. テキスト色を決定
  // 背景色との明度差が一番大きいものを抽出する
  textColor = (() => {
    let textColor = 0x000000;

    // 全部捜査すると膨大になるから間引く
    const stepX = Math.ceil(Math.max(1, dw / 30));
    const stepY = Math.ceil(Math.max(1, dh / 30));

    for (let x = 0; x < dw; x += stepX) {
      for (let y = 0; y < dh; y += stepY) {
        const color = getPixel(destImageData, dw, x, y);
        if (isNaN(color) || color === 0x000000 || color === 0xffffff) continue;

        colors.push(color);

        const textBrightness = calculateBrightness(color);
        if (textBrightness > 238 || textBrightness < 16) continue;
        if (isDark && textBrightness < 64) continue;
        if (!isDark && textBrightness >= 192) continue;

        if (
          textBrightDistance == -1 ||
          Math.abs(backgroundBrightness - textBrightness) > textBrightDistance
        ) {
          textBrightDistance = Math.abs(backgroundBrightness - textBrightness);
          textColor = color;
        }
      }
    }

    // 背景色とテキスト色の明度差が小さければ適当な色を入れておく
    if (Math.abs(calculateBrightness(textColor) - backgroundBrightness) <= 16) {
      textColor = backgroundBrightness < 128 ? 0xffffff : 0x000000;
    }

    return textColor;
  })();

  // 3. タイトル色を決定
  // 背景色とテキスト色との明度差の50%前後にある色をタイトル色にする
  // 最初は 50%±5 の範囲で探して、見つからない場合は5ポイントずつ広げながら見つけていく
  titleColor = (() => {
    let titleColor = 0x000000;

    const defaultBrightnessThreshold = 0.5;

    const textHue = color2hsv(textColor).h;

    for (
      let threshold = 0.05;
      threshold < defaultBrightnessThreshold;
      threshold += 0.05
    ) {
      let titleColorMatched = false;

      for (let i = colors.length - 1; i >= 0; i--) {
        const color = colors[i];
        const brightness = calculateBrightness(color);
        const brightnessDistance = Math.abs(backgroundBrightness - brightness);

        const titleHue = color2hsv(color).h;
        const hueDisatnce = Math.abs(textHue - titleHue);
        if (
          hueDisatnce >= 25 &&
          titleHue > 32 &&
          brightnessDistance >
            textBrightDistance * defaultBrightnessThreshold &&
          brightnessDistance <
            textBrightDistance * (defaultBrightnessThreshold + threshold)
        ) {
          titleColor = color;
          titleColorMatched = true;
          break;
        }

        if (titleColorMatched) break;
      }
    }

    // 背景色とタイトル色の明度差が小さければ適当な色を入れておく
    if (
      Math.abs(calculateBrightness(titleColor) - backgroundBrightness) <= 32
    ) {
      titleColor = backgroundBrightness < 128 ? 0xdddddd : 0x222222;
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
