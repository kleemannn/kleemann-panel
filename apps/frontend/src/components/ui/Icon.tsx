import { SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'users'
  | 'plus'
  | 'clock'
  | 'store'
  | 'puzzle'
  | 'clipboard'
  | 'download'
  | 'trash'
  | 'pause'
  | 'play'
  | 'refresh'
  | 'check'
  | 'copy'
  | 'edit'
  | 'power'
  | 'arrowRight'
  | 'chevronRight'
  | 'calendar'
  | 'search'
  | 'x'
  | 'link'
  | 'shield'
  | 'device'
  | 'spark'
  | 'logo';

const PATHS: Record<IconName, string> = {
  home:
    'M3 11.5 12 4l9 7.5M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  plus: 'M12 5v14M5 12h14',
  clock: 'M12 7v5l3 2M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z',
  store:
    'M3 9l1-5h16l1 5M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M9 21v-6h6v6M3 9h18',
  puzzle:
    'M10 3h4v3a2 2 0 1 0 4 0h3v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H6v-4a2 2 0 1 1 0-4V6h4a2 2 0 0 0 0-3z',
  clipboard:
    'M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1zM5 5h14v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5z',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  play: 'M6 4v16l14-8z',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  check: 'M5 13l4 4L19 7',
  copy:
    'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  edit: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 7.5l3 3',
  power: 'M12 3v8M6.4 7.6a8 8 0 1 0 11.2 0',
  arrowRight: 'M5 12h14M13 5l7 7-7 7',
  chevronRight: 'M9 6l6 6-6 6',
  calendar:
    'M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  search: 'M11 4a7 7 0 1 1-4.95 11.95A7 7 0 0 1 11 4zm6 6l5 5',
  x: 'M6 6l12 12M18 6 6 18',
  link:
    'M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5',
  shield: 'M12 3 4 6v6c0 4.5 3 8.5 8 10 5-1.5 8-5.5 8-10V6l-8-3z',
  device:
    'M5 3h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 21h8M10 17v4M14 17v4',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8',
  logo:
    'M4 20V4h4l4 8 4-8h4v16h-3V9l-4 8h-2l-4-8v11H4z',
};

export function Icon({
  name,
  className,
  size = 20,
  strokeWidth = 2,
  ...rest
}: {
  name: IconName;
  className?: string;
  size?: number;
  strokeWidth?: number;
} & Omit<SVGProps<SVGSVGElement>, 'children'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
