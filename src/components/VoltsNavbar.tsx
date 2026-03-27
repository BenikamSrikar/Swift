interface VoltsNavbarProps {
  showActions?: boolean;
  onHistoryClick?: () => void;
  onLogout?: () => void;
}

export default function VoltsNavbar({ showActions, onHistoryClick, onLogout }: VoltsNavbarProps) {
  return (
    <nav className="w-full border-b bg-card px-6 py-3 flex items-center justify-center relative">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold tracking-tight text-primary">SHIFT</span>
          <span className="text-xs font-medium text-foreground">v1.0</span>
        </div>
      </div>
      <div className="absolute right-6 flex items-center gap-3">
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
