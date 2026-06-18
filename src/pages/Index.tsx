import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import SwiftBirdsMap from '@/components/SwiftBirdsMap';
import ParticleField from '@/components/ParticleField';
import { SecureIcon, WidebandIcon, InstantIcon, FilesIcon, TransferIcon } from '@/components/ShiftIcons';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Shield, Zap, Globe, Lock, ArrowRight,
  UserPlus, Link2, Upload, Download,
  Eye, EyeOff, Server, Wifi
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════
   SWIFT letter data (preserved from original)
   ═══════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════
   How It Works steps
   ═══════════════════════════════════════════════════════ */
const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: 'Sign In with Google',
    description: 'One-tap Google sign-in. No passwords, no email verification, no accounts to manage. Your Google identity is used solely for authentication.',
    icon: UserPlus,
    gradient: 'from-blue-500 to-cyan-400',
    bgGlow: 'rgba(59,130,246,0.15)',
  },
  {
    step: 2,
    title: 'Create or Join a Room',
    description: 'Create a transfer room with one click and share the 6-character room code with the recipient. Or join an existing room by entering their code.',
    icon: Link2,
    gradient: 'from-violet-500 to-purple-400',
    bgGlow: 'rgba(139,92,246,0.15)',
  },
  {
    step: 3,
    title: 'Select & Send Files',
    description: 'Drag and drop or browse to select any files — documents, images, videos, entire folders. Files are transferred peer-to-peer with real-time progress tracking.',
    icon: Upload,
    gradient: 'from-emerald-500 to-green-400',
    bgGlow: 'rgba(16,185,129,0.15)',
  },
  {
    step: 4,
    title: 'Receive & Download',
    description: 'The recipient instantly sees incoming files with a live progress bar. Downloads happen automatically — no waiting, no email links, no expiring URLs.',
    icon: Download,
    gradient: 'from-orange-500 to-amber-400',
    bgGlow: 'rgba(249,115,22,0.15)',
  },
];

/* ═══════════════════════════════════════════════════════
   Privacy features for the trust section
   ═══════════════════════════════════════════════════════ */
const PRIVACY_FEATURES = [
  {
    icon: EyeOff,
    title: 'No File Storage',
    description: 'Files are never stored on any server. They travel directly from sender to receiver via WebRTC.',
  },
  {
    icon: Lock,
    title: 'End-to-End Encrypted',
    description: 'WebRTC data channels use DTLS encryption. Only the sender and receiver can access the file data.',
  },
  {
    icon: Server,
    title: 'No Server Relay',
    description: 'Your files never pass through our servers. We only facilitate the initial connection handshake.',
  },
  {
    icon: Eye,
    title: 'No Tracking or Logging',
    description: 'We don\'t log file names, sizes, or transfer activity. Your transfer history is stored only in your browser.',
  },
];

/* ═══════════════════════════════════════════════════════
   Scroll-reveal hook (preserved from original)
   ═══════════════════════════════════════════════════════ */
function useElasticScrollReveal() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [revealedSet, setRevealedSet] = useState<Set<number>>(new Set());

  // Use a ref to avoid re-creating observer on every render
  const observerRef = useRef<IntersectionObserver | null>(null);

  if (!observerRef.current && typeof window !== 'undefined') {
    observerRef.current = new IntersectionObserver(
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
  }

  const setRef = (index: number) => (el: HTMLDivElement | null) => {
    refs.current[index] = el;
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  };

  return { setRef, revealedSet };
}

/* ═══════════════════════════════════════════════════════
   Animated section wrapper using framer-motion useInView
   ═══════════════════════════════════════════════════════ */
function ScrollReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const dirMap = {
    up: { y: 60, x: 0 },
    down: { y: -60, x: 0 },
    left: { x: -80, y: 0 },
    right: { x: 80, y: 0 },
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...dirMap[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   Step Card Component with scroll animation
   ═══════════════════════════════════════════════════════ */
function StepCard({
  step,
  title,
  description,
  icon: Icon,
  gradient,
  bgGlow,
  index,
}: {
  step: number;
  title: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  bgGlow: string;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 80, scale: 0.9 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{
        duration: 0.8,
        delay: index * 0.15,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group relative"
    >
      {/* Connecting line to next step */}
      {index < 3 && (
        <div className="hidden lg:block absolute top-1/2 -right-8 w-16 h-[2px]">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.6, delay: index * 0.15 + 0.5 }}
            className="h-full bg-gradient-to-r from-border to-transparent origin-left"
          />
        </div>
      )}

      <div
        className="relative overflow-hidden rounded-2xl border border-border/50 p-6 sm:p-8 transition-all duration-500 hover:border-border hover:shadow-xl hover:-translate-y-1"
        style={{ background: `radial-gradient(ellipse at top left, ${bgGlow}, transparent 70%)` }}
      >
        {/* Step number badge */}
        <div className="flex items-center gap-4 mb-5">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
            <Icon className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-black uppercase tracking-[0.2em] bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
              Step {step}
            </span>
          </div>
        </div>

        <h3 className="text-xl font-bold mb-3 text-foreground group-hover:text-primary transition-colors duration-300">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        {/* Decorative corner accent */}
        <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500`} />
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Index Component
   ═══════════════════════════════════════════════════════ */
export default function Index() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { setRef: setSectionRef, revealedSet } = useElasticScrollReveal();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');

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
    }
  };

  const handleSwitchAccount = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      console.error('Switch account failed:', error);
      setLoading(false);
    }
  };

  const confirmDeleteAccount = async () => {
    const requiredText = `DELETE ${profile?.name?.toUpperCase()}`;
    if (confirmationInput.toUpperCase() !== requiredText) {
      toast.error(`Please type "${requiredText}" to confirm`);
      return;
    }
    setIsDeleting(true);
    try {
      await supabase.from('rooms').delete().eq('host_id', user!.id);
      await supabase.from('room_participants').delete().eq('user_id', user!.id);
      await supabase.from('sessions').delete().eq('user_id', user!.id);
      const { error } = await supabase.from('profiles').delete().eq('auth_user_id', user!.id);
      if (error) throw error;
      toast.success('Account and profile removed successfully.');
      setTimeout(async () => {
        await signOut();
        setShowDeleteModal(false);
        setConfirmationInput('');
      }, 1500);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fully remove account records');
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-background">
      <VoltsNavbar
        onLogout={signOut}
        onDeleteAccount={() => setShowDeleteModal(true)}
        showDeleteAccount={!!user}
        showActions={!!user}
      />

      {/* ═══════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════ */}
      <section className="min-h-screen flex items-center px-4 sm:px-8 lg:px-16 relative overflow-hidden pt-20">
        {/* Mobile-only background */}
        <div className="lg:hidden absolute inset-0 z-0">
          <ParticleField />
        </div>

        <div className="w-full max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          <div className="flex-1">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-6">
                <Wifi className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary tracking-wide">Peer-to-Peer • End-to-End Encrypted</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
                <span className="text-primary">SWIFT</span>
              </h1>
              <p className="text-lg lg:text-xl font-medium text-foreground/80 mb-2">
                Secure Wideband Instant File Transfer
              </p>
              <p className="text-base lg:text-lg text-muted-foreground leading-relaxed max-w-lg mb-8">
                Transfer files directly between devices using WebRTC — no servers, no cloud storage, no file size limits. 
                Sign in with Google, create a room, share the code, and start sending.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 items-start"
            >
              {user ? (
                <>
                  <Button
                    onClick={() => navigate('/connection')}
                    className="h-12 px-8 text-base font-semibold volts-gradient hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                  >
                    Go to Dashboard
                    <ArrowRight className="ml-2 w-4 h-4" />
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
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-xs text-muted-foreground mt-6"
            >
              {user
                ? `Logged in as ${profile?.email || user.email}`
                : 'Sign in to create or join rooms. Your transfer history persists across sessions.'}
            </motion.p>
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

      {/* ═══════════════════════════════════════════
          WHAT IS SWIFT — Purpose Section (for Google branding)
          ═══════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 px-4 sm:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.02] to-background" />
        <div className="max-w-5xl mx-auto relative z-10">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-black uppercase tracking-[0.3em] text-primary/60 mb-4">
                About SWIFT
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                What is <span className="text-primary">SWIFT</span>?
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                SWIFT (<strong>Secure Wideband Instant File Transfer</strong>) is a free, open web application 
                that lets you transfer files of any size directly between devices — without uploading to any cloud server. 
                It uses <strong>WebRTC peer-to-peer technology</strong> to create a direct encrypted connection 
                between the sender and receiver.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: Globe,
                title: 'Works Everywhere',
                desc: 'Runs in any modern browser — Chrome, Firefox, Safari, Edge. No downloads or installations required.',
              },
              {
                icon: Shield,
                title: 'Privacy-First',
                desc: 'Files travel directly between devices. We never see, store, or process your files. Only connection metadata is temporarily stored.',
              },
              {
                icon: Zap,
                title: 'Blazing Fast',
                desc: 'Direct peer-to-peer connections mean maximum speed. No upload-wait-download cycle — files stream in real time.',
              },
            ].map((item, i) => (
              <ScrollReveal key={i} delay={i * 0.12} direction={i === 0 ? 'left' : i === 2 ? 'right' : 'up'}>
                <div className="text-center p-6 rounded-2xl border border-border/30 bg-card/50 hover:border-border/60 hover:bg-card transition-all duration-300 group">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS — Scroll-triggered Steps
          ═══════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 px-4 sm:px-8 relative">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-black uppercase tracking-[0.3em] text-primary/60 mb-4">
                Getting Started
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                How It <span className="text-primary">Works</span>
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Start transferring files in under 30 seconds. No setup, no configuration — just follow these four simple steps.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <StepCard key={i} index={i} {...step} />
            ))}
          </div>

          {/* CTA after steps */}
          <ScrollReveal delay={0.5}>
            <div className="mt-16 text-center">
              {user ? (
                <Button
                  onClick={() => navigate('/connection')}
                  className="h-14 px-10 text-base font-bold volts-gradient hover:opacity-90 transition-all shadow-xl shadow-primary/25 rounded-xl"
                >
                  Start Transferring Now
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              ) : (
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={loading || authLoading}
                  className="h-14 px-10 text-base font-bold volts-gradient hover:opacity-90 transition-all shadow-xl shadow-primary/25 rounded-xl"
                >
                  Get Started — It's Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              )}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SWIFT LETTER SECTIONS (preserved from original)
          ═══════════════════════════════════════════ */}
      {SWIFT_ITEMS.map(({ letter, word, brief, description }, i) => {
        const style = SECTION_STYLES[i];
        const IconComponent = SWIFT_ICON_COMPONENTS[i];
        const isSectionRevealed = revealedSet.has(i);

        return (
          <section
            key={letter}
            ref={setSectionRef(i)}
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

      {/* ═══════════════════════════════════════════
          PRIVACY & TRUST SECTION
          ═══════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 px-4 sm:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.015] to-background" />
        <div className="max-w-5xl mx-auto relative z-10">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block text-xs font-black uppercase tracking-[0.3em] text-primary/60 mb-4">
                Your Privacy Matters
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                Built for <span className="text-primary">Trust</span>
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                SWIFT is designed with privacy as a core principle. Here's exactly how your data is handled.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 gap-6">
            {PRIVACY_FEATURES.map((feature, i) => (
              <ScrollReveal key={i} delay={i * 0.1} direction={i % 2 === 0 ? 'left' : 'right'}>
                <div className="flex gap-5 p-6 rounded-2xl border border-border/30 bg-card/50 hover:border-border/60 hover:bg-card transition-all duration-300 group">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base mb-1.5">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Data usage summary */}
          <ScrollReveal delay={0.4}>
            <div className="mt-12 p-6 sm:p-8 rounded-2xl border border-primary/10 bg-primary/[0.03] text-center">
              <h3 className="font-bold text-lg mb-3">What SWIFT Uses Google Sign-In For</h3>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                SWIFT uses Google Sign-In solely for <strong>authentication</strong> — to identify you to other users in a transfer room. 
                We access only your <strong>name, email, and profile picture</strong> to display your identity during file transfers. 
                We do not access your Google Drive, contacts, calendar, or any other Google services. 
                You can delete your account and all associated data at any time from the landing page.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════ */}
      <footer className="py-12 px-6" style={{ backgroundColor: 'hsl(0 0% 4%)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <span className="text-xl font-bold text-primary">SWIFT</span>
            <span className="text-xs font-mono ml-2" style={{ color: 'hsl(0 0% 50%)' }}>v1.5</span>
            <p className="text-xs mt-1" style={{ color: 'hsl(0 0% 45%)' }}>
              Secure Wideband Instant File Transfer
            </p>
          </div>
          <span className="text-xs" style={{ color: 'hsl(0 0% 40%)' }}>
            No data stored &bull; Peer-to-peer &bull; Ephemeral sessions
          </span>
          <div className="flex items-center gap-6">
            <div className="flex gap-4">
              <Link to="/privacy" className="text-xs hover:text-[#FF3B30] transition-colors" style={{ color: 'hsl(0 0% 40%)' }}>
                Privacy
              </Link>
              <Link to="/terms" className="text-xs hover:text-[#FF3B30] transition-colors" style={{ color: 'hsl(0 0% 40%)' }}>
                Terms
              </Link>
            </div>
            <p className="text-xs" style={{ color: 'hsl(0 0% 35%)' }}>
              &copy; {new Date().getFullYear()} SWIFT. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════
          DELETE ACCOUNT MODAL (preserved from original)
          ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card border border-border/40 rounded-[24px] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-destructive/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-destructive"
                />
              </div>

              <h2 className="text-2xl font-black tracking-tight mb-2">Delete Account?</h2>
              <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                This will permanently remove your profile and active sessions. This action cannot be undone.
              </p>

              <div className="space-y-2 mb-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-destructive/70">
                  To confirm, type <span className="text-destructive">DELETE {profile?.name}</span> below:
                </p>
                <Input
                  placeholder={`DELETE ${profile?.name}`}
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value.toUpperCase())}
                  className="h-12 rounded-xl bg-muted/30 border-border/40 font-mono text-xs uppercase tracking-widest"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-xl font-bold"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmationInput('');
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 h-12 rounded-xl font-bold shadow-lg shadow-destructive/20 disabled:opacity-30"
                  onClick={confirmDeleteAccount}
                  disabled={isDeleting || confirmationInput.toUpperCase() !== `DELETE ${profile?.name?.toUpperCase()}`}
                >
                  {isDeleting ? 'Removing...' : 'Confirm Delete'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
