import React from 'react';

export default function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <path 
        d="M14.745 3.5h-5.49L3 14.503l2.744 4.755 12.73-22.03-3.729 6.275Z" 
        fill="#0066DA" 
      />
      <path 
        d="m14.745 3.5 6.255 11.003-3.5 6l-6.255-11.003h3.5Z" 
        fill="#00AC47" 
      />
      <path 
        d="m5.744 19.258 3.5-6h11.756l-3.5 6H5.744Z" 
        fill="#FFBA00" 
      />
    </svg>
  );
}
