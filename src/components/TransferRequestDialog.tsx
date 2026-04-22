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
  type: 'file' | 'folder' | 'video' | 'link';
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
  const getTypeText = () => {
    switch (type) {
      case 'file': return 'File';
      case 'folder': return 'Folder';
      case 'video': return 'Video';
      case 'link': return 'Link/URL';
      default: return 'Transfer';
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Incoming {getTypeText()}</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{requesterName}</span>{' '}
            wants to share a {type === 'link' ? 'link' : type} with you. Do you want to accept this transfer?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onReject}>Decline</AlertDialogCancel>
          <AlertDialogAction onClick={onAccept} className="bg-primary hover:bg-primary/90">
            Accept Transfer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
