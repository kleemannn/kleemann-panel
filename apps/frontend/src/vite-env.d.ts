/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  Telegram?: {
    WebApp: {
      initData: string;
      initDataUnsafe: {
        user?: { id: number; first_name?: string; last_name?: string; username?: string };
      };
      ready: () => void;
      expand: () => void;
      close: () => void;
      themeParams: Record<string, string>;
      colorScheme: 'light' | 'dark';
      MainButton: {
        setText: (t: string) => void;
        show: () => void;
        hide: () => void;
        enable: () => void;
        disable: () => void;
        onClick: (cb: () => void) => void;
        offClick: (cb: () => void) => void;
      };
      BackButton: {
        show: () => void;
        hide: () => void;
        onClick: (cb: () => void) => void;
        offClick: (cb: () => void) => void;
      };
      HapticFeedback: {
        impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
        notificationOccurred: (type: 'success' | 'warning' | 'error') => void;
      };
      openLink: (url: string, opts?: { try_instant_view?: boolean }) => void;
      showAlert: (message: string, cb?: () => void) => void;
      showConfirm: (message: string, cb: (ok: boolean) => void) => void;
    };
  };
}
