import { Link } from 'react-router-dom';
import { BarChart3, BookOpen, SwatchBook, Trophy, Users, Wand2 } from 'lucide-react';
import LandingHeader from '../components/LandingHeader';
import { BRAND_NAME } from '../brand';

export default function HomePage() {
  return (
    <>
      <LandingHeader featuresHref="#features" />

      <section className="hero">
        <div className="container">
          <h1>{BRAND_NAME}</h1>
          <p>Генерация идей, обучение, вдохновение и челленджи — всё в одном месте</p>
          <Link to="/login" className="btn-hero">
            Начать бесплатно
          </Link>
        </div>
      </section>

      <section id="features" className="features">
        <div className="container">
          <h2>Что вы получите</h2>
          <div className="features-grid">
            <div className="feature-card">
              <span className="ui-icon-block" aria-hidden>
                <BookOpen />
              </span>
              <h3>Персонализированные материалы</h3>
              <p>Обучающие видео и статьи под ваш уровень</p>
            </div>
            <div className="feature-card">
              <span className="ui-icon-block" aria-hidden>
                <Wand2 />
              </span>
              <h3>Генерация идей</h3>
              <p>AI-помощник для преодоления арт-блока</p>
            </div>
            <div className="feature-card">
              <span className="ui-icon-block" aria-hidden>
                <SwatchBook />
              </span>
              <h3>Палитры цветов</h3>
              <p>Генерация и каталог готовых палитр</p>
            </div>
            <div className="feature-card">
              <span className="ui-icon-block" aria-hidden>
                <Trophy />
              </span>
              <h3>Челленджи</h3>
              <p>Участвуйте в ивентах и получайте награды</p>
            </div>
            <div className="feature-card">
              <span className="ui-icon-block" aria-hidden>
                <Users />
              </span>
              <h3>Лента работ</h3>
              <p>Делитесь творчеством с сообществом</p>
            </div>
            <div className="feature-card">
              <span className="ui-icon-block" aria-hidden>
                <BarChart3 />
              </span>
              <h3>Трекинг прогресса</h3>
              <p>Следите за своей активностью и достижениями</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <p>
            &copy; 2026 ВКР · {BRAND_NAME} ·{' '}
            <a href="mailto:shallievaflvera02@gmail.com">shallievaflvera02@gmail.com</a>
          </p>
        </div>
      </footer>
    </>
  );
}
