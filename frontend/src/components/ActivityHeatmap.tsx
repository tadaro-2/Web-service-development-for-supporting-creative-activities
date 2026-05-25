import { useEffect, useMemo, useState } from 'react';
import { ApiError, getActivitySummary, type ActivitySummary } from '../api';

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MONTHS_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

function isoForDay(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthCells(year: number, monthIndex: number, active: Set<string>) {
  const first = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7;
  const cells: { key: string; day: number | null; on: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ key: `pad-${year}-${monthIndex}-${i}`, day: null, on: false });
  }
  for (let d = 1; d <= lastDay; d++) {
    const iso = isoForDay(year, monthIndex, d);
    cells.push({ key: iso, day: d, on: active.has(iso) });
  }
  return cells;
}

function ActivityFullCalendarModal({
  active,
  year,
  onClose,
}: {
  active: Set<string>;
  year: number;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-sheet activity-calendar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Активность за {year}</h2>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="activity-full-scroll">
          {MONTHS_RU.map((name, mi) => {
            const cells = monthCells(year, mi, active);
            return (
              <div key={name} className="activity-full-month-block">
                <h4 className="activity-full-month-title">{name}</h4>
                <div className="activity-weekday-row activity-weekday-row--tiny">
                  {WD.map((w) => (
                    <span key={w} className="activity-wd">
                      {w}
                    </span>
                  ))}
                </div>
                <div className="activity-month-grid activity-month-grid--tiny">
                  {cells.map((c) => (
                    <div
                      key={c.key}
                      className={`activity-cell${c.day == null ? ' empty' : ''}${c.on ? ' on' : ''}`}
                      title={
                        c.day != null
                          ? `${c.day} ${name} ${year}${c.on ? ' — был заход' : ''}`
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ActivityHeatmap() {
  const [data, setData] = useState<ActivitySummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullOpen, setFullOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const s = await getActivitySummary();
        if (alive) setData(s);
      } catch (e) {
        if (alive) setErr((e as ApiError).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const activeSet = useMemo(() => new Set(data?.active_dates ?? []), [data]);

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const cells = useMemo(() => monthCells(y, m, activeSet), [y, m, activeSet]);

  const monthTitle = `${MONTHS_RU[m]} ${y}`;

  if (loading) {
    return <p className="muted">Загрузка активности…</p>;
  }
  if (err) {
    return <p className="muted">Не удалось загрузить активность: {err}</p>;
  }

  return (
    <>
      <div className="activity-month-head">
        <div className="activity-month-head-text">
          <h3 className="activity-month-title">{monthTitle}</h3>
          <span className="muted small">
            Серия: <strong>{data?.streak ?? 0}</strong> {pluralDays(data?.streak ?? 0)}
          </span>
        </div>
        <button type="button" className="btn-secondary small" onClick={() => setFullOpen(true)}>
          Полный календарь
        </button>
      </div>
      <div className="activity-weekday-row">
        {WD.map((w) => (
          <span key={w} className="activity-wd">
            {w}
          </span>
        ))}
      </div>
      <div className="activity-month-grid">
        {cells.map((c) => (
          <div
            key={c.key}
            className={`activity-cell${c.day == null ? ' empty' : ''}${c.on ? ' on' : ''}`}
            title={
              c.day != null
                ? `${c.day}.${String(m + 1).padStart(2, '0')}.${y}${c.on ? ' — был заход' : ''}`
                : undefined
            }
          />
        ))}
      </div>
      {fullOpen ? <ActivityFullCalendarModal active={activeSet} year={y} onClose={() => setFullOpen(false)} /> : null}
    </>
  );
}

function pluralDays(n: number): string {
  const k = Math.abs(n) % 100;
  const d = k % 10;
  if (k > 10 && k < 20) return 'дней';
  if (d === 1) return 'день';
  if (d >= 2 && d <= 4) return 'дня';
  return 'дней';
}
