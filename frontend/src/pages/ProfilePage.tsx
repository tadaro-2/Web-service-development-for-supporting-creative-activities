import { Award, BarChart3, Pencil, Trophy } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import PostCard from '../components/PostCard';
import ModerationPostModal from '../components/ModerationPostModal';
import ActivityHeatmap from '../components/ActivityHeatmap';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import defaultAvatar from '../assets/default-avatar.svg';
import {
  ApiError,
  checkNickname,
  deletePost,
  getTagsCatalog,
  getMyPosts,
  myProfile,
  myTags,
  submitPost,
  updateMyProfile,
  uploadMyAvatar,
  type FeedPost,
  type TagDto,
} from '../api';
import { i18nSearchInputProps, i18nTextAreaProps, i18nTextInputProps } from '../inputA11y';

export default function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof myProfile>> | null>(null);
  const [tags, setTags] = useState<Array<{ id: number; name: string; category: string }>>([]);
  const [showAllTags, setShowAllTags] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [draftNickname, setDraftNickname] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [nicknameHint, setNicknameHint] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [catalogTags, setCatalogTags] = useState<TagDto[]>([]);
  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [pubTitle, setPubTitle] = useState('');
  const [pubDesc, setPubDesc] = useState('');
  const [pubTagIds, setPubTagIds] = useState<number[]>([]);
  const [pubTagSearch, setPubTagSearch] = useState('');
  const [pubFiles, setPubFiles] = useState<File[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [modalPost, setModalPost] = useState<FeedPost | null>(null);
  const [pendingQueueDeleteId, setPendingQueueDeleteId] = useState<number | null>(null);

  const visibleTags = useMemo(() => (showAllTags ? tags : tags.slice(0, 3)), [showAllTags, tags]);
  const hiddenCount = Math.max(0, tags.length - 3);

  const filteredCatalogTagsForPublish = useMemo(() => {
    const q = pubTagSearch.trim().toLocaleLowerCase('ru-RU');
    if (!q) return catalogTags;
    return catalogTags.filter((t) => t.name.toLocaleLowerCase('ru-RU').includes(q));
  }, [catalogTags, pubTagSearch]);

  const pendingPosts = useMemo(() => myPosts.filter((p) => p.status === 'pending'), [myPosts]);
  const publishedPosts = useMemo(() => myPosts.filter((p) => p.status === 'published'), [myPosts]);
  const rejectedPosts = useMemo(() => myPosts.filter((p) => p.status === 'rejected'), [myPosts]);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const [p, t, catalog, posts] = await Promise.all([myProfile(), myTags(), getTagsCatalog(), getMyPosts()]);
      setProfile(p);
      setTags(t);
      setCatalogTags(catalog);
      setMyPosts(posts);
      setDraftNickname(p.nickname ?? '');
      setDraftBio(p.bio ?? '');
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Ошибка загрузки профиля');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const st = location.state as { openPublish?: boolean } | undefined;
    if (st?.openPublish) {
      setPublishOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  async function onCheckNickname(value: string) {
    const nick = value.trim();
    if (nick.length < 3) {
      setNicknameHint('Минимум 3 символа');
      return;
    }
    try {
      const res = await checkNickname(nick);
      setNicknameHint(res.available ? 'Ник свободен' : 'Ник занят');
    } catch {
      setNicknameHint(null);
    }
  }

  async function onSave() {
    if (!profile) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateMyProfile({ nickname: draftNickname, bio: draftBio });
      setProfile(updated);
      setIsEditing(false);
      setNicknameHint(null);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Не удалось сохранить');
    } finally {
      setIsSaving(false);
    }
  }

  async function onAvatarChange(file: File | null) {
    if (!file) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await uploadMyAvatar(file);
      setProfile(updated);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message || 'Не удалось загрузить аватар');
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDeletePendingPost() {
    if (pendingQueueDeleteId == null) return;
    const postId = pendingQueueDeleteId;
    setPendingQueueDeleteId(null);
    setError(null);
    try {
      await deletePost(postId);
      setMyPosts((list) => list.filter((x) => x.id !== postId));
      setModalPost((cur) => (cur?.id === postId ? null : cur));
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  function togglePubTag(id: number) {
    setPubTagIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  function onFilesChange(files: FileList | null) {
    if (!files?.length) {
      setPubFiles([]);
      return;
    }
    const next = Array.from(files).slice(0, 3);
    setPubFiles(next);
  }

  async function onSubmitPublication(e: React.FormEvent) {
    e.preventDefault();
    if (!pubTitle.trim()) {
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
    setIsSaving(true);
    setError(null);
    try {
      await submitPost({
        title: pubTitle.trim(),
        description: pubDesc.trim(),
        tagIds: pubTagIds,
        images: pubFiles,
      });
      setPubTitle('');
      setPubDesc('');
      setPubTagIds([]);
      setPubTagSearch('');
      setPubFiles([]);
      setPublishOpen(false);
      await load();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Sidebar />
      <main className="main-content">
        {error ? <div className="alert-error">{error}</div> : null}

        <div className="profile-header">
          <div className="profile-avatar-wrap">
            <img
              src={profile?.avatar_url ?? defaultAvatar}
              alt="avatar"
              className="profile-avatar"
            />
            <label className="btn-avatar">
              Сменить
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onAvatarChange(e.target.files?.[0] ?? null)}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <div className="profile-info">
            <h1>
              {profile?.display_name ?? (isLoading ? 'Загрузка…' : '—')}{' '}
              <button type="button" className="btn-edit" onClick={() => setIsEditing((v) => !v)} disabled={!profile}>
                <Pencil strokeWidth={2} size={16} aria-hidden />
                Изменить
              </button>
            </h1>
            <p className="profile-bio">{profile?.bio ? profile.bio : 'Описание профиля можно добавить здесь…'}</p>
            <div className="profile-tags">
              {visibleTags.map((t) => (
                <span key={t.id} className="tag">
                  {t.name}
                </span>
              ))}
              {hiddenCount > 0 ? (
                <button type="button" className="tag tag-more" onClick={() => setShowAllTags((v) => !v)}>
                  {showAllTags ? 'Скрыть' : `Ещё ${hiddenCount}`}
                </button>
              ) : null}
            </div>
            <div className="profile-meta">
              <span className="profile-email">{profile?.email ?? '—'}</span>
            </div>

            {isEditing ? (
              <div className="profile-edit">
                <div className="field">
                  <label>Ник</label>
                  <input
                    value={draftNickname}
                    onChange={(e) => setDraftNickname(e.target.value)}
                    onBlur={(e) => void onCheckNickname(e.target.value)}
                    placeholder="Например: my_art_name"
                    {...i18nTextInputProps}
                  />
                  {nicknameHint ? <div className="field-hint">{nicknameHint}</div> : null}
                </div>
                <div className="field">
                  <label>Описание</label>
                  <textarea
                    value={draftBio}
                    onChange={(e) => setDraftBio(e.target.value)}
                    placeholder="Расскажите о себе…"
                    rows={3}
                    {...i18nTextAreaProps}
                  />
                </div>
                <div className="profile-edit-actions">
                  <button type="button" className="btn-primary" onClick={() => void onSave()} disabled={isSaving}>
                    {isSaving ? 'Сохранение…' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setIsEditing(false);
                      setDraftNickname(profile?.nickname ?? '');
                      setDraftBio(profile?.bio ?? '');
                      setNicknameHint(null);
                    }}
                    disabled={isSaving}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <section className="achievements card-section">
          <h2 className="section-heading-with-icon">
            <Trophy strokeWidth={1.75} aria-hidden />
            Достижения
          </h2>
          {!profile?.achievements?.length ? (
            <p className="muted">Пока нет полученных достижений (в том числе за челленджи).</p>
          ) : (
            <div className="badges">
              {profile.achievements.map((a) => (
                <div key={a.id} className="badge">
                  <Award strokeWidth={2} aria-hidden />
                  {a.title}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="activity-tracker card-section">
          <h2 className="section-heading-with-icon">
            <BarChart3 strokeWidth={1.75} aria-hidden />
            Активность
          </h2>
          <ActivityHeatmap />
        </section>

        <section className="card-section profile-action-section">
          <h2>Опубликовать работу</h2>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setPubTagSearch('');
              setPublishOpen(true);
            }}
          >
            Открыть форму публикации
          </button>
        </section>

        <section className="card-section">
          <h2>На модерации</h2>
          {pendingPosts.length === 0 ? (
            <p className="muted">Нет заявок в ожидании.</p>
          ) : (
            <ul className="profile-queue-list">
              {pendingPosts.map((p) => (
                <li key={p.id} className="profile-queue-row">
                  <span className="profile-queue-title">{p.title}</span>
                  <div className="profile-queue-actions">
                    <button type="button" className="btn-secondary small" onClick={() => setModalPost(p)}>
                      Просмотр
                    </button>
                    <button
                      type="button"
                      className="btn-text post-delete-btn small"
                      onClick={() => setPendingQueueDeleteId(p.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-section">
          <h2>Опубликованные работы</h2>
          {publishedPosts.length === 0 ? (
            <p className="muted">Пока нет опубликованных работ.</p>
          ) : (
            <div className="feed">
              {publishedPosts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  onPostRemoved={(id) => setMyPosts((list) => list.filter((x) => x.id !== id))}
                />
              ))}
            </div>
          )}
        </section>

        {rejectedPosts.length > 0 ? (
          <section className="card-section">
            <h2>Отклонённые</h2>
            <div className="feed">
              {rejectedPosts.map((p) => (
                <article key={p.id} className="post-card rejected-card">
                  <h3>{p.title}</h3>
                  <p className="alert-error compact">{p.rejection_reason || 'Без причины'}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {publishOpen ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setPublishOpen(false)}>
            <div className="modal-sheet modal-publish" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h2>Новая публикация</h2>
                <button type="button" className="modal-x" onClick={() => setPublishOpen(false)} aria-label="Закрыть">
                  ×
                </button>
              </div>
              <form className="publish-form" onSubmit={(e) => void onSubmitPublication(e)}>
                <div className="field">
                  <label>Название</label>
                  <input
                    value={pubTitle}
                    onChange={(e) => setPubTitle(e.target.value)}
                    required
                    {...i18nTextInputProps}
                  />
                </div>
                <div className="field">
                  <label>Описание</label>
                  <textarea
                    value={pubDesc}
                    onChange={(e) => setPubDesc(e.target.value)}
                    rows={3}
                    {...i18nTextAreaProps}
                  />
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
                    {filteredCatalogTagsForPublish.map((t) => (
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
                  {filteredCatalogTagsForPublish.length === 0 ? (
                    <p className="muted small">Ничего не найдено.</p>
                  ) : null}
                </div>
                <div className="field">
                  <label>Изображения (1–3 файла)</label>
                  <input type="file" accept="image/*" multiple onChange={(e) => onFilesChange(e.target.files)} />
                  {pubFiles.length ? (
                    <div className="muted small">Выбрано файлов: {pubFiles.length}</div>
                  ) : null}
                </div>
                <div className="modal-actions-inline">
                  <button type="submit" className="btn-primary" disabled={isSaving}>
                    {isSaving ? 'Отправка…' : 'Отправить на модерацию'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setPublishOpen(false)} disabled={isSaving}>
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <ConfirmDialog
          open={pendingQueueDeleteId !== null}
          message="Удалить эту заявку безвозвратно? Запись и файлы будут удалены."
          onConfirm={() => void confirmDeletePendingPost()}
          onCancel={() => setPendingQueueDeleteId(null)}
        />

        <ModerationPostModal
          post={modalPost}
          onClose={() => setModalPost(null)}
          mode="viewer"
        />
      </main>
    </>
  );
}
