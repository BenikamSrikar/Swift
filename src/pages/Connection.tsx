import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { getStoredUserId, getStoredUserName, clearSession } from '@/lib/session';
import { Plus, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { generateRoomId } from '@/lib/roomId';

export default function Connection() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [roomInput, setRoomInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);

  const userId = searchParams.get('userId') || getStoredUserId();
  const userName = getStoredUserName();

  useEffect(() => {
    if (!userId || !userName) {
      navigate('/');
    }
  }, [userId, userName, navigate]);

  const handleCreateRoom = async () => {
    if (!userId) return;
    setCreating(true);

    const roomId = generateRoomId();

    const { error } = await supabase.from('rooms').insert({
      room_id: roomId,
      host_id: userId,
      status: 'active',
    });

    if (error) {
      toast.error('Failed to create room');
      console.error(error);
      setCreating(false);
      return;
    }

    // Add host as participant
    await supabase.from('room_participants').insert({
      room_id: roomId,
      user_id: userId,
      status: 'accepted',
    });

    navigate(`/room/${roomId}`);
  };

  const handleJoinRoom = async () => {
    if (!userId || !roomInput.trim()) return;
    setJoining(true);

    // Check room exists
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

    // Check if blocked
    const { data: existing } = await supabase
      .from('room_participants')
      .select('status')
      .eq('room_id', roomInput.trim())
      .eq('user_id', userId)
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

    // Add as pending
    if (!existing) {
      await supabase.from('room_participants').insert({
        room_id: roomInput.trim(),
        user_id: userId,
        status: 'pending',
      });
    }

    // Subscribe to status changes
    setWaitingApproval(true);

    const channel = supabase
      .channel(`join-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_participants',
          filter: `user_id=eq.${userId}`,
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
    if (userId) {
      await supabase.from('sessions').delete().eq('user_id', userId);
      await supabase.from('transfer_history').delete().eq('sender_id', userId);
    }
    clearSession();
    navigate('/');
  };

  const handleHistory = async () => {
    if (!userId) return;

    const { data } = await supabase
      .from('transfer_history')
      .select('*')
      .eq('sender_id', userId)
      .order('transferred_at', { ascending: false });

    if (!data || data.length === 0) {
      toast.info('No transfer history yet');
      return;
    }

    // Generate simple PDF
    const { generateHistoryPdf } = await import('@/lib/pdfExport');
    generateHistoryPdf(userName || 'Unknown', data);
  };

  if (waitingApproval) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={handleHistory} />
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
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={handleHistory} />

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-2xl space-y-6 animate-fade-up">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Logged in as</p>
            <p className="font-semibold text-lg">{userName}</p>
          </div>

          <div className="flex gap-4 items-stretch">
            {/* Create Room */}
            <div className="flex-1 border rounded-xl p-6 bg-card flex flex-col items-center justify-center gap-3">
              <Plus className="h-6 w-6 text-primary" />
              <Button
                onClick={handleCreateRoom}
                disabled={creating}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                {creating ? 'Creating…' : 'Create Room'}
              </Button>
            </div>

            {/* Join Room */}
            <div className="flex-1 border rounded-xl p-6 bg-card flex flex-col items-center justify-center gap-3">
              <LogIn className="h-6 w-6 text-primary" />
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
    </div>
  );
}
