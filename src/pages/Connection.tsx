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
        const roomCodes = rooms.map(r => r.room_id);
        const { data: participants } = await supabase
          .from('room_participants')
          .select('room_id, user_id')
          .in('room_id', roomCodes);

        // Only count rooms where the host is actually present
        const liveRooms = rooms.filter(room => {
          const roomParts = participants?.filter(p => p.room_id === room.room_id) || [];
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

    await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', user.id);
    await supabase.from('room_participants').insert({ room_id: roomId, user_id: user.id, status: 'accepted' });
    navigate(`/room/${roomId}`);
  };

  const handleJoinHost = async (hostId: string) => {
    setJoining(true);

    // Check if this user has an active room
    const activeRoom = hostedRooms.find(r => r.host_id === hostId);

    if (!activeRoom) {
      // No active room — show waiting, timeout after 10s
      setWaitingApproval(true);
      setTimeout(() => {
        toast.error('This user has not created a room yet. Please try again later.', { duration: 4000 });
        setWaitingApproval(false);
        setJoining(false);
      }, 10000);
      return;
    }

    const rid = activeRoom.room_id;

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

    await supabase.from('room_participants').delete().eq('room_id', rid).eq('user_id', user.id);
    const { error: insError } = await supabase.from('room_participants').insert({ 
      room_id: rid, 
      user_id: user.id, 
      status: 'pending' 
    });

    if (insError) {
      console.error('Join insert error:', insError);
      toast.error('Failed to send join request. Please try again.');
      setJoining(false);
      return;
    }

    setWaitingApproval(true);

    // 10-second timeout — if host doesn't respond, redirect back
    const timeout = setTimeout(() => {
      channel.unsubscribe();
      toast.error('Host did not respond. Redirecting...', { duration: 3000 });
      supabase.from('room_participants').delete().eq('room_id', rid).eq('user_id', user.id).then(() => {});
      setWaitingApproval(false);
      setJoining(false);
    }, 10000);
    
    const channel = supabase.channel(`join-${user.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'room_participants', 
        filter: `user_id=eq.${user.id}` 
      }, (payload) => {
        if (payload.new.status === 'accepted') { 
          clearTimeout(timeout);
          channel.unsubscribe(); 
          navigate(`/room/${rid}`); 
        }
        else if (payload.new.status === 'blocked') { 
          clearTimeout(timeout);
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
                      <input 
                        placeholder="Search host name or email..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 pl-12 pr-4 rounded-2xl text-base font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.1)' }}
                      />
                  </div>
                </div>

                {searchQuery && (
                  <div className="flex-1 overflow-y-auto px-6 pb-24 custom-scrollbar">
                    <div className="flex flex-col gap-2">
                      {filteredProfiles.length === 0 ? (
                        <div className="py-12 text-center text-white/50 font-medium">
                          No host found
                        </div>
                      ) : (
                        filteredProfiles.map(p => (
                          <button
                            key={p.auth_user_id}
                            onClick={() => {
                              setSearchQuery('');
                              handleJoinHost(p.auth_user_id);
                            }}
                            disabled={joining}
                            className="w-full flex items-center gap-4 p-3 rounded-[16px] hover:bg-white/10 active:scale-[0.98] transition-all text-left disabled:opacity-50"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.05)' }}
                          >
                            <div className="h-12 w-12 rounded-[12px] bg-[#FF3B30]/20 flex items-center justify-center shrink-0" style={{ boxShadow: '0 0 0 0.5px rgba(255,59,48,0.2) inset' }}>
                              {p.avatar_url ? (
                                <img src={p.avatar_url} alt={p.name} className="h-full w-full rounded-[12px] object-cover" />
                              ) : (
                                <span className="text-lg font-bold text-[#FF3B30]">{p.name?.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-semibold text-foreground truncate">{p.name}</p>
                              <p className="text-sm text-muted-foreground truncate">{p.email}</p>
                            </div>
                            <div className="px-4 py-2 rounded-[10px] bg-[#FF3B30] text-white text-xs font-bold">
                              Join
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

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
                <div className="flex-1 max-w-sm rounded-[22px] p-8 flex flex-col items-center gap-6 group transition-all duration-300 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', border: '0.5px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.15), 0 0 0 0.5px rgba(255,255,255,0.04) inset' }}>
                  <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF3B30]/8 blur-[100px] rounded-full" />
                  <div className="w-14 h-14 bg-[#FF3B30]/10 rounded-[16px] flex items-center justify-center transition-colors relative z-10" style={{ boxShadow: '0 0 0 0.5px rgba(255,59,48,0.15) inset' }}>
                    <Plus className="h-7 w-7 text-[#FF3B30]" />
                  </div>
                  <div className="text-center relative z-10">
                    <h3 className="font-semibold text-xl mb-1.5 tracking-tight">Host a Session</h3>
                    <p className="text-[13px] text-muted-foreground font-normal max-w-[240px] mx-auto leading-relaxed">
                      Create a secure workspace and start sharing files in real-time.
                    </p>
                  </div>
                  <button 
                    onClick={handleCreateRoom} 
                    disabled={creating}
                    className="w-full h-[50px] rounded-[12px] text-[15px] font-semibold text-white bg-[#FF3B30] hover:bg-[#E0342B] active:opacity-70 active:scale-[0.97] transition-all duration-200 mt-auto disabled:opacity-40"
                    style={{ boxShadow: '0 1px 4px rgba(255,59,48,0.3), 0 0.5px 0 rgba(255,255,255,0.15) inset' }}
                  >
                    {creating ? 'Initializing...' : 'Create Room'}
                  </button>
                </div>

                {/* Join Card */}
                <div className="flex-1 max-w-sm rounded-[22px] p-8 flex flex-col items-center gap-6 group transition-all duration-300 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', border: '0.5px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.15), 0 0 0 0.5px rgba(255,255,255,0.04) inset' }}>
                  <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#FF3B30]/8 blur-[100px] rounded-full" />
                  <div className="w-14 h-14 bg-[#FF3B30]/10 rounded-[16px] flex items-center justify-center transition-colors relative z-10" style={{ boxShadow: '0 0 0 0.5px rgba(255,59,48,0.15) inset' }}>
                    <LogIn className="h-7 w-7 text-[#FF3B30]" />
                  </div>
                  <div className="text-center relative z-10">
                    <h3 className="font-semibold text-xl mb-1.5 tracking-tight">Join a Room</h3>
                    <p className="text-[13px] text-muted-foreground font-normal max-w-[240px] mx-auto leading-relaxed">
                      Discover active hosts and connect to their ongoing sessions.
                    </p>
                  </div>
                  <div className="w-full mt-auto relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input 
                        placeholder="Search host name or email..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-[50px] pl-10 pr-4 rounded-[12px] text-[15px] font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 1px 2px rgba(0,0,0,0.05) inset' }}
                      />
                    </div>

                    {/* Semantic Search Dropdown */}
                    <AnimatePresence>
                      {searchQuery && (
                        <motion.div 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute top-full mt-3 left-0 w-full max-h-[260px] overflow-y-auto rounded-[16px] custom-scrollbar z-50 p-2 flex flex-col gap-1.5"
                          style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}
                        >
                          {filteredProfiles.length === 0 ? (
                            <div className="py-8 text-center text-[13px] text-muted-foreground/60 font-medium">
                              No host found
                            </div>
                          ) : (
                            filteredProfiles.map(p => (
                              <button
                                key={p.auth_user_id}
                                onClick={() => {
                                  setSearchQuery('');
                                  handleJoinHost(p.auth_user_id);
                                }}
                                disabled={joining}
                                className="w-full flex items-center gap-3 p-2.5 rounded-[12px] hover:bg-white/10 active:scale-[0.98] transition-all text-left disabled:opacity-50 group"
                              >
                                <div className="h-10 w-10 rounded-[10px] bg-[#FF3B30]/20 flex items-center justify-center shrink-0" style={{ boxShadow: '0 0 0 0.5px rgba(255,59,48,0.2) inset' }}>
                                  {p.avatar_url ? (
                                    <img src={p.avatar_url} alt={p.name} className="h-full w-full rounded-[10px] object-cover" />
                                  ) : (
                                    <span className="text-sm font-bold text-[#FF3B30]">{p.name?.charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[14px] font-semibold text-gray-900 truncate">{p.name}</p>
                                  <p className="text-[11px] text-gray-500 truncate">{p.email}</p>
                                </div>
                                <div className="px-3 py-1.5 rounded-[8px] bg-[#FF3B30] text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                  Join
                                </div>
                              </button>
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
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
