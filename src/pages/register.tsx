import React, { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { ChevronLeft, ChevronRight, User, Briefcase, Award, Check, Plus, Trash2, Loader2 } from 'lucide-react'
import { useCandidates } from '@/hooks/useCandidates'
import { toast } from 'sonner'

// Form validation schemas for each step
const personalInfoSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  city: z.string().min(2, 'City must be at least 2 characters'),
  country: z.string().min(1, 'Please select a country'),
  linkedinUrl: z.string().url('Please enter a valid LinkedIn URL').optional().or(z.literal('')),
  portfolioUrl: z.string().url('Please enter a valid portfolio URL').optional().or(z.literal(''))
})

const workExperienceItemSchema = z.object({
  position: z.string().min(2, 'Position name is required'),
  company: z.string().min(2, 'Company name is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  isCurrentJob: z.boolean().default(false),
  mainTasks: z.string().min(10, 'Please describe your main tasks (at least 10 characters)'),
  industry: z.string().min(1, 'Please select an industry')
})

const experienceSchema = z.object({
  workExperiences: z.array(workExperienceItemSchema).min(1, 'Please add at least one work experience'),
  education: z.string().min(10, 'Please provide your educational background'),
  certifications: z.string().optional(),
  expectedSalary: z.string().min(1, 'Expected salary is required'),
  availabilityDate: z.string().min(1, 'Availability date is required')
})

const skillsSchema = z.object({
  primarySkills: z.string().min(10, 'Please list your primary skills (at least 10 characters)'),
  secondarySkills: z.string().optional(),
  languages: z.string().min(5, 'Please list languages you speak'),
  tools: z.string().min(5, 'Please list tools and technologies you use'),
  projectsDescription: z.string().min(100, 'Please describe your key projects (at least 100 characters)'),
  achievements: z.string().optional(),
  references: z.string().optional(),
  additionalInfo: z.string().optional()
})

type PersonalInfo = z.infer<typeof personalInfoSchema>
type WorkExperienceItem = z.infer<typeof workExperienceItemSchema>
type Experience = z.infer<typeof experienceSchema>
type Skills = z.infer<typeof skillsSchema>

type FormData = PersonalInfo & Experience & Skills

const STEPS = [
  { id: 1, title: 'Personal Information', icon: User },
  { id: 2, title: 'Experience', icon: Briefcase },
  { id: 3, title: 'Skills & Projects', icon: Award }
]

export default function Register() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Partial<FormData>>({
    workExperiences: [{
      position: '',
      company: '',
      startDate: '',
      endDate: '',
      isCurrentJob: false,
      mainTasks: '',
      industry: ''
    }]
  })
  const [isSubmitted, setIsSubmitted] = useState(false)

  const { loading, error, registerCandidate } = useCandidates()

  const getCurrentSchema = () => {
    switch (currentStep) {
      case 1: return personalInfoSchema
      case 2: return experienceSchema
      case 3: return skillsSchema
      default: return personalInfoSchema
    }
  }

  const form = useForm({
    resolver: zodResolver(getCurrentSchema()) as any,
    defaultValues: formData,
    mode: 'onChange'
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'workExperiences' as any
  })

  const addWorkExperience = () => {
    append({
      position: '',
      company: '',
      startDate: '',
      endDate: '',
      isCurrentJob: false,
      mainTasks: '',
      industry: ''
    })
  }

  const removeWorkExperience = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const onNext = async (data: any) => {
    const isValid = await form.trigger()
    if (isValid) {
      const updatedFormData = { ...formData, ...data }
      setFormData(updatedFormData)
      
      if (currentStep < 3) {
        setCurrentStep(prev => prev + 1)
        form.reset(updatedFormData)
      } else {
        // Final submission
        const result = await registerCandidate(updatedFormData as any)
        
        if (result.success) {
          setIsSubmitted(true)
          toast.success('Registration completed successfully!', {
            description: 'We will review your application and get back to you soon.'
          })
        } else {
          toast.error('Registration failed', {
            description: result.error || 'Please try again later.'
          })
        }
      }
    }
  }

  const onPrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
      form.reset(formData)
    }
  }

  const progress = (currentStep / 3) * 100

  // Success screen
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center py-12 px-4">
        <Card className="max-w-md mx-auto text-center shadow-lg">
          <CardContent className="pt-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Registration Complete!
            </h2>
            <p className="text-slate-600 mb-6">
              Thank you for joining our talent pool. We'll review your application and get back to you soon.
            </p>
            <Button 
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Column - Header & Info */}
          <div className="space-y-8">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                Join Our Talent Pool
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed mb-8">
                Take the first step towards your dream career. Share your professional journey with us and get discovered by top employers.
              </p>
              
              {/* Progress Section */}
              <div className="bg-white rounded-lg p-6 shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">Registration Progress</h3>
                  <span className="text-sm text-slate-500">{currentStep} of 3</span>
                </div>
                <Progress value={progress} className="mb-4" />
                <div className="flex justify-between text-sm">
                  {STEPS.map((step) => {
                    const Icon = step.icon
                    const isCompleted = currentStep > step.id
                    const isCurrent = currentStep === step.id
                    
                    return (
                      <div key={step.id} className="flex flex-col items-center space-y-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCompleted 
                            ? 'bg-green-500 text-white' 
                            : isCurrent 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-slate-200 text-slate-500'
                        }`}>
                          {isCompleted ? <Check size={16} /> : <Icon size={16} />}
                        </div>
                        <span className={`text-xs ${isCurrent ? 'text-blue-600 font-medium' : 'text-slate-500'}`}>
                          {step.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-4 mt-8">
                <h3 className="font-semibold text-slate-900">Why Join Us?</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-slate-600">Get matched with top employers</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-slate-600">Receive personalized job recommendations</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-slate-600">Build your professional network</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-slate-600">Access exclusive career opportunities</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="w-full">
            <Card className="shadow-lg border-0">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-semibold text-center">
                  {STEPS.find(step => step.id === currentStep)?.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onNext)} className="space-y-6">
                    {/* Step 1: Personal Information */}
                    {currentStep === 1 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>First Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="John" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Last Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Doe" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="john.doe@example.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="+1 (555) 123-4567" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="dateOfBirth"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Date of Birth</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address</FormLabel>
                              <FormControl>
                                <Input placeholder="123 Main Street" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>City</FormLabel>
                                <FormControl>
                                  <Input placeholder="New York" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Country</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select country" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="us">United States</SelectItem>
                                    <SelectItem value="ca">Canada</SelectItem>
                                    <SelectItem value="uk">United Kingdom</SelectItem>
                                    <SelectItem value="au">Australia</SelectItem>
                                    <SelectItem value="de">Germany</SelectItem>
                                    <SelectItem value="fr">France</SelectItem>
                                    <SelectItem value="es">Spain</SelectItem>
                                    <SelectItem value="it">Italy</SelectItem>
                                    <SelectItem value="br">Brazil</SelectItem>
                                    <SelectItem value="mx">Mexico</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="linkedinUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>LinkedIn Profile (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="https://linkedin.com/in/johndoe" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="portfolioUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Portfolio Website (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="https://johndoe.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Step 2: Experience */}
                    {currentStep === 2 && (
                      <div className="space-y-6">
                        {/* Work Experience Section */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">Work Experience</h3>
                            <Button
                              type="button"
                              variant="outline" 
                              size="sm"
                              onClick={addWorkExperience}
                              className="flex items-center space-x-2 hover:bg-black text-black hover:text-white bg-white"
                            >
                              <Plus size={16} />
                              <span>Add Experience</span>
                            </Button>
                          </div>

                          {fields.map((field, index) => (
                            <Card key={field.id} className="p-4 border border-slate-200">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-slate-700">Experience #{index + 1}</h4>
                                  {fields.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeWorkExperience(index)}
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <FormField
                                    control={form.control}
                                    name={`workExperiences.${index}.position`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Position Name</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Software Engineer" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name={`workExperiences.${index}.company`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Company</FormLabel>
                                        <FormControl>
                                          <Input placeholder="Tech Corp" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <FormField
                                    control={form.control}
                                    name={`workExperiences.${index}.startDate`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Start Date</FormLabel>
                                        <FormControl>
                                          <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name={`workExperiences.${index}.endDate`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>End Date</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="date" 
                                            placeholder="Leave empty if current job"
                                            {...field} 
                                            disabled={form.watch(`workExperiences.${index}.isCurrentJob`)}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <div className="flex items-center space-x-2">
                                  <FormField
                                    control={form.control}
                                    name={`workExperiences.${index}.isCurrentJob`}
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                          <input
                                            type="checkbox"
                                            checked={field.value}
                                            onChange={(e) => {
                                              field.onChange(e.target.checked)
                                              if (e.target.checked) {
                                                form.setValue(`workExperiences.${index}.endDate`, '')
                                              }
                                            }}
                                            className="mt-1"
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel className="text-sm font-normal">
                                            This is my current job
                                          </FormLabel>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <FormField
                                  control={form.control}
                                  name={`workExperiences.${index}.industry`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Industry</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select industry" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="technology">Technology</SelectItem>
                                          <SelectItem value="finance">Finance</SelectItem>
                                          <SelectItem value="healthcare">Healthcare</SelectItem>
                                          <SelectItem value="education">Education</SelectItem>
                                          <SelectItem value="retail">Retail</SelectItem>
                                          <SelectItem value="manufacturing">Manufacturing</SelectItem>
                                          <SelectItem value="consulting">Consulting</SelectItem>
                                          <SelectItem value="marketing">Marketing</SelectItem>
                                          <SelectItem value="media">Media</SelectItem>
                                          <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`workExperiences.${index}.mainTasks`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Main Tasks & Responsibilities</FormLabel>
                                      <FormControl>
                                        <Textarea 
                                          placeholder="Describe your key responsibilities and achievements in this role..."
                                          className="min-h-[100px]"
                                          {...field} 
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </Card>
                          ))}
                        </div>

                        {/* Other Experience Fields */}
                        <div className="space-y-4 pt-4 border-t">
                          <FormField
                            control={form.control}
                            name="education"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Education Background</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Include your degrees, institutions, graduation years, and relevant coursework..."
                                    className="min-h-[100px]"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="certifications"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Certifications (Optional)</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="List any professional certifications, licenses, or credentials..."
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="expectedSalary"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Expected Salary Range</FormLabel>
                                  <FormControl>
                                    <Input placeholder="$80,000 - $120,000" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="availabilityDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Available Start Date</FormLabel>
                                  <FormControl>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select availability" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="asap">ASAP</SelectItem>
                                        <SelectItem value="1week">In One Week</SelectItem>
                                        <SelectItem value="1month">In One Month</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Skills & Projects */}
                    {currentStep === 3 && (
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="primarySkills"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Primary Skills</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="List your core technical and professional skills (e.g., JavaScript, React, Node.js, Project Management, etc.)"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="secondarySkills"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Secondary Skills (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Additional skills you're familiar with or learning..."
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="languages"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Languages</FormLabel>
                                <FormControl>
                                  <Input placeholder="English (Native), Spanish (Fluent)" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="tools"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tools & Technologies</FormLabel>
                                <FormControl>
                                  <Input placeholder="Git, Docker, AWS, Figma, etc." {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="projectsDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Key Projects</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Describe 2-3 of your most significant projects, including technologies used, your role, and outcomes achieved..."
                                  className="min-h-[120px]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="achievements"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notable Achievements (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Awards, recognitions, publications, or significant accomplishments..."
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="references"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>References (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Professional references with contact information (if available)..."
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="additionalInfo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Additional Information (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Anything else you'd like us to know about you, your career goals, or preferences..."
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between pt-6 border-t">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={onPrevious}
                        disabled={currentStep === 1 || loading}
                        className="flex items-center space-x-2 hover:bg-black text-black hover:text-white bg-white"
                      >
                        <ChevronLeft size={16} />
                        <span>Previous</span>
                      </Button>
                      
                      <Button 
                        type="submit"
                        disabled={loading}
                        className="flex items-center space-x-2"
                      >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{currentStep === 3 ? 'Complete Registration' : 'Next'}</span>
                        {currentStep < 3 && !loading && <ChevronRight size={16} />}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}