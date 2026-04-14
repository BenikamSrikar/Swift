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
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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
      // While on this page, the user should NOT be a participant or an active host of any room.
      await supabase.from('room_participants').delete().eq('user_id', user.id);
      await supabase.from('rooms').update({ status: 'locked' }).eq('host_id', user.id).eq('status', 'active');
    };
    ensureSession();

    const fetchRooms = async () => {
      // 1. Fetch all rooms marked as active
      const { data: rooms } = await supabase.from('rooms').select('*').eq('status', 'active');
      if (!rooms) { setActiveRooms([]); return; }
      
      // 2. Fetch all online users who are actually INSIDE a room
      const { data: activeSessions } = await supabase.from('sessions')
        .select('user_id')
        .eq('status', 'in_room');
      const inRoomUserIds = new Set(activeSessions?.map(s => s.user_id) || []);
      
      // 3. Fetch all accepted participants to verify host is actually in the room
      const { data: participants } = await supabase.from('room_participants')
        .select('room_id, user_id')
        .eq('status', 'accepted');
      const activeParticipants = participants || [];
      
      // 4. A room is "Live" only if:
      // - It belongs to SOMEONE ELSE (host_id !== user.id)
      // - The host is currently INSIDE A ROOM (session status is 'in_room')
      // - The host is actually an accepted participant in their own room
      const liveRooms = rooms.filter(r => 
        r.host_id !== user.id && 
        inRoomUserIds.has(r.host_id) &&
        activeParticipants.some(p => p.room_id === r.room_id && p.user_id === r.host_id)
      );

      if (liveRooms.length === 0) { setActiveRooms([]); return; }

      const hostIds = liveRooms.map(r => r.host_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('auth_user_id', hostIds);
      if (!profiles) { setActiveRooms([]); return; }
      
      const combined = liveRooms.map(r => ({
        ...r,
        hostProfile: profiles.find(p => p.auth_user_id === r.host_id)
      })).filter(r => r.hostProfile);
        
      setActiveRooms(combined);
    };

    fetchRooms();
    const subRooms = supabase.channel('public:rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, fetchRooms)
      .subscribe();
      
    const subParticipants = supabase.channel('public:room_participants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants' }, fetchRooms)
      .subscribe();

    const subSessions = supabase.channel('public:sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fetchRooms)
      .subscribe();

    const poller = setInterval(fetchRooms, 10000);
 
    return () => { 
      supabase.removeChannel(subRooms); 
      supabase.removeChannel(subParticipants);
      supabase.removeChannel(subSessions);
      clearInterval(poller);
    };
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

  const handleJoinRoom = async (rid: string, hostName: string) => {
    if (!rid.trim()) return;
    setJoining(true);
    const { data: room } = await supabase.from('rooms').select('*').eq('room_id', rid).single();
    if (!room) { toast.error('Room not found'); setJoining(false); return; }
    if (room.status === 'locked') { toast.error('Room is locked'); setJoining(false); return; }
    const { data: existing } = await supabase.from('room_participants').select('status').eq('room_id', rid).eq('user_id', user.id).single();
    if (existing?.status === 'blocked') { toast.error('You are blocked'); setJoining(false); return; }
    // Remove any previous stale row before re-joining
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
        toast.error(`${hostName} had declined your request for joining.`);
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

    // Store poller in a way that we can clear it if the user cancels
    (window as any)._joinPoller = joinPoller;
  };

  const handleLogout = async () => {
    await supabase.from('sessions').delete().eq('user_id', user.id);
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground overflow-hidden">
      <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />

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
                  key="actions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full flex flex-col pt-2"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-normal tracking-wide text-muted-foreground mr-6">Created Rooms</h2>
                    <div className="relative flex-1 max-w-[240px] ml-auto">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search rooms..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-9 rounded-md bg-transparent border-border/50 text-sm focus-visible:ring-1 focus-visible:ring-primary/50 w-full"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {activeRooms.filter(room => room.hostProfile.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                      activeRooms.filter(room => room.hostProfile.name.toLowerCase().includes(searchQuery.toLowerCase())).map(room => (
                        <div key={room.id} className="border border-border/60 rounded-xl p-4 flex flex-col justify-between transition-all hover:bg-card/40 bg-transparent min-h-[140px]">
                          <div className="flex justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-1">
                                <h3 className="font-semibold text-[15px] text-foreground truncate mr-2">
                                  {room.hostProfile.name.toLowerCase()}-room
                                </h3>
                                <span className="px-2 py-[1px] rounded-full border border-border/60 text-[10px] text-muted-foreground font-medium shrink-0 uppercase tracking-tight">
                                  Public
                                </span>
                              </div>
                              <p className="text-[13px] text-muted-foreground mb-4 line-clamp-1">
                                {room.hostProfile.email}
                              </p>
                              
                              <div className="flex items-center gap-4 mt-auto">
                                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                  Live
                                </div>
                                <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                                  <span className="opacity-70 text-[10px]">●</span>
                                  <span>P2P</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col justify-center shrink-0">
                              <Button 
                                size="sm" 
                                onClick={() => handleJoinRoom(room.room_id, room.hostProfile.name)}
                                className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm transition-all"
                              >
                                Join Room
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center border border-border/40 rounded-xl bg-transparent">
                        <p className="text-sm text-muted-foreground">User doesn't have any active environments yet.</p>
                      </div>
                    )}
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

