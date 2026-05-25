import { type FormEvent, useState } from 'react';
import { Bookmark } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import {
  ApiError,
  generatePalette,
  togglePaletteBookmark,
  type PaletteColorEntry,
  type PaletteDto,
} from '../api';
import { useBookmarkToast } from '../BookmarkToastContext';
import { i18nTextInputProps } from '../inputA11y';

function PaletteStripPreview({ colors }: { colors: PaletteColorEntry[] }) {
  const n = Math.max(colors.length, 1);
  const w = 560;
  const h = 140;
  const slice = w / n;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="palette-preview-svg"
      role="img"
      aria-label="Полоса цветов палитры"
      preserveAspectRatio="none"
    >
      {colors.map((c, i) => (
        <rect key={`${c.hex}-${i}`} x={i * slice} y={0} width={slice} height={h} fill={c.hex} />
      ))}
    </svg>
  );
}

export default function PalettesPage() {
  const showBookmarkToast = useBookmarkToast();
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteDto | null>(null);
  const [inBookmarks, setInBookmarks] = useState(false);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setPalette(null);
    setInBookmarks(false);
    try {
      const r = await generatePalette(hint.trim() || undefined);
      setPalette(r.palette);
      setInBookmarks(r.bookmarked);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function onToggleBookmark() {
    if (!palette) return;
    try {
      const r = await togglePaletteBookmark(palette.id);
      setInBookmarks(r.saved);
      showBookmarkToast(r.saved, 'palette');
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <header className="top-bar">
          <h1>Палитры</h1>
        </header>

        <section className="palette-page-panel">
          <p className="muted section-hint">
            Нейросеть подберёт 5–6 сочетаемых цветов по правилам цветового круга. Поле «Пожелание» можно оставить
            пустым — тогда каждое нажатие «Сгенерировать» даёт новую случайную гамму с разным направлением по кругу
            цвета. Если нужна конкретика — опишите настроение или тему.
          </p>

          <form className="generation-form" onSubmit={onGenerate}>
            <label className="generation-label" htmlFor="palette-hint">
              Пожелание (необязательно)
            </label>
            <input
              id="palette-hint"
              type="text"
              className="generation-input"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="например: тёплый закат, пастель, лес туманный"
              disabled={busy}
              {...i18nTextInputProps}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Генерация…' : 'Сгенерировать палитру'}
            </button>
          </form>

          {error ? <div className="alert-error">{error}</div> : null}

          {palette && palette.colors.length > 0 ? (
            <div className="palette-result">
              <div className="palette-result-head">
                <h2 className="generation-result-title">{palette.description || 'Палитра'}</h2>
                <button
                  type="button"
                  className={`btn-icon btn-bookmark${inBookmarks ? ' is-saved active' : ''}`}
                  title={inBookmarks ? 'Убрать из закладок' : 'Сохранить в закладки'}
                  aria-pressed={inBookmarks}
                  onClick={() => void onToggleBookmark()}
                >
                  <Bookmark strokeWidth={2} aria-hidden />
                  <span>{inBookmarks ? 'В закладках' : 'В закладки'}</span>
                </button>
              </div>

              <div className="palette-preview-wrap">
                <PaletteStripPreview colors={palette.colors} />
              </div>

              <ul className="palette-color-list">
                {palette.colors.map((c) => (
                  <li key={`${palette.id}-${c.hex}`} className="palette-color-line">
                    {c.label ? <span className="palette-color-name">{c.label} </span> : null}
                    <span className="palette-color-hex">{c.hex}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
