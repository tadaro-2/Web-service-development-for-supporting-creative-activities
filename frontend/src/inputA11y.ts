/**
 * Унифицированные атрибуты для полей ввода с текстом на русском и английском.
 * Не ограничивают Unicode; на телефонах помогают ОС выбрать клавиатуру и IME.
 * См. HTML: inputmode, autocomplete, enterkeyhint, autocorrect/autocapitalize (iOS WebKit).
 */

export const i18nTextInputProps = {
  inputMode: 'text' as const,
  autoCapitalize: 'sentences' as const,
  autoCorrect: 'on' as const,
  spellCheck: true as const,
  dir: 'auto' as const,
};

export const i18nTextAreaProps = {
  ...i18nTextInputProps,
};

export const i18nSearchInputProps = {
  inputMode: 'search' as const,
  autoCapitalize: 'off' as const,
  autoCorrect: 'off' as const,
  spellCheck: false as const,
  dir: 'auto' as const,
  enterKeyHint: 'search' as const,
};

export const i18nEmailInputProps = {
  inputMode: 'email' as const,
  autoComplete: 'email' as const,
  autoCapitalize: 'none' as const,
  autoCorrect: 'off' as const,
  spellCheck: false as const,
  enterKeyHint: 'done' as const,
};

export const i18nLoginPasswordInputProps = {
  autoCapitalize: 'none' as const,
  autoCorrect: 'off' as const,
  spellCheck: false as const,
  autoComplete: 'current-password' as const,
};

export const i18nNewPasswordInputProps = {
  autoCapitalize: 'none' as const,
  autoCorrect: 'off' as const,
  spellCheck: false as const,
  autoComplete: 'new-password' as const,
};

/** Код подтверждения из письма — цифры; клавиатура «цифры», автоподстановка OTP на мобильных */
export const i18nOtpInputProps = {
  inputMode: 'numeric' as const,
  autoComplete: 'one-time-code' as const,
  enterKeyHint: 'done' as const,
};

export const i18nUrlInputProps = {
  inputMode: 'url' as const,
  autoCapitalize: 'none' as const,
  autoCorrect: 'off' as const,
  spellCheck: false as const,
  enterKeyHint: 'go' as const,
};

/** Однострочный ввод для комментариев и коротких сообщений */
export const i18nMessageInputProps = {
  ...i18nTextInputProps,
  enterKeyHint: 'send' as const,
};
