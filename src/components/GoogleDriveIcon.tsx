import React from 'react';

export default function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <img 
      src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" 
      alt="Google Drive" 
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}

