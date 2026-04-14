import { useAuth } from "@/hooks/useAuth";

interface VoltsNavbarProps {
  onHistoryClick?: () => void;
  onLogout?: () => void;
}

export default function VoltsNavbar({ onHistoryClick, onLogout }: VoltsNavbarProps) {
  const { user } = useAuth();
  
  return (
    <nav className="w-full border-b bg-card px-6 py-4 flex items-center justify-between relative z-[100] backdrop-blur-md bg-opacity-80">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-default">
          <span className="text-xl font-black tracking-tighter text-primary">SWIFT</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">v1.4</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {user && (
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onHistoryClick?.();
              }}
              className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-all active:scale-95 py-1 px-2 rounded-lg hover:bg-white/5"
            >
              <div className="w-1 h-1 rounded-full bg-muted-foreground group-hover:bg-primary transition-colors" />
              History
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLogout?.();
              }}
              className="text-sm font-black text-primary hover:text-primary/80 transition-all active:scale-95 py-1 px-3 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/10"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

