import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import {
  ApiError,
  getBookmarksOverview,
  toggleGenerationBookmark,
  toggleMaterialBookmark,
  togglePaletteBookmark,
  type AiGenerationDto,
  type BookmarksOverviewDto,
  type MaterialDto,
  type PaletteDto,
} from '../api';
import { useBookmarkToast } from '../BookmarkToastContext';

type BmTab = 'posts' | 'materials' | 'generations' | 'palettes';

const GEN_TYPE_LABEL: Record<string, string> = {
  association: 'Ассоциации',
  random_phrase: 'Рандом-слово',
};

export default function BookmarksPage() {
  const showBookmarkToast = useBookmarkToast();
  const [tab, setTab] = useState<BmTab>('posts');
  const [data, setData] = useState<BookmarksOverviewDto | null>(null);
  const [removedPostIds, setRemovedPostIds] = useState<number[]>([]);
  const [removedMaterialIds, setRemovedMaterialIds] = useState<number[]>([]);
  const [removedGenerationIds, setRemovedGenerationIds] = useState<number[]>([]);
  const [removedPaletteIds, setRemovedPaletteIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const o = await getBookmarksOverview();
        if (alive) setData(o);
      } catch (e) {
        if (alive) setError((e as ApiError).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const posts = (data?.posts ?? []).filter((p) => !removedPostIds.includes(p.id));
  const materials = (data?.materials ?? []).filter((m) => !removedMaterialIds.includes(m.id));
  const generations = (data?.generations ?? []).filter((g) => !removedGenerationIds.includes(g.id));
  const palettes = (data?.palettes ?? []).filter((p) => !removedPaletteIds.includes(p.id));

  async function removeMaterialFromBookmarks(id: number) {
    setError(null);
    try {
      const r = await toggleMaterialBookmark(id);
      if (!r.saved) {
        setRemovedMaterialIds((prev) => [...prev, id]);
        showBookmarkToast(false, 'material');
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function removeGenerationFromBookmarks(id: number) {
    setError(null);
    try {
      const r = await toggleGenerationBookmark(id);
      if (!r.saved) {
        setRemovedGenerationIds((prev) => [...prev, id]);
        showBookmarkToast(false, 'generation');
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function removePaletteFromBookmarks(id: number) {
    setError(null);
    try {
      const r = await togglePaletteBookmark(id);
      if (!r.saved) {
        setRemovedPaletteIds((prev) => [...prev, id]);
        showBookmarkToast(false, 'palette');
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <header className="top-bar">
          <h1>Закладки</h1>
        </header>

        <div className="feed-tabs bookmarks-tabs">
          <button
            type="button"
            className={`tab${tab === 'posts' ? ' active' : ''}`}
            onClick={() => setTab('posts')}
          >
            Публикации {posts.length ? `(${posts.length})` : ''}
          </button>
          <button
            type="button"
            className={`tab${tab === 'materials' ? ' active' : ''}`}
            onClick={() => setTab('materials')}
          >
            Материалы {materials.length ? `(${materials.length})` : ''}
          </button>
          <button
            type="button"
            className={`tab${tab === 'generations' ? ' active' : ''}`}
            onClick={() => setTab('generations')}
          >
            Генерации {generations.length ? `(${generations.length})` : ''}
          </button>
          <button
            type="button"
            className={`tab${tab === 'palettes' ? ' active' : ''}`}
            onClick={() => setTab('palettes')}
          >
            Палитры {palettes.length ? `(${palettes.length})` : ''}
          </button>
        </div>

        {error ? <div className="alert-error">{error}</div> : null}
        {loading ? <div className="muted">Загрузка…</div> : null}
        {data && !loading ? (
          <div className="bookmarks-single">
            {tab === 'posts' ? (
              posts.length === 0 ? (
                <p className="muted">Пока нет сохранённых публикаций.</p>
              ) : (
                <div className="feed">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onPostRemoved={(id) => setRemovedPostIds((prev) => [...prev, id])}
                    />
                  ))}
                </div>
              )
            ) : null}
            {tab === 'materials' ? (
              materials.length === 0 ? (
                <p className="muted">Пока нет материалов в закладках.</p>
              ) : (
                <div className="materials-grid">
                  {materials.map((m: MaterialDto) => (
                    <article key={m.id} className="material-card">
                      <div className="material-card-cover-wrap">
                        {m.cover_url ? (
                          <img
                            src={m.cover_url}
                            alt=""
                            className="material-card-cover-img"
                            loading="lazy"
                          />
                        ) : (
                          <div className="material-card-cover-fallback" aria-hidden />
                        )}
                      </div>
                      <div className="material-card-inner">
                        <div className="material-type">{m.type}</div>
                        <h3>{m.title}</h3>
                        {m.content_author ? <p className="material-author">Автор: {m.content_author}</p> : null}
                        <p className="material-desc">{m.description || '—'}</p>
                        <div className="post-tags">
                          {m.tags.map((t) => (
                            <span key={t.id} className="tag">
                              {t.name}
                            </span>
                          ))}
                        </div>
                        {m.external_url ? (
                          <a href={m.external_url} target="_blank" rel="noreferrer" className="material-link">
                            Перейти →
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="btn-secondary small bookmark-tab-remove"
                          onClick={() => void removeMaterialFromBookmarks(m.id)}
                        >
                          Убрать из закладок
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )
            ) : null}
            {tab === 'generations' ? (
              generations.length === 0 ? (
                <p className="muted">Пока нет сохранённых генераций.</p>
              ) : (
                <ul className="bookmark-list-plain">
                  {generations.map((g: AiGenerationDto) => (
                    <li key={g.id} className="bookmark-gen-item">
                      <div className="bookmark-gen-item-head">
                        <span className="material-type">{GEN_TYPE_LABEL[g.type] ?? g.type}</span>
                        <button
                          type="button"
                          className="btn-secondary small bookmark-tab-remove"
                          onClick={() => void removeGenerationFromBookmarks(g.id)}
                        >
                          Убрать
                        </button>
                      </div>
                      {g.input_text ? (
                        <p className="bookmark-gen-text">
                          <span className="bookmark-gen-kicker">Запрос: </span>
                          {g.input_text}
                        </p>
                      ) : null}
                      {g.result_text ? (
                        <p className="bookmark-gen-result">{g.result_text}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
            {tab === 'palettes' ? (
              palettes.length === 0 ? (
                <p className="muted">Пока нет сохранённых палитр.</p>
              ) : (
                <div className="badges">
                  {palettes.map((p: PaletteDto) => (
                    <div key={p.id} className="palette-bookmark-card">
                      <div className="palette-bookmark-card-head">
                        <p className="palette-bookmark-title">{p.description || 'Палитра'}</p>
                        <button
                          type="button"
                          className="btn-secondary small bookmark-tab-remove"
                          onClick={() => void removePaletteFromBookmarks(p.id)}
                        >
                          Убрать
                        </button>
                      </div>
                      <div className="palette-swatches">
                        {p.colors.map((c) => (
                          <span
                            key={c.hex + p.id}
                            className="palette-swatch"
                            style={{ background: c.hex }}
                            title={c.label ? `${c.label} ${c.hex}` : c.hex}
                          />
                        ))}
                      </div>
                      <ul className="palette-bookmark-lines">
                        {p.colors.map((c) => (
                          <li key={`${p.id}-${c.hex}`} className="palette-bookmark-line">
                            {c.label ? (
                              <>
                                <span className="palette-color-name">{c.label}</span>{' '}
                                <span className="palette-color-hex">{c.hex}</span>
                              </>
                            ) : (
                              <span className="palette-color-hex">{c.hex}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </div>
        ) : null}
      </main>
    </>
  );
}
