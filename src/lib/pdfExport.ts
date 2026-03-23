interface HistoryRecord {
  file_name: string;
  recipient_name: string;
  file_type: string;
  transferred_at: string;
  sender_name: string;
}

export function generateHistoryPdf(senderName: string, records: HistoryRecord[]) {
  // Build a simple HTML-based printable PDF
  const rows = records
    .map(
      (r) => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.recipient_name}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.file_name}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${r.file_type}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${new Date(r.transferred_at).toLocaleString()}</td>
    </tr>`
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>VOLTS Transfer History</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; color: #1a1a1a; }
        h1 { font-size: 20px; color: #e63946; margin-bottom: 4px; }
        .subtitle { font-size: 14px; color: #666; margin-bottom: 24px; }
        table { border-collapse: collapse; width: 100%; }
        th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #e63946; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
        td { font-size: 13px; }
      </style>
    </head>
    <body>
      <h1>VOLTS — Transfer History</h1>
      <p class="subtitle">Sender: ${senderName} · Exported: ${new Date().toLocaleString()}</p>
      <table>
        <thead>
          <tr>
            <th>Recipient</th>
            <th>File / Folder</th>
            <th>Type</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      win.print();
    };
  }
}
