import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import { useAuth } from '../auth';
import { ApiError, getFeed, myTags, type FeedPost, type TagDto } from '../api';
import { i18nSearchInputProps } from '../inputA11y';

type FeedTab = 'forMe' | 'all';

export default function FeedPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_admin);
  const [feedTab, setFeedTab] = useState<FeedTab>('forMe');
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [myTagList, setMyTagList] = useState<TagDto[]>([]);
  const [titleQuery, setTitleQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [f, t] = await Promise.all([getFeed(), myTags()]);
        if (alive) {
          setFeed(f);
          setMyTagList(t);
        }
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

  const myTagIds = useMemo(() => new Set(myTagList.map((x) => x.id)), [myTagList]);

  const visible = useMemo(() => {
    const q = titleQuery.trim().toLocaleLowerCase('ru-RU');
    if (isAdmin || feedTab === 'all') {
      return q ? feed.filter((p) => p.title.toLocaleLowerCase('ru-RU').includes(q)) : feed;
    }
    const byTags = feed.filter((p) => p.tags.some((t) => myTagIds.has(t.id)));
    return q ? byTags.filter((p) => p.title.toLocaleLowerCase('ru-RU').includes(q)) : byTags;
  }, [feed, feedTab, myTagIds, isAdmin, titleQuery]);

  function patchPost(next: FeedPost) {
    setFeed((list) => list.map((x) => (x.id === next.id ? next : x)));
  }

  function removePost(postId: number) {
    setFeed((list) => list.filter((x) => x.id !== postId));
  }

  return (
    <>
      <Sidebar />
      <main className={`main-content${isAdmin ? ' admin-content-dark' : ''}`}>
        <header className="top-bar">
          <h1>Лента работ</h1>
          {!isAdmin ? (
            <div className="feed-tabs">
              <button
                type="button"
                className={`tab${feedTab === 'forMe' ? ' active' : ''}`}
                onClick={() => setFeedTab('forMe')}
              >
                Для меня
              </button>
              <button
                type="button"
                className={`tab${feedTab === 'all' ? ' active' : ''}`}
                onClick={() => setFeedTab('all')}
              >
                Все работы
              </button>
            </div>
          ) : null}
        </header>
        <input
          className="search-input"
          value={titleQuery}
          onChange={(e) => setTitleQuery(e.target.value)}
          placeholder="Поиск публикаций по названию (например, креатив)"
          maxLength={120}
          {...i18nSearchInputProps}
        />
        {error ? <div className="alert-error">{error}</div> : null}
        {loading ? <div className="muted">Загрузка…</div> : null}

        <div className="feed">
          {!loading && visible.length === 0 ? (
            <p className="muted">
              {!isAdmin && feedTab === 'forMe'
                ? 'Нет публикаций по вашим тегам. Добавьте теги в профиле или откройте «Все работы».'
                : 'Здесь пока пусто.'}
            </p>
          ) : null}
          {visible.map((post) => (
            <PostCard key={post.id} post={post} onFeedChange={patchPost} onPostRemoved={removePost} />
          ))}
        </div>
      </main>
    </>
  );
}
