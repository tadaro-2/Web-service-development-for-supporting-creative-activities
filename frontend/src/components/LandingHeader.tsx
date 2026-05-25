import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';

type Props = {
  /** Ссылка «Возможности»: на главной — якорь, на других — на главную с якорем */
  featuresHref: string;
};

export default function LandingHeader({ featuresHref }: Props) {
  return (
    <header className="header">
      <div className="container header-landing-inner">
        <Link to="/" className="logo header-landing-logo">
          <BrandLogo />
        </Link>
        <nav className="header-landing-nav" aria-label="Разделы сайта">
          <a href={featuresHref}>Возможности</a>
          <Link to="/about">О проекте</Link>
        </nav>
        <Link to="/login" className="btn-primary header-landing-cta">
          Войти
        </Link>
      </div>
    </header>
  );
}
