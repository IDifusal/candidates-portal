import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { FloatingChat } from "@/components/floating-chat"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useCandidates } from "@/hooks/useCandidates"
import { IconLoader } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

export default function Page() {
  const router = useRouter()
  const { candidates, loading, error, fetchCandidates } = useCandidates()
  const [filteredCandidates, setFilteredCandidates] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  // Initialize filtered candidates when candidates load
  useEffect(() => {
    if (!searchQuery) {
      setFilteredCandidates(candidates)
    }
  }, [candidates, searchQuery])

  // Handle URL query parameter for filtering
  useEffect(() => {
    if (router.isReady) {
      if (router.query.query && typeof router.query.query === 'string') {
        const query = router.query.query
        setSearchQuery(query)
        handleSearch(query)
      } else if (searchQuery) {
        // Clear search if no query in URL but we have a search active
        setSearchQuery('')
        setFilteredCandidates(candidates)
      }
    }
  }, [router.isReady, router.query.query])

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setFilteredCandidates(candidates)
      return
    }

    setIsSearching(true)
    
    try {
      const response = await fetch('/api/search-candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })

      if (response.ok) {
        const searchResult = await response.json()
        setFilteredCandidates(searchResult.candidates || [])
        console.log(`Search completed: Found ${searchResult.count} candidates for "${query}"`)
      } else {
        console.error('Search failed:', response.status)
        setFilteredCandidates(candidates)
      }
    } catch (error) {
      console.error('Search error:', error)
      setFilteredCandidates(candidates)
    } finally {
      setIsSearching(false)
    }
  }

  const handleNavigation = (url: string) => {
    router.push(url)
  }

  const displayCandidates = searchQuery ? filteredCandidates : candidates

  if (loading || (isSearching && searchQuery)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <IconLoader className="w-8 h-8 animate-spin" />
          <p className="text-muted-foreground">
            {isSearching && searchQuery ? `Searching for: "${searchQuery}"...` : 'Loading candidates...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error loading data</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={fetchCandidates}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
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
            <div className="@container/main flex flex-1 flex-col gap-2 bg-background">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 bg-background">
                {searchQuery && (
                  <div className="px-4 lg:px-6">
                    <div className={cn(
                      "border rounded-lg p-4",
                      displayCandidates.length > 0 
                        ? "bg-blue-50 border-blue-200" 
                        : "bg-yellow-50 border-yellow-200"
                    )}>
                      <h3 className={cn(
                        "font-semibold mb-1",
                        displayCandidates.length > 0 ? "text-blue-900" : "text-yellow-900"
                      )}>
                        {displayCandidates.length > 0 ? "Search Results" : "No Results Found"}
                      </h3>
                      <p className={cn(
                        "text-sm",
                        displayCandidates.length > 0 ? "text-blue-700" : "text-yellow-700"
                      )}>
                        {displayCandidates.length > 0 
                          ? `Showing results for: "${searchQuery}" (${displayCandidates.length} candidate${displayCandidates.length !== 1 ? 's' : ''} found)`
                          : `No candidates found for: "${searchQuery}". Try adjusting your search criteria.`
                        }
                      </p>
                      <button
                        onClick={() => {
                          router.push('/admin/dashboard')
                          setSearchQuery('')
                        }}
                        className={cn(
                          "text-xs hover:underline mt-2 underline",
                          displayCandidates.length > 0 
                            ? "text-blue-600 hover:text-blue-800" 
                            : "text-yellow-600 hover:text-yellow-800"
                        )}
                      >
                        Clear search and show all candidates
                      </button>
                    </div>
                  </div>
                )}
                <SectionCards candidates={displayCandidates} />
                <div className="px-4 lg:px-6">
                  <ChartAreaInteractive candidates={displayCandidates} />
                </div>
                <DataTable data={displayCandidates} />
              </div>
            </div>
          </div>
        </SidebarInset>
        <FloatingChat onNavigate={handleNavigation} />
      </SidebarProvider>
    </div>
  )
}
