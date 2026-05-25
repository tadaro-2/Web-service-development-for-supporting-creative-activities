import { useEffect, useState } from 'react';
import { Flame, PenLine, SwatchBook, Wand2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../auth';
import { ApiError, getActivitySummary, getMaterials, type MaterialDto } from '../api';

const TYPE_LABEL: Record<string, string> = {
  book: 'Книга',
  video: 'Видео',
  article: 'Статья',
  course: 'Курс',
  other: 'Другое',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_admin);
  const navigate = useNavigate();
  const [streak, setStreak] = useState<number | null>(null);
  const [recMaterials, setRecMaterials] = useState<MaterialDto[] | null>(null);
  const [recError, setRecError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const s = await getActivitySummary();
        if (alive) setStreak(s.streak);
      } catch {
        if (alive) setStreak(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setRecError(null);
      try {
        const list = await getMaterials({ for_me: true });
        if (!alive) return;
        setRecMaterials(list.slice(0, 2));
      } catch (e) {
        if (!alive) return;
        setRecMaterials([]);
        setRecError((e as ApiError).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const streakLabel =
    streak === null ? (
      <span className="streak-with-icon">
        <Flame strokeWidth={2} aria-hidden />
        Серия: …
      </span>
    ) : (
      <span className="streak-with-icon">
        <Flame strokeWidth={2} aria-hidden />
        Серия: <strong>{streak}</strong> {streakPlural(streak)}
      </span>
    );

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <header className="top-bar">
          <h1>Добро пожаловать!</h1>
          <div className="streak" title="Подряд дней с заходом на сайт (см. профиль — активность)">
            {streakLabel}
          </div>
        </header>

        <section className="quick-actions">
          <h2>Быстрые действия</h2>
          <div className="action-grid">
            <div className="action-card">
              <span className="ui-icon-block" aria-hidden>
                <Wand2 />
              </span>
              <h3>Генерация идей</h3>
              <button type="button" className="btn-secondary" onClick={() => void navigate('/generation')}>
                Попробовать
              </button>
            </div>
            <div className="action-card">
              <span className="ui-icon-block" aria-hidden>
                <SwatchBook />
              </span>
              <h3>Случайная палитра</h3>
              <button type="button" className="btn-secondary" onClick={() => void navigate('/palettes')}>
                Сгенерировать
              </button>
            </div>
            <div className="action-card">
              <span className="ui-icon-block" aria-hidden>
                <PenLine />
              </span>
              <h3>Опубликовать работу</h3>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void navigate('/profile', { state: { openPublish: true } })}
              >
                Добавить
              </button>
            </div>
          </div>
        </section>

        <section className="recommendations">
          <h2>Рекомендовано для вас</h2>
          {recError ? <div className="alert-error">{recError}</div> : null}
          {recMaterials === null ? (
            <div className="dashboard-rec-grid cards-grid">
              <div className="dashboard-rec-skeleton" aria-hidden />
              <div className="dashboard-rec-skeleton" aria-hidden />
            </div>
          ) : recMaterials.length === 0 && !recError ? (
            <p className="muted" style={{ marginTop: 12 }}>
              {isAdmin ? (
                <>В каталоге пока нет материалов. Добавьте записи в разделе «Материалы» в панели администратора.</>
              ) : (
                <>
                  Пока нет материалов по вашим тегам. Укажите интересы в <Link to="/profile">профиле</Link> или откройте{' '}
                  <Link to="/materials">каталог</Link>.
                </>
              )}
            </p>
          ) : (
            <div className="dashboard-rec-grid cards-grid">
              {recMaterials.map((m) => (
                <DashboardRecMaterialCard key={m.id} material={m} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function DashboardRecMaterialCard({ material: m }: { material: MaterialDto }) {
  const typeLabel = TYPE_LABEL[m.type] ?? m.type;

  return (
    <div className="content-card dashboard-rec-card">
      <div className="card-body">
        <div className="dashboard-rec-tags">
          {m.tags.length > 0 ? (
            m.tags.map((t) => (
              <span key={t.id} className="tag">
                {t.name}
              </span>
            ))
          ) : (
            <span className="tag">{typeLabel}</span>
          )}
        </div>
        <h3 className="dashboard-rec-title">{m.title}</h3>
        {m.external_url ? (
          <a href={m.external_url} target="_blank" rel="noreferrer" className="btn-primary dashboard-rec-go">
            Перейти
          </a>
        ) : (
          <Link to="/materials" className="btn-primary dashboard-rec-go">
            Перейти
          </Link>
        )}
      </div>
    </div>
  );
}

function streakPlural(n: number): string {
  const k = Math.abs(n) % 100;
  const d = k % 10;
  if (k > 10 && k < 20) return 'дней';
  if (d === 1) return 'день';
  if (d >= 2 && d <= 4) return 'дня';
  return 'дней';
}
