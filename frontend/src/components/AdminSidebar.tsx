import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../auth';
import defaultAvatar from '../assets/default-avatar.svg';
import { myProfile } from '../api';
import { useMobileNav } from '../MobileNavContext';
import BrandLogo from './BrandLogo';

const feedClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined);

const MOBILE_NAV_MQ = '(max-width: 900px)';

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { open, openNav, closeNav } = useMobileNav();
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof myProfile>> | null>(null);

  const tab = new URLSearchParams(location.search).get('tab');
  const onAdminQueue = location.pathname === '/admin' && tab !== 'materials' && tab !== 'ai' && tab !== 'challenges';
  const onAdminMaterials = location.pathname === '/admin' && tab === 'materials';
  const onAdminChallenges = location.pathname === '/admin' && tab === 'challenges';
  const onAdminAi = location.pathname === '/admin' && tab === 'ai';

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

  return (
    <>
      <button type="button" className="sidebar-open-fab sidebar-open-fab--admin" onClick={openNav} aria-label="Открыть меню">
        <Menu size={22} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <button type="button" className="sidebar-backdrop" aria-label="Закрыть меню" onClick={closeNav} />
      ) : null}
      <nav className={`sidebar admin-sidebar${open ? ' sidebar--open' : ''}`}>
        <div className="sidebar-top">
          <div className="logo">
            <BrandLogo admin />
          </div>
          <button type="button" className="sidebar-close-fab" onClick={closeNav} aria-label="Закрыть меню">
            <X size={22} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <ul className="menu">
          <li>
            <Link to="/admin" className={onAdminQueue ? 'active' : undefined} onClick={() => closeNav()}>
              Заявки на публикацию
            </Link>
          </li>
          <li>
            <Link to="/admin?tab=materials" className={onAdminMaterials ? 'active' : undefined} onClick={() => closeNav()}>
              Материалы
            </Link>
          </li>
          <li>
            <Link to="/admin?tab=challenges" className={onAdminChallenges ? 'active' : undefined} onClick={() => closeNav()}>
              Челленджи
            </Link>
          </li>
          <li>
            <Link to="/admin?tab=ai" className={onAdminAi ? 'active' : undefined} onClick={() => closeNav()}>
              Настройки ИИ
            </Link>
          </li>
          <li>
            <NavLink to="/feed" className={feedClass} onClick={() => closeNav()}>
              Лента
            </NavLink>
          </li>
          <li>
            <NavLink to="/materials" className={feedClass} onClick={() => closeNav()}>
              Каталог материалов
            </NavLink>
          </li>
        </ul>
        <div className="user-info">
          <img src={profile?.avatar_url ?? defaultAvatar} alt="" />
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
