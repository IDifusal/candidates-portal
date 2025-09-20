'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { VideoIcon, MicIcon, StopCircleIcon, PlayIcon, RotateCcwIcon, CheckCircleIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface InterviewQuestion {
  id: string
  question_text: string
  category: string
  difficulty_level: string
}

interface VideoRecorderProps {
  candidateId?: string
  onVideoSaved?: (videoData: { questionId: string, videoUrl: string }) => void
}

type RecordingState = 'idle' | 'loading-question' | 'thinking' | 'recording' | 'reviewing' | 'uploading' | 'completed'

export function VideoRecorder({ candidateId, onVideoSaved }: VideoRecorderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [state, setState] = useState<RecordingState>('idle')
  const [question, setQuestion] = useState<InterviewQuestion | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Obtener pregunta aleatoria
  const fetchRandomQuestion = useCallback(async () => {
    try {
      setState('loading-question')
      
      const { data, error } = await supabase
        .from('interview_questions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data && data.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.length)
        setQuestion(data[randomIndex])
        startThinkingTimer()
      } else {
        toast.error('No hay preguntas disponibles')
        setIsOpen(false)
      }
    } catch (error) {
      console.error('Error fetching question:', error)
      toast.error('Error al cargar la pregunta')
      setIsOpen(false)
    }
  }, [])

  // Inicializar cámara y micrófono
  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      })
      
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      
      return stream
    } catch (error) {
      console.error('Error accessing media devices:', error)
      toast.error('No se pudo acceder a la cámara o micrófono')
      throw error
    }
  }, [])

  // Timer para pensar (10 segundos) - SOLO preparar, NO grabar
  const startThinkingTimer = useCallback(() => {
    setState('thinking')
    setTimeLeft(10)
    
    // Inicializar cámara durante el tiempo de pensar
    initializeMedia().catch((error) => {
      console.error('Error initializing media during thinking:', error)
      toast.error('Error accediendo a la cámara')
      setIsOpen(false)
    })
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          console.log('=== TIEMPO DE PENSAR TERMINADO, INICIANDO GRABACIÓN ===')
          startRecording()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [initializeMedia])

  // Iniciar grabación REAL (solo cuando termine el thinking)
  const startRecording = useCallback(async () => {
    try {
      if (!streamRef.current) {
        console.error('No stream available for recording')
        return
      }

      console.log('=== INICIANDO GRABACIÓN REAL ===')
      setState('recording')
      setTimeLeft(10)
      chunksRef.current = []

      // Verificar que MediaRecorder es compatible
      const options = [
        { mimeType: 'video/webm;codecs=vp9,opus' },
        { mimeType: 'video/webm;codecs=vp8,opus' },
        { mimeType: 'video/webm' },
        { mimeType: 'video/mp4' }
      ]

      let selectedOptions = options[0]
      for (const option of options) {
        if (MediaRecorder.isTypeSupported(option.mimeType)) {
          selectedOptions = option
          break
        }
      }

      console.log('Using MIME type:', selectedOptions.mimeType)
      const mediaRecorder = new MediaRecorder(streamRef.current, selectedOptions)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size)
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, chunks:', chunksRef.current.length)
        const blob = new Blob(chunksRef.current, { type: selectedOptions.mimeType })
        console.log('Created blob:', blob.size, 'bytes')
        setRecordedBlob(blob)
        const url = URL.createObjectURL(blob)
        setVideoUrl(url)
        setState('reviewing')
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        toast.error('Error durante la grabación')
      }

      console.log('Starting MediaRecorder...')
      mediaRecorder.start(1000) // Collect data every second

      // Timer para grabación (10 segundos)
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            stopRecording()
            return 0
          }
          return prev - 1
        })
      }, 1000)

    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Error al iniciar la grabación')
    }
  }, [])

  // Detener grabación
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
  }, [])

  // Subir video a Supabase
  const uploadVideo = useCallback(async () => {
    if (!recordedBlob || !question || !candidateId) return

    try {
      setState('uploading')
      
      const fileName = `video-response-${candidateId}-${question.id}-${Date.now()}.webm`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('candidate-videos')
        .upload(fileName, recordedBlob, {
          contentType: 'video/webm',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('candidate-videos')
        .getPublicUrl(fileName)

      // Guardar referencia en la base de datos
      const { error: dbError } = await (supabase as any)
        .from('candidate_video_responses')
        .insert({
          candidate_id: candidateId,
          question_id: question.id,
          video_url: urlData.publicUrl,
          video_duration: 40,
          file_size: recordedBlob.size
        })

      if (dbError) throw dbError

      setState('completed')
      toast.success('Video guardado exitosamente')
      
      if (onVideoSaved) {
        onVideoSaved({
          questionId: question.id,
          videoUrl: urlData.publicUrl
        })
      }

    } catch (error) {
      console.error('Error uploading video:', error)
      toast.error('Error al guardar el video')
      setState('reviewing')
    }
  }, [recordedBlob, question, candidateId, onVideoSaved])

  // Reiniciar proceso
  const resetRecording = useCallback(() => {
    setState('idle')
    setQuestion(null)
    setTimeLeft(0)
    setRecordedBlob(null)
    setVideoUrl(null)
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Cleanup al cerrar
  const handleClose = useCallback(() => {
    resetRecording()
    setIsOpen(false)
  }, [resetRecording])

  // Inicializar al abrir el dialog - SOLO cargar pregunta
  useEffect(() => {
    if (isOpen && state === 'idle') {
      fetchRandomQuestion()
    }
  }, [isOpen, state, fetchRandomQuestion])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
    }
  }, [videoUrl])

  const getStateInfo = () => {
    switch (state) {
      case 'loading-question':
        return { title: 'Cargando pregunta...', description: 'Preparando tu pregunta de entrevista' }
      case 'thinking':
        return { title: 'Tiempo para pensar', description: `Tienes ${timeLeft} segundos para preparar tu respuesta` }
      case 'recording':
        return { title: '🔴 Grabando', description: `Tiempo restante: ${timeLeft} segundos` }
      case 'reviewing':
        return { title: 'Revisar grabación', description: 'Revisa tu respuesta antes de enviarla' }
      case 'uploading':
        return { title: 'Guardando video...', description: 'Subiendo tu respuesta al servidor' }
      case 'completed':
        return { title: '✅ Completado', description: 'Tu respuesta ha sido guardada exitosamente' }
      default:
        return { title: 'Video Entrevista', description: 'Prepárate para responder una pregunta' }
    }
  }

  const stateInfo = getStateInfo()

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2"
        disabled={!candidateId}
      >
        <VideoIcon className="w-4 h-4" />
        <span>Grabar Video Respuesta</span>
      </Button>

      <div className={`fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/50" onClick={handleClose}></div>
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden">
          
          {/* Header */}
          <div className="px-6 py-4 border-b bg-white">
            <h2 className="text-xl font-semibold text-gray-900">{stateInfo.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{stateInfo.description}</p>
          </div>

          {/* Content */}
          <div className="p-6 bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
              
              {/* Columna 1: Cámara */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Vista de Cámara</h3>
                <div className="relative bg-gray-900 rounded-lg overflow-hidden h-full min-h-[300px]">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted={state !== 'reviewing'}
                    playsInline
                    className="w-full h-full object-cover"
                    src={videoUrl || undefined}
                  />
                  
                  {state === 'recording' && (
                    <div className="absolute top-4 left-4">
                      <div className="flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">REC</span>
                      </div>
                    </div>
                  )}

                  {/* Loading states */}
                  {(state === 'loading-question' || state === 'uploading') && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-center text-white">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                        <p className="text-sm">
                          {state === 'loading-question' ? 'Cargando pregunta...' : 'Guardando video...'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Columna 2: Pregunta y Timer */}
              <div className="space-y-6">
                
                {/* Pregunta */}
                {question && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-blue-900">Pregunta de Entrevista</h3>
                      <Badge variant="outline" className="capitalize text-blue-700 border-blue-300">
                        {question.category}
                      </Badge>
                    </div>
                    <p className="text-blue-800 font-medium leading-relaxed">{question.question_text}</p>
                  </div>
                )}

                {/* Timer y Estado */}
                <div className="space-y-4">
                  {(state === 'thinking' || state === 'recording') && (
                    <div className="text-center">
                      <div className="text-6xl font-bold text-gray-900 mb-2">{timeLeft}</div>
                      <div className="text-lg text-gray-600 mb-4">
                        {state === 'thinking' ? 'Tiempo para pensar' : 'Grabando respuesta'}
                      </div>
                      <Progress value={((40 - timeLeft) / 40) * 100} className="w-full h-2" />
                    </div>
                  )}

                  {state === 'reviewing' && (
                    <div className="text-center space-y-4">
                      <div className="text-lg font-medium text-gray-900">
                        ¡Grabación completada!
                      </div>
                      <p className="text-gray-600">
                        Revisa tu respuesta y decide si quieres guardarla o grabar de nuevo.
                      </p>
                    </div>
                  )}

                  {state === 'completed' && (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircleIcon className="w-8 h-8 text-green-600" />
                      </div>
                      <div className="text-lg font-medium text-green-900">
                        ¡Video guardado exitosamente!
                      </div>
                    </div>
                  )}
                </div>

                {/* Instrucciones */}
                {(state === 'thinking' || state === 'idle') && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Instrucciones:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Lee cuidadosamente la pregunta</li>
                      <li>• Tómate el tiempo para pensar tu respuesta</li>
                      <li>• Habla de forma clara y natural</li>
                      <li>• La grabación iniciará automáticamente</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
            <Button variant="outline" onClick={handleClose} className="text-gray-700 ">
              Cancelar
            </Button>
            
            <div className="flex space-x-2">
              {state === 'reviewing' && (
                <>
                  <Button variant="outline" onClick={resetRecording}>
                    <RotateCcwIcon className="w-4 h-4 mr-2" />
                    Grabar de Nuevo
                  </Button>
                  <Button onClick={uploadVideo} className="bg-blue-600 hover:bg-blue-700">
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                    Guardar Video
                  </Button>
                </>
              )}
              
              {state === 'completed' && (
                <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700">
                  Continuar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
