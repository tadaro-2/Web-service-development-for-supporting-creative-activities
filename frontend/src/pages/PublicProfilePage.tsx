import { useEffect, useState } from 'react';
import { ArrowLeft, Award, ImageIcon, Trophy } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import defaultAvatar from '../assets/default-avatar.svg';
import { ApiError, getPublicProfile, type PublicProfileDto } from '../api';

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const id = Number(userId);
  const [data, setData] = useState<PublicProfileDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError('Некорректный профиль');
      setLoading(false);
      return;
    }
    let alive = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await getPublicProfile(id);
        if (alive) setData(p);
      } catch (e) {
        if (alive) setError((e as ApiError).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <div className="top-bar">
          <Link to="/feed" className="back-link">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            Лента
          </Link>
        </div>
        {error ? <div className="alert-error">{error}</div> : null}
        {loading ? <div className="muted">Загрузка…</div> : null}
        {data ? (
          <>
            <div className="profile-header public-profile-header">
              <div className="profile-avatar-wrap">
                <img src={data.avatar_url ?? defaultAvatar} alt="" className="profile-avatar" />
              </div>
              <div className="profile-info">
                <h1>{data.display_name}</h1>
                {data.nickname ? <p className="muted">@{data.nickname}</p> : null}
                <p className="profile-bio">{data.bio || 'Пользователь ещё не добавил описание.'}</p>
                <div className="profile-tags">
                  {data.tags.map((t) => (
                    <span key={t.id} className="tag">
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <section className="achievements card-section">
              <h2 className="section-heading-with-icon">
                <Trophy strokeWidth={1.75} aria-hidden />
                Достижения
              </h2>
              {data.achievements.length === 0 ? (
                <p className="muted">Пока нет достижений.</p>
              ) : (
                <div className="badges">
                  {data.achievements.map((a) => (
                    <div key={a.id} className="badge">
                      <Award strokeWidth={2} aria-hidden />
                      {a.title}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="user-works card-section">
              <h2 className="section-heading-with-icon">
                <ImageIcon strokeWidth={1.75} aria-hidden />
                Опубликованные работы
              </h2>
              {data.published_posts.length === 0 ? (
                <p className="muted">Работ пока нет.</p>
              ) : (
                <div className="feed">
                  {data.published_posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onPostRemoved={(postId) =>
                        setData((d) =>
                          d
                            ? {
                                ...d,
                                published_posts: d.published_posts.filter((x) => x.id !== postId),
                              }
                            : null,
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}
