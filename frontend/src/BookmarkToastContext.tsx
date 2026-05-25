import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type BookmarkKind = 'post' | 'material' | 'generation' | 'palette';

type ShowFn = (saved: boolean, kind?: BookmarkKind) => void;

const BookmarkToastContext = createContext<ShowFn>(() => {});

export function BookmarkToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(true);
  const [kind, setKind] = useState<BookmarkKind>('post');
  const timerRef = useRef<number>(0);

  const show: ShowFn = useCallback((isSaved, k = 'post') => {
    setSaved(isSaved);
    setKind(k);
    setOpen(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(false), 3200);
  }, []);

  return (
    <BookmarkToastContext.Provider value={show}>
      {children}
      {open ? (
        <div className="bookmark-toast" role="status" aria-live="polite">
          <span className="bookmark-toast-text">
            {saved ? (
              kind === 'material' ? (
                <>Материал добавлен в закладки</>
              ) : kind === 'generation' ? (
                <>Генерация сохранена в закладки</>
              ) : kind === 'palette' ? (
                <>Палитра сохранена в закладки</>
              ) : (
                <>Публикация добавлена в закладки</>
              )
            ) : (
              <>Убрано из закладок</>
            )}
          </span>
          <Link to="/bookmarks" className="bookmark-toast-link" onClick={() => setOpen(false)}>
            Открыть закладки
          </Link>
        </div>
      ) : null}
    </BookmarkToastContext.Provider>
  );
}

export function useBookmarkToast(): ShowFn {
  return useContext(BookmarkToastContext);
}
