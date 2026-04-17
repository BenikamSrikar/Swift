import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, FileIcon, FolderIcon, Pause, Play } from 'lucide-react';

export interface QueuedTransfer {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  direction: 'sending' | 'receiving';
  type: 'file' | 'folder' | 'video';
}

interface TransferQueueProps {
  transfers: QueuedTransfer[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}

export default function TransferQueue({ transfers, onPause, onResume }: TransferQueueProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (transfers.length === 0) return null;

  const activeCount = transfers.filter(t => t.status === 'processing' || t.status === 'pending' || t.status === 'paused').length;

  return (
    <div className="fixed bottom-6 right-6 w-85 max-h-[80vh] flex flex-col bg-card/95 backdrop-blur-md border rounded-2xl shadow-2xl overflow-hidden animate-fade-in z-50 border-white/10">
      <div 
        className="p-4 flex items-center justify-between volts-gradient cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3 text-white">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-black uppercase tracking-widest">Transfers</span>
          {activeCount > 0 && (
            <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-black">
              {activeCount}
            </span>
          )}
        </div>
        <button className="text-white hover:bg-white/10 rounded-full p-1.5 transition-colors">
          {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-card/50 custom-scrollbar">
          {transfers.map((t) => (
            <QueueItem 
              key={t.id} 
              transfer={t} 
              onPause={onPause} 
              onResume={onResume}
            />
          ))}
        </div>
      )}

      {isCollapsed && transfers.length > 0 && (
        <div className="p-3 bg-card/80 border-t">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Overall Progress</span>
            <span className="text-[10px] font-mono font-black text-primary">
              {Math.round(transfers.reduce((acc, curr) => acc + curr.progress, 0) / transfers.length)}%
            </span>
          </div>
          <Progress 
            value={transfers.reduce((acc, curr) => acc + curr.progress, 0) / transfers.length} 
            className="h-1.5"
          />
        </div>
      )}
    </div>
  );
}

function QueueItem({ 
  transfer, 
  onPause, 
  onResume 
}: { 
  transfer: QueuedTransfer; 
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}) {
  const [itemCollapsed, setItemCollapsed] = useState(false);

  return (
    <div className={`border rounded-xl p-4 transition-all duration-300 ${transfer.status === 'paused' ? 'bg-orange-500/5 border-orange-500/20' : 'bg-muted/30 hover:bg-muted/50'}`}>
      <div className="flex items-start justify-between gap-3">
        <div 
          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
          onClick={() => setItemCollapsed(!itemCollapsed)}
        >
          <div className={`shrink-0 p-2 rounded-lg ${transfer.type === 'folder' ? 'bg-primary/10' : 'bg-blue-500/10'}`}>
            {transfer.type === 'folder' ? (
              <FolderIcon className="h-4 w-4 text-primary" />
            ) : (
              <FileIcon className="h-4 w-4 text-blue-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate leading-tight mb-0.5">{transfer.name}</p>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${transfer.direction === 'sending' ? 'bg-primary/10 text-primary' : 'bg-green-500/10 text-green-600'}`}>
                {transfer.direction === 'sending' ? 'Sending' : 'Receiving'}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {(transfer.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
          </div>
        </div>
        
        <div className="shrink-0 flex items-center gap-2">
          {transfer.status === 'processing' && onPause && (
            <button 
              onClick={() => onPause(transfer.id)}
              className="p-1.5 hover:bg-primary/10 rounded-full transition-colors group"
            >
              <Pause className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
            </button>
          )}
          {transfer.status === 'paused' && onResume && (
            <button 
              onClick={() => onResume(transfer.id)}
              className="p-1.5 hover:bg-green-500/10 rounded-full transition-colors group"
            >
              <Play className="h-3.5 w-3.5 text-green-600 group-hover:scale-110 transition-transform" />
            </button>
          )}
          <div className="shrink-0 flex flex-col items-end gap-1">
            {transfer.status === 'completed' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : transfer.status === 'failed' ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <span className="text-[10px] font-mono font-black text-primary">{Math.round(transfer.progress)}%</span>
            )}
          </div>
        </div>
      </div>

      {!itemCollapsed && (
        <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
          <Progress value={transfer.progress} className={`h-1.5 ${transfer.status === 'paused' ? 'bg-orange-200' : ''}`} />
          <div className="flex justify-between items-center">
            <span className={`text-[9px] font-black uppercase tracking-widest ${transfer.status === 'paused' ? 'text-orange-600' : 'text-muted-foreground/60'}`}>
              {transfer.status}
            </span>
            <span className="text-[9px] font-mono font-bold text-muted-foreground">
              {transfer.progress === 100 ? 'Completed' : `${transfer.progress.toFixed(0)}%`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
