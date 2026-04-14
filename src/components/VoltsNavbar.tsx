import { useAuth } from "@/hooks/useAuth";

interface VoltsNavbarProps {
  onHistoryClick?: () => void;
  onLogout?: () => void;
}

export default function VoltsNavbar({ onHistoryClick, onLogout }: VoltsNavbarProps) {
  const { user } = useAuth();
  
  return (
    <nav className="w-full border-b bg-card px-6 py-3 flex items-center justify-center relative z-[100]">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold tracking-tight text-primary">SWIFT</span>
          <span className="text-xs font-medium text-foreground">v1.4</span>
        </div>
      </div>
      <div className="absolute right-6 flex items-center gap-4">
        {user && (
          <>
            <button
              onClick={onHistoryClick}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-all active:scale-95"
            >
              History
            </button>
            <button
              onClick={onLogout}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-all active:scale-95"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
