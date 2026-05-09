import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, LogIn, Clock, Search, Users, X, User } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [hostedRooms, setHostedRooms] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      navigate('/');
    }
  }, [authLoading, user, profile, navigate]);

  const fetchData = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      // 1. Fetch all profiles
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });
      
      if (pError) throw pError;
      setAllProfiles(profiles || []);

      // 2. Fetch active rooms to know who is hosting
      const { data: rooms, error: rError } = await supabase
        .from('rooms')
        .select('*')
        .eq('status', 'active');
      
      if (rError) throw rError;

      if (rooms && rooms.length > 0) {
        const roomIds = rooms.map(r => r.id);
        const { data: participants } = await supabase
          .from('room_participants')
          .select('room_id, user_id')
          .in('room_id', roomIds);

        // Only count rooms where the host is actually present
        const liveRooms = rooms.filter(room => {
          const roomParts = participants?.filter(p => p.room_id === room.id) || [];
          return roomParts.some(p => p.user_id === room.host_id);
        });
        setHostedRooms(liveRooms);
      } else {
        setHostedRooms([]);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!user || !profile) return;
    fetchData();

    const channel = supabase.channel('public:sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, profile]);

  const filteredProfiles = useMemo(() => {
    return allProfiles.filter(p => {
      const search = searchQuery.toLowerCase();
      const name = p.name?.toLowerCase() || '';
      const email = p.email?.toLowerCase() || '';
      return (name.includes(search) || email.includes(search)) && p.auth_user_id !== user?.id;
    });
  }, [allProfiles, searchQuery, user]);

  const handleCreateRoom = async () => {
    setCreating(true);
    let roomId = "";
    let isUnique = false;
    
    while (!isUnique) {
      roomId = Array.from({ length: 6 }, () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 36)]).join('');
      const { data: existingRoom } = await supabase.from('rooms').select('id').eq('room_id', roomId).single();
      if (!existingRoom) isUnique = true;
    }

    const { data: newRoom, error: createError } = await supabase
      .from('rooms')
      .insert({ room_id: roomId, host_id: user.id, status: 'active' })
      .select('id')
      .single();

    if (createError || !newRoom) { 
      toast.error('Failed to create room'); 
      setCreating(false); 
      return; 
    }

    await supabase.from('room_participants').delete().eq('room_id', newRoom.id).eq('user_id', user.id);
    await supabase.from('room_participants').insert({ room_id: newRoom.id, user_id: user.id, status: 'accepted' });
    navigate(`/room/${roomId}`);
  };

  const handleJoinHost = async (hostId: string) => {
    const activeRoom = hostedRooms.find(r => r.host_id === hostId);
    if (!activeRoom) return;

    setJoining(true);
    const rid = activeRoom.room_id;

    const { data: existing } = await supabase
      .from('room_participants')
      .select('status')
      .eq('room_id', activeRoom.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing?.status === 'blocked') { 
      toast.error('You are blocked from this room'); 
      setJoining(false); 
      return; 
    }

    await supabase.from('room_participants').delete().eq('room_id', activeRoom.id).eq('user_id', user.id);
    await supabase.from('room_participants').insert({ 
      room_id: activeRoom.id, 
      user_id: user.id, 
      status: 'pending' 
    });

    setWaitingApproval(true);
    
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
          toast.error(`The host declined your request.`); 
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

  const ProfileCard = ({ p, isLive }: { p: any, isLive: boolean }) => (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-4 flex flex-col gap-4 hover:border-primary/50 transition-all group hover:bg-card/60 shadow-lg relative overflow-hidden"
    >
      {isLive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[8px] font-black uppercase tracking-widest text-red-500">Live</span>
        </div>
      )}
      
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 shrink-0">
          {p.avatar_url ? (
            <img src={p.avatar_url} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-base font-black text-primary">{p.name?.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black truncate tracking-tight">{p.name}</p>
          <p className="text-[10px] font-medium text-muted-foreground truncate opacity-70">{p.email}</p>
        </div>
      </div>

      <Button 
        size="sm" 
        onClick={() => handleJoinHost(p.auth_user_id)}
        disabled={!isLive || joining}
        className={`h-9 w-full rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
          isLive 
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 active:scale-[0.98]' 
            : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
        }`}
      >
        {isLive ? 'Join Session' : 'Offline'}
      </Button>
    </motion.div>
  );

  if (authLoading || !user || !profile) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground overflow-hidden">
      <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />

      <main className="flex-1 flex flex-col items-center justify-start lg:justify-center p-4 sm:p-6 lg:p-8 relative overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-5xl flex flex-col items-center z-10 pt-8 lg:pt-0">
          
          {/* Hero Profile Section (Hidden on mobile to save space if needed, but keeping for identity) */}
          <div className="relative mb-8 flex flex-col items-center animate-fade-up">
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
            <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
            <p className="text-xs text-muted-foreground font-medium opacity-70">{profile.email}</p>
          </div>

          <AnimatePresence mode="wait">
            {waitingApproval ? (
              <motion.div 
                key="waiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md mx-auto bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-10 flex flex-col items-center text-center shadow-2xl"
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
            ) : isMobile ? (
              /* Mobile View: Profiles List + Floating Action */
              <motion.div 
                key="mobile-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full flex flex-col gap-6"
              >
                <div className="flex flex-col gap-4">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      placeholder="Search host by name or email..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-12 pl-10 pr-4 rounded-2xl bg-muted/30 border-border/40 focus:bg-background/50 focus:border-primary/50 transition-all text-sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredProfiles.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-muted-foreground text-sm font-medium">
                        No profiles found matching "{searchQuery}"
                      </div>
                    ) : (
                      filteredProfiles.map(p => (
                        <ProfileCard 
                          key={p.auth_user_id} 
                          p={p} 
                          isLive={hostedRooms.some(r => r.host_id === p.auth_user_id)} 
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Floating Action Button for Mobile */}
                <Button
                  onClick={handleCreateRoom}
                  disabled={creating}
                  className="fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-2xl shadow-primary/40 volts-gradient flex items-center justify-center active:scale-90 transition-all z-50"
                >
                  {creating ? <Clock className="animate-spin" /> : <Plus className="w-7 h-7" />}
                </Button>
              </motion.div>
            ) : (
              /* Desktop View: Two Main Action Cards */
              <motion.div 
                key="desktop-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full flex flex-row gap-8 items-stretch justify-center"
              >
                {/* Host Card */}
                <div className="flex-1 max-w-sm bg-card/40 backdrop-blur-md border border-border/40 rounded-3xl p-8 flex flex-col items-center gap-6 group hover:border-primary/30 transition-all duration-500 shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 blur-[100px] rounded-full" />
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-colors relative z-10">
                    <Plus className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center relative z-10">
                    <h3 className="font-black text-2xl mb-2 tracking-tight">Host a Session</h3>
                    <p className="text-xs text-muted-foreground font-medium max-w-[240px] mx-auto leading-relaxed">
                      Create a secure workspace and start sharing files in real-time.
                    </p>
                  </div>
                  <Button 
                    onClick={handleCreateRoom} 
                    disabled={creating}
                    className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-widest volts-gradient shadow-xl shadow-primary/20 hover:shadow-primary/30 active:translate-y-0.5 transition-all mt-auto"
                  >
                    {creating ? 'Initializing...' : 'Create Room'}
                  </Button>
                </div>

                {/* Join Card */}
                <div className="flex-1 max-w-sm bg-card/40 backdrop-blur-md border border-border/40 rounded-3xl p-8 flex flex-col items-center gap-6 group hover:border-red-500/30 transition-all duration-500 shadow-2xl relative overflow-hidden">
                  <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-red-500/10 blur-[100px] rounded-full" />
                  <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center group-hover:bg-red-500/20 transition-colors relative z-10">
                    <LogIn className="h-8 w-8 text-red-500" />
                  </div>
                  <div className="text-center relative z-10">
                    <h3 className="font-black text-2xl mb-2 tracking-tight">Join a Room</h3>
                    <p className="text-xs text-muted-foreground font-medium max-w-[240px] mx-auto leading-relaxed">
                      Discover active hosts and connect to their ongoing sessions.
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsJoinModalOpen(true)}
                    className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-widest bg-red-500 hover:bg-red-600 text-white shadow-xl shadow-red-500/20 hover:shadow-red-500/30 active:translate-y-0.5 transition-all mt-auto"
                  >
                    Find Hosts
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Desktop Join Modal */}
      <AnimatePresence>
        {isJoinModalOpen && !isMobile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsJoinModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl bg-card border border-border/50 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-border/40 flex items-center justify-between bg-muted/10">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Discover Hosts</h2>
                  <p className="text-xs text-muted-foreground font-medium">Join an active session from the list below</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsJoinModalOpen(false)}
                  className="rounded-full hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-8 pb-4">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Search by name or email address..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 pl-12 pr-4 rounded-2xl bg-muted/30 border-border/40 focus:bg-background/50 focus:border-primary/50 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-0 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  {loadingData ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-32 rounded-2xl bg-muted/20 animate-pulse" />
                    ))
                  ) : filteredProfiles.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
                        <User className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm font-bold text-muted-foreground">No users found matching your search</p>
                    </div>
                  ) : (
                    filteredProfiles.map(p => (
                      <ProfileCard 
                        key={p.auth_user_id} 
                        p={p} 
                        isLive={hostedRooms.some(r => r.host_id === p.auth_user_id)} 
                      />
                    ))
                  )}
                </div>
              </div>
              
              <div className="p-6 bg-muted/10 border-t border-border/40 text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Live sessions are marked with a pulsing indicator
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} senderEmail={profile.email} senderName={profile.name} />
    </div>
  );
}
