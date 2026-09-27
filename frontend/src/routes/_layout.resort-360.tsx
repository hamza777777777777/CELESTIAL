import { useState, useEffect, useCallback } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import {
  AlertTriangle, BrainCircuit, Activity, Users, BedDouble,
  RefreshCw, Info, CheckCircle2, UserCircle2,
  LineChart, ArrowRight, Sparkles, TrendingUp, CalendarDays, CalendarIcon
} from 'lucide-react'
import {
  api,
  type ResortStatsResponse,
  type StaffMemberResponse,
  type RoomResponse,
  type TaskResponse,
  type RecommendationResponse,
  type SystemicIssueResponse,
  type DemandForecastResponse,
} from '@/lib/api'

export const Route = createFileRoute('/_layout/resort-360')({
  component: Resort360Page,
})

// ── Helpers ──────────────────────────────────────────────────────────────────

const TASK_STATUS_COLORS: Record<string, string> = {
  created:     'bg-secondary text-muted-foreground border border-border',
  assigned:    'bg-[#0052ff]/10 text-[#0052ff] border border-[#0052ff]/20',
  in_progress: 'bg-[#f4b000]/10 text-[#f4b000] border border-[#f4b000]/20',
  completed:   'bg-[#05b169]/10 text-[#05b169] border border-[#05b169]/20',
  verified:    'bg-[#05b169]/15 text-[#05b169] border border-[#05b169]/30 font-semibold',
  closed:      'bg-secondary text-muted-foreground border border-border',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-[#cf202f]/10 text-[#cf202f] border border-[#cf202f]/20',
  Critical: 'bg-[#cf202f]/10 text-[#cf202f] border border-[#cf202f]/20',
  high:     'bg-[#f4b000]/10 text-[#f4b000] border border-[#f4b000]/20',
  High:     'bg-[#f4b000]/10 text-[#f4b000] border border-[#f4b000]/20',
  medium:   'bg-[#0052ff]/10 text-[#0052ff] border border-[#0052ff]/20',
  low:      'bg-secondary text-muted-foreground border border-border',
}

function StatusDot({ color }: { color: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${color}`} />
}

// ── KPI Tile ─────────────────────────────────────────────────────────────────

function KpiTile({
  label, value, icon, sub, color = ''
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  sub?: string
  color?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

function Resort360Page() {
  const [stats,   setStats]   = useState<ResortStatsResponse | null>(null)
  const [staff,   setStaff]   = useState<StaffMemberResponse[]>([])
  const [rooms,   setRooms]   = useState<RoomResponse[]>([])
  const [tasks,   setTasks]   = useState<TaskResponse[]>([])
  const [attentionTasks, setAttentionTasks] = useState<TaskResponse[]>([])
  const [nextAction, setNextAction] = useState<RecommendationResponse | null>(null)
  const [systemicIssues, setSystemicIssues] = useState<SystemicIssueResponse | null>(null)
  const [forecast, setForecast] = useState<DemandForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [viewDate, setViewDate] = useState<Date>(new Date())
  const [operationsTab, setOperationsTab] = useState<'active' | 'all'>('active')
  const [staffTab, setStaffTab] = useState<'all' | 'unassigned' | 'busy'>('all')

  // Reassign modal state
  const [reassignTask, setReassignTask] = useState<TaskResponse | null>(null)
  const [candidates, setCandidates] = useState<any[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [candidatesEmptyReason, setCandidatesEmptyReason] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)
  const [reassigning, setReassigning] = useState(false)
  const [reassignSuccess, setReassignSuccess] = useState<string | null>(null)
  const [reassignError, setReassignError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [statsData, staffData, roomsData, tasksData, attentionTasksData, nextActionData, systemicIssuesData, forecastData] = await Promise.all([
        api.getStats().catch(e => {
          console.warn("Stats load error:", e);
          return null as any;
        }),
        api.getStaff().catch(e => {
          console.warn("Staff load error:", e);
          return [];
        }),
        api.getRooms(format(viewDate, 'yyyy-MM-dd')).catch(e => {
          console.warn("Rooms load error:", e);
          return [];
        }),
        api.getTasks().catch(e => {
          console.warn("Tasks load error:", e);
          return [];
        }),
        api.getAttentionTasks().catch(e => {
          console.warn("Attention tasks load error:", e);
          return [];
        }),
        api.getNextAction().catch(e => {
          console.warn("Next action load error:", e);
          return null as any;
        }),
        api.getSystemicIssues().catch(e => {
          console.error("Systemic issues load error:", e);
          return { issues: [] };
        }),
        api.getDemandForecast().catch(e => {
          console.error("Demand forecast load error:", e);
          return { _error: e.message || "Demand forecast unavailable" } as any;
        })
      ])
      setStats(statsData)
      setStaff(staffData)
      setRooms(roomsData)
      setTasks(tasksData)
      setAttentionTasks(attentionTasksData)
      setNextAction(nextActionData)
      setSystemicIssues(systemicIssuesData)
      setForecast(forecastData)
      setLastRefresh(new Date())
    } catch (err: any) {
      setError(err.message || 'Failed to load resort data')
    } finally {
      setLoading(false)
    }
  }, [viewDate])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Derived data ─────────────────────────────────────────────────────────

  const roomCounts = rooms.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const bookingCounts = rooms.reduce((acc, r) => {
    const st = r.booking_status || 'available'
    acc[st] = (acc[st] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const occupancyPct = rooms.length > 0
    ? Math.round((bookingCounts.booked || 0) / rooms.length * 100)
    : 0

  // Active (non-closed) tasks sorted by priority
  const activeTasks = tasks
    .filter(t => t.status !== 'closed' && t.status !== 'verified')
    .sort((a, b) => {
      const pri: Record<string, number> = { critical: 0, Critical: 0, high: 1, High: 1, medium: 2, low: 3 }
      return (pri[a.priority ?? 'low'] ?? 3) - (pri[b.priority ?? 'low'] ?? 3)
    })
    .slice(0, 8)

  const highPriorityTasks = tasks.filter(
    t => ['high', 'High', 'critical', 'Critical'].includes(t.priority ?? '') && t.status !== 'closed'
  )

  // ── Intelligence alerts (rule-based, not LLM) ───────────────────────────
  const alerts: { level: 'warning' | 'info' | 'error'; message: string }[] = []

  if (highPriorityTasks.length > 0) {
    alerts.push({
      level: 'warning',
      message: `Attention: ${highPriorityTasks.length} high-priority task(s) are currently active.`,
    })
  }
  const overloadedStaff = staff.filter(s => s.active_task_count >= 3)
  overloadedStaff.forEach(s => {
    alerts.push({
      level: 'warning',
      message: `Workload alert: ${s.name} currently has ${s.active_task_count} active tasks.`,
    })
  })
  const maintenanceRooms = rooms.filter(r => r.status === 'maintenance')
  if (maintenanceRooms.length > 0) {
    alerts.push({
      level: 'info',
      message: `Maintenance: ${maintenanceRooms.length} room(s) are currently unavailable (${maintenanceRooms.map(r => r.room_number).join(', ')}).`,
    })
  }
  const pendingVerification = tasks.filter(t => t.status === 'completed')
  if (pendingVerification.length > 0) {
    alerts.push({
      level: 'info',
      message: `${pendingVerification.length} task(s) are completed and awaiting manager verification.`,
    })
  }

  const alertColors = {
    error:   'border-l-red-500 bg-red-50/50',
    warning: 'border-l-orange-500 bg-orange-50/50',
    info:    'border-l-blue-500 bg-blue-50/50',
  }
  const alertIconColors = {
    error:   'text-red-500',
    warning: 'text-orange-500',
    info:    'text-blue-500',
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading && !stats) {
    return (
      <div className="p-6 min-h-screen">
        <p className="text-muted-foreground animate-pulse">Loading resort data…</p>
      </div>
    )
  }

  // ── Reassign helpers ─────────────────────────────────────────────────────
  const openReassignModal = async (task: TaskResponse) => {
    setReassignTask(task)
    setSelectedStaffId(null)
    setReassignSuccess(null)
    setReassignError(null)
    setCandidates([])
    setCandidatesEmptyReason(null)
    setCandidatesLoading(true)
    try {
      const data = await api.getReassignmentCandidates(task.id!)
      setCandidates(data.candidates || [])
      setCandidatesEmptyReason(data.empty_reason || null)
    } catch (e: any) {
      setCandidatesEmptyReason(e.message || 'Failed to load candidates')
    } finally {
      setCandidatesLoading(false)
    }
  }

  const confirmReassign = async () => {
    if (!reassignTask || selectedStaffId == null) return
    setReassigning(true)
    setReassignError(null)
    try {
      await api.reassignTask(reassignTask.id!, selectedStaffId)
      const newStaff = candidates.find(c => c.staff_id === selectedStaffId)
      const isInitialAssign = reassignTask.status === 'created' || !reassignTask.staff_name
      setReassignSuccess(
        isInitialAssign
          ? `Task assigned to ${newStaff?.staff_name ?? 'staff member'} successfully.`
          : `Task reassigned to ${newStaff?.staff_name ?? 'new staff member'} successfully.`
      )
      // Refresh all resort data
      await loadAll()
    } catch (e: any) {
      setReassignError(e.message || 'Assignment failed')
    } finally {
      setReassigning(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 min-h-screen">

      {/* ── Reassign Modal ─────────────────────────────────────────────── */}
      <Dialog open={!!reassignTask} onOpenChange={(open) => { if (!open) { setReassignTask(null); setReassignSuccess(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              {reassignTask?.status === 'created' || !reassignTask?.staff_name
                ? `Assign Task: Room ${reassignTask?.location ?? 'N/A'} — ${reassignTask?.issue_type ?? 'Issue'}`
                : `Reassign Task: Room ${reassignTask?.location ?? 'N/A'} — ${reassignTask?.issue_type ?? 'Issue'}`}
            </DialogTitle>
            <DialogDescription>
              {reassignTask?.status === 'created' || !reassignTask?.staff_name
                ? 'Select a qualified available staff member to assign this task.'
                : <>Select a qualified staff member. Current assignee: <strong>{reassignTask?.staff_name ?? 'Unknown'}</strong></>}
              {reassignTask?.reason && (
                <span className="block mt-1 text-xs text-orange-700 bg-orange-50 p-2 rounded border border-orange-100">
                  <strong>SLA Status:</strong> {reassignTask.sla_status?.toUpperCase()} — {reassignTask.reason}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {reassignSuccess ? (
              <div className="flex flex-col items-center py-8 text-center text-green-700 bg-green-50 rounded-md border border-green-100">
                <CheckCircle2 className="h-10 w-10 mb-3 text-green-500" />
                <p className="font-semibold">{reassignSuccess}</p>
                <Button className="mt-4" variant="outline" size="sm" onClick={() => setReassignTask(null)}>Close</Button>
              </div>
            ) : candidatesLoading ? (
              <div className="text-center py-8 text-muted-foreground animate-pulse">Loading eligible candidates…</div>
            ) : candidatesEmptyReason ? (
              <div className="text-center py-8 text-orange-700 bg-orange-50 rounded-md border border-orange-100 p-4">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                <p className="font-semibold">No Candidates Available</p>
                <p className="text-sm mt-1">{candidatesEmptyReason}</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{candidates.length} eligible candidate{candidates.length !== 1 ? 's' : ''}, ranked by assignment score:</p>
                <div className="space-y-3">
                  {candidates.map((c: any, idx: number) => (
                    <div
                      key={c.staff_id}
                      onClick={() => setSelectedStaffId(c.staff_id)}
                      className={`border rounded-md p-3 cursor-pointer transition-colors ${
                        selectedStaffId === c.staff_id
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                            selectedStaffId === c.staff_id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                          }`}>
                            {selectedStaffId === c.staff_id && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                          <div>
                            <span className="font-semibold text-sm">{idx + 1}. {c.staff_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{c.department}</span>
                          </div>
                        </div>
                        <Badge className="bg-indigo-100 text-indigo-800 font-mono text-xs">
                          Score: {(c.score * 100).toFixed(1)}/100
                        </Badge>
                      </div>
                      {/* Score breakdown (mirrors existing explainability style) */}
                      <div className="mt-2 pt-2 border-t grid grid-cols-5 gap-1 text-[11px] text-slate-600">
                        {['skill_match', 'workload', 'availability', 'priority', 'recency'].map(key => (
                          <div key={key} className="text-center">
                            <div className="font-semibold text-slate-500 uppercase tracking-wide" style={{fontSize: '9px'}}>{key.replace('_', ' ')}</div>
                            <div className="font-bold text-slate-800">{((c.score_breakdown[key] ?? 0) * 100).toFixed(0)}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1.5 text-xs text-muted-foreground">{c.reasoning}</div>
                    </div>
                  ))}
                </div>

                {reassignError && (
                  <div className="text-sm text-red-700 bg-red-50 p-3 rounded-md border border-red-200">
                    {reassignError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setReassignTask(null)}>Cancel</Button>
                  <Button
                    disabled={selectedStaffId == null || reassigning}
                    onClick={confirmReassign}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {reassigning
                      ? 'Assigning…'
                      : (reassignTask?.status === 'created' || !reassignTask?.staff_name)
                        ? 'Assign Staff Member'
                        : 'Confirm Reassignment'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Header ─────────────────────────────────────────────────────── */}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resort 360</h1>
          <p className="text-muted-foreground mt-1">
            Live operational overview for resort managers.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadAll}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="text-red-600 text-sm border border-red-200 rounded-md p-3 bg-red-50">
          {error}{' '}
          <button onClick={loadAll} className="underline ml-1">Retry</button>
        </div>
      )}

      {/* ── KPI Tiles ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiTile
          label="Active Tasks"
          value={stats?.tasks.active ?? '—'}
          icon={<Activity className="h-4 w-4" />}
          sub={`${stats?.tasks.total ?? 0} total tasks`}
        />
        <KpiTile
          label="Open Complaints"
          value={stats?.complaints.open ?? '—'}
          icon={<AlertTriangle className="h-4 w-4" />}
          sub={`${stats?.complaints.total ?? 0} total`}
        />
        <KpiTile
          label="High Priority"
          value={stats?.complaints.high_priority ?? '—'}
          icon={<AlertTriangle className="h-4 w-4" />}
          color={stats && stats.complaints.high_priority > 0 ? 'text-red-600' : ''}
          sub="active high-priority tasks"
        />
        <KpiTile
          label="Staff Available"
          value={staff.filter(s => s.available).length}
          icon={<Users className="h-4 w-4" />}
          color="text-emerald-600"
          sub="ready for task assignment"
        />
        <KpiTile
          label="Occupancy"
          value={`${occupancyPct}%`}
          icon={<BedDouble className="h-4 w-4" />}
          color="text-blue-700"
          sub={`${bookingCounts.booked || 0} of ${rooms.length} rooms booked`}
        />
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">

          {/* Next Best Action */}
          {nextAction && (
            <Card className="border-indigo-200 shadow-sm">
              <CardHeader className="pb-3 bg-indigo-50/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-indigo-700">
                    <Sparkles className="h-5 w-5" />
                    Next Best Action
                  </CardTitle>
                  <Badge variant="outline" className="bg-white text-xs">
                    {nextAction.source === 'ai' ? 'AI Recommendation' : 'Rule-based Fallback'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={PRIORITY_COLORS[nextAction.priority] || 'bg-slate-100'}>
                        {nextAction.priority} priority
                      </Badge>
                      <h3 className="text-lg font-bold">{nextAction.action}</h3>
                    </div>
                    <p className="text-sm font-medium text-slate-700 mt-2">Why:</p>
                    <p className="text-sm text-slate-600 mb-3">{nextAction.reason}</p>
                    
                    <p className="text-sm font-medium text-slate-700">Evidence:</p>
                    <ul className="text-sm text-slate-600 list-disc list-inside mt-1 space-y-1">
                      {nextAction.evidence.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Task Attention Required */}
          <Card className="border-red-200 shadow-sm">
            <CardHeader className="pb-3 bg-red-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Task Attention Required
                </CardTitle>
                <Badge variant="outline" className="bg-white text-xs text-red-700 border-red-200">
                  SLA / Escalation
                </Badge>
              </div>
              <CardDescription className="text-red-700/80">Tasks requiring immediate manager intervention</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {attentionTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-green-700 bg-green-50 rounded-md border border-green-100">
                  <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
                  <p className="font-semibold text-sm">No tasks currently require attention.</p>
                  <p className="text-xs mt-1 text-green-600">All tasks are progressing within SLAs.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {attentionTasks.map((t, idx) => (
                    <div key={idx} className="flex flex-col border rounded-md overflow-hidden text-sm relative">
                      <div className="bg-slate-50 p-3 border-b flex justify-between items-center">
                        <div className="font-semibold">
                          Room {t.location} — {t.issue_type}
                        </div>
                        <Badge className={
                          t.sla_status === 'overdue' ? 'bg-red-100 text-red-800' :
                          t.sla_status === 'stalled' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>
                          {t.sla_status === 'overdue' ? '🔴 Overdue' :
                           t.sla_status === 'stalled' ? '🟠 Stalled' :
                           '🟡 At Risk'}
                        </Badge>
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Assigned To:</span>
                          <span className="font-medium">{t.staff_name || 'Unassigned'} ({t.status.replace('_', ' ')})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SLA Timing:</span>
                          <span className="font-medium">
                            {t.minutes_overdue !== undefined && t.minutes_overdue !== null ? `${t.minutes_overdue}m overdue` :
                             t.minutes_inactive !== undefined && t.minutes_inactive !== null ? `Inactive for ${t.minutes_inactive}m` :
                             t.minutes_remaining !== undefined && t.minutes_remaining !== null ? `${t.minutes_remaining}m remaining` :
                             'Unknown'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <div className="text-slate-700 bg-slate-50 p-2 rounded text-xs border flex-1 mr-4">
                            <strong>Reason:</strong> {t.reason}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="shrink-0"
                            onClick={() => openReassignModal(t)}
                          >
                            Reassign
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Room Overview */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BedDouble className="h-5 w-5 text-muted-foreground" />
                    Room Overview
                  </CardTitle>
                  <CardDescription>Date-aware booking occupancy</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">View Date:</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-[140px] pl-3 text-left font-normal h-8">
                        {format(viewDate, "dd MMM yyyy")}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={viewDate}
                        onSelect={(date) => date && setViewDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status summary */}
              <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-md border">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-700">Booking Occupancy:</span>
                  <span className="font-medium text-slate-900">{bookingCounts.booked || 0} Booked · {bookingCounts.available || rooms.length} Available</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Housekeeping:</span>
                  <span className="text-slate-600">
                    {roomCounts.occupied || 0} Occupied · {roomCounts.cleaning || 0} Cleaning · {roomCounts.maintenance || 0} Maintenance · {roomCounts.available || 0} Available
                  </span>
                </div>
              </div>

              {/* Room grid grouped by floor */}
              <div className="space-y-5">
                {[1, 2, 3, 4].map(floor => {
                  const floorRooms = rooms.filter(r => r.floor === floor || Math.floor(r.room_number / 100) === floor);
                  if (floorRooms.length === 0) return null;
                  return (
                    <div key={floor}>
                      <h4 className="text-xs font-semibold mb-2 text-slate-500 uppercase tracking-wider border-b pb-1">Floor {floor}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        {floorRooms.map(room => {
                          const isBooked = room.booking_status === 'booked';
                          
                          const statusColors = {
                            occupied: 'bg-red-50 border-red-200 text-red-900',
                            cleaning: 'bg-orange-50 border-orange-200 text-orange-900',
                            maintenance: 'bg-purple-50 border-purple-200 text-purple-900',
                            available: 'bg-green-50 border-green-200 text-green-900',
                            booked: 'bg-red-50 border-red-200 text-red-900'
                          };
                          const statusIcons = {
                            occupied: '🔴',
                            cleaning: '🟠',
                            maintenance: '🟣',
                            available: '🟢',
                            booked: '🔴'
                          };
                          
                          const primaryStatus = isBooked ? 'booked' : room.status;
                          
                          return (
                          <div
                            key={room.id}
                            className={`rounded-md p-2.5 border shadow-sm flex flex-col justify-between ${statusColors[primaryStatus as keyof typeof statusColors] || statusColors.available}`}
                          >
                            <div>
                              <div className="font-bold text-sm">Room {room.room_number}</div>
                              <div className="text-[11px] opacity-80 font-medium mb-1.5">{room.room_type}</div>
                              
                              {isBooked ? (
                                <>
                                  <div className="font-bold text-xs flex items-center gap-1">
                                     🔴 Booked
                                  </div>
                                  <div className="text-[10px] font-medium opacity-90 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                     {format(new Date(room.booking_check_in!), 'dd MMM')} → {format(new Date(room.booking_check_out!), 'dd MMM')}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="font-bold text-xs flex items-center gap-1 capitalize">
                                     {statusIcons[room.status as keyof typeof statusIcons] || '🟢'} {room.status}
                                  </div>
                                  {room.status === 'cleaning' && (
                                    <div className="text-[10px] font-medium opacity-90 mt-0.5">
                                      {room.cleaning_minutes_remaining !== undefined && room.cleaning_minutes_remaining !== null 
                                        ? (room.cleaning_minutes_remaining > 0 ? `${room.cleaning_minutes_remaining} min left` : 'Time exceeded')
                                        : 'Awaiting completion'}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            <div className="text-[10px] mt-2.5 pt-1.5 border-t border-black/10">
                               {isBooked ? (
                                 <>Housekeeping: <span className="capitalize font-semibold text-slate-700">{room.status}</span></>
                               ) : (
                                 <>Booking: <span className="font-semibold text-green-700">Available</span></>
                               )}
                            </div>
                          </div>
                          )
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Demand Forecast */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    7-Day Demand Forecast
                  </CardTitle>
                  <CardDescription>Predicted booking demand (rooms / day)</CardDescription>
                </div>
                <div className="flex items-center text-xs gap-1 border rounded px-2 py-1 bg-amber-50 text-amber-700 border-amber-200 font-medium">
                  <Info className="h-3 w-3" />
                  Model Demo
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {(!forecast || (forecast as any)._error) ? (
                <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md border border-red-200 flex flex-col items-center justify-center text-center">
                  <AlertTriangle className="h-6 w-6 mb-2 text-red-500" />
                  <p className="font-semibold">Demand forecast unavailable</p>
                  <p className="text-xs mt-1 text-red-500">
                    {(forecast as any)?._error || "Failed to load forecast data from server."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Primary disclaimer — must be visible at all times */}
                  <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-md flex items-start gap-2 border border-amber-200">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <div className="space-y-1">
                      <p className="font-semibold">Model Demo — trained on public European hotel booking data</p>
                      <p>Demo forecasts use simulated historical context because Smart Resort does not yet have sufficient historical booking data for this model. This does not represent Smart Resort actual demand.</p>
                    </div>
                  </div>

                  {/* 7-day grid */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {forecast.forecast.map((day, idx) => (
                      <div key={idx} className="flex flex-col border rounded-md overflow-hidden relative">
                        <div className="bg-slate-50 text-center py-1 text-xs font-semibold text-slate-600 border-b">
                          {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className="text-center py-3 flex-1 flex flex-col justify-center">
                          <span className="text-xl font-bold">{day.predicted_demand}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">est. rooms</span>
                        </div>
                        {day.event && (
                          <div
                            className="absolute top-1 right-1"
                            title={`Event: ${day.event.name}`}
                          >
                            <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Planning Signals — only rendered if events overlap forecast window */}
                  {forecast.forecast.some(d => d.planning_signal) && (
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="h-4 w-4 text-indigo-700" />
                        <span className="text-sm font-semibold text-indigo-900">Upcoming Events (Rule-Based Planning Signal)</span>
                      </div>
                      <ul className="text-sm text-indigo-800 space-y-1">
                        {forecast.forecast.filter(d => d.planning_signal).map((d, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="font-medium whitespace-nowrap">
                              {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}:
                            </span>
                            <span>{d.planning_signal}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Live Operations & Task Assignment Queue */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    Live Operations & Task Assignment
                  </CardTitle>
                  <CardDescription>
                    {operationsTab === 'active'
                      ? `${activeTasks.length} active task(s) in progress`
                      : `${tasks.length} total tasks`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                  <Button
                    variant={operationsTab === 'active' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs font-medium"
                    onClick={() => setOperationsTab('active')}
                  >
                    Active ({activeTasks.length})
                  </Button>
                  <Button
                    variant={operationsTab === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs font-medium"
                    onClick={() => setOperationsTab('all')}
                  >
                    All ({tasks.length})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {operationsTab === 'active' ? (
                activeTasks.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    All tasks are closed or verified. Nothing active.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto max-h-[380px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur z-10">
                        <tr className="border-b">
                          <th className="p-2.5 text-left font-medium">ID</th>
                          <th className="p-2.5 text-left font-medium">Issue / Location</th>
                          <th className="p-2.5 text-left font-medium">Priority</th>
                          <th className="p-2.5 text-left font-medium">Status</th>
                          <th className="p-2.5 text-left font-medium">Assigned To</th>
                          <th className="p-2.5 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTasks.map(task => {
                          const latestAssignment = task.assignments?.length
                            ? task.assignments[task.assignments.length - 1]
                            : null
                          return (
                            <tr key={task.id} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="p-2.5 font-medium text-xs text-muted-foreground">TSK-{task.id}</td>
                              <td className="p-2.5">
                                <div className="font-medium">
                                  {task.issue_type ?? 'Issue'} — Room {task.location ?? 'N/A'}
                                </div>
                                <div className="text-xs text-muted-foreground">{task.department ?? ''}</div>
                              </td>
                              <td className="p-2.5">
                                <Badge className={PRIORITY_COLORS[task.priority ?? 'low'] ?? 'bg-slate-100'}>
                                  {task.priority ?? 'N/A'}
                                </Badge>
                              </td>
                              <td className="p-2.5">
                                <Badge className={TASK_STATUS_COLORS[task.status] ?? ''}>
                                  {task.status.replace('_', ' ')}
                                </Badge>
                              </td>
                              <td className="p-2.5">
                                <div className="flex items-center gap-1">
                                  <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{latestAssignment?.staff_name ?? 'Unassigned'}</span>
                                </div>
                              </td>
                              <td className="p-2.5 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-indigo-700 hover:bg-indigo-50"
                                  onClick={() => openReassignModal(task)}
                                >
                                  Reassign
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* All Tasks */
                <div className="rounded-md border overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/90 backdrop-blur z-10">
                      <tr className="border-b">
                        <th className="p-2.5 text-left font-medium">ID</th>
                        <th className="p-2.5 text-left font-medium">Issue / Location</th>
                        <th className="p-2.5 text-left font-medium">Priority</th>
                        <th className="p-2.5 text-left font-medium">Status</th>
                        <th className="p-2.5 text-left font-medium">Assigned To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.slice(0, 20).map(task => {
                        const latestAssignment = task.assignments?.length
                          ? task.assignments[task.assignments.length - 1]
                          : null
                        return (
                          <tr key={task.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-2.5 font-medium text-xs text-muted-foreground">TSK-{task.id}</td>
                            <td className="p-2.5">
                              <div className="font-medium">
                                {task.issue_type ?? 'Issue'} — Room {task.location ?? 'N/A'}
                              </div>
                            </td>
                            <td className="p-2.5">
                              <Badge className={PRIORITY_COLORS[task.priority ?? 'low'] ?? 'bg-slate-100'}>
                                {task.priority ?? 'N/A'}
                              </Badge>
                            </td>
                            <td className="p-2.5">
                              <Badge className={TASK_STATUS_COLORS[task.status] ?? ''}>
                                {task.status.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-1">
                                <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{latestAssignment?.staff_name ?? 'Unassigned'}</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-3 flex justify-between items-center text-xs text-muted-foreground">
                <span>Showing top items. Full operational queue available in Tasks.</span>
                <Link to="/tasks">
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    View All Tasks <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">

          {/* Emerging Operational Patterns */}
          <Card className="border-orange-200 shadow-sm">
            <CardHeader className="pb-3 bg-orange-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="h-5 w-5" />
                  Emerging Operational Patterns
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {!systemicIssues || systemicIssues.issues.length === 0 ? (
                <div className="text-sm text-slate-500 italic text-center py-2">
                  No emerging operational patterns detected
                </div>
              ) : (
                systemicIssues.issues.map((issue, idx) => (
                  <div key={idx} className="border-b last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={PRIORITY_COLORS[issue.severity] || 'bg-slate-100'}>
                          {issue.severity} priority
                        </Badge>
                        <h3 className="text-base font-bold">{issue.title}</h3>
                      </div>
                      <Badge variant="outline" className="bg-white text-[10px] uppercase">
                        {issue.source.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700 mb-2 font-medium">{issue.summary}</p>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Evidence:</p>
                    <ul className="text-xs text-slate-600 list-disc list-inside">
                      {issue.evidence.map((point, pIdx) => (
                        <li key={pIdx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Staff Snapshot */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    Staff Snapshot
                  </CardTitle>
                  <CardDescription>
                    Live availability from database
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-1 pt-2">
                <Button
                  variant={staffTab === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => setStaffTab('all')}
                >
                  All ({staff.length})
                </Button>
                <Button
                  variant={staffTab === 'unassigned' ? 'default' : 'outline'}
                  size="sm"
                  className={`h-6 text-[11px] px-2 ${staffTab === 'unassigned' ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-medium' : 'text-emerald-700 border-emerald-200'}`}
                  onClick={() => setStaffTab('unassigned')}
                >
                  0 Tasks ({staff.filter(s => s.active_task_count === 0).length})
                </Button>
                <Button
                  variant={staffTab === 'busy' ? 'default' : 'outline'}
                  size="sm"
                  className={`h-6 text-[11px] px-2 ${staffTab === 'busy' ? 'bg-orange-600 hover:bg-orange-700 text-white font-medium' : 'text-orange-700 border-orange-200'}`}
                  onClick={() => setStaffTab('busy')}
                >
                  Busy ({staff.filter(s => s.active_task_count > 0).length})
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {staff.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staff data.</p>
              ) : (
                <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1">
                  {staff
                    .filter(s => staffTab === 'all' ? true : staffTab === 'unassigned' ? s.active_task_count === 0 : s.active_task_count > 0)
                    .map(s => (
                      <div key={s.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${s.available ? 'bg-green-500' : 'bg-orange-400'}`} />
                          <div>
                            <div className="text-sm font-medium leading-tight">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.department}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <Badge
                            variant="outline"
                            className={s.available
                              ? 'bg-green-50 text-green-700 border-green-200 text-xs'
                              : 'bg-orange-50 text-orange-700 border-orange-200 text-xs'}
                          >
                            {s.available ? 'Available' : 'Busy'}
                          </Badge>
                          <div className="text-xs mt-0.5">
                            {s.active_task_count > 0 ? (
                              <span className="text-muted-foreground">{s.active_task_count} task{s.active_task_count > 1 ? 's' : ''}</span>
                            ) : (
                              <span className="text-emerald-600 font-medium">0 tasks assigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
              <div className="mt-2 pt-2 border-t flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <StatusDot color="bg-green-500" />
                  {staff.filter(s => s.available).length} available
                </span>
                <span className="flex items-center gap-1">
                  <StatusDot color="bg-orange-400" />
                  {staff.filter(s => !s.available).length} busy
                </span>
              </div>
              <div className="flex justify-end">
                <Link to="/staff">
                  <Button variant="outline" size="sm" className="flex items-center gap-1 mt-1">
                    View Staff <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Operational Intelligence */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-indigo-500" />
                    Operational Intelligence
                  </CardTitle>
                  <CardDescription>
                    Rule-based alerts from live data
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Info className="h-3 w-3" />
                Data-driven rules — not LLM-generated
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-md p-3 border border-green-100">
                  <CheckCircle2 className="h-4 w-4" />
                  No active alerts. Operations look good.
                </div>
              ) : (
                alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`border-l-4 rounded-r-md p-3 text-sm ${alertColors[alert.level]}`}
                  >
                    <AlertTriangle className={`h-3.5 w-3.5 inline mr-1.5 ${alertIconColors[alert.level]}`} />
                    {alert.message}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Links to existing intelligence pages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Further Intelligence</CardTitle>
              <CardDescription>Existing analytical views</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/insights" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-indigo-500" />
                    View AI Insights
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <LineChart className="h-4 w-4 text-emerald-500" />
                    View Pricing Intelligence
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/audit" className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-slate-500" />
                    View Audit Trail
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <Separator />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Info className="h-3 w-3 text-blue-400" />
          Room/occupancy data is seeded for demonstration purposes — not a live PMS system.
        </span>
        <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
      </div>

    </div>
  )
}
