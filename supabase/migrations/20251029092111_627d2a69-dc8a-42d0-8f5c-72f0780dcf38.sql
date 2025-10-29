-- Add connected_trip_id column to bus_groups table
ALTER TABLE public.bus_groups 
ADD COLUMN connected_trip_id uuid REFERENCES public.bus_groups(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_bus_groups_connected_trip_id ON public.bus_groups(connected_trip_id);