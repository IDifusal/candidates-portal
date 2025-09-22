import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'

interface SecurityDashboardRequest {
  adminUserId?: string
  limit?: number
  offset?: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { adminUserId, limit = 50, offset = 0 } = req.query as any

    if (!adminUserId) {
      return res.status(400).json({ error: 'adminUserId is required' })
    }

    // Get security dashboard data
    const { data: securityData, error: securityError } = await supabase
      .from('admin_security_dashboard')
      .select('*')
      .eq('admin_user_id', adminUserId)
      .order('last_accessed_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (securityError) {
      console.error('Security dashboard error:', securityError)
      return res.status(500).json({ error: 'Failed to fetch security data' })
    }

    // Get summary statistics
    const { data: summaryData, error: summaryError } = await supabase
      .rpc('get_security_summary', {
        p_admin_user_id: adminUserId
      })

    if (summaryError) {
      console.error('Security summary error:', summaryError)
    }

    // Get recent suspicious activity
    const { data: suspiciousActivity, error: suspiciousError } = await supabase
      .from('magic_link_access_log')
      .select(`
        *,
        chat_conversations!magic_link_access_log_talent_token_fkey(
          id,
          candidate_id,
          admin_user_id,
          candidates(first_name, last_name, email)
        )
      `)
      .in('access_result', ['blocked', 'rate_limited', 'suspicious_activity'])
      .order('created_at', { ascending: false })
      .limit(20)

    if (suspiciousError) {
      console.error('Suspicious activity error:', suspiciousError)
    }

    res.status(200).json({
      success: true,
      data: {
        conversations: securityData || [],
        summary: summaryData || {
          total_conversations: 0,
          active_conversations: 0,
          locked_conversations: 0,
          total_access_attempts: 0,
          blocked_attempts: 0,
          rate_limited_attempts: 0
        },
        suspicious_activity: suspiciousActivity || [],
        pagination: {
          limit,
          offset,
          has_more: (securityData?.length || 0) === limit
        }
      }
    })

  } catch (error) {
    console.error('Security dashboard error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Helper function to create security summary
async function getSecuritySummary(adminUserId: string) {
  const { data, error } = await supabase
    .rpc('get_security_summary', {
      p_admin_user_id: adminUserId
    })

  if (error) {
    console.error('Security summary error:', error)
    return null
  }

  return data
}
