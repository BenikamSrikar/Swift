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
import LinkModal from '@/components/LinkModal';
import HistoryModal from '@/components/HistoryModal';
import ConfirmTransferModal from '@/components/ConfirmTransferModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Copy, Check, MessageSquare, Send, Users, User as UserIcon, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import JSZip from 'jszip';
import TransferQueue, { QueuedTransfer } from '@/components/TransferQueue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  type: 'file' | 'folder' | 'video' | 'link';
  transferId: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  audioData?: string; // Base64 for broadcast
  timestamp: number;
  type: 'group' | 'individual';
  targetUserId?: string;
  msgType?: 'text' | 'voice';
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
  const [fileConfirmModal, setFileConfirmModal] = useState<{ open: boolean; files: File[]; targetUserId: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageInput, setMessageInput] = useState('');
  const [chatMode, setChatMode] = useState<{ type: 'group' | 'individual'; targetUser?: Participant }>({ type: 'group' });
  const [chatView, setChatView] = useState<'list' | 'messages'>('list');
  const [lastMessageTimes, setLastMessageTimes] = useState<Record<string, number>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<any>(null);

  const transferChannelRef = useRef<any>(null);
  const transferPayloads = useRef<Map<string, { files: File[]; targetUserId: string }>>(new Map());

  const isHost = room?.host_id === userId;
  const [removedByHost, setRemovedByHost] = useState(false);
  const [remoteUploadProgress, setRemoteUploadProgress] = useState<Record<string, number>>({});

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
    };

    loadRoom();
  }, [roomId, userId, userName, navigate]);

  // Cleanup recording interval on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    };
  }, [isRecording]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatOpen]);

  // Handle unread messages
  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0);
    }
  }, [chatOpen]);

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

    const cleanup = () => {
      // Use sendBeacon for reliable fire-and-forget on unload
      // Supabase REST: DELETE /rest/v1/room_participants?room_id=eq.X&user_id=eq.Y
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/room_participants?room_id=eq.${encodeURIComponent(roomId)}&user_id=eq.${encodeURIComponent(userId)}`;
      const blob = new Blob([], { type: 'application/json' });
      // Include auth headers via fetch (best-effort, non-blocking)
      navigator.sendBeacon(url, blob);

      // Also kick off a normal delete as a backup (may not complete on unload)
      supabase
        .from('room_participants')
        .delete()
        .eq('user_id', userId)
        .eq('room_id', roomId)
        .then(() => {}, () => {});

      supabase
        .from('sessions')
        .delete()
        .eq('user_id', userId)
        .then(() => {}, () => {});
    };

    const handleVisibility = () => {
      // Intentionally empty to prevent kicking users on tab switch
    };

    window.addEventListener('beforeunload', cleanup);
    // document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', cleanup);
      // document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId, roomId]);

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
      const { targetUserId, fromUserId, fromName, type, transferId } = payload.payload;
      if (targetUserId === userId) {
        setTransferRequest({ fromUserId, fromName, type, transferId } as any);
      }
    });

    channel.on('broadcast', { event: 'transfer-accepted' }, (payload) => {
      const { targetUserId, fromUserId, transferId } = payload.payload;
      if (targetUserId === userId) {
        setQueuedTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'pending' } : t
        ));
      }
    });

    channel.on('broadcast', { event: 'transfer-rejected' }, (payload) => {
      const { targetUserId, fromUserId, fromName, transferId } = payload.payload;
      if (targetUserId === userId) {
        toast.info(`${fromName} declined your transfer request.`);
        setQueuedTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
        // Remove from queue after a short delay
        setTimeout(() => {
          setQueuedTransfers(prev => prev.filter(t => t.id !== transferId));
          transferPayloads.current.delete(transferId);
        }, 5000);
      }
    });

    channel.on('broadcast', { event: 'pre-transfer-alert' }, (payload) => {
      const { targetUserId, fromUserId, fromName, mode } = payload.payload;
      if (targetUserId === userId) {
        toast.info(`${fromName} is trying to send a ${mode}.`, {
          description: "Please stay alert to accept the transfer request shortly.",
          duration: 6000
        });
      }
    });

    channel.on('broadcast', { event: 'upload-progress' }, (payload) => {
      const { targetUserId, fromUserId, progress } = payload.payload;
      if (targetUserId === userId) {
        setRemoteUploadProgress(prev => ({ ...prev, [fromUserId]: progress }));
      }
    });

    channel.on('broadcast', { event: 'transfer-ready' }, async (payload) => {
      const { targetUserId, fromUserId, fromName, transferId, name, size, type, totalChunks } = payload.payload;
      if (targetUserId !== userId) return;

      // Add to queue
      setQueuedTransfers(prev => [...prev, {
        id: transferId,
        name,
        size,
        progress: 0,
        status: 'processing',
        direction: 'receiving',
        type
      }]);
      setStatusText(`Downloading: ${name}`);

      // Clear remote upload progress since upload is done
      setRemoteUploadProgress(prev => {
        const next = { ...prev };
        delete next[fromUserId];
        return next;
      });

      try {
        const isLink = type === 'link';
        const chunks: Blob[] = [];
        const numChunks = totalChunks || 1;

        // Download each chunk
        for (let i = 0; i < numChunks; i++) {
          const chunkPath = numChunks === 1
            ? `${roomId}/${transferId}/${name}`
            : `${roomId}/${transferId}/chunk_${i}`;

          const { data: chunkBlob, error: chunkErr } = await supabase.storage
            .from('swift-transfers')
            .download(chunkPath);

          if (chunkErr || !chunkBlob) throw new Error(`Failed to download chunk ${i}`);
          chunks.push(chunkBlob);

          const pct = Math.round(((i + 1) / numChunks) * 100);
          setQueuedTransfers(prev => prev.map(t =>
            t.id === transferId ? { ...t, progress: pct } : t
          ));
          setStatusText(`Downloading ${name}: ${pct}%`);
        }

        // Reassemble
        let finalBlob: Blob;
        if (type === 'folder' && numChunks > 1) {
          setStatusText(`Merging ${numChunks} parts...`);
          const mergedZip = new JSZip();
          for (let i = 0; i < chunks.length; i++) {
            setStatusText(`Merging part ${i + 1} of ${numChunks}...`);
            const tempZip = await JSZip.loadAsync(chunks[i]);
            tempZip.forEach((relativePath, zipEntry) => {
              if (!zipEntry.dir) {
                mergedZip.file(relativePath, zipEntry.async('blob'));
              }
            });
          }
          setStatusText(`Finalizing folder...`);
          finalBlob = await mergedZip.generateAsync({ type: 'blob', compression: 'STORE' });
        } else if (type === 'folder' && numChunks === 1) {
          finalBlob = chunks[0];
        } else {
          finalBlob = new Blob(chunks);
        }
        
        const url = URL.createObjectURL(finalBlob);

        setStatusText(null);
        setQueuedTransfers(prev => prev.map(t =>
          t.id === transferId ? { ...t, status: 'completed', progress: 100 } : t
        ));
        setTimeout(() => {
          setQueuedTransfers(prev => prev.filter(t => t.id !== transferId));
        }, 3000);

        // Log history
        let senderEmail = '';
        const { data: prof } = await supabase.from('profiles').select('email').eq('auth_user_id', fromUserId).single();
        if (prof) senderEmail = prof.email;

        await supabase.from('transfer_history').insert({
          sender_id: fromUserId,
          sender_name: fromName || 'Unknown Peer',
          recipient_name: userName!,
          file_name: name,
          file_type: isLink ? 'link' : name.endsWith('.zip') ? 'folder' : 'file',
          sender_email: senderEmail || '',
          direction: 'received',
        } as any);

        toast.success(`${isLink ? 'Link' : 'File'} received: ${name}`, {
          action: {
            label: isLink ? 'Copy Link' : 'Download',
            onClick: async () => {
              if (isLink) {
                const text = await finalBlob.text();
                navigator.clipboard.writeText(text);
                toast.success('Link copied to clipboard');
              } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                a.click();
                URL.revokeObjectURL(url);
              }
            },
          },
          duration: 15000,
        });

        // Cleanup all chunks from bucket
        const pathsToDelete = numChunks === 1
          ? [`${roomId}/${transferId}/${name}`]
          : Array.from({ length: numChunks }, (_, i) => `${roomId}/${transferId}/chunk_${i}`);
        await supabase.storage.from('swift-transfers').remove(pathsToDelete);

      } catch (err) {
        console.error('Download error:', err);
        setStatusText(null);
        toast.error('Failed to download file');
        setQueuedTransfers(prev => prev.map(t =>
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
      }
    });

    channel.on('broadcast', { event: 'chat-message' }, (payload) => {
      const msg = payload.payload;
      if (msg.type === 'group' || msg.targetUserId === userId) {
        setChatMessages((prev) => [...prev, msg]);
        const otherPartyId = msg.type === 'group' ? 'group' : msg.senderId;
        setLastMessageTimes(prev => ({
          ...prev,
          [otherPartyId]: msg.timestamp
        }));
        if (!chatOpen) {
          setUnreadCount((prev) => prev + 1);
        }
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

  // ── Queue Processing ──
  useEffect(() => {
    const isAnyProcessing = queuedTransfers.some(t => t.status === 'processing');
    if (isAnyProcessing) return;

    const next = queuedTransfers.find(t => t.status === 'pending' && t.direction === 'sending');
    if (!next) return;

    const payload = transferPayloads.current.get(next.id);
    if (!payload) return;

    const startTransfer = async () => {
      const CHUNK_SIZE = 40 * 1024 * 1024; // 40MB per chunk
      const files = payload.files;
      const isFolder = next.type === 'folder';
      
      let totalChunks = 1;
      let batches: File[][] = [];

      if (isFolder) {
        let currentBatch: File[] = [];
        let currentSize = 0;
        for (const f of files) {
          currentBatch.push(f);
          currentSize += f.size;
          if (currentSize >= CHUNK_SIZE) {
             batches.push(currentBatch);
             currentBatch = [];
             currentSize = 0;
          }
        }
        if (currentBatch.length > 0) batches.push(currentBatch);
        totalChunks = batches.length;
      } else {
        const totalSize = files[0].size;
        totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
      }

      setQueuedTransfers(prev => prev.map(t => t.id === next.id ? { ...t, status: 'processing', progress: 0 } : t));
      setStatusText(`Uploading ${next.name}${totalChunks > 1 ? ` (${totalChunks} parts)` : ''}...`);

      // Helper: upload one chunk via signed URL + XHR with progress
      const uploadChunk = (chunkBlob: Blob, path: string, chunkIndex: number): Promise<void> => {
        return new Promise(async (resolve, reject) => {
          const { data: signedData, error: signedError } = await supabase.storage
            .from('swift-transfers')
            .createSignedUploadUrl(path);

          if (signedError || !signedData) {
            return reject(new Error(`Signed URL failed for chunk ${chunkIndex}: ${signedError?.message}`));
          }

          const xhr = new XMLHttpRequest();
          xhr.open('PUT', signedData.signedUrl);
          xhr.setRequestHeader('Content-Type', 'application/octet-stream');

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              // Overall progress = chunks done + current chunk progress
              const chunksDoneFraction = chunkIndex / totalChunks;
              const currentChunkFraction = (e.loaded / e.total) / totalChunks;
              const pct = Math.min(Math.round((chunksDoneFraction + currentChunkFraction) * 100), 99);
              setQueuedTransfers(prev => prev.map(t =>
                t.id === next.id ? { ...t, progress: pct } : t
              ));
              setStatusText(`Uploading ${next.name}: ${pct}%${totalChunks > 1 ? ` (part ${chunkIndex + 1}/${totalChunks})` : ''}`);

              transferChannelRef.current?.send({
                type: 'broadcast',
                event: 'upload-progress',
                payload: {
                  targetUserId: payload.targetUserId,
                  fromUserId: userId,
                  progress: pct
                }
              });
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Chunk ${chunkIndex} upload failed: HTTP ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error(`Network error on chunk ${chunkIndex}`));
          xhr.send(chunkBlob);
        });
      };

      try {
        if (!isFolder) {
          const blob = files[0];
          if (totalChunks === 1) {
            // Single file — upload directly
            const filePath = `${roomId}/${next.id}/${next.name}`;
            await uploadChunk(blob, filePath, 0);
          } else {
            // Multi-chunk upload
            for (let i = 0; i < totalChunks; i++) {
              const start = i * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, blob.size);
              const chunkBlob = blob.slice(start, end);
              const chunkPath = `${roomId}/${next.id}/chunk_${i}`;
              await uploadChunk(chunkBlob, chunkPath, i);
            }
          }
        } else {
          // Folder upload: zip and upload in chunks
          for (let i = 0; i < totalChunks; i++) {
             setStatusText(`Zipping part ${i + 1} of ${totalChunks}...`);
             const zip = new JSZip();
             batches[i].forEach(f => {
               const path = (f as any).webkitRelativePath || f.name;
               zip.file(path, f);
             });
             const chunkBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
             const chunkPath = totalChunks === 1 
                ? `${roomId}/${next.id}/${next.name}` 
                : `${roomId}/${next.id}/chunk_${i}`;
             await uploadChunk(chunkBlob, chunkPath, i);
          }
        }

        console.log('[Swift] All chunks uploaded successfully');

        // Notify receiver with totalChunks info
        transferChannelRef.current?.send({
          type: 'broadcast',
          event: 'transfer-ready',
          payload: {
            targetUserId: payload.targetUserId,
            fromUserId: userId,
            fromName: userName,
            transferId: next.id,
            name: next.name,
            size: next.size,
            type: next.type,
            totalChunks
          },
        });

        setQueuedTransfers(prev => prev.map(t => t.id === next.id ? { ...t, status: 'completed', progress: 100 } : t));
        setStatusText(null);
        toast.success(`Successfully sent ${next.name}`);

        setTimeout(() => {
          setQueuedTransfers(prev => prev.filter(t => t.id !== next.id));
          transferPayloads.current.delete(next.id);
        }, 3000);

        const targetName = participants.find(p => p.user_id === payload.targetUserId)?.name || 'Unknown';
        await supabase.from('transfer_history').insert({
          sender_id: userId!,
          sender_name: userName!,
          recipient_name: targetName,
          file_name: next.name,
          file_type: next.type,
          sender_email: profile?.email || '',
          direction: 'sent',
          file_list: (next as any).file_list || null
        } as any);

      } catch (err) {
        console.error('Upload error:', err);
        setQueuedTransfers(prev => prev.map(t => t.id === next.id ? { ...t, status: 'failed' } : t));
        setStatusText(null);
        toast.error(`Failed to send ${next.name}: ${(err as Error).message}`);
      }
    };

    startTransfer();
  }, [queuedTransfers, userId, userName, profile, participants]);

  // ── Send files ──
  const sendFilesViaPeer = async (targetUserId: string, files: File[]) => {
    const targetName = participants.find((p) => p.user_id === targetUserId)?.name || 'Unknown';
    
    let fileName: string;
    let fileType: 'file' | 'folder' = 'file';
    let totalSize = 0;

    if (files.length === 1) {
      fileName = files[0].name;
      totalSize = files[0].size;
    } else {
      fileName = `swift_batch_${format(new Date(), 'HHmm')}.zip`;
      fileType = 'folder';
      totalSize = files.reduce((acc, f) => acc + f.size, 0);
    }

    const transferId = generateTransferId();
    transferPayloads.current.set(transferId, { files, targetUserId });

    setQueuedTransfers(prev => [...prev, {
      id: transferId,
      name: fileName,
      size: totalSize,
      progress: 0,
      status: 'awaiting-approval',
      direction: 'sending',
      type: fileType,
      file_list: files.length > 1 ? files.map(f => (f as any).webkitRelativePath || f.name) : undefined
    } as any]);

    // Send the actual transfer request to the receiver
    transferChannelRef.current?.send({
      type: 'broadcast',
      event: 'transfer-request',
      payload: { 
        targetUserId, 
        fromUserId: userId, 
        fromName: userName, 
        type: fileType,
        transferId
      },
    });
  };

  const sendChatMessage = (e?: React.FormEvent, customMsg?: Partial<ChatMessage>) => {
    if (e) e.preventDefault();
    if ((!messageInput.trim() && !customMsg) || !transferChannelRef.current) return;

    const newMessage: ChatMessage = {
      id: generateTransferId(),
      senderId: userId!,
      senderName: userName!,
      text: messageInput.trim(),
      timestamp: Date.now(),
      type: chatMode.type,
      targetUserId: chatMode.targetUser?.user_id,
      msgType: 'text',
      ...customMsg
    };

    transferChannelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: newMessage,
    });

    // Add to local state
    setChatMessages((prev) => [...prev, newMessage]);
    
    // Update last message time for sorting
    const otherPartyId = chatMode.type === 'group' ? 'group' : chatMode.targetUser?.user_id;
    if (otherPartyId) {
      setLastMessageTimes(prev => ({
        ...prev,
        [otherPartyId]: newMessage.timestamp
      }));
    }

    setMessageInput('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          sendChatMessage(undefined, { 
            msgType: 'voice', 
            audioData: base64data,
            text: '🎤 Voice Message' 
          });
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(durationIntervalRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.msgType === 'voice' && msg.audioData) {
      return (
        <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 h-1 bg-muted-foreground/20 rounded-full overflow-hidden">
              <div className="h-full bg-primary/40 w-full animate-pulse" />
            </div>
          </div>
          <audio src={msg.audioData} controls className="h-8 w-full filter brightness-90 contrast-125" />
        </div>
      );
    }

    const text = msg.text || '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1 font-bold break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part} <ExternalLink className="h-3 w-3" />
          </a>
        );
      }
      return part;
    });
  };



  const handleUploadFiles = async (files: File[]) => {
    if (!uploadModal) return;
    setFileConfirmModal({ open: true, files, targetUserId: uploadModal.targetUserId });
    setUploadModal(null);
  };

  const handleUploadFolder = async (files: FileList) => {
    if (!uploadModal) return;
    const fileArray = Array.from(files);
    await sendFilesViaPeer(uploadModal.targetUserId, fileArray);
    setUploadModal(null);
  };

  const handleLogout = async () => {
    if (isHost && roomId) {
      await supabase.from('rooms').update({ status: 'locked' }).eq('room_id', roomId);
    }
    if (userId) {
      await supabase.from('room_participants').delete().eq('user_id', userId).eq('room_id', roomId!);
      await supabase.from('sessions').delete().eq('user_id', userId);
    }
    await signOut();
    navigate('/');
  };

  const handleLeaveMeeting = async () => {
    if (isHost && roomId) {
      await supabase.from('rooms').update({ status: 'locked' }).eq('room_id', roomId);
    }
    if (userId) {
      await supabase.from('room_participants').delete().eq('user_id', userId).eq('room_id', roomId!);
    }
    navigate('/connection');
  };

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  async function handleRemoveUser(targetUserId: string) {
    await supabase.from('room_participants').update({ status: 'blocked' }).eq('room_id', roomId!).eq('user_id', targetUserId);
    toast.error('User disconnected');
  }

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Particle Effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(25)].map((_, i) => (
          <div 
            key={i} 
            className="absolute bottom-[-50px] bg-primary/20 rounded-full animate-particle-float"
            style={{ 
              left: `${Math.random() * 100}%`, 
              width: `${Math.random() * 8 + 3}px`, 
              height: `${Math.random() * 8 + 3}px`, 
              animationDelay: `${Math.random() * 15}s`,
              animationDuration: `${Math.random() * 10 + 15}s` 
            }} 
          />
        ))}
      </div>

      <div className="relative z-10 w-full flex-none">
        <VoltsNavbar showActions onLogout={handleLogout} onHistoryClick={() => setHistoryOpen(true)} />
      </div>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
        {removedByHost ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 animate-fade-in text-center">
            <p className="text-xl font-bold text-destructive">Room Access Revoked</p>
            <p className="text-muted-foreground">The host has ended your session or blocked your access.</p>
            <Button variant="outline" onClick={handleLogout}>Return to Landing</Button>
          </div>
        ) : (
          <div className="relative flex flex-row flex-1 min-h-0 overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-6 py-6 transition-all duration-500 ease-in-out">
              <div className="max-w-6xl mx-auto w-full flex flex-col gap-8">
                <div className="flex flex-row items-center justify-between gap-4 animate-fade-up">
                  <div className="flex items-center gap-2 bg-muted/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-border/40 shadow-sm transition-all hover:bg-muted/30">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">Room Code: {roomId}</span>
                    <button onClick={copyRoomId} className="ml-2 p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-all active:scale-95">
                      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <SignalStrength />
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setChatOpen(!chatOpen)}
                        className={`h-10 w-10 rounded-2xl transition-all ${chatOpen ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted/40'}`}
                      >
                        <MessageSquare className="h-5 w-5" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-background animate-bounce">
                            {unreadCount}
                          </span>
                        )}
                      </Button>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleLeaveMeeting} className="h-10 text-xs font-black uppercase tracking-widest px-6 rounded-2xl shadow-lg shadow-destructive/20 hover:shadow-destructive/40 transition-all">Leave Meeting</Button>
                  </div>
                </div>

                {statusText && (
                  <div className="animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3 bg-primary/5 rounded-lg px-4 py-3 border border-primary/20">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-tight text-primary">{statusText}</span>
                    </div>
                  </div>
                )}
                
                <TransferQueue transfers={queuedTransfers} />

                <div className={`
                  grid gap-6 w-full transition-all duration-500 ease-in-out
                  ${participants.filter(p => p.user_id !== userId).length === 1 ? 'flex justify-center' : 
                    participants.filter(p => p.user_id !== userId).length === 2 ? 'grid-cols-1 md:grid-cols-2' : 
                    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}
                `}>
                  {/* Other Participants */}
                  {participants
                    .filter(p => p.user_id !== userId)
                    .map((p, i) => (
                      <div 
                        key={p.user_id} 
                        className={`animate-in fade-in zoom-in-95 duration-300 ${participants.filter(p => p.user_id !== userId).length === 1 ? 'w-full max-w-xl' : ''}`} 
                        style={{ animationDelay: `${i * 100}ms` }}
                      >
                        <UserCard
                          name={p.name}
                          avatarUrl={p.avatar_url}
                          isHost={p.user_id === room?.host_id}
                          showHostControls={isHost}
                          uploadProgress={remoteUploadProgress[p.user_id]}
                          onRequestFile={() => {
                            setUploadModal({ open: true, targetUserId: p.user_id, mode: 'file' });
                            transferChannelRef.current?.send({
                              type: 'broadcast',
                              event: 'pre-transfer-alert',
                              payload: { targetUserId: p.user_id, fromUserId: userId, fromName: userName, mode: 'file' },
                            });
                          }}
                          onRequestFolder={() => {
                            setUploadModal({ open: true, targetUserId: p.user_id, mode: 'folder' });
                            transferChannelRef.current?.send({
                              type: 'broadcast',
                              event: 'pre-transfer-alert',
                              payload: { targetUserId: p.user_id, fromUserId: userId, fromName: userName, mode: 'folder' },
                            });
                          }}
                          onRemove={() => handleRemoveUser(p.user_id)}
                        />
                      </div>
                    ))}

                  {participants.filter(p => p.user_id !== userId).length === 0 && (
                    <div className="col-span-full mt-12 flex flex-col items-center justify-center py-12 text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-1000">
                      <div className="w-12 h-12 bg-muted/20 rounded-full flex items-center justify-center mb-4 opacity-50">
                        {isHost ? <Copy className="h-5 w-5" /> : <div className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin" />}
                      </div>
                      <p className="text-sm font-medium">
                        {isHost ? 'Ready and waiting for peers' : 'Connecting to host...'}
                      </p>
                      {isHost && (
                        <>
                          <p className="text-xs opacity-60 mt-1 mb-6">Share your Room Code to start transferring</p>
                          <Button variant="outline" size="sm" className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-xl px-6" onClick={copyRoomId}>
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            Copy Room ID
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Sidebar */}
            <div className={`
              fixed lg:absolute inset-y-0 right-0 z-[100] w-full lg:w-[420px] flex flex-col bg-background/95 backdrop-blur-2xl border-l border-border shadow-2xl transition-all duration-500 ease-in-out
              ${chatOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
              {chatView === 'list' ? (
                // Chat List (WhatsApp Style)
                <>
                  <div className="p-6 border-b border-border/40 flex items-center justify-between bg-muted/5">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight">Chats</h2>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mt-1">
                        {participants.length} Active Participants
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)} className="rounded-full h-10 w-10 hover:bg-destructive/10 hover:text-destructive transition-all">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Group Chat Entry */}
                    <button 
                      onClick={() => {
                        setChatMode({ type: 'group' });
                        setChatView('messages');
                      }}
                      className="w-full p-4 flex items-center gap-4 hover:bg-muted/30 transition-all border-b border-border/10 group"
                    >
                      <div className="h-14 w-14 rounded-2xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center text-primary-foreground group-hover:scale-105 transition-transform">
                        <Users className="h-7 w-7" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-base">Global Group</span>
                          {lastMessageTimes['group'] && (
                            <span className="text-[10px] text-muted-foreground/50">{format(lastMessageTimes['group'], 'HH:mm')}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {chatMessages.filter(m => m.type === 'group').slice(-1)[0]?.text || 'Broadcast to everyone in the room'}
                        </p>
                      </div>
                    </button>

                    {/* Participants List sorted by last message time */}
                    {[...participants]
                      .filter(p => p.user_id !== userId)
                      .sort((a, b) => (lastMessageTimes[b.user_id] || 0) - (lastMessageTimes[a.user_id] || 0))
                      .map((p) => {
                        const lastMsg = chatMessages.filter(m => m.type === 'individual' && (m.senderId === p.user_id || m.targetUserId === p.user_id)).slice(-1)[0];
                        return (
                          <button 
                            key={p.user_id}
                            onClick={() => {
                              setChatMode({ type: 'individual', targetUser: p });
                              setChatView('messages');
                            }}
                            className="w-full p-4 flex items-center gap-4 hover:bg-muted/30 transition-all border-b border-border/10 group"
                          >
                            <div className="h-14 w-14 rounded-2xl overflow-hidden shadow-md group-hover:scale-105 transition-transform">
                              <UserAvatar name={p.name} avatarUrl={p.avatar_url} className="h-full w-full" />
                            </div>
                            <div className="flex-1 text-left">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-base">{p.name}</span>
                                {lastMessageTimes[p.user_id] && (
                                  <span className="text-[10px] text-muted-foreground/50">{format(lastMessageTimes[p.user_id], 'HH:mm')}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                                {lastMsg ? lastMsg.text : 'Start a private conversation'}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    }
                  </div>
                </>
              ) : (
                // Message View
                <>
                  <div className="p-4 border-b border-border/40 flex items-center gap-3 bg-muted/5">
                    <Button variant="ghost" size="icon" onClick={() => setChatView('list')} className="rounded-full h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all">
                      <ExternalLink className="h-4 w-4 rotate-180" />
                    </Button>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0">
                        {chatMode.type === 'group' ? (
                          <div className="h-full w-full bg-primary flex items-center justify-center text-primary-foreground">
                            <Users className="h-5 w-5" />
                          </div>
                        ) : (
                          <UserAvatar name={chatMode.targetUser?.name || ''} avatarUrl={chatMode.targetUser?.avatar_url} className="h-full w-full" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm truncate">{chatMode.type === 'group' ? 'Global Group' : chatMode.targetUser?.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                          {chatMode.type === 'group' ? `${participants.length} members` : 'Direct Message'}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)} className="rounded-full h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar bg-muted/5">
                    {chatMessages
                      .filter(m => chatMode.type === 'group' ? m.type === 'group' : (m.type === 'individual' && (m.senderId === chatMode.targetUser?.user_id || m.targetUserId === chatMode.targetUser?.user_id)))
                      .length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center opacity-20 gap-3">
                        <MessageSquare className="h-12 w-12" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Messages Yet</p>
                      </div>
                    )}
                    {chatMessages
                      .filter(m => chatMode.type === 'group' ? m.type === 'group' : (m.type === 'individual' && (m.senderId === chatMode.targetUser?.user_id || m.targetUserId === chatMode.targetUser?.user_id)))
                      .map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`flex flex-col max-w-[85%] animate-in slide-in-from-bottom-1 duration-300 ${msg.senderId === userId ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        {chatMode.type === 'group' && msg.senderId !== userId && (
                          <span className="text-[9px] font-black uppercase tracking-tighter text-primary/70 mb-1 ml-1">{msg.senderName}</span>
                        )}
                        <div 
                          className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm transition-all ${
                            msg.senderId === userId 
                              ? 'bg-primary text-primary-foreground rounded-tr-none shadow-primary/20' 
                              : 'bg-background border border-border/40 rounded-tl-none'
                          }`}
                        >
                          {renderMessageContent(msg)}
                          <div className={`text-[8px] mt-1 text-right ${msg.senderId === userId ? 'text-primary-foreground/50' : 'text-muted-foreground/50'}`}>
                            {format(msg.timestamp, 'HH:mm')}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 border-t border-border/40 bg-background">
                    {isRecording ? (
                      <div className="flex items-center gap-3 bg-destructive/5 p-3 rounded-2xl border border-destructive/20 animate-pulse">
                        <div className="h-3 w-3 rounded-full bg-destructive animate-ping" />
                        <span className="flex-1 text-xs font-black text-destructive uppercase tracking-widest">
                          Recording: {formatDuration(recordingDuration)}
                        </span>
                        <Button variant="destructive" size="sm" onClick={stopRecording} className="h-8 px-4 rounded-xl text-[10px] font-black uppercase">
                          Stop & Send
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={sendChatMessage} className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            placeholder="Type a message..."
                            className="w-full bg-muted/40 border-none rounded-2xl pl-4 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40 font-medium"
                          />
                        </div>
                        <Button 
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={startRecording}
                          className="h-11 w-11 rounded-2xl hover:bg-primary/10 text-primary transition-all shrink-0"
                        >
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={!messageInput.trim()}
                          className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all shrink-0"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </form>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
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
          const { fromUserId, type, transferId } = transferRequest as any;
          setTransferRequest(null);
          
          // Notify sender to start
          transferChannelRef.current?.send({
            type: 'broadcast',
            event: 'transfer-accepted',
            payload: { 
              targetUserId: fromUserId, 
              fromUserId: userId,
              transferId 
            },
          });
        }}
        onReject={() => {
          if (!transferRequest) return;
          const { fromUserId, transferId } = transferRequest as any;
          setTransferRequest(null);
          
          // Notify sender of rejection
          transferChannelRef.current?.send({
            type: 'broadcast',
            event: 'transfer-rejected',
            payload: { 
              targetUserId: fromUserId, 
              fromUserId: userId,
              fromName: userName,
              transferId 
            },
          });
        }}
      />

      <UploadModal
        open={!!uploadModal}
        mode={uploadModal?.mode || 'file'}
        onClose={() => setUploadModal(null)}
        onFileSelected={handleUploadFiles}
        onFolderSelected={handleUploadFolder}
      />

      <ConfirmTransferModal
        open={!!fileConfirmModal}
        files={fileConfirmModal?.files || []}
        targetName={fileConfirmModal ? (participants.find(p => p.user_id === fileConfirmModal.targetUserId)?.name || 'Unknown') : ''}
        onConfirm={async () => {
          if (fileConfirmModal) {
            await sendFilesViaPeer(fileConfirmModal.targetUserId, fileConfirmModal.files);
            setFileConfirmModal(null);
          }
        }}
        onCancel={() => setFileConfirmModal(null)}
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
