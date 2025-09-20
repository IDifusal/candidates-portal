import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageCircle, X, Send, Bot, User, MapPin, DollarSign, Calendar, Briefcase, Loader2, ExternalLink, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
  candidates?: any[]
  originalQuery?: string
  totalCount?: number
}

interface SearchResponse {
  candidates: any[]
  query: string
  filters: any
  count: number
}

interface FloatingChatProps {
  onNavigate?: (url: string) => void
}

export function FloatingChat({ onNavigate }: FloatingChatProps = {}) {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! 👋 I\'m your intelligent search assistant. You can search for candidates using natural language.',
      sender: 'ai',
      timestamp: new Date()
    },
    {
      id: '2', 
      content: 'For example: "Find React developers with 3+ years experience in United States" or "Marketing candidates with expected salary between $50k-80k"',
      sender: 'ai',
      timestamp: new Date()
    }
  ])

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/search-candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: userMessage.content }),
      })

      if (!response.ok) {
        throw new Error('Search request failed')
      }

      const searchResult: SearchResponse = await response.json()
      
      let aiResponseContent = ''
      if (searchResult.count === 0) {
        aiResponseContent = `I couldn't find any candidates matching "${searchResult.query}". Try adjusting your search criteria or being more specific about the requirements.`
      } else {
        aiResponseContent = `Found ${searchResult.count} candidate${searchResult.count > 1 ? 's' : ''} matching your search! Here are the results:`
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponseContent,
        sender: 'ai',
        timestamp: new Date(),
        candidates: searchResult.candidates,
        originalQuery: userMessage.content,
        totalCount: searchResult.count
      }

      setMessages(prev => [...prev, aiResponse])

    } catch (error) {
      console.error('Search error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error while searching. Please try again or contact support if the issue persists.',
        sender: 'ai',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleNavigation = (url: string, openInNewTab: boolean = true) => {
    if (onNavigate && !openInNewTab) {
      onNavigate(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const renderCandidateCard = (candidate: any) => (
    <div key={candidate.id} className="bg-gray-50 rounded-lg p-3 mb-2 text-sm border hover:border-blue-200 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-900">
          {candidate.firstName} {candidate.lastName}
        </h4>
        <div className="flex items-center space-x-2">
          <span className={cn(
            "px-2 py-1 rounded-full text-xs",
            candidate.experienceLevel === 'senior' ? 'bg-green-100 text-green-800' :
            candidate.experienceLevel === 'mid' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          )}>
            {candidate.experienceLevel}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNavigation(`/admin/candidates/${candidate.id}`, true)}
            className="h-6 w-6 p-0 hover:bg-blue-100"
            title="View candidate details (opens in new tab)"
          >
            <Eye className="w-3 h-3 text-blue-600" />
          </Button>
        </div>
      </div>
      
      <div className="space-y-1 text-gray-600">
        <div className="flex items-center space-x-1">
          <Briefcase className="w-3 h-3" />
          <span>{candidate.currentPosition} at {candidate.currentCompany}</span>
        </div>
        
        {candidate.city && candidate.country && (
          <div className="flex items-center space-x-1">
            <MapPin className="w-3 h-3" />
            <span>{candidate.city}, {candidate.country}</span>
          </div>
        )}
        
        <div className="flex items-center space-x-1">
          <DollarSign className="w-3 h-3" />
          <span>{candidate.expectedSalary}</span>
        </div>
        
        <div className="flex items-center space-x-1">
          <Calendar className="w-3 h-3" />
          <span>Available: {candidate.availabilityDate}</span>
        </div>
        
        {candidate.primarySkills && (
          <div className="mt-2">
            <p className="text-xs text-gray-500">Skills:</p>
            <p className="text-xs">{candidate.primarySkills}</p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-96 h-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5" />
              <h3 className="font-semibold">AI Candidate Search</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 p-1 h-auto"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg p-3 text-sm",
                    msg.sender === 'user'
                      ? 'bg-blue-500 text-white ml-4'
                      : 'bg-gray-100 text-gray-800 mr-4'
                  )}
                >
                  <div className="flex items-start space-x-2">
                    {msg.sender === 'ai' && (
                      <Bot className="w-4 h-4 mt-0.5 text-blue-500" />
                    )}
                    {msg.sender === 'user' && (
                      <User className="w-4 h-4 mt-0.5 text-white" />
                    )}
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      
                      {/* Show candidates if available */}
                      {msg.candidates && msg.candidates.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <div className="max-h-40 overflow-y-auto space-y-2">
                            {msg.candidates.slice(0, 3).map(renderCandidateCard)}
                          </div>
                          {msg.candidates.length > 3 && (
                            <div className="text-center pt-2 border-t">
                              <p className="text-xs text-gray-500 mb-2">
                                Showing 3 of {msg.totalCount || msg.candidates.length} candidates
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const encodedQuery = encodeURIComponent(msg.originalQuery || '')
                                  handleNavigation(`/admin/dashboard?query=${encodedQuery}`, true)
                                }}
                                className="h-7 text-xs px-3 hover:bg-blue-50 border-blue-200 text-blue-700"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                See all results
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <p className={cn(
                        "text-xs mt-1 opacity-70",
                        msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                      )}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Search candidates with natural language..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 text-sm"
                style={{
                    color: 'black'
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || isLoading}
                size="sm"
                className="px-3"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Example: "React developers in Mexico with $60k+ salary"
            </p>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="lg"
        className={cn(
          "rounded-full w-14 h-14 shadow-lg transition-all duration-200 hover:scale-110",
          "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700",
          isOpen && "bg-gray-500 hover:bg-gray-600"
        )}
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </Button>
    </div>
  )
}
