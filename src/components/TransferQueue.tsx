import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, FileIcon, FolderIcon } from 'lucide-react';
import GoogleDriveIcon from './GoogleDriveIcon';

export interface QueuedTransfer {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  direction: 'sending' | 'receiving';
  type: 'file' | 'folder' | 'video' | 'drive-link';
  downloadUrl?: string;
}

interface TransferQueueProps {
  transfers: QueuedTransfer[];
}

export default function TransferQueue({ transfers }: TransferQueueProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (transfers.length === 0) return null;

  const activeCount = transfers.filter(t => t.status === 'processing' || t.status === 'pending').length;

  return (
    <div className="fixed bottom-6 right-6 w-80 max-h-[80vh] flex flex-col bg-card border rounded-xl shadow-2xl overflow-hidden animate-fade-in z-50">
      <div 
        className="p-4 flex items-center justify-between volts-gradient cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2 text-white">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-bold uppercase tracking-wider">Progress Queue</span>
          {activeCount > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </div>
        <button className="text-white hover:bg-white/10 rounded-full p-1 transition-colors">
          {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-card">
          {transfers.map((t) => (
            <QueueItem key={t.id} transfer={t} />
          ))}
        </div>
      )}

      {isCollapsed && transfers.length > 0 && (
        <div className="p-2 bg-card border-t">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Current Progress</span>
            <span className="text-[10px] font-mono font-bold text-primary">
              {Math.round(transfers.reduce((acc, curr) => acc + curr.progress, 0) / transfers.length)}%
            </span>
          </div>
          <div className="px-2 pb-1 mt-1">
            <Progress 
              value={transfers.reduce((acc, curr) => acc + curr.progress, 0) / transfers.length} 
              className="h-1"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function QueueItem({ transfer }: { transfer: QueuedTransfer }) {
  const [itemCollapsed, setItemCollapsed] = useState(false);

  return (
    <div className="border rounded-lg p-3 bg-muted/40 transition-all hover:bg-muted/60">
      <div 
        className="flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => setItemCollapsed(!itemCollapsed)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0">
            {transfer.type === 'folder' ? (
              <FolderIcon className="h-4 w-4 text-primary" />
            ) : transfer.type === 'drive-link' ? (
              <GoogleDriveIcon className="h-4 w-4 hover:animate-pulse" />
            ) : (
              <FileIcon className="h-4 w-4 text-blue-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate leading-tight">{transfer.name}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
              {transfer.direction === 'sending' ? 'Sending' : 'Receiving'} • {(transfer.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {transfer.status === 'completed' ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : transfer.status === 'failed' ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <span className="text-[10px] font-mono font-bold text-primary">{Math.round(transfer.progress)}%</span>
          )}
          <button className="text-muted-foreground/50 hover:text-foreground">
            {itemCollapsed ? <ChevronDown className="h-3 w-3" strokeWidth={1.5} /> : <ChevronUp className="h-3 w-3" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {!itemCollapsed && (
        <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <Progress value={transfer.progress} className="h-1.5" />
          <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
            <span>{transfer.status}</span>
            <span>{transfer.progress === 100 ? 'done' : `${transfer.progress.toFixed(0)}%`}</span>
          </div>
        </div>
      )}
    </div>
  );
}
