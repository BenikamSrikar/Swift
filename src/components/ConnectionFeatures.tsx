import { useEffect, useRef, useState } from 'react';
import { Shield, Zap, Globe, FolderSync, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import GoogleDriveIcon from './GoogleDriveIcon';

const NEW_FEATURES = [
  {
    icon: Globe,
    title: 'Browser Independent',
    description: 'Works on Chrome, Firefox, Safari, and Edge — no extensions needed.',
  },
  {
    icon: GoogleDriveIcon,
    title: 'Smart Size Routing',
    description: 'Files <25MB transfer via WebRTC. Larger files auto-upload to Google Drive with 5-min expiry links.',
  },
  {
    icon: FolderSync,
    title: 'Folder Transfers',
    description: 'Send entire folders that get auto-compressed into ZIP archives.',
  },
  {
    icon: Shield,
    title: 'Enhanced Security',
    description: 'Upgraded encryption with stronger key exchange protocols.',
  },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Create or Join', description: 'Create a room and share the 6-character code, or enter a code to join.' },
  { step: '2', title: 'Connect Peer-to-Peer', description: 'A direct WebRTC connection is established — no server in between.' },
  { step: '3', title: 'Transfer Files', description: 'Drop files to send. Small files go direct, large files route through Google Drive automatically.' },
];

const V1_COMPARISON = [
  { v1: 'All files sent via WebRTC only', v12: 'Smart routing — WebRTC for <25MB, Google Drive for larger', icon: GoogleDriveIcon },
  { v1: 'No transfer history for receivers', v12: 'Both sender and receiver see full transfer history', icon: Clock },
  { v1: 'Only individual files could be sent', v12: 'Full folder support with auto-ZIP', icon: FolderSync },
  { v1: 'Intermittent issues on Safari & Edge', v12: 'Seamless cross-browser compatibility', icon: Globe },
  { v1: 'Basic encryption only', v12: 'Enhanced end-to-end encryption', icon: Shield },
];

function useScrollReveal() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = refs.current.indexOf(entry.target as HTMLDivElement);
            if (idx >= 0) setRevealed((prev) => new Set(prev).add(idx));
          }
        });
      },
      { threshold: 0.15 }
    );
    refs.current.forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, []);

  return { refs, revealed };
}

export default function ConnectionFeatures({ userName }: { userName: string }) {
  const { refs, revealed } = useScrollReveal();

  const getRevealClass = (idx: number, variant: 'up' | 'left' | 'right' | 'scale' = 'up') => {
    const isRevealed = revealed.has(idx);
    const base = 'transition-all duration-700 ease-out';
    if (variant === 'left') return `${base} ${isRevealed ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`;
    if (variant === 'right') return `${base} ${isRevealed ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`;
    if (variant === 'scale') return `${base} ${isRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`;
    return `${base} ${isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-12 py-6">
      {/* Welcome */}
      <div
        ref={(el) => { refs.current[0] = el; }}
        className={getRevealClass(0, 'scale')}
      >
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Welcome back, <span className="text-primary">{userName.split(' ')[0]}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Here's what's new in SWIFT v1.4</p>
        </div>
      </div>

      {/* What's New */}
      <div
        ref={(el) => { refs.current[1] = el; }}
        className={getRevealClass(1, 'up')}
      >
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">What's New in v1.4</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {NEW_FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="flex items-start gap-3 p-4 rounded-xl border bg-card transition-all duration-500 ease-out hover:shadow-md hover:border-primary/20"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <f.icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div
        ref={(el) => { refs.current[2] = el; }}
        className={getRevealClass(2, 'left')}
      >
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">How It Works</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} className="flex-1 p-4 rounded-xl border bg-card text-center hover:shadow-md transition-shadow duration-300">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mx-auto mb-2">
                {s.step}
              </div>
              <p className="text-sm font-semibold text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* v1.0 vs v1.3 Comparison */}
      <div
        ref={(el) => { refs.current[3] = el; }}
        className={getRevealClass(3, 'right')}
      >
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">v1.0 vs v1.4</h3>
        <div className="space-y-3">
          {V1_COMPARISON.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-4 rounded-xl border bg-card transition-all duration-500 hover:shadow-md"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <item.icon className="w-5 h-5 text-primary shrink-0" strokeWidth={1.5} />
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                <span className="text-xs text-muted-foreground line-through flex-1">{item.v1}</span>
                <ArrowRight className="w-3 h-3 text-primary shrink-0 hidden sm:block" />
                <span className="text-xs font-medium text-foreground flex-1">{item.v12}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
