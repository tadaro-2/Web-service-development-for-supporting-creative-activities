import { useEffect, useId } from 'react';

type Props = {
  open: boolean;
  /** Заголовок окна (по умолчанию — с именем хоста текущего сайта) */
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  /** Тёмная подложка как в админке */
  variant?: 'default' | 'admin';
  /** Блокировка кнопок (например, во время запроса) */
  pending?: boolean;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Да',
  cancelText = 'Нет',
  onConfirm,
  onCancel,
  variant = 'default',
  pending = false,
}: Props) {
  const idBase = useId();
  const titleId = `${idBase}-title`;
  const descId = `${idBase}-desc`;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const resolvedTitle = title ?? `Подтвердите действие на сайте ${host}`;

  useEffect(() => {
    if (!open || pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;

  const overlayClass =
    variant === 'admin' ? 'modal-overlay modal-overlay--admin confirm-dialog-overlay' : 'modal-overlay confirm-dialog-overlay';

  function handleOverlayClick() {
    if (!pending) onCancel();
  }

  return (
    <div className={overlayClass} role="presentation" onClick={handleOverlayClick}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="confirm-dialog__title">
          {resolvedTitle}
        </h2>
        <p id={descId} className="confirm-dialog__message">
          {message}
        </p>
        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--yes"
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {pending ? '…' : confirmText}
          </button>
          <button type="button" className="confirm-dialog__btn confirm-dialog__btn--no" disabled={pending} onClick={onCancel}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
