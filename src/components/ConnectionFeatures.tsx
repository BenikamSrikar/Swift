import { Shield, Zap, Globe, FolderSync, Clock, AlertTriangle } from 'lucide-react';

const NEW_FEATURES = [
  {
    icon: Globe,
    title: 'Browser Independent',
    description: 'Works on Chrome, Firefox, Safari, and Edge — no extensions needed.',
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
  {
    icon: Zap,
    title: 'Faster Connections',
    description: 'Optimized signaling for quicker peer discovery and connection setup.',
  },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Create or Join', description: 'Create a room and share the 6-character code, or enter a code to join.' },
  { step: '2', title: 'Connect Peer-to-Peer', description: 'A direct WebRTC connection is established — no server in between.' },
  { step: '3', title: 'Transfer Files', description: 'Drag and drop files to send them at full speed, encrypted end-to-end.' },
];

const V1_DRAWBACKS = [
  { icon: Clock, text: 'v1.0 had slower initial connection times due to unoptimized signaling.' },
  { icon: AlertTriangle, text: 'v1.0 lacked folder support — only individual files could be sent.' },
  { icon: Globe, text: 'v1.0 had intermittent issues on Safari and older Edge versions.' },
];

export default function ConnectionFeatures({ userName }: { userName: string }) {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-10 animate-fade-in">
      {/* Welcome */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Welcome back, <span className="text-primary">{userName.split(' ')[0]}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Here's what's new in SWIFT v1.1</p>
      </div>

      {/* What's New */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">What's New in v1.1</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {NEW_FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3 p-4 rounded-xl border bg-card">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <f.icon className="w-4 h-4 text-primary" />
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
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">How It Works</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} className="flex-1 p-4 rounded-xl border bg-card text-center">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mx-auto mb-2">
                {s.step}
              </div>
              <p className="text-sm font-semibold text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* v1.0 Drawbacks */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Fixed from v1.0</h3>
        <div className="space-y-2">
          {V1_DRAWBACKS.map((d, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <d.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">{d.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
