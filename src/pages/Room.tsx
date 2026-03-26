import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import UserCard from '@/components/UserCard';
import UserAvatar from '@/components/UserAvatar';
import SignalStrength from '@/components/SignalStrength';
import JoinRequestDialog from '@/components/JoinRequestDialog';
import TransferRequestDialog from '@/components/TransferRequestDialog';
import UploadModal from '@/components/UploadModal';
import { supabase } from '@/integrations/supabase/client';
import { getStoredUserId, getStoredUserName, clearSession } from '@/lib/session';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import JSZip from 'jszip';

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
}

interface PendingRequest {
  userId: string;
  name: string;
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
  const userId = getStoredUserId();
  const userName = getStoredUserName();

  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [currentRequest, setCurrentRequest] = useState<PendingRequest | null>(null);
  const [transferRequest, setTransferRequest] = useState<TransferRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [uploadModal, setUploadModal] = useState<{ open: boolean; targetUserId: string } | null>(null);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const transferChannelRef = useRef<any>(null);
  const folderReceiveTargets = useRef<Map<string, FileSystemDirectoryHandleLike>>(new Map());

  const isHost = room?.host_id === userId;
  const [removedByHost, setRemovedByHost] = useState(false);

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

  // Load participants - no dependency on currentRequest to avoid stale closures
  const loadParticipants = useCallback(async () => {
    if (!roomId) return;

    const { data: parts } = await supabase
      .from('room_participants')
      .select('user_id, status')
      .eq('room_id', roomId);

    if (!parts) return;

    // Check if current user has been removed/blocked
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

    const { data: sessions } = await supabase
      .from('sessions')
      .select('user_id, name')
      .in('user_id', userIds);

    const nameMap = new Map(sessions?.map((s) => [s.user_id, s.name]) ?? []);

    setParticipants(
      accepted.map((p) => ({
        user_id: p.user_id,
        name: nameMap.get(p.user_id) || 'Unknown',
        status: p.status,
      }))
    );

    const newPending = pending.map((p) => ({
      userId: p.user_id,
      name: nameMap.get(p.user_id) || 'Unknown',
    }));

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
          // Reload participants on ANY change (insert, update, delete)
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

    const processIncomingData = async (data: string | Blob | ArrayBuffer) => {
      if (typeof data === 'string') {
        const msg = JSON.parse(data);
        if (msg.type === 'metadata') {
          metadata = msg;
          folderTransfer = null;
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
          setTransferProgress({ label: msg.name, percent: 0, direction: 'receiving' });
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
          const pct = Math.round((folderTransfer.receivedFiles / folderTransfer.totalFiles) * 100);
          setTransferProgress({ label: folderTransfer.folderName, percent: pct, direction: 'receiving' });
        } else if (msg.type === 'folder-end' && folderTransfer) {
          const completedTransfer = folderTransfer;
          folderTransfer = null;
          folderReceiveTargets.current.delete(fromUserId);

          if (completedTransfer.mode === 'stream') {
            setTransferProgress(null);
            toast.success(`Folder received: ${completedTransfer.folderName}`, {
              description: 'Saved directly to your selected folder.',
              duration: 6000,
            });
            dc.close();
            return;
          }

          setTransferProgress({
            label: `${completedTransfer.folderName} • finalizing`,
            percent: 99,
            direction: 'receiving',
          });

          const blob = await completedTransfer.zip.generateAsync({
            type: 'blob',
            compression: 'STORE',
            streamFiles: true,
          });

          setTransferProgress(null);
          const url = URL.createObjectURL(blob);
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
        } else if (msg.type === 'done') {
          const blob = new Blob(chunks);
          const url = URL.createObjectURL(blob);
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
    const started = await createTransferPeer(targetUserId, async (dc) => {
      dc.send(JSON.stringify({ type: 'metadata', name: file.name, size: file.size }));
      await sendBlobInChunks(dc, file);
      dc.send(JSON.stringify({ type: 'done' }));
      toast.success(`Sent: ${file.name}`, { duration: 4000 });
    });

    if (!started) return;

    const targetName = participants.find((p) => p.user_id === targetUserId)?.name || 'Unknown';
    await supabase.from('transfer_history').insert({
      sender_id: userId!,
      sender_name: userName!,
      recipient_name: targetName,
      file_name: file.name,
      file_type: 'file',
    });
  };

  const sendFolderViaPeer = async (targetUserId: string, files: FileList | File[], folderName: string) => {
    const fileArray = Array.from(files);

    // Compress folder into a ZIP on sender side first
    setTransferProgress({ label: `${folderName} • compressing`, percent: 0, direction: 'sending' });
    const zip = new JSZip();
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      zip.file(relativePath, file);
      const pct = Math.round(((i + 1) / fileArray.length) * 50); // 0-50% for compression
      setTransferProgress({ label: `${folderName} • compressing`, percent: pct, direction: 'sending' });
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 }, // fast compression
    }, (meta) => {
      const pct = 50 + Math.round(meta.percent / 2); // 50-100% for zip generation
      setTransferProgress({ label: `${folderName} • compressing`, percent: pct, direction: 'sending' });
    });

    // Send as single compressed file
    const zipFileName = `${folderName}.zip`;
    setTransferProgress({ label: `${folderName} • sending`, percent: 0, direction: 'sending' });

    const started = await createTransferPeer(targetUserId, async (dc) => {
      dc.send(JSON.stringify({ type: 'metadata', name: zipFileName, size: zipBlob.size }));

      let offset = 0;
      const totalSize = zipBlob.size;
      while (offset < totalSize) {
        if (dc.bufferedAmount > DATA_CHANNEL_BUFFER_LIMIT) {
          await waitForBufferedAmount(dc);
        }
        const chunk = await zipBlob.slice(offset, offset + DATA_CHANNEL_CHUNK_SIZE).arrayBuffer();
        dc.send(chunk);
        offset += DATA_CHANNEL_CHUNK_SIZE;
        const pct = Math.round((offset / totalSize) * 100);
        setTransferProgress({ label: `${folderName} • sending`, percent: Math.min(pct, 100), direction: 'sending' });
      }

      dc.send(JSON.stringify({ type: 'done' }));
      setTransferProgress(null);
      toast.success(`Sent folder: ${folderName}`, { duration: 4000 });
    });

    if (!started) {
      setTransferProgress(null);
      return;
    }

    const targetName = participants.find((p) => p.user_id === targetUserId)?.name || 'Unknown';
    await supabase.from('transfer_history').insert({
      sender_id: userId!,
      sender_name: userName!,
      recipient_name: targetName,
      file_name: `${folderName}.zip`,
      file_type: 'folder',
    });
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

  const handleRequestFolder = async (targetUserId: string) => {
    const channel = transferChannelRef.current;
    if (!channel) { toast.error('Channel not ready'); return; }

    const pickerHost = window as Window & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike>;
    };

    if (pickerHost.showDirectoryPicker) {
      try {
        const directoryHandle = await pickerHost.showDirectoryPicker();
        folderReceiveTargets.current.set(targetUserId, directoryHandle);
      } catch {
        toast.info('Folder request cancelled');
        return;
      }
    } else {
      folderReceiveTargets.current.delete(targetUserId);
      toast.info('Direct folder save is not supported here, so a ZIP will be prepared after transfer');
    }

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
    setUploadModal({ open: true, targetUserId: fromUserId });
  };

  const handleUploadFile = async (file: File) => {
    if (!uploadModal) return;
    await sendFileViaPeer(uploadModal.targetUserId, file);
  };

  const handleUploadFolder = async (files: FileList, folderName: string) => {
    if (!uploadModal) return;
    setTransferProgress({ label: folderName, percent: 0, direction: 'sending' });
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
      await supabase.from('transfer_history').delete().eq('sender_id', userId);
    }
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    clearSession();
    navigate('/');
  };

  const handleHistory = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('transfer_history')
      .select('*')
      .eq('sender_id', userId)
      .order('transferred_at', { ascending: false });

    if (!data || data.length === 0) {
      toast.info('No transfer history yet');
      return;
    }
    const { generateHistoryPdf } = await import('@/lib/pdfExport');
    generateHistoryPdf(userName || 'Unknown', data);
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
                <UserAvatar name={userName || '?'} size="sm" />
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
        onClose={() => setUploadModal(null)}
        onFileSelected={handleUploadFile}
        onFolderSelected={handleUploadFolder}
      />
    </div>
  );
}
