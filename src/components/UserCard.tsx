import UserAvatar from './UserAvatar';
import { Button } from '@/components/ui/button';
import { File, FolderOpen, X } from 'lucide-react';

interface UserCardProps {
  name: string;
  isCurrentUser?: boolean;
  isHost?: boolean;
  showHostControls?: boolean;
  onRequestFile?: () => void;
  onRequestFolder?: () => void;
  onRemove?: () => void;
}

export default function UserCard({
  name,
  isCurrentUser,
  isHost,
  showHostControls,
  onRequestFile,
  onRequestFolder,
  onRemove,
}: UserCardProps) {
  return (
    <div className="volts-card p-4 rounded-xl border bg-card">
      {/* Top row: avatar + name left, host badge or remove right */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar name={name} size="lg" />
          <div className="min-w-0">
            <span className="font-semibold text-base truncate block">{name}</span>
            {isHost && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded inline-block mt-0.5">
                Host
              </span>
            )}
            {isCurrentUser && !isHost && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground inline-block mt-0.5">
                You
              </span>
            )}
          </div>
        </div>

        {showHostControls && !isCurrentUser && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive shrink-0"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Bottom row: transfer buttons */}
      {!isCurrentUser && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-xs"
            onClick={onRequestFile}
          >
            <File className="h-3.5 w-3.5" />
            Request File
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-xs"
            onClick={onRequestFolder}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Request Folder
          </Button>
        </div>
      )}
    </div>
  );
}
