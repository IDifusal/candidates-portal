import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Send, 
  MessageCircle, 
  User, 
  Clock, 
  ExternalLink,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
  Phone,
  Video,
  Mail,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useCurrentUser } from '@/components/auth/auth-guard'
import { DevMagicLinkDisplay } from '@/components/dev-magic-link-display'

interface Message {
  id: string
  content: string
  sender_type: 'admin' | 'candidate'
  sender_id: string
  message_type: 'text' | 'file' | 'system'
  read_at: string | null
  created_at: string
  updated_at: string
}

interface Conversation {
  id: string
  candidate_id: string
  admin_user_id: string
  status: 'active' | 'closed' | 'archived'
  talent_token: string
  token_expires_at: string
  opportunity_type: 'direct_hire' | 'project' | 'consultation' | 'collaboration'
  urgency: 'immediate' | 'flexible' | 'future'
  engagement_type: 'full_time' | 'part_time' | 'contract' | 'freelance'
  created_at: string
  messages?: Message[]
  candidate?: {
    id: string
    first_name: string
    last_name: string
    email: string
    current_position: string | null
    current_company: string | null
  }
}

interface AdminChatProps {
  candidateId: string
  candidateName: string
  candidateEmail: string
  adminUserId?: string
}

export function AdminChat({ 
  candidateId, 
  candidateName, 
  candidateEmail, 
  adminUserId
}: AdminChatProps) {
  const { user: currentUser, userId } = useCurrentUser()
  const effectiveAdminUserId = adminUserId || userId || '550e8400-e29b-41d4-a716-446655440000'
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showStartForm, setShowStartForm] = useState(false)
  const [talentLinkCopied, setTalentLinkCopied] = useState(false)
  const [isResendingLink, setIsResendingLink] = useState(false)
  
  // Start conversation form state
  const [opportunityType, setOpportunityType] = useState<'direct_hire' | 'project' | 'consultation' | 'collaboration'>('direct_hire')
  const [urgency, setUrgency] = useState<'immediate' | 'flexible' | 'future'>('flexible')
  const [engagementType, setEngagementType] = useState<'full_time' | 'part_time' | 'contract' | 'freelance'>('full_time')
  const [initialMessage, setInitialMessage] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    loadConversation()
  }, [candidateId])

  // Set up real-time subscription
  useEffect(() => {
    if (!conversation) return

    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages(prev => [...prev, newMessage])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation])

  const loadConversation = async () => {
    try {
      setIsLoading(true)
      
      // Try to find existing conversation
      const response = await fetch(`/api/chat/get-conversations?adminUserId=${effectiveAdminUserId}`)
      if (response.ok) {
        const { conversations } = await response.json()
        const existingConv = conversations.find((conv: any) => conv.candidate_id === candidateId)
        
        if (existingConv) {
          // Load full conversation with messages
          const convResponse = await fetch(`/api/chat/get-conversation?conversationId=${existingConv.id}`)
          if (convResponse.ok) {
            const { conversation: fullConv } = await convResponse.json()
            setConversation(fullConv)
            setMessages(fullConv.messages || [])
          }
        }
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const startConversation = async () => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/chat/start-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidateId,
          adminUserId: effectiveAdminUserId,
          opportunityType,
          urgency,
          engagementType,
          initialMessage: initialMessage.trim() || undefined,
          companyName: 'Our Company', // TODO: Get from context
          contactPersonName: currentUser?.name || 'Hiring Manager',
          contactPersonTitle: currentUser?.role || 'Recruiter'
        }),
      })

      if (response.ok) {
        const { conversation: newConv } = await response.json()
        setConversation(newConv)
        setShowStartForm(false)
        setInitialMessage('')
        
        // Reload to get messages
        await loadConversation()
      } else {
        const { error } = await response.json()
        console.error('Failed to start conversation:', error)
      }
    } catch (error) {
      console.error('Error starting conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversation || isSending) return

    try {
      setIsSending(true)
      
      const response = await fetch('/api/chat/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          senderId: effectiveAdminUserId,
          senderType: 'admin',
          content: newMessage.trim()
        }),
      })

      if (response.ok) {
        setNewMessage('')
        // Message will be added via real-time subscription
      } else {
        const { error } = await response.json()
        console.error('Failed to send message:', error)
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const copyTalentLink = () => {
    if (conversation) {
      const link = `${window.location.origin}/talent/chat/${conversation.talent_token}`
      navigator.clipboard.writeText(link)
      setTalentLinkCopied(true)
      setTimeout(() => setTalentLinkCopied(false), 2000)
    }
  }

  const resendMagicLink = async () => {
    if (!conversation || isResendingLink) return

    try {
      setIsResendingLink(true)
      
      const response = await fetch('/api/chat/resend-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          companyName: 'Our Company', // TODO: Get from context
          contactPersonName: currentUser?.name || 'Hiring Manager',
          contactPersonTitle: currentUser?.role || 'Recruiter'
        }),
      })

      if (response.ok) {
        const result = await response.json()
        // Update conversation if token was updated
        if (result.tokenUpdated) {
          await loadConversation()
        }
        // Show success feedback (could use toast here)
        console.log('Magic link sent successfully')
      } else {
        const { error } = await response.json()
        console.error('Failed to resend magic link:', error)
      }
    } catch (error) {
      console.error('Error resending magic link:', error)
    } finally {
      setIsResendingLink(false)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    }
  }

  if (isLoading) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm text-gray-600">Loading chat...</p>
        </div>
      </Card>
    )
  }

  if (!conversation && !showStartForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Start Conversation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No conversation yet</h3>
            <p className="text-sm text-gray-600 mb-6">
              Start a direct conversation with {candidateName} about this opportunity.
            </p>
            <Button onClick={() => setShowStartForm(true)}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Start Chat
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (showStartForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Start Conversation with {candidateName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Opportunity Type</label>
              <Select value={opportunityType} onValueChange={(value: any) => setOpportunityType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct_hire">Direct Hire</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="collaboration">Collaboration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Urgency</label>
              <Select value={urgency} onValueChange={(value: any) => setUrgency(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
                  <SelectItem value="future">Future</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Engagement Type</label>
            <Select value={engagementType} onValueChange={(value: any) => setEngagementType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full Time</SelectItem>
                <SelectItem value="part_time">Part Time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="freelance">Freelance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Initial Message (Optional)</label>
            <Textarea
              placeholder="Hi! I came across your profile and I'm impressed with your experience..."
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowStartForm(false)}>
              Cancel
            </Button>
            <Button onClick={startConversation} disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Start Conversation
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Dev Magic Link Display */}
      {conversation && (
        <DevMagicLinkDisplay
          magicLink={`${window.location.origin}/talent/chat/${conversation?.talent_token}`}
          candidateEmail={candidateEmail}
          conversationId={conversation.id}
        />
      )}

      {/* Conversation Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Badge className={cn(
                "capitalize",
                conversation?.urgency === 'immediate' ? 'bg-red-100 text-red-800' :
                conversation?.urgency === 'flexible' ? 'bg-green-100 text-green-800' :
                'bg-blue-100 text-blue-800'
              )}>
                {conversation?.opportunity_type.replace('_', ' ')} • {conversation?.urgency}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {conversation?.engagement_type.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyTalentLink}
                className="flex items-center gap-2"
              >
                {talentLinkCopied ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resendMagicLink}
                disabled={isResendingLink}
                className="flex items-center gap-2"
              >
                {isResendingLink ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Email
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/talent/chat/${conversation?.talent_token}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card className="h-[500px] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Chat with {candidateName}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Phone className="w-4 h-4 mr-2" />
                Call
              </Button>
              <Button variant="outline" size="sm">
                <Video className="w-4 h-4 mr-2" />
                Video
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => {
            const isAdmin = message.sender_type === 'admin'
            const showDate = index === 0 || 
              formatDate(messages[index - 1].created_at) !== formatDate(message.created_at)

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <Badge variant="secondary" className="text-xs">
                      {formatDate(message.created_at)}
                    </Badge>
                  </div>
                )}
                
                <div className={cn(
                  "flex gap-3",
                  isAdmin ? "justify-end" : "justify-start"
                )}>
                  {!isAdmin && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                        {candidateName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={cn(
                    "max-w-[80%] rounded-lg p-3",
                    isAdmin 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-100 text-gray-900"
                  )}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={cn(
                      "text-xs mt-1",
                      isAdmin ? "text-blue-100" : "text-gray-500"
                    )}>
                      {formatTime(message.created_at)}
                      {!message.read_at && isAdmin && (
                        <Clock className="w-3 h-3 inline ml-1" />
                      )}
                    </p>
                  </div>
                  
                  {isAdmin && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-green-100 text-green-700 text-sm">
                        You
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Message Input */}
        <div className="border-t p-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
              disabled={isSending}
            />
            <Button 
              onClick={sendMessage}
              disabled={!newMessage.trim() || isSending}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send • Candidate will receive email notifications
          </p>
        </div>
      </Card>
    </div>
  )
}
