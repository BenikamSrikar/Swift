import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserPlus, Search, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface Profile {
  auth_user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface AddMembersSidebarProps {
  roomId: string;
  hostId: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function AddMembersSidebar({ roomId, hostId, isOpen, setIsOpen }: AddMembersSidebarProps) {
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [roomParticipants, setRoomParticipants] = useState<string[]>([]); // Array of user_ids
  const [busyUsers, setBusyUsers] = useState<string[]>([]); // Array of user_ids in OTHER rooms
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 1. Fetch all profiles (excluding current host)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('auth_user_id, name, email, avatar_url')
        .neq('auth_user_id', hostId)
        .order('name', { ascending: true });

      if (profiles) setAllUsers(profiles);

      // 2. Fetch ALL relevant participants
      const { data: allParts } = await supabase
        .from('room_participants')
        .select('user_id, room_id, status')
        .in('status', ['accepted', 'pending', 'invited']);

      if (!allParts) return;

      // 3. Find participants in CURRENT room
      const inCurrent = allParts
        .filter(p => p.room_id === roomId)
        .map(p => p.user_id);
      
      setRoomParticipants(inCurrent);

      // 4. Identify busy users (in OTHER rooms that are ACTIVE)
      // Since we can't JOIN easily without FKs, we fetch active room IDs first
      const { data: activeRooms } = await supabase
        .from('rooms')
        .select('room_id')
        .eq('status', 'active');

      const activeRoomIds = new Set(activeRooms?.map(r => r.room_id) || []);

      const inOther = allParts
        .filter(p => p.room_id !== roomId && activeRoomIds.has(p.room_id))
        .map(p => p.user_id);
      
      setBusyUsers(inOther);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to participant changes ONLY for this room to prevent flickering/broad noise
    const channel = supabase
      .channel(`member-updates-${roomId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'room_participants',
        filter: `room_id=eq.${roomId}`
      }, () => {
        // Only fetch if we are not in the middle of a local update to prevent overwrite flickering
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, hostId]);

  const toggleMember = async (userId: string, isMember: boolean) => {
    // 1. Instant Optimistic UI Update
    setRoomParticipants(prev => 
      isMember ? prev.filter(id => id !== userId) : [...prev, userId]
    );

    try {
      const rid = roomId.toUpperCase();
      if (isMember) {
        await supabase
          .from('room_participants')
          .delete()
          .eq('room_id', rid)
          .eq('user_id', userId);
        toast.info('User removed from room');
      } else {
        await supabase
          .from('room_participants')
          .insert({
            room_id: rid,
            user_id: userId,
            status: 'invited'
          });
        toast.success('User invited to room');
      }
      // Note: We don't call fetchData() here because the realtime subscription 
      // will catch the change and we want to avoid clashing with our optimistic state.
    } catch (err) {
      toast.error('Failed to update member');
      console.error(err);
      fetchData(); // Rollback to source of truth on error
    }
  };

  const filteredUsers = allUsers.filter(u => {
    const isBusyInOtherRoom = busyUsers.includes(u.auth_user_id);
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                          u.email.toLowerCase().includes(search.toLowerCase());
    return !isBusyInOtherRoom && matchesSearch;
  });

  return (
    <motion.div
      initial={false}
      animate={{ 
        width: isOpen ? 320 : 0,
        marginLeft: isOpen ? 0 : -320
      }}
      className="h-full bg-card/20 backdrop-blur-3xl border-r border-border/20 relative overflow-hidden flex flex-col transition-all duration-300 z-10"
    >
      <div className="p-6 flex flex-col h-full w-[320px]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/10 shadow-inner">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight tracking-[-0.02em]">Add Members</h2>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-black opacity-50">Private Invitation</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search colleagues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-muted/20 border border-transparent focus:border-primary/20 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-0 transition-all outline-none"
          />
        </div>

        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-1.5 pb-4">
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No available users found</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase font-black tracking-widest">Global Scan Complete</p>
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isMember = roomParticipants.includes(u.auth_user_id);
                return (
                  <div 
                    key={u.auth_user_id}
                    onClick={() => toggleMember(u.auth_user_id, isMember)}
                    className={`group flex items-center gap-3 p-3 rounded-2xl transition-all border cursor-pointer ${
                      isMember 
                        ? 'bg-primary/20 border-primary/40 shadow-sm' 
                        : 'hover:bg-muted/40 border-transparent hover:border-border/40'
                    }`}
                  >
                    <div className="relative shrink-0 pointer-events-none">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${
                          isMember ? 'bg-primary text-primary-foreground' : 'bg-primary/20 text-primary'
                        }`}>
                          {u.name.charAt(0)}
                        </div>
                      )}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${isMember ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-muted-foreground/30'}`} />
                    </div>
                    <div className="flex-1 min-w-0 pointer-events-none">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-bold truncate ${isMember ? 'text-primary' : ''}`}>{u.name}</p>
                        {isMember && (
                          <motion.span 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-[7px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-black uppercase tracking-widest shrink-0"
                          >
                            Invited
                          </motion.span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate opacity-70 leading-none mt-0.5">{u.email}</p>
                    </div>
                    <Checkbox 
                      checked={isMember}
                      onCheckedChange={() => toggleMember(u.auth_user_id, isMember)}
                      className="rounded-full w-5 h-5 border-2 border-primary data-[state=checked]:bg-primary shadow-md"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
        
        <div className="pt-4 mt-auto border-t border-border/20">
          <p className="text-[9px] text-center text-muted-foreground opacity-30 uppercase font-black tracking-[0.2em]">
            Secure Workspace
          </p>
        </div>
      </div>
    </motion.div>
  );
}

