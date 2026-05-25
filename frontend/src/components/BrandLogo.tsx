import { Sparkles } from 'lucide-react';
import { BRAND_NAME } from '../brand';

type Props = {
  /** Панель администратора — другой подзаголовок */
  admin?: boolean;
  className?: string;
};

/** Логотип: тонкая линейная метка + название (без эмодзи) */
export default function BrandLogo({ admin, className }: Props) {
  return (
    <span className={`brand-logo ${className ?? ''}`.trim()}>
      <Sparkles className="brand-logo__mark" strokeWidth={1.75} aria-hidden />
      <span className="brand-logo__text">{admin ? `${BRAND_NAME} · админ` : BRAND_NAME}</span>
    </span>
  );
}
