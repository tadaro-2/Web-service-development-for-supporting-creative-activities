import { FormEvent, useState } from 'react';
import defaultAvatar from '../assets/default-avatar.svg';
import type { FeedPost } from '../api';
import PostImageGrid from './PostImageGrid';
import { i18nTextAreaProps } from '../inputA11y';

type Props = {
  post: FeedPost | null;
  onClose: () => void;
  mode: 'admin' | 'viewer';
  /** «admin» — тёмная панель как в админке; «default» — светлая как в профиле */
  theme?: 'default' | 'admin';
  onApprove?: (id: number) => void;
  onReject?: (id: number, reason: string) => void;
};

export default function ModerationPostModal({
  post,
  onClose,
  mode,
  theme = 'default',
  onApprove,
  onReject,
}: Props) {
  const [reason, setReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  if (!post) return null;
  const current = post;

  function submitReject(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim() || !onReject) return;
    onReject(current.id, reason.trim());
    setReason('');
    setShowReject(false);
    onClose();
  }

  const overlayClass = theme === 'admin' ? 'modal-overlay modal-overlay--admin' : 'modal-overlay';
  const sheetClass =
    theme === 'admin' ? 'modal-sheet modal-moderation modal-sheet--admin' : 'modal-sheet modal-moderation';

  return (
    <div className={overlayClass} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={sheetClass} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{current.title}</h2>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal-author">
          <img src={current.author.avatar_url ?? defaultAvatar} alt="" />
          <span>{current.author.display_name}</span>
        </div>
        <p className="modal-meta muted small">
          Подано:{' '}
          {new Date(current.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
          {current.status === 'published' ? (
            <>
              {' '}
              · Опубликовано:{' '}
              {new Date(current.published_at ?? current.created_at).toLocaleString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </>
          ) : null}
        </p>
        <PostImageGrid images={current.images} />
        {current.description ? <p className="modal-desc">{current.description}</p> : null}
        <div className="post-tags" style={{ marginTop: 12 }}>
          {current.tags.map((t) => (
            <span key={t.id} className="tag">
              {t.name}
            </span>
          ))}
        </div>
        {mode === 'admin' ? (
          <div className="modal-actions">
            <button type="button" className="btn-admin-ok" onClick={() => onApprove?.(current.id)}>
              Одобрить
            </button>
            {!showReject ? (
              <button type="button" className="btn-admin-no" onClick={() => setShowReject(true)}>
                Отклонить…
              </button>
            ) : (
              <form className="reject-inline" onSubmit={submitReject}>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Причина отклонения"
                  rows={3}
                  required
                  {...i18nTextAreaProps}
                />
                <div className="row-btns">
                  <button type="submit" className="btn-admin-no">
                    Отклонить
                  </button>
                  <button type="button" className="btn-text" onClick={() => setShowReject(false)}>
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
