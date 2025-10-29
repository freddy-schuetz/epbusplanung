-- Add stops column to trips table to store stop information
ALTER TABLE trips ADD COLUMN IF NOT EXISTS stops JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries on stops
CREATE INDEX IF NOT EXISTS idx_trips_stops ON trips USING GIN (stops);

-- Add comment
COMMENT ON COLUMN trips.stops IS 'Array of stop objects with name, time, passengers, etc.';