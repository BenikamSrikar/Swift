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

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !profile)) {
      navigate('/');
    }
  }, [authLoading, user, profile, navigate]);

  const fetchRooms = async () => {
    try {
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('room_id, host_id, created_at')
        .eq('status', 'active');

      if (!roomsData) return;

      const hostIds = roomsData.map(r => r.host_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('auth_user_id, name, email, avatar_url')
        .in('auth_user_id', hostIds);

      const profileMap = new Map(profilesData?.map(p => [p.auth_user_id, p]) || []);

      const combined = roomsData.map(r => ({
        ...r,
        host: profileMap.get(r.host_id)
      })).filter(r => r.host && r.host_id !== user?.id);

      setAvailableRooms(combined);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchRooms();

    const channel = supabase
      .channel('room-directory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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

  const handleJoinRoom = async (rid: string) => {
    if (joining) return;
    setJoining(true);
    
    try {
      const { data: existing } = await supabase.from('room_participants').select('status').eq('room_id', rid).eq('user_id', user.id).maybeSingle();
      
      if (existing?.status === 'accepted') {
        navigate(`/room/${rid}`);
        return;
      }

      if (existing?.status === 'blocked') { toast.error('You are blocked'); setJoining(false); return; }
      
      if (existing) {
        await supabase.from('room_participants').delete().eq('room_id', rid).eq('user_id', user.id);
      }

      await supabase.from('room_participants').insert({ room_id: rid, user_id: user.id, status: 'pending' });
      setWaitingApproval(true);

      const channel = supabase.channel(`join-${user.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_participants', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.new.status === 'accepted') { channel.unsubscribe(); navigate(`/room/${rid}`); }
        else if (payload.new.status === 'blocked') { channel.unsubscribe(); toast.error('Rejected'); setWaitingApproval(false); setJoining(false); }
      }).subscribe();
    } catch (err) {
      console.error('Join error:', err);
      toast.error('Failed to join room');
      setJoining(false);
    }
  };

  const handleLogout = async () => {
    await supabase.from('sessions').delete().eq('user_id', user.id);
    await signOut();
    navigate('/');
  };

  const filteredRooms = availableRooms.filter(room => {
    const q = searchQuery.toLowerCase();
    return room.host.name.toLowerCase().includes(q) || room.host.email.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground overflow-hidden">
      <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />

      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-12 relative overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-12">
          
          {/* Left Side: Profile & Create */}
          <div className="lg:w-1/3 flex flex-col items-center lg:items-start animate-fade-up">
            <div className="relative mb-8 flex flex-col items-center lg:items-start">
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 mb-6">
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
              
              <div className="text-center lg:text-left">
                <h1 className="text-4xl font-black tracking-tighter mb-1">{profile.name}</h1>
                <p className="text-sm text-muted-foreground font-bold opacity-60 mb-4">{profile.email}</p>
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[11px] uppercase tracking-widest font-black text-muted-foreground opacity-50 text-shadow-sm">System Online</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleCreateRoom} 
              disabled={creating}
              className="w-full max-w-sm h-16 rounded-[24px] text-lg font-black volts-gradient shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-95 transition-all group"
            >
              {creating ? 'Initializing...' : (
                <div className="flex items-center gap-3">
                  <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                  Create Room
                </div>
              )}
            </Button>
          </div>

          {/* Right Side: Created Rooms List */}
          <div className="lg:w-2/3 flex flex-col animate-fade-up" style={{ animationDelay: '100ms' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-1">Created Rooms</h2>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-black opacity-40">Active Network Directory</p>
              </div>

              <div className="relative group w-full sm:w-80">
                <Input 
                  placeholder="Search hosts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 rounded-2xl bg-card/40 backdrop-blur-md border border-white/5 pl-12 pr-4 focus-visible:ring-primary/30 transition-all font-bold"
                />
                <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {waitingApproval ? (
                <motion.div 
                  key="waiting"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="w-full bg-card/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-16 flex flex-col items-center text-center shadow-2xl"
                >
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-8 relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <Clock className="w-12 h-12 text-primary animate-spin" style={{ animationDuration: '4s' }} />
                  </div>
                  <h2 className="text-3xl font-black mb-3">Awaiting Approval</h2>
                  <p className="text-base text-muted-foreground mb-10 max-w-sm font-medium">Your request has been sent. The host will review and grant access shortly.</p>
                  <Button variant="outline" className="h-12 rounded-xl px-10 font-bold border-white/10 hover:bg-white/5 active:scale-95 transition-all" onClick={() => { setWaitingApproval(false); setJoining(false); }}>
                    Cancel Request
                  </Button>
                </motion.div>
              ) : (
                <motion.div 
                  key="list"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                >
                  {filteredRooms.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-card/20 rounded-[40px] border border-dashed border-white/5">
                      <div className="w-16 h-16 rounded-2xl bg-muted/30 mb-4 flex items-center justify-center">
                        <LogIn className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm font-bold text-muted-foreground opacity-50 uppercase tracking-widest">No active hosts found</p>
                    </div>
                  ) : (
                    filteredRooms.map((room) => (
                      <motion.div
                        layout
                        key={room.room_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative"
                      >
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-primary/5 rounded-[32px] blur opacity-0 group-hover:opacity-100 transition duration-500" />
                        <div className="relative p-6 rounded-[30px] bg-card/40 backdrop-blur-xl border border-white/5 hover:border-primary/20 transition-all flex flex-col gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-muted overflow-hidden border border-white/5 group-hover:scale-105 transition-transform duration-500">
                              {room.host?.avatar_url ? (
                                <img src={room.host.avatar_url} alt={room.host.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-black text-xl">
                                  {room.host?.name?.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-base truncate">{room.host?.name}</h4>
                              <p className="text-[10px] text-muted-foreground font-medium truncate opacity-60 uppercase tracking-tight">{room.host?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <div className="flex flex-col">
                              <span className="text-[8px] uppercase tracking-widest font-black text-muted-foreground/40 leading-none mb-1">Status</span>
                              <div className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                <span className="text-[10px] font-bold">Encrypted</span>
                              </div>
                            </div>
                            <Button 
                              onClick={() => handleJoinRoom(room.room_id)}
                              className="h-10 px-6 rounded-xl text-xs font-black volts-gradient shadow-xl active:scale-95 transition-all"
                            >
                              Join Session
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
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

