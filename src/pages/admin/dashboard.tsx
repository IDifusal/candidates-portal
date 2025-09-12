import { useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useCandidates } from "@/hooks/useCandidates"
import { IconLoader } from "@tabler/icons-react"

export default function Page() {
  const { candidates, loading, error, fetchCandidates } = useCandidates()

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <IconLoader className="w-8 h-8 animate-spin" />
          <p className="text-muted-foreground">Loading candidates...</p>
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
                <SectionCards candidates={candidates} />
                <div className="px-4 lg:px-6">
                  <ChartAreaInteractive candidates={candidates} />
                </div>
                <DataTable data={candidates} />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
