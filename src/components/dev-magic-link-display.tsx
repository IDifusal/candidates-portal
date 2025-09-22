import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, ExternalLink, Mail, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DevMagicLinkDisplayProps {
  magicLink?: string
  candidateEmail?: string
  conversationId?: string
}

export function DevMagicLinkDisplay({ 
  magicLink, 
  candidateEmail,
  conversationId 
}: DevMagicLinkDisplayProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [copied, setCopied] = useState(false)
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  if (!magicLink) {
    return null
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(magicLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openInNewTab = () => {
    window.open(magicLink, '_blank')
  }

  if (!isVisible) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(true)}
            className="w-full text-yellow-700 hover:text-yellow-800"
          >
            <Eye className="w-4 h-4 mr-2" />
            Show Dev Magic Link
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-yellow-600" />
            <CardTitle className="text-sm text-yellow-800">
              🚧 Development Magic Link
            </CardTitle>
            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">
              DEV ONLY
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0 text-yellow-600 hover:text-yellow-800"
          >
            <EyeOff className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-yellow-700">
          📧 <strong>Email would be sent to:</strong> {candidateEmail}
        </div>
        
        <div className="bg-white p-3 rounded-md border border-yellow-200">
          <div className="text-xs text-gray-600 mb-1">Magic Link URL:</div>
          <div className="text-xs font-mono text-gray-800 break-all">
            {magicLink}
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="flex-1 text-yellow-700 border-yellow-300 hover:bg-yellow-100"
          >
            {copied ? (
              <>
                <Copy className="w-3 h-3 mr-1" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1" />
                Copy Link
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openInNewTab}
            className="flex-1 text-yellow-700 border-yellow-300 hover:bg-yellow-100"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Open as Talent
          </Button>
        </div>

        <div className="text-xs text-yellow-600 bg-yellow-100 p-2 rounded border">
          💡 <strong>Tip:</strong> Click "Open as Talent" to test the candidate experience in a new tab.
        </div>
      </CardContent>
    </Card>
  )
}
