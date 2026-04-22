import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link as LinkIcon, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface LinkModalProps {
  open: boolean;
  onClose: () => void;
  onSend: (link: string) => void;
}

export default function LinkModal({ open, onClose, onSend }: LinkModalProps) {
  const [link, setLink] = useState('');

  const handleSend = () => {
    if (link.trim()) {
      onSend(link.trim());
      setLink('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            Share Link or URL
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Textarea
            placeholder="Paste or type your links/URLs here..."
            className="min-h-[120px] resize-none focus-visible:ring-primary"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-xl h-11 text-xs font-bold uppercase tracking-widest"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl h-11 text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
              onClick={handleSend}
              disabled={!link.trim()}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
