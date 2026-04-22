-- Change room_id from uuid to text in rooms table
ALTER TABLE public.rooms ALTER COLUMN room_id TYPE text USING room_id::text;

-- Change room_id from uuid to text in room_participants table  
ALTER TABLE public.room_participants ALTER COLUMN room_id TYPE text USING room_id::text;