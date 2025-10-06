-- Create buses table
CREATE TABLE public.buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  seats INTEGER NOT NULL,
  license_plate TEXT,
  is_contractual BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create bus_groups table
CREATE TABLE public.bus_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_number TEXT,
  bus_id UUID REFERENCES public.buses(id),
  km_hinweg TEXT,
  km_rueckweg TEXT,
  luggage TEXT,
  accommodation TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create trips table
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reisecode TEXT NOT NULL,
  produktcode TEXT,
  reise TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('hin', 'rueck')),
  datum TEXT NOT NULL,
  uhrzeit TEXT,
  kontingent INTEGER DEFAULT 0,
  buchungen INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unplanned' CHECK (status IN ('unplanned', 'draft', 'completed', 'locked')),
  group_id UUID REFERENCES public.bus_groups(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Create policies for buses (readable by all authenticated users)
CREATE POLICY "Authenticated users can view buses"
  ON public.buses FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for bus_groups
CREATE POLICY "Users can view their own bus groups"
  ON public.bus_groups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bus groups"
  ON public.bus_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bus groups"
  ON public.bus_groups FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bus groups"
  ON public.bus_groups FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for trips
CREATE POLICY "Users can view their own trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trips"
  ON public.trips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trips"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trips"
  ON public.trips FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_buses_updated_at
  BEFORE UPDATE ON public.buses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bus_groups_updated_at
  BEFORE UPDATE ON public.bus_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial bus data
INSERT INTO public.buses (name, seats, license_plate, is_contractual) VALUES
  ('Bus 49er (49 Plätze)', 49, NULL, true),
  ('Bus 54er (54 Plätze)', 54, NULL, true),
  ('Bus 57er (57 Plätze)', 57, NULL, true),
  ('Bus 59er (59 Plätze)', 59, NULL, true),
  ('Bus 61er (61 Plätze)', 61, NULL, true),
  ('Fremd 49er (49 Plätze)', 49, NULL, false),
  ('Fremd 54er (54 Plätze)', 54, NULL, false),
  ('Fremd 57er (57 Plätze)', 57, NULL, false),
  ('Fremd 59er (59 Plätze)', 59, NULL, false),
  ('Fremd 61er (61 Plätze)', 61, NULL, false);

-- Enable realtime
ALTER TABLE public.buses REPLICA IDENTITY FULL;
ALTER TABLE public.bus_groups REPLICA IDENTITY FULL;
ALTER TABLE public.trips REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.buses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;