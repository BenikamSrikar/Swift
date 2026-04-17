import UserAvatar from './UserAvatar';
import { Button } from '@/components/ui/button';
import { File, FolderOpen, X } from 'lucide-react';

interface UserCardProps {
  name: string;
  avatarUrl?: string | null;
  isHost?: boolean;
  showHostControls?: boolean;
  onSendFile?: () => void;
  onSendFolder?: () => void;
  onRemove?: () => void;
}

export default function UserCard({
  name,
  avatarUrl,
  isHost,
  showHostControls,
  onSendFile,
  onSendFolder,
  onRemove,
}: UserCardProps) {
  return (
    <div className="relative group volts-card p-5 flex flex-row items-center gap-4 sm:flex-col sm:items-center sm:justify-center sm:min-w-[200px] sm:flex-1 transition-all duration-300 hover:-translate-y-1">
      {showHostControls && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 right-2 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <UserAvatar name={name} avatarUrl={avatarUrl} size="lg" />

      {isHost && (
        <span className="absolute top-2 left-2 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
          Host
        </span>
      )}

      <div className="min-w-0 flex-1 sm:flex-none text-left sm:text-center mt-2">
        <span className="font-bold text-sm truncate block">{name}</span>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <Button size="sm" variant="outline" className="gap-2 text-xs h-9 px-4 rounded-full border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors" onClick={onSendFile}>
          <File className="h-4 w-4" />
          Send File
        </Button>
        <Button size="sm" variant="outline" className="gap-2 text-xs h-9 px-4 rounded-full border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors" onClick={onSendFolder}>
          <FolderOpen className="h-4 w-4" />
          Send Folder
        </Button>
      </div>
    </div>
  );
}
