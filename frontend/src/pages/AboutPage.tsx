import { Link } from 'react-router-dom';
import LandingHeader from '../components/LandingHeader';
import { BRAND_NAME } from '../brand';

export default function AboutPage() {
  return (
    <>
      <LandingHeader featuresHref="/#features" />

      <main className="about-page-main">
        <div className="container">
          <h1 className="about-page-title">О проекте и авторе</h1>
          <div className="about-card">
            <p>
              Этот веб-сервис создан как платформа для поддержки творческой активности: здесь можно находить материалы по
              интересам, генерировать идеи с помощью ИИ, собирать палитры, делиться работами и следить за своей
              активностью.
            </p>
            <p>
              Разработкой и содержанием проекта занимается <strong>Шаллиева Вера Владимировна</strong>, выпускница
              Университета ИТМО по направлению подготовки{' '}
              <strong>11.03.02 «Програмирование в инфокоммуникационных технологиях»</strong>.
            </p>
            <p className="about-contact">
              По вопросам <strong>сотрудничества</strong>, размещения информации или{' '}
              <strong>рекламного размещения</strong> можно написать на почту:{' '}
              <a href="mailto:shallievaflvera02@gmail.com">shallievaflvera02@gmail.com</a>
              <br />
              <span className="muted small">
                В теме письма укажите «{BRAND_NAME}», чтобы письмо было заметнее среди входящих.
              </span>
            </p>
            <p style={{ marginTop: '1.25rem' }}>
              <Link to="/" className="btn-secondary">
                На главную
              </Link>
            </p>
          </div>
        </div>
      </main>

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
