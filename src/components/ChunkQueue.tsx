import { QueuedTransfer } from './TransferQueue';
import { Package, CheckCircle2, Loader2, HardDrive } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ChunkQueueProps {
  transfers: QueuedTransfer[];
  receivingChunks: Map<string, { 
    chunks: (Blob | null)[], 
    downloadedCount: number,
    totalChunks: number,
    isFinalizing: boolean
  }>;
}

export default function ChunkQueue({ transfers, receivingChunks }: ChunkQueueProps) {
  const activeReceiving = transfers.filter(t => t.direction === 'receiving' && t.status === 'processing');

  if (activeReceiving.length === 0) return null;

  return (
    <div className="fixed left-6 top-1/2 -translate-y-1/2 w-72 max-h-[70vh] flex flex-col bg-background/80 backdrop-blur-xl border border-border/40 rounded-3xl shadow-2xl overflow-hidden z-40 animate-in slide-in-from-left-4 duration-500">
      <div className="p-4 border-b border-border/10 bg-primary/5 flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Package className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest">Chunk Staging</h3>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Asynchronous Buffer</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {activeReceiving.map(t => {
          const rec = receivingChunks.get(t.id);
          if (!rec) return null;

          return (
            <div key={t.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold truncate max-w-[150px]">{t.name}</span>
                <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {rec.downloadedCount}/{rec.totalChunks}
                </span>
              </div>
              
              <div className="grid grid-cols-8 gap-1">
                {rec.chunks.map((chunk, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      chunk 
                        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' 
                        : 'bg-muted-foreground/10'
                    }`}
                    title={`Chunk ${i + 1}`}
                  />
                ))}
              </div>

              {rec.downloadedCount === rec.totalChunks ? (
                <div className="flex items-center gap-2 text-[9px] font-bold text-green-500 animate-pulse">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>READY FOR ASSEMBLY</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>WAITING FOR NEXT CHUNK...</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-muted/30 border-t border-border/10">
        <div className="flex items-center gap-2">
          <HardDrive className="h-3 w-3 text-muted-foreground" />
          <span className="text-[8px] font-black text-muted-foreground uppercase tracking-wider">Storage Pipeline Active</span>
        </div>
      </div>
    </div>
  );
}
