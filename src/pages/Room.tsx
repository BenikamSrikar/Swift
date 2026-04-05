import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import UserCard from '@/components/UserCard';
import UserAvatar from '@/components/UserAvatar';
import SignalStrength from '@/components/SignalStrength';
import JoinRequestDialog from '@/components/JoinRequestDialog';
import TransferRequestDialog from '@/components/TransferRequestDialog';
import UploadModal from '@/components/UploadModal';
import HistoryModal from '@/components/HistoryModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import JSZip from 'jszip';
import { uploadToGoogleDrive, scheduleGoogleDriveCleanup, SIZE_THRESHOLD } from '@/lib/googleDrive';

const DATA_CHANNEL_CHUNK_SIZE = 262144;
const DATA_CHANNEL_BUFFER_LIMIT = DATA_CHANNEL_CHUNK_SIZE * 8;

type WritableFileStreamLike = {
  write: (data: BlobPart) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandleLike = {
  createWritable: () => Promise<WritableFileStreamLike>;
};

type FileSystemDirectoryHandleLike = {
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemDirectoryHandleLike>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandleLike>;
};

interface Participant {
  user_id: string;
  name: string;
  status: string;
  email?: string;
  avatar_url?: string | null;
}

interface PendingRequest {
  userId: string;
  name: string;
  email?: string;
  avatar_url?: string | null;
}

interface TransferRequest {
  fromUserId: string;
  fromName: string;
  type: 'file' | 'folder' | 'video';
}

interface IncomingFolderFile {
  path: string;
  size: number;
  chunks: BlobPart[];
  writer?: WritableFileStreamLike | null;
}

interface IncomingFolderTransfer {
  zip: JSZip;
  folderName: string;
  totalFiles: number;
  receivedFiles: number;
  currentFile: IncomingFolderFile | null;
  mode: 'stream' | 'zip';
  rootDirectoryHandle: FileSystemDirectoryHandleLike | null;
  directoryCache: Map<string, FileSystemDirectoryHandleLike>;
}

interface TransferProgress {
  label: string;
  percent: number;
  direction: 'sending' | 'receiving';
}

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, profile, signOut, providerToken } = useAuth();
  const userId = user?.id;
  const userName = profile?.name;

  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [currentRequest, setCurrentRequest] = useState<PendingRequest | null>(null);
  const [transferRequest, setTransferRequest] = useState<TransferRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [uploadModal, setUploadModal] = useState<{ open: boolean; targetUserId: string; mode: 'file' | 'folder' } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [driveStatus, setDriveStatus] = useState<string | null>(null);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const transferChannelRef = useRef<any>(null);
  const folderReceiveTargets = useRef<Map<string, FileSystemDirectoryHandleLike>>(new Map());

  const isHost = room?.host_id === userId;
  const [removedByHost, setRemovedByHost] = useState(false);

  const requestDriveAccess = useCallback(async () => {
    setDriveStatus('Requesting Google Drive permission...');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/room/${roomId}`,
        scopes: 'https://www.googleapis.com/auth/drive.file',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      setDriveStatus(null);
      toast.error('Could not open Google Drive permission request.');
    }
  }, [roomId]);

  // Load room initially
  useEffect(() => {
    if (!userId || !userName || !roomId) {
      navigate('/');
      return;
    }

    const loadRoom = async () => {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (!roomData) {
        toast.error('Room not found');
        navigate(`/connection?userId=${userId}`);
        return;
      }

      setRoom(roomData);
    };

    loadRoom();
  }, [roomId, userId, userName, navigate]);

  // Load participants - fetch profiles for name/avatar/email
  const loadParticipants = useCallback(async () => {
    if (!roomId) return;

    const { data: parts } = await supabase
      .from('room_participants')
      .select('user_id, status')
      .eq('room_id', roomId);

    if (!parts) return;

    const myEntry = parts.find((p) => p.user_id === userId);
    if (myEntry && myEntry.status === 'blocked') {
      setRemovedByHost(true);
      return;
    }

    const accepted = parts.filter((p) => p.status === 'accepted');
    const pending = parts.filter((p) => p.status === 'pending');

    const userIds = [...accepted, ...pending].map((p) => p.user_id);
    if (userIds.length === 0) {
      setParticipants([]);
      setPendingRequests([]);
      return;
    }

    // Fetch profiles for avatar/email info
    const { data: profiles } = await supabase
      .from('profiles')
      .select('auth_user_id, name, email, avatar_url')
      .in('auth_user_id', userIds);

    // Fallback to sessions for name if no profile
    const { data: sessions } = await supabase
      .from('sessions')
      .select('user_id, name')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map((p) => [p.auth_user_id, p]) ?? []);
    const sessionMap = new Map(sessions?.map((s) => [s.user_id, s.name]) ?? []);

    setParticipants(
      accepted.map((p) => {
        const prof = profileMap.get(p.user_id);
        return {
          user_id: p.user_id,
          name: prof?.name || sessionMap.get(p.user_id) || 'Unknown',
          status: p.status,
          email: prof?.email,
          avatar_url: prof?.avatar_url,
        };
      })
    );

    const newPending = pending.map((p) => {
      const prof = profileMap.get(p.user_id);
      return {
        userId: p.user_id,
        name: prof?.name || sessionMap.get(p.user_id) || 'Unknown',
        email: prof?.email,
        avatar_url: prof?.avatar_url,
      };
    });

    setPendingRequests(newPending);
    if (newPending.length > 0) {
      setCurrentRequest((prev) => prev ?? newPending[0]);
    } else {
      setCurrentRequest(null);
    }
  }, [roomId, userId]);

  // Initial load of participants
  useEffect(() => {
    if (roomId) loadParticipants();
  }, [roomId, loadParticipants]);

  // Subscribe to participant changes - REAL-TIME fix
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-participants-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, loadParticipants]);

  // Single shared transfer/signaling channel
  useEffect(() => {
    if (!roomId || !userId) return;

    const channel = supabase.channel(`transfers-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'transfer-request' }, (payload) => {
      const { targetUserId, fromUserId, fromName, type } = payload.payload;
      if (targetUserId === userId) {
        setTransferRequest({ fromUserId, fromName, type });
      }
    });

    channel.on('broadcast', { event: 'webrtc-signal' }, async (payload) => {
      const { targetUserId, fromUserId, signal } = payload.payload;
      if (targetUserId !== userId) return;

      if (signal.type === 'offer') {
        await handleIncomingOffer(fromUserId, signal, channel);
      } else if (signal.type === 'answer') {
        const pc = peerConnections.current.get(fromUserId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        }
      } else if (signal.candidate) {
        const pc = peerConnections.current.get(fromUserId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(signal));
        }
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        transferChannelRef.current = channel;
      }
    });

    return () => {
      transferChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  const handleIncomingOffer = async (fromUserId: string, offer: RTCSessionDescriptionInit, channel: any) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    peerConnections.current.set(fromUserId, pc);

    pc.ondatachannel = (event) => {
      receiveFile(event.channel, fromUserId);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { targetUserId: fromUserId, fromUserId: userId, signal: event.candidate.toJSON() },
        });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    channel.send({
      type: 'broadcast',
      event: 'webrtc-signal',
      payload: { targetUserId: fromUserId, fromUserId: userId, signal: answer },
    });
  };

  const getNestedDirectoryHandle = async (
    rootHandle: FileSystemDirectoryHandleLike,
    relativePath: string,
    cache: Map<string, FileSystemDirectoryHandleLike>
  ) => {
    if (!relativePath) return rootHandle;

    let current = rootHandle;
    let composedPath = '';

    for (const segment of relativePath.split('/').filter(Boolean)) {
      composedPath = composedPath ? `${composedPath}/${segment}` : segment;
      const cached = cache.get(composedPath);

      if (cached) {
        current = cached;
        continue;
      }

      current = await current.getDirectoryHandle(segment, { create: true });
      cache.set(composedPath, current);
    }

    return current;
  };

  const receiveFile = (dc: RTCDataChannel, fromUserId: string) => {
    const chunks: BlobPart[] = [];
    let metadata: { name: string; size: number } | null = null;
    let folderTransfer: IncomingFolderTransfer | null = null;
    let messageQueue = Promise.resolve();

    const logReceiverHistory = async (fileName: string, fileType: string, downloadUrl?: string) => {
      const senderInfo = participants.find((p) => p.user_id === fromUserId);
      await supabase.from('transfer_history').insert({
        sender_id: userId!,
        sender_name: senderInfo?.name || 'Unknown',
        recipient_name: userName!,
        file_name: fileName,
        file_type: fileType,
        sender_email: profile?.email || '',
        direction: 'received',
        download_url: downloadUrl || null,
      } as any);
    };

    const processIncomingData = async (data: string | Blob | ArrayBuffer) => {
      if (typeof data === 'string') {
        const msg = JSON.parse(data);
        if (msg.type === 'metadata') {
          metadata = msg;
          folderTransfer = null;
          setDriveStatus(`Receiving: ${msg.name}`);
          toast.info(`Receiving: ${msg.name}`, { duration: 3000 });
        } else if (msg.type === 'folder-start') {
          const selectedTarget = folderReceiveTargets.current.get(fromUserId) || null;
          const rootDirectoryHandle = selectedTarget
            ? await selectedTarget.getDirectoryHandle(msg.name, { create: true })
            : null;

          folderTransfer = {
            zip: new JSZip(),
            folderName: msg.name,
            totalFiles: msg.totalFiles,
            receivedFiles: 0,
            currentFile: null,
            mode: rootDirectoryHandle ? 'stream' : 'zip',
            rootDirectoryHandle,
            directoryCache: new Map(),
          };
          metadata = null;
          if (!msg.small) {
            setTransferProgress({ label: msg.name, percent: 0, direction: 'receiving' });
          }
        } else if (msg.type === 'file-start' && folderTransfer) {
          let writer: WritableFileStreamLike | null = null;

          if (folderTransfer.mode === 'stream' && folderTransfer.rootDirectoryHandle) {
            const parts = msg.path.split('/').filter(Boolean);
            const fileName = parts.pop() || 'file';
            const parentDirectory = await getNestedDirectoryHandle(
              folderTransfer.rootDirectoryHandle,
              parts.join('/'),
              folderTransfer.directoryCache
            );
            const fileHandle = await parentDirectory.getFileHandle(fileName, { create: true });
            writer = await fileHandle.createWritable();
          }

          folderTransfer.currentFile = {
            path: msg.path,
            size: msg.size,
            chunks: [],
            writer,
          };
        } else if (msg.type === 'file-end' && folderTransfer?.currentFile) {
          if (folderTransfer.mode === 'stream') {
            await folderTransfer.currentFile.writer?.close();
          } else {
            folderTransfer.zip.file(
              folderTransfer.currentFile.path,
              new Blob(folderTransfer.currentFile.chunks)
            );
          }

          folderTransfer.receivedFiles += 1;
          folderTransfer.currentFile = null;
          if (folderTransfer.totalFiles > 100) {
            const pct = Math.round((folderTransfer.receivedFiles / folderTransfer.totalFiles) * 100);
            setTransferProgress({ label: folderTransfer.folderName, percent: pct, direction: 'receiving' });
          }
        } else if (msg.type === 'folder-end' && folderTransfer) {
          const completedTransfer = folderTransfer;
          const isSmall = completedTransfer.totalFiles <= 100;
          folderTransfer = null;
          folderReceiveTargets.current.delete(fromUserId);

          if (completedTransfer.mode === 'stream') {
            if (!isSmall) setTransferProgress(null);
            setDriveStatus(null);
            await logReceiverHistory(completedTransfer.folderName, 'folder');
            toast.success(`Folder received: ${completedTransfer.folderName}`, {
              description: 'Saved directly to your selected folder.',
              duration: 6000,
            });
            dc.close();
            return;
          }

          if (!isSmall) {
            setTransferProgress({
              label: `${completedTransfer.folderName} • finalizing`,
              percent: 99,
              direction: 'receiving',
            });
          }

          const blob = await completedTransfer.zip.generateAsync({
            type: 'blob',
            compression: 'STORE',
            streamFiles: true,
          });

          if (!isSmall) setTransferProgress(null);
          setDriveStatus(null);
          const url = URL.createObjectURL(blob);
          await logReceiverHistory(completedTransfer.folderName, 'folder');
          toast.success(`Folder received: ${completedTransfer.folderName}`, {
            action: {
              label: 'Download',
              onClick: () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `${completedTransfer.folderName}.zip`;
                a.click();
                URL.revokeObjectURL(url);
              },
            },
            duration: 15000,
          });
          dc.close();
        } else if (msg.type === 'drive-link') {
          // Received a Google Drive download link for large files
          setDriveStatus(`File available: ${msg.name}`);
          await logReceiverHistory(msg.name, msg.fileType || 'file', msg.downloadLink);
          toast.success(`File available: ${msg.name}`, {
            description: 'Click to download from Google Drive',
            action: {
              label: 'Download',
              onClick: () => window.open(msg.downloadLink, '_blank'),
            },
            duration: 30000,
          });
          setDriveStatus(null);
          dc.close();
        } else if (msg.type === 'done') {
          const blob = new Blob(chunks);
          const url = URL.createObjectURL(blob);
          setDriveStatus(null);
          await logReceiverHistory(metadata?.name || 'download', 'file');
          toast.success(`File received: ${metadata?.name}`, {
            action: {
              label: 'Download',
              onClick: () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = metadata?.name || 'download';
                a.click();
                URL.revokeObjectURL(url);
              },
            },
            duration: 15000,
          });
          dc.close();
        }
      } else {
        if (folderTransfer?.currentFile) {
          if (folderTransfer.mode === 'stream' && folderTransfer.currentFile.writer) {
            await folderTransfer.currentFile.writer.write(data);
          } else {
            folderTransfer.currentFile.chunks.push(data);
          }
        } else {
          chunks.push(data);
        }
      }
    };

    dc.onmessage = (event) => {
      messageQueue = messageQueue
        .then(() => processIncomingData(event.data))
        .catch(() => {
          setTransferProgress(null);
          setDriveStatus(null);
          folderReceiveTargets.current.delete(fromUserId);
          toast.error('Transfer failed');
          dc.close();
        });
    };
  };

  const waitForBufferedAmount = (dc: RTCDataChannel) =>
    new Promise<void>((resolve) => {
      if (dc.bufferedAmount <= DATA_CHANNEL_BUFFER_LIMIT) {
        resolve();
        return;
      }

      const handleBufferedAmountLow = () => resolve();
      dc.addEventListener('bufferedamountlow', handleBufferedAmountLow, { once: true });
    });

  const sendBlobInChunks = async (dc: RTCDataChannel, blob: Blob) => {
    let offset = 0;

    while (offset < blob.size) {
      if (dc.bufferedAmount > DATA_CHANNEL_BUFFER_LIMIT) {
        await waitForBufferedAmount(dc);
      }

      const chunk = await blob.slice(offset, offset + DATA_CHANNEL_CHUNK_SIZE).arrayBuffer();
      dc.send(chunk);
      offset += DATA_CHANNEL_CHUNK_SIZE;
    }
  };

  const createTransferPeer = async (
    targetUserId: string,
    onOpen: (dc: RTCDataChannel) => Promise<void>
  ) => {
    const channel = transferChannelRef.current;
    if (!channel) {
      toast.error('Channel not ready, try again');
      return false;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    peerConnections.current.set(targetUserId, pc);

    const dc = pc.createDataChannel('file-transfer', {
      ordered: true,
    });
    dataChannels.current.set(targetUserId, dc);

    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = DATA_CHANNEL_BUFFER_LIMIT / 2;

    dc.onopen = () => {
      void onOpen(dc).catch(() => {
        toast.error('Transfer failed');
        dc.close();
        pc.close();
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { targetUserId, fromUserId: userId, signal: event.candidate.toJSON() },
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    channel.send({
      type: 'broadcast',
      event: 'webrtc-signal',
      payload: { targetUserId, fromUserId: userId, signal: offer },
    });

    return true;
  };

  const sendFileViaPeer = async (targetUserId: string, file: File) => {
    const targetName = participants.find((p) => p.user_id === targetUserId)?.name || 'Unknown';
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);

    // Size-based routing
    if (file.size >= SIZE_THRESHOLD) {
      if (!providerToken) {
        toast.info('Google Drive permission is required for files larger than 25MB.');
        await requestDriveAccess();
        return;
      }

      setDriveStatus('Checking file size...');
      await new Promise(r => setTimeout(r, 400));
      setDriveStatus(`File is ${sizeMB}MB — uploading to Google Drive...`);

      try {
        const { fileId, downloadLink } = await uploadToGoogleDrive(
          file, file.name, providerToken,
          (status) => setDriveStatus(status)
        );

        setDriveStatus('Sending download link to receiver...');

        const started = await createTransferPeer(targetUserId, async (dc) => {
          dc.send(JSON.stringify({
            type: 'drive-link',
            name: file.name,
            downloadLink,
            fileType: 'file',
            size: file.size,
          }));
          dc.close();
        });

        if (!started) { setDriveStatus(null); return; }

        scheduleGoogleDriveCleanup(fileId, providerToken);

        await supabase.from('transfer_history').insert({
          sender_id: userId!,
          sender_name: userName!,
          recipient_name: targetName,
          file_name: file.name,
          file_type: 'file',
          sender_email: profile?.email || '',
          direction: 'sent',
          download_url: downloadLink,
        } as any);

        setDriveStatus(null);
        toast.success(`Sent via Google Drive: ${file.name}`, {
          description: 'Link expires in 5 minutes',
          duration: 6000,
        });
      } catch (err) {
        console.error('Drive upload failed:', err);
        setDriveStatus(null);
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
          toast.error('Google Drive permission expired. Please grant access again.');
          await requestDriveAccess();
          return;
        }
        toast.error('Google Drive upload failed. Please try again.');
      }
      return;
    }

    // <25MB: Send via WebRTC
    setDriveStatus(`File is ${sizeMB}MB — sending directly via WebRTC...`);

    const started = await createTransferPeer(targetUserId, async (dc) => {
      dc.send(JSON.stringify({ type: 'metadata', name: file.name, size: file.size }));
      await sendBlobInChunks(dc, file);
      dc.send(JSON.stringify({ type: 'done' }));
      setDriveStatus(null);
      toast.success(`Sent: ${file.name}`, { duration: 4000 });
    });

    if (!started) { setDriveStatus(null); return; }

    await supabase.from('transfer_history').insert({
      sender_id: userId!,
      sender_name: userName!,
      recipient_name: targetName,
      file_name: file.name,
      file_type: 'file',
      sender_email: profile?.email || '',
      direction: 'sent',
    } as any);
  };

  const sendFolderViaPeer = async (targetUserId: string, files: FileList | File[], folderName: string) => {
    const fileArray = Array.from(files);
    const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    const targetName = participants.find((p) => p.user_id === targetUserId)?.name || 'Unknown';

    // Size-based routing for folders
    if (totalSize >= SIZE_THRESHOLD) {
      if (!providerToken) {
        toast.info('Google Drive permission is required for folders larger than 25MB.');
        await requestDriveAccess();
        return;
      }

      setDriveStatus('Checking folder size...');
      await new Promise(r => setTimeout(r, 400));
      setDriveStatus(`Folder is ${totalSizeMB}MB — compressing...`);

      const zip = new JSZip();
      for (const file of fileArray) {
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        zip.file(relativePath, file);
      }

      setDriveStatus('Generating ZIP archive...');
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 1 },
      });

      try {
        const { fileId, downloadLink } = await uploadToGoogleDrive(
          zipBlob, `${folderName}.zip`, providerToken,
          (status) => setDriveStatus(status)
        );

        setDriveStatus('Sending download link to receiver...');

        const started = await createTransferPeer(targetUserId, async (dc) => {
          dc.send(JSON.stringify({
            type: 'drive-link',
            name: `${folderName}.zip`,
            downloadLink,
            fileType: 'folder',
            size: totalSize,
          }));
          dc.close();
        });

        if (!started) { setDriveStatus(null); return; }

        scheduleGoogleDriveCleanup(fileId, providerToken);

        await supabase.from('transfer_history').insert({
          sender_id: userId!,
          sender_name: userName!,
          recipient_name: targetName,
          file_name: `${folderName}.zip`,
          file_type: 'folder',
          sender_email: profile?.email || '',
          direction: 'sent',
          download_url: downloadLink,
        } as any);

        setDriveStatus(null);
        toast.success(`Sent via Google Drive: ${folderName}`, {
          description: 'Link expires in 5 minutes',
          duration: 6000,
        });
      } catch (err) {
        console.error('Drive upload failed:', err);
        setDriveStatus(null);
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
          toast.error('Google Drive permission expired. Please grant access again.');
          await requestDriveAccess();
          return;
        }
        toast.error('Google Drive upload failed. Please try again.');
      }
      return;
    }

    // <25MB: Send via WebRTC
    setDriveStatus(`Folder is ${totalSizeMB}MB — sending directly...`);
    const useCompression = fileArray.length > 100;

    if (useCompression) {
      setDriveStatus(null);
      setTransferProgress({ label: `${folderName} • compressing`, percent: 0, direction: 'sending' });
      const zip = new JSZip();
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        zip.file(relativePath, file);
        const pct = Math.round(((i + 1) / fileArray.length) * 50);
        setTransferProgress({ label: `${folderName} • compressing`, percent: pct, direction: 'sending' });
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 1 },
      }, (meta) => {
        const pct = 50 + Math.round(meta.percent / 2);
        setTransferProgress({ label: `${folderName} • compressing`, percent: pct, direction: 'sending' });
      });

      const zipFileName = `${folderName}.zip`;
      setTransferProgress({ label: `${folderName} • sending`, percent: 0, direction: 'sending' });

      const started = await createTransferPeer(targetUserId, async (dc) => {
        dc.send(JSON.stringify({ type: 'metadata', name: zipFileName, size: zipBlob.size }));
        let offset = 0;
        const zipTotalSize = zipBlob.size;
        while (offset < zipTotalSize) {
          if (dc.bufferedAmount > DATA_CHANNEL_BUFFER_LIMIT) {
            await waitForBufferedAmount(dc);
          }
          const chunk = await zipBlob.slice(offset, offset + DATA_CHANNEL_CHUNK_SIZE).arrayBuffer();
          dc.send(chunk);
          offset += DATA_CHANNEL_CHUNK_SIZE;
          const pct = Math.round((offset / zipTotalSize) * 100);
          setTransferProgress({ label: `${folderName} • sending`, percent: Math.min(pct, 100), direction: 'sending' });
        }
        dc.send(JSON.stringify({ type: 'done' }));
        setTransferProgress(null);
        toast.success(`Sent folder: ${folderName}`, { duration: 4000 });
      });

      if (!started) { setTransferProgress(null); return; }

      await supabase.from('transfer_history').insert({
        sender_id: userId!, sender_name: userName!, recipient_name: targetName,
        file_name: `${folderName}.zip`, file_type: 'folder', sender_email: profile?.email || '',
        direction: 'sent',
      } as any);
    } else {
      setDriveStatus(null);
      const started = await createTransferPeer(targetUserId, async (dc) => {
        dc.send(JSON.stringify({ type: 'folder-start', name: folderName, totalFiles: fileArray.length, small: true }));

        for (let i = 0; i < fileArray.length; i++) {
          const file = fileArray[i];
          const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          dc.send(JSON.stringify({ type: 'file-start', path: relativePath, size: file.size }));
          await sendBlobInChunks(dc, file);
          dc.send(JSON.stringify({ type: 'file-end' }));
        }

        dc.send(JSON.stringify({ type: 'folder-end' }));
        toast.success(`Sent folder: ${folderName}`, { duration: 4000 });
      });

      if (!started) { return; }

      await supabase.from('transfer_history').insert({
        sender_id: userId!, sender_name: userName!, recipient_name: targetName,
        file_name: folderName, file_type: 'folder', sender_email: profile?.email || '',
        direction: 'sent',
      } as any);
    }
  };

  const handleRequestFile = (targetUserId: string) => {
    const channel = transferChannelRef.current;
    if (!channel) { toast.error('Channel not ready'); return; }
    channel.send({
      type: 'broadcast',
      event: 'transfer-request',
      payload: { targetUserId, fromUserId: userId, fromName: userName, type: 'file' },
    });
    toast.info('File request sent');
  };

  const handleRequestFolder = (targetUserId: string) => {
    const channel = transferChannelRef.current;
    if (!channel) { toast.error('Channel not ready'); return; }

    channel.send({
      type: 'broadcast',
      event: 'transfer-request',
      payload: { targetUserId, fromUserId: userId, fromName: userName, type: 'folder' },
    });
    toast.info('Folder request sent');
  };

  const handleTransferAccept = async () => {
    if (!transferRequest) return;
    const { fromUserId } = transferRequest;
    setTransferRequest(null);
    setUploadModal({ open: true, targetUserId: fromUserId, mode: transferRequest.type === 'folder' ? 'folder' : 'file' });
  };

  const handleUploadFile = async (file: File) => {
    if (!uploadModal) return;
    await sendFileViaPeer(uploadModal.targetUserId, file);
  };

  const handleUploadFolder = async (files: FileList, folderName: string) => {
    if (!uploadModal) return;
    await sendFolderViaPeer(uploadModal.targetUserId, files, folderName);
  };

  const handleAcceptJoin = async () => {
    if (!currentRequest) return;
    await supabase
      .from('room_participants')
      .update({ status: 'accepted' })
      .eq('room_id', roomId!)
      .eq('user_id', currentRequest.userId);

    const remaining = pendingRequests.filter((r) => r.userId !== currentRequest.userId);
    setPendingRequests(remaining);
    setCurrentRequest(remaining[0] || null);
  };

  const handleRejectJoin = async () => {
    if (!currentRequest) return;
    await supabase
      .from('room_participants')
      .update({ status: 'blocked' })
      .eq('room_id', roomId!)
      .eq('user_id', currentRequest.userId);

    const remaining = pendingRequests.filter((r) => r.userId !== currentRequest.userId);
    setPendingRequests(remaining);
    setCurrentRequest(remaining[0] || null);
  };

  const handleRemoveUser = async (targetUserId: string) => {
    await supabase
      .from('room_participants')
      .update({ status: 'blocked' })
      .eq('room_id', roomId!)
      .eq('user_id', targetUserId);
    toast.error('User removed');
  };

  const handleLogout = async () => {
    if (isHost && roomId) {
      await supabase.from('rooms').update({ status: 'locked' }).eq('room_id', roomId);
    }
    if (userId) {
      await supabase.from('room_participants').delete().eq('user_id', userId).eq('room_id', roomId!);
      await supabase.from('sessions').delete().eq('user_id', userId);
    }
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    await signOut();
    navigate('/');
  };

  const handleHistory = () => {
    setHistoryOpen(true);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={handleHistory} />

      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        {removedByHost ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4 animate-fade-in">
            <p className="text-lg font-semibold text-destructive">Host has removed you from this room</p>
            <p className="text-sm text-muted-foreground">You no longer have access to this room.</p>
            <Button variant="outline" onClick={handleLogout}>Logout</Button>
          </div>
        ) : (
          <>
            {/* Top bar: user badge left, room live center, signal right */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 animate-fade-up">
              {/* Left: current user badge */}
              <div className="flex items-center gap-2">
                <UserAvatar name={userName || '?'} avatarUrl={profile?.avatar_url} size="sm" />
                <div>
                  <span className="text-sm font-semibold">{userName}</span>
                  {isHost && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                      Host
                    </span>
                  )}
                </div>
              </div>

              {/* Center: room live badge */}
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-signal-strong animate-pulse" />
                <span className="text-xs font-mono text-muted-foreground">
                  Room {roomId} is live
                </span>
                <button onClick={copyRoomId} className="text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-signal-strong" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Right: signal strength */}
              <SignalStrength />
            </div>

            {/* Drive status text */}
            {driveStatus && (
              <div className="mb-4 animate-fade-up">
                <div className="flex items-center gap-3 bg-muted/60 rounded-lg px-4 py-3 border border-border">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                  <span className="text-xs font-medium">{driveStatus}</span>
                </div>
              </div>
            )}

            {/* Transfer progress bar */}
            {transferProgress && (
              <div className="mb-4 animate-fade-up">
                <div className="flex items-center gap-3 bg-muted/60 rounded-lg px-4 py-3 border border-border">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate">
                        {transferProgress.direction === 'sending' ? 'Sending' : 'Receiving'}: {transferProgress.label}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground ml-2">
                        {transferProgress.percent}%
                      </span>
                    </div>
                    <Progress value={transferProgress.percent} className="h-2" />
                  </div>
                </div>
              </div>
            )}

            {room?.status === 'locked' && (
              <div className="text-center mb-4 animate-fade-up">
                <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  Room Locked — Host has left
                </span>
              </div>
            )}

            {/* Participants — horizontal grid on desktop, vertical stack on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
              {participants
                .filter((p) => p.user_id !== userId)
                .map((p, i) => (
                  <div
                    key={p.user_id}
                    className="animate-scale-in"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <UserCard
                      name={p.name}
                      avatarUrl={p.avatar_url}
                      isHost={p.user_id === room?.host_id}
                      showHostControls={isHost}
                      onRequestFile={() => handleRequestFile(p.user_id)}
                      onRequestFolder={() => handleRequestFolder(p.user_id)}
                      onRemove={() => handleRemoveUser(p.user_id)}
                    />
                  </div>
                ))}

              {participants.length === 1 && isHost && (
                <div className="col-span-full text-center py-12 text-muted-foreground text-sm animate-fade-up" style={{ animationDelay: '200ms' }}>
                  <p>Share your Room ID to invite others</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={copyRoomId}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy Room ID
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <JoinRequestDialog
        open={!!currentRequest && isHost}
        requesterName={currentRequest?.name || ''}
        requesterEmail={currentRequest?.email}
        requesterAvatar={currentRequest?.avatar_url}
        onAccept={handleAcceptJoin}
        onReject={handleRejectJoin}
      />

      <TransferRequestDialog
        open={!!transferRequest}
        requesterName={transferRequest?.fromName || ''}
        type={transferRequest?.type || 'file'}
        onAccept={handleTransferAccept}
        onReject={() => setTransferRequest(null)}
      />

      <UploadModal
        open={!!uploadModal?.open}
        mode={uploadModal?.mode || 'file'}
        onClose={() => setUploadModal(null)}
        onFileSelected={handleUploadFile}
        onFolderSelected={handleUploadFolder}
      />

      <HistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        senderEmail={profile?.email || ''}
        senderName={profile?.name || ''}
      />
    </div>
  );
}
