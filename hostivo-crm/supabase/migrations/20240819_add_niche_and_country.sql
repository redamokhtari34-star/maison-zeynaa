-- Add niche and country columns to hostivo_clients
ALTER TABLE public.hostivo_clients
ADD COLUMN IF NOT EXISTS niche text,
ADD COLUMN IF NOT EXISTS pays text DEFAULT 'France';

-- Create index for filtering by niche
CREATE INDEX IF NOT EXISTS idx_hostivo_clients_niche ON public.hostivo_clients(niche);

-- Create index for filtering by country
CREATE INDEX IF NOT EXISTS idx_hostivo_clients_pays ON public.hostivo_clients(pays);

-- Create index for filtering by both niche and country
CREATE INDEX IF NOT EXISTS idx_hostivo_clients_niche_pays ON public.hostivo_clients(niche, pays);
