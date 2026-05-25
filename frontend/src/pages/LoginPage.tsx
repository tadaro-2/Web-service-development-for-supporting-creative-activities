import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, login, me, register, resendCode, verifyEmail } from '../api';
import { useAuth } from '../auth';
import {
  i18nEmailInputProps,
  i18nLoginPasswordInputProps,
  i18nNewPasswordInputProps,
  i18nOtpInputProps,
} from '../inputA11y';
import BrandLogo from '../components/BrandLogo';

type Tab = 'login' | 'register';
type RegisterStep = 'form' | 'verify';

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('login');
  const navigate = useNavigate();
  const { setAuthFromTokens } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [regStep, setRegStep] = useState<RegisterStep>('form');
  const [verifyCode, setVerifyCode] = useState('');

  const canRegister = useMemo(() => {
    if (!regEmail.trim()) return false;
    if (regPassword.length < 8) return false;
    if (regPassword !== regPassword2) return false;
    return true;
  }, [regEmail, regPassword, regPassword2]);

  async function onLoginSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const tokens = await login({ email: loginEmail.trim(), password: loginPassword });
      await setAuthFromTokens(tokens);
      const u = await me();
      await navigate(u.is_admin ? '/admin' : '/dashboard');
    } catch (err) {
      const e = err as ApiError;
      setError(e?.message ?? 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  }

  async function onRegisterSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canRegister) {
      if (!regEmail.trim()) setError('Введите email');
      else if (regPassword.length < 8) setError('Пароль должен быть не короче 8 символов');
      else if (regPassword !== regPassword2) setError('Пароли не совпадают');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await register({ email: regEmail.trim(), password: regPassword, role: 'user' });
      setRegStep('verify');
    } catch (err) {
      const e = err as ApiError;
      setError(e?.message ?? 'Ошибка регистрации');
    } finally {
      setBusy(false);
    }
  }

  async function onVerifySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await verifyEmail({ email: regEmail.trim(), code: verifyCode.trim() });
      await setAuthFromTokens({ access: res.access, refresh: res.refresh });
      const u = await me();
      await navigate(u.is_admin ? '/admin' : '/dashboard');
    } catch (err) {
      const e = err as ApiError;
      setError(e?.message ?? 'Ошибка подтверждения');
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setError(null);
    setBusy(true);
    try {
      await resendCode({ email: regEmail.trim() });
      alert('Код отправлен повторно. Проверьте почту.');
    } catch (err) {
      const e = err as ApiError;
      setError(e?.message ?? 'Ошибка отправки кода');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1 className="auth-title">
          <BrandLogo />
        </h1>
        <div className="tabs">
          <button
            type="button"
            className={`tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => {
              setTab('login');
              setError(null);
            }}
          >
            Вход
          </button>
          <button
            type="button"
            className={`tab${tab === 'register' ? ' active' : ''}`}
            onClick={() => {
              setTab('register');
              setError(null);
            }}
          >
            Регистрация
          </button>
        </div>

        {error ? (
          <p className="hint" style={{ color: 'crimson' }}>
            {error}
          </p>
        ) : null}

        <form
          className={`auth-form${tab === 'login' ? ' active' : ''}`}
          onSubmit={onLoginSubmit}
        >
          <input
            type="email"
            placeholder="Email"
            required
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            disabled={busy}
            {...i18nEmailInputProps}
          />
          <input
            type="password"
            placeholder="Пароль"
            required
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            disabled={busy}
            {...i18nLoginPasswordInputProps}
          />
          <button type="submit" className="btn-primary">
            {busy ? '...' : 'Войти'}
          </button>
        </form>

        <form
          className={`auth-form${tab === 'register' ? ' active' : ''}`}
          onSubmit={onRegisterSubmit}
        >
          <input
            type="email"
            placeholder="Email"
            required
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            disabled={busy || regStep === 'verify'}
            {...i18nEmailInputProps}
          />

          {regStep === 'form' ? (
            <>
              <input
                type="password"
                placeholder="Пароль (мин. 8 символов)"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                disabled={busy}
                {...i18nNewPasswordInputProps}
              />
              {regPassword.length > 0 && regPassword.length < 8 ? (
                <p className="hint" style={{ color: 'crimson' }}>
                  Пароль должен быть не короче 8 символов
                </p>
              ) : null}
              <input
                type="password"
                placeholder="Повторите пароль"
                required
                value={regPassword2}
                onChange={(e) => setRegPassword2(e.target.value)}
                disabled={busy}
                {...i18nNewPasswordInputProps}
              />
              {regPassword2.length > 0 && regPassword !== regPassword2 ? (
                <p className="hint" style={{ color: 'crimson' }}>
                  Пароли не совпадают
                </p>
              ) : null}
              <button type="submit" className="btn-primary" disabled={busy || !canRegister}>
                {busy ? '...' : 'Зарегистрироваться'}
              </button>
              <p className="hint">Мы отправим код подтверждения на вашу почту</p>
            </>
          ) : null}
        </form>

        <form
          className={`auth-form${tab === 'register' && regStep === 'verify' ? ' active' : ''}`}
          onSubmit={onVerifySubmit}
        >
          <input
            type="text"
            placeholder="Код из письма (6 цифр)"
            required
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            disabled={busy}
            {...i18nOtpInputProps}
          />
          <button type="submit" className="btn-primary" disabled={busy || !verifyCode.trim()}>
            {busy ? '...' : 'Подтвердить email'}
          </button>
          <button type="button" className="btn-secondary" onClick={onResend} disabled={busy}>
            Отправить код ещё раз
          </button>
          <p className="hint">Код приходит на указанный email.</p>
        </form>
      </div>
    </div>
  );
}
