import UserAvatar from './UserAvatar';
import SignalStrength from './SignalStrength';
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
    <div className="volts-card p-4 flex items-center gap-4">
      <UserAvatar name={name} size="lg" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{name}</span>
          {isHost && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
              Host
            </span>
          )}
          {isCurrentUser && !isHost && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              You
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isCurrentUser && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs"
              onClick={onRequestFile}
            >
              <File className="h-3 w-3" />
              File
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs"
              onClick={onRequestFolder}
            >
              <FolderOpen className="h-3 w-3" />
              Folder
            </Button>
          </>
        )}
        {showHostControls && !isCurrentUser && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <SignalStrength />
    </div>
  );
}
