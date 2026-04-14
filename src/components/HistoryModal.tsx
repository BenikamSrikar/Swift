/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Download, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

interface HistoryRecord {
  id: string;
  file_name: string;
  recipient_name: string;
  file_type: string;
  transferred_at: string;
  sender_name: string;
  sender_email?: string | null;
  direction?: string;
  download_url?: string | null;
}

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  senderEmail: string;
  senderName: string;
}

export default function HistoryModal({ open, onClose, senderEmail, senderName }: HistoryModalProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !senderEmail) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('transfer_history')
          .select('*')
          .or(`sender_email.eq.${senderEmail},recipient_name.eq."${senderName}"`)
          .order('transferred_at', { ascending: false });

        if (error) throw error;

        const processed: HistoryRecord[] = (data || []).map((r: any) => ({
          ...r,
          direction: r.sender_email === senderEmail ? 'sent' : 'received'
        }));
        
        setRecords(processed);
      } catch (err) {
        console.error('History fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [open, senderEmail, senderName]);

  const groupByDay = (data: HistoryRecord[]) => {
    const groups: Record<string, HistoryRecord[]> = {};
    data.forEach((r) => {
      const date = parseISO(r.transferred_at);
      let label: string;
      if (isToday(date)) label = 'Today';
      else if (isYesterday(date)) label = 'Yesterday';
      else label = format(date, 'MMMM d, yyyy');

      if (!groups[label]) groups[label] = [];
      groups[label].push(r);
    });
    return groups;
  };

  const handleDownloadPdf = () => {
    const rows = records
      .map(
        (r) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.direction === 'sent' ? '↑ Sent' : '↓ Received'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.direction === 'sent' ? r.recipient_name : (r.sender_name || 'Unknown')}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.file_name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.file_type}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${new Date(r.transferred_at).toLocaleString()}</td>
      </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><title>SWIFT Transfer History</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; color: #1a1a1a; }
        h1 { font-size: 20px; color: #e63946; margin-bottom: 4px; }
        .subtitle { font-size: 14px; color: #666; margin-bottom: 24px; }
        table { border-collapse: collapse; width: 100%; }
        th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #e63946; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
        td { font-size: 13px; }
      </style></head><body>
      <h1>SWIFT — Transfer History</h1>
      <p class="subtitle">User: ${senderName} (${senderEmail}) · Exported: ${new Date().toLocaleString()}</p>
      <table><thead><tr><th>Direction</th><th>From/To</th><th>File / Folder</th><th>Type</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swift-history-${format(new Date(), 'yyyy-MM-dd')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grouped = groupByDay(records);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Transfer History</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading history...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transfer history yet</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([dayLabel, dayRecords]) => (
                <div key={dayLabel}>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
                    {dayLabel}
                  </h3>
                  <div className="border rounded-xl overflow-hidden bg-card/50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-[10px] uppercase tracking-tighter">
                          <th className="text-left px-3 py-2 w-8"></th>
                          <th className="text-left px-3 py-2">From / To</th>
                          <th className="text-left px-3 py-2">File</th>
                          <th className="text-left px-3 py-2">Type</th>
                          <th className="text-left px-3 py-2">Time</th>
                          <th className="text-left px-3 py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayRecords.map((r) => {
                          const isSent = r.direction === 'sent';
                          return (
                            <tr key={r.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2 text-center">
                                {isSent ? (
                                  <ArrowUpRight className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
                                ) : (
                                  <ArrowDownLeft className="h-3.5 w-3.5 text-green-500" strokeWidth={1.5} />
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1 opacity-60">
                                  {isSent ? 'To' : 'From'}
                                </span>
                                <span className="font-medium truncate block sm:inline">
                                  {isSent ? (r.recipient_name || 'Anonymous') : (r.sender_name || r.sender_email || 'Unknown')}
                                </span>
                              </td>
                              <td className="px-3 py-2 truncate max-w-[150px] font-mono text-[11px]">{r.file_name}</td>
                              <td className="px-3 py-2">
                                <span className="bg-muted px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter">
                                  {r.file_type}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground text-[11px] font-medium">
                                {format(parseISO(r.transferred_at), 'h:mm a')}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {r.download_url && (
                                  <a
                                    href={r.download_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:text-primary/80 transition-colors"
                                  >
                                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                                  </a>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {records.length > 0 && (
          <div className="pt-4 border-t flex justify-end">
            <Button variant="default" size="sm" className="gap-2 volts-gradient" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" strokeWidth={1.5} />
              Download Log
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
