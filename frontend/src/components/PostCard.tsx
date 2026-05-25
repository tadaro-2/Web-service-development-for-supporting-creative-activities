import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import defaultAvatar from '../assets/default-avatar.svg';
import type { CommentDto, FeedPost } from '../api';
import {
  addPostComment,
  deletePost,
  getPostComments,
  togglePostBookmark,
  togglePostLike,
} from '../api';
import type { ApiError } from '../api';
import ConfirmDialog from './ConfirmDialog';
import PostImageGrid from './PostImageGrid';
import { useBookmarkToast } from '../BookmarkToastContext';
import { useAuth } from '../auth';
import { i18nMessageInputProps } from '../inputA11y';
import { Bookmark, Heart, MessageCircle } from 'lucide-react';

type Props = {
  post: FeedPost;
  onFeedChange?: (next: FeedPost) => void;
  /** После успешного удаления с сервера — убрать карточку из списка родителя */
  onPostRemoved?: (postId: number) => void;
  /** Скрыть кнопку «В закладки» (например, в ленте — закладки только в разделе «Закладки») */
  hideBookmark?: boolean;
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/** Например: 14 марта 2026 г., 15:30 */
function formatPublishedLong(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function PostCard({ post, onFeedChange, onPostRemoved, hideBookmark }: Props) {
  const { user } = useAuth();
  const showBookmarkToast = useBookmarkToast();
  const [p, setP] = useState(post);

  useEffect(() => {
    setP(post);
  }, [post]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentDto[] | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const canDelete = Boolean(user && (user.id === p.author.user_id || user.is_admin));

  async function loadComments() {
    setLoadingComments(true);
    setCommentError(null);
    try {
      const list = await getPostComments(p.id);
      setComments(list);
    } catch (e) {
      setCommentError((e as ApiError).message);
    } finally {
      setLoadingComments(false);
    }
  }

  async function onToggleComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && comments === null) {
      await loadComments();
    }
  }

  async function onLike() {
    try {
      const r = await togglePostLike(p.id);
      const next = { ...p, liked_by_me: r.liked, likes_count: r.likes_count };
      setP(next);
      onFeedChange?.(next);
    } catch {
      // ignore
    }
  }

  async function onBookmark() {
    try {
      const r = await togglePostBookmark(p.id);
      const next = { ...p, bookmarked_by_me: r.saved };
      setP(next);
      onFeedChange?.(next);
      if (!r.saved) {
        onPostRemoved?.(p.id);
      }
      showBookmarkToast(r.saved, 'post');
    } catch {
      // ignore
    }
  }

  async function confirmDeletePost() {
    setDeleteConfirmOpen(false);
    setDeleteError(null);
    try {
      await deletePost(p.id);
      onPostRemoved?.(p.id);
    } catch (e) {
      setDeleteError((e as ApiError).message);
    }
  }

  async function onSendComment() {
    const t = commentText.trim();
    if (!t) return;
    setCommentError(null);
    try {
      const c = await addPostComment(p.id, t);
      setComments((prev) => [...(prev ?? []), c]);
      setCommentText('');
      const next = { ...p, comments_count: p.comments_count + 1 };
      setP(next);
      onFeedChange?.(next);
    } catch (e) {
      setCommentError((e as ApiError).message);
    }
  }

  const interactive = p.status === 'published';

  return (
    <>
    <article className="post-card">
      <div className="post-header">
        <Link to={`/u/${p.author.user_id}`} className="post-author-link">
          <img src={p.author.avatar_url ?? defaultAvatar} alt="" />
        </Link>
        <div>
          <Link to={`/u/${p.author.user_id}`} className="post-author-link">
            <strong>{p.author.display_name}</strong>
          </Link>
          <br />
          <span className="post-date">
            {p.status === 'published' ? (
              <>
                Опубликовано: {formatPublishedLong(p.published_at ?? p.created_at)}
              </>
            ) : (
              <>Подано: {formatDate(p.created_at)}</>
            )}
          </span>
        </div>
      </div>
      <PostImageGrid images={p.images} />
      <div className="post-tags">
        {p.tags.map((t) => (
          <span key={t.id} className="tag">
            {t.name}
          </span>
        ))}
      </div>
      <div className="post-content">
        <h3>{p.title}</h3>
        {p.description ? <p>{p.description}</p> : null}
      </div>
      {deleteError ? <div className="alert-error compact">{deleteError}</div> : null}
      {interactive ? (
        <div className="post-actions">
          <button type="button" className={`btn-icon${p.liked_by_me ? ' active' : ''}`} onClick={() => void onLike()}>
            <Heart strokeWidth={2} aria-hidden />
            <span>{p.likes_count}</span>
          </button>
          <button type="button" className="btn-icon" onClick={() => void onToggleComments()}>
            <MessageCircle strokeWidth={2} aria-hidden />
            <span>{p.comments_count}</span>
          </button>
          {!hideBookmark ? (
            <button
              type="button"
              className={`btn-icon btn-bookmark${p.bookmarked_by_me ? ' is-saved active' : ''}`}
              onClick={() => void onBookmark()}
              aria-pressed={p.bookmarked_by_me}
              title={
                p.bookmarked_by_me
                  ? 'В закладках — нажмите, чтобы убрать'
                  : 'Сохранить публикацию в закладки'
              }
            >
              <Bookmark strokeWidth={2} aria-hidden />
              <span>{p.bookmarked_by_me ? 'В закладках' : 'Сохранить'}</span>
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" className="btn-text post-delete-btn" onClick={() => setDeleteConfirmOpen(true)}>
              Удалить
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <p className="muted small post-pending-hint">
            {p.status === 'pending'
              ? 'Заявка на модерации: лайки и комментарии будут доступны после публикации.'
              : 'Эта работа не в общей ленте.'}
          </p>
          {canDelete ? (
            <div className="post-actions post-actions--owner">
              <button type="button" className="btn-text post-delete-btn" onClick={() => setDeleteConfirmOpen(true)}>
                Удалить публикацию
              </button>
            </div>
          ) : null}
        </>
      )}
      {interactive && commentsOpen ? (
        <div className="post-comments-block">
          {loadingComments ? <div className="muted">Загрузка…</div> : null}
          {commentError ? <div className="alert-error compact">{commentError}</div> : null}
          <ul className="comment-list">
            {(comments ?? []).map((c) => (
              <li key={c.id}>
                <span className="comment-author">{c.author.display_name}</span>
                <span className="comment-text">{c.text}</span>
              </li>
            ))}
          </ul>
          <div className="comment-compose">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Комментарий…"
              maxLength={2000}
              {...i18nMessageInputProps}
            />
            <button type="button" className="btn-secondary small" onClick={() => void onSendComment()}>
              Отправить
            </button>
          </div>
        </div>
      ) : null}
    </article>
    <ConfirmDialog
      open={deleteConfirmOpen}
      message="Удалить эту публикацию безвозвратно? Запись и файлы будут удалены, восстановление невозможно."
      onConfirm={() => void confirmDeletePost()}
      onCancel={() => setDeleteConfirmOpen(false)}
    />
    </>
  );
}
