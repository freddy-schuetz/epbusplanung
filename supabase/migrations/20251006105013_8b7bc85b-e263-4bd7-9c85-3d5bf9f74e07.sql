-- Remove trip_number from trips table (it belongs in bus_groups only)
ALTER TABLE public.trips DROP COLUMN IF EXISTS trip_number;