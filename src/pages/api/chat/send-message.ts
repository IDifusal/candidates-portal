import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'
import { sendNewMessageNotification } from '@/lib/email/resend'

interface SendMessageRequest {
  conversationId?: string
  talentToken?: string
  senderId: string
  senderType: 'admin' | 'candidate'
  content: string
  messageType?: 'text' | 'file' | 'system'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      conversationId,
      talentToken,
      senderId,
      senderType,
      content,
      messageType = 'text'
    }: SendMessageRequest = req.body

    if (!senderId || !senderType || !content) {
      return res.status(400).json({ error: 'senderId, senderType, and content are required' })
    }

    let finalConversationId = conversationId

    // If using talent token, find conversation by token
    if (!conversationId && talentToken) {
      const { data: conversation, error: tokenError } = await supabase
        .from('chat_conversations')
        .select('id, token_expires_at')
        .eq('talent_token', talentToken)
        .eq('status', 'active')
        .single()

      if (tokenError || !conversation) {
        return res.status(404).json({ error: 'Invalid or expired token' })
      }

      // Check if token is expired
      if (new Date(conversation.token_expires_at) < new Date()) {
        return res.status(401).json({ error: 'Token has expired' })
      }

      finalConversationId = conversation.id
    }

    if (!finalConversationId) {
      return res.status(400).json({ error: 'conversationId or valid talentToken required' })
    }

    // Send message
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: finalConversationId,
        sender_type: senderType,
        sender_id: senderId,
        content: content,
        message_type: messageType
      })
      .select(`
        *,
        conversation:chat_conversations(
          candidate_id,
          admin_user_id
        )
      `)
      .single()

    if (messageError) {
      console.error('Error sending message:', messageError)
      return res.status(500).json({ error: 'Failed to send message' })
    }

    // Update conversation's last_message_at
    const { error: updateError } = await supabase
      .from('chat_conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', finalConversationId)

    if (updateError) {
      console.error('Error updating conversation:', updateError)
    }

    // Send email notification to the other party
    try {
      // Get full conversation details with candidate info
      const { data: fullConversation, error: convError } = await supabase
        .from('chat_conversations')
        .select(`
          *,
          candidate:candidates(
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', finalConversationId)
        .single()

      if (!convError && fullConversation && fullConversation.candidate) {
        const isAdminSender = senderType === 'admin'
        const candidate = fullConversation.candidate
        const magicLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/talent/chat/${fullConversation.talent_token}`
        
        // Only send notification if message is from admin to candidate
        if (isAdminSender) {
          const emailResult = await sendNewMessageNotification({
            to: candidate.email,
            candidateName: `${candidate.first_name} ${candidate.last_name}`,
            companyName: 'Our Company', // TODO: Get from conversation or admin data
            contactPersonName: 'Hiring Manager', // TODO: Get from admin data
            messagePreview: content,
            magicLink
          })

          if (!emailResult.success) {
            console.error('Failed to send message notification email:', emailResult.error)
          }
        }
      }
    } catch (emailError) {
      console.error('Error sending email notification:', emailError)
      // Don't fail the API call for email errors
    }

    res.status(201).json({
      message,
      success: true
    })

  } catch (error) {
    console.error('Send message error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
