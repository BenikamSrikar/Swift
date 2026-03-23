import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VoltsNavbar from '@/components/VoltsNavbar';
import UserCard from '@/components/UserCard';
import JoinRequestDialog from '@/components/JoinRequestDialog';
import TransferRequestDialog from '@/components/TransferRequestDialog';
import { supabase } from '@/integrations/supabase/client';
import { getStoredUserId, getStoredUserName, clearSession } from '@/lib/session';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import JSZip from 'jszip';

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
  type: 'file' | 'folder';
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

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());

  const isHost = room?.host_id === userId;

  // Load room + participants
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
      await loadParticipants();
    };

    loadRoom();
  }, [roomId, userId, userName, navigate]);

  const loadParticipants = useCallback(async () => {
    if (!roomId) return;

    const { data: parts } = await supabase
      .from('room_participants')
      .select('user_id, status')
      .eq('room_id', roomId);

    if (!parts) return;

    // Get names for accepted participants
    const accepted = parts.filter((p) => p.status === 'accepted');
    const pending = parts.filter((p) => p.status === 'pending');

    const userIds = [...accepted, ...pending].map((p) => p.user_id);
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

    // Update pending requests for host
    const newPending = pending.map((p) => ({
      userId: p.user_id,
      name: nameMap.get(p.user_id) || 'Unknown',
    }));

    setPendingRequests(newPending);
    if (newPending.length > 0 && !currentRequest) {
      setCurrentRequest(newPending[0]);
    }
  }, [roomId, currentRequest]);

  // Subscribe to participant changes
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}`)
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
      channel.unsubscribe();
    };
  }, [roomId, loadParticipants]);

  // Listen for transfer requests via Realtime broadcast
  useEffect(() => {
    if (!roomId || !userId) return;

    const channel = supabase.channel(`transfers-${roomId}`).on(
      'broadcast',
      { event: 'transfer-request' },
      (payload) => {
        const { targetUserId, fromUserId, fromName, type } = payload.payload;
        if (targetUserId === userId) {
          setTransferRequest({ fromUserId, fromName, type });
        }
      }
    );

    // Listen for WebRTC signaling
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

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, userId]);

  const handleIncomingOffer = async (fromUserId: string, offer: RTCSessionDescriptionInit, channel: any) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    peerConnections.current.set(fromUserId, pc);

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      receiveFile(dc);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: {
            targetUserId: fromUserId,
            fromUserId: userId,
            signal: event.candidate.toJSON(),
          },
        });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    channel.send({
      type: 'broadcast',
      event: 'webrtc-signal',
      payload: {
        targetUserId: fromUserId,
        fromUserId: userId,
        signal: answer,
      },
    });
  };

  const receiveFile = (dc: RTCDataChannel) => {
    const chunks: ArrayBuffer[] = [];
    let metadata: { name: string; size: number } | null = null;

    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'metadata') {
          metadata = msg;
          toast.info(`Receiving: ${msg.name}`);
        } else if (msg.type === 'done') {
          const blob = new Blob(chunks);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = metadata?.name || 'download';
          a.click();
          URL.revokeObjectURL(url);
          toast.success(`Received: ${metadata?.name}`);
          dc.close();
        }
      } else {
        chunks.push(event.data);
      }
    };
  };

  const sendFileViaPeer = async (targetUserId: string, file: File) => {
    const channel = supabase.channel(`transfers-${roomId}`);

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    peerConnections.current.set(targetUserId, pc);

    const dc = pc.createDataChannel('file-transfer');
    dataChannels.current.set(targetUserId, dc);

    dc.onopen = async () => {
      dc.send(JSON.stringify({ type: 'metadata', name: file.name, size: file.size }));

      const chunkSize = 16384;
      const buffer = await file.arrayBuffer();
      let offset = 0;

      const sendChunk = () => {
        while (offset < buffer.byteLength) {
          if (dc.bufferedAmount > chunkSize * 8) {
            setTimeout(sendChunk, 50);
            return;
          }
          const chunk = buffer.slice(offset, offset + chunkSize);
          dc.send(chunk);
          offset += chunkSize;
        }
        dc.send(JSON.stringify({ type: 'done' }));
        toast.success(`Sent: ${file.name}`);
      };

      sendChunk();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: {
            targetUserId,
            fromUserId: userId,
            signal: event.candidate.toJSON(),
          },
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    channel.send({
      type: 'broadcast',
      event: 'webrtc-signal',
      payload: {
        targetUserId,
        fromUserId: userId,
        signal: offer,
      },
    });

    // Log transfer history
    const targetName = participants.find((p) => p.user_id === targetUserId)?.name || 'Unknown';
    await supabase.from('transfer_history').insert({
      sender_id: userId!,
      sender_name: userName!,
      recipient_name: targetName,
      file_name: file.name,
      file_type: 'file',
    });
  };

  const handleRequestFile = (targetUserId: string) => {
    const channel = supabase.channel(`transfers-${roomId}`);
    channel.send({
      type: 'broadcast',
      event: 'transfer-request',
      payload: {
        targetUserId,
        fromUserId: userId,
        fromName: userName,
        type: 'file',
      },
    });
    toast.info('File request sent');
  };

  const handleRequestFolder = (targetUserId: string) => {
    const channel = supabase.channel(`transfers-${roomId}`);
    channel.send({
      type: 'broadcast',
      event: 'transfer-request',
      payload: {
        targetUserId,
        fromUserId: userId,
        fromName: userName,
        type: 'folder',
      },
    });
    toast.info('Folder request sent');
  };

  const handleTransferAccept = async () => {
    if (!transferRequest) return;

    const type = transferRequest.type;
    const fromUserId = transferRequest.fromUserId;
    setTransferRequest(null);

    if (type === 'file') {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          await sendFileViaPeer(fromUserId, file);
        }
      };
      input.click();
    } else {
      // Folder: select multiple files, zip them
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      (input as any).webkitdirectory = true;
      input.onchange = async () => {
        const files = input.files;
        if (!files || files.length === 0) return;

        toast.info('Compressing folder…');
        const zip = new JSZip();
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const path = (f as any).webkitRelativePath || f.name;
          zip.file(path, f);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const zipFile = new File([blob], 'folder.zip', { type: 'application/zip' });
        await sendFileViaPeer(fromUserId, zipFile);
      };
      input.click();
    }
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

    toast.success('User removed');
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

    // Cleanup peer connections
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

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">
        {/* Room header */}
        <div className="flex items-center justify-between mb-6 animate-fade-up">
          <div>
            <h2 className="text-lg font-bold">Room</h2>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                {roomId?.slice(0, 8)}…
              </code>
              <button onClick={copyRoomId} className="text-muted-foreground hover:text-foreground transition-colors">
                {copied ? <Check className="h-3.5 w-3.5 text-signal-strong" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          {room?.status === 'locked' && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
              Locked
            </span>
          )}
          {isHost && (
            <span className="text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-1 rounded">
              Host
            </span>
          )}
        </div>

        {/* Participants */}
        <div className="space-y-3">
          {participants.map((p, i) => (
            <div
              key={p.user_id}
              className="animate-fade-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <UserCard
                name={p.name}
                isCurrentUser={p.user_id === userId}
                isHost={p.user_id === room?.host_id}
                showHostControls={isHost}
                onRequestFile={() => handleRequestFile(p.user_id)}
                onRequestFolder={() => handleRequestFolder(p.user_id)}
                onRemove={() => handleRemoveUser(p.user_id)}
              />
            </div>
          ))}

          {participants.length === 1 && isHost && (
            <div className="text-center py-12 text-muted-foreground text-sm animate-fade-up" style={{ animationDelay: '200ms' }}>
              <p>Share your Room ID to invite others</p>
              <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={copyRoomId}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy Room ID
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Join request dialog (host only) */}
      <JoinRequestDialog
        open={!!currentRequest && isHost}
        requesterName={currentRequest?.name || ''}
        onAccept={handleAcceptJoin}
        onReject={handleRejectJoin}
      />

      {/* Transfer request dialog */}
      <TransferRequestDialog
        open={!!transferRequest}
        requesterName={transferRequest?.fromName || ''}
        type={transferRequest?.type || 'file'}
        onAccept={handleTransferAccept}
        onReject={() => setTransferRequest(null)}
      />
    </div>
  );
}
