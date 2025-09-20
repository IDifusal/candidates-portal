import { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase/client'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface SearchFilters {
  skills?: string[]
  experience_level?: 'junior' | 'mid' | 'senior'
  location?: {
    city?: string
    country?: string
  }
  salary?: {
    min?: number
    max?: number
  }
  availability?: 'asap' | '1week' | '1month'
  industry?: string[]
  languages?: string[]
  position?: string[]
  company?: string[]
}

const SYSTEM_PROMPT = `You are an AI assistant that converts natural language queries into structured search filters for a candidate database.

The database has candidates with these fields:
- first_name, last_name: string
- email: string  
- phone, city, country: string
- current_position, current_company: string
- experience_level: 'junior' | 'mid' | 'senior'
- expected_salary: string (e.g., "$80,000 - $120,000")
- availability_date: 'asap' | '1week' | '1month'
- primary_skills: string (comma-separated skills)
- languages: string (e.g., "English (Native), Spanish (Fluent)")
- industry: string
- work_experiences: array with position, company, industry, main_tasks

Convert the user query into a JSON object with these possible filters:
{
  "skills": ["skill1", "skill2"], // Array of technical skills
  "experience_level": "junior|mid|senior", // Based on years mentioned
  "location": {
    "city": "city_name",
    "country": "country_name"
  },
  "salary": {
    "min": number, // Extract minimum salary
    "max": number  // Extract maximum salary
  },
  "availability": "asap|1week|1month",
  "industry": ["industry1", "industry2"],
  "languages": ["language1", "language2"],
  "position": ["position1", "position2"], // Job titles
  "company": ["company1", "company2"] // Specific companies
}

Only include filters that are explicitly mentioned in the query. Return only the JSON object, no additional text.

Examples:
Query: "Find React developers with 3+ years experience in Mexico"
Response: {"skills": ["React"], "experience_level": "mid", "location": {"country": "Mexico"}}

Query: "Senior JavaScript developers in New York with salary above $100k"
Response: {"skills": ["JavaScript"], "experience_level": "senior", "location": {"city": "New York"}, "salary": {"min": 100000}}

Query: "Marketing managers available ASAP who speak Spanish"
Response: {"position": ["Marketing Manager"], "availability": "asap", "languages": ["Spanish"]}`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { query } = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' })
    }

    // Use OpenAI to convert natural language to search filters
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query }
      ],
      temperature: 0.1,
      max_tokens: 500
    })

    const aiResponse = completion.choices[0]?.message?.content
    if (!aiResponse) {
      return res.status(500).json({ error: 'Failed to process query' })
    }

    let filters: SearchFilters
    try {
      filters = JSON.parse(aiResponse)
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse)
      return res.status(500).json({ error: 'Failed to understand query' })
    }

    // Build Supabase query
    let supabaseQuery = supabase
      .from('candidates')
      .select(`
        *,
        work_experiences(*)
      `)

    // Apply filters
    if (filters.experience_level) {
      supabaseQuery = supabaseQuery.eq('experience_level', filters.experience_level)
    }

    if (filters.location?.city) {
      supabaseQuery = supabaseQuery.ilike('city', `%${filters.location.city}%`)
    }

    if (filters.location?.country) {
      supabaseQuery = supabaseQuery.ilike('country', `%${filters.location.country}%`)
    }

    if (filters.availability) {
      supabaseQuery = supabaseQuery.eq('availability_date', filters.availability)
    }

    // For skills, languages, and other text-based searches, use ilike
    if (filters.skills?.length) {
      const skillsCondition = filters.skills
        .map(skill => `primary_skills.ilike.%${skill}%`)
        .join(',')
      supabaseQuery = supabaseQuery.or(skillsCondition)
    }

    if (filters.languages?.length) {
      const languagesCondition = filters.languages
        .map(lang => `languages.ilike.%${lang}%`)
        .join(',')
      supabaseQuery = supabaseQuery.or(languagesCondition)
    }

    if (filters.position?.length) {
      const positionCondition = filters.position
        .map(pos => `current_position.ilike.%${pos}%`)
        .join(',')
      supabaseQuery = supabaseQuery.or(positionCondition)
    }

    if (filters.company?.length) {
      const companyCondition = filters.company
        .map(comp => `current_company.ilike.%${comp}%`)
        .join(',')
      supabaseQuery = supabaseQuery.or(companyCondition)
    }

    // Execute query
    const { data: candidates, error } = await supabaseQuery
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Supabase error:', error)
      return res.status(500).json({ error: 'Database query failed' })
    }

    // Transform data to match frontend expectations
    const transformedCandidates = candidates?.map((candidate: any) => ({
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
    })) || []

    // Filter by salary if specified (since expected_salary is stored as text)
    let filteredCandidates = transformedCandidates
    if (filters.salary?.min || filters.salary?.max) {
      filteredCandidates = transformedCandidates.filter(candidate => {
        const salaryText = candidate.expectedSalary
        if (!salaryText || salaryText === 'Not specified') return false
        
        // Extract numbers from salary text (e.g., "$80,000 - $120,000" -> [80000, 120000])
        const numbers = salaryText.match(/\d{1,3}(?:,\d{3})*/g)?.map(n => parseInt(n.replace(/,/g, '')))
        if (!numbers?.length) return false
        
        const candidateMin = Math.min(...numbers)
        const candidateMax = Math.max(...numbers)
        
        if (filters.salary?.min && candidateMax < filters.salary.min) return false
        if (filters.salary?.max && candidateMin > filters.salary.max) return false
        
        return true
      })
    }

    res.status(200).json({
      candidates: filteredCandidates,
      query: query,
      filters: filters,
      count: filteredCandidates.length
    })

  } catch (error) {
    console.error('Search API error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
