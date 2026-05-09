import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, LogIn, Clock, Search, Users } from 'lucide-react';
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
  const [hostedRooms, setHostedRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

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

    const fetchHostedRooms = async () => {
      setLoadingRooms(true);
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select(`
            id, 
            room_id, 
            host_id, 
            status,
            host:host_id (
              name,
              email,
              avatar_url
            )
          `)
          .eq('status', 'active');
        
        if (error) {
          console.error('Fetch rooms error:', error);
          setHostedRooms([]);
        } else if (data) {
          // Map 'host' to 'profiles' to maintain compatibility with the UI
          const liveRooms = data.map((r: any) => ({
            ...r,
            profiles: r.host
          }));
          setHostedRooms(liveRooms);
        }
      } catch (err) {
        console.error('Discovery error:', err);
      } finally {
        setLoadingRooms(false);
      }
    };

    ensureSession();
    fetchHostedRooms();

    const channel = supabase.channel('public:rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchHostedRooms();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, profile]);

  const filteredRooms = useMemo(() => {
    return hostedRooms.filter(room => 
      room.profiles?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.room_id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [hostedRooms, searchQuery]);

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

    const { data: hostProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('auth_user_id', room.host_id)
      .maybeSingle();

    const { data: existing } = await supabase
      .from('room_participants')
      .select('status')
      .eq('room_id', room.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing?.status === 'blocked') { 
      toast.error('You are blocked from this room'); 
      setJoining(false); 
      return; 
    }

    await supabase.from('room_participants').delete().eq('room_id', room.id).eq('user_id', user.id);
    await supabase.from('room_participants').insert({ 
      room_id: room.id, 
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
            ) : (
              <div className="w-full flex flex-col lg:flex-row gap-8 items-start justify-center">
                {/* Main Actions - Left Side */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full lg:max-w-md flex flex-col gap-6"
                >
                  <div className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-8 flex flex-col items-center gap-6 group hover:border-primary/30 transition-all duration-500 active:scale-[0.98] shadow-2xl relative overflow-hidden">
                    {/* Background glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 blur-[100px] rounded-full" />
                    
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-colors relative z-10">
                      <Plus className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-center relative z-10">
                      <h3 className="font-black text-2xl mb-2 tracking-tight">Host a Session</h3>
                      <p className="text-xs text-muted-foreground font-medium max-w-[240px] mx-auto leading-relaxed">
                        Create a secure workspace and start sharing files with your team in real-time.
                      </p>
                    </div>
                    <Button 
                      onClick={handleCreateRoom} 
                      disabled={creating}
                      className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-widest volts-gradient shadow-xl shadow-primary/20 hover:shadow-primary/30 active:translate-y-0.5 transition-all"
                    >
                      {creating ? 'Starting Session...' : 'Create Room'}
                    </Button>
                  </div>
                </motion.div>

                {/* Hosted Rooms Discovery - Right Side */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-full lg:w-96 flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Users className="h-4 w-4" /> Live Discovery
                    </h2>
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-3 py-1 rounded-full animate-pulse">
                      {hostedRooms.length} Active
                    </span>
                  </div>

                  <div className="relative mb-2 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      placeholder="Find a host or room ID..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 pl-10 pr-4 rounded-xl bg-muted/30 border-border/40 text-xs focus:bg-background/50 focus:border-primary/50 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-3 max-h-[400px] lg:max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                    {loadingRooms ? (
                      <div className="flex flex-col gap-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-muted/20 animate-pulse" />)}
                      </div>
                    ) : filteredRooms.length === 0 ? (
                      <div className="py-20 flex flex-col items-center text-center gap-4 border border-dashed border-border/40 rounded-3xl bg-muted/5">
                        <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                          <Search className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Quiet in here...</p>
                          <p className="text-[10px] text-muted-foreground/60 max-w-[160px]">No active sessions found. Why not host one?</p>
                        </div>
                      </div>
                    ) : (
                      filteredRooms.map((room) => (
                        <motion.div 
                          key={room.room_id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl p-5 flex flex-col gap-4 hover:border-primary/50 transition-all group hover:bg-card/60 shadow-lg hover:shadow-primary/5"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 shadow-inner group-hover:scale-105 transition-transform">
                              {room.profiles?.avatar_url ? (
                                <img src={room.profiles.avatar_url} alt={room.profiles.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-lg font-black text-primary">{room.profiles?.name?.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black truncate group-hover:text-primary transition-colors tracking-tight">{room.profiles?.name || 'Unknown Host'}</p>
                              <p className="text-[10px] font-medium text-muted-foreground truncate opacity-70">{room.profiles?.email}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[9px] font-mono font-bold text-muted-foreground/40 uppercase">Live Session</span>
                              </div>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            className="h-10 w-full rounded-xl text-[10px] font-black uppercase tracking-[0.2em] volts-gradient text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            onClick={() => handleJoinRoom(room.room_id)}
                            disabled={joining}
                          >
                            Join Session
                          </Button>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} senderEmail={profile.email} senderName={profile.name} />
    </div>
  );
}

