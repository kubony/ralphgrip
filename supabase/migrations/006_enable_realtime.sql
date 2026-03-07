-- Enable Realtime for work_items table
ALTER PUBLICATION supabase_realtime ADD TABLE work_items;

-- Enable Realtime for comments table
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
