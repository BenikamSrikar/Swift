ALTER TABLE public.transfer_history ADD COLUMN direction text NOT NULL DEFAULT 'sent';
ALTER TABLE public.transfer_history ADD COLUMN download_url text;