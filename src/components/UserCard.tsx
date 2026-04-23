import UserAvatar from './UserAvatar';
import { Button } from '@/components/ui/button';
import { File, FolderOpen, Link, X } from 'lucide-react';

interface UserCardProps {
  name: string;
  avatarUrl?: string | null;
  isHost?: boolean;
  isLocalUser?: boolean;
  showHostControls?: boolean;
  onRequestFile?: () => void;
  onRequestFolder?: () => void;
  onRemove?: () => void;
}

export default function UserCard({
  name,
  avatarUrl,
  isHost,
  isLocalUser,
  showHostControls,
  onRequestFile,
  onRequestFolder,
  onRemove,
}: UserCardProps) {
  return (
    <div className="relative group volts-card p-5 flex flex-col items-center justify-center gap-4 aspect-video w-full transition-all duration-300 hover:shadow-xl hover:bg-muted/10 bg-muted/5 border-border/40">
      {showHostControls && !isLocalUser && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-3 right-3 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <UserAvatar name={name} avatarUrl={avatarUrl} size="xl" />

      {isHost && (
        <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-[0.2em] bg-primary text-primary-foreground px-2 py-1 rounded-sm shadow-sm">
          Host
        </span>
      )}

      <div className="text-center w-full px-2">
        <span className="font-bold text-base truncate block text-foreground tracking-tight">{name}</span>
      </div>

      {!isLocalUser && (
        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button size="sm" variant="secondary" className="gap-2 text-xs h-9 px-4 font-bold rounded-full shadow-sm hover:bg-primary hover:text-primary-foreground transition-all" onClick={onRequestFile}>
            <File className="h-4 w-4" />
            Send File
          </Button>
          <Button size="sm" variant="secondary" className="gap-2 text-xs h-9 px-4 font-bold rounded-full shadow-sm hover:bg-primary hover:text-primary-foreground transition-all" onClick={onRequestFolder}>
            <FolderOpen className="h-4 w-4" />
            Send Folder
          </Button>

        </div>
      )}
    </div>
  );
}
