import { IconTrendingDown, IconTrendingUp, IconUsers, IconUserCheck, IconCalendar, IconBriefcase } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SectionCardsProps {
  candidates: any[]
}

export function SectionCards({ candidates = [] }: SectionCardsProps) {
  const totalCandidates = candidates.length
  const qualifiedCandidates = candidates.filter(candidate => candidate.status === "✅ Qualified").length
  const underReviewCandidates = candidates.filter(candidate => candidate.status === "⏳ Under Review").length
  const workingWithClient = candidates.filter(candidate => candidate.status === "👔 Working with Client").length
  const workingAbroad = candidates.filter(candidate => candidate.status === "🌍 Working Abroad").length
  const unreachable = candidates.filter(candidate => candidate.status === "🚫 Unreachable").length
  
  const availableASAP = candidates.filter(candidate => candidate.availabilityDate === "asap").length
  const availableOneWeek = candidates.filter(candidate => candidate.availabilityDate === "1week").length
  
  const qualificationRate = totalCandidates > 0 ? ((qualifiedCandidates / totalCandidates) * 100).toFixed(1) : "0"
  const placementRate = totalCandidates > 0 ? (((workingWithClient + workingAbroad) / totalCandidates) * 100).toFixed(1) : "0"

  return (
    <div className="*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Candidates</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalCandidates}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconUsers className="size-3" />
              {qualificationRate}% Qualified
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {qualifiedCandidates} qualified candidates <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Registered in talent pool
          </div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Placement Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {placementRate}%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconUserCheck className="size-3" />
              {workingWithClient + workingAbroad} Placed
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Successfully placed candidates <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            High-quality candidate matching
          </div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Under Review</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {underReviewCandidates}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconCalendar className="size-3" />
              Manual Review
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Awaiting qualification review <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Manual filtering process</div>
        </CardFooter>
      </Card>
      
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Immediate Availability</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {availableASAP}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconBriefcase className="size-3" />
              +{availableOneWeek} This Week
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Ready to start immediately <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Quick placement potential</div>
        </CardFooter>
      </Card>
    </div>
  )
}
