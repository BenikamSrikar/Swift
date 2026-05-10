interface VoltsNavbarProps {
  showActions?: boolean;
  onHistoryClick?: () => void;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
  logoutLabel?: string;
}

export default function VoltsNavbar({ showActions = true, onHistoryClick, onLogout, onDeleteAccount, logoutLabel = "Logout" }: VoltsNavbarProps) {
  return (
    <nav className="w-full border-b bg-card/40 backdrop-blur-xl px-6 py-4 flex items-center justify-center relative z-50 border-white/5">
      <div className="flex items-center gap-2 group cursor-pointer">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
          <span className="text-white font-black text-xs">S</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black tracking-tighter text-foreground leading-none">SWIFT-Connect</span>
          <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Protocol v1.5</span>
        </div>
      </div>
      <div className="absolute right-6 flex items-center gap-4">
        {showActions && (
          <>
            <button
              onClick={onHistoryClick}
              className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all active:scale-95"
            >
              Logs
            </button>
            <button
              onClick={onLogout}
              className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all active:scale-95 border border-border/40"
            >
              Switch Account
            </button>
            <button
              onClick={onDeleteAccount || onLogout}
              className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all active:scale-95 border border-destructive/20"
            >
              Delete Account
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
