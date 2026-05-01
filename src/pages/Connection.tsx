import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Clock, Search, Users } from 'lucide-react';
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

  useEffect(() => {
    if (!user || !profile) return;

    const fetchRooms = async () => {
      const { data: rooms } = await supabase
        .from('rooms')
        .select('room_id, host_id, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (!rooms || rooms.length === 0) {
        setActiveRooms([]);
        return;
      }

      // Deduplicate: A host can only have ONE live room at a time. Pick the newest.
      const latestRoomsMap = new Map();
      for (const r of rooms) {
        if (!latestRoomsMap.has(r.host_id)) {
          latestRoomsMap.set(r.host_id, r);
        }
      }
      const uniqueRooms = Array.from(latestRoomsMap.values());
      const roomIds = uniqueRooms.map(r => r.room_id);
      
      // Verify hosts are actively INSIDE their rooms
      const { data: participants } = await supabase
        .from('room_participants')
        .select('room_id, user_id')
        .in('room_id', roomIds)
        .eq('status', 'accepted');
        
      // Filter out stale rooms where the host has left the room (tab closed or navigated away)
      const validRooms = uniqueRooms.filter(r => 
        participants?.some(p => p.room_id === r.room_id && p.user_id === r.host_id)
      );
      
      if (validRooms.length === 0) {
        setActiveRooms([]);
        return;
      }
      
      const validHostIds = [...new Set(validRooms.map(r => r.host_id))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('auth_user_id, name, email, avatar_url')
        .in('auth_user_id', validHostIds);
        
      const profileMap = new Map((profiles || []).map(p => [p.auth_user_id, p]));
      
      const enriched = validRooms.map(r => ({
        room_id: r.room_id,
        host: profileMap.get(r.host_id) || { name: 'Unknown', email: 'Unknown', avatar_url: null, auth_user_id: r.host_id }
      }));
      
      setActiveRooms(enriched);
    };
    
    fetchRooms();
    
    const channel = supabase.channel('public:rooms-and-participants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants' }, () => {
        fetchRooms();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

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

  const filteredRooms = activeRooms.filter(r => 
    (r.host?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (r.host?.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Users className="w-6 h-6 text-primary" />
                      Live Rooms
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Join an available session below.</p>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-max overflow-y-auto pb-4 pr-1 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                  {filteredRooms.length === 0 ? (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-center opacity-50">
                      <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center border border-border/50">
                        <Search className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-bold">No rooms found</h3>
                      <p className="text-sm max-w-xs mt-1">There are no active sessions matching your search or no rooms are currently live.</p>
                    </div>
                  ) : (
                    filteredRooms.map((room) => (
                      <div key={room.room_id} className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-5 flex flex-col gap-5 hover:border-primary/40 hover:bg-card/60 transition-all duration-300 group shadow-sm hover:shadow-md">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full overflow-hidden bg-muted shrink-0 border-2 border-border/50 group-hover:border-primary/30 transition-colors">
                            {room.host.avatar_url ? (
                              <img src={room.host.avatar_url} alt={room.host.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xl font-bold bg-primary/10 text-primary">
                                {room.host.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold truncate text-base mb-0.5">{room.host.name}</h3>
                            <p className="text-xs text-muted-foreground truncate">{room.host.email}</p>
                            {room.host.auth_user_id === user.id && (
                              <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                                Your Room
                              </span>
                            )}
                          </div>
                        </div>
                        <Button 
                          onClick={() => handleJoinRoom(room.room_id)}
                          disabled={joining || room.host.auth_user_id === user.id}
                          variant={room.host.auth_user_id === user.id ? "secondary" : "default"}
                          className="w-full rounded-xl font-bold h-10 shadow-sm"
                        >
                          {joining ? 'Connecting...' : room.host.auth_user_id === user.id ? 'Already Hosted' : 'Join Room'}
                        </Button>
                      </div>
                    ))
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

