import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { adminUserId } = req.query

    if (!adminUserId) {
      return res.status(400).json({ error: 'adminUserId is required' })
    }

    const { data: conversations, error } = await supabase
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
          country,
          status
        ),
        last_message:chat_messages(
          id,
          content,
          sender_type,
          created_at
        )
      `)
      .eq('admin_user_id', adminUserId as string)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      return res.status(500).json({ error: 'Failed to fetch conversations' })
    }

    // Process conversations to get the actual last message
    const processedConversations = await Promise.all(
      conversations.map(async (conversation: any) => {
        // Get the actual last message
        const { data: lastMessage } = await supabase
          .from('chat_messages')
          .select('id, content, sender_type, created_at')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // Get unread count for admin
        const { count: unreadCount } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conversation.id)
          .eq('sender_type', 'candidate')
          .is('read_at', null)

        return {
          ...conversation,
          last_message: lastMessage,
          unread_count: unreadCount || 0
        }
      })
    )

    res.status(200).json({
      conversations: processedConversations,
      success: true
    })

  } catch (error) {
    console.error('Get conversations error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
