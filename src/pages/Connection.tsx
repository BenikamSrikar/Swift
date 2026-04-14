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
    <div className="min-h-screen flex flex-col bg-[#050505] text-foreground selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <VoltsNavbar onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12 md:py-20 relative z-10">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-start">
          
          {/* Profile Section (Left Column) */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:w-[320px] flex flex-col items-center lg:items-start shrink-0"
          >
            <div className="relative w-40 h-40 mb-10 group">
              <AvatarParticles />
              <div className="absolute inset-0 rounded-[40px] border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl overflow-hidden z-20 group-hover:border-primary/50 transition-colors duration-500">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover scale-100 group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl font-black bg-gradient-to-br from-primary/20 to-transparent text-primary">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <motion.div 
                className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-[4px] border-[#0a0a0a] z-30 shadow-lg"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            
            <div className="text-center lg:text-left w-full space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">{profile.name}</h1>
              <p className="text-lg text-muted-foreground font-medium mb-6">{profile.email}</p>
              
              <div className="flex items-center gap-2 justify-center lg:justify-start py-6">
                <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-widest font-black text-green-500">Live Session</span>
                </div>
              </div>

              <Button 
                onClick={handleCreateRoom} 
                disabled={creating}
                className="w-full h-14 rounded-2xl text-base font-bold shadow-xl transition-all bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-primary/50 group"
              >
                <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" strokeWidth={1.5} />
                {creating ? 'Initializing...' : 'Host New Room'}
              </Button>
            </div>
          </motion.div>

          {/* Main Content Area (Right Column) */}
          <div className="flex-1 w-full min-w-0">
            <AnimatePresence mode="wait">
              {waitingApproval ? (
                <motion.div 
                  key="waiting"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full aspect-[16/9] lg:aspect-auto lg:h-[500px] bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-[40px] flex flex-col items-center justify-center text-center shadow-2xl p-12"
                >
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-8 relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <Clock className="w-10 h-10 text-primary animate-spin" strokeWidth={1.5} style={{ animationDuration: '4s' }} />
                  </div>
                  <h2 className="text-3xl font-black mb-4 tracking-tighter">Awaiting Host Approval</h2>
                  <p className="text-lg text-muted-foreground mb-10 max-w-sm font-medium leading-relaxed">The host has been notified. We'll connect you as soon as they accept your request.</p>
                  <Button variant="ghost" className="rounded-2xl px-10 h-14 font-bold text-muted-foreground hover:text-white hover:bg-white/5" onClick={() => { 
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full aspect-[16/9] lg:aspect-auto lg:h-[500px] flex flex-col items-center justify-center p-12 bg-white/[0.02] backdrop-blur-3xl border border-white/5 rounded-[40px] shadow-2xl relative overflow-hidden group"
                >
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                  </div>

                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 rotate-6 group-hover:rotate-0 transition-transform duration-500">
                    <LogIn className="w-10 h-10 text-primary" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-3xl font-black mb-4 tracking-tighter">Enter Destination</h2>
                  <p className="text-lg text-muted-foreground text-center mb-10 max-w-md font-medium">
                    Looking for someone? Enter their Google email to establish a secure P2P link.
                  </p>
                  
                  <div className="w-full max-w-lg flex flex-col gap-4">
                    <div className="relative">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                      <Input 
                        placeholder="recipient@gmail.com"
                        value={joinEmail}
                        onChange={(e) => setJoinEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoinByEmail()}
                        className="h-16 pl-14 pr-6 rounded-2xl bg-white/5 border-white/10 focus-visible:ring-primary/30 text-lg font-medium placeholder:text-muted-foreground/30"
                      />
                    </div>
                    <Button 
                      onClick={handleJoinByEmail}
                      disabled={joining}
                      className="h-16 w-full rounded-2xl volts-gradient font-black text-lg shadow-2xl shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      {joining ? 'Searching Network...' : 'Connect to Peer'}
                    </Button>
                  </div>
                  
                  <div className="mt-12 flex items-center gap-3 py-2 px-4 rounded-full bg-white/5 border border-white/10">
                    <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Encrypted Signaling Protocol Active</span>
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


