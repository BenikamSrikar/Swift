-- Add rooms table to realtime publication so room directory updates in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
