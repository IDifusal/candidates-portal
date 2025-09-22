-- Migration: 006_secure_magic_links.sql
-- Description: Add security measures for magic links against bots and unauthorized access
-- Date: 2025-01-XX

-- Add security columns to chat_conversations
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS last_accessed_ip INET;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS lock_reason TEXT;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS allowed_ip_ranges INET[];

-- Create table for tracking access attempts (for rate limiting and bot detection)
CREATE TABLE IF NOT EXISTS magic_link_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    talent_token UUID NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    access_result TEXT NOT NULL, -- 'success', 'expired', 'invalid', 'rate_limited', 'blocked'
    fingerprint_data JSONB, -- Browser fingerprinting data
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key to conversations
    CONSTRAINT fk_magic_link_access_log_token 
        FOREIGN KEY (talent_token) 
        REFERENCES chat_conversations(talent_token) 
        ON DELETE CASCADE
);

-- Indexes for performance and security queries
CREATE INDEX IF NOT EXISTS idx_magic_link_access_log_token ON magic_link_access_log(talent_token);
CREATE INDEX IF NOT EXISTS idx_magic_link_access_log_ip ON magic_link_access_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_magic_link_access_log_created_at ON magic_link_access_log(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_accessed ON chat_conversations(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_access_count ON chat_conversations(access_count);

-- Function to validate and track magic link access
CREATE OR REPLACE FUNCTION validate_magic_link_access(
    p_talent_token UUID,
    p_ip_address INET,
    p_user_agent TEXT DEFAULT NULL,
    p_fingerprint_data JSONB DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    conversation_record RECORD;
    recent_attempts INTEGER;
    is_suspicious BOOLEAN := FALSE;
    access_result TEXT := 'success';
    result JSON;
    max_daily_attempts INTEGER := 10; -- Max attempts per day per IP
    max_hourly_attempts INTEGER := 5;  -- Max attempts per hour per IP
    rate_limit_window_hours INTEGER := 1;
    rate_limit_window_days INTEGER := 1;
BEGIN
    -- Get conversation details
    SELECT * INTO conversation_record
    FROM chat_conversations
    WHERE talent_token = p_talent_token;
    
    -- Check if token exists
    IF NOT FOUND THEN
        INSERT INTO magic_link_access_log (talent_token, ip_address, user_agent, access_result, fingerprint_data)
        VALUES (p_talent_token, p_ip_address, p_user_agent, 'invalid', p_fingerprint_data);
        
        RETURN json_build_object(
            'success', false,
            'error', 'invalid_token',
            'message', 'Invalid or expired magic link'
        );
    END IF;
    
    -- Check if conversation is locked
    IF conversation_record.is_locked THEN
        INSERT INTO magic_link_access_log (talent_token, ip_address, user_agent, access_result, fingerprint_data)
        VALUES (p_talent_token, p_ip_address, p_user_agent, 'blocked', p_fingerprint_data);
        
        RETURN json_build_object(
            'success', false,
            'error', 'conversation_locked',
            'message', 'This conversation has been locked due to suspicious activity'
        );
    END IF;
    
    -- Check token expiration
    IF conversation_record.token_expires_at <= NOW() THEN
        INSERT INTO magic_link_access_log (talent_token, ip_address, user_agent, access_result, fingerprint_data)
        VALUES (p_talent_token, p_ip_address, p_user_agent, 'expired', p_fingerprint_data);
        
        access_result := 'expired';
        RETURN json_build_object(
            'success', false,
            'error', 'token_expired',
            'message', 'This magic link has expired'
        );
    END IF;
    
    -- Rate limiting: Check recent attempts from this IP
    SELECT COUNT(*) INTO recent_attempts
    FROM magic_link_access_log
    WHERE ip_address = p_ip_address
    AND created_at > NOW() - (rate_limit_window_hours || ' hours')::INTERVAL;
    
    IF recent_attempts >= max_hourly_attempts THEN
        INSERT INTO magic_link_access_log (talent_token, ip_address, user_agent, access_result, fingerprint_data)
        VALUES (p_talent_token, p_ip_address, p_user_agent, 'rate_limited', p_fingerprint_data);
        
        RETURN json_build_object(
            'success', false,
            'error', 'rate_limited',
            'message', 'Too many attempts. Please try again later.'
        );
    END IF;
    
    -- Daily rate limiting
    SELECT COUNT(*) INTO recent_attempts
    FROM magic_link_access_log
    WHERE ip_address = p_ip_address
    AND created_at > NOW() - (rate_limit_window_days || ' days')::INTERVAL;
    
    IF recent_attempts >= max_daily_attempts THEN
        INSERT INTO magic_link_access_log (talent_token, ip_address, user_agent, access_result, fingerprint_data)
        VALUES (p_talent_token, p_ip_address, p_user_agent, 'rate_limited', p_fingerprint_data);
        
        RETURN json_build_object(
            'success', false,
            'error', 'daily_limit_exceeded',
            'message', 'Daily access limit exceeded. Please contact support if you need assistance.'
        );
    END IF;
    
    -- Bot detection: Check for suspicious patterns
    -- 1. Check for rapid successive attempts
    SELECT COUNT(*) INTO recent_attempts
    FROM magic_link_access_log
    WHERE talent_token = p_talent_token
    AND ip_address = p_ip_address
    AND created_at > NOW() - INTERVAL '5 minutes';
    
    IF recent_attempts >= 3 THEN
        is_suspicious := TRUE;
    END IF;
    
    -- 2. Check user agent patterns (basic bot detection)
    IF p_user_agent IS NOT NULL THEN
        IF p_user_agent ~* '(bot|crawler|spider|scraper|curl|wget|python|go-http|okhttp)' THEN
            is_suspicious := TRUE;
        END IF;
    END IF;
    
    -- If suspicious, lock the conversation
    IF is_suspicious THEN
        UPDATE chat_conversations 
        SET is_locked = TRUE,
            lock_reason = 'Suspicious access pattern detected'
        WHERE talent_token = p_talent_token;
        
        INSERT INTO magic_link_access_log (talent_token, ip_address, user_agent, access_result, fingerprint_data)
        VALUES (p_talent_token, p_ip_address, p_user_agent, 'blocked', p_fingerprint_data);
        
        RETURN json_build_object(
            'success', false,
            'error', 'suspicious_activity',
            'message', 'Access blocked due to suspicious activity'
        );
    END IF;
    
    -- Update conversation access tracking
    UPDATE chat_conversations 
    SET access_count = access_count + 1,
        last_accessed_at = NOW(),
        last_accessed_ip = p_ip_address,
        user_agent = p_user_agent
    WHERE talent_token = p_talent_token;
    
    -- Log successful access
    INSERT INTO magic_link_access_log (talent_token, ip_address, user_agent, access_result, fingerprint_data)
    VALUES (p_talent_token, p_ip_address, p_user_agent, 'success', p_fingerprint_data);
    
    -- Return success with conversation data
    RETURN json_build_object(
        'success', true,
        'conversation', json_build_object(
            'id', conversation_record.id,
            'candidate_id', conversation_record.candidate_id,
            'status', conversation_record.status,
            'opportunity_type', conversation_record.opportunity_type,
            'urgency', conversation_record.urgency,
            'engagement_type', conversation_record.engagement_type,
            'access_count', conversation_record.access_count + 1,
            'created_at', conversation_record.created_at
        )
    );
END;
$$;

-- Function to unlock conversation (for admin use)
CREATE OR REPLACE FUNCTION unlock_conversation(
    p_conversation_id UUID,
    p_admin_reason TEXT DEFAULT 'Manual unlock by admin'
)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE chat_conversations 
    SET is_locked = FALSE,
        lock_reason = NULL
    WHERE id = p_conversation_id;
    
    RETURN FOUND;
END;
$$;

-- Function to get security stats for a conversation
CREATE OR REPLACE FUNCTION get_conversation_security_stats(p_conversation_id UUID)
RETURNS JSON
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    conversation_record RECORD;
    access_stats JSON;
    recent_attempts INTEGER;
    unique_ips INTEGER;
BEGIN
    -- Get conversation details
    SELECT * INTO conversation_record
    FROM chat_conversations
    WHERE id = p_conversation_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Conversation not found');
    END IF;
    
    -- Get access statistics
    SELECT 
        COUNT(*) as total_attempts,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(CASE WHEN access_result = 'success' THEN 1 END) as successful_access,
        COUNT(CASE WHEN access_result = 'blocked' THEN 1 END) as blocked_attempts,
        COUNT(CASE WHEN access_result = 'rate_limited' THEN 1 END) as rate_limited_attempts,
        MAX(created_at) as last_attempt
    INTO access_stats
    FROM magic_link_access_log
    WHERE talent_token = conversation_record.talent_token;
    
    RETURN json_build_object(
        'conversation_id', p_conversation_id,
        'is_locked', conversation_record.is_locked,
        'lock_reason', conversation_record.lock_reason,
        'access_count', conversation_record.access_count,
        'last_accessed_at', conversation_record.last_accessed_at,
        'last_accessed_ip', conversation_record.last_accessed_ip,
        'token_expires_at', conversation_record.token_expires_at,
        'access_stats', access_stats
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_magic_link_access(UUID, INET, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION validate_magic_link_access(UUID, INET, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_magic_link_access(UUID, INET, TEXT, JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION unlock_conversation(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_conversation(UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION get_conversation_security_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_security_stats(UUID) TO service_role;

-- Create view for admin security monitoring
CREATE OR REPLACE VIEW admin_security_dashboard AS
SELECT 
    c.id as conversation_id,
    c.candidate_id,
    c.admin_user_id,
    c.access_count,
    c.is_locked,
    c.lock_reason,
    c.last_accessed_at,
    c.last_accessed_ip,
    c.token_expires_at,
    -- Access log statistics
    COALESCE(log_stats.total_attempts, 0) as total_attempts,
    COALESCE(log_stats.unique_ips, 0) as unique_ips,
    COALESCE(log_stats.blocked_attempts, 0) as blocked_attempts,
    COALESCE(log_stats.rate_limited_attempts, 0) as rate_limited_attempts,
    COALESCE(log_stats.last_attempt, c.created_at) as last_attempt
FROM chat_conversations c
LEFT JOIN (
    SELECT 
        talent_token,
        COUNT(*) as total_attempts,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(CASE WHEN access_result = 'blocked' THEN 1 END) as blocked_attempts,
        COUNT(CASE WHEN access_result = 'rate_limited' THEN 1 END) as rate_limited_attempts,
        MAX(created_at) as last_attempt
    FROM magic_link_access_log
    GROUP BY talent_token
) log_stats ON c.talent_token = log_stats.talent_token
WHERE c.status = 'active'
ORDER BY c.last_accessed_at DESC NULLS LAST, c.created_at DESC;

-- Grant access to security dashboard
GRANT SELECT ON admin_security_dashboard TO authenticated;
GRANT SELECT ON admin_security_dashboard TO service_role;

-- Function to get security summary for admin dashboard
CREATE OR REPLACE FUNCTION get_security_summary(p_admin_user_id UUID)
RETURNS JSON
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_conversations', (
            SELECT COUNT(*)
            FROM chat_conversations
            WHERE admin_user_id = p_admin_user_id::text
        ),
        'active_conversations', (
            SELECT COUNT(*)
            FROM chat_conversations
            WHERE admin_user_id = p_admin_user_id::text
            AND status = 'active'
            AND token_expires_at > NOW()
        ),
        'locked_conversations', (
            SELECT COUNT(*)
            FROM chat_conversations
            WHERE admin_user_id = p_admin_user_id::text
            AND is_locked = TRUE
        ),
        'total_access_attempts', (
            SELECT COUNT(*)
            FROM magic_link_access_log mal
            JOIN chat_conversations cc ON mal.talent_token = cc.talent_token
            WHERE cc.admin_user_id = p_admin_user_id::text
        ),
        'blocked_attempts', (
            SELECT COUNT(*)
            FROM magic_link_access_log mal
            JOIN chat_conversations cc ON mal.talent_token = cc.talent_token
            WHERE cc.admin_user_id = p_admin_user_id::text
            AND mal.access_result IN ('blocked', 'suspicious_activity')
        ),
        'rate_limited_attempts', (
            SELECT COUNT(*)
            FROM magic_link_access_log mal
            JOIN chat_conversations cc ON mal.talent_token = cc.talent_token
            WHERE cc.admin_user_id = p_admin_user_id::text
            AND mal.access_result = 'rate_limited'
        ),
        'recent_activity', (
            SELECT json_agg(
                json_build_object(
                    'date', DATE(mal.created_at),
                    'attempts', COUNT(*),
                    'successful', COUNT(CASE WHEN mal.access_result = 'success' THEN 1 END),
                    'blocked', COUNT(CASE WHEN mal.access_result IN ('blocked', 'suspicious_activity') THEN 1 END)
                )
            )
            FROM magic_link_access_log mal
            JOIN chat_conversations cc ON mal.talent_token = cc.talent_token
            WHERE cc.admin_user_id = p_admin_user_id::text
            AND mal.created_at > NOW() - INTERVAL '7 days'
            GROUP BY DATE(mal.created_at)
            ORDER BY DATE(mal.created_at) DESC
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant permissions for security summary function
GRANT EXECUTE ON FUNCTION get_security_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_security_summary(UUID) TO service_role;

-- Comments
COMMENT ON TABLE magic_link_access_log IS 'Tracks all magic link access attempts for security monitoring';
COMMENT ON FUNCTION validate_magic_link_access(UUID, INET, TEXT, JSONB) IS 'Validates magic link access with rate limiting and bot detection';
COMMENT ON FUNCTION unlock_conversation(UUID, TEXT) IS 'Unlocks a conversation that was locked due to suspicious activity';
COMMENT ON FUNCTION get_security_summary(UUID) IS 'Get security summary statistics for admin dashboard';
COMMENT ON VIEW admin_security_dashboard IS 'Security monitoring dashboard for admins to track magic link access patterns';
