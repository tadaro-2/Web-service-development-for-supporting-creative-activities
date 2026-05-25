import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, getSurvey, me, submitSurvey, SurveyQuestion } from '../api';
import { useAuth } from '../auth';
import { i18nSearchInputProps } from '../inputA11y';

type SurveyState = {
  q1_experience: string;
  q2_frequency: string;
  q3_status: string;
  q4_directions: string[];
  q5_difficulties: string[];
};

const EMPTY: SurveyState = {
  q1_experience: '',
  q2_frequency: '',
  q3_status: '',
  q4_directions: [],
  q5_difficulties: [],
};

function toggle(list: string[], value: string, max?: number) {
  const has = list.includes(value);
  if (has) return list.filter((x) => x !== value);
  if (typeof max === 'number' && list.length >= max) return list;
  return [...list, value];
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[] | null>(null);
  const [state, setState] = useState<SurveyState>(EMPTY);
  const [q4Search, setQ4Search] = useState('');
  const [q5Search, setQ5Search] = useState('');
  const [q4Expanded, setQ4Expanded] = useState(false);
  const [q5Expanded, setQ5Expanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const res = await getSurvey();
        if (cancelled) return;
        setQuestions(res.questions);
        if (res.completed) {
          const u = await me();
          await navigate(u.is_admin ? '/admin' : '/dashboard', { replace: true });
        }
      } catch (e) {
        const err = e as ApiError;
        if (!cancelled) setError(err?.message ?? 'Ошибка загрузки опроса');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const qMap = useMemo(() => {
    const m = new Map<string, SurveyQuestion>();
    for (const q of questions ?? []) m.set(q.id, q);
    return m;
  }, [questions]);

  const canSubmit = useMemo(() => {
    if (!state.q1_experience) return false;
    if (!state.q2_frequency) return false;
    if (!state.q3_status) return false;
    if (!state.q4_directions.length) return false;
    if ((qMap.get('q4_directions')?.max ?? 10) < state.q4_directions.length) return false;
    if ((qMap.get('q5_difficulties')?.max ?? 3) < state.q5_difficulties.length) return false;
    return true;
  }, [qMap, state]);

  const q4FilteredOptions = useMemo(() => {
    const list = qMap.get('q4_directions')?.options ?? [];
    const q = q4Search.trim().toLocaleLowerCase('ru-RU');
    const filtered = q ? list.filter((o) => o.label.toLocaleLowerCase('ru-RU').includes(q)) : list;
    return filtered;
  }, [q4Search, qMap]);

  const q5FilteredOptions = useMemo(() => {
    const list = qMap.get('q5_difficulties')?.options ?? [];
    const q = q5Search.trim().toLocaleLowerCase('ru-RU');
    const filtered = q ? list.filter((o) => o.label.toLocaleLowerCase('ru-RU').includes(q)) : list;
    return filtered;
  }, [q5Search, qMap]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitSurvey({
        q1_experience: state.q1_experience,
        q2_frequency: state.q2_frequency,
        q3_status: state.q3_status,
        q4_directions: state.q4_directions,
        q5_difficulties: state.q5_difficulties,
      });
      await refresh();
      const u = await me();
      await navigate(u.is_admin ? '/admin' : '/dashboard', { replace: true });
    } catch (e) {
      const err = e as ApiError;
      setError(err?.message ?? 'Ошибка отправки опроса');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box" style={{ maxWidth: 720 }}>
        <h1>Опрос</h1>
        <p className="hint">
          Это нужно для персонализации контента. Теги назначаются один раз и дальше не меняются.
        </p>
        <p className="hint">
          Аккаунт: <strong>{user?.email ?? '—'}</strong>
        </p>

        {error ? (
          <p className="hint" style={{ color: 'crimson' }}>
            {error}
          </p>
        ) : null}

        {!questions ? (
          <p className="hint">Загрузка...</p>
        ) : (
          <form onSubmit={onSubmit} className="auth-form active">
            {/* Q1 */}
            <fieldset style={{ border: 'none', padding: 0, margin: '12px 0' }}>
              <legend style={{ fontWeight: 700 }}>{qMap.get('q1_experience')?.text}</legend>
              {(qMap.get('q1_experience')?.options ?? []).map((o) => (
                <label key={o.tag} style={{ display: 'block', marginTop: 6 }}>
                  <input
                    type="radio"
                    name="q1_experience"
                    value={o.tag}
                    checked={state.q1_experience === o.tag}
                    onChange={() => setState((s) => ({ ...s, q1_experience: o.tag }))}
                    disabled={busy}
                  />{' '}
                  {o.label}
                </label>
              ))}
            </fieldset>

            {/* Q2 */}
            <fieldset style={{ border: 'none', padding: 0, margin: '12px 0' }}>
              <legend style={{ fontWeight: 700 }}>{qMap.get('q2_frequency')?.text}</legend>
              {(qMap.get('q2_frequency')?.options ?? []).map((o) => (
                <label key={o.tag} style={{ display: 'block', marginTop: 6 }}>
                  <input
                    type="radio"
                    name="q2_frequency"
                    value={o.tag}
                    checked={state.q2_frequency === o.tag}
                    onChange={() => setState((s) => ({ ...s, q2_frequency: o.tag }))}
                    disabled={busy}
                  />{' '}
                  {o.label}
                </label>
              ))}
            </fieldset>

            {/* Q3 */}
            <fieldset style={{ border: 'none', padding: 0, margin: '12px 0' }}>
              <legend style={{ fontWeight: 700 }}>{qMap.get('q3_status')?.text}</legend>
              {(qMap.get('q3_status')?.options ?? []).map((o) => (
                <label key={o.tag} style={{ display: 'block', marginTop: 6 }}>
                  <input
                    type="radio"
                    name="q3_status"
                    value={o.tag}
                    checked={state.q3_status === o.tag}
                    onChange={() => setState((s) => ({ ...s, q3_status: o.tag }))}
                    disabled={busy}
                  />{' '}
                  {o.label}
                </label>
              ))}
            </fieldset>

            {/* Q4 */}
            <fieldset style={{ border: 'none', padding: 0, margin: '12px 0' }}>
              <legend style={{ fontWeight: 700 }}>
                {qMap.get('q4_directions')?.text} (до {qMap.get('q4_directions')?.max ?? 10})
              </legend>
              <p className="hint">Выбрано: {state.q4_directions.length}</p>
              <input
                className="search-input"
                value={q4Search}
                onChange={(e) => setQ4Search(e.target.value)}
                placeholder="Поиск интересующей темы"
                maxLength={80}
                disabled={busy}
                {...i18nSearchInputProps}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {(q4Expanded ? q4FilteredOptions : q4FilteredOptions.slice(0, 12)).map((o) => {
                  const active = state.q4_directions.includes(o.tag);
                  const max = qMap.get('q4_directions')?.max ?? 10;
                  const disabled = busy || (!active && state.q4_directions.length >= max);
                  return (
                    <button
                      key={o.tag}
                      type="button"
                      className={active ? 'btn-primary' : 'btn-secondary'}
                      disabled={disabled}
                      onClick={() =>
                        setState((s) => ({ ...s, q4_directions: toggle(s.q4_directions, o.tag, max) }))
                      }
                      style={{ padding: '8px 10px' }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {q4FilteredOptions.length > 12 ? (
                <button type="button" className="btn-text" onClick={() => setQ4Expanded((s) => !s)}>
                  {q4Expanded ? 'Свернуть список' : 'Показать весь список'}
                </button>
              ) : null}
            </fieldset>

            {/* Q5 */}
            <fieldset style={{ border: 'none', padding: 0, margin: '12px 0' }}>
              <legend style={{ fontWeight: 700 }}>
                {qMap.get('q5_difficulties')?.text} (до {qMap.get('q5_difficulties')?.max ?? 3})
              </legend>
              <p className="hint">Выбрано: {state.q5_difficulties.length}</p>
              <input
                className="search-input"
                value={q5Search}
                onChange={(e) => setQ5Search(e.target.value)}
                placeholder="Поиск проблемы по названию"
                maxLength={80}
                disabled={busy}
                {...i18nSearchInputProps}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {(q5Expanded ? q5FilteredOptions : q5FilteredOptions.slice(0, 12)).map((o) => {
                  const active = state.q5_difficulties.includes(o.tag);
                  const max = qMap.get('q5_difficulties')?.max ?? 3;
                  const disabled = busy || (!active && state.q5_difficulties.length >= max);
                  return (
                    <button
                      key={o.tag}
                      type="button"
                      className={active ? 'btn-primary' : 'btn-secondary'}
                      disabled={disabled}
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          q5_difficulties: toggle(s.q5_difficulties, o.tag, max),
                        }))
                      }
                      style={{ padding: '8px 10px' }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {q5FilteredOptions.length > 12 ? (
                <button type="button" className="btn-text" onClick={() => setQ5Expanded((s) => !s)}>
                  {q5Expanded ? 'Свернуть список' : 'Показать весь список'}
                </button>
              ) : null}
            </fieldset>

            <button type="submit" className="btn-primary" disabled={busy || !canSubmit}>
              {busy ? '...' : 'Сохранить и продолжить'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

