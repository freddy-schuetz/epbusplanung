-- Add hub functionality fields to bus_groups table
ALTER TABLE bus_groups 
ADD COLUMN hub_role text CHECK (hub_role IN ('incoming', 'outgoing')),
ADD COLUMN hub_id text,
ADD COLUMN hub_location text;

-- Add index for hub queries
CREATE INDEX idx_bus_groups_hub_id ON bus_groups(hub_id) WHERE hub_id IS NOT NULL;