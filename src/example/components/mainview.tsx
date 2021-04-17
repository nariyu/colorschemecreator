import { createColorScheme } from 'example/tools/createcolorscheme';
import { useCallback, useEffect, useState } from 'react';
import { disassemblyColor } from 'shared/utils/colorutil';
import { blobToImage } from 'shared/utils/imageutil';
import { useWindowState } from '../hooks/usewindowstate';
import styles from './mainview.module.scss';

/**
 * MainView
 */
export const MainView = () => {
  useWindowState();

  const [imageUrl, setImageUrl] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#fff');
  const [titleColor, setTitleColor] = useState('#000');
  const [textColor, setTextColor] = useState('#000');
  const [borderColor, setBorderColor] = useState('rgba(0, 0, 0, 0.2)');
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
      setBorderColor(`rgba(${tColor.r}, ${tColor.g}, ${tColor.b}, 0.3)`);
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
        setBorderColor(`rgba(${tColor.r}, ${tColor.g}, ${tColor.b}, 0.3)`);
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  return (
    <div
      className={styles.component}
      style={{ backgroundColor, borderColor, color: textColor }}
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
      <h1 className={styles.title} style={{ color: titleColor }}>
        Color Scheme Creator
      </h1>

      <div
        className={styles.image}
        style={{
          backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
          boxShadow: `0 0 1rem ${backgroundColor} inset, 0 0 1rem ${backgroundColor} inset, 0 0 1rem ${backgroundColor} inset, 0 0 1rem ${backgroundColor} inset, 0 0 1rem ${backgroundColor} inset, 0 0 1rem ${backgroundColor} inset`,
        }}
      >
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

      <div className={styles.text}>
        <p>
          画像をドロップすると、その画像からいい感じに背景・タイトル・テキストの色を作ります。
        </p>
        <p lang="en">
          When you drop an image, it will create a nice background color, title
          color, and text color from the image.
        </p>
      </div>

      <p className={styles.colors}>
        background color: {backgroundColor}
        <br />
        title color: {titleColor}
        <br />
        text color: {textColor}
      </p>
    </div>
  );
};
