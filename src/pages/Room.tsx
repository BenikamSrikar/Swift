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

const DATA_CHANNEL_CHUNK_SIZE = 262144; // 256KB
const DATA_CHANNEL_BUFFER_LIMIT = DATA_CHANNEL_CHUNK_SIZE * 8;
const SIZE_THRESHOLD = 25 * 1024 * 1024; // 25MB

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

interface TransferProgress {
  label: string;
  percent: number;
  direction: 'sending' | 'receiving';
}

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const userId = user?.id;
  const userName = profile?.name;

  const [room, setRoom] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [currentRequest, setCurrentRequest] = useState<PendingRequest | null>(null);
  const [transferRequest, setTransferRequest] = useState<TransferRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [transferProgress, setTransferProgress] = useState<TransferProgress | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [uploadModal, setUploadModal] = useState<{ open: boolean; targetUserId: string; mode: 'file' | 'folder' } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const transferChannelRef = useRef<any>(null);

  const isHost = room?.host_id === userId;
  const [removedByHost, setRemovedByHost] = useState(false);

  // Load room
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

  // Load participants
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

    const { data: profiles } = await supabase
      .from('profiles')
      .select('auth_user_id, name, email, avatar_url')
      .in('auth_user_id', userIds);

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

  useEffect(() => {
    if (roomId) loadParticipants();
  }, [roomId, loadParticipants]);

  // Realtime participant changes
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-participants-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, () => {
        loadParticipants();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, loadParticipants]);

  // Signaling channel
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
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        const pc = peerConnections.current.get(fromUserId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') transferChannelRef.current = channel;
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

  // ── Receive logic ──
  const receiveFile = (dc: RTCDataChannel, fromUserId: string) => {
    const chunks: BlobPart[] = [];
    let metadata: { name: string; size: number } | null = null;
    let receivedBytes = 0;
    let messageQueue = Promise.resolve();

    const logHistory = async (fileName: string, fileType: string) => {
      const senderInfo = participants.find((p) => p.user_id === fromUserId);
      await supabase.from('transfer_history').insert({
        sender_id: userId!,
        sender_name: senderInfo?.name || 'Unknown',
        recipient_name: userName!,
        file_name: fileName,
        file_type: fileType,
        sender_email: profile?.email || '',
        direction: 'received',
      } as any);
    };

    const processIncomingData = async (data: string | Blob | ArrayBuffer) => {
      if (typeof data === 'string') {
        const msg = JSON.parse(data);

        if (msg.type === 'metadata') {
          metadata = msg;
          receivedBytes = 0;
          chunks.length = 0;
          setStatusText(`Receiving: ${msg.name}`);
          toast.info(`Receiving: ${msg.name}`, { duration: 3000 });

          if (msg.size >= SIZE_THRESHOLD) {
            setTransferProgress({ label: msg.name, percent: 0, direction: 'receiving' });
          }
        } else if (msg.type === 'done') {
          const blob = new Blob(chunks);
          const url = URL.createObjectURL(blob);
          setStatusText(null);
          setTransferProgress(null);
          await logHistory(metadata?.name || 'download', metadata?.name?.endsWith('.zip') ? 'folder' : 'file');
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
        chunks.push(data);
        const byteLength = data instanceof ArrayBuffer ? data.byteLength : (data as Blob).size;
        receivedBytes += byteLength;

        if (metadata && metadata.size >= SIZE_THRESHOLD) {
          const pct = Math.min(Math.round((receivedBytes / metadata.size) * 100), 100);
          setTransferProgress({ label: metadata.name, percent: pct, direction: 'receiving' });
        }
      }
    };

    dc.onmessage = (event) => {
      messageQueue = messageQueue
        .then(() => processIncomingData(event.data))
        .catch(() => {
          setTransferProgress(null);
          setStatusText(null);
          toast.error('Transfer failed');
          dc.close();
        });
    };
  };

  // ── Send helpers ──
  const waitForBufferedAmount = (dc: RTCDataChannel) =>
    new Promise<void>((resolve) => {
      if (dc.bufferedAmount <= DATA_CHANNEL_BUFFER_LIMIT) {
        resolve();
        return;
      }
      dc.addEventListener('bufferedamountlow', () => resolve(), { once: true });
    });

  const sendBlobInChunks = async (
    dc: RTCDataChannel,
    blob: Blob,
    onProgress?: (sent: number, total: number) => void
  ) => {
    let offset = 0;
    const total = blob.size;

    while (offset < total) {
      if (dc.bufferedAmount > DATA_CHANNEL_BUFFER_LIMIT) {
        await waitForBufferedAmount(dc);
      }

      const end = Math.min(offset + DATA_CHANNEL_CHUNK_SIZE, total);
      const chunk = await blob.slice(offset, end).arrayBuffer();
      dc.send(chunk);
      offset = end;
      onProgress?.(offset, total);
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

    const dc = pc.createDataChannel('file-transfer', { ordered: true });
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

  // ── Send file ──
  const sendFileViaPeer = async (targetUserId: string, file: File) => {
    const targetName = participants.find((p) => p.user_id === targetUserId)?.name || 'Unknown';
    const isLarge = file.size >= SIZE_THRESHOLD;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);

    setStatusText(`Sending ${file.name} (${sizeMB}MB)…`);
    if (isLarge) {
      setTransferProgress({ label: file.name, percent: 0, direction: 'sending' });
    }

    const started = await createTransferPeer(targetUserId, async (dc) => {
      dc.send(JSON.stringify({ type: 'metadata', name: file.name, size: file.size }));

      await sendBlobInChunks(dc, file, (sent, total) => {
        if (isLarge) {
          const pct = Math.min(Math.round((sent / total) * 100), 100);
          setTransferProgress({ label: file.name, percent: pct, direction: 'sending' });
        }
      });

      dc.send(JSON.stringify({ type: 'done' }));
      setTransferProgress(null);
      setStatusText(null);
      toast.success(`Sent: ${file.name}`, { duration: 4000 });
    });

    if (!started) {
      setTransferProgress(null);
      setStatusText(null);
      return;
    }

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

  // ── Send folder ──
  const sendFolderViaPeer = async (targetUserId: string, files: FileList | File[], folderName: string) => {
    const fileArray = Array.from(files);
    const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    const targetName = participants.find((p) => p.user_id === targetUserId)?.name || 'Unknown';

    // Always zip with STORE (no compression), preserving folder structure
    setStatusText(`Zipping ${folderName} (${totalSizeMB}MB)…`);
    setTransferProgress({ label: `${folderName} • zipping`, percent: 0, direction: 'sending' });

    const zip = new JSZip();
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      zip.file(relativePath, file, { compression: 'STORE' });
      const pct = Math.round(((i + 1) / fileArray.length) * 30);
      setTransferProgress({ label: `${folderName} • zipping`, percent: pct, direction: 'sending' });
    }

    const zipBlob = await zip.generateAsync(
      { type: 'blob', compression: 'STORE', streamFiles: true },
      (meta) => {
        const pct = 30 + Math.round(meta.percent * 0.2);
        setTransferProgress({ label: `${folderName} • zipping`, percent: Math.min(pct, 50), direction: 'sending' });
      }
    );

    const zipFileName = `${folderName}.zip`;
    const isLarge = zipBlob.size >= SIZE_THRESHOLD;

    setStatusText(`Sending ${zipFileName}…`);
    setTransferProgress({ label: `${folderName} • sending`, percent: 0, direction: 'sending' });

    const started = await createTransferPeer(targetUserId, async (dc) => {
      dc.send(JSON.stringify({ type: 'metadata', name: zipFileName, size: zipBlob.size }));

      await sendBlobInChunks(dc, zipBlob, (sent, total) => {
        const pct = Math.min(Math.round((sent / total) * 100), 100);
        setTransferProgress({ label: `${folderName} • sending`, percent: pct, direction: 'sending' });
      });

      dc.send(JSON.stringify({ type: 'done' }));
      setTransferProgress(null);
      setStatusText(null);
      toast.success(`Sent folder: ${folderName}`, { duration: 4000 });
    });

    if (!started) {
      setTransferProgress(null);
      setStatusText(null);
      return;
    }

    await supabase.from('transfer_history').insert({
      sender_id: userId!,
      sender_name: userName!,
      recipient_name: targetName,
      file_name: zipFileName,
      file_type: 'folder',
      sender_email: profile?.email || '',
      direction: 'sent',
    } as any);
  };

  // ── Room actions ──
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

  const handleHistory = () => setHistoryOpen(true);

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
            {/* Top bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 animate-fade-up">
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

              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-signal-strong animate-pulse" />
                <span className="text-xs font-mono text-muted-foreground">Room {roomId} is live</span>
                <button onClick={copyRoomId} className="text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-signal-strong" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <SignalStrength />
            </div>

            {/* Status text */}
            {statusText && (
              <div className="mb-4 animate-fade-up">
                <div className="flex items-center gap-3 bg-muted/60 rounded-lg px-4 py-3 border border-border">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                  <span className="text-xs font-medium">{statusText}</span>
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

            {/* Participants */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
              {participants
                .filter((p) => p.user_id !== userId)
                .map((p, i) => (
                  <div key={p.user_id} className="animate-scale-in" style={{ animationDelay: `${i * 100}ms` }}>
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
