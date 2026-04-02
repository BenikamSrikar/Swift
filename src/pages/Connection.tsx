import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { generateRoomId } from '@/lib/roomId';
import HistoryModal from '@/components/HistoryModal';
import ConnectionFeatures from '@/components/ConnectionFeatures';

export default function Connection() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [roomInput, setRoomInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      navigate('/');
    }
  }, [authLoading, user, profile, navigate]);

  // Ensure session exists for room presence
  useEffect(() => {
    if (!user || !profile) return;
    const ensureSession = async () => {
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!existing) {
        await supabase.from('sessions').insert({
          user_id: user.id,
          name: profile.name,
          status: 'active',
        });
      }
    };
    ensureSession();
  }, [user, profile]);

  if (authLoading || !user || !profile) return null;

  const handleCreateRoom = async () => {
    setCreating(true);
    const roomId = generateRoomId();

    const { error } = await supabase.from('rooms').insert({
      room_id: roomId,
      host_id: user.id,
      status: 'active',
    });

    if (error) {
      toast.error('Failed to create room');
      console.error(error);
      setCreating(false);
      return;
    }

    await supabase.from('room_participants').insert({
      room_id: roomId,
      user_id: user.id,
      status: 'accepted',
    });

    navigate(`/room/${roomId}`);
  };

  const handleJoinRoom = async () => {
    if (!roomInput.trim()) return;
    setJoining(true);

    const { data: room } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', roomInput.trim())
      .single();

    if (!room) {
      toast.error('Room not found');
      setJoining(false);
      return;
    }

    if (room.status === 'locked') {
      toast.error('Room is locked — host has left');
      setJoining(false);
      return;
    }

    const { data: existing } = await supabase
      .from('room_participants')
      .select('status')
      .eq('room_id', roomInput.trim())
      .eq('user_id', user.id)
      .single();

    if (existing?.status === 'blocked') {
      toast.error('You have been blocked from this room');
      setJoining(false);
      return;
    }

    if (existing?.status === 'accepted') {
      navigate(`/room/${roomInput.trim()}`);
      return;
    }

    if (!existing) {
      await supabase.from('room_participants').insert({
        room_id: roomInput.trim(),
        user_id: user.id,
        status: 'pending',
      });
    }

    setWaitingApproval(true);

    const channel = supabase
      .channel(`join-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_participants',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          if (newStatus === 'accepted') {
            channel.unsubscribe();
            navigate(`/room/${roomInput.trim()}`);
          } else if (newStatus === 'blocked') {
            channel.unsubscribe();
            toast.error('Your request was rejected');
            setWaitingApproval(false);
            setJoining(false);
          }
        }
      )
      .subscribe();
  };

  const handleLogout = async () => {
    await supabase.from('sessions').delete().eq('user_id', user.id);
    await signOut();
    navigate('/');
  };

  if (waitingApproval) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center animate-fade-up">
            <div className="relative inline-block mb-6">
              <div className="w-16 h-16 rounded-full volts-gradient" />
              <div className="absolute inset-0 w-16 h-16 rounded-full volts-gradient animate-pulse-ring" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Waiting for approval</h2>
            <p className="text-sm text-muted-foreground mb-6">
              The host needs to accept your request to join
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setWaitingApproval(false);
                setJoining(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </main>
        <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} senderEmail={profile.email} senderName={profile.name} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-2xl space-y-6 animate-fade-up">
          <div className="text-center flex flex-col items-center gap-2">
            {profile.avatar_url && (
              <img src={profile.avatar_url} alt={profile.name} className="w-12 h-12 rounded-full" />
            )}
            <div>
              <p className="font-semibold text-lg">{profile.name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-stretch">
            <div className="flex-1 border rounded-xl p-6 bg-card flex flex-col items-center justify-center gap-3">
              <Plus className="h-6 w-6 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Start a new room</p>
              <Button
                onClick={handleCreateRoom}
                disabled={creating}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                {creating ? 'Creating…' : 'Create Room'}
              </Button>
            </div>

            <div className="hidden sm:flex items-center">
              <span className="text-xs text-muted-foreground font-medium">OR</span>
            </div>
            <div className="flex sm:hidden items-center justify-center">
              <span className="text-xs text-muted-foreground font-medium">— OR —</span>
            </div>

            <div className="flex-1 border rounded-xl p-6 bg-card flex flex-col items-center justify-center gap-3">
              <LogIn className="h-6 w-6 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Join with Room ID</p>
              <div className="flex gap-2 w-full">
                <Input
                  placeholder="e.g. A1B2C3"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value.toUpperCase().slice(0, 6))}
                  className="h-12 font-mono text-sm uppercase tracking-widest"
                  maxLength={6}
                />
                <Button
                  onClick={handleJoinRoom}
                  disabled={!roomInput.trim() || joining}
                  variant="outline"
                  className="h-12 px-6 shrink-0"
                >
                  Join
                </Button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Create a room or enter a 6-character Room ID to join.
          </p>
        </div>
      </main>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} senderEmail={profile.email} senderName={profile.name} />
    </div>
  );
}
