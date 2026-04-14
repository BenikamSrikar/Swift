/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
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
import { format } from 'date-fns';
import JSZip from 'jszip';
import TransferQueue, { QueuedTransfer } from '@/components/TransferQueue';

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
  const [queuedTransfers, setQueuedTransfers] = useState<QueuedTransfer[]>([]);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [uploadModal, setUploadModal] = useState<{ open: boolean; targetUserId: string; mode: 'file' | 'folder' } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [roomChannel, setRoomChannel] = useState<any>(null);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const transferChannelRef = useRef<any>(null);
  const transferPayloads = useRef<Map<string, { blob: Blob; targetUserId: string }>>(new Map());

  const isHost = room?.host_id === userId;
  const [removedByHost, setRemovedByHost] = useState(false);

  const generateTransferId = () => {
    try {
      return (window.crypto as any).randomUUID();
    } catch {
      return Math.random().toString(36).substring(2, 11);
    }
  };

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
      
      // Proactively prune any other active rooms for this host to prevent duplicates
      if (isHost) {
        await supabase.from('rooms')
          .update({ status: 'locked' })
          .eq('host_id', userId)
          .neq('room_id', roomId);
      }
      
      // Update session status to indicate user is now actually INSIDE a room
      await supabase.from('sessions').update({ status: 'in_room' }).eq('user_id', userId);
    };

    loadRoom();
  }, [roomId, userId, userName, navigate]);

  // Load participants — filter out ghosts (accepted but no active session)
  const loadParticipants = useCallback(async () => {
    if (!roomId) return;

    const { data: parts } = await supabase
      .from('room_participants')
      .select('user_id, status')
      .eq('room_id', roomId);

    if (!parts) return;

    const myEntry = parts.find((p) => p.user_id === userId);
    if (!myEntry) {
      if (!isHost) toast.error('You have left or were disconnected from the room.');
      navigate('/connection');
      return;
    }
    if (myEntry.status === 'blocked' || myEntry.status === 'rejected') {
      setRemovedByHost(true);
      return;
    }

    if (!isHost && room?.host_id) {
      const hostStillHere = parts.find((p) => p.user_id === room.host_id);
      if (!hostStillHere) {
        toast.error('Host has left the meeting. Returning to landing page...', { duration: 5000 });
        navigate('/connection');
        return;
      }
    }

    const accepted = parts.filter((p) => p.status === 'accepted');
    const pending = parts.filter((p) => p.status === 'pending');

    // Removed Ghost Detection: deleting participants based on session lag caused accidental kicks.

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
      setCurrentRequest((prev) => {
        const stillInList = newPending.find(np => np.userId === prev?.userId);
        return stillInList ? prev : newPending[0];
      });
    } else {
      setCurrentRequest(null);
    }
  }, [roomId, userId, room?.host_id, isHost, navigate]);

  useEffect(() => {
    if (roomId) loadParticipants();
  }, [roomId, loadParticipants]);

  // ── Cleanup on tab close / navigation away ──
  useEffect(() => {
    if (!userId || !roomId) return;

    const handleUnload = () => {
      const headers = {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      };

      // 1. Remove participant (keepalive ensures it finishes after tab close)
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/room_participants?room_id=eq.${encodeURIComponent(roomId)}&user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers,
        keepalive: true
      });

      // 2. Lock room if host
      if (isHost) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rooms?room_id=eq.${encodeURIComponent(roomId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'locked' }),
          keepalive: true
        });
      }

      // 3. Mark session as offline
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'offline' }),
        keepalive: true
      });
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      handleUnload();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [userId, roomId]);

  // Realtime participant changes
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-participants-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants' }, (payload: any) => {
        // Filter changes for this specific room in JS to bypass Replica Identity Full requirement
        if (payload.new?.room_id === roomId || payload.old?.room_id === roomId) {
          loadParticipants();
        }
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
        // Prevent duplicate PC/DataChannel creation which causes double history logging
        if (peerConnections.current.has(fromUserId)) {
          const oldPc = peerConnections.current.get(fromUserId);
          oldPc?.close();
        }
        await handleIncomingOffer(fromUserId, signal, channel);
      } else if (signal.type === 'answer') {
        const pc = peerConnections.current.get(fromUserId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        const pc = peerConnections.current.get(fromUserId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    });

    channel.on('broadcast', { event: 'host-leaving' }, () => {
      // If we are not the host, leave the meeting.
      // Small delay prevents potential race conditions with navigation
      setTimeout(() => {
        if (!isHost) {
          toast.info('Host has left the meeting. Returning to dashboard...', { duration: 5000 });
          navigate('/connection');
        }
      }, 500);
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
    let metadata: { id: string; name: string; size: number } | null = null;
    let receivedBytes = 0;
    let messageQueue = Promise.resolve();

    const logHistory = async (fileName: string, fileType: string) => {
      let senderName = participants.find((p) => p.user_id === fromUserId)?.name;
      let senderEmail = participants.find((p) => p.user_id === fromUserId)?.email;

      if (!senderName) {
        // Fallback: check sessions or profiles directly if not in active list
        const { data: prof } = await supabase.from('profiles').select('name, email').eq('auth_user_id', fromUserId).single();
        if (prof) {
          senderName = prof.name;
          senderEmail = prof.email;
        }
      }

      await supabase.from('transfer_history').insert({
        sender_id: fromUserId,
        sender_name: senderName || 'Unknown Peer',
        recipient_name: userName!,
        file_name: fileName,
        file_type: fileType,
        sender_email: senderEmail || '',
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
          
          const transferId = msg.id || generateTransferId();
          setQueuedTransfers(prev => [...prev, {
            id: transferId,
            name: msg.name,
            size: msg.size,
            progress: 0,
            status: 'processing',
            direction: 'receiving',
            type: msg.name.endsWith('.zip') ? 'folder' : 'file'
          }]);

          setStatusText(`Receiving: ${msg.name}`);
        } else if (msg.type === 'done') {
          const blob = new Blob(chunks);
          const url = URL.createObjectURL(blob);
          const currentMeta = metadata;
          
          setStatusText(null);
          setQueuedTransfers(prev => prev.map(t => 
            t.name === currentMeta?.name && t.status === 'processing' 
              ? { ...t, status: 'completed', progress: 100 } 
              : t
          ));

          // Auto-remove completed transfer from UI after 3 seconds
          setTimeout(() => {
            setQueuedTransfers(prev => prev.filter(t => t.id !== msg.id && t.progress !== 100));
          }, 3000);

          if (currentMeta) {
            await logHistory(currentMeta.name, currentMeta.name.endsWith('.zip') ? 'folder' : 'file');
            toast.success(`File received: ${currentMeta.name}`, {
              action: {
                label: 'Download',
                onClick: () => {
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = currentMeta.name;
                  a.click();
                  URL.revokeObjectURL(url);
                },
              },
              duration: 15000,
            });
          }
          dc.close();
        }
      } else {
        chunks.push(data);
        const byteLength = data instanceof ArrayBuffer ? data.byteLength : (data as Blob).size;
        receivedBytes += byteLength;

        if (metadata) {
          const pct = Math.min(Math.round((receivedBytes / metadata.size) * 100), 100);
          setQueuedTransfers(prev => prev.map(t => 
            t.name === metadata?.name && t.status === 'processing' 
              ? { ...t, progress: pct } 
              : t
          ));
        }
      }
    };

    dc.onmessage = (event) => {
      messageQueue = messageQueue
        .then(() => processIncomingData(event.data))
        .catch((err) => {
          console.error('Receive error:', err);
          setStatusText(null);
          toast.error('Internal receiver error');
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
      toast.error('Communication channel not ready');
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
      void onOpen(dc).catch((err) => {
        console.error('DataChannel error:', err);
        toast.error('Connection interrupted');
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

  // ── Queue Processing ──
  useEffect(() => {
    const isAnyProcessing = queuedTransfers.some(t => t.status === 'processing');
    if (isAnyProcessing) return;

    const next = queuedTransfers.find(t => t.status === 'pending' && t.direction === 'sending');
    if (!next) return;

    const payload = transferPayloads.current.get(next.id);
    if (!payload) return;

    const startTransfer = async () => {
      setQueuedTransfers(prev => prev.map(t => t.id === next.id ? { ...t, status: 'processing' } : t));
      
      const started = await createTransferPeer(payload.targetUserId, async (dc) => {
        dc.send(JSON.stringify({ 
          type: 'metadata', 
          id: next.id,
          name: next.name, 
          size: next.size 
        }));

        await sendBlobInChunks(dc, payload.blob, (sent, total) => {
          const pct = Math.min(Math.round((sent / total) * 100), 100);
          setQueuedTransfers(prev => prev.map(t => t.id === next.id ? { ...t, progress: pct } : t));
        });

        dc.send(JSON.stringify({ type: 'done' }));
        setQueuedTransfers(prev => prev.map(t => t.id === next.id ? { ...t, status: 'completed', progress: 100 } : t));
        setStatusText(null);
        toast.success(`Successfully sent ${next.name}`);
        
        // Auto-remove after completion
        setTimeout(() => {
          setQueuedTransfers(prev => prev.filter(t => t.id !== next.id));
          transferPayloads.current.delete(next.id);
        }, 3000);
      });

      if (!started) {
        setQueuedTransfers(prev => prev.map(t => t.id === next.id ? { ...t, status: 'failed' } : t));
      }
    };

    startTransfer();
  }, [queuedTransfers, userId, userName, profile, participants]);

  // ── Send files ──
  const sendFilesViaPeer = async (targetUserId: string, files: File[]) => {
    const targetName = participants.find((p) => p.user_id === targetUserId)?.name || 'Unknown';
    
    let fileToSend: Blob;
    let fileName: string;
    let fileType: 'file' | 'folder' = 'file';

    if (files.length === 1) {
      fileToSend = files[0];
      fileName = files[0].name;
    } else {
      // For folders or multiple files, zip them first using 'STORE' (no compression) for maximum speed
      const zip = new JSZip();
      files.forEach((f) => {
        const path = (f as any).webkitRelativePath || f.name;
        zip.file(path, f);
      });
      
      fileToSend = await zip.generateAsync({ 
        type: 'blob',
        compression: 'STORE', // Use STORE for instant preparation
        streamFiles: true 
      }, (metadata) => {
        setStatusText(`Preparing folder: ${Math.round(metadata.percent || 0)}%`);
      });
      fileName = `swift_batch_${format(new Date(), 'HHmm')}.zip`;
      fileType = 'folder';
    }

    const transferId = generateTransferId();
    transferPayloads.current.set(transferId, { blob: fileToSend, targetUserId });

    setQueuedTransfers(prev => [...prev, {
      id: transferId,
      name: fileName,
      size: fileToSend.size,
      progress: 0,
      status: 'pending',
      direction: 'sending',
      type: fileType
    }]);
  };

  const handleUploadFiles = async (files: File[]) => {
    if (!uploadModal) return;
    await sendFilesViaPeer(uploadModal.targetUserId, files);
  };

  const handleUploadFolder = async (files: FileList) => {
    if (!uploadModal) return;
    const fileArray = Array.from(files);
    await sendFilesViaPeer(uploadModal.targetUserId, fileArray);
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

  const handleLeaveMeeting = async () => {
    if (isHost && roomId) {
      await supabase.from('rooms').update({ status: 'locked' }).eq('room_id', roomId);
      // Notify all participants immediately via broadcast
      if (roomChannel) {
        await roomChannel.send({
          type: 'broadcast',
          event: 'host-leaving',
          payload: { hostId: userId }
        });
      }
    }
    if (userId) {
      await supabase.from('room_participants').delete().eq('user_id', userId).eq('room_id', roomId!);
    }
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    navigate('/connection');
  };

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />

      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        {removedByHost ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4 animate-fade-in text-center">
            <p className="text-xl font-bold text-destructive">Room Access Revoked</p>
            <p className="text-muted-foreground">The host has ended your session or blocked your access.</p>
            <Button variant="outline" onClick={handleLogout}>Return to Landing</Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 animate-fade-up">
              <div className="flex items-center gap-3">
                <UserAvatar name={userName || '?'} avatarUrl={profile?.avatar_url} size="sm" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-tight">{userName}</span>
                  {isHost && <span className="text-[9px] font-black uppercase text-primary tracking-widest leading-none">Administrator</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-full border border-border/40">
                <div className="h-2 w-2 rounded-full bg-signal-strong animate-pulse" />
                <span className="text-[11px] font-mono text-muted-foreground">Secure ID: {roomId}</span>
                <button onClick={copyRoomId} className="ml-1 text-muted-foreground hover:text-foreground transition-all active:scale-90">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <SignalStrength />
                <Button variant="destructive" size="sm" onClick={handleLeaveMeeting} className="h-8 text-xs font-bold px-3">Leave Meeting</Button>
              </div>
            </div>

            {statusText && (
              <div className="mb-4 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3 bg-primary/5 rounded-lg px-4 py-3 border border-primary/20">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-tight text-primary">{statusText}</span>
                </div>
              </div>
            )}

            <TransferQueue transfers={queuedTransfers} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              {participants
                .filter((p) => p.user_id !== userId)
                .map((p, i) => (
                  <div key={p.user_id} className="animate-in fade-in zoom-in-95 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                    <UserCard
                      name={p.name}
                      avatarUrl={p.avatar_url}
                      isHost={p.user_id === room?.host_id}
                      showHostControls={isHost}
                      onRequestFile={() => {
                        transferChannelRef.current?.send({
                          type: 'broadcast',
                          event: 'transfer-request',
                          payload: { targetUserId: p.user_id, fromUserId: userId, fromName: userName, type: 'file' },
                        });
                        toast.info('File requested');
                      }}
                      onRequestFolder={() => {
                        transferChannelRef.current?.send({
                          type: 'broadcast',
                          event: 'transfer-request',
                          payload: { targetUserId: p.user_id, fromUserId: userId, fromName: userName, type: 'folder' },
                        });
                        toast.info('Folder requested');
                      }}
                      onRemove={() => handleRemoveUser(p.user_id)}
                    />
                  </div>
                ))}

              {participants.length === 1 && isHost && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground animate-in fade-in">
                  <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                    <Copy className="h-6 w-6 opacity-20" />
                  </div>
                  <p className="text-sm font-medium">Ready and waiting for peers</p>
                  <p className="text-xs opacity-60 mt-1">Share your 6-Digit Room Code to start transferring</p>
                  <Button variant="outline" size="sm" className="mt-6 gap-2 border-primary/20 text-primary" onClick={copyRoomId}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy Connection Link
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
        onAccept={async () => {
          if (!currentRequest) return;
          await supabase.from('room_participants').update({ status: 'accepted' }).eq('room_id', roomId!).eq('user_id', currentRequest.userId);
          loadParticipants();
        }}
        onReject={async () => {
          if (!currentRequest) return;
          await supabase.from('room_participants').update({ status: 'blocked' }).eq('room_id', roomId!).eq('user_id', currentRequest.userId);
          loadParticipants();
        }}
      />

      <TransferRequestDialog
        open={!!transferRequest}
        requesterName={transferRequest?.fromName || ''}
        type={transferRequest?.type || 'file'}
        onAccept={() => {
          if (!transferRequest) return;
          const { fromUserId, type } = transferRequest;
          setTransferRequest(null);
          setUploadModal({ open: true, targetUserId: fromUserId, mode: type === 'folder' ? 'folder' : 'file' });
        }}
        onReject={() => setTransferRequest(null)}
      />

      <UploadModal
        open={!!uploadModal?.open}
        mode={uploadModal?.mode || 'file'}
        onClose={() => setUploadModal(null)}
        onFileSelected={handleUploadFiles}
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

  async function handleRemoveUser(targetUserId: string) {
    await supabase.from('room_participants').update({ status: 'blocked' }).eq('room_id', roomId!).eq('user_id', targetUserId);
    toast.error('User disconnected');
  }
}
