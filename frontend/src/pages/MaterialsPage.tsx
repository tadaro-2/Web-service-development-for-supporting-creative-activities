import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import {
  ApiError,
  deleteMaterial,
  getMaterials,
  getTagsCatalog,
  toggleMaterialBookmark,
  type MaterialDto,
  type TagDto,
} from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import { useBookmarkToast } from '../BookmarkToastContext';
import { useAuth } from '../auth';
import { i18nSearchInputProps } from '../inputA11y';

type MatTab = 'all' | 'forMe';

const TYPE_LABEL: Record<string, string> = {
  book: 'Книга',
  video: 'Видео',
  article: 'Статья',
  course: 'Курс',
  other: 'Другое',
};

export default function MaterialsPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_admin);
  const showBookmarkToast = useBookmarkToast();
  const [matTab, setMatTab] = useState<MatTab>('all');
  const effectiveTab: MatTab = isAdmin ? 'all' : matTab;
  const [typeFilter, setTypeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState<number | ''>('');
  const [tagSearch, setTagSearch] = useState('');
  const [tagComboOpen, setTagComboOpen] = useState(false);
  const tagComboRef = useRef<HTMLDivElement | null>(null);
  const [titleQuery, setTitleQuery] = useState('');
  const [catalogTags, setCatalogTags] = useState<TagDto[]>([]);
  const [items, setItems] = useState<MaterialDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [materialToDelete, setMaterialToDelete] = useState<MaterialDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const c = await getTagsCatalog();
        if (alive) {
          setCatalogTags(c);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getMaterials({
          for_me: effectiveTab === 'forMe',
          type: typeFilter || undefined,
          tag: tagFilter === '' ? undefined : tagFilter,
        });
        if (alive) setItems(list);
      } catch (e) {
        if (alive) setError((e as ApiError).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [effectiveTab, typeFilter, tagFilter]);

  async function confirmDeleteMaterial() {
    if (!materialToDelete) return;
    const id = materialToDelete.id;
    setDeleteBusy(true);
    setError(null);
    try {
      await deleteMaterial(id);
      setItems((list) => list.filter((x) => x.id !== id));
      setMaterialToDelete(null);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function onToggleBookmark(m: MaterialDto) {
    try {
      const r = await toggleMaterialBookmark(m.id);
      setItems((list) =>
        list.map((x) => (x.id === m.id ? { ...x, bookmarked_by_me: r.saved } : x)),
      );
      showBookmarkToast(r.saved, 'material');
    } catch {
      // ignore
    }
  }

  const sortedCatalogTags = useMemo(
    () => [...catalogTags].sort((a, b) => a.name.localeCompare(b.name, 'ru-RU')),
    [catalogTags],
  );

  const filteredCatalogTags = useMemo(() => {
    const q = tagSearch.trim().toLocaleLowerCase('ru-RU');
    if (!q) return sortedCatalogTags;
    return sortedCatalogTags.filter((t) => t.name.toLocaleLowerCase('ru-RU').includes(q));
  }, [sortedCatalogTags, tagSearch]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = tagComboRef.current;
      if (!el || !tagComboOpen) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setTagComboOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [tagComboOpen]);

  function selectTag(id: number | '', nameForInput: string) {
    setTagFilter(id);
    setTagSearch(nameForInput);
    setTagComboOpen(false);
  }

  function onTagInputChange(value: string) {
    setTagSearch(value);
    setTagComboOpen(true);
    if (tagFilter !== '') {
      const t = catalogTags.find((x) => x.id === tagFilter);
      if (t && value.trim() !== t.name) setTagFilter('');
    }
  }

  const visibleItems = useMemo(() => {
    const q = titleQuery.trim().toLocaleLowerCase('ru-RU');
    if (!q) return items;
    return items.filter((m) => m.title.toLocaleLowerCase('ru-RU').includes(q));
  }, [items, titleQuery]);

  return (
    <>
      <Sidebar />
      <main className={`main-content${isAdmin ? ' admin-content-dark' : ''}`}>
        <header className="top-bar">
          <h1>Материалы</h1>
        </header>

        <div className="materials-toolbar">
          <div className="feed-tabs">
            <button
              type="button"
              className={`tab${effectiveTab === 'all' ? ' active' : ''}`}
              onClick={() => setMatTab('all')}
            >
              Все
            </button>
            {!isAdmin ? (
              <button
                type="button"
                className={`tab${matTab === 'forMe' ? ' active' : ''}`}
                onClick={() => setMatTab('forMe')}
              >
                Для вас
              </button>
            ) : null}
          </div>
          <label className="filter-label materials-title-search">
            <input
              className="search-input"
              value={titleQuery}
              onChange={(e) => setTitleQuery(e.target.value)}
              placeholder="Введите название"
              maxLength={120}
              {...i18nSearchInputProps}
            />
          </label>
          <div className="materials-filters materials-filters--two-cols">
            <label className="filter-label">
              Тип
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                disabled={effectiveTab === 'forMe'}
              >
                <option value="">Все типы</option>
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="materials-tag-filter" ref={tagComboRef}>
              <label className="filter-label">
                Тег
                <div className="tag-combobox">
                  <input
                    className="search-input tag-combobox-input"
                    value={tagSearch}
                    onChange={(e) => onTagInputChange(e.target.value)}
                    onFocus={() => {
                      if (effectiveTab !== 'forMe') setTagComboOpen(true);
                    }}
                    placeholder="Введите название тега"
                    maxLength={80}
                    disabled={effectiveTab === 'forMe'}
                    aria-expanded={tagComboOpen}
                    aria-controls="materials-tag-listbox"
                    role="combobox"
                    {...i18nSearchInputProps}
                  />
                  {tagComboOpen && effectiveTab !== 'forMe' ? (
                    <ul id="materials-tag-listbox" className="tag-combobox-list" role="listbox">
                      <li>
                        <button
                          type="button"
                          className="tag-combobox-item tag-combobox-item--all"
                          onClick={() => selectTag('', '')}
                        >
                          Все теги
                        </button>
                      </li>
                      {filteredCatalogTags.length === 0 ? (
                        <li className="tag-combobox-empty">Нет совпадений</li>
                      ) : (
                        filteredCatalogTags.map((t) => (
                          <li key={t.id}>
                            <button
                              type="button"
                              className={`tag-combobox-item${tagFilter === t.id ? ' is-active' : ''}`}
                              onClick={() => selectTag(t.id, t.name)}
                            >
                              {t.name}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </div>
              </label>
            </div>
          </div>
        </div>
        {error ? <div className="alert-error">{error}</div> : null}
        {loading ? <div className="muted">Загрузка…</div> : null}
        <div className="materials-grid">
          {visibleItems.map((m) => (
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
              <div className="material-card-head">
                <span className="material-type">{TYPE_LABEL[m.type] ?? m.type}</span>
                <button
                  type="button"
                  className={`btn-icon btn-bookmark${m.bookmarked_by_me ? ' is-saved active' : ''}`}
                  title={
                    m.bookmarked_by_me
                      ? 'В закладках — нажмите, чтобы убрать'
                      : 'Сохранить материал в закладки'
                  }
                  aria-pressed={!!m.bookmarked_by_me}
                  onClick={() => void onToggleBookmark(m)}
                >
                  <Bookmark strokeWidth={2} aria-hidden />
                  <span>{m.bookmarked_by_me ? 'В закладках' : 'Сохранить'}</span>
                </button>
              </div>
              <h3>{m.title}</h3>
              {m.content_author ? <p className="material-author">Автор: {m.content_author}</p> : null}
              <p className="material-desc">{m.description || '—'}</p>
              {m.author_social_links?.length ? (
                <div className="material-socials">
                  {m.author_social_links.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noreferrer" className="material-social-link">
                      {s.label}
                    </a>
                  ))}
                </div>
              ) : null}
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
              {isAdmin ? (
                <button
                  type="button"
                  className="material-card-delete"
                  disabled={deleteBusy}
                  onClick={() => setMaterialToDelete(m)}
                >
                  Удалить
                </button>
              ) : null}
              </div>
            </article>
          ))}
        </div>
        {!loading && visibleItems.length === 0 ? <p className="muted">По запросу ничего не найдено.</p> : null}

        <ConfirmDialog
          open={materialToDelete !== null}
          pending={deleteBusy}
          message="Удалить этот материал из каталога безвозвратно? Запись будет удалена из базы; закладки пользователей сбросятся."
          onConfirm={() => void confirmDeleteMaterial()}
          onCancel={() => setMaterialToDelete(null)}
        />
      </main>
    </>
  );
}
