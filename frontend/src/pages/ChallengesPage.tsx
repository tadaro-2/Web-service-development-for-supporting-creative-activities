import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ChallengeMetaLines from '../components/ChallengeMetaLines';
import Sidebar from '../components/Sidebar';
import { ApiError, getChallenges, type ChallengeCardDto } from '../api';

type ChallengesTab = 'all' | 'mine';

function ChallengeCardLink({ c, showParticipatingBadge }: { c: ChallengeCardDto; showParticipatingBadge?: boolean }) {
  return (
    <Link to={`/challenges/${c.id}`} className="challenge-card card-section">
      <div className="challenge-card-cover">
        {showParticipatingBadge && c.i_participate ? (
          <span className="challenge-card-participating-badge">Вы участвуете</span>
        ) : null}
        {c.cover_url ? (
          <img src={c.cover_url} alt="" />
        ) : (
          <div className="challenge-card-cover-placeholder muted">Нет обложки</div>
        )}
      </div>
      <h2>{c.title}</h2>
      <ChallengeMetaLines c={c} />
      <p className="challenge-card-desc">
        {c.description.slice(0, 220)}
        {c.description.length > 220 ? '…' : ''}
      </p>
      <span className="challenge-card-cta">Подробнее →</span>
    </Link>
  );
}

export default function ChallengesPage() {
  const [list, setList] = useState<ChallengeCardDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ChallengesTab>('all');

  const myChallenges = useMemo(() => list.filter((c) => c.i_participate), [list]);
  const visibleList = tab === 'all' ? list : myChallenges;

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getChallenges();
        if (alive) setList(data);
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

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <header className="top-bar challenges-page-top">
          <h1 className="page-title challenges-page-title">Челленджи</h1>
          <div className="feed-tabs challenge-view-tabs">
            <button
              type="button"
              className={`tab${tab === 'all' ? ' active' : ''}`}
              onClick={() => setTab('all')}
            >
              Все челленджи
            </button>
            <button
              type="button"
              className={`tab${tab === 'mine' ? ' active' : ''}`}
              onClick={() => setTab('mine')}
            >
              Посмотреть мои
              {myChallenges.length > 0 ? ` (${myChallenges.length})` : ''}
            </button>
          </div>
        </header>
        {error ? <div className="alert-error">{error}</div> : null}
        {loading ? <div className="muted">Загрузка…</div> : null}
        {!loading && list.length === 0 ? <p className="muted">Пока нет опубликованных испытаний.</p> : null}

        {!loading && list.length > 0 && tab === 'mine' && myChallenges.length === 0 ? (
          <p className="muted">Пока нет испытаний с вашим участием.</p>
        ) : null}

        {!loading && visibleList.length > 0 ? (
          <section
            className="challenge-list-section"
            aria-label={tab === 'all' ? 'Все челленджи' : 'Мои испытания'}
          >
            <div className="challenge-cards-grid">
              {visibleList.map((c) => (
                <ChallengeCardLink key={c.id} c={c} showParticipatingBadge={tab === 'all'} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
