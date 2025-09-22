-- Migration: 001_create_chat_tables.sql
-- Description: Create chat conversations and messages tables for magic link system
-- Date: 2025-01-XX

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types for better type safety
CREATE TYPE conversation_status AS ENUM ('active', 'closed', 'archived');
CREATE TYPE opportunity_type AS ENUM ('direct_hire', 'project', 'consultation', 'collaboration');
CREATE TYPE urgency_type AS ENUM ('immediate', 'flexible', 'future');
CREATE TYPE engagement_type AS ENUM ('full_time', 'part_time', 'contract', 'freelance');
CREATE TYPE sender_type AS ENUM ('admin', 'candidate');
CREATE TYPE message_type AS ENUM ('text', 'system', 'file');

-- Chat Conversations Table
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL, -- References auth.users or your admin users table
    
    -- Conversation status and access
    status conversation_status NOT NULL DEFAULT 'active',
    talent_token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Opportunity details
    opportunity_type opportunity_type NOT NULL DEFAULT 'direct_hire',
    urgency urgency_type NOT NULL DEFAULT 'flexible',
    engagement_type engagement_type NOT NULL DEFAULT 'full_time',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);

-- Chat Messages Table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    
    -- Sender information
    sender_type sender_type NOT NULL,
    sender_id UUID NOT NULL, -- candidate_id for candidates, admin_user_id for admins
    
    -- Message content
    content TEXT NOT NULL,
    message_type message_type NOT NULL DEFAULT 'text',
    
    -- Read status
    read_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_chat_conversations_candidate_id ON chat_conversations(candidate_id);
CREATE INDEX idx_chat_conversations_admin_user_id ON chat_conversations(admin_user_id);
CREATE INDEX idx_chat_conversations_talent_token ON chat_conversations(talent_token);
CREATE INDEX idx_chat_conversations_status ON chat_conversations(status);
CREATE INDEX idx_chat_conversations_created_at ON chat_conversations(created_at);

CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_type, sender_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_messages_read_at ON chat_messages(read_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_chat_conversations_updated_at 
    BEFORE UPDATE ON chat_conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update last_message_at when a new message is inserted
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations 
    SET last_message_at = NEW.created_at 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update last_message_at
CREATE TRIGGER update_conversation_last_message_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Row Level Security (RLS) Policies
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for chat_conversations
-- Allow admins to see all conversations they're part of
CREATE POLICY "Admins can view their conversations" ON chat_conversations
    FOR SELECT USING (auth.uid() = admin_user_id);

-- Allow admins to insert new conversations
CREATE POLICY "Admins can create conversations" ON chat_conversations
    FOR INSERT WITH CHECK (auth.uid() = admin_user_id);

-- Allow admins to update their conversations
CREATE POLICY "Admins can update their conversations" ON chat_conversations
    FOR UPDATE USING (auth.uid() = admin_user_id);

-- Allow candidates to view conversations via talent_token (handled in application logic)
-- Note: For magic link access, we'll handle this in the API layer since candidates don't have auth.uid()

-- Policies for chat_messages
-- Allow admins to view messages in their conversations
CREATE POLICY "Admins can view messages in their conversations" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE id = conversation_id AND admin_user_id = auth.uid()
        )
    );

-- Allow admins to insert messages in their conversations
CREATE POLICY "Admins can send messages in their conversations" ON chat_messages
    FOR INSERT WITH CHECK (
        sender_type = 'admin' AND 
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE id = conversation_id AND admin_user_id = auth.uid()
        )
    );

-- Allow admins to update messages they sent
CREATE POLICY "Admins can update their own messages" ON chat_messages
    FOR UPDATE USING (sender_type = 'admin' AND sender_id = auth.uid());

-- Comments for documentation
COMMENT ON TABLE chat_conversations IS 'Stores chat conversations between admins and candidates with magic link access';
COMMENT ON TABLE chat_messages IS 'Stores individual messages within chat conversations';

COMMENT ON COLUMN chat_conversations.talent_token IS 'Unique token for magic link access by candidates';
COMMENT ON COLUMN chat_conversations.token_expires_at IS 'Expiration date for the talent_token';
COMMENT ON COLUMN chat_conversations.opportunity_type IS 'Type of opportunity being discussed';
COMMENT ON COLUMN chat_conversations.urgency IS 'Urgency level of the opportunity';
COMMENT ON COLUMN chat_conversations.engagement_type IS 'Type of engagement (full-time, contract, etc.)';

COMMENT ON COLUMN chat_messages.sender_type IS 'Whether message is from admin or candidate';
COMMENT ON COLUMN chat_messages.sender_id IS 'ID of the sender (admin_user_id or candidate_id)';
COMMENT ON COLUMN chat_messages.message_type IS 'Type of message (text, system, file)';
COMMENT ON COLUMN chat_messages.read_at IS 'Timestamp when message was read (for read receipts)';
