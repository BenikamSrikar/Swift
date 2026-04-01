import UserAvatar from './UserAvatar';
import { Button } from '@/components/ui/button';
import { File, FolderOpen, X } from 'lucide-react';

interface UserCardProps {
  name: string;
  avatarUrl?: string | null;
  isHost?: boolean;
  showHostControls?: boolean;
  onRequestFile?: () => void;
  onRequestFolder?: () => void;
  onRemove?: () => void;
}

export default function UserCard({
  name,
  avatarUrl,
  isHost,
  showHostControls,
  onRequestFile,
  onRequestFolder,
  onRemove,
}: UserCardProps) {
  return (
    <div className="relative group volts-card p-5 flex flex-row items-center gap-4 sm:flex-col sm:items-center sm:justify-center sm:aspect-square sm:w-44 transition-all duration-300 hover:-translate-y-1">
      {showHostControls && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-1.5 right-1.5 h-6 w-6 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}

      <UserAvatar name={name} avatarUrl={avatarUrl} size="lg" />

      {isHost && (
        <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
          Host
        </span>
      )}

      <div className="min-w-0 flex-1 sm:flex-none text-left sm:text-center">
        <span className="font-semibold text-sm truncate block">{name}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="outline" className="gap-1 text-xs h-8 px-2.5" onClick={onRequestFile}>
          <File className="h-3.5 w-3.5" />
          File
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-xs h-8 px-2.5" onClick={onRequestFolder}>
          <FolderOpen className="h-3.5 w-3.5" />
          Folder
        </Button>
      </div>
    </div>
  );
}
