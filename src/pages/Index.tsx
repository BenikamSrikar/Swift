import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import SwiftBirdsMap from '@/components/SwiftBirdsMap';
import ParticleField from '@/components/ParticleField';
import { Shield, Wifi, Zap, FolderOpen, RefreshCw, Cloud, Lock, History } from 'lucide-react';

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
    icon: Cloud,
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
    icon: History,
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

function useScrollReveal() {
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('revealed')),
      { threshold: 0.1 }
    );
    refs.current.forEach(r => r && observer.observe(r));
    return () => observer.disconnect();
  }, []);
  return refs;
}

export default function Index() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const revealRefs = useScrollReveal();

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
    <div className="bg-background text-foreground">
      <VoltsNavbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="min-h-screen flex items-center px-4 sm:px-8 lg:px-16 relative overflow-hidden">
        <div className="lg:hidden absolute inset-0 z-0"><ParticleField /></div>

        <div className="w-full max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          <div className="flex-1 animate-fade-up" style={{ animationDelay: '100ms' }}>
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
          <div className="hidden lg:block flex-1 relative" style={{ minHeight: 500 }}>
            <div className="absolute inset-0 flex items-start" style={{ top: '-2rem' }}>
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
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">What is SWIFT Connect?</h2>
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
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">Everything You Need</h2>
          <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">Built for speed, privacy, and reliability. Here's exactly what SWIFT does — and why we need the permissions we ask for.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card border border-border/50 rounded-2xl p-6 hover:border-primary/30 transition-all hover:-translate-y-1 duration-300">
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
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
                <Cloud className="w-3 h-3" /> Google Drive Integration
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">Why We Use Your Google Drive</h2>
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
              <Cloud className="w-24 h-24 text-orange-400/40" />
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section
        ref={(el) => { revealRefs.current[3] = el; }}
        className="scroll-section anim-rise py-24 px-6 sm:px-12 bg-muted/10"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step} className="relative">
                <div className="text-6xl font-black text-primary/10 mb-2 leading-none">{step}</div>
                <h3 className="font-bold text-base mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
      <footer className="py-10 px-6 border-t border-border/20" style={{ backgroundColor: 'hsl(0 0% 4%)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <span className="text-xl font-bold text-primary">SWIFT</span>
            <span className="text-xs font-mono ml-2" style={{ color: 'hsl(0 0% 50%)' }}>v1.4</span>
            <p className="text-xs mt-1" style={{ color: 'hsl(0 0% 45%)' }}>Secure Wideband Instant File Transfer</p>
          </div>
          <span className="text-xs" style={{ color: 'hsl(0 0% 40%)' }}>
            P2P WebRTC &bull; Google Drive Integration &bull; Ephemeral Sessions
          </span>
          <div className="flex flex-col sm:flex-row items-center gap-4 text-xs" style={{ color: 'hsl(0 0% 45%)' }}>
            <a href="/privacy" className="hover:text-primary transition-colors font-semibold">Privacy Policy</a>
            <a href="/terms" className="hover:text-primary transition-colors font-semibold">Terms of Service</a>
            <span style={{ color: 'hsl(0 0% 35%)' }}>&copy; {new Date().getFullYear()} SWIFT Connect</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
