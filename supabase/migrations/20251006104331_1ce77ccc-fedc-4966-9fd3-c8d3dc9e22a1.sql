-- Add missing trip_number column to trips table
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS trip_number text;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_group_id ON public.trips(group_id);