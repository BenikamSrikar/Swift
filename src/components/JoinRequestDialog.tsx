import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import UserAvatar from './UserAvatar';

interface JoinRequestDialogProps {
  open: boolean;
  requesterName: string;
  onAccept: () => void;
  onReject: () => void;
}

export default function JoinRequestDialog({
  open,
  requesterName,
  onAccept,
  onReject,
}: JoinRequestDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Join Request</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex items-center gap-3 mt-2">
              <UserAvatar name={requesterName} />
              <span className="font-medium text-foreground">{requesterName}</span>
              <span className="text-muted-foreground">wants to join the room</span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onReject}>Reject</AlertDialogCancel>
          <AlertDialogAction
            onClick={onAccept}
            className="bg-primary hover:bg-primary/90"
          >
            Accept
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
