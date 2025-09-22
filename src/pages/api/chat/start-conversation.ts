import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'
import { sendMagicLinkEmail } from '@/lib/email/resend'
import { v4 as uuidv4 } from 'uuid'

interface StartConversationRequest {
  candidateId: string
  adminUserId: string
  opportunityType?: 'direct_hire' | 'project' | 'consultation' | 'collaboration'
  urgency?: 'immediate' | 'flexible' | 'future'
  engagementType?: 'full_time' | 'part_time' | 'contract' | 'freelance'
  initialMessage?: string
  // Admin/Company info for email
  companyName?: string
  contactPersonName?: string
  contactPersonTitle?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      candidateId,
      adminUserId,
      opportunityType = 'direct_hire',
      urgency = 'flexible',
      engagementType = 'full_time',
      initialMessage,
      companyName = 'Our Company',
      contactPersonName = 'Hiring Manager',
      contactPersonTitle = 'Recruiter'
    }: StartConversationRequest = req.body

    if (!candidateId || !adminUserId) {
      return res.status(400).json({ error: 'candidateId and adminUserId are required' })
    }

    // Check if conversation already exists
    const { data: existingConversation } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('admin_user_id', adminUserId)
      .eq('status', 'active')
      .single()

    if (existingConversation) {
      return res.status(200).json({
        conversation: existingConversation,
        talentChatUrl: `/talent/chat/${existingConversation.talent_token}`
      })
    }

    // Generate magic token for talent
    const talentToken = uuidv4()
    const tokenExpiresAt = new Date()
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7) // 7 days from now

    // Create new conversation (RLS disabled for development)
    const { data: conversation, error: conversationError } = await supabase
      .from('chat_conversations')
      .insert({
        candidate_id: candidateId,
        admin_user_id: adminUserId,
        status: 'active',
        talent_token: talentToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        opportunity_type: opportunityType,
        urgency: urgency,
        engagement_type: engagementType,
        last_message_at: new Date().toISOString()
      })
      .select()
      .single()

    if (conversationError) {
      console.error('Error creating conversation:', conversationError)
      return res.status(500).json({ error: 'Failed to create conversation' })
    }

    // Send initial message if provided
    if (initialMessage) {
      const { error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          sender_type: 'admin',
          sender_id: adminUserId,
          content: initialMessage,
          message_type: 'text'
        })

      if (messageError) {
        console.error('Error sending initial message:', messageError)
      }
    }

    // Get candidate details for email
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('first_name, last_name, email')
      .eq('id', candidateId)
      .single()

    if (candidateError || !candidate) {
      console.error('Error fetching candidate:', candidateError)
      return res.status(404).json({ error: 'Candidate not found' })
    }

    // Send magic link email
    const talentChatUrl = `/talent/chat/${talentToken}`
    const fullMagicLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${talentChatUrl}`
    
    const emailResult = await sendMagicLinkEmail({
      to: candidate.email,
      candidateName: `${candidate.first_name} ${candidate.last_name}`,
      companyName,
      contactPersonName,
      contactPersonTitle,
      magicLink: fullMagicLink,
      opportunityType,
      urgency,
      engagementType
    })

    if (!emailResult.success) {
      console.error('Failed to send magic link email:', emailResult.error)
      // Don't fail the API call, just log the error
    }

    res.status(201).json({
      conversation,
      talentChatUrl,
      magicLink: fullMagicLink,
      emailSent: emailResult.success,
      message: 'Conversation started successfully'
    })

  } catch (error) {
    console.error('Start conversation error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
