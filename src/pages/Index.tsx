import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import SwiftBirdsMap from '@/components/SwiftBirdsMap';
import ParticleField from '@/components/ParticleField';
import { SecureIcon, WidebandIcon, InstantIcon, FilesIcon, TransferIcon } from '@/components/ShiftIcons';

const SWIFT_ITEMS = [
  {
    letter: 'S',
    word: 'Secure',
    brief: 'Your privacy is non-negotiable.',
    description:
      "Every transfer in SWIFT is peer-to-peer using WebRTC — your files never pass through any server. With end-to-end encryption baked into the protocol, only the sender and receiver can access the data. No cloud storage, no logs, no traces.",
  },
  {
    letter: 'W',
    word: 'Wideband',
    brief: 'Unleash every last bit of bandwidth.',
    description:
      "SWIFT doesn\u2019t just use your connection — it dominates it. By establishing a raw WebRTC data channel directly between devices, every byte travels the shortest possible path with zero relay overhead.",
  },
  {
    letter: 'I',
    word: 'Instant',
    brief: 'Zero friction, zero accounts.',
    description:
      "No sign-ups, no email verification, no passwords to remember. Just sign in with Google and you\u2019re in. Create a room with one click, share a 6-character code, and start transferring.",
  },
  {
    letter: 'F',
    word: 'Files & Folders',
    brief: 'Send anything — files, folders, or videos.',
    description:
      "Whether it\u2019s a single document, an entire project folder, or a large video file, SWIFT handles it all. Large files are sent in chunks with real-time progress tracking on both sides.",
  },
  {
    letter: 'T',
    word: 'Transfer',
    brief: 'Ephemeral by design.',
    description:
      "SWIFT sessions are temporary. When you leave, your session data is wiped. There are no lingering files on a server, no account to delete later. Transfer history persists across sessions for your reference.",
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

function useElasticScrollReveal() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [revealedSet, setRevealedSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            const idx = refs.current.indexOf(entry.target as HTMLDivElement);
            if (idx >= 0) {
              setRevealedSet((prev) => new Set(prev).add(idx));
            }
          }
        });
      },
      { threshold: 0.12 }
    );

    refs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return { refs, revealedSet };
}

export default function Index() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { refs: sectionRefs, revealedSet } = useElasticScrollReveal();

  // We no longer automatically redirect to /connection
  // Instead we let the user choose "Go to Dashboard"
  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error('Google sign-in failed:', error);
      setLoading(false);
      return;
    }
  };

  const handleSwitchAccount = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      console.error('Switch account failed:', error);
      setLoading(false);
      return;
    }
  };

  return (
    <div className="bg-background">
      <VoltsNavbar />

      {/* Hero */}
      <section className="min-h-screen flex items-center px-4 sm:px-8 lg:px-16 relative overflow-hidden">
        {/* Mobile-only background wiggle animation */}
        <div className="lg:hidden absolute inset-0 z-0">
          <ParticleField />
        </div>

        <div className="w-full max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          <div className="flex-1 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
              <span className="text-primary">SWIFT</span>
            </h1>
            <p className="text-base lg:text-lg text-muted-foreground leading-relaxed max-w-md mb-8">
              Peer-to-peer file transfer built for speed and privacy. No accounts, no cloud — just a direct connection between you and the recipient.
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
              {user ? `Logged in as ${profile?.email || user.email}` : 'Sign in to create or join rooms. Your transfer history persists across sessions.'}
            </p>
          </div>

          {/* Desktop-only world map animation */}
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

      {/* SWIFT Sections */}
      {SWIFT_ITEMS.map(({ letter, word, brief, description }, i) => {
        const style = SECTION_STYLES[i];
        const IconComponent = SWIFT_ICON_COMPONENTS[i];
        const isSectionRevealed = revealedSet.has(i);

        return (
          <section
            key={letter}
            ref={(el: HTMLDivElement | null) => { sectionRefs.current[i] = el; }}
            className={`scroll-section ${style.anim} min-h-screen flex items-center justify-center px-6 sm:px-12 bg-background`}
          >
            <div
              className={`w-full max-w-5xl flex flex-col ${
                i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
              } items-center gap-10 md:gap-20`}
            >
              <div className="scroll-image shrink-0 w-40 h-40 sm:w-52 sm:h-52 md:w-60 md:h-60 transition-transform duration-500 hover:scale-110">
                <IconComponent revealed={isSectionRevealed} />
              </div>

              <div className={`scroll-text text-center ${i % 2 === 0 ? 'md:text-left' : 'md:text-right'} max-w-xl`}>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 text-foreground">
                  <span className="text-primary">{letter}</span>
                  <span> — {word}</span>
                </h2>
                <p className="text-lg sm:text-xl font-semibold mb-4 text-foreground">
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

      <footer className="py-12 px-6" style={{ backgroundColor: 'hsl(0 0% 4%)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <span className="text-xl font-bold text-primary">SWIFT</span>
            <span className="text-xs font-mono ml-2" style={{ color: 'hsl(0 0% 50%)' }}>v1.3</span>
            <p className="text-xs mt-1" style={{ color: 'hsl(0 0% 45%)' }}>
              Secure Wideband Instant File Transfer
            </p>
          </div>
          <span className="text-xs" style={{ color: 'hsl(0 0% 40%)' }}>
            No data stored &bull; Peer-to-peer &bull; Ephemeral sessions
          </span>
          <p className="text-xs" style={{ color: 'hsl(0 0% 35%)' }}>
            &copy; {new Date().getFullYear()} SWIFT. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
