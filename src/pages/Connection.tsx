import { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
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
      // Just mock loading to keep UI smooth, no longer fetching all profiles
      setLoadingData(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('public:system')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, profile]);



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

  const handleJoinRoomCode = useCallback(async () => {
    if (!roomCodeInput.trim() || roomCodeInput.length !== 6 || joining || waitingApproval) {
      return;
    }
    
    setJoining(true);
    const code = roomCodeInput.toUpperCase();
    
    const { data: room, error } = await supabase
      .from('rooms')
      .select('id, status, host_id')
      .eq('room_id', code)
      .single();

    if (error || !room) {
      toast.error('Room not found or no longer active');
      setJoining(false);
      return;
    }

    const { data: existing } = await supabase
      .from('room_participants')
      .select('status')
      .eq('room_id', code)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing?.status === 'blocked') { 
      toast.error('You are blocked from this room'); 
      setJoining(false); 
      return; 
    }

    setWaitingApproval(true);

    const channel = supabase.channel(`transfers-${code}`, {
      config: { broadcast: { self: false } },
    });

    const timeout = setTimeout(() => {
      channel.unsubscribe();
      toast.error('Host did not respond. Redirecting...', { duration: 3000 });
      setWaitingApproval(false);
      setJoining(false);
    }, 10000);

    channel.on('broadcast', { event: 'join-response' }, async (payload) => {
      const { targetUserId, status } = payload.payload;
      if (targetUserId === user.id) {
        clearTimeout(timeout);
        if (status === 'accepted') {
          await supabase.from('room_participants').delete().eq('room_id', code).eq('user_id', user.id);
          await supabase.from('room_participants').insert({ room_id: code, user_id: user.id, status: 'accepted' });
          channel.unsubscribe();
          navigate(`/room/${code}`);
        } else {
          channel.unsubscribe();
          toast.error('The host declined your request.');
          setWaitingApproval(false);
          setJoining(false);
        }
      }
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'join-request',
          payload: {
            targetUserId: 'host',
            requester: {
              userId: user.id,
              name: profile.name,
              email: profile.email,
              avatar_url: profile.avatar_url
            }
          }
        });
      }
    });
  }, [roomCodeInput, joining, waitingApproval, user, profile, navigate]);

  useEffect(() => {
    if (roomCodeInput.length === 6 && !joining && !waitingApproval) {
      handleJoinRoomCode();
    }
  }, [roomCodeInput, joining, waitingApproval, handleJoinRoomCode]);

  const handleLogout = async () => {
    await supabase.from('sessions').delete().eq('user_id', user.id);
    await signOut();
    navigate('/');
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    const requiredText = `DELETE ${profile?.name}`;
    if (confirmationInput !== requiredText) {
      toast.error(`Please type "${requiredText}" to confirm`);
      return;
    }
    
    if (!feedback.trim()) {
      toast.error('Please share some feedback before leaving');
      return;
    }
    
    setIsDeleting(true);
    try {
      // Actually remove account data
      await supabase.from('rooms').delete().eq('host_id', user.id);
      await supabase.from('room_participants').delete().eq('user_id', user.id);
      await supabase.from('sessions').delete().eq('user_id', user.id);
      
      // Remove profile record
      const { error } = await supabase.from('profiles').delete().eq('auth_user_id', user.id);
      
      if (error) throw error;

      toast.success('Account and profile removed successfully.');
      
      setTimeout(async () => {
        await signOut();
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fully remove account records');
      setIsDeleting(false);
    }
  };

  if (authLoading || !user || !profile) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground overflow-hidden">
      <VoltsNavbar 
        showActions 
        onLogout={handleLogout} 
        onDeleteAccount={handleDeleteAccount}
        onHistoryClick={() => setHistoryOpen(true)} 
      />

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
                  <div className="w-full mt-auto flex flex-col gap-3">
                    <input 
                      placeholder="Enter 6-digit code..." 
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                      maxLength={6}
                      disabled={joining || waitingApproval}
                      className="w-full h-[56px] px-4 rounded-[12px] text-center tracking-[0.2em] uppercase text-[18px] font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 1px 2px rgba(0,0,0,0.05) inset' }}
                    />
                    
                    <AnimatePresence>
                      {(joining || waitingApproval) && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center justify-center gap-2 text-primary text-sm font-semibold mt-2"
                        >
                          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          {waitingApproval ? 'Waiting for Host Approval...' : 'Connecting...'}
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                <div className="flex-1 max-w-sm rounded-[22px] p-8 flex flex-col items-center gap-6 group transition-all duration-300 relative" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', border: '0.5px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.15), 0 0 0 0.5px rgba(255,255,255,0.04) inset' }}>
                  {/* Background layer for decorative glow */}
                  <div className="absolute inset-0 overflow-hidden rounded-[22px] pointer-events-none">
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#FF3B30]/8 blur-[100px] rounded-full" />
                  </div>

                  <div className="w-14 h-14 bg-[#FF3B30]/10 rounded-[16px] flex items-center justify-center transition-colors relative z-10" style={{ boxShadow: '0 0 0 0.5px rgba(255,59,48,0.15) inset' }}>
                    <LogIn className="h-7 w-7 text-[#FF3B30]" />
                  </div>
                  <div className="text-center relative z-10">
                    <h3 className="font-semibold text-xl mb-1.5 tracking-tight">Join a Room</h3>
                    <p className="text-[13px] text-muted-foreground font-normal max-w-[240px] mx-auto leading-relaxed">
                      Discover active hosts and connect to their ongoing sessions.
                    </p>
                  </div>
                  <div className="w-full mt-auto flex flex-col gap-2">
                    <input 
                      placeholder="Enter 6-digit code..." 
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="w-full h-[50px] px-4 rounded-[12px] text-center tracking-widest uppercase text-[16px] font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 1px 2px rgba(0,0,0,0.05) inset' }}
                    />
                    <button 
                      onClick={handleJoinRoomCode}
                      disabled={joining || roomCodeInput.length !== 6}
                      className="w-full h-[50px] rounded-[12px] text-[15px] font-semibold text-white bg-[#FF3B30] hover:bg-[#E0342B] active:opacity-70 active:scale-[0.97] transition-all duration-200 disabled:opacity-40"
                      style={{ boxShadow: '0 1px 4px rgba(255,59,48,0.3), 0 0.5px 0 rgba(255,255,255,0.15) inset' }}
                    >
                      {joining ? 'Joining...' : 'Join Room'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <HistoryModal 
        open={historyOpen} 
        onClose={() => setHistoryOpen(false)} 
        userId={user.id}
        userName={profile.name}
      />

      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card border border-border/40 rounded-[24px] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-destructive/20">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-destructive"
                />
              </div>
              
              <h2 className="text-2xl font-black tracking-tight mb-2">Delete Account?</h2>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                This will permanently remove your profile and active sessions. Please tell us why you are leaving so we can improve.
              </p>

              <textarea
                placeholder="Your feedback..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full h-24 p-4 rounded-xl bg-muted/50 border border-border/40 focus:outline-none focus:ring-2 focus:ring-destructive/20 transition-all text-sm resize-none mb-4 placeholder:text-muted-foreground/50"
              />

              <div className="space-y-2 mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-destructive/70">
                  To confirm, type <span className="text-destructive">DELETE {profile?.name}</span> below:
                </p>
                <Input
                  placeholder={`DELETE ${profile?.name}`}
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  className="h-12 rounded-xl bg-muted/30 border-border/40 font-mono text-xs"
                />
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 rounded-xl font-bold"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmationInput('');
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1 h-12 rounded-xl font-bold shadow-lg shadow-destructive/20 disabled:opacity-30"
                  onClick={confirmDeleteAccount}
                  disabled={isDeleting || confirmationInput !== `DELETE ${profile?.name}`}
                >
                  {isDeleting ? 'Removing...' : 'Confirm Delete'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
