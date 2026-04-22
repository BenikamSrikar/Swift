import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, LogIn, Clock, Search } from 'lucide-react';
import HistoryModal from '@/components/HistoryModal';
import ConnectionFeatures from '@/components/ConnectionFeatures';
import { motion, AnimatePresence } from 'framer-motion';

function AvatarParticles({ color = "var(--primary)" }: { color?: string }) {
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
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleRoomCodeChange = async (val: string) => {
    setRoomCode(val);
    if (val.length === 6) {
      handleJoinRoom(val);
    }
  };

  const handleJoinRoom = async (rid: string) => {
    if (!rid.trim()) return;
    setJoining(true);
    
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', rid)
      .maybeSingle();

    if (!room) { 
      toast.error('Invalid Room ID'); 
      setRoomCode(''); 
      setJoining(false); 
      return; 
    }

    if (room.status === 'locked') { 
      toast.error('Room is locked'); 
      setJoining(false); 
      return; 
    }

    // Get host info separately for robustness
    const { data: hostProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('auth_user_id', room.host_id)
      .maybeSingle();

    const { data: existing } = await supabase
      .from('room_participants')
      .select('status')
      .eq('room_id', rid)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing?.status === 'blocked') { 
      toast.error('You are blocked from this room'); 
      setJoining(false); 
      return; 
    }

    // Remove any previous stale row before re-joining
    if (existing) {
      await supabase.from('room_participants').delete().eq('room_id', rid).eq('user_id', user.id);
    }

    await supabase.from('room_participants').insert({ 
      room_id: rid, 
      user_id: user.id, 
      status: 'pending' 
    });

    setWaitingApproval(true);
    const hostName = hostProfile?.name || 'The host';

    const channel = supabase.channel(`join-${user.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'room_participants', 
        filter: `user_id=eq.${user.id}` 
      }, (payload) => {
        if (payload.new.status === 'accepted') { 
          channel.unsubscribe(); 
          navigate(`/room/${rid}`); 
        }
        else if (payload.new.status === 'blocked') { 
          channel.unsubscribe(); 
          toast.error(`${hostName} declined your request.`); 
          setWaitingApproval(false); 
          setJoining(false); 
        }
      }).subscribe();
  };

  const handleLogout = async () => {
    await supabase.from('sessions').delete().eq('user_id', user.id);
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground overflow-hidden">
      <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative">
        <div className="w-full max-w-4xl flex flex-col items-center z-10">
          
          {/* Profile Section */}
          <div className="relative mb-6 flex flex-col items-center animate-fade-up">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-3">
              <AvatarParticles />
              <div className="absolute inset-0 rounded-full border-4 border-background shadow-2xl overflow-hidden z-20 bg-muted">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover p-1 rounded-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl font-bold bg-primary text-primary-foreground">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <motion.div 
                className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-background z-30"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="text-center"
            >
              <h1 className="text-2xl font-bold tracking-tight mb-0.5">{profile.name}</h1>
              <p className="text-xs text-muted-foreground font-medium opacity-70 mb-1.5">{profile.email}</p>
              <div className="flex items-center gap-2 justify-center">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Session Active</span>
              </div>
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            {waitingApproval ? (
              <motion.div 
                key="waiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-10 flex flex-col items-center text-center shadow-2xl"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  <Clock className="w-8 h-8 text-primary animate-spin" style={{ animationDuration: '4s' }} />
                </div>
                <h2 className="text-xl font-bold mb-2">Awaiting Host</h2>
                <p className="text-sm text-muted-foreground mb-8">The host needs to approve your connection request before you can start transferring.</p>
                <Button variant="outline" className="rounded-full px-8" onClick={() => { setWaitingApproval(false); setJoining(false); }}>
                  Cancel Request
                </Button>
              </motion.div>
            ) : (
              <motion.div 
                key="actions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {/* Create Card */}
                <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-6 flex flex-col items-center gap-4 group hover:border-primary/30 transition-all duration-500 active:scale-[0.98]">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-base mb-0.5">Host a Room</h3>
                    <p className="text-[10px] text-muted-foreground">Start your own room and invite others using your code.</p>
                  </div>
                  <Button 
                    onClick={handleCreateRoom} 
                    disabled={creating}
                    className="w-full h-12 rounded-xl text-sm font-bold volts-gradient shadow-xl shadow-primary/20 hover:shadow-primary/30 active:translate-y-0.5 transition-all"
                  >
                    {creating ? 'Starting Session...' : 'Create Room'}
                  </Button>
                </div>

                {/* Join Card */}
                <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-6 flex flex-col items-center gap-6 group hover:border-primary/30 transition-all duration-500">
                  <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center group-hover:bg-secondary/30 transition-colors">
                    <LogIn className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-base mb-1">Join a Room</h3>
                    <p className="text-xs text-muted-foreground max-w-[200px]">Enter the 6-character room code shared by the host.</p>
                  </div>
                  
                  <div className="w-full space-y-4">
                    <div className="relative">
                      <Input 
                        placeholder="ROOM ID" 
                        value={roomCode}
                        onChange={(e) => handleRoomCodeChange(e.target.value.toUpperCase())}
                        disabled={joining}
                        className="h-14 rounded-xl text-center font-mono text-xl tracking-[0.2em] bg-muted/30 border-border/50 focus-visible:ring-primary/50 placeholder:tracking-normal placeholder:text-sm placeholder:font-sans"
                        maxLength={6}
                      />
                      {joining && !waitingApproval && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-center text-muted-foreground opacity-60">
                      Auto-connects once valid code is entered.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} senderEmail={profile.email} senderName={profile.name} />
    </div>
  );
}

