import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../auth';
import defaultAvatar from '../assets/default-avatar.svg';
import { myProfile } from '../api';
import { useMobileNav } from '../MobileNavContext';
import AdminSidebar from './AdminSidebar';
import BrandLogo from './BrandLogo';

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined);

const MOBILE_NAV_MQ = '(max-width: 900px)';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { open, openNav, closeNav } = useMobileNav();
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof myProfile>> | null>(null);

  function onLogout() {
    closeNav();
    logout();
    void navigate('/login');
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const p = await myProfile();
        if (alive) setProfile(p);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNav();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeNav]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia(MOBILE_NAV_MQ);
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_NAV_MQ);
    const onChange = () => {
      if (mq.matches === false) closeNav();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [closeNav]);

  if (user?.is_admin) {
    return <AdminSidebar />;
  }

  return (
    <>
      <button type="button" className="sidebar-open-fab" onClick={openNav} aria-label="Открыть меню">
        <Menu size={22} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <button type="button" className="sidebar-backdrop" aria-label="Закрыть меню" onClick={closeNav} />
      ) : null}
      <nav className={`sidebar${open ? ' sidebar--open' : ''}`}>
        <div className="sidebar-top">
          <div className="logo">
            <BrandLogo />
          </div>
          <button type="button" className="sidebar-close-fab" onClick={closeNav} aria-label="Закрыть меню">
            <X size={22} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <ul className="menu">
          <li>
            <NavLink to="/dashboard" className={linkClass} end onClick={() => closeNav()}>
              Главная
            </NavLink>
          </li>
          <li>
            <NavLink to="/materials" className={linkClass} onClick={() => closeNav()}>
              Материалы
            </NavLink>
          </li>
          <li>
            <NavLink to="/generation" className={linkClass} onClick={() => closeNav()}>
              Генерация
            </NavLink>
          </li>
          <li>
            <NavLink to="/palettes" className={linkClass} onClick={() => closeNav()}>
              Палитры
            </NavLink>
          </li>
          <li>
            <NavLink to="/feed" className={linkClass} onClick={() => closeNav()}>
              Лента работ
            </NavLink>
          </li>
          <li>
            <NavLink to="/bookmarks" className={linkClass} onClick={() => closeNav()}>
              Закладки
            </NavLink>
          </li>
          <li>
            <NavLink to="/challenges" className={linkClass} onClick={() => closeNav()}>
              Челленджи
            </NavLink>
          </li>
          <li>
            <NavLink to="/profile" className={linkClass} onClick={() => closeNav()}>
              Профиль
            </NavLink>
          </li>
        </ul>
        <div className="user-info">
          <img src={profile?.avatar_url ?? defaultAvatar} alt="avatar" />
          <div className="user-info-text">
            <span className="user-info-name">{profile?.display_name ?? '—'}</span>
            <span className="user-info-email">{user?.email ?? profile?.email ?? '—'}</span>
            <button type="button" className="btn-icon" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
