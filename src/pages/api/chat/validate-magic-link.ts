import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'
import crypto from 'crypto'

interface ValidateMagicLinkRequest {
  token: string
  fingerprint?: {
    userAgent: string
    language: string
    timezone: string
    screen: {
      width: number
      height: number
      colorDepth: number
    }
    canvas?: string
  }
}

// Get real IP address from request
function getRealIP(req: NextApiRequest): string {
  // Check various headers for real IP (useful behind proxies)
  const forwarded = req.headers['x-forwarded-for']
  const realIP = req.headers['x-real-ip']
  const cfConnectingIP = req.headers['cf-connecting-ip'] // Cloudflare
  
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  
  if (typeof realIP === 'string') {
    return realIP
  }
  
  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP
  }
  
  return req.socket.remoteAddress || '127.0.0.1'
}

// Generate browser fingerprint hash
function generateFingerprintHash(fingerprint: any): string {
  const fingerprintString = JSON.stringify(fingerprint, Object.keys(fingerprint).sort())
  return crypto.createHash('sha256').update(fingerprintString).digest('hex')
}

// Basic bot detection based on user agent
function detectBot(userAgent: string): boolean {
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /go-http/i,
    /okhttp/i,
    /java/i,
    /node/i,
    /phantom/i,
    /headless/i,
    /selenium/i,
    /puppeteer/i,
    /playwright/i
  ]
  
  return botPatterns.some(pattern => pattern.test(userAgent))
}

// Validate request timing (detect too-fast requests)
function validateRequestTiming(req: NextApiRequest): boolean {
  // Check if request includes timing data that suggests human interaction
  const referer = req.headers.referer
  const userAgent = req.headers['user-agent'] || ''
  
  // Bots often don't have referers or have suspicious user agents
  if (!referer && detectBot(userAgent)) {
    return false
  }
  
  return true
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { token, fingerprint }: ValidateMagicLinkRequest = req.body

    if (!token) {
      return res.status(400).json({ 
        success: false,
        error: 'missing_token',
        message: 'Magic link token is required' 
      })
    }

    // Get request metadata
    const ipAddress = getRealIP(req)
    const userAgent = req.headers['user-agent'] || ''
    const referer = req.headers.referer || ''
    
    // Basic request validation
    if (!validateRequestTiming(req)) {
      return res.status(403).json({
        success: false,
        error: 'invalid_request',
        message: 'Request appears to be automated'
      })
    }

    // Prepare fingerprint data for storage
    const fingerprintData = fingerprint ? {
      ...fingerprint,
      hash: generateFingerprintHash(fingerprint),
      referer: referer,
      timestamp: new Date().toISOString()
    } : null

    // Call the secure validation function
    const { data: validationResult, error: validationError } = await supabase
      .rpc('validate_magic_link_access', {
        p_talent_token: token,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_fingerprint_data: fingerprintData
      })

    if (validationError) {
      console.error('Magic link validation error:', validationError)
      return res.status(500).json({
        success: false,
        error: 'validation_failed',
        message: 'Failed to validate magic link'
      })
    }

    // Return the validation result
    if (validationResult.success) {
      res.status(200).json({
        success: true,
        conversation: validationResult.conversation,
        message: 'Magic link validated successfully'
      })
    } else {
      // Handle different error types with appropriate HTTP status codes
      const statusCode = validationResult.error === 'rate_limited' ? 429 :
                        validationResult.error === 'token_expired' ? 410 :
                        validationResult.error === 'suspicious_activity' ? 403 : 400

      res.status(statusCode).json({
        success: false,
        error: validationResult.error,
        message: validationResult.message
      })
    }

  } catch (error) {
    console.error('Magic link validation error:', error)
    res.status(500).json({ 
      success: false,
      error: 'internal_error',
      message: 'An unexpected error occurred'
    })
  }
}
