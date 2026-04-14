import { useState, useEffect, useMemo, useRef } from 'react';
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
            opacity: 0.3,
          }}
          animate={{
            x: [0, p.x, p.x * 1.1, 0],
            y: [0, p.y, p.y * 1.1, 0],
            scale: [1, 1.1, 0.9, 1],
            opacity: [0.3, 0.5, 0.3],
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
        style={{ width: '120%', height: '120%' }}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [joinEmail, setJoinEmail] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      navigate('/');
    }
  }, [authLoading, user, profile, navigate]);

  useEffect(() => {
    if (!user || !profile) return;
    const ensureSession = async () => {
      // 1. Atomic session update to 'online' status
      await supabase.from('sessions').upsert({
        user_id: user.id,
        name: profile.name,
        status: 'online',
      }, { onConflict: 'user_id' });

      // 2. Proactive Cleanup of any stale room state for THIS user
      await supabase.from('room_participants').delete().eq('user_id', user.id);
      await supabase.from('rooms').update({ status: 'locked' }).eq('host_id', user.id).eq('status', 'active');
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

  const handleJoinByEmail = async () => {
    if (!joinEmail.trim() || !joinEmail.includes('@')) {
      toast.error('Please enter a valid host email');
      return;
    }
    setJoining(true);

    // 1. Find the host profile
    const { data: hostProfile, error: profileError } = await supabase
      .from('profiles')
      .select('auth_user_id, name')
      .eq('email', joinEmail.trim().toLowerCase())
      .single();

    if (profileError || !hostProfile) {
      toast.error('No user found with this email');
      setJoining(false);
      return;
    }

    // 2. Find an active room they are hosting
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('room_id')
      .eq('host_id', hostProfile.auth_user_id)
      .eq('status', 'active')
      .single();

    if (roomError || !room) {
      toast.error('No active room found for this host');
      setJoining(false);
      return;
    }

    const rid = room.room_id;
    const hostName = hostProfile.name;

    // 3. Check for existing blocked status
    const { data: existing } = await supabase.from('room_participants').select('status').eq('room_id', rid).eq('user_id', user.id).single();
    if (existing?.status === 'blocked') { toast.error('You are blocked from this room'); setJoining(false); return; }
    
    // 4. Send Request
    if (existing) {
      await supabase.from('room_participants').delete().eq('room_id', rid).eq('user_id', user.id);
    }
    await supabase.from('room_participants').insert({ room_id: rid, user_id: user.id, status: 'pending' });
    
    setWaitingApproval(true);
    const checkApproval = async () => {
      const { data } = await supabase.from('room_participants').select('status').eq('room_id', rid).eq('user_id', user.id).single();
      if (data?.status === 'accepted') {
        channel.unsubscribe();
        clearInterval(joinPoller);
        navigate(`/room/${rid}`);
      } else if (data?.status === 'blocked') {
        channel.unsubscribe();
        clearInterval(joinPoller);
        toast.error(`${hostName} declined your join request.`);
        setWaitingApproval(false);
        setJoining(false);
      }
    };

    const joinPoller = setInterval(checkApproval, 3000);
    const channel = supabase.channel(`join-${user.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_participants' }, (payload) => {
      if (payload.new?.user_id === user.id) {
        checkApproval();
      }
    }).subscribe();

    (window as any)._joinPoller = joinPoller;
  };

  const handleLogout = async () => {
    await supabase.from('sessions').delete().eq('user_id', user.id);
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground overflow-hidden">
      <VoltsNavbar onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-8 md:py-12 relative">
        <div className="flex flex-col md:flex-row gap-8 lg:gap-16 w-full z-10 relative">
          
          {/* Profile Section (Left Column) */}
          <div className="w-full md:w-[280px] lg:w-[320px] flex flex-col items-center md:items-start shrink-0 animate-fade-in-up">
            <div className="relative w-32 h-32 mb-8">
              <AvatarParticles />
              <div className="absolute inset-0 rounded-full border border-border bg-card shadow-lg overflow-hidden z-20">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl font-bold bg-primary/10 text-primary">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <motion.div 
                className="absolute bottom-1 right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-background z-30 shadow-sm"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            
            <motion.div 
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }} 
              className="text-center md:text-left w-full"
            >
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">{profile.name}</h1>
              <p className="text-base sm:text-lg text-muted-foreground mb-4">{profile.email}</p>
              
              <div className="flex items-center gap-2 justify-center md:justify-start mb-6">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Session Active</span>
              </div>

              {/* Host a Room Button acting like Edit Profile */}
              <Button 
                onClick={handleCreateRoom} 
                disabled={creating}
                className="w-full h-11 rounded-lg text-sm font-bold shadow-sm transition-all bg-secondary hover:bg-secondary/80 text-foreground border border-border hover:border-primary/50"
              >
                {creating ? 'Creating...' : 'Create Room'}
              </Button>
            </motion.div>
          </div>

          {/* Main Content Area (Right Column) */}
          <div className="flex-1 w-full flex flex-col min-w-0">
            <AnimatePresence mode="wait">
              {waitingApproval ? (
                <motion.div 
                  key="waiting"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="w-full bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-10 flex flex-col items-center text-center shadow-lg my-auto"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <Clock className="w-8 h-8 text-primary animate-spin" style={{ animationDuration: '4s' }} />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Awaiting Host</h2>
                  <p className="text-sm text-muted-foreground mb-8 max-w-sm">The host needs to approve your connection request before you can start transferring.</p>
                  <Button variant="outline" className="rounded-full px-8" onClick={() => { 
                    setWaitingApproval(false); 
                    setJoining(false); 
                    if ((window as any)._joinPoller) clearInterval((window as any)._joinPoller);
                  }}>
                    Cancel Request
                  </Button>
                </motion.div>
              ) : (
                <motion.div 
                  key="join-email"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full h-full flex flex-col items-center justify-center p-8 bg-card border border-border/60 rounded-2xl shadow-sm"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-6">
                    <LogIn className="w-8 h-8 text-primary/40" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Connect to Peer</h2>
                  <p className="text-sm text-muted-foreground text-center mb-8 max-w-sm">
                    Enter the Google email address of the host you would like to connect with.
                  </p>
                  
                  <div className="w-full max-w-md flex flex-col gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="host@gmail.com"
                        value={joinEmail}
                        onChange={(e) => setJoinEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoinByEmail()}
                        className="h-12 pl-10 rounded-xl bg-background border-border/50 focus-visible:ring-primary/30"
                      />
                    </div>
                    <Button 
                      onClick={handleJoinByEmail}
                      disabled={joining}
                      className="h-12 w-full rounded-xl volts-gradient font-bold text-base shadow-lg shadow-primary/20"
                    >
                      {joining ? 'Searching...' : 'Request to Join'}
                    </Button>
                  </div>
                  
                  <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Secure P2P Signaling Active
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>


      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} senderEmail={profile.email} senderName={profile.name} />
    </div>
  );
}


