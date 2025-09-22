import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import Head from "next/head"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { FloatingChat } from "@/components/floating-chat"
import { AuthGuard } from "@/components/auth/auth-guard"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AdminChat } from "@/components/admin-chat"
import { IconLoader, IconArrowLeft } from "@tabler/icons-react"
import { 
  MapPin, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  Briefcase, 
  GraduationCap,
  Award,
  Globe,
  Linkedin,
  ExternalLink,
  Clock,
  Languages,
  Wrench
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"

interface CandidateData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  city: string | null
  country: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  current_position: string | null
  current_company: string | null
  experience_level: 'junior' | 'mid' | 'senior' | null
  expected_salary: string | null
  availability_date: 'asap' | '1week' | '1month' | null
  primary_skills: string | null
  languages: string | null
  status: string
  registration_date: string
  created_at: string
  work_experiences?: WorkExperience[]
}

interface WorkExperience {
  id: string
  position: string
  company: string
  start_date: string
  end_date: string | null
  is_current_job: boolean
  main_tasks: string | null
  industry: string | null
}

function CandidateDetailContent() {
  const router = useRouter()
  const { id } = router.query
  const [candidate, setCandidate] = useState<CandidateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id && typeof id === 'string') {
      fetchCandidate(id)
    }
  }, [id])

  const fetchCandidate = async (candidateId: string) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('candidates')
        .select(`
          *,
          work_experiences(*)
        `)
        .eq('id', candidateId)
        .single()

      if (error) throw error

      setCandidate(data)
    } catch (err) {
      console.error('Error fetching candidate:', err)
      setError(err instanceof Error ? err.message : 'Failed to load candidate')
    } finally {
      setLoading(false)
    }
  }

  const handleNavigation = (url: string) => {
    router.push(url)
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case '✅ hired':
        return 'bg-green-100 text-green-800 border-green-200'
      case '📞 interviewing':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case '⏳ under review':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case '❌ not selected':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getExperienceLevelColor = (level: string) => {
    switch (level) {
      case 'senior':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'mid':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'junior':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <IconLoader className="w-8 h-8 animate-spin" />
          <p className="text-muted-foreground">Loading candidate details...</p>
        </div>
      </div>
    )
  }

  if (error || !candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error loading candidate</h2>
          <p className="text-muted-foreground mb-4">{error || 'Candidate not found'}</p>
          <Button onClick={() => router.push('/admin/dashboard')}>
            <IconArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="dark">
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset className="bg-background">
          <SiteHeader />
          <div className="flex flex-1 flex-col bg-background">
            <div className="@container/main flex flex-1 flex-col gap-4 bg-background p-4 md:p-6">
              
              {/* Header with Back Button */}
              <div className="">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => router.push('/admin/dashboard')}
                  className="flex items-center gap-2"
                >
                  <IconArrowLeft className="w-4 h-4" />
                  Back to Candidates
                </Button>
                <div className="mt-4">
                  <h1 className="text-2xl font-bold">Candidate Profile</h1>
                  <p className="text-muted-foreground">
                    Registered on {formatDate(candidate.created_at)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column - Main Info */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Chat Section */}
                  <AdminChat
                    candidateId={candidate.id}
                    candidateName={`${candidate.first_name} ${candidate.last_name}`}
                    candidateEmail={candidate.email}
                  />
                  
                  {/* Personal Information Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-4">
                          <Avatar className="w-16 h-16">
                            <AvatarFallback className="text-lg font-semibold">
                              {getInitials(candidate.first_name, candidate.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-2xl">
                              {candidate.first_name} {candidate.last_name}
                            </CardTitle>
                            <p className="text-lg text-muted-foreground">
                              {candidate.current_position || 'Position not specified'} 
                              {candidate.current_company && ` at ${candidate.current_company}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Badge className={cn("text-sm", getStatusColor(candidate.status))}>
                            {candidate.status}
                          </Badge>
                          {candidate.experience_level && (
                            <Badge className={cn("text-sm", getExperienceLevelColor(candidate.experience_level))}>
                              {candidate.experience_level.toUpperCase()} LEVEL
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {/* Contact Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{candidate.email}</span>
                        </div>
                        {candidate.phone && (
                          <div className="flex items-center space-x-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{candidate.phone}</span>
                          </div>
                        )}
                        {(candidate.city || candidate.country) && (
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">
                              {[candidate.city, candidate.country].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            Registered {formatDate(candidate.registration_date)}
                          </span>
                        </div>
                      </div>

                      {/* Links */}
                      {(candidate.linkedin_url || candidate.portfolio_url) && (
                        <>
                          <Separator />
                          <div className="flex flex-wrap gap-3">
                            {candidate.linkedin_url && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(candidate.linkedin_url!, '_blank')}
                                className="flex items-center gap-2"
                              >
                                <Linkedin className="w-4 h-4" />
                                LinkedIn
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                            {candidate.portfolio_url && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(candidate.portfolio_url!, '_blank')}
                                className="flex items-center gap-2"
                              >
                                <Globe className="w-4 h-4" />
                                Portfolio
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Work Experience Card */}
                  {candidate.work_experiences && candidate.work_experiences.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Briefcase className="w-5 h-5" />
                          Work Experience
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {candidate.work_experiences.map((exp, index) => (
                          <div key={exp.id}>
                            {index > 0 && <Separator />}
                            <div className="space-y-2 py-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-semibold">{exp.position}</h4>
                                  <p className="text-sm text-muted-foreground">{exp.company}</p>
                                  {exp.industry && (
                                    <Badge variant="secondary" className="text-xs mt-1">
                                      {exp.industry}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-right text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(exp.start_date)} - {exp.is_current_job ? 'Present' : (exp.end_date ? formatDate(exp.end_date) : 'Present')}
                                  </div>
                                  {exp.is_current_job && (
                                    <Badge variant="outline" className="text-xs mt-1">
                                      Current
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {exp.main_tasks && (
                                <div className="mt-2">
                                  <p className="text-sm text-muted-foreground">
                                    {exp.main_tasks}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right Column - Additional Info */}
                <div className="space-y-6">
                  
                  {/* Availability & Salary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Availability & Compensation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Expected Salary</span>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span className="font-semibold">
                            {candidate.expected_salary || 'Not specified'}
                          </span>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Availability</span>
                        <Badge variant="outline" className="capitalize">
                          {candidate.availability_date === 'asap' ? 'ASAP' : 
                           candidate.availability_date === '1week' ? 'In 1 Week' :
                           candidate.availability_date === '1month' ? 'In 1 Month' : 
                           'Not specified'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Skills */}
                  {candidate.primary_skills && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Wrench className="w-5 h-5" />
                          Skills
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {candidate.primary_skills.split(',').map((skill, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {skill.trim()}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Languages */}
                  {candidate.languages && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Languages className="w-5 h-5" />
                          Languages
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{candidate.languages}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
        <FloatingChat onNavigate={handleNavigation} />
      </SidebarProvider>
    </div>
  )
}

export default function CandidateDetail() {
  return (
    <AuthGuard requireAuth={true}>
      <CandidateDetailContent />
    </AuthGuard>
  )
}
