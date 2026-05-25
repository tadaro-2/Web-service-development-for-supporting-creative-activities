import { useCallback, useEffect, useRef, useState } from 'react';
import type { PostImage } from '../api';

type Props = {
  images: PostImage[];
  initialIndex: number;
  onClose: () => void;
};

export default function ImageLightbox({ images, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const urls = images.map((i) => i.display_url);

  useEffect(() => {
    setIndex(initialIndex);
    setScale(1);
  }, [initialIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i > 0 ? i - 1 : urls.length - 1));
      if (e.key === 'ArrowRight') setIndex((i) => (i < urls.length - 1 ? i + 1 : 0));
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, urls.length]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setScale((s) => Math.min(4, Math.max(0.5, s + delta)));
  }, []);

  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="image-lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="image-lightbox-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <div className="image-lightbox-counter">
          {index + 1} / {urls.length}
        </div>
        {urls.length > 1 ? (
          <button
            type="button"
            className="image-lightbox-nav image-lightbox-prev"
            onClick={() => setIndex((i) => (i > 0 ? i - 1 : urls.length - 1))}
            aria-label="Предыдущее"
          >
            ‹
          </button>
        ) : null}
        <div className="image-lightbox-stage" onWheel={onWheel}>
          <img
            ref={imgRef}
            src={urls[index]}
            alt=""
            className="image-lightbox-img"
            style={{ transform: `scale(${scale})` }}
            draggable={false}
          />
        </div>
        {urls.length > 1 ? (
          <button
            type="button"
            className="image-lightbox-nav image-lightbox-next"
            onClick={() => setIndex((i) => (i < urls.length - 1 ? i + 1 : 0))}
            aria-label="Следующее"
          >
            ›
          </button>
        ) : null}
        <p className="image-lightbox-hint">Колёсико мыши — масштаб · ← → — фото · Esc — закрыть</p>
      </div>
    </div>
  );
}
