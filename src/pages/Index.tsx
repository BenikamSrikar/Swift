import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { generateUserId, storeSession } from '@/lib/session';
import { Zap, ArrowRight } from 'lucide-react';

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

      <main className="flex-1 flex items-center justify-center px-4">
        <div
          className="w-full max-w-sm animate-fade-up"
          style={{ animationDelay: '100ms' }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex volts-gradient rounded-2xl p-4 mb-6">
              <Zap className="h-10 w-10 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2 text-balance">
              Verified Optimized Lightweight Transfer System
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
      </main>
    </div>
  );
}
