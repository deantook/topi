-- Add estimated_hours column to tasks table (integer hours, nullable)
ALTER TABLE tasks ADD COLUMN estimated_hours INT DEFAULT NULL;
