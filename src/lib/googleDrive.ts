import { supabase } from "@/integrations/supabase/client";

/**
 * Utility to interact with Google Drive API using Supabase Provider Token
 */
export async function getGoogleAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  
  // provider_token is available if the user signed in with Google
  // and it hasn't expired.
  return (data.session as any).provider_token;
}

export async function uploadToDrive(
  file: Blob, 
  fileName: string, 
  accessToken: string, 
  onProgress?: (percent: number) => void
) {
  return new Promise((resolve, reject) => {
    const metadata = {
      name: fileName,
      mimeType: file.type || 'application/octet-stream',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink');
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        const error = JSON.parse(xhr.responseText || '{}');
        reject(new Error(error.error?.message || 'Failed to upload to Google Drive'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during Google Drive upload'));
    xhr.send(form);
  });
}

export async function shareFileWithEmail(fileId: string, email: string, accessToken: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'user',
      emailAddress: email,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Failed to share file on Google Drive');
  }

  return await response.json();
}

export async function deleteFileFromDrive(fileId: string, accessToken: string) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
