-- Add owner column to tasks table (human | agent | null)
-- GORM AutoMigrate adds this automatically on server start.
-- For manual execution (e.g., pre-production scripts):
ALTER TABLE tasks ADD COLUMN owner VARCHAR(6) DEFAULT NULL;
