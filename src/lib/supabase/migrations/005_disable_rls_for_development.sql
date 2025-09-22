-- Migration: 005_disable_rls_for_development.sql
-- Description: Disable RLS on chat tables for development (UNRESTRICTED ACCESS)
-- Date: 2025-01-XX
-- WARNING: This removes all security restrictions - ONLY for development!

-- Disable Row Level Security on chat tables
ALTER TABLE chat_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to clean up
DROP POLICY IF EXISTS "Service role can access all conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Service role can access all messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow talent token access to conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Allow talent token access to messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow talent token message insertion" ON chat_messages;
DROP POLICY IF EXISTS "Service role full access to conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can view their conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can update their conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Service role full access to messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages in accessible conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages in accessible conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;

-- Grant full access to all roles for development
GRANT ALL PRIVILEGES ON TABLE chat_conversations TO anon;
GRANT ALL PRIVILEGES ON TABLE chat_conversations TO authenticated;
GRANT ALL PRIVILEGES ON TABLE chat_conversations TO service_role;

GRANT ALL PRIVILEGES ON TABLE chat_messages TO anon;
GRANT ALL PRIVILEGES ON TABLE chat_messages TO authenticated;
GRANT ALL PRIVILEGES ON TABLE chat_messages TO service_role;

-- Also make sure candidates table is accessible (if it has RLS)
ALTER TABLE candidates DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE candidates TO anon;
GRANT ALL PRIVILEGES ON TABLE candidates TO authenticated;
GRANT ALL PRIVILEGES ON TABLE candidates TO service_role;

-- Grant access to sequences (for auto-increment IDs if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Comments
COMMENT ON TABLE chat_conversations IS 'Chat conversations table - RLS DISABLED for development';
COMMENT ON TABLE chat_messages IS 'Chat messages table - RLS DISABLED for development';

-- Verification query
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN 'ENABLED (Restricted)'
        ELSE 'DISABLED (Unrestricted)'
    END as security_status
FROM pg_tables 
WHERE tablename IN ('chat_conversations', 'chat_messages', 'candidates')
AND schemaname = 'public'
ORDER BY tablename;
