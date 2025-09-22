import { useState, useEffect } from 'react'

interface BrowserFingerprint {
  userAgent: string
  language: string
  timezone: string
  screen: {
    width: number
    height: number
    colorDepth: number
  }
  canvas?: string
  webgl?: string
  fonts?: string[]
}

export function useBrowserFingerprint() {
  const [fingerprint, setFingerprint] = useState<BrowserFingerprint | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const generateFingerprint = async () => {
      try {
        const fp: BrowserFingerprint = {
          userAgent: navigator.userAgent,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screen: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth
          }
        }

        // Canvas fingerprinting (basic)
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.textBaseline = 'top'
            ctx.font = '14px Arial'
            ctx.fillText('Browser fingerprint canvas', 2, 2)
            fp.canvas = canvas.toDataURL().slice(0, 100) // First 100 chars only
          }
        } catch (e) {
          // Canvas fingerprinting blocked or failed
        }

        // WebGL fingerprinting (basic)
        try {
          const canvas = document.createElement('canvas')
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
          if (gl) {
            const renderer = gl.getParameter(gl.RENDERER)
            const vendor = gl.getParameter(gl.VENDOR)
            fp.webgl = `${vendor}-${renderer}`.slice(0, 50)
          }
        } catch (e) {
          // WebGL fingerprinting blocked or failed
        }

        // Font detection (basic - only common fonts)
        try {
          const testFonts = [
            'Arial', 'Helvetica', 'Times New Roman', 'Courier New',
            'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Comic Sans MS',
            'Impact', 'Arial Black', 'Tahoma', 'Century Gothic'
          ]
          
          const availableFonts: string[] = []
          const testString = 'mmmmmmmmmmlli'
          const testSize = '72px'
          
          // Create test elements
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          
          if (context) {
            // Baseline width with default font
            context.font = `${testSize} monospace`
            const baselineWidth = context.measureText(testString).width
            
            for (const font of testFonts) {
              context.font = `${testSize} ${font}, monospace`
              const width = context.measureText(testString).width
              
              if (width !== baselineWidth) {
                availableFonts.push(font)
              }
            }
          }
          
          fp.fonts = availableFonts.slice(0, 10) // Limit to first 10 detected fonts
        } catch (e) {
          // Font detection failed
        }

        setFingerprint(fp)
      } catch (error) {
        console.error('Error generating browser fingerprint:', error)
        // Set minimal fingerprint
        setFingerprint({
          userAgent: navigator.userAgent,
          language: navigator.language,
          timezone: 'UTC',
          screen: {
            width: 1920,
            height: 1080,
            colorDepth: 24
          }
        })
      } finally {
        setLoading(false)
      }
    }

    generateFingerprint()
  }, [])

  return { fingerprint, loading }
}

// Utility function to hash fingerprint for comparison
export function hashFingerprint(fingerprint: BrowserFingerprint): string {
  const str = JSON.stringify(fingerprint, Object.keys(fingerprint).sort())
  
  // Simple hash function (for client-side use)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return hash.toString(36)
}
