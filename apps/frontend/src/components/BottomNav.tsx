import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import clsx from 'clsx';

const items = [
  { to: '/', label: 'Главная', emoji: '🏠' },
  { to: '/clients', label: 'Клиенты', emoji: '👥' },
  { to: '/clients/new', label: 'Создать', emoji: '➕' },
  { to: '/history', label: 'История', emoji: '🕒' },
];

const adminItems = [
  { to: '/', label: 'Главная', emoji: '🏠' },
  { to: '/admin/resellers', label: 'Реселлеры', emoji: '🛒' },
  { to: '/clients', label: 'Клиенты', emoji: '👥' },
  { to: '/clients/new', label: 'Создать', emoji: '➕' },
];

export function BottomNav() {
  const role = useAuthStore((s) => s.me?.role);
  const list = role === 'ADMIN' ? adminItems : items;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-black/5 bg-tg-bg/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {list.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              end={it.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center gap-0.5 py-2 text-xs',
                  isActive ? 'text-tg-button font-medium' : 'text-tg-hint',
                )
              }
            >
              <span className="text-lg">{it.emoji}</span>
              <span>{it.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
