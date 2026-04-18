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
}

export default function AddMembersSidebar({ roomId, hostId }: AddMembersSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [roomParticipants, setRoomParticipants] = useState<string[]>([]); // Array of user_ids
  const [busyUsers, setBusyUsers] = useState<string[]>([]); // Array of user_ids in OTHER rooms
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 1. Fetch all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('auth_user_id, name, email, avatar_url')
        .neq('auth_user_id', hostId) // Exclude host
        .order('name', { ascending: true });

      // 2. Fetch all active participants in ACTIVE rooms
      const { data: allParticipants } = await supabase
        .from('room_participants')
        .select('user_id, room_id, status, rooms(status)')
        .in('status', ['accepted', 'pending', 'invited']);

      if (profiles) setAllUsers(profiles);
      
      const inCurrent = allParticipants
        ?.filter(p => p.room_id === roomId)
        .map(p => p.user_id) || [];

      // A user is busy only if they are in ANOTHER room that is currently ACTIVE
      const inOther = allParticipants
        ?.filter(p => p.room_id !== roomId && (p as any).rooms?.status === 'active')
        .map(p => p.user_id) || [];
      
      setRoomParticipants(inCurrent);
      setBusyUsers(inOther);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to participant changes to keep list in sync
    const channel = supabase
      .channel('member-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, hostId]);

  const toggleMember = async (userId: string, isMember: boolean) => {
    try {
      if (isMember) {
        // Remove from room
        await supabase
          .from('room_participants')
          .delete()
          .eq('room_id', roomId)
          .eq('user_id', userId);
        toast.info('User removed from room');
      } else {
        // Add to room as invited
        await supabase
          .from('room_participants')
          .insert({
            room_id: roomId,
            user_id: userId,
            status: 'invited'
          });
        toast.success('User invited to room');
      }
      fetchData();
    } catch (err) {
      toast.error('Failed to update member');
      console.error(err);
    }
  };

  const filteredUsers = allUsers.filter(u => {
    const isBusyInOtherRoom = busyUsers.includes(u.auth_user_id);
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                          u.email.toLowerCase().includes(search.toLowerCase());
    return !isBusyInOtherRoom && matchesSearch;
  });

  return (
    <div className="fixed left-0 top-0 h-full z-50 flex items-center">
      <motion.div
        initial={false}
        animate={{ width: isOpen ? 320 : 0 }}
        className="h-full bg-card/80 backdrop-blur-2xl border-r border-border/50 shadow-2xl relative overflow-hidden flex flex-col"
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Add Members</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Manage Room Access</p>
            </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-muted/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>

          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="space-y-2 pb-4">
              {loading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">No available users found</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Users in other rooms are hidden</p>
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isMember = roomParticipants.includes(u.auth_user_id);
                  return (
                    <div 
                      key={u.auth_user_id}
                      className={`group flex items-center gap-3 p-3 rounded-2xl transition-all border ${
                        isMember 
                          ? 'bg-primary/10 border-primary/30 shadow-sm' 
                          : 'hover:bg-muted/40 border-transparent hover:border-border/40'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            isMember ? 'bg-primary text-primary-foreground' : 'bg-primary/20 text-primary'
                          }`}>
                            {u.name.charAt(0)}
                          </div>
                        )}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${isMember ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isMember ? 'text-primary' : ''}`}>{u.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Checkbox 
                        checked={isMember}
                        onCheckedChange={() => toggleMember(u.auth_user_id, isMember)}
                        className="rounded-full w-5 h-5 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-sm"
                      />
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
          
          <div className="pt-4 border-t border-border/40">
            <p className="text-[9px] text-center text-muted-foreground opacity-60">
              Only online and available users are shown.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 w-8 bg-card/80 backdrop-blur-xl border border-l-0 border-border/50 rounded-r-xl flex items-center justify-center shadow-lg hover:bg-background transition-colors group"
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        )}
      </motion.button>
    </div>
  );
}
