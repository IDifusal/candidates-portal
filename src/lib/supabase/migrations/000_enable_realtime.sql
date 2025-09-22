-- Migration: 000_enable_realtime.sql
-- Description: Enable real-time functionality for chat tables
-- Date: 2025-01-XX
-- Note: This should be run AFTER creating the tables (after 001_create_chat_tables.sql)

-- Enable real-time for chat_conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;

-- Enable real-time for chat_messages table  
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Optional: Enable real-time for candidates table if you want to listen to candidate updates
-- ALTER PUBLICATION supabase_realtime ADD TABLE candidates;

-- Verify real-time is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('chat_conversations', 'chat_messages');

-- Comments
COMMENT ON PUBLICATION supabase_realtime IS 'Supabase real-time publication for live updates';
