import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/router"
import { useBrowserFingerprint } from '@/hooks/useBrowserFingerprint'
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { 
  Send, 
  Building2, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Users,
  Star,
  MessageCircle,
  Phone,
  Video,
  Mail,
  ExternalLink,
  Download,
  Briefcase,
  TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"

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

interface JobInfo {
  title: string
  company: string
  location: string
  salary: string
  type: 'full-time' | 'part-time' | 'contract'
  remote: boolean
}

interface ContactPerson {
  name: string
  title: string
  company: string
  initials: string
}

interface ConversationData {
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
    expected_salary: string | null
    primary_skills: string | null
    city: string | null
    country: string | null
  }
}

interface OpportunityInfo {
  type: 'direct_hire' | 'project' | 'consultation' | 'collaboration'
  urgency: 'immediate' | 'flexible' | 'future'
  engagement: 'full_time' | 'part_time' | 'contract' | 'freelance'
}

// Mock data - esto vendría de la API
const mockJobInfo: JobInfo = {
  title: "Senior React Developer",
  company: "TechCorp Inc.",
  location: "San Francisco, CA",
  salary: "$120,000 - $150,000",
  type: "full-time",
  remote: true
}

const mockContactPerson: ContactPerson = {
  name: "Michael Chen",
  title: "Founder & CEO",
  company: "TechCorp Inc.",
  initials: "MC"
}

export default function TalentChatPage() {
  const router = useRouter()
  const { token } = router.query
  const { fingerprint, loading: fingerprintLoading } = useBrowserFingerprint()
  const [conversation, setConversation] = useState<ConversationData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactPerson, setContactPerson] = useState<ContactPerson>(mockContactPerson)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (token && typeof token === 'string' && !fingerprintLoading) {
      loadConversation(token)
    }
  }, [token, fingerprintLoading])

  // Set up real-time subscription
  useEffect(() => {
    if (!conversation) return

    const channel = supabase
      .channel(`talent-conversation-${conversation.id}`)
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

  const loadConversation = async (talentToken: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      // First validate the magic link with security checks
      if (fingerprint) {
        const validationResponse = await fetch('/api/chat/validate-magic-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: talentToken,
            fingerprint
          })
        })

        if (!validationResponse.ok) {
          const errorData = await validationResponse.json()
          
          switch (errorData.error) {
            case 'rate_limited':
            case 'daily_limit_exceeded':
              setError('Too many attempts. Please try again later or contact support.')
              break
            case 'token_expired':
              setError('This chat link has expired. Please request a new one.')
              break
            case 'suspicious_activity':
            case 'conversation_locked':
              setError('Access has been temporarily restricted. Please contact support if you need assistance.')
              break
            case 'invalid_token':
              setError('This chat link is invalid or has been revoked.')
              break
            default:
              setError(errorData.message || 'Failed to access conversation. Please try again.')
          }
          return
        }
      }
      
      const response = await fetch(`/api/chat/get-conversation?talentToken=${talentToken}`)
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('This chat link has expired. Please contact the company for a new link.')
        } else if (response.status === 404) {
          setError('Chat conversation not found.')
        } else {
          setError('Failed to load conversation.')
        }
        return
      }

      const { conversation: convData } = await response.json()
      setConversation(convData)
      setMessages(convData.messages || [])
      
      // Update job info and contact person based on conversation data
      if (convData.candidate) {
        const candidate = convData.candidate
        mockJobInfo.title = candidate.current_position || 'Position Available'
        mockJobInfo.company = candidate.current_company || 'Company'
        mockJobInfo.location = [candidate.city, candidate.country].filter(Boolean).join(', ') || 'Remote'
        mockJobInfo.salary = candidate.expected_salary || 'Competitive'
      }
      
    } catch (err) {
      console.error('Error loading conversation:', err)
      setError('Failed to load conversation.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversation || isSending) return

    try {
      setIsSending(true)
      
      const response = await fetch('/api/chat/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          talentToken: token,
          senderId: conversation.candidate_id,
          senderType: 'candidate',
          content: newMessage.trim()
        }),
      })

      if (response.ok) {
        setNewMessage('')
        // Message will be added via real-time subscription
      } else {
        const { error } = await response.json()
        console.error('Failed to send message:', error)
        setError('Failed to send message. Please try again.')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading conversation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load chat</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-gray-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Conversation not found</h2>
          <p className="text-gray-600">This chat link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto p-4 max-w-7xl">
        
        {/* Header */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{mockJobInfo.company}</h1>
                  <p className="text-gray-600">Talent Connect</p>
                </div>
              </div>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                <MessageCircle className="w-4 h-4 mr-1" />
                Direct Opportunity
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">{mockJobInfo.title}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-sm">{mockJobInfo.location}</span>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <span className="text-sm">{mockJobInfo.salary}</span>
              </div>
              <div className="flex items-center space-x-2">
                {mockJobInfo.remote && (
                  <>
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-blue-600">Remote Friendly</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left Sidebar - Process & Info */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Contact Person */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5" />
                  Contact Person
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3 mb-4">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                      {contactPerson.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{contactPerson.name}</h3>
                    <p className="text-sm text-gray-600">{contactPerson.title}</p>
                    <p className="text-xs text-gray-500">{contactPerson.company}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Phone className="w-4 h-4 mr-2" />
                    Quick Call
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Video className="w-4 h-4 mr-2" />
                    Video Chat
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Opportunity Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Star className="w-5 h-5" />
                  Opportunity Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Type</span>
                    <Badge variant="secondary" className="capitalize">
                      {conversation.opportunity_type.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Engagement</span>
                    <Badge variant="outline" className="capitalize">
                      {conversation.engagement_type.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Timeline</span>
                    <Badge className={cn(
                      conversation.urgency === 'immediate' ? 'bg-red-100 text-red-800' :
                      conversation.urgency === 'flexible' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    )}>
                      {conversation.urgency}
                    </Badge>
                  </div>

                  <Separator />
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-900">What's Next?</h4>
                    <div className="flex items-start space-x-2">
                      <MessageCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                      <p className="text-sm text-gray-600">
                        Continue the conversation to learn more about the role and company culture.
                      </p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Phone className="w-4 h-4 text-green-500 mt-0.5" />
                      <p className="text-sm text-gray-600">
                        Schedule a call when you're ready to discuss details.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Company Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5" />
                  Learn More
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="ghost" size="sm" className="w-full justify-start h-auto p-3">
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">About Us</span>
                    </div>
                    <p className="text-xs text-gray-500">Company story and mission</p>
                  </div>
                  <ExternalLink className="w-4 h-4 ml-auto" />
                </Button>
                
                <Button variant="ghost" size="sm" className="w-full justify-start h-auto p-3">
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">Meet the Team</span>
                    </div>
                    <p className="text-xs text-gray-500">Who you'd be working with</p>
                  </div>
                  <ExternalLink className="w-4 h-4 ml-auto" />
                </Button>
                
                <Button variant="ghost" size="sm" className="w-full justify-start h-auto p-3">
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="font-medium">Recent Projects</span>
                    </div>
                    <p className="text-xs text-gray-500">What we've been building</p>
                  </div>
                  <ExternalLink className="w-4 h-4 ml-auto" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            <Card className="h-[700px] flex flex-col">
              <CardHeader className="border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                  <div>
                    <CardTitle className="text-lg">Chat with {contactPerson.name}</CardTitle>
                    <p className="text-sm text-gray-600">
                      {isTyping ? `${contactPerson.name.split(' ')[0]} is typing...` : 'Direct conversation - no formal process'}
                    </p>
                  </div>
                  </div>
                  <Badge variant="outline" className="text-green-700 border-green-200">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Online
                  </Badge>
                </div>
              </CardHeader>

              {/* Messages Area */}
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
                        isAdmin ? "justify-start" : "justify-end"
                      )}>
                        {isAdmin && (
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                              {contactPerson.initials}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className={cn(
                          "max-w-[80%] rounded-lg p-3",
                          isAdmin 
                            ? "bg-gray-100 text-gray-900" 
                            : "bg-blue-600 text-white"
                        )}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className={cn(
                            "text-xs mt-1",
                            isAdmin ? "text-gray-500" : "text-blue-100"
                          )}>
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                        
                        {!isAdmin && (
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
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    className="px-4"
                  >
                    {isSending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Press Enter to send • You'll receive email notifications for new messages
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
