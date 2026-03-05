-- Add detail column to tasks table (Markdown storage)
-- GORM AutoMigrate adds this automatically on server start.
-- For manual execution (e.g., pre-production scripts):
ALTER TABLE tasks ADD COLUMN detail TEXT DEFAULT NULL;
