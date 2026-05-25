import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ChallengeMetaLines from '../components/ChallengeMetaLines';
import Sidebar from '../components/Sidebar';
import {
  ApiError,
  getChallenge,
  getTagsCatalog,
  joinChallenge,
  refreshChallengeParticipation,
  submitChallengePost,
  type ChallengeDetailDto,
  type ChallengeSlotDto,
  type TagDto,
} from '../api';
import { i18nSearchInputProps, i18nTextAreaProps, i18nTextInputProps } from '../inputA11y';

export default function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const challengeId = Number(id);
  const [data, setData] = useState<ChallengeDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const [slotModal, setSlotModal] = useState<ChallengeSlotDto | null>(null);
  const [pubTitle, setPubTitle] = useState('');
  const [pubDesc, setPubDesc] = useState('');
  const [pubTagIds, setPubTagIds] = useState<number[]>([]);
  const [pubTagSearch, setPubTagSearch] = useState('');
  const [catalogTags, setCatalogTags] = useState<TagDto[]>([]);
  const [pubFiles, setPubFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const filteredPubTags = useMemo(() => {
    const q = pubTagSearch.trim().toLocaleLowerCase('ru-RU');
    if (!q) return catalogTags;
    return catalogTags.filter((t) => t.name.toLocaleLowerCase('ru-RU').includes(q));
  }, [catalogTags, pubTagSearch]);

  async function load() {
    if (!Number.isFinite(challengeId)) {
      setError('Некорректная ссылка');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await getChallenge(challengeId);
      setData(d);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [challengeId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const tags = await getTagsCatalog();
        if (alive) setCatalogTags(tags);
      } catch {
        if (alive) setCatalogTags([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function togglePubTag(id: number) {
    setPubTagIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  function onPubFilesChange(files: FileList | null) {
    if (!files?.length) {
      setPubFiles([]);
      return;
    }
    setPubFiles(Array.from(files).slice(0, 3));
  }

  async function onJoin() {
    setJoining(true);
    setError(null);
    try {
      const part = await joinChallenge(challengeId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              participation: part,
            }
          : prev,
      );
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setJoining(false);
    }
  }

  async function onRefreshParticipation() {
    try {
      const part = await refreshChallengeParticipation(challengeId);
      setData((prev) => (prev ? { ...prev, participation: part } : prev));
    } catch {
      // ignore
    }
  }

  async function onSubmitSlot(e: FormEvent) {
    e.preventDefault();
    if (!slotModal) return;
    const title = pubTitle.trim();
    if (!title) {
      setError('Укажите название работы');
      return;
    }
    if (pubTagIds.length < 1 || pubTagIds.length > 5) {
      setError('Выберите от 1 до 5 тегов');
      return;
    }
    if (pubFiles.length < 1 || pubFiles.length > 3) {
      setError('Загрузите от 1 до 3 изображений');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitChallengePost({
        challengeDayId: slotModal.id,
        title,
        description: pubDesc.trim(),
        tagIds: pubTagIds,
        images: pubFiles,
      });
      setSlotModal(null);
      setPubTitle('');
      setPubDesc('');
      setPubTagIds([]);
      setPubTagSearch('');
      setPubFiles([]);
      await load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  const part = data?.participation;
  const completed = Boolean(part?.completed_at);

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <div className="top-bar">
          <Link to="/challenges" className="back-link">
            Все челленджи
          </Link>
        </div>
        {error ? <div className="alert-error">{error}</div> : null}
        {loading ? <div className="muted">Загрузка…</div> : null}
        {data ? (
          <>
            <div className="challenge-detail-header card-section">
              <div className="challenge-detail-cover">
                {data.cover_url ? <img src={data.cover_url} alt="" /> : <div className="muted">Нет обложки</div>}
              </div>
              <div>
                <h1 className="page-title">{data.title}</h1>
                <div className="challenge-detail-meta">
                  <ChallengeMetaLines c={data} />
                </div>
                <p className="challenge-detail-desc">{data.description}</p>
                {!part ? (
                  <button type="button" className="btn-primary" disabled={joining} onClick={() => void onJoin()}>
                    {joining ? 'Запись…' : 'Принять участие'}
                  </button>
                ) : completed ? (
                  <div className="toast-success" role="status">
                    Испытание пройдено
                    {part.reward_title ? `: достижение «${part.reward_title}» добавлено в профиль.` : '.'}
                  </div>
                ) : (
                  <p className="muted"></p>
                )}
              </div>
            </div>

            {part && !completed ? (
              <section className="card-section">
                <div className="row-btns" style={{ marginBottom: 12 }}>
                  <button type="button" className="btn-secondary small" onClick={() => void onRefreshParticipation()}>
                    Обновить статус ячеек
                  </button>
                </div>
                <h2 className="section-heading">Компоненты испытания:</h2>
                <div className="challenge-slots-grid">
                  {part.slots.map((s) => {
                    const label =
                      s.slot_date != null
                        ? new Date(s.slot_date + 'T12:00:00').toLocaleDateString('ru-RU')
                        : `#${s.day_number + 1}`;
                    const clickable = s.status === 'empty';
                    const cls =
                      s.status === 'completed'
                        ? 'challenge-slot challenge-slot--done'
                        : s.status === 'pending'
                          ? 'challenge-slot challenge-slot--pending'
                          : s.status === 'missed'
                            ? 'challenge-slot challenge-slot--missed'
                            : 'challenge-slot challenge-slot--empty';
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={cls}
                        disabled={!clickable}
                        title={
                          clickable
                            ? 'Отправить работу за этот слот'
                            : s.status === 'pending'
                              ? 'На модерации'
                              : s.status === 'missed'
                                ? 'Пропущено'
                                : 'Готово'
                        }
                        onClick={() => {
                          if (!clickable) return;
                          setSlotModal(s);
                          setPubTitle('');
                          setPubDesc('');
                          setPubTagSearch('');
                          const titleTag = data.title.trim().slice(0, 64);
                          const auto = catalogTags.find((t) => t.name === titleTag);
                          setPubTagIds(auto ? [auto.id] : []);
                          setPubFiles([]);
                          setError(null);
                        }}
                      >
                        <span className="challenge-slot-label">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {completed && part ? (
              <section className="card-section">
                <p className="muted">
                  Награда: <strong>{part.reward_title ?? '—'}</strong>. Отображается в блоке «Достижения» в профиле.
                </p>
              </section>
            ) : null}
          </>
        ) : null}
      </main>

      {slotModal ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="challenge-pub-title"
          onClick={() => !submitting && setSlotModal(null)}
        >
          <div className="modal-sheet modal-publish" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 id="challenge-pub-title">Публикация для ячейки</h2>
              <button
                type="button"
                className="modal-x"
                onClick={() => !submitting && setSlotModal(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <p className="muted small" style={{ marginBottom: 12 }}>
              Как в обычной публикации: название, описание, теги (поиск по названию), изображения. Тег испытания «
              {data?.title.slice(0, 64)}» добавится автоматически, если его нет среди выбранных (всего до 5 тегов).
            </p>
            <form className="publish-form" onSubmit={(e) => void onSubmitSlot(e)}>
              <div className="field">
                <label>Название</label>
                <input value={pubTitle} onChange={(e) => setPubTitle(e.target.value)} required {...i18nTextInputProps} />
              </div>
              <div className="field">
                <label>Описание</label>
                <textarea value={pubDesc} onChange={(e) => setPubDesc(e.target.value)} rows={3} {...i18nTextAreaProps} />
              </div>
              <div className="field">
                <label>Теги (нажмите для выбора, до 5)</label>
                <input
                  type="search"
                  value={pubTagSearch}
                  onChange={(e) => setPubTagSearch(e.target.value)}
                  placeholder="Поиск тега по названию"
                  maxLength={80}
                  {...i18nSearchInputProps}
                />
                <div className="tag-pick">
                  {filteredPubTags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`tag-chip${pubTagIds.includes(t.id) ? ' on' : ''}`}
                      onClick={() => togglePubTag(t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                {filteredPubTags.length === 0 ? <p className="muted small">Ничего не найдено.</p> : null}
              </div>
              <div className="field">
                <label>Изображения (1–3 файла)</label>
                <input type="file" accept="image/*" multiple onChange={(e) => onPubFilesChange(e.target.files)} />
                {pubFiles.length ? <div className="muted small">Выбрано файлов: {pubFiles.length}</div> : null}
              </div>
              <div className="modal-actions-inline">
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Отправка…' : 'Отправить на модерацию'}
                </button>
                <button type="button" className="btn-secondary" disabled={submitting} onClick={() => setSlotModal(null)}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
