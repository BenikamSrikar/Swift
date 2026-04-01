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

interface JoinRequestDialogProps {
  open: boolean;
  requesterName: string;
  requesterEmail?: string;
  requesterAvatar?: string | null;
  onAccept: () => void;
  onReject: () => void;
}

export default function JoinRequestDialog({
  open,
  requesterName,
  requesterEmail,
  requesterAvatar,
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
              {requesterAvatar ? (
                <img src={requesterAvatar} alt={requesterName} className="w-10 h-10 rounded-full shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
                  {requesterName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-foreground">{requesterName}</p>
                {requesterEmail && (
                  <p className="text-xs text-muted-foreground truncate">{requesterEmail}</p>
                )}
                <p className="text-sm text-muted-foreground mt-0.5">wants to join the room</p>
              </div>
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
