import { useState } from 'react';
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

export default function Index() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    <div className="min-h-screen flex flex-col bg-background">
      <VoltsNavbar />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              <span className="text-primary">SHIFT</span>
            </h1>
            <p className="text-sm text-muted-foreground">
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
        </div>

        {/* SHIFT Acronym Sections */}
        <div className="w-full max-w-3xl mt-16 space-y-10 animate-fade-up" style={{ animationDelay: '300ms' }}>
          {SHIFT_ITEMS.map(({ letter, word, image, description }, i) => (
            <div
              key={letter}
              className={`flex flex-col sm:flex-row items-center gap-6 ${i % 2 !== 0 ? 'sm:flex-row-reverse' : ''}`}
            >
              <img
                src={image}
                alt={word}
                width={120}
                height={120}
                loading="lazy"
                className="shrink-0"
              />
              <div className={`text-center sm:text-left ${i % 2 !== 0 ? 'sm:text-right' : ''}`}>
                <h2 className="text-xl font-bold mb-1">
                  <span className="text-primary">{letter}</span> — {word}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
