import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useAuthStore } from '@/store/auth';
import { Icon, IconName } from '@/components/ui/Icon';

type Item = { to: string; label: string; icon: IconName };

const resellerItems: Item[] = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/clients', label: 'Клиенты', icon: 'users' },
  { to: '/clients/new', label: 'Создать', icon: 'plus' },
  { to: '/history', label: 'История', icon: 'clock' },
];

const adminItems: Item[] = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/admin/resellers', label: 'Реселлеры', icon: 'store' },
  { to: '/clients', label: 'Клиенты', icon: 'users' },
  { to: '/clients/new', label: 'Создать', icon: 'plus' },
];

export function BottomNav() {
  const role = useAuthStore((s) => s.me?.role);
  const list = role === 'ADMIN' ? adminItems : resellerItems;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-tg-bg/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {list.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              end={it.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition',
                  isActive ? 'text-tg-button' : 'text-tg-hint hover:text-tg-text',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-xl transition',
                      isActive ? 'bg-tg-button/10' : 'bg-transparent',
                    )}
                  >
                    <Icon name={it.icon} size={20} />
                  </span>
                  <span>{it.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
