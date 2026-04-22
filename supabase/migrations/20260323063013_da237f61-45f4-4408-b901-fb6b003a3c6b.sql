-- Sessions table (ephemeral user sessions)
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can update own session" ON public.sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete own session" ON public.sessions FOR DELETE USING (true);

-- Rooms table
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL UNIQUE,
  host_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can update rooms" ON public.rooms FOR UPDATE USING (true);

-- Room participants
CREATE TABLE public.room_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can manage participants" ON public.room_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read participants" ON public.room_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can update participants" ON public.room_participants FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete participants" ON public.room_participants FOR DELETE USING (true);

-- Transfer history (sender-only)
CREATE TABLE public.transfer_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'file',
  transferred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transfer_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert history" ON public.transfer_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read own history" ON public.transfer_history FOR SELECT USING (true);