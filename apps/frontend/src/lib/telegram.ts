export function initTelegram() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  tg.ready();
  tg.expand();
  applyThemeFromTelegram();
}

export function applyThemeFromTelegram() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  const params = tg.themeParams ?? {};
  const root = document.documentElement;
  for (const [k, v] of Object.entries(params)) {
    root.style.setProperty(`--tg-theme-${k.replace(/_/g, '-')}`, v);
  }
  document.documentElement.classList.toggle('dark', tg.colorScheme === 'dark');
}

export function tgHapticSuccess() {
  window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
}
export function tgHapticError() {
  window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('error');
}
export function tgHapticImpact() {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
}
