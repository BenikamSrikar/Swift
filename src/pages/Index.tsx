import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { generateUserId, storeSession } from '@/lib/session';
import { ArrowRight } from 'lucide-react';
import ParticleField from '@/components/ParticleField';
import NetworkAnimation from '@/components/NetworkAnimation';

import shiftSecure from '@/assets/shift-secure.png';
import shiftHighspeed from '@/assets/shift-highspeed.png';
import shiftInstant from '@/assets/shift-instant.png';
import shiftFiles from '@/assets/shift-files.png';
import shiftTransfer from '@/assets/shift-transfer.png';

const SHIFT_ITEMS = [
  {
    letter: 'S',
    word: 'Secure',
    image: shiftSecure,
    brief: 'Your privacy is non-negotiable.',
    description:
      "Every transfer in SHIFT is peer-to-peer using WebRTC \u2014 your files never pass through any server. With end-to-end encryption baked into the protocol, only the sender and receiver can access the data. No cloud storage, no logs, no traces. It\u2019s as if the transfer never happened \u2014 except you have the file.",
  },
  {
    letter: 'H',
    word: 'High-speed',
    image: shiftHighspeed,
    brief: 'Direct connections, zero bottlenecks.',
    description:
      'Traditional file sharing uploads to a server, then downloads to the recipient \u2014 doubling the time. SHIFT eliminates the middleman entirely. WebRTC establishes a direct tunnel between devices, meaning your transfer speed is limited only by the network between you and the other person. Large videos, hefty archives \u2014 they move at full throttle.',
  },
  {
    letter: 'I',
    word: 'Instant',
    image: shiftInstant,
    brief: 'Zero friction, zero accounts.',
    description:
      "No sign-ups, no email verification, no passwords to remember. Just type your name and you\u2019re in. Create a room with one click, share a 6-character code, and start transferring. The entire setup takes under 10 seconds. SHIFT is designed for the moments when you need to move a file right now \u2014 not after filling out three forms.",
  },
  {
    letter: 'F',
    word: 'Files & Folders',
    image: shiftFiles,
    brief: 'Send anything \u2014 files, folders, or videos.',
    description:
      "Whether it\u2019s a single document, an entire project folder, or a large video file, SHIFT handles it all. Folders are automatically compressed into ZIP archives before transfer, preserving directory structure. Video files get their own dedicated transfer mode. The recipient gets a download notification with one-click save \u2014 clean and simple.",
  },
  {
    letter: 'T',
    word: 'Transfer',
    image: shiftTransfer,
    brief: 'Ephemeral by design.',
    description:
      "SHIFT sessions are temporary. When you leave, your session data is wiped. There are no lingering files on a server, no account to delete later. Transfer history exists only for the sender during the active session and can be exported as a PDF. Once you log out or close the tab \u2014 it\u2019s gone. This is file transfer distilled to its purest form.",
  },
];

// Progressively darker backgrounds
const SECTION_STYLES = [
  { custom: 'hsl(0 0% 97%)', textColor: 'hsl(0 0% 8%)', mutedColor: 'hsl(0 0% 40%)' },
  { custom: 'hsl(0 0% 82%)', textColor: 'hsl(0 0% 8%)', mutedColor: 'hsl(0 0% 30%)' },
  { custom: 'hsl(0 0% 55%)', textColor: 'hsl(0 0% 5%)', mutedColor: 'hsl(0 0% 20%)' },
  { custom: 'hsl(0 0% 25%)', textColor: 'hsl(0 0% 95%)', mutedColor: 'hsl(0 0% 70%)' },
  { custom: 'hsl(0 0% 8%)', textColor: 'hsl(0 0% 95%)', mutedColor: 'hsl(0 0% 60%)' },
];

function useElasticScrollReveal() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
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

  return refs;
}

export default function Index() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const sectionRefs = useElasticScrollReveal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const userId = generateUserId();

    const { error } = await supabase.from('sessions').insert({
      user_id: userId,
      name: name.trim(),
      status: 'active',
    });

    if (error) {
      console.error('Failed to create session:', error);
      setLoading(false);
      return;
    }

    storeSession(userId, name.trim());
    navigate(`/connection?userId=${userId}`);
  };

  return (
    <div className="bg-background">
      <VoltsNavbar />

      {/* Hero Section with particles */}
      <section className="min-h-screen flex items-center px-4 sm:px-8 lg:px-16 relative overflow-hidden">
        <ParticleField />
        <div className="w-full max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
          {/* Left: text + form */}
          <div className="flex-1 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
              <span className="text-primary">SHIFT</span>
            </h1>
            <p className="text-base lg:text-lg text-muted-foreground leading-relaxed max-w-md mb-8">
              Peer-to-peer file transfer built for speed and privacy. No accounts, no cloud — just a direct connection between you and the recipient.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
              <Input
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 text-base"
                autoFocus
                maxLength={40}
              />
              <Button
                type="submit"
                disabled={!name.trim() || loading}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                {loading ? 'Creating session\u2026' : 'Get Started'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground mt-6">
              Sessions are ephemeral — your data is never stored permanently.
            </p>
          </div>

          {/* Right: network animation — hidden on mobile */}
          <div className="hidden lg:flex flex-1 w-full min-h-[400px] lg:min-h-[500px]">
            <NetworkAnimation />
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce z-10">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </div>
        </div>
      </section>

      {/* SHIFT Sections — elastic scroll reveal, progressively darker */}
      {SHIFT_ITEMS.map(({ letter, word, image, brief, description }, i) => {
        const style = SECTION_STYLES[i];

        return (
          <section
            key={letter}
            ref={(el: HTMLDivElement | null) => { sectionRefs.current[i] = el; }}
            className="scroll-section min-h-screen flex items-center justify-center px-6 sm:px-12"
            style={{ backgroundColor: style.custom }}
          >
            <div
              className={`w-full max-w-5xl flex flex-col ${
                i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
              } items-center gap-10 md:gap-20`}
            >
              <div className="scroll-image shrink-0">
                <img
                  src={image}
                  alt={word}
                  width={240}
                  height={240}
                  loading="lazy"
                  className="w-40 h-40 sm:w-52 sm:h-52 md:w-60 md:h-60 object-contain drop-shadow-lg"
                />
              </div>

              <div className={`scroll-text text-center ${i % 2 === 0 ? 'md:text-left' : 'md:text-right'} max-w-xl`}>
                <h2
                  className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3"
                  style={{ color: style.textColor }}
                >
                  <span className="text-primary">{letter}</span>
                  <span> — {word}</span>
                </h2>
                <p
                  className="text-lg sm:text-xl font-semibold mb-4"
                  style={{ color: style.textColor }}
                >
                  {brief}
                </p>
                <p
                  className="text-sm sm:text-base leading-relaxed"
                  style={{ color: style.mutedColor }}
                >
                  {description}
                </p>
              </div>
            </div>
          </section>
        );
      })}

      {/* Footer */}
      <footer className="py-12 px-6" style={{ backgroundColor: 'hsl(0 0% 4%)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <span className="text-xl font-bold text-primary">SHIFT</span>
            <span className="text-xs font-mono ml-2" style={{ color: 'hsl(0 0% 50%)' }}>v1.0</span>
            <p className="text-xs mt-1" style={{ color: 'hsl(0 0% 45%)' }}>
              Secure High-speed Instant File Transfer
            </p>
          </div>
          <span className="text-xs" style={{ color: 'hsl(0 0% 40%)' }}>
            No data stored &bull; Peer-to-peer &bull; Ephemeral sessions
          </span>
          <p className="text-xs" style={{ color: 'hsl(0 0% 35%)' }}>
            &copy; {new Date().getFullYear()} SHIFT. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
