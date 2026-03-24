import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { generateUserId, storeSession } from '@/lib/session';
import { ArrowRight, Shield, Zap, Timer, FolderOpen, ArrowRightLeft } from 'lucide-react';

const SHIFT_ITEMS = [
  { letter: 'S', word: 'Secure', icon: Shield, description: 'End-to-end encrypted peer-to-peer transfers with no data stored on servers' },
  { letter: 'H', word: 'High-speed', icon: Zap, description: 'Direct WebRTC connections for maximum transfer speed without bottlenecks' },
  { letter: 'I', word: 'Instant', icon: Timer, description: 'No signup, no waiting — create a session and start transferring immediately' },
  { letter: 'F', word: 'Files or Folders', icon: FolderOpen, description: 'Transfer individual files, entire folders, or video files seamlessly' },
  { letter: 'T', word: 'Transfer', icon: ArrowRightLeft, description: 'Peer-to-peer delivery with real-time progress and download notifications' },
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

        {/* SHIFT Acronym Cards */}
        <div className="w-full max-w-4xl mt-12 animate-fade-up" style={{ animationDelay: '300ms' }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {SHIFT_ITEMS.map(({ letter, word, icon: Icon, description }) => (
              <div
                key={letter}
                className="border rounded-xl p-4 bg-card hover:border-primary/50 transition-colors text-center flex flex-col items-center gap-2"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="text-xl font-bold text-primary">{letter}</span>
                  <span className="text-sm font-semibold text-foreground ml-0.5">— {word}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
