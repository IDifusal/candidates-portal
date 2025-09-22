import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { conversationId, talentToken } = req.query

    if (!conversationId && !talentToken) {
      return res.status(400).json({ error: 'conversationId or talentToken is required' })
    }

    let query = supabase
      .from('chat_conversations')
      .select(`
        *,
        candidate:candidates(
          id,
          first_name,
          last_name,
          email,
          current_position,
          current_company,
          expected_salary,
          primary_skills,
          city,
          country
        ),
        messages:chat_messages(
          id,
          content,
          sender_type,
          sender_id,
          message_type,
          read_at,
          created_at,
          updated_at
        )
      `)

    if (conversationId) {
      query = query.eq('id', conversationId as string)
    } else if (talentToken) {
      query = query.eq('talent_token', talentToken as string)
    }

    const { data: conversation, error } = await query
      .eq('status', 'active')
      .single()

    if (error || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Check if token is expired (only for talent token access)
    if (talentToken && new Date(conversation.token_expires_at) < new Date()) {
      return res.status(401).json({ error: 'Token has expired' })
    }

    // Sort messages by created_at
    if (conversation.messages) {
      conversation.messages.sort((a: any, b: any) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }

    res.status(200).json({
      conversation,
      success: true
    })

  } catch (error) {
    console.error('Get conversation error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
