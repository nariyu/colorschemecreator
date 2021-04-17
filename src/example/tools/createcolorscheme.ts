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

  // 処理しやすいように最大150x150にリサイズする
  const scale = Math.min(1, Math.min(150 / sw, 150 / sh));

  // 作業用画像の幅と高さ
  const dw = Math.floor(sw * scale);
  const dh = Math.floor(sh * scale);

  // canvas を用意
  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;

  // defaultBackgroundColorで塗りつぶす
  // 透明かもしれないからね
  context.fillStyle = defaultBackgroundColor;
  context.beginPath();
  context.rect(0, 0, dw, dh);
  context.closePath();
  context.fill();

  // canvas に転写
  context.drawImage(image, 0, 0, sw, sh, 0, 0, dw, dh);
  const sourceImageData = context.getImageData(0, 0, dw, dh).data;
  const destImageData = Uint8ClampedArray.from(sourceImageData);
  posterize(sourceImageData, destImageData, dw, dh, 5);

  // 1. 背景色を決定
  // 雑だけど小さくリサイズして左上の色をとります。
  backgroundColor = (() => {
    const size = 5;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.fillStyle = defaultBackgroundColor;
    context.beginPath();
    context.rect(0, 0, size, size);
    context.closePath();
    context.fill();
    context.drawImage(image, 0, 0, sw, sh, 0, 0, size, size);
    const imageData = context.getImageData(0, 0, size, size).data;
    const backgroundColor = getPixel(imageData, 1, 0, 0);
    canvas.width = 0;
    canvas.height = 0;
    return backgroundColor;
  })();
  backgroundBrightness = calculateBrightness(backgroundColor); // 背景色の明度

  // 取得した色は再度取得しなくてもいいようにキャッシュして使い回しましょう
  const colors: number[] = [];

  // 最大明度差
  let maxBrightDistance = -1;

  // 2. テキスト色を決定
  // 背景色との明度差が一番大きいものを抽出する
  textColor = (() => {
    let textColor = 0x000000;
    for (let x = 0; x < dw; x += 3) {
      for (let y = 0; y < dh; y += 3) {
        const color = getPixel(destImageData, dw, x, y);
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

      if (titleColorMatched) break;
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
    backgroundBrightness,
    titleColor,
    textColor,
  };
};

// RGB を数字に変換
function rgb2int(r: number, g: number, b: number) {
  return (r << 16) + (g << 8) + b;
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

// 明度を計算する
function calculateBrightness(color: number) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return Math.round((r + g + b) / 3);
}

// ポスタライズ
function posterize(
  source: Uint8ClampedArray,
  dest: Uint8ClampedArray,
  width: number,
  height: number,
  level = 5,
) {
  const n = width * height * 4;
  const numLevels = clamp(level, 2, 256);
  const numAreas = 256 / numLevels;
  const numValues = 256 / (numLevels - 1);

  for (let i = 0; i < n; i += 4) {
    dest[i] = numValues * ((source[i] / numAreas) >> 0);
    dest[i + 1] = numValues * ((source[i + 1] / numAreas) >> 0);
    dest[i + 2] = numValues * ((source[i + 2] / numAreas) >> 0);
    dest[i + 3] = source[i + 3];
  }
}

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}
