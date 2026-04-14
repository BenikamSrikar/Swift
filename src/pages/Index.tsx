import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import SwiftBirdsMap from '@/components/SwiftBirdsMap';
import ParticleField from '@/components/ParticleField';
import HistoryModal from '@/components/HistoryModal';
import GoogleDriveIcon from '@/components/GoogleDriveIcon';
import { Shield, Wifi, Zap, FolderOpen, RefreshCw, Lock, History as HistoryIcon, Cloud } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SecureIcon, WidebandIcon, InstantIcon, FilesIcon, TransferIcon } from '@/components/ShiftIcons';

// ─── SWIFT Items Data ────────────────────────────────────────────────────────
const SWIFT_ITEMS = [
  {
    letter: 'S',
    word: 'Secure',
    brief: 'Your privacy is non-negotiable.',
    description: "Every transfer in SWIFT uses WebRTC for direct device-to-device streaming when possible. For massive files over 25MB, SWIFT securely utilizes your Google Drive to temporarily host and share the file exclusively with your intended recipient using strict access controls.",
  },
  {
    letter: 'W',
    word: 'Wideband',
    brief: 'Unleash every last bit of bandwidth.',
    description: "SWIFT doesn’t just use your connection — it dominates it. By establishing a raw WebRTC data channel directly between devices, every byte travels the shortest possible path with zero relay overhead.",
  },
  {
    letter: 'I',
    word: 'Instant',
    brief: 'Zero friction, zero accounts.',
    description: "Just sign in securely with your Google Account to begin. Create a room with one click, share a 6-character code, and start transferring instantly. No separate passwords to remember or verify.",
  },
  {
    letter: 'F',
    word: 'Files & Folders',
    brief: 'Send anything — files, folders, or videos.',
    description: "Whether it’s a single document, an entire project folder, or a large video file, SWIFT handles it all. Small files route directly via WebRTC, while anything larger than 25MB is intelligently routed through your Google Drive for maximum reliability.",
  },
  {
    letter: 'T',
    word: 'Transfer',
    brief: 'Ephemeral by design.',
    description: "SWIFT sessions are temporary. When you leave, your session data is wiped. There are no lingering files on a server, no account to delete later. Transfer history persists across sessions for your reference.",
  },
];

const SWIFT_ICON_COMPONENTS = [SecureIcon, WidebandIcon, InstantIcon, FilesIcon, TransferIcon];

const SECTION_STYLES = [
  { anim: 'anim-scale' },
  { anim: 'anim-slide-left' },
  { anim: 'anim-slide-right' },
  { anim: 'anim-flip' },
  { anim: 'anim-rise' },
];

// ─── Feature Cards Data ───────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Shield,
    title: 'End-to-End Secure',
    description: 'Files transfer directly between devices using WebRTC — no server ever touches your data.',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    icon: Wifi,
    title: 'Wideband P2P',
    description: 'Direct peer-to-peer channel means you use your full bandwidth with zero relay overhead.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: Zap,
    title: 'Instant Rooms',
    description: 'Sign in with Google, create a room, share a 6-digit code. Transfer starts in seconds.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
  },
  {
    icon: FolderOpen,
    title: 'Files & Folders',
    description: 'Send individual files, entire folders, or videos. Real-time progress on both ends.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    icon: GoogleDriveIcon,
    title: 'Google Drive for Large Files',
    description: 'Files over 25MB are uploaded to your Google Drive and a secure private link is sent to the recipient. Auto-deleted after 1 hour.',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  {
    icon: Lock,
    title: 'Private by Default',
    description: 'All Google Drive shares use read-only access limited exclusively to the recipient\'s email. Nobody else can access your files.',
    color: 'text-red-400',
    bg: 'bg-red-400/10',
  },
  {
    icon: HistoryIcon,
    title: 'Transfer History',
    description: 'Track everything you\'ve sent and received — including Google Drive links — across all sessions.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
  {
    icon: RefreshCw,
    title: 'Ephemeral Sessions',
    description: 'When you leave, your session data is wiped. No lingering data, no accounts to delete.',
    color: 'text-pink-400',
    bg: 'bg-pink-400/10',
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Sign In with Google', desc: 'Use your existing Google account — no new password needed. SWIFT requests access to transfer large files to your Google Drive when needed.' },
  { step: '02', title: 'Create or Join a Room', desc: 'Create a room instantly and share the 6-character Secure ID with whoever you want to transfer files with.' },
  { step: '03', title: 'Request & Send Files', desc: 'Request files from peers in your room. Small files go direct via WebRTC. Files over 25MB seamlessly route through a private Google Drive link.' },
  { step: '04', title: 'Auto-Cleanup', desc: 'Drive files are automatically deleted after 1 hour. Sessions clear when you leave. Nothing persists without your intent.' },
];

function useElasticScrollReveal() {
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.1 }
    );

    refs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return { refs };
}

export default function Index() {
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { refs: revealRefs } = useElasticScrollReveal();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/drive.file',
        queryParams: { prompt: 'consent select_account' },
      },
    });
    if (error) { console.error('Google sign-in failed:', error); setLoading(false); }
  };

  const handleSwitchAccount = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/drive.file',
        queryParams: { prompt: 'select_account consent' },
      },
    });
    if (error) { console.error('Switch account failed:', error); setLoading(false); }
  };

  return (
    <div className="bg-background text-foreground scroll-smooth">
      <VoltsNavbar onHistoryClick={() => setHistoryOpen(true)} />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="min-h-screen flex items-center px-4 sm:px-8 lg:px-16 relative overflow-hidden">
        <div className="lg:hidden absolute inset-0 z-0"><ParticleField /></div>

        <div className="w-full max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          <div 
            ref={(el) => { revealRefs.current[10] = el; }}
            className="flex-1 reveal-left"
          >
            {/* App name & tagline */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              v1.4 — Google Drive Integration
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
              <span className="text-primary">SWIFT</span>
              <span className="block text-2xl sm:text-3xl lg:text-4xl font-light text-muted-foreground mt-2">Connect</span>
            </h1>
            <p className="text-base lg:text-lg text-muted-foreground leading-relaxed max-w-lg mb-4">
              <strong className="text-foreground">Secure Wideband Instant File Transfer.</strong> A peer-to-peer file sharing platform that uses WebRTC for direct device connections and your Google Drive for seamless large-file sharing — all with zero cloud storage on our end.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mb-8">
              SWIFT requests access to your Google Drive (<code className="text-xs bg-muted px-1 py-0.5 rounded">drive.file</code> scope) solely to upload and share files larger than 25MB with your chosen recipient. We only access files SWIFT creates, and they are auto-deleted after 1 hour.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {user ? (
                <>
                  <Button
                    onClick={() => navigate('/connection')}
                    className="h-12 px-8 text-base font-semibold volts-gradient hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    Go to Dashboard
                  </Button>
                  <Button
                    onClick={handleSwitchAccount}
                    variant="outline"
                    className="h-12 px-6 gap-3 text-base font-medium bg-transparent border border-border hover:bg-muted"
                  >
                    Switch Account
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={loading || authLoading}
                  variant="outline"
                  className="h-12 px-6 gap-3 text-base font-medium bg-transparent border border-border hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-200"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  {loading ? 'Signing in…' : 'Sign in with Google'}
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              {user
                ? `Logged in as ${profile?.email || user.email}`
                : <>By signing in, you agree to our <a href="/privacy" className="underline hover:text-primary">Privacy Policy</a> and <a href="/terms" className="underline hover:text-primary">Terms of Service</a>.</>
              }
            </p>
          </div>

          {/* Desktop map */}
          <div 
            ref={(el) => { revealRefs.current[11] = el; }}
            className="hidden lg:block flex-[1.2] relative reveal-right h-[600px]" 
          >
            <div className="absolute inset-0 flex items-center justify-center p-8 bg-primary/5 rounded-[40px] border border-primary/10 backdrop-blur-3xl shadow-2xl overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-primary/10 opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
              <SwiftBirdsMap />
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce z-10">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </div>
        </div>
      </section>

      {/* ── What is SWIFT? ─────────────────────────────────────────────────── */}
      <section
        ref={(el) => { revealRefs.current[0] = el; }}
        className="scroll-section anim-scale py-24 px-6 sm:px-12 bg-background"
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-black mb-8 italic tracking-tighter text-primary">What is SWIFT Connect?</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-6">
            SWIFT Connect is a browser-based, peer-to-peer file transfer platform that lets you securely share any file with anyone — directly from your browser. No uploads to our servers. No waiting. No accounts beyond your existing Google login.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed">
            For files and folders larger than 25MB, SWIFT integrates with your Google Drive using the <strong className="text-foreground">drive.file</strong> permission — the most restrictive scope available. This gives SWIFT access <em>only</em> to files it creates, not your entire Drive. The sender uploads the file, SWIFT shares it only with the specific recipient's email (read-only), and the file is automatically deleted after 1 hour.
          </p>
        </div>
      </section>

      {/* ── Feature Cards ─────────────────────────────────────────────────── */}
      <section
        ref={(el) => { revealRefs.current[1] = el; }}
        className="scroll-section anim-slide-left py-24 px-6 sm:px-12 bg-muted/10"
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-black text-center mb-6 tracking-tighter">Everything You Need</h2>
          <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">Built for speed, privacy, and reliability. Here's exactly what SWIFT does — and why we need the permissions we ask for.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <div 
                key={f.title} 
                ref={(el) => { revealRefs.current[50 + i] = el; }}
                className="reveal-base bg-card border border-border/50 rounded-2xl p-6 hover:border-primary/30 transition-all hover:-translate-y-1 duration-300"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} strokeWidth={1.5} />
                </div>
                <h3 className="font-bold text-sm mb-2">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Google Drive Permission Explainer ─────────────────────────────── */}
      <section
        ref={(el) => { revealRefs.current[2] = el; }}
        className="scroll-section anim-slide-right py-24 px-6 sm:px-12 bg-background"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row gap-10 items-center">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-400/10 border border-orange-400/20 text-xs font-semibold text-orange-400 uppercase tracking-widest mb-6">
                <GoogleDriveIcon className="w-3 h-3" /> Google Drive Integration
              </div>
              <h2 className="text-4xl sm:text-5xl font-black mb-8 tracking-tighter">Why We Use Your Google Drive</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                WebRTC data channels work great for small-medium files but face performance challenges above 25MB. To deliver a reliable experience, SWIFT uses the <strong className="text-foreground">drive.file</strong> scope to temporarily stage large files in your own Google Drive.
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  'We only access files SWIFT itself creates — never your personal Drive files.',
                  'The file is shared only with the specific recipient\'s email address (read-only).',
                  'The file is automatically deleted from your Drive within 1 hour of the transfer.',
                  'You can revoke our access at any time from your Google Account settings.',
                ].map(item => (
                  <li key={item} className="flex gap-3 items-start">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-shrink-0 w-64 h-64 rounded-3xl bg-gradient-to-br from-orange-400/10 to-primary/10 border border-border flex items-center justify-center">
              <GoogleDriveIcon className="w-24 h-24" />
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section
        ref={(el) => { revealRefs.current[3] = el; }}
        className="scroll-section anim-rise py-24 px-6 sm:px-12 bg-muted/10 border-b border-border/50"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-black text-center mb-16 tracking-tighter">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
              <div 
                key={step} 
                ref={(el) => { revealRefs.current[100 + i] = el; }}
                className="reveal-base relative"
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="text-6xl font-black text-primary/10 mb-2 leading-none">{step}</div>
                <h3 className="font-bold text-base mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SWIFT Core Philosophy Breakdown ─────────────────────────────── */}
      {SWIFT_ITEMS.map(({ letter, word, brief, description }, i) => {
        const style = SECTION_STYLES[i];
        const IconComponent = SWIFT_ICON_COMPONENTS[i];

        return (
          <section
            key={letter}
            ref={(el: HTMLDivElement | null) => { revealRefs.current[i + 20] = el; }}
            className={`scroll-section ${style.anim} min-h-[70vh] flex items-center justify-center px-6 sm:px-12 bg-background border-b border-white/[0.02] last:border-b-0`}
          >
            <div
              className={`w-full max-w-5xl flex flex-col ${
                i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
              } items-center gap-10 md:gap-20`}
            >
              <div className="scroll-image shrink-0 w-40 h-40 sm:w-52 sm:h-52 md:w-60 md:h-60 transition-transform duration-500 hover:scale-110">
                <IconComponent revealed={true} />
              </div>

              <div className={`scroll-text text-center ${i % 2 === 0 ? 'md:text-left' : 'md:text-right'} max-w-xl`}>
                <h2 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 text-foreground tracking-tighter">
                  <span className="text-primary">{letter}</span>
                  <span> — {word}</span>
                </h2>
                <p className="text-lg sm:text-xl font-bold mb-4 text-foreground/90">
                  {brief}
                </p>
                <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          </section>
        );
      })}

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-background text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Transfer?</h2>
          <p className="text-muted-foreground mb-8">No setup. No new accounts. Just sign in with Google and start sharing in seconds.</p>
          {user ? (
            <Button onClick={() => navigate('/connection')} className="h-12 px-10 text-base font-semibold volts-gradient hover:opacity-90 transition-all shadow-lg shadow-primary/20">
              Go to Dashboard
            </Button>
          ) : (
            <Button
              onClick={handleGoogleSignIn}
              disabled={loading || authLoading}
              variant="outline"
              className="h-12 px-8 gap-3 text-base font-medium bg-transparent border border-border hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-200"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {loading ? 'Signing in…' : 'Sign in with Google'}
            </Button>
          )}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-border/10 bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <span className="text-2xl font-black text-primary tracking-tighter">SWIFT</span>
            <span className="text-[10px] font-mono ml-2 py-0.5 px-2 bg-primary/10 text-primary border border-primary/20 rounded-full">v1.4</span>
            <p className="text-xs mt-2 text-muted-foreground font-medium">Secure Wideband Instant File Transfer</p>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-muted-foreground/60 font-medium">
              Designed & Developed by
            </span>
            <span className="text-sm font-bold bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
              Benikam Srikar
            </span>
          </div>

          <div className="flex flex-col items-center md:items-end gap-4">
            <div className="flex items-center gap-6 text-xs font-semibold">
              <a href="/privacy" className="hover:text-primary transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-primary transition-colors">Terms</a>
            </div>
            <p className="text-[10px] text-muted-foreground/40 font-mono">
              &copy; {new Date().getFullYear()} SWIFT CONNECT. NO RIGHTS RESERVED.
            </p>
          </div>
        </div>
      </footer>

      {user && profile && (
        <HistoryModal 
          open={historyOpen} 
          onClose={() => setHistoryOpen(false)} 
          senderEmail={profile.email} 
          senderName={profile.name} 
        />
      )}
    </div>
  );
}
