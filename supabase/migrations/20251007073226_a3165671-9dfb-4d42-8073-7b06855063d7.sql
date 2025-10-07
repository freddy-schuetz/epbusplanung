-- Add split group support to bus_groups table
ALTER TABLE bus_groups 
ADD COLUMN IF NOT EXISTS split_group_id uuid,
ADD COLUMN IF NOT EXISTS part_number integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_parts integer DEFAULT 1;

-- Add index for better performance when querying split groups
CREATE INDEX IF NOT EXISTS idx_bus_groups_split_group_id ON bus_groups(split_group_id);

-- Add comment for documentation
COMMENT ON COLUMN bus_groups.split_group_id IS 'Links split groups together - all parts share the same split_group_id';
COMMENT ON COLUMN bus_groups.part_number IS 'Part number for split groups (1, 2, 3...)';
COMMENT ON COLUMN bus_groups.total_parts IS 'Total number of parts in the split group';