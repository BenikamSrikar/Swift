import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface VoltsNavbarProps {
  showActions?: boolean;
  onHistoryClick?: () => void;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
  logoutLabel?: string;
}

export default function VoltsNavbar({ showActions = true, onHistoryClick, onLogout, onDeleteAccount, logoutLabel = "Logout" }: VoltsNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (currentScroll / totalHeight) * 100;
      
      setScrollProgress(progress);
      setScrolled(currentScroll > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 left-0 w-full px-6 py-4 flex items-center justify-center z-[100] transition-all duration-500 ease-in-out border-b ${
        scrolled 
          ? 'bg-black border-white/10 shadow-2xl py-3' 
          : 'bg-card/40 backdrop-blur-xl border-white/5'
      }`}
    >
      <div className="flex items-center gap-3 group cursor-pointer transition-transform active:scale-95">
        {/* SWIFT Keyboard Key Logo */}
        <div 
          className={`px-4 py-1.5 rounded-[10px] border-[2.5px] border-[#FF3B30] flex items-center gap-1.5 transition-all duration-500 ${
            scrolled ? 'shadow-[0_0_20px_rgba(255,59,48,0.5)] scale-95' : ''
          }`}
          style={{ background: 'transparent' }}
        >
          <span className="text-[#FF3B30] font-black text-base tracking-tighter uppercase">SWIFT</span>
          <Plus className="w-4 h-4 text-[#FF3B30] stroke-[4px]" />
        </div>
        
        {/* Version Keyboard Key Logo */}
        <div 
          className={`px-2.5 py-1 rounded-[8px] border transition-all duration-500 ${
            scrolled 
              ? 'border-[#FF3B30]/40 shadow-[0_0_15px_rgba(255,59,48,0.3)]' 
              : 'border-black/10'
          }`}
          style={{ background: 'transparent' }}
        >
          <span className={`text-[10px] font-black tracking-[0.2em] transition-colors duration-500 ${
            scrolled ? 'text-white' : 'text-black'
          }`}>V1.5</span>
        </div>
      </div>

      <div className="absolute right-6 flex items-center gap-4">
        {showActions && (
          <>
            <button
              onClick={onHistoryClick}
              className={`text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${
                scrolled ? 'text-white hover:text-[#FF3B30]' : 'text-muted-foreground hover:text-primary'
              }`}
            >
              Logs
            </button>
            <button
              onClick={onLogout}
              className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${
                scrolled 
                  ? 'bg-white/5 text-white border-white/10 hover:bg-white/10' 
                  : 'bg-secondary text-secondary-foreground border-border/40 hover:bg-secondary/80'
              }`}
            >
              Switch Account
            </button>
            <button
              onClick={onDeleteAccount || onLogout}
              className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${
                scrolled
                  ? 'bg-destructive/20 text-[#FF3B30] border-[#FF3B30]/30 hover:bg-destructive hover:text-white shadow-[0_0_15px_rgba(255,59,48,0.2)]'
                  : 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive hover:text-white'
              }`}
            >
              Delete Account
            </button>
          </>
        )}
      </div>

      {/* Red Scroll Progress Bar */}
      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-transparent overflow-hidden">
        <div 
          className="h-full bg-[#FF3B30] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(255,59,48,0.5)]"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
    </nav>
  );
}
