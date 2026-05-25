import { type FormEvent, useState } from 'react';
import { Bookmark } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { aiAssociations, aiRandomPhrase, ApiError, toggleGenerationBookmark } from '../api';
import { useBookmarkToast } from '../BookmarkToastContext';
import { i18nTextAreaProps, i18nTextInputProps } from '../inputA11y';

type GenTab = 'associations' | 'random';

export default function GenerationPage() {
  const [tab, setTab] = useState<GenTab>('associations');
  const showBookmarkToast = useBookmarkToast();

  const [words, setWords] = useState('');
  const [assocResult, setAssocResult] = useState<string | null>(null);
  const [assocGenId, setAssocGenId] = useState<number | null>(null);
  const [assocInBookmarks, setAssocInBookmarks] = useState(false);
  const [assocBusy, setAssocBusy] = useState(false);

  const [theme, setTheme] = useState('');
  const [randomResult, setRandomResult] = useState<string | null>(null);
  const [randomGenId, setRandomGenId] = useState<number | null>(null);
  const [randomInBookmarks, setRandomInBookmarks] = useState(false);
  const [randomBusy, setRandomBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function onSubmitAssociations(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAssocResult(null);
    setAssocGenId(null);
    setAssocInBookmarks(false);
    const w = words.trim();
    if (!w) {
      setError('Введите хотя бы одно слово или предмет.');
      return;
    }
    setAssocBusy(true);
    try {
      const r = await aiAssociations(w);
      setAssocResult(r.description);
      setAssocGenId(r.id);
      setAssocInBookmarks(r.bookmarked);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setAssocBusy(false);
    }
  }

  async function onSubmitRandom(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setRandomResult(null);
    setRandomGenId(null);
    setRandomInBookmarks(false);
    setRandomBusy(true);
    try {
      const r = await aiRandomPhrase(theme.trim() || undefined);
      setRandomResult(r.phrase);
      setRandomGenId(r.id);
      setRandomInBookmarks(r.bookmarked);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setRandomBusy(false);
    }
  }

  async function onToggleAssocBookmark() {
    if (assocGenId == null) return;
    try {
      const r = await toggleGenerationBookmark(assocGenId);
      setAssocInBookmarks(r.saved);
      showBookmarkToast(r.saved, 'generation');
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function onToggleRandomBookmark() {
    if (randomGenId == null) return;
    try {
      const r = await toggleGenerationBookmark(randomGenId);
      setRandomInBookmarks(r.saved);
      showBookmarkToast(r.saved, 'generation');
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <header className="top-bar">
          <h1>Генерация</h1>
          <div className="feed-tabs">
            <button
              type="button"
              className={`tab${tab === 'associations' ? ' active' : ''}`}
              onClick={() => setTab('associations')}
            >
              Ассоциации
            </button>
            <button
              type="button"
              className={`tab${tab === 'random' ? ' active' : ''}`}
              onClick={() => setTab('random')}
            >
              Рандом-слово
            </button>
          </div>
        </header>

        {error ? <div className="alert-error">{error}</div> : null}

        {tab === 'associations' ? (
          <section className="generation-panel">
            <p className="muted section-hint">
              Введите любые слова или вещи через запятую (или с новой строки). ИИ опишет воображаемую картину, в которой
              эти образы связаны.
            </p>
            <form className="generation-form" onSubmit={onSubmitAssociations}>
              <label className="generation-label" htmlFor="gen-words">
                Слова и образы
              </label>
              <textarea
                id="gen-words"
                className="generation-textarea"
                rows={5}
                value={words}
                onChange={(e) => setWords(e.target.value)}
                placeholder="книга, небо, горы"
                disabled={assocBusy}
                {...i18nTextAreaProps}
              />
              <button type="submit" className="btn-primary" disabled={assocBusy}>
                {assocBusy ? 'Генерация…' : 'Получить описание'}
              </button>
            </form>
            {assocResult ? (
              <div className="generation-result">
                <div className="generation-result-head">
                  <h2 className="generation-result-title">Описание</h2>
                  {assocGenId != null ? (
                    <button
                      type="button"
                      className={`btn-icon btn-bookmark${assocInBookmarks ? ' is-saved active' : ''}`}
                      title={assocInBookmarks ? 'Убрать из закладок' : 'Сохранить в закладки'}
                      aria-pressed={assocInBookmarks}
                      onClick={() => void onToggleAssocBookmark()}
                    >
                      <Bookmark strokeWidth={2} aria-hidden />
                      <span>{assocInBookmarks ? 'В закладках' : 'В закладки'}</span>
                    </button>
                  ) : null}
                </div>
                <div className="generation-result-body">{assocResult}</div>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="generation-panel">
            <p className="muted section-hint">
              Получите одно случайное словосочетание для эскиза или задания. Тему можно оставить пустой — образ будет
              полностью случайным.
            </p>
            <form className="generation-form" onSubmit={onSubmitRandom}>
              <label className="generation-label" htmlFor="gen-theme">
                Тема (необязательно)
              </label>
              <input
                id="gen-theme"
                type="text"
                className="generation-input"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="например: зима, город, сон"
                disabled={randomBusy}
                {...i18nTextInputProps}
              />
              <button type="submit" className="btn-primary" disabled={randomBusy}>
                {randomBusy ? 'Генерация…' : 'Случайная фраза'}
              </button>
            </form>
            {randomResult ? (
              <div className="generation-result">
                <div className="generation-result-head">
                  <h2 className="generation-result-title">Фраза</h2>
                  {randomGenId != null ? (
                    <button
                      type="button"
                      className={`btn-icon btn-bookmark${randomInBookmarks ? ' is-saved active' : ''}`}
                      title={randomInBookmarks ? 'Убрать из закладок' : 'Сохранить в закладки'}
                      aria-pressed={randomInBookmarks}
                      onClick={() => void onToggleRandomBookmark()}
                    >
                      <Bookmark strokeWidth={2} aria-hidden />
                      <span>{randomInBookmarks ? 'В закладках' : 'В закладки'}</span>
                    </button>
                  ) : null}
                </div>
                <div className="generation-result-body generation-result-phrase">{randomResult}</div>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </>
  );
}
