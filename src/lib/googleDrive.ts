const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

export const SIZE_THRESHOLD = 25 * 1024 * 1024; // 25MB

export async function uploadToGoogleDrive(
  file: File | Blob,
  fileName: string,
  accessToken: string,
  onStatus?: (status: string) => void
): Promise<{ fileId: string; downloadLink: string }> {
  onStatus?.('Uploading to Google Drive...');

  const metadata = {
    name: fileName,
    mimeType: (file as File).type || 'application/octet-stream',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const uploadRes = await fetch(`${DRIVE_UPLOAD_API}?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Drive upload failed (${uploadRes.status}): ${errText}`);
  }

  const fileData = await uploadRes.json();

  onStatus?.('Setting sharing permissions...');

  await fetch(`${DRIVE_API}/${fileData.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  onStatus?.('Generating download link...');

  const linkRes = await fetch(
    `${DRIVE_API}/${fileData.id}?fields=webContentLink,webViewLink`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const linkData = await linkRes.json();

  return {
    fileId: fileData.id,
    downloadLink: linkData.webContentLink || linkData.webViewLink,
  };
}

export async function deleteFromGoogleDrive(
  fileId: string,
  accessToken: string
): Promise<void> {
  await fetch(`${DRIVE_API}/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function scheduleGoogleDriveCleanup(
  fileId: string,
  accessToken: string,
  delayMs: number = 5 * 60 * 1000
): void {
  setTimeout(async () => {
    try {
      await deleteFromGoogleDrive(fileId, accessToken);
      console.log(`Drive file ${fileId} auto-deleted after ${delayMs / 1000}s`);
    } catch (err) {
      console.warn(`Failed to auto-delete Drive file ${fileId}:`, err);
    }
  }, delayMs);
}
