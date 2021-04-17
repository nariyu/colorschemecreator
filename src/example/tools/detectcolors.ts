import { rgb2int } from 'shared/utils/colorutil';

export const createColorScheme = (
  image:
    | HTMLImageElement
    | HTMLVideoElement
    | HTMLCanvasElement
    | ImageBitmap
    | OffscreenCanvas,
  defaultBackgroundColor = '#fff',
) => {
  // これらの色を見つけます
  let backgroundColor = 0xffffff;
  let backgroundBrightness = 1;
  let titleColor = 0x000000;
  let textColor = 0x000000;

  // ソースの幅と高さ
  const sw = image.width;
  const sh = image.height;

  // 処理しやすいように最大200x200にリサイズする
  const scale = Math.min(1, Math.min(200 / sw, 200 / sh));

  // 作業用画像の幅と高さ
  const dw = Math.floor(sw * scale);
  const dh = Math.floor(sh * scale);

  // canvas を用意
  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;

  // 白で塗りつぶす
  context.fillStyle = defaultBackgroundColor;
  context.beginPath();
  context.rect(0, 0, dw, dh);
  context.closePath();
  context.fill();

  // canvas に転写
  context.drawImage(image, 0, 0, sw, sh, 0, 0, dw, dh);
  const imageData = context.getImageData(0, 0, sw, sh).data;

  // 1. 背景色を決定
  // 雑だけど 1x1 の画像にリサイズして色をとります。中央付近の色になるっぽい。
  backgroundColor = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.fillStyle = defaultBackgroundColor;
    context.beginPath();
    context.rect(0, 0, 1, 1);
    context.closePath();
    context.fill();
    context.drawImage(image, 0, 0, sw, sh, 0, 0, 1, 1);
    const imageData = context.getImageData(0, 0, 1, 1).data;

    const backgroundColor = getPixel(imageData, 1, 0, 0);
    canvas.width = 0;
    canvas.height = 0;
    return backgroundColor;
  })();
  backgroundBrightness = calculateBrightness(backgroundColor); // 背景色の明度

  // 取得した色は再度取得しなくてもいいようにキャッシュして使い回す
  const colors: number[] = [];

  let maxBrightDistance = -1; // 最大明度差

  // 2. テキスト色を決定
  // 背景色との明度差が一番大きいもの
  textColor = (() => {
    let textColor = 0x000000;
    for (let x = 0; x < dw; x += 1) {
      for (let y = 0; y < dh; y += 1) {
        const color = getPixel(imageData, dw, x, y);
        colors.push(color);
        const brightness = calculateBrightness(color);
        if (
          maxBrightDistance == -1 ||
          Math.abs(backgroundBrightness - brightness) > maxBrightDistance
        ) {
          maxBrightDistance = Math.abs(backgroundBrightness - brightness);
          textColor = color;
        }
      }
    }

    // 背景色とテキスト色の明度差が小さければ適当な色を入れておく
    if (Math.abs(calculateBrightness(textColor) - backgroundBrightness) <= 32) {
      textColor = backgroundBrightness < 128 ? 0xffffff : 0x000000;
    }
    return textColor;
  })();

  // 3. タイトル色を決定
  // 背景色とテキスト色との明度差の50%前後にある色をタイトル色にする
  // 最初は 50%±5 の範囲で探して、見つからない場合は閾値5ポイントずつ広げながら見つけていく
  titleColor = (() => {
    let titleColor = 0x000000;

    const defaultBrightnessThreshold = 0.5;

    for (
      let threshold = 0.05;
      threshold < defaultBrightnessThreshold;
      threshold += 0.05
    ) {
      let titleColorMatched = false;

      for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        const brightness = calculateBrightness(color);
        const brightnessDistance = Math.abs(backgroundBrightness - brightness);

        if (
          brightnessDistance >
            maxBrightDistance * (defaultBrightnessThreshold - threshold) &&
          brightnessDistance <
            maxBrightDistance * (defaultBrightnessThreshold + threshold)
        ) {
          titleColor = color;
          titleColorMatched = true;
          break;
        }
      }

      if (titleColorMatched) {
        break;
      }
    }

    // 背景色とタイトル色の明度差が小さければ適当な色を入れておく
    if (
      Math.abs(calculateBrightness(titleColor) - backgroundBrightness) <= 32
    ) {
      titleColor = backgroundBrightness < 128 ? 0xcccccc : 0x333333;
    }

    return titleColor;
  })();

  // 開放
  canvas.width = 0;
  canvas.height = 0;

  return {
    image,
    backgroundColor,
    backgroundBrightness,
    titleColor,
    textColor,
  };
};

// 明度を計算する
function calculateBrightness(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return Math.round((r + g + b) / 3);
}

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

  return rgb2int(r, g, b);
}
