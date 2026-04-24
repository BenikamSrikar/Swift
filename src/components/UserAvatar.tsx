interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const COLORS = [
  'hsl(355 82% 56%)',
  'hsl(210 70% 50%)',
  'hsl(142 71% 40%)',
  'hsl(38 92% 50%)',
  'hsl(280 60% 50%)',
  'hsl(190 80% 42%)',
  'hsl(330 65% 50%)',
  'hsl(15 80% 55%)',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

const sizes = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

export default function UserAvatar({ name, avatarUrl, size = 'md', className = '' }: UserAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizes[size]} rounded-full shrink-0 object-cover ${className}`}
      />
    );
  }

  const letter = name.charAt(0).toUpperCase();
  const bg = getColor(name);

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0 ${className}`}
      style={{ backgroundColor: bg }}
    >
      {letter}
    </div>
  );
}
