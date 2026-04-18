import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, LogIn, Clock } from 'lucide-react';
import HistoryModal from '@/components/HistoryModal';
import { motion, AnimatePresence } from 'framer-motion';

function AvatarParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
      x: (Math.random() - 0.5) * 80,
      y: (Math.random() - 0.5) * 80,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: 'var(--primary)',
            left: '50%',
            top: '50%',
            filter: 'blur(1px)',
            opacity: 0.6,
          }}
          animate={{
            x: [0, p.x, p.x * 1.1, 0],
            y: [0, p.y, p.y * 1.1, 0],
            scale: [1, 1.1, 0.9, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut"
          }}
        />
      ))}
      {/* Outer glow ring */}
      <motion.div 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10"
        style={{ width: 110, height: 110 }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.05, 0.15, 0.05] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
    </div>
  );
}

export default function Connection() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      navigate('/');
    }
  }, [authLoading, user, profile, navigate]);

  useEffect(() => {
    if (!user || !profile) return;
    const ensureSession = async () => {
      const { data: existing } = await supabase.from('sessions').select('id').eq('user_id', user.id).single();
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
    let roomId = "";
    let isUnique = false;
    
    while (!isUnique) {
      roomId = Array.from({ length: 6 }, () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 36)]).join('');
      const { data: existingRoom } = await supabase.from('rooms').select('id').eq('room_id', roomId).single();
      if (!existingRoom) {
        isUnique = true;
      }
    }

    const { error } = await supabase.from('rooms').insert({ room_id: roomId, host_id: user.id, status: 'active' });
    if (error) { toast.error('Failed to create room'); setCreating(false); return; }

    // Remove any stale participant row before inserting a fresh one
    await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', user.id);
    await supabase.from('room_participants').insert({ room_id: roomId, user_id: user.id, status: 'accepted' });
    navigate(`/room/${roomId}`);
  };

  const handleJoinRoom = async () => {
    const code = roomCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      toast.error('Please enter a valid room code');
      return;
    }
    if (joining) return;
    setJoining(true);
    
    try {
      // Check if room exists and is active
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('room_id, host_id, status')
        .eq('room_id', code)
        .single();

      if (roomError || !roomData) {
        toast.error('Room not found. Check the code and try again.');
        setJoining(false);
        return;
      }

      if (roomData.status !== 'active') {
        toast.error('This room is no longer active');
        setJoining(false);
        return;
      }

      // Check if already a participant
      const { data: existing } = await supabase
        .from('room_participants')
        .select('status')
        .eq('room_id', code)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existing?.status === 'accepted') {
        navigate(`/room/${code}`);
        return;
      }

      if (existing?.status === 'blocked') {
        toast.error('You have been blocked from this room');
        setJoining(false);
        return;
      }
      
      // Clean up any stale entry
      if (existing) {
        await supabase.from('room_participants').delete().eq('room_id', code).eq('user_id', user.id);
      }

      // Insert pending request
      await supabase.from('room_participants').insert({ room_id: code, user_id: user.id, status: 'pending' });
      setWaitingApproval(true);

      // Listen for approval/rejection
      const channel = supabase
        .channel(`join-${user.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_participants',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          if (payload.new.room_id === code) {
            if (payload.new.status === 'accepted') {
              channel.unsubscribe();
              navigate(`/room/${code}`);
            } else if (payload.new.status === 'blocked') {
              channel.unsubscribe();
              toast.error('Your request was rejected by the host');
              setWaitingApproval(false);
              setJoining(false);
            }
          }
        })
        .subscribe();

    } catch (err) {
      console.error('Join error:', err);
      toast.error('Failed to join room');
      setJoining(false);
    }
  };

  const handleCancelRequest = async () => {
    const code = roomCode.trim().toUpperCase();
    if (code) {
      await supabase.from('room_participants').delete().eq('room_id', code).eq('user_id', user.id);
    }
    setWaitingApproval(false);
    setJoining(false);
  };

  const handleLogout = async () => {
    await supabase.from('sessions').delete().eq('user_id', user.id);
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground overflow-hidden">
      <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-y-auto">
        <AnimatePresence mode="wait">
          {waitingApproval ? (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center text-center max-w-md w-full"
            >
              <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="absolute inset-[-8px] rounded-full border-2 border-primary/10 animate-pulse" />
                <Clock className="w-14 h-14 text-primary animate-spin" style={{ animationDuration: '4s' }} />
              </div>
              <h2 className="text-3xl font-black tracking-tight mb-2">Awaiting Approval</h2>
              <p className="text-sm text-muted-foreground mb-2 font-medium">
                Room Code: <span className="font-mono text-primary font-black">{roomCode.toUpperCase()}</span>
              </p>
              <p className="text-sm text-muted-foreground mb-10 max-w-xs font-medium opacity-70">
                Your request has been sent to the host. They will review and grant access shortly.
              </p>
              <Button
                variant="outline"
                className="h-12 rounded-2xl px-10 font-bold border-white/10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 active:scale-95 transition-all"
                onClick={handleCancelRequest}
              >
                Cancel Request
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center text-center max-w-lg w-full"
            >
              {/* Avatar */}
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 mb-6">
                <AvatarParticles />
                <div className="absolute inset-0 rounded-[40px] border-4 border-background shadow-2xl overflow-hidden z-20 bg-muted">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover p-1.5 rounded-[38px]" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl font-black bg-primary text-primary-foreground">
                      {profile.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Name & Status */}
              <h1 className="text-4xl font-black tracking-tighter mb-1">{profile.name}</h1>
              <p className="text-sm text-muted-foreground font-bold opacity-60 mb-2">{profile.email}</p>
              <div className="flex items-center gap-2 mb-10">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] uppercase tracking-widest font-black text-muted-foreground opacity-50">System Online</span>
              </div>

              {/* Action Buttons */}
              <div className="w-full max-w-sm flex flex-col gap-4">
                {/* Create Room */}
                <Button 
                  onClick={handleCreateRoom} 
                  disabled={creating}
                  className="w-full h-14 rounded-2xl text-base font-black volts-gradient shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-95 transition-all group"
                >
                  {creating ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Initializing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                      Create Room
                    </div>
                  )}
                </Button>

                {/* Divider */}
                <div className="flex items-center gap-4 my-1">
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">or join a room</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>

                {/* Join Room */}
                <div className="flex gap-3">
                  <Input
                    placeholder="Enter room code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                    maxLength={6}
                    className="flex-1 h-14 rounded-2xl bg-card/60 backdrop-blur-md border border-border/30 text-center text-lg font-mono font-black tracking-[0.3em] placeholder:tracking-normal placeholder:font-medium placeholder:text-sm focus-visible:ring-primary/30 transition-all uppercase"
                  />
                  <Button
                    onClick={handleJoinRoom}
                    disabled={joining || !roomCode.trim()}
                    variant="outline"
                    className="h-14 px-6 rounded-2xl border-border/30 hover:bg-primary/10 hover:border-primary/30 hover:text-primary active:scale-95 transition-all font-bold group"
                  >
                    {joining ? (
                      <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                    ) : (
                      <LogIn className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} senderEmail={profile.email} senderName={profile.name} />
    </div>
  );
}
