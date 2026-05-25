import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ModerationPostModal from '../components/ModerationPostModal';
import {
  ApiError,
  adminCreateChallenge,
  adminListChallenges,
  adminPatchChallenge,
  adminPublishChallenge,
  adminUnpublishChallenge,
  createMaterial,
  getAdminAiModelConfig,
  listAdminOpenAiModels,
  getPendingPosts,
  getTagsCatalog,
  moderatePost,
  updateAdminAiModelConfig,
  type ChallengeCardDto,
  type FeedPost,
  type MaterialSocialLink,
  type TagDto,
} from '../api';
import defaultAvatar from '../assets/default-avatar.svg';
import { i18nSearchInputProps, i18nTextAreaProps, i18nTextInputProps, i18nUrlInputProps } from '../inputA11y';

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const challengeEditor = searchParams.get('challenge_editor');
  const tab =
    tabParam === 'materials' || tabParam === 'ai' || tabParam === 'challenges' ? tabParam : 'queue';
  const showChallengeList = tab === 'challenges' && !challengeEditor;

  const [queue, setQueue] = useState<FeedPost[]>([]);
  const [modalPost, setModalPost] = useState<FeedPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [matSuccess, setMatSuccess] = useState(false);

  const [tags, setTags] = useState<TagDto[]>([]);
  const [matTitle, setMatTitle] = useState('');
  const [matDesc, setMatDesc] = useState('');
  const [matType, setMatType] = useState('book');
  const [matUrl, setMatUrl] = useState('');
  const [matContentAuthor, setMatContentAuthor] = useState('');
  const [matSocialLinks, setMatSocialLinks] = useState<MaterialSocialLink[]>([{ label: '', url: '' }]);
  const [matTagIds, setMatTagIds] = useState<number[]>([]);
  const [matTagSearch, setMatTagSearch] = useState('');
  const [matSaving, setMatSaving] = useState(false);
  /** Модель, сохранённая на сервере (из GET /admin/ai/model/) */
  const [aiModelSaved, setAiModelSaved] = useState('');
  /** Выбранная в списке модель (из GET /admin/ai/models/) */
  const [aiModelPick, setAiModelPick] = useState('');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiUpdatedAt, setAiUpdatedAt] = useState('');
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiModelIds, setAiModelIds] = useState<string[]>([]);
  const [aiModelsLoading, setAiModelsLoading] = useState(false);
  const [aiModelsError, setAiModelsError] = useState<string | null>(null);
  const [aiModelsMeta, setAiModelsMeta] = useState<{ cached: boolean; ageSec: number | null } | null>(null);

  const [chList, setChList] = useState<ChallengeCardDto[]>([]);
  const [chLoading, setChLoading] = useState(false);
  const [chDraftId, setChDraftId] = useState<number | null>(null);
  const [chTitle, setChTitle] = useState('');
  const [chDesc, setChDesc] = useState('');
  const [chReward, setChReward] = useState('');
  const [chDur, setChDur] = useState('');
  const [chReqPub, setChReqPub] = useState('');
  const [chDateStart, setChDateStart] = useState('');
  const [chDateEnd, setChDateEnd] = useState('');
  const [chCover, setChCover] = useState<File | null>(null);
  const [chSaving, setChSaving] = useState(false);
  const challengeFormSyncedRef = useRef<string>('');

  function formatChPublishedAt(iso: string | null): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '';
    }
  }

  const chPublishedSorted = useMemo(() => {
    return [...chList]
      .filter((c) => c.is_published)
      .sort((a, b) => {
        const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
        const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
        return tb - ta;
      });
  }, [chList]);

  const chDraftSorted = useMemo(() => {
    return [...chList].filter((c) => !c.is_published).sort((a, b) => b.id - a.id);
  }, [chList]);

  function openChallengeListOnly() {
    const p = new URLSearchParams(searchParams);
    p.set('tab', 'challenges');
    p.delete('challenge_editor');
    setSearchParams(p);
  }

  function openChallengeEditorNew() {
    const p = new URLSearchParams(searchParams);
    p.set('tab', 'challenges');
    p.set('challenge_editor', 'new');
    setSearchParams(p);
  }

  function openChallengeEditorEdit(id: number) {
    const p = new URLSearchParams(searchParams);
    p.set('tab', 'challenges');
    p.set('challenge_editor', String(id));
    setSearchParams(p);
  }

  async function loadQueue() {
    setError(null);
    try {
      const list = await getPendingPosts();
      setQueue(list);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  useEffect(() => {
    if (!matSuccess) return;
    const t = window.setTimeout(() => setMatSuccess(false), 4500);
    return () => window.clearTimeout(t);
  }, [matSuccess]);

  useEffect(() => {
    if (tab !== 'materials') return;
    let alive = true;
    void (async () => {
      try {
        const t = await getTagsCatalog();
        if (alive) setTags(t);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'challenges') return;
    let alive = true;
    void (async () => {
      setChLoading(true);
      try {
        const list = await adminListChallenges();
        if (alive) setChList(list);
      } catch {
        if (alive) setChList([]);
      } finally {
        if (alive) setChLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'challenges') {
      challengeFormSyncedRef.current = '';
      return;
    }
    if (!challengeEditor) {
      challengeFormSyncedRef.current = '';
      return;
    }
    if (challengeEditor === 'new') {
      challengeFormSyncedRef.current = '';
      setChDraftId(null);
      setChTitle('');
      setChDesc('');
      setChReward('');
      setChDur('');
      setChReqPub('');
      setChDateStart('');
      setChDateEnd('');
      setChCover(null);
      return;
    }
    const id = Number(challengeEditor);
    if (!Number.isFinite(id) || id < 1) {
      openChallengeListOnly();
      return;
    }
    if (challengeFormSyncedRef.current === challengeEditor) return;
    const c = chList.find((x) => x.id === id);
    if (!c) return;
    challengeFormSyncedRef.current = challengeEditor;
    setChDraftId(c.id);
    setChTitle(c.title);
    setChDesc(c.description);
    setChReward(c.reward_title ?? '');
    setChDur(c.duration_days != null ? String(c.duration_days) : '');
    setChReqPub(c.required_publications != null ? String(c.required_publications) : '');
    setChDateStart(c.date_start ? c.date_start.slice(0, 10) : '');
    setChDateEnd(c.date_end ? c.date_end.slice(0, 10) : '');
    setChCover(null);
  }, [tab, challengeEditor, chList]);

  useEffect(() => {
    if (tab !== 'ai') return;
    let alive = true;
    void (async () => {
      setAiMessage(null);
      setAiModelsError(null);
      setAiModelsLoading(true);
      try {
        const [cfg, modelsRes] = await Promise.all([getAdminAiModelConfig(), listAdminOpenAiModels(false)]);
        if (!alive) return;
        const ids = modelsRes.models.map((m) => m.id);
        setAiModelSaved(cfg.model_name);
        setAiUpdatedAt(cfg.updated_at);
        setAiModelIds(ids);
        setAiModelsMeta({ cached: modelsRes.cached, ageSec: modelsRes.age_sec });
        setAiModelPick(ids.includes(cfg.model_name) ? cfg.model_name : '');
      } catch (e) {
        if (!alive) return;
        const err = e as ApiError;
        try {
          const cfg = await getAdminAiModelConfig();
          if (!alive) return;
          setAiModelSaved(cfg.model_name);
          setAiUpdatedAt(cfg.updated_at);
          setAiModelPick('');
        } catch {
          if (alive) setError(err.message);
        }
        if (alive) setAiModelsError(err.message);
      } finally {
        if (alive) setAiModelsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab]);

  async function refreshAiModels() {
    setAiModelsError(null);
    setAiModelsLoading(true);
    try {
      const modelsRes = await listAdminOpenAiModels(true);
      const ids = modelsRes.models.map((m) => m.id);
      setAiModelIds(ids);
      setAiModelsMeta({ cached: modelsRes.cached, ageSec: modelsRes.age_sec });
      setAiModelPick((pick) => (ids.includes(pick) ? pick : ids.includes(aiModelSaved) ? aiModelSaved : ''));
    } catch (e) {
      setAiModelsError((e as ApiError).message);
    } finally {
      setAiModelsLoading(false);
    }
  }

  async function handleApprove(id: number) {
    setError(null);
    try {
      await moderatePost(id, 'approve');
      setQueue((q) => q.filter((p) => p.id !== id));
      setModalPost(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleReject(id: number, reason: string) {
    setError(null);
    try {
      await moderatePost(id, 'reject', reason);
      setQueue((q) => q.filter((p) => p.id !== id));
      setModalPost(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  function toggleMatTag(id: number) {
    setMatTagIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 20) return prev;
      return [...prev, id];
    });
  }

  const filteredMaterialTags = tags.filter((t) =>
    t.name.toLocaleLowerCase('ru-RU').includes(matTagSearch.trim().toLocaleLowerCase('ru-RU')),
  );

  function setSocialRow(i: number, field: 'label' | 'url', value: string) {
    setMatSocialLinks((rows) => {
      const next = [...rows];
      const cur = next[i] ?? { label: '', url: '' };
      next[i] = field === 'label' ? { ...cur, label: value } : { ...cur, url: value };
      return next;
    });
  }

  function addSocialRow() {
    setMatSocialLinks((rows) => [...rows, { label: '', url: '' }]);
  }

  function removeSocialRow(i: number) {
    setMatSocialLinks((rows) => rows.filter((_, j) => j !== i));
  }

  async function onMaterialSubmit(e: FormEvent) {
    e.preventDefault();
    const title = matTitle.trim();
    const desc = matDesc.trim();
    const url = matUrl.trim();
    const author = matContentAuthor.trim();
    const links: MaterialSocialLink[] = matSocialLinks
      .map((r) => ({ label: r.label.trim(), url: r.url.trim() }))
      .filter((r): r is MaterialSocialLink => r.label.length > 0 && r.url.length > 0);
    if (!title) {
      setError('Укажите название материала');
      return;
    }
    if (desc.length < 10) {
      setError('Описание — не менее 10 символов');
      return;
    }
    if (!url) {
      setError('Укажите ссылку на материал');
      return;
    }
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad');
    } catch {
      setError('Некорректный адрес ссылки (нужен http:// или https://)');
      return;
    }
    if (!author) {
      setError('Укажите автора материала');
      return;
    }
    if (matTagIds.length < 1) {
      setError('Выберите хотя бы один тег');
      return;
    }
    setMatSaving(true);
    setError(null);
    try {
      await createMaterial({
        title,
        description: desc,
        type: matType,
        external_url: url,
        content_author: author,
        author_social_links: links,
        tag_ids: matTagIds,
      });
      setMatTitle('');
      setMatDesc('');
      setMatUrl('');
      setMatContentAuthor('');
      setMatSocialLinks([{ label: '', url: '' }]);
      setMatTagIds([]);
      setMatSuccess(true);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setMatSaving(false);
    }
  }

  function clearChallengeForm() {
    setChDraftId(null);
    setChTitle('');
    setChDesc('');
    setChReward('');
    setChDur('');
    setChReqPub('');
    setChDateStart('');
    setChDateEnd('');
    setChCover(null);
  }

  function buildChallengeFormData(): FormData {
    const fd = new FormData();
    fd.append('title', chTitle.trim());
    fd.append('description', chDesc.trim());
    fd.append('reward_title', chReward.trim());
    fd.append('duration_days', chDur.trim());
    fd.append('required_publications', chReqPub.trim());
    fd.append('date_start', chDateStart.trim());
    fd.append('date_end', chDateEnd.trim());
    if (chCover) fd.append('cover', chCover);
    return fd;
  }

  function validateChallengePublish(): string | null {
    if (!chTitle.trim()) return 'Укажите название испытания';
    if (!chDesc.trim()) return 'Укажите описание испытания';
    if (!chReward.trim()) return 'Укажите название достижения';
    const existing = chDraftId ? chList.find((x) => x.id === chDraftId) : null;
    const hasCover = Boolean(chCover) || Boolean(existing?.cover_url);
    if (!hasCover) return 'Загрузите заголовочную картинку';
    const hasRange = chDateStart.trim() && chDateEnd.trim();
    const hasPub = chReqPub.trim().length > 0;
    const hasDur = chDur.trim().length > 0;
    if (!hasRange && !hasPub && !hasDur) {
      return 'Задайте период (две даты), или число публикаций, или количество дней';
    }
    return null;
  }

  async function onChallengeSaveDraft(e: FormEvent) {
    e.preventDefault();
    if (!chTitle.trim()) {
      setError('Укажите название');
      return;
    }
    setChSaving(true);
    setError(null);
    try {
      const fd = buildChallengeFormData();
      if (chDraftId) {
        await adminPatchChallenge(chDraftId, fd);
      } else {
        const created = await adminCreateChallenge(fd);
        const p = new URLSearchParams(searchParams);
        p.set('tab', 'challenges');
        p.set('challenge_editor', String(created.id));
        setSearchParams(p);
        challengeFormSyncedRef.current = '';
      }
      setChList(await adminListChallenges());
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setChSaving(false);
    }
  }

  async function onChallengePublish() {
    const err = validateChallengePublish();
    if (err) {
      setError(err);
      return;
    }
    setChSaving(true);
    setError(null);
    try {
      const fd = buildChallengeFormData();
      if (chDraftId) {
        await adminPatchChallenge(chDraftId, fd);
        await adminPublishChallenge(chDraftId);
      } else {
        await adminCreateChallenge(fd, { publishNow: true });
      }
      clearChallengeForm();
      challengeFormSyncedRef.current = '';
      setChList(await adminListChallenges());
      openChallengeListOnly();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setChSaving(false);
    }
  }

  async function onChallengeTogglePublish(c: ChallengeCardDto) {
    setError(null);
    try {
      if (c.is_published) {
        await adminUnpublishChallenge(c.id);
      } else {
        await adminPublishChallenge(c.id);
      }
      setChList(await adminListChallenges());
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function onAiModelSubmit(e: FormEvent) {
    e.preventDefault();
    const nextModel = aiModelPick.trim();
    if (!nextModel) {
      setError('Выберите модель из списка');
      return;
    }
    if (!aiModelIds.includes(nextModel)) {
      setError('Выбранная модель отсутствует в загруженном списке. Обновите список.');
      return;
    }
    setAiSaving(true);
    setError(null);
    setAiMessage(null);
    try {
      const cfg = await updateAdminAiModelConfig(nextModel);
      setAiModelSaved(cfg.model_name);
      setAiModelPick(aiModelIds.includes(cfg.model_name) ? cfg.model_name : '');
      setAiUpdatedAt(cfg.updated_at);
      setAiMessage('Модель ИИ обновлена');
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setAiSaving(false);
    }
  }

  return (
    <>
      <Sidebar />
      <div className="admin-shell admin-shell--single">
        <main className="admin-main">
          {matSuccess ? (
            <div className="toast-success" role="status">
              Материал успешно добавлен
            </div>
          ) : null}
          {error ? <div className="alert-error">{error}</div> : null}

          {tab === 'queue' ? (
            <>
              <h1 className="admin-title">Очередь модерации</h1>
              {loading ? <div className="muted">Загрузка…</div> : null}
              {!loading && queue.length === 0 ? <p className="muted">Очередь пуста.</p> : null}
              <div className="admin-queue-compact">
                {queue.map((p) => (
                  <div key={p.id} className="admin-queue-row">
                    <button type="button" className="btn-admin-preview" onClick={() => setModalPost(p)}>
                      Просмотр
                    </button>
                    <div className="admin-queue-meta">
                      <strong>{p.title}</strong>
                      <span className="muted small">
                        {p.author.display_name}
                        {p.images.length ? ` · ${p.images.length} фото` : ''}
                      </span>
                    </div>
                    <img
                      className="admin-queue-thumb"
                      src={p.images[0]?.display_url ?? defaultAvatar}
                      alt=""
                    />
                  </div>
                ))}
              </div>
            </>
          ) : tab === 'challenges' ? (
            showChallengeList ? (
              <>
                <h1 className="admin-title">Челленджи</h1>
                <div className="row-btns" style={{ marginBottom: 20 }}>
                  <button type="button" className="btn-primary" onClick={() => openChallengeEditorNew()}>
                    Создать испытание
                  </button>
                </div>
                {chLoading ? <div className="muted">Загрузка…</div> : null}
                {chList.length === 0 ? (
                  <div className="admin-panel-dark admin-challenge-list">
                    <p className="muted" style={{ margin: 0 }}>
                      Пока нет записей.
                    </p>
                  </div>
                ) : (
                  <div className="admin-challenge-accordions">
                    <details className="admin-challenge-accordion admin-panel-dark" open>
                      <summary className="admin-challenge-accordion__summary">
                        Опубликованные ({chPublishedSorted.length})
                      </summary>
                      {chPublishedSorted.length === 0 ? (
                        <p className="muted admin-challenge-accordion__empty">Нет опубликованных испытаний.</p>
                      ) : (
                        <ul className="admin-challenge-rows admin-challenge-accordion__list">
                          {chPublishedSorted.map((c) => (
                            <li key={c.id} className="admin-challenge-row">
                              <span>
                                <strong>{c.title || `ID ${c.id}`}</strong>{' '}
                                <span className="muted small">
                                  {c.published_at
                                    ? `опубликовано ${formatChPublishedAt(c.published_at)}`
                                    : 'на сайте'}
                                </span>
                              </span>
                              <div className="row-btns">
                                <button
                                  type="button"
                                  className="btn-secondary small"
                                  onClick={() => openChallengeEditorEdit(c.id)}
                                >
                                  Редактировать
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary small"
                                  onClick={() => void onChallengeTogglePublish(c)}
                                >
                                  Снять с сайта
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                    <details className="admin-challenge-accordion admin-panel-dark" open>
                      <summary className="admin-challenge-accordion__summary">
                        Черновики ({chDraftSorted.length})
                      </summary>
                      {chDraftSorted.length === 0 ? (
                        <p className="muted admin-challenge-accordion__empty">Черновиков нет.</p>
                      ) : (
                        <ul className="admin-challenge-rows admin-challenge-accordion__list">
                          {chDraftSorted.map((c) => (
                            <li key={c.id} className="admin-challenge-row">
                              <span>
                                <strong>{c.title || `ID ${c.id}`}</strong>{' '}
                                <span className="muted small">черновик</span>
                              </span>
                              <div className="row-btns">
                                <button
                                  type="button"
                                  className="btn-secondary small"
                                  onClick={() => openChallengeEditorEdit(c.id)}
                                >
                                  Редактировать
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary small"
                                  onClick={() => void onChallengeTogglePublish(c)}
                                >
                                  Опубликовать
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="admin-challenge-toolbar">
                  <button type="button" className="btn-secondary" onClick={() => openChallengeListOnly()}>
                    ← К списку испытаний
                  </button>
                </div>
                <h1 className="admin-title">
                  {challengeEditor === 'new'
                    ? 'Новое испытание'
                    : chDraftId
                      ? `Редактирование #${chDraftId}`
                      : 'Редактор испытания'}
                </h1>
                <form className="admin-form admin-challenge-form-wrap admin-panel-dark" onSubmit={(e) => void onChallengeSaveDraft(e)}>
                  <h2 className="admin-panel-dark__title admin-panel-dark__title--form">
                    {challengeEditor === 'new' ? 'Параметры' : 'Параметры испытания'}
                  </h2>
                <div className="field">
                  <label>
                    Название <span className="label-mark req">обязательно</span>
                  </label>
                  <input
                    value={chTitle}
                    onChange={(e) => setChTitle(e.target.value)}
                    maxLength={255}
                    {...i18nTextInputProps}
                  />
                </div>
                <div className="field">
                  <label>
                    Описание испытания <span className="label-mark req">перед публикацией</span>
                  </label>
                  <textarea value={chDesc} onChange={(e) => setChDesc(e.target.value)} rows={4} {...i18nTextAreaProps} />
                </div>
                <div className="field">
                  <label>
                    Заголовочная картинка <span className="label-mark req">перед публикацией</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setChCover(e.target.files?.[0] ?? null)}
                  />
                  <p className="muted small">Для нового испытания загрузите файл; при редактировании можно оставить без
                    изменений.</p>
                </div>
                <div className="field">
                  <label>Количество дней (необязательно)</label>
                  <input
                    type="number"
                    min={1}
                    value={chDur}
                    onChange={(e) => setChDur(e.target.value)}
                    placeholder="Если задано без периода и числа публикаций — столько ячеек"
                  />
                </div>
                <div className="field">
                  <label>Число обязательных публикаций (необязательно)</label>
                  <input
                    type="number"
                    min={1}
                    value={chReqPub}
                    onChange={(e) => setChReqPub(e.target.value)}
                    placeholder="Фиксированное число работ (без привязки к датам дня)"
                  />
                </div>
                <div className="field">
                  <label>Дата начала (необязательно)</label>
                  <input type="date" value={chDateStart} onChange={(e) => setChDateStart(e.target.value)} />
                </div>
                <div className="field">
                  <label>Дата окончания (необязательно)</label>
                  <input type="date" value={chDateEnd} onChange={(e) => setChDateEnd(e.target.value)} />
                </div>
                <div className="field">
                  <label>
                    Название достижения <span className="label-mark req">перед публикацией</span>
                  </label>
                  <input
                    value={chReward}
                    onChange={(e) => setChReward(e.target.value)}
                    maxLength={255}
                    {...i18nTextInputProps}
                  />
                </div>
                <div className="row-btns" style={{ gap: 12, flexWrap: 'wrap' }}>
                  <button type="submit" className="btn-admin-ok" disabled={chSaving}>
                    {chSaving ? 'Сохранение…' : 'Сохранить черновик'}
                  </button>
                  {challengeEditor === 'new' ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={chSaving}
                      onClick={() => {
                        clearChallengeForm();
                        challengeFormSyncedRef.current = '';
                      }}
                    >
                      Очистить черновик
                    </button>
                  ) : null}
                  <button type="button" className="btn-primary" disabled={chSaving} onClick={() => void onChallengePublish()}>
                    Опубликовать на сайте
                  </button>
                </div>
              </form>
              </>
            )
          ) : tab === 'materials' ? (
            <>
              <h1 className="admin-title">Добавить материал</h1>
          
              <form className="admin-form" onSubmit={(e) => void onMaterialSubmit(e)}>
                <div className="field">
                  <label>
                    Название <span className="label-mark req">обязательно</span>
                  </label>
                  <input
                    value={matTitle}
                    onChange={(e) => setMatTitle(e.target.value)}
                    required
                    maxLength={255}
                    {...i18nTextInputProps}
                  />
                </div>
                <div className="field">
                  <label>
                    Автор материала <span className="label-mark req">обязательно</span>
                  </label>
                  <input
                    value={matContentAuthor}
                    onChange={(e) => setMatContentAuthor(e.target.value)}
                    placeholder="ФИО или псевдоним автора книги, курса и т.д."
                    required
                    maxLength={255}
                    {...i18nTextInputProps}
                  />
                </div>
                <div className="field">
                  <label>
                    Ссылки на соцсети автора <span className="label-mark opt">необязательно</span>
                  </label>
                  {matSocialLinks.map((row, i) => (
                    <div key={i} className="social-row">
                      <input
                        placeholder="Подпись (например, ВК)"
                        value={row.label}
                        onChange={(e) => setSocialRow(i, 'label', e.target.value)}
                        {...i18nTextInputProps}
                      />
                      <input
                        placeholder="https://…"
                        type="url"
                        value={row.url}
                        onChange={(e) => setSocialRow(i, 'url', e.target.value)}
                        {...i18nUrlInputProps}
                      />
                      {matSocialLinks.length > 1 ? (
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() => removeSocialRow(i)}
                          aria-label="Удалить ссылку"
                        >
                          <X size={18} strokeWidth={2} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button type="button" className="btn-text" onClick={addSocialRow}>
                    + Ещё ссылка
                  </button>
                </div>
                <div className="field">
                  <label>
                    Тип <span className="label-mark req">обязательно</span>
                  </label>
                  <select value={matType} onChange={(e) => setMatType(e.target.value)} required>
                    <option value="book">Книга</option>
                    <option value="video">Видео / туториал</option>
                    <option value="article">Статья</option>
                    <option value="course">Курс</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
                <div className="field">
                  <label>
                    Описание <span className="label-mark req">обязательно, не менее 10 символов</span>
                  </label>
                  <textarea
                    value={matDesc}
                    onChange={(e) => setMatDesc(e.target.value)}
                    rows={4}
                    required
                    minLength={10}
                    {...i18nTextAreaProps}
                  />
                </div>
                <div className="field">
                  <label>
                    Ссылка на материал <span className="label-mark req">обязательно</span>
                  </label>
                  <input
                    value={matUrl}
                    onChange={(e) => setMatUrl(e.target.value)}
                    placeholder="https://…"
                    type="url"
                    required
                    {...i18nUrlInputProps}
                  />
                </div>
                <div className="field">
                  <label>
                    Теги <span className="label-mark req">обязательно, минимум один</span>
                  </label>
                  <input
                    value={matTagSearch}
                    onChange={(e) => setMatTagSearch(e.target.value)}
                    placeholder="Поиск тега по названию"
                    maxLength={80}
                    {...i18nSearchInputProps}
                  />
                  <div className="tag-pick">
                    {filteredMaterialTags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`tag-chip${matTagIds.includes(t.id) ? ' on' : ''}`}
                        onClick={() => toggleMatTag(t.id)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                  {filteredMaterialTags.length === 0 ? <p className="muted small">Ничего не найдено.</p> : null}
                </div>
                <button type="submit" className="btn-admin-ok" disabled={matSaving}>
                  {matSaving ? 'Сохранение…' : 'Добавить материал'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="admin-title">Настройки ИИ</h1>
              {aiMessage ? (
                <div className="toast-success" role="status">
                  {aiMessage}
                </div>
              ) : null}
              <form className="admin-form" onSubmit={(e) => void onAiModelSubmit(e)}>
                <div className="field">
                  <label>
                    Модель OpenAI <span className="label-mark req">обязательно</span>
                  </label>
                  <div className="row-btns" style={{ marginBottom: 8 }}>
                    <button
                      type="button"
                      className="btn-admin-preview"
                      disabled={aiModelsLoading}
                      onClick={() => void refreshAiModels()}
                    >
                      {aiModelsLoading ? 'Загрузка…' : 'Обновить список'}
                    </button>
                    {aiModelsMeta ? (
                      <span className="muted small">
                        {aiModelsMeta.cached ? 'из кэша' : 'с OpenAI'}
                        {aiModelsMeta.ageSec != null ? ` · ~${Math.round(aiModelsMeta.ageSec)} с назад` : ''}
                      </span>
                    ) : null}
                  </div>
                  <select
                    value={aiModelIds.includes(aiModelPick) ? aiModelPick : ''}
                    onChange={(e) => setAiModelPick(e.target.value)}
                    disabled={aiModelsLoading || aiModelIds.length === 0}
                    required
                  >
                    <option value="">{aiModelIds.length ? '— выберите модель —' : 'Список недоступен'}</option>
                    {aiModelIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                  {aiModelsError ? <p className="muted small">{aiModelsError}</p> : null}
                  {aiModelSaved && !aiModelIds.includes(aiModelSaved) && aiModelIds.length > 0 ? (
                    <p className="muted small">
                      Сейчас на сервере сохранено: <strong>{aiModelSaved}</strong> — этой строки нет в отфильтрованном
                      списке. Выберите другую модель и сохраните.
                    </p>
                  ) : null}
                </div>
                {aiUpdatedAt ? (
                  <p className="muted small">Последнее обновление: {new Date(aiUpdatedAt).toLocaleString('ru-RU')}</p>
                ) : null}
                <button
                  type="submit"
                  className="btn-admin-ok"
                  disabled={aiSaving || aiModelsLoading || aiModelIds.length === 0 || !aiModelPick}
                >
                  {aiSaving ? 'Сохранение…' : 'Сохранить модель'}
                </button>
              </form>
            </>
          )}
        </main>
      </div>
      <ModerationPostModal
        post={modalPost}
        onClose={() => setModalPost(null)}
        mode="admin"
        theme="admin"
        onApprove={(id) => void handleApprove(id)}
        onReject={(id, reason) => void handleReject(id, reason)}
      />
    </>
  );
}
