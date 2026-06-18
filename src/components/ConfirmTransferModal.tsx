import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText } from 'lucide-react';

interface ConfirmTransferModalProps {
  open: boolean;
  files: File[];
  targetName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmTransferModal({ open, files, targetName, onConfirm, onCancel }: ConfirmTransferModalProps) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md animate-in fade-in zoom-in-95 duration-200">
        <DialogHeader>
          <DialogTitle>Confirm Transfer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="bg-muted/30 rounded-xl border border-border/50 p-4">
            <h4 className="text-sm font-medium mb-3">Sending to {targetName}:</h4>
            <div className="max-h-[40vh] overflow-y-auto space-y-2 custom-scrollbar">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-3 bg-background p-2 rounded-lg border border-border/40">
                  <FileText className="h-5 w-5 text-blue-500/70 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                </div>
              ))}
            </div>
            {files.length > 1 && (
              <div className="mt-3 pt-3 border-t border-border/40 flex justify-between text-sm">
                <span className="text-muted-foreground">Total: {files.length} files</span>
                <span className="font-medium">{formatSize(totalSize)}</span>
              </div>
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground text-center">
            Are you sure you want to transfer {files.length === 1 ? 'this file' : 'these items as a zipped package'}?
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 h-11 px-4 text-xs font-bold uppercase tracking-widest rounded-xl border border-border hover:bg-muted transition-all active:scale-95"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              className="flex-1 h-11 px-4 text-xs font-black uppercase tracking-widest rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
            >
              Start Transfer
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
