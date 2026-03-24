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

interface TransferRequestDialogProps {
  open: boolean;
  requesterName: string;
  type: 'file' | 'folder' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export default function TransferRequestDialog({
  open,
  requesterName,
  type,
  onAccept,
  onReject,
}: TransferRequestDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{type === 'file' ? 'File' : 'Folder'} Request</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{requesterName}</span>{' '}
            is requesting a {type} from you. Would you like to select and send?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onReject}>Decline</AlertDialogCancel>
          <AlertDialogAction onClick={onAccept} className="bg-primary hover:bg-primary/90">
            Select & Send
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
