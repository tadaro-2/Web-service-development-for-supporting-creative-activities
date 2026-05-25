import { useState } from 'react';
import type { PostImage } from '../api';
import ImageLightbox from './ImageLightbox';

type Props = {
  images: PostImage[];
};

export default function PostImageGrid({ images }: Props) {
  const [lb, setLb] = useState<number | null>(null);
  if (!images.length) return null;

  const n = images.length;

  return (
    <>
      <div
        className={`post-images-vk count-${n}`}
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {images.map((im, i) => (
          <button
            key={im.id}
            type="button"
            className={`post-img-cell img-${i}`}
            onClick={() => setLb(i)}
            aria-label={`Фото ${i + 1}`}
          >
            <img src={im.display_url} alt="" />
          </button>
        ))}
      </div>
      {lb !== null ? (
        <ImageLightbox images={images} initialIndex={lb} onClose={() => setLb(null)} />
      ) : null}
    </>
  );
}
