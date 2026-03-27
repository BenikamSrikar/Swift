import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';

interface VoltsNavbarProps {
  showActions?: boolean;
  onHistoryClick?: () => void;
  onLogout?: () => void;
}

export default function VoltsNavbar({ showActions, onHistoryClick, onLogout }: VoltsNavbarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="w-full border-b bg-card px-6 py-3 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold tracking-tight text-primary">SHIFT</span>
          <span className="text-xs font-medium text-foreground">v1.0</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        {showActions && (
          <>
            <button
              onClick={onHistoryClick}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              History
            </button>
            <button
              onClick={onLogout}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
