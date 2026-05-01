import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Clock, Search, Users, RefreshCw } from 'lucide-react';
import HistoryModal from '@/components/HistoryModal';
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
  const [activeRoomsMap, setActiveRoomsMap] = useState<Record<string, string>>({});
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeRooms, setActiveRooms] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      navigate('/');
    }
  }, [authLoading, user, profile, navigate]);

  useEffect(() => {
    if (!user || !profile) return;
    const ensureSession = async () => {
      const { data: existing } = await supabase.from('sessions').select('id').eq('user_id', user.id).maybeSingle();
      if (!existing) {
        await supabase.from('sessions').insert({
          user_id: user.id,
          name: profile.name,
          status: 'active',
        });
      }

      // ACTIVE CLEANUP: If a user is on the Connection page, they cannot be in a room.
      // This kills all "zombie" rooms left over from browser crashes or forced unloads.
      await supabase.from('room_participants').delete().eq('user_id', user.id);
      await supabase.from('rooms').update({ status: 'closed' }).eq('host_id', user.id).eq('status', 'active');
    };
    ensureSession();
  }, [user, profile]);

    const fetchRooms = useCallback(async () => {
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Fetch rooms error:', error);
        return 0;
      }
      
      if (!rooms) return 0;

      const roomMap: Record<string, string> = {};
      for (const r of rooms) {
        // Smart Detection: Find the host ID regardless of column name
        const room = r as any;
        const hostId = room.host_id || room.user_id || room.created_by || room.auth_user_id;
        if (hostId && !roomMap[hostId]) {
          roomMap[hostId] = room.room_id;
        }
      }
      setActiveRoomsMap(roomMap);
      return rooms.length;
    }, []);

  const fetchProfiles = useCallback(async () => {
    setProfilesLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('auth_user_id, name, email, avatar_url')
      .order('name', { ascending: true });
      
    if (profiles) setAllProfiles(profiles);
    setProfilesLoading(false);
  }, []);

  useEffect(() => {
    if (!user || !profile) return;
    
    fetchRooms();
    fetchProfiles();
    
    const channel = supabase.channel('public:rooms-and-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants' }, () => {
        fetchRooms();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        fetchRooms();
      })
      .subscribe();

    const interval = setInterval(fetchRooms, 10000);
      
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, profile, fetchRooms, fetchProfiles]);

  const [refreshing, setRefreshing] = useState(false);
  const handleManualRefresh = async () => {
    setRefreshing(true);
    const [count] = await Promise.all([fetchRooms(), fetchProfiles()]);
    setRefreshing(false);
    toast.success(`Network updated (${count} live rooms)`, { duration: 3000 });
  };

  if (authLoading || !user || !profile) return null;

  const handleCreateRoom = async () => {
    setCreating(true);
    let roomId = "";
    let isUnique = false;
    
    while (!isUnique) {
      roomId = Array.from({ length: 6 }, () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 36)]).join('');
      const { data: existingRoom } = await supabase.from('rooms').select('id').eq('room_id', roomId).maybeSingle();
      if (!existingRoom) {
        isUnique = true;
      }
    }

    const { error } = await supabase.from('rooms').insert({ room_id: roomId, host_id: user.id, status: 'active' });
    if (error) { toast.error('Failed to create room'); setCreating(false); return; }

    await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', user.id);
    await supabase.from('room_participants').insert({ room_id: roomId, user_id: user.id, status: 'accepted' });
    navigate(`/room/${roomId}`);
  };

  const handleJoinRoom = async (rid: string) => {
    if (!rid.trim()) return;
    setJoining(true);
    
    const { data: room } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', rid)
      .maybeSingle();

    if (!room) { 
      toast.error('Invalid Room ID'); 
      setJoining(false); 
      return; 
    }

    if (room.status === 'locked') { 
      toast.error('Room is locked'); 
      setJoining(false); 
      return; 
    }

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

  const filteredProfiles = useMemo(() => {
    return allProfiles.filter(p => 
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allProfiles, searchQuery]);

  const groupedProfiles = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredProfiles.forEach(p => {
      const char = (p.name?.[0] || '#').toUpperCase();
      if (!groups[char]) groups[char] = [];
      groups[char].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredProfiles]);

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground overflow-hidden">
      <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />

      <main className="flex-1 flex flex-col lg:flex-row p-4 sm:p-6 lg:p-8 gap-8 relative z-10 w-full max-w-7xl mx-auto">
        
        {/* LEFT BAR: Profile & Create */}
        <div className="w-full lg:w-[320px] flex flex-col items-center justify-start pt-8 pb-10 px-6 bg-card/20 backdrop-blur-md border border-border/40 rounded-3xl shrink-0 h-fit">
          <div className="relative mb-6 flex flex-col items-center animate-fade-up w-full">
            <div className="relative w-28 h-28 mb-5">
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
                className="absolute bottom-1 right-1 bg-green-500 w-4 h-4 rounded-full border-[3px] border-background z-30"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center w-full">
              <h1 className="text-2xl font-bold tracking-tight mb-1 truncate">{profile.name}</h1>
              <p className="text-sm text-muted-foreground font-medium opacity-70 mb-2 truncate">{profile.email}</p>
              <div className="flex items-center gap-2 justify-center mb-8">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Session Active</span>
              </div>
              
              <Button 
                onClick={handleCreateRoom} 
                disabled={creating}
                className="w-full h-14 rounded-2xl text-base font-bold volts-gradient shadow-xl shadow-primary/20 hover:shadow-primary/30 active:translate-y-0.5 transition-all"
              >
                <Plus className="w-5 h-5 mr-2" />
                {creating ? 'Starting Session...' : 'Create Live Room'}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* RIGHT BAR: Active Rooms */}
        <div className="flex-1 flex flex-col min-w-0 bg-card/10 border border-border/20 rounded-3xl p-6 backdrop-blur-sm h-[calc(100vh-140px)] lg:h-auto overflow-hidden">
          <AnimatePresence mode="wait">
            {waitingApproval ? (
              <motion.div 
                key="waiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full h-full flex items-center justify-center"
              >
                <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-10 flex flex-col items-center text-center shadow-2xl max-w-md w-full">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <Clock className="w-8 h-8 text-primary animate-spin" style={{ animationDuration: '4s' }} />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Awaiting Host</h2>
                  <p className="text-sm text-muted-foreground mb-8">The host needs to approve your connection request before you can start transferring.</p>
                  <Button variant="outline" className="rounded-full px-8" onClick={() => { setWaitingApproval(false); setJoining(false); }}>
                    Cancel Request
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="rooms-list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 shrink-0">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary" />
                        Hosted Live Rooms
                      </h2>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleManualRefresh} 
                        disabled={refreshing}
                        className={`h-8 w-8 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all ${refreshing ? 'animate-spin' : ''}`}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Connect with these active hosts in real-time.</p>
                  </div>
                  
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by name or email..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-card/40 border-border/40 rounded-xl h-11 focus-visible:ring-primary/50"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pb-4 pr-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                  {profilesLoading ? (
                    <div className="h-full w-full flex items-center justify-center">
                      <Clock className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  ) : filteredProfiles.filter(p => !!activeRoomsMap[p.auth_user_id]).length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center opacity-50">
                      <div className="w-20 h-20 mb-6 rounded-full bg-muted/50 flex items-center justify-center border border-dashed border-border">
                        <Users className="w-10 h-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-xl font-bold">No Hosted Rooms</h3>
                      <p className="text-sm max-w-xs mt-2">Active rooms will appear here automatically as soon as hosts start their sessions.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-up">
                      {filteredProfiles
                        .filter(p => !!activeRoomsMap[p.auth_user_id])
                        .map((p) => {
                          const roomId = activeRoomsMap[p.auth_user_id];
                          const isMe = p.auth_user_id === user.id;

                          return (
                            <motion.div 
                              layout
                              key={p.auth_user_id} 
                              className="bg-card/40 backdrop-blur-md border border-red-500/20 rounded-3xl p-6 flex flex-col items-center justify-between hover:border-red-500/40 hover:bg-card/60 transition-all duration-300 group shadow-xl relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-3">
                                <div className="flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-full border border-red-500/20">
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">Live</span>
                                </div>
                              </div>

                              <div className="flex flex-col items-center text-center w-full">
                                <div className="relative w-24 h-24 mb-5">
                                  <div className="absolute inset-0 rounded-full border-2 border-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.3)]" />
                                  <div className="absolute inset-1.5 rounded-full overflow-hidden bg-muted shadow-inner">
                                    {p.avatar_url ? (
                                      <img src={p.avatar_url} alt={p.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-primary/10 text-primary uppercase">
                                        {p.name.charAt(0)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <h3 className="font-bold text-lg truncate w-full mb-1">{p.name}</h3>
                                <p className="text-xs text-muted-foreground truncate w-full opacity-60 mb-6">{p.email}</p>
                              </div>

                              <Button 
                                onClick={() => handleJoinRoom(roomId)}
                                disabled={joining || isMe}
                                variant="destructive"
                                className="w-full rounded-2xl font-black text-xs uppercase tracking-widest h-12 bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all active:scale-95"
                              >
                                {joining ? 'Connecting...' : isMe ? 'YOU ARE HOST' : 'Join Room'}
                              </Button>
                            </motion.div>
                          );
                        })}
                    </div>
                  )}
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

