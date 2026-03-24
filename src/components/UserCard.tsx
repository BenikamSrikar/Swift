import UserAvatar from './UserAvatar';
import { Button } from '@/components/ui/button';
import { File, FolderOpen, X } from 'lucide-react';

interface UserCardProps {
  name: string;
  isHost?: boolean;
  showHostControls?: boolean;
  onRequestFile?: () => void;
  onRequestFolder?: () => void;
  onRemove?: () => void;
}

export default function UserCard({
  name,
  isHost,
  showHostControls,
  onRequestFile,
  onRequestFolder,
  onRemove,
}: UserCardProps) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border bg-card w-full">
      {/* Left: avatar + name */}
      <UserAvatar name={name} size="lg" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold text-base truncate block">{name}</span>
        {isHost && (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded inline-block mt-0.5">
            Host
          </span>
        )}
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onRequestFile}>
          <File className="h-3.5 w-3.5" />
          File
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onRequestFolder}>
          <FolderOpen className="h-3.5 w-3.5" />
          Folder
        </Button>
        {showHostControls && (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onRemove}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
