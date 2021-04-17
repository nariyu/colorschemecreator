import { createColorScheme } from 'example/tools/createcolorscheme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { disassemblyColor } from 'shared/utils/colorutil';
import { blobToImage } from 'shared/utils/imageutil';
import { useWindowState } from '../hooks/usewindowstate';
import styles from './mainview.module.scss';

/**
 * MainView
 */
export const MainView = () => {
  const windowSize = useWindowState();

  const [imageUrl, setImageUrl] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#fff');
  const [titleColor, setTitleColor] = useState('#000');
  const [textColor, setTextColor] = useState('#000');
  const [paddingTop, setPaddingTop] = useState('100%');

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImageUrl(image.src);

      setPaddingTop(`${(image.height / image.width) * 100}%`);

      const { backgroundColor, titleColor, textColor } = createColorScheme(
        image,
      );
      setBackgroundColor(disassemblyColor(backgroundColor).hex);
      setTitleColor(disassemblyColor(titleColor).hex);

      const tColor = disassemblyColor(textColor);
      setTextColor(tColor.hex);
    };
    image.src = '/favicons/android-chrome-256x256.png';
  }, []);

  const uploadFile = useCallback((file: File) => {
    if (!file.type.match(/^image\//)) return;

    (async () => {
      try {
        const image = await blobToImage(file);
        setImageUrl(image.src);

        setPaddingTop(`${(image.height / image.width) * 100}%`);

        const { backgroundColor, titleColor, textColor } = createColorScheme(
          image,
        );
        setBackgroundColor(disassemblyColor(backgroundColor).hex);
        setTitleColor(disassemblyColor(titleColor).hex);

        const tColor = disassemblyColor(textColor);
        setTextColor(tColor.hex);
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--color-background',
      backgroundColor,
    );
    document.documentElement.style.setProperty('--color-text', textColor);
    document.documentElement.style.backgroundColor = backgroundColor;
  }, [backgroundColor, textColor]);

  // アートワークのシャドウ
  const artworkShadow = useMemo(() => {
    const bg = parseInt(backgroundColor.replace('#', '0x'), 16);
    const { r: bgR, g: bgG, b: bgB } = disassemblyColor(bg);
    return `linear-gradient(${
      process.browser && windowSize.width > 500 ? 90 : 180
    }deg, rgba(${bgR}, ${bgG}, ${bgB}, 1), rgba(${bgR}, ${bgG}, ${bgB}, 0))`;
  }, [backgroundColor]);

  return (
    <div
      className={styles.component}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();

        event.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();

        const file = event.dataTransfer.files[0];
        uploadFile(file);
      }}
    >
      <div className={styles.content}>
        <div className={styles.text}>
          <h1 className={styles.title} style={{ color: titleColor }}>
            Color Scheme from Image
          </h1>

          <p>
            画像をドロップするか画像をタップして変更すると、その画像からいい感じに背景・タイトル・テキストの色を作ります。
          </p>
          <p lang="en">
            Drop an image or tap an image to change it, and it will create a
            nice background color, title color, and text color from that image.
          </p>
        </div>

        <div
          className={styles.image}
          style={{
            backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
            boxShadow: `0 0 1rem ${backgroundColor} inset, 0 0 1rem ${backgroundColor} inset, 0 0 1rem ${backgroundColor} inset, 0 0 1rem ${backgroundColor} inset, 0 0 1rem ${backgroundColor} inset, 0 0 1rem ${backgroundColor} inset`,
          }}
        >
          <div
            className={styles.shadow}
            style={{
              background: `${artworkShadow}, ${artworkShadow}`,
            }}
          />
          <div className={styles.measure} style={{ paddingTop }} />
          <input
            type="file"
            accept="image/png, image/jpeg"
            className={styles.inputFile}
            onChange={(event) => {
              const file = event.currentTarget.files
                ? event.currentTarget.files[0]
                : null;
              if (file) {
                uploadFile(file);
              }
            }}
          />
        </div>
      </div>
      <p className={styles.colors}>
        background: {backgroundColor}
        <br />
        title: {titleColor}
        <br />
        text: {textColor}
      </p>
    </div>
  );
};
