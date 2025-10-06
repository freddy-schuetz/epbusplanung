-- Drop existing RLS policies for trips
DROP POLICY IF EXISTS "Users can view their own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can insert their own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can update their own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can delete their own trips" ON public.trips;

-- Create new collaborative RLS policies for trips
CREATE POLICY "All authenticated users can view all trips"
ON public.trips
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can insert trips"
ON public.trips
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "All authenticated users can update trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can delete trips"
ON public.trips
FOR DELETE
TO authenticated
USING (true);

-- Drop existing RLS policies for bus_groups
DROP POLICY IF EXISTS "Users can view their own bus groups" ON public.bus_groups;
DROP POLICY IF EXISTS "Users can insert their own bus groups" ON public.bus_groups;
DROP POLICY IF EXISTS "Users can update their own bus groups" ON public.bus_groups;
DROP POLICY IF EXISTS "Users can delete their own bus groups" ON public.bus_groups;

-- Create new collaborative RLS policies for bus_groups
CREATE POLICY "All authenticated users can view all bus groups"
ON public.bus_groups
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can insert bus groups"
ON public.bus_groups
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "All authenticated users can update bus groups"
ON public.bus_groups
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "All authenticated users can delete bus groups"
ON public.bus_groups
FOR DELETE
TO authenticated
USING (true);

-- Clear existing buses
DELETE FROM public.buses;

-- Insert your specific bus fleet
INSERT INTO public.buses (name, seats, license_plate, is_contractual) VALUES
('Finkbeiner-2', 49, 'FN-2', true),
('Finkbeiner-3', 50, 'FN-3', true),
('Finkbeiner-4', 54, 'FN-4', true),
('Finkbeiner-5', 57, 'FN-5', true),
('Heeß-1', 57, 'HS-1', true),
('Heeß-2', 54, 'HS-2', true),
('Picco-4', 49, 'PC-4', true),
('Piccolonia', 54, 'PCL', true),
('Boonk', 50, 'BNK', true),
('Marti', 57, 'MRT', true),
('Hager', 61, 'HGR', true);