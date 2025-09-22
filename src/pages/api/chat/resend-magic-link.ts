import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'
import { sendMagicLinkEmail } from '@/lib/email/resend'
import { v4 as uuidv4 } from 'uuid'

interface ResendMagicLinkRequest {
  conversationId: string
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
      conversationId,
      companyName = 'Our Company',
      contactPersonName = 'Hiring Manager',
      contactPersonTitle = 'Recruiter'
    }: ResendMagicLinkRequest = req.body

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' })
    }

    // Get conversation with candidate details
    const { data: conversation, error: conversationError } = await supabase
      .from('chat_conversations')
      .select(`
        *,
        candidate:candidates(
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', conversationId)
      .eq('status', 'active')
      .single() as { data: any, error: any }

    if (conversationError || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (!conversation.candidate) {
      return res.status(404).json({ error: 'Candidate not found' })
    }

    // Check if current token is expired
    const now = new Date()
    const tokenExpiry = new Date(conversation.token_expires_at)
    
    let talentToken = conversation.talent_token
    let needsUpdate = false

    // If token is expired or will expire within 1 hour, generate a new one
    if (tokenExpiry <= now || (tokenExpiry.getTime() - now.getTime()) < 3600000) {
      talentToken = uuidv4()
      const newTokenExpiresAt = new Date()
      newTokenExpiresAt.setDate(newTokenExpiresAt.getDate() + 7) // 7 days from now
      
      const { error: updateError } = await (supabase as any)
        .from('chat_conversations')
        .update({
          talent_token: talentToken,
          token_expires_at: newTokenExpiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)

      if (updateError) {
        console.error('Error updating token:', updateError)
        return res.status(500).json({ error: 'Failed to update token' })
      }
      
      needsUpdate = true
    }

    // Send magic link email
    const candidate = conversation.candidate
    const talentChatUrl = `/talent/chat/${talentToken}`
    const fullMagicLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${talentChatUrl}`
    
    const emailResult = await sendMagicLinkEmail({
      to: candidate.email,
      candidateName: `${candidate.first_name} ${candidate.last_name}`,
      companyName,
      contactPersonName,
      contactPersonTitle,
      magicLink: fullMagicLink,
      opportunityType: conversation.opportunity_type,
      urgency: conversation.urgency,
      engagementType: conversation.engagement_type
    })

    if (!emailResult.success) {
      console.error('Failed to resend magic link email:', emailResult.error)
      return res.status(500).json({ 
        error: 'Failed to send email',
        details: emailResult.error
      })
    }

    res.status(200).json({
      success: true,
      message: 'Magic link sent successfully',
      talentChatUrl,
      magicLink: fullMagicLink,
      tokenUpdated: needsUpdate,
      emailSent: true
    })

  } catch (error) {
    console.error('Resend magic link error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
