import UserAvatar from './UserAvatar';
import { Button } from '@/components/ui/button';
import { File, FolderOpen, Video, X } from 'lucide-react';

interface UserCardProps {
  name: string;
  isHost?: boolean;
  showHostControls?: boolean;
  onRequestFile?: () => void;
  onRequestFolder?: () => void;
  onRequestVideo?: () => void;
  onRemove?: () => void;
}

export default function UserCard({
  name,
  isHost,
  showHostControls,
  onRequestFile,
  onRequestFolder,
  onRequestVideo,
  onRemove,
}: UserCardProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 rounded-xl border bg-card w-full">
      {/* Left: avatar + name */}
      <div className="flex items-center gap-3 min-w-0">
        <UserAvatar name={name} size="lg" />
        <div className="min-w-0">
          <span className="font-semibold text-base truncate block">{name}</span>
          {isHost && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded inline-block mt-0.5">
              Host
            </span>
          )}
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto shrink-0">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onRequestFile}>
          <File className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Request</span> File
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onRequestFolder}>
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Request</span> Folder
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={onRequestVideo}>
          <Video className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Request</span> Video
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
