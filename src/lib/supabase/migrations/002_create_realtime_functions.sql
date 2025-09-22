-- Migration: 002_create_realtime_functions.sql
-- Description: Create functions and triggers for real-time chat functionality
-- Date: 2025-01-XX

-- Enable real-time for chat tables
-- Note: This needs to be done in Supabase Dashboard or via API, but documented here
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Function to get conversation with candidate details (for API use)
CREATE OR REPLACE FUNCTION get_conversation_with_candidate(conversation_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', c.id,
        'candidate_id', c.candidate_id,
        'admin_user_id', c.admin_user_id,
        'status', c.status,
        'talent_token', c.talent_token,
        'token_expires_at', c.token_expires_at,
        'opportunity_type', c.opportunity_type,
        'urgency', c.urgency,
        'engagement_type', c.engagement_type,
        'created_at', c.created_at,
        'updated_at', c.updated_at,
        'last_message_at', c.last_message_at,
        'candidate', json_build_object(
            'id', cand.id,
            'first_name', cand.first_name,
            'last_name', cand.last_name,
            'email', cand.email,
            'phone', cand.phone,
            'city', cand.city,
            'country', cand.country,
            'location', CASE 
                WHEN cand.city IS NOT NULL AND cand.country IS NOT NULL THEN cand.city || ', ' || cand.country
                WHEN cand.city IS NOT NULL THEN cand.city
                WHEN cand.country IS NOT NULL THEN cand.country
                ELSE NULL
            END
        )
    ) INTO result
    FROM chat_conversations c
    LEFT JOIN candidates cand ON c.candidate_id = cand.id
    WHERE c.id = conversation_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation by talent token (for magic link access)
CREATE OR REPLACE FUNCTION get_conversation_by_token(token UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', c.id,
        'candidate_id', c.candidate_id,
        'admin_user_id', c.admin_user_id,
        'status', c.status,
        'talent_token', c.talent_token,
        'token_expires_at', c.token_expires_at,
        'opportunity_type', c.opportunity_type,
        'urgency', c.urgency,
        'engagement_type', c.engagement_type,
        'created_at', c.created_at,
        'updated_at', c.updated_at,
        'last_message_at', c.last_message_at,
        'candidate', json_build_object(
            'id', cand.id,
            'first_name', cand.first_name,
            'last_name', cand.last_name,
            'email', cand.email,
            'phone', cand.phone,
            'city', cand.city,
            'country', cand.country,
            'location', CASE 
                WHEN cand.city IS NOT NULL AND cand.country IS NOT NULL THEN cand.city || ', ' || cand.country
                WHEN cand.city IS NOT NULL THEN cand.city
                WHEN cand.country IS NOT NULL THEN cand.country
                ELSE NULL
            END
        )
    ) INTO result
    FROM chat_conversations c
    LEFT JOIN candidates cand ON c.candidate_id = cand.id
    WHERE c.talent_token = token 
    AND c.status = 'active'
    AND c.token_expires_at > NOW();
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get messages for a conversation
CREATE OR REPLACE FUNCTION get_conversation_messages(conversation_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', m.id,
            'conversation_id', m.conversation_id,
            'sender_type', m.sender_type,
            'sender_id', m.sender_id,
            'content', m.content,
            'message_type', m.message_type,
            'read_at', m.read_at,
            'created_at', m.created_at,
            'updated_at', m.updated_at
        ) ORDER BY m.created_at ASC
    ) INTO result
    FROM chat_messages m
    WHERE m.conversation_id = get_conversation_messages.conversation_id;
    
    RETURN COALESCE(result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(
    conversation_id UUID,
    reader_type sender_type,
    reader_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE chat_messages 
    SET read_at = NOW()
    WHERE chat_messages.conversation_id = mark_messages_as_read.conversation_id
    AND sender_type != reader_type  -- Don't mark own messages as read
    AND read_at IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread message count for a conversation
CREATE OR REPLACE FUNCTION get_unread_count(
    conversation_id UUID,
    for_sender_type sender_type
)
RETURNS INTEGER AS $$
DECLARE
    unread_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO unread_count
    FROM chat_messages m
    WHERE m.conversation_id = get_unread_count.conversation_id
    AND m.sender_type != for_sender_type  -- Messages from the other party
    AND m.read_at IS NULL;
    
    RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if talent token is valid
CREATE OR REPLACE FUNCTION is_talent_token_valid(token UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_valid BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM chat_conversations
        WHERE talent_token = token
        AND status = 'active'
        AND token_expires_at > NOW()
    ) INTO is_valid;
    
    RETURN COALESCE(is_valid, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to extend token expiry (for resend magic link)
CREATE OR REPLACE FUNCTION extend_token_expiry(
    conversation_id UUID,
    new_token UUID DEFAULT NULL,
    days_to_extend INTEGER DEFAULT 7
)
RETURNS JSON AS $$
DECLARE
    updated_token UUID;
    new_expiry TIMESTAMPTZ;
    result JSON;
BEGIN
    -- Use provided token or generate new one
    updated_token := COALESCE(new_token, uuid_generate_v4());
    new_expiry := NOW() + (days_to_extend || ' days')::INTERVAL;
    
    UPDATE chat_conversations 
    SET 
        talent_token = updated_token,
        token_expires_at = new_expiry,
        updated_at = NOW()
    WHERE id = conversation_id
    AND status = 'active';
    
    IF FOUND THEN
        result := json_build_object(
            'success', true,
            'talent_token', updated_token,
            'token_expires_at', new_expiry
        );
    ELSE
        result := json_build_object(
            'success', false,
            'error', 'Conversation not found or inactive'
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_conversation_with_candidate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_by_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_messages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_as_read(UUID, sender_type, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_count(UUID, sender_type) TO authenticated;
GRANT EXECUTE ON FUNCTION is_talent_token_valid(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION extend_token_expiry(UUID, UUID, INTEGER) TO authenticated;

-- Grant execute permissions to anon users (for magic link access)
GRANT EXECUTE ON FUNCTION get_conversation_by_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_conversation_messages(UUID) TO anon;
GRANT EXECUTE ON FUNCTION is_talent_token_valid(UUID) TO anon;
GRANT EXECUTE ON FUNCTION mark_messages_as_read(UUID, sender_type, UUID) TO anon;

-- Comments
COMMENT ON FUNCTION get_conversation_with_candidate(UUID) IS 'Get conversation details with candidate info for admin use';
COMMENT ON FUNCTION get_conversation_by_token(UUID) IS 'Get conversation details using talent token for magic link access';
COMMENT ON FUNCTION get_conversation_messages(UUID) IS 'Get all messages for a conversation ordered by creation time';
COMMENT ON FUNCTION mark_messages_as_read(UUID, sender_type, UUID) IS 'Mark messages as read for a specific user type';
COMMENT ON FUNCTION get_unread_count(UUID, sender_type) IS 'Get count of unread messages for a user in a conversation';
COMMENT ON FUNCTION is_talent_token_valid(UUID) IS 'Check if a talent token is valid and not expired';
COMMENT ON FUNCTION extend_token_expiry(UUID, UUID, INTEGER) IS 'Extend or renew talent token expiry for magic link resend';
