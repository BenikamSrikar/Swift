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
  direction?: string;
  download_url?: string;
}

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  senderEmail: string;
  senderName: string;
}

function groupByDay(records: HistoryRecord[]) {
  const groups: Map<string, HistoryRecord[]> = new Map();
  for (const r of records) {
    const date = parseISO(r.transferred_at);
    let label: string;
    if (isToday(date)) label = 'Today';
    else if (isYesterday(date)) label = 'Yesterday';
    else label = format(date, 'MMMM d, yyyy');

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(r);
  }
  return groups;
}

export default function HistoryModal({ open, onClose, senderEmail, senderName }: HistoryModalProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !senderEmail) return;
    setLoading(true);
    supabase
      .from('transfer_history')
      .select('*')
      .eq('sender_email', senderEmail)
      .order('transferred_at', { ascending: false })
      .then(({ data }) => {
        setRecords((data as HistoryRecord[]) || []);
        setLoading(false);
      });
  }, [open, senderEmail]);

  const handleDownloadPdf = () => {
    const rows = records
      .map(
        (r) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${(r.direction || 'sent') === 'sent' ? '↑ Sent' : '↓ Received'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${(r.direction || 'sent') === 'sent' ? r.recipient_name : r.sender_name}</td>
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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Transfer History</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No transfer history yet</p>
          ) : (
            <div className="space-y-6">
              {Array.from(grouped.entries()).map(([dayLabel, dayRecords]) => (
                <div key={dayLabel}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {dayLabel}
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-8"></th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">From / To</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">File</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Time</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayRecords.map((r) => {
                          const dir = (r.direction || 'sent') as string;
                          const isSent = dir === 'sent';
                          return (
                            <tr key={r.id} className="border-t border-border/50">
                              <td className="px-3 py-2">
                                {isSent ? (
                                  <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <ArrowDownLeft className="h-3.5 w-3.5 text-green-500" />
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
                                  {isSent ? 'To' : 'From'}
                                </span>
                                {isSent ? r.recipient_name : r.sender_name}
                              </td>
                              <td className="px-3 py-2 truncate max-w-[180px]">{r.file_name}</td>
                              <td className="px-3 py-2 capitalize">{r.file_type}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {format(parseISO(r.transferred_at), 'h:mm a')}
                              </td>
                              <td className="px-3 py-2">
                                {r.download_url && (
                                  <a
                                    href={r.download_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:text-primary/80"
                                    title="Download from Drive"
                                  >
                                    <Download className="h-3.5 w-3.5" />
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
            <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
