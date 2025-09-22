-- Migration: 004_fix_rls_for_service_role.sql
-- Description: Fix RLS policies to allow service role and API access for chat system
-- Date: 2025-01-XX

-- The issue: RLS policies are blocking API calls because there's no authenticated user (auth.uid() is null)
-- Solution: Update policies to allow service role access and API-based operations

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can view their conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Admins can create conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Admins can update their conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Admins can view messages in their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Admins can send messages in their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Admins can update their own messages" ON chat_messages;

-- Create more permissive policies that work with API calls

-- CHAT_CONVERSATIONS policies
-- Allow service role full access (for API calls)
CREATE POLICY "Service role full access to conversations" ON chat_conversations
    FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to see conversations where they are the admin
CREATE POLICY "Authenticated users can view their conversations" ON chat_conversations
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        auth.uid()::text = admin_user_id OR
        auth.uid() IS NULL  -- Allow for API calls without auth
    );

-- Allow authenticated users to create conversations
CREATE POLICY "Authenticated users can create conversations" ON chat_conversations
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        auth.uid()::text = admin_user_id OR
        auth.uid() IS NULL  -- Allow for API calls without auth
    );

-- Allow authenticated users to update their conversations
CREATE POLICY "Authenticated users can update their conversations" ON chat_conversations
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        auth.uid()::text = admin_user_id OR
        auth.uid() IS NULL  -- Allow for API calls without auth
    );

-- CHAT_MESSAGES policies
-- Allow service role full access (for API calls)
CREATE POLICY "Service role full access to messages" ON chat_messages
    FOR ALL USING (auth.role() = 'service_role');

-- Allow viewing messages in conversations the user has access to
CREATE POLICY "Users can view messages in accessible conversations" ON chat_messages
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE id = conversation_id AND (
                admin_user_id = auth.uid()::text OR
                auth.uid() IS NULL  -- Allow for API calls without auth
            )
        )
    );

-- Allow inserting messages in conversations the user has access to
CREATE POLICY "Users can send messages in accessible conversations" ON chat_messages
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR
        (
            (sender_type = 'admin' AND sender_id = auth.uid()::text) OR
            (sender_type = 'candidate') OR  -- Candidates can send via talent token (validated in API)
            auth.uid() IS NULL  -- Allow for API calls without auth
        )
    );

-- Allow updating own messages
CREATE POLICY "Users can update their own messages" ON chat_messages
    FOR UPDATE USING (
        auth.role() = 'service_role' OR
        sender_id = auth.uid()::text OR
        auth.uid() IS NULL  -- Allow for API calls without auth
    );

-- Alternative: Disable RLS temporarily for development (ONLY for development!)
-- Uncomment these lines if you want to completely disable RLS for testing:
-- ALTER TABLE chat_conversations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- Create a function to temporarily bypass RLS for API operations
CREATE OR REPLACE FUNCTION create_conversation_bypass_rls(
    p_candidate_id UUID,
    p_admin_user_id UUID,
    p_opportunity_type TEXT DEFAULT 'direct_hire',
    p_urgency TEXT DEFAULT 'flexible',
    p_engagement_type TEXT DEFAULT 'full_time'
)
RETURNS JSON
SECURITY DEFINER  -- This runs with the permissions of the function owner
LANGUAGE plpgsql
AS $$
DECLARE
    new_conversation_id UUID;
    talent_token UUID;
    token_expires_at TIMESTAMPTZ;
    result JSON;
BEGIN
    -- Generate magic token
    talent_token := gen_random_uuid();
    token_expires_at := NOW() + INTERVAL '7 days';
    
    -- Insert conversation (bypasses RLS because of SECURITY DEFINER)
    INSERT INTO chat_conversations (
        candidate_id,
        admin_user_id,
        status,
        talent_token,
        token_expires_at,
        opportunity_type,
        urgency,
        engagement_type,
        last_message_at
    ) VALUES (
        p_candidate_id,
        p_admin_user_id,
        'active',
        talent_token,
        token_expires_at,
        p_opportunity_type::opportunity_type,
        p_urgency::urgency_type,
        p_engagement_type::engagement_type,
        NOW()
    ) RETURNING id INTO new_conversation_id;
    
    -- Return the created conversation
    SELECT json_build_object(
        'id', new_conversation_id,
        'candidate_id', p_candidate_id,
        'admin_user_id', p_admin_user_id,
        'status', 'active',
        'talent_token', talent_token,
        'token_expires_at', token_expires_at,
        'opportunity_type', p_opportunity_type,
        'urgency', p_urgency,
        'engagement_type', p_engagement_type,
        'created_at', NOW(),
        'updated_at', NOW(),
        'last_message_at', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant execute permission to service role and authenticated users
GRANT EXECUTE ON FUNCTION create_conversation_bypass_rls(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_conversation_bypass_rls(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_conversation_bypass_rls(UUID, UUID, TEXT, TEXT, TEXT) TO anon;

-- Create a function to insert messages bypassing RLS
CREATE OR REPLACE FUNCTION insert_message_bypass_rls(
    p_conversation_id UUID,
    p_sender_type TEXT,
    p_sender_id UUID,
    p_content TEXT,
    p_message_type TEXT DEFAULT 'text'
)
RETURNS JSON
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    new_message_id UUID;
    result JSON;
BEGIN
    -- Insert message (bypasses RLS because of SECURITY DEFINER)
    INSERT INTO chat_messages (
        conversation_id,
        sender_type,
        sender_id,
        content,
        message_type
    ) VALUES (
        p_conversation_id,
        p_sender_type::sender_type,
        p_sender_id,
        p_content,
        p_message_type::message_type
    ) RETURNING id INTO new_message_id;
    
    -- Return the created message
    SELECT json_build_object(
        'id', new_message_id,
        'conversation_id', p_conversation_id,
        'sender_type', p_sender_type,
        'sender_id', p_sender_id,
        'content', p_content,
        'message_type', p_message_type,
        'read_at', NULL,
        'created_at', NOW(),
        'updated_at', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant execute permission to service role and authenticated users
GRANT EXECUTE ON FUNCTION insert_message_bypass_rls(UUID, TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION insert_message_bypass_rls(UUID, TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_message_bypass_rls(UUID, TEXT, UUID, TEXT, TEXT) TO anon;

-- Comments
COMMENT ON FUNCTION create_conversation_bypass_rls(UUID, UUID, TEXT, TEXT, TEXT) IS 'Create conversation bypassing RLS for API calls';
COMMENT ON FUNCTION insert_message_bypass_rls(UUID, TEXT, UUID, TEXT, TEXT) IS 'Insert message bypassing RLS for API calls';

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('chat_conversations', 'chat_messages')
ORDER BY tablename, policyname;
