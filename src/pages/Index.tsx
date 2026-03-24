import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { generateUserId, storeSession } from '@/lib/session';
import { ArrowRight } from 'lucide-react';

import shiftSecure from '@/assets/shift-secure.png';
import shiftHighspeed from '@/assets/shift-highspeed.png';
import shiftInstant from '@/assets/shift-instant.png';
import shiftFiles from '@/assets/shift-files.png';
import shiftTransfer from '@/assets/shift-transfer.png';

const SHIFT_ITEMS = [
  { letter: 'S', word: 'Secure', image: shiftSecure, description: 'End-to-end encrypted peer-to-peer transfers. Your data never touches a server — it goes directly to the recipient.' },
  { letter: 'H', word: 'High-speed', image: shiftHighspeed, description: 'Direct WebRTC connections eliminate middlemen, giving you the fastest possible transfer speeds.' },
  { letter: 'I', word: 'Instant', image: shiftInstant, description: 'No signups, no waiting. Enter your name, create a room, and start transferring in seconds.' },
  { letter: 'F', word: 'Files or Folders', image: shiftFiles, description: 'Send individual files, entire folders compressed as ZIP, or video files — all seamlessly.' },
  { letter: 'T', word: 'Transfer', image: shiftTransfer, description: 'Real-time peer-to-peer delivery with download notifications. Ephemeral sessions — nothing stored permanently.' },
];

function useScrollReveal() {
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
      { threshold: 0.2 }
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
  const sectionRefs = useScrollReveal();

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

      {/* Hero Section — full screen */}
      <section className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
              <span className="text-primary">SHIFT</span>
            </h1>
            <p className="text-base text-muted-foreground">
              Peer-to-peer file transfer. No accounts. No cloud storage.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-center text-base"
              autoFocus
              maxLength={40}
            />
            <Button
              type="submit"
              disabled={!name.trim() || loading}
              className="w-full h-12 text-base font-semibold gap-2"
            >
              {loading ? 'Creating session…' : 'Get Started'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Sessions are ephemeral. Data is never stored permanently.
          </p>

          {/* Scroll indicator */}
          <div className="flex justify-center mt-12 animate-bounce">
            <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* SHIFT Sections — each full screen */}
      {SHIFT_ITEMS.map(({ letter, word, image, description }, i) => (
        <section
          key={letter}
          ref={(el: HTMLDivElement | null) => { sectionRefs.current[i] = el; }}
          className={`scroll-section min-h-screen flex items-center justify-center px-6 sm:px-12 ${
            i % 2 === 0 ? 'bg-background' : 'bg-muted/30'
          }`}
        >
          <div
            className={`w-full max-w-4xl flex flex-col ${
              i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
            } items-center gap-8 md:gap-16`}
          >
            {/* Image */}
            <div className="scroll-image shrink-0">
              <img
                src={image}
                alt={word}
                width={200}
                height={200}
                loading="lazy"
                className="w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 object-contain"
              />
            </div>

            {/* Text */}
            <div className={`scroll-text text-center ${i % 2 === 0 ? 'md:text-left' : 'md:text-right'}`}>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                <span className="text-primary">{letter}</span>
                <span className="text-foreground"> — {word}</span>
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
                {description}
              </p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
