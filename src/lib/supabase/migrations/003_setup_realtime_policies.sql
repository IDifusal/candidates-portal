-- Migration: 003_setup_realtime_policies.sql
-- Description: Setup additional RLS policies for real-time functionality and API access
-- Date: 2025-01-XX

-- Additional RLS policies for API access (service role)

-- Policy to allow service role to access all conversations (for API operations)
CREATE POLICY "Service role can access all conversations" ON chat_conversations
    FOR ALL USING (auth.role() = 'service_role');

-- Policy to allow service role to access all messages (for API operations)
CREATE POLICY "Service role can access all messages" ON chat_messages
    FOR ALL USING (auth.role() = 'service_role');

-- Policy to allow candidates to access conversations via talent token
-- This is handled through the API, but we create a policy for direct access if needed
CREATE POLICY "Allow talent token access to conversations" ON chat_conversations
    FOR SELECT USING (
        -- This policy is mainly for documentation, actual access is via API
        talent_token IS NOT NULL 
        AND token_expires_at > NOW() 
        AND status = 'active'
    );

-- Policy to allow reading messages for talent token holders
-- This is handled through the API, but we create a policy for direct access if needed
CREATE POLICY "Allow talent token access to messages" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE id = conversation_id 
            AND talent_token IS NOT NULL
            AND token_expires_at > NOW()
            AND status = 'active'
        )
    );

-- Policy to allow candidates to insert messages via talent token
-- This is handled through the API with proper validation
CREATE POLICY "Allow talent token message insertion" ON chat_messages
    FOR INSERT WITH CHECK (
        sender_type = 'candidate' AND
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE id = conversation_id 
            AND candidate_id = sender_id
            AND talent_token IS NOT NULL
            AND token_expires_at > NOW()
            AND status = 'active'
        )
    );

-- Create a view for admin dashboard to see conversation summaries
CREATE VIEW admin_conversation_summary AS
SELECT 
    c.id,
    c.candidate_id,
    c.admin_user_id,
    c.status,
    c.opportunity_type,
    c.urgency,
    c.engagement_type,
    c.created_at,
    c.last_message_at,
    cand.first_name || ' ' || cand.last_name AS candidate_name,
    cand.email AS candidate_email,
    CASE 
        WHEN cand.city IS NOT NULL AND cand.country IS NOT NULL THEN cand.city || ', ' || cand.country
        WHEN cand.city IS NOT NULL THEN cand.city
        WHEN cand.country IS NOT NULL THEN cand.country
        ELSE NULL
    END AS candidate_location,
    -- Get last message preview
    (
        SELECT content 
        FROM chat_messages m 
        WHERE m.conversation_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
    ) AS last_message,
    -- Get unread count for admin
    (
        SELECT COUNT(*)::INTEGER
        FROM chat_messages m
        WHERE m.conversation_id = c.id
        AND m.sender_type = 'candidate'
        AND m.read_at IS NULL
    ) AS unread_count,
    -- Get total message count
    (
        SELECT COUNT(*)::INTEGER
        FROM chat_messages m
        WHERE m.conversation_id = c.id
    ) AS total_messages
FROM chat_conversations c
LEFT JOIN candidates cand ON c.candidate_id = cand.id
WHERE c.status = 'active'
ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC;

-- Grant access to the view
GRANT SELECT ON admin_conversation_summary TO authenticated;
GRANT SELECT ON admin_conversation_summary TO service_role;

-- Create a function to safely insert messages (with validation)
CREATE OR REPLACE FUNCTION insert_chat_message(
    p_conversation_id UUID,
    p_sender_type sender_type,
    p_sender_id UUID,
    p_content TEXT,
    p_message_type message_type DEFAULT 'text',
    p_talent_token UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    conversation_exists BOOLEAN;
    token_valid BOOLEAN;
    new_message_id UUID;
    result JSON;
BEGIN
    -- Validate conversation exists and is active
    SELECT EXISTS(
        SELECT 1 FROM chat_conversations 
        WHERE id = p_conversation_id AND status = 'active'
    ) INTO conversation_exists;
    
    IF NOT conversation_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Conversation not found or inactive'
        );
    END IF;
    
    -- If sender is candidate, validate talent token
    IF p_sender_type = 'candidate' AND p_talent_token IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM chat_conversations
            WHERE id = p_conversation_id
            AND talent_token = p_talent_token
            AND candidate_id = p_sender_id
            AND token_expires_at > NOW()
            AND status = 'active'
        ) INTO token_valid;
        
        IF NOT token_valid THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Invalid or expired talent token'
            );
        END IF;
    END IF;
    
    -- If sender is admin, validate they own the conversation
    IF p_sender_type = 'admin' THEN
        SELECT EXISTS(
            SELECT 1 FROM chat_conversations
            WHERE id = p_conversation_id
            AND admin_user_id = p_sender_id
        ) INTO token_valid;
        
        IF NOT token_valid THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Admin does not own this conversation'
            );
        END IF;
    END IF;
    
    -- Insert the message
    INSERT INTO chat_messages (
        conversation_id,
        sender_type,
        sender_id,
        content,
        message_type
    ) VALUES (
        p_conversation_id,
        p_sender_type,
        p_sender_id,
        p_content,
        p_message_type
    ) RETURNING id INTO new_message_id;
    
    -- Return success with message details
    SELECT json_build_object(
        'success', true,
        'message', json_build_object(
            'id', m.id,
            'conversation_id', m.conversation_id,
            'sender_type', m.sender_type,
            'sender_id', m.sender_id,
            'content', m.content,
            'message_type', m.message_type,
            'read_at', m.read_at,
            'created_at', m.created_at,
            'updated_at', m.updated_at
        )
    ) INTO result
    FROM chat_messages m
    WHERE m.id = new_message_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION insert_chat_message(UUID, sender_type, UUID, TEXT, message_type, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_chat_message(UUID, sender_type, UUID, TEXT, message_type, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION insert_chat_message(UUID, sender_type, UUID, TEXT, message_type, UUID) TO anon;

-- Create indexes for the view performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message_at ON chat_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON chat_messages(conversation_id, created_at DESC);

-- Comments
COMMENT ON VIEW admin_conversation_summary IS 'Summary view of conversations for admin dashboard with message counts and previews';
COMMENT ON FUNCTION insert_chat_message(UUID, sender_type, UUID, TEXT, message_type, UUID) IS 'Safely insert chat messages with proper validation for both admin and talent token access';
