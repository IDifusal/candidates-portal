import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type CandidateInsert = Database['public']['Tables']['candidates']['Insert']
type WorkExperienceInsert = Database['public']['Tables']['work_experiences']['Insert']

interface CandidateFormData {
  // Personal info
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth?: string
  address?: string
  city: string
  country: string
  linkedinUrl?: string
  portfolioUrl?: string
  
  // Experience
  workExperiences: Array<{
    position: string
    company: string
    startDate: string
    endDate?: string
    isCurrentJob: boolean
    mainTasks: string
    industry: string
  }>
  education: string
  certifications?: string
  expectedSalary: string
  availabilityDate: 'asap' | '1week' | '1month'
  
  // Skills
  primarySkills: string
  secondarySkills?: string
  languages: string
  tools: string
  projectsDescription: string
  achievements?: string
  references?: string
  additionalInfo?: string
}

export function useCandidates() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<any[]>([])

  const fetchCandidates = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('candidates')
        .select(`
          *,
          work_experiences(*)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transformar datos al formato esperado por la tabla
      const transformedData = data.map((candidate: any) => ({
        id: candidate.id,
        firstName: candidate.first_name,
        lastName: candidate.last_name,
        email: candidate.email,
        currentPosition: candidate.current_position || 'Not specified',
        currentCompany: candidate.current_company || 'Not specified',
        experienceLevel: candidate.experience_level || 'junior',
        expectedSalary: candidate.expected_salary || 'Not specified',
        status: candidate.status,
        availabilityDate: candidate.availability_date || 'asap',
        primarySkills: candidate.primary_skills || '',
        registrationDate: candidate.registration_date,
        phone: candidate.phone,
        city: candidate.city,
        country: candidate.country,
        linkedinUrl: candidate.linkedin_url,
        portfolioUrl: candidate.portfolio_url,
        languages: candidate.languages,
        workExperiences: candidate.work_experiences
      }))

      setCandidates(transformedData)
      return transformedData

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error fetching candidates'
      setError(errorMessage)
      return []
    } finally {
      setLoading(false)
    }
  }, []) // Sin dependencias porque no usa ninguna variable externa

  const registerCandidate = async (formData: CandidateFormData) => {
    try {
      setLoading(true)
      setError(null)

      // Determinar experience_level basado en años de experiencia
      const getExperienceLevel = (workExperiences: any[]): 'junior' | 'mid' | 'senior' => {
        const totalYears = workExperiences.reduce((acc, exp) => {
          const startYear = new Date(exp.startDate).getFullYear()
          const endYear = exp.isCurrentJob ? new Date().getFullYear() : new Date(exp.endDate).getFullYear()
          return acc + (endYear - startYear)
        }, 0)

        if (totalYears <= 2) return 'junior'
        if (totalYears <= 5) return 'mid'
        return 'senior'
      }

      // Preparar datos del candidato
      const candidateData: CandidateInsert = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        city: formData.city,
        country: formData.country,
        linkedin_url: formData.linkedinUrl || null,
        portfolio_url: formData.portfolioUrl || null,
        experience_level: getExperienceLevel(formData.workExperiences),
        expected_salary: formData.expectedSalary,
        availability_date: formData.availabilityDate,
        primary_skills: `${formData.primarySkills}${formData.secondarySkills ? `, ${formData.secondarySkills}` : ''}${formData.tools ? `, ${formData.tools}` : ''}`,
        languages: formData.languages,
        status: '⏳ Under Review'
      }

      // Insertar candidato
      const { data: candidate, error: candidateError } = await (supabase as any)
        .from('candidates')
        .insert(candidateData)
        .select()
        .single()

      if (candidateError) throw candidateError

      // Insertar experiencias laborales
      const workExperiencesData: WorkExperienceInsert[] = formData.workExperiences.map(exp => ({
        candidate_id: candidate.id,
        position: exp.position,
        company: exp.company,
        start_date: exp.startDate,
        end_date: exp.isCurrentJob ? null : exp.endDate,
        is_current_job: exp.isCurrentJob,
        main_tasks: exp.mainTasks,
        industry: exp.industry
      }))

      const { error: workExpError } = await (supabase as any)
      .from('work_experiences')
      .insert(workExperiencesData)

      if (workExpError) throw workExpError

      return { success: true, candidateId: candidate.id }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error registering candidate'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    candidates,
    fetchCandidates,
    registerCandidate
  }
}
