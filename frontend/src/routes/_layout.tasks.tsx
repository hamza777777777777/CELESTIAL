import { useState, useEffect, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Filter, UserCircle2 } from 'lucide-react'
import { api, type TaskResponse } from '@/lib/api'

export const Route = createFileRoute('/_layout/tasks')({
  component: TasksPage,
})

// ── Types matching original mock-tasks shape ─────────────────────────────────
type TaskStatus = 'Created' | 'Assigned' | 'In Progress' | 'Completed' | 'Verified' | 'Closed'

interface Task {
  id: string
  complaintId?: string
  title: string
  assignedTo: string
  skill: string
  priority: string
  status: TaskStatus
  createdAt: string
  dueAt: string
  slaStatus?: string | null
  minutesRemaining?: number | null
  minutesOverdue?: number | null
  minutesInactive?: number | null
  assignmentScore?: number
  completionNotes?: string
  completionProofPath?: string
  complaintPhotoPath?: string
  _rawId: number
}

// ── Map API response to UI Task shape ────────────────────────────────────────
function mapApiToTask(tData: TaskResponse): Task {
  const latestAssignment =
    tData.assignments && tData.assignments.length > 0
      ? tData.assignments[tData.assignments.length - 1]
      : null

  const statusMap: Record<string, TaskStatus> = {
    created:     'Created',
    assigned:    'Assigned',
    in_progress: 'In Progress',
    completed:   'Completed',
    verified:    'Verified',
    closed:      'Closed',
  }

  return {
    id:              `TSK-${tData.id}`,
    complaintId:     `CMP-${tData.complaint_id}`,
    title:           tData.issue_type
                       ? `${tData.issue_type} - ${tData.location ?? 'N/A'}`
                       : `Issue in ${tData.location ?? 'N/A'}`,
    assignedTo:      latestAssignment?.staff_name ?? 'Unassigned',
    skill:           tData.department ?? 'N/A',
    priority:        tData.priority?.toLowerCase() ?? 'medium',
    status:          statusMap[tData.status] ?? 'Created',
    createdAt:       tData.created_at,
    dueAt:           new Date(new Date(tData.created_at).getTime() + 60 * 60 * 1000).toISOString(),
    slaStatus:       tData.sla_status,
    minutesRemaining: tData.minutes_remaining,
    minutesOverdue:  tData.minutes_overdue,
    minutesInactive: tData.minutes_inactive,
    assignmentScore: latestAssignment?.score != null ? Math.round(latestAssignment.score) : undefined,
    completionNotes: tData.completion_proofs && tData.completion_proofs.length > 0
                       ? 'Completion proof provided.'
                       : undefined,
    completionProofPath: tData.completion_proofs && tData.completion_proofs.length > 0
                           ? tData.completion_proofs[tData.completion_proofs.length - 1].photo_path
                           : undefined,
    complaintPhotoPath: tData.complaint_photo_path || undefined,
    _rawId:          tData.id,
  }
}

// ── Color helpers (UI.md semantic tokens) ───────────────────────────────────
function getPriorityColor(p: string): string {
  switch (p) {
    case 'critical': return 'bg-[#cf202f]/10 text-[#cf202f] border border-[#cf202f]/20'
    case 'high':     return 'bg-[#f4b000]/10 text-[#f4b000] border border-[#f4b000]/20'
    case 'medium':   return 'bg-[#0052ff]/10 text-[#0052ff] border border-[#0052ff]/20'
    case 'low':      return 'bg-secondary text-muted-foreground border border-border'
    default:         return 'bg-secondary text-muted-foreground border border-border'
  }
}

function getStatusBadge(s: TaskStatus): string {
  switch (s) {
    case 'Created':     return 'bg-secondary text-muted-foreground border border-border'
    case 'Assigned':    return 'bg-[#0052ff]/10 text-[#0052ff] border border-[#0052ff]/20'
    case 'In Progress': return 'bg-[#f4b000]/10 text-[#f4b000] border border-[#f4b000]/20'
    case 'Completed':   return 'bg-[#05b169]/10 text-[#05b169] border border-[#05b169]/20'
    case 'Verified':    return 'bg-[#05b169]/15 text-[#05b169] border border-[#05b169]/30 font-semibold'
    case 'Closed':      return 'bg-secondary text-muted-foreground border border-border'
    default:            return 'bg-secondary text-muted-foreground border border-border'
  }
}

function getSLAIndicator(task: Task): React.ReactElement | null {
  if (task.status !== 'Assigned' && task.status !== 'In Progress') {
    return null;
  }
  
  if (task.slaStatus === 'on_track') {
    return (
      <Badge variant="outline" className="bg-[#05b169]/10 text-[#05b169] border-[#05b169]/30 text-[10px] uppercase font-semibold whitespace-nowrap">
        <div className="h-1.5 w-1.5 rounded-full bg-[#05b169] mr-1.5 inline-block" />
        ON TRACK {task.minutesRemaining != null ? `— ${task.minutesRemaining} min remaining` : ''}
      </Badge>
    );
  }
  
  if (task.slaStatus === 'at_risk') {
    return (
      <Badge variant="outline" className="bg-[#f4b000]/10 text-[#f4b000] border-[#f4b000]/30 text-[10px] uppercase font-semibold whitespace-nowrap">
        <div className="h-1.5 w-1.5 rounded-full bg-[#f4b000] mr-1.5 inline-block" />
        AT RISK {task.minutesRemaining != null ? `— ${task.minutesRemaining} min remaining` : ''}
      </Badge>
    );
  }
  
  if (task.slaStatus === 'stalled') {
    return (
      <Badge variant="outline" className="bg-[#f4b000]/15 text-[#f4b000] border-[#f4b000]/40 text-[10px] uppercase font-semibold whitespace-nowrap">
        <div className="h-1.5 w-1.5 rounded-full bg-[#f4b000] mr-1.5 inline-block" />
        STALLED {task.minutesInactive != null ? `— no activity for ${task.minutesInactive} min` : ''}
      </Badge>
    );
  }
  
  if (task.slaStatus === 'overdue') {
    return (
      <Badge variant="outline" className="bg-[#cf202f]/10 text-[#cf202f] border-[#cf202f]/30 text-[10px] uppercase font-semibold whitespace-nowrap">
        <div className="h-1.5 w-1.5 rounded-full bg-[#cf202f] mr-1.5 inline-block" />
        OVERDUE {task.minutesOverdue != null ? `— by ${task.minutesOverdue} min` : ''}
      </Badge>
    );
  }
  
  return null;
}

// ── Page component ───────────────────────────────────────────────────────────
function TasksPage() {
  const [tasks,   setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'completed'>('all')

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getTasks()
      setTasks(data.map(mapApiToTask).reverse())
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const filteredTasks = tasks.filter(t => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'in_progress') return t.status === 'In Progress' || t.status === 'Assigned'
    if (filterStatus === 'completed') return t.status === 'Completed' || t.status === 'Verified' || t.status === 'Closed'
    return true
  })

  return (
    <div className="p-6 space-y-6 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Operational Tasks</h1>
        <p className="text-muted-foreground">Task queue with AI-powered assignment and SLAs.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Task Queue</CardTitle>
            <CardDescription>Live operations</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadTasks} disabled={loading}>
            <Filter className="w-4 h-4 mr-2" />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-red-600 text-sm mb-3">
              {error}{' '}
              <button onClick={loadTasks} className="underline">Retry</button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              All Tasks ({tasks.length})
            </Button>
            <Button
              variant={filterStatus === 'in_progress' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('in_progress')}
            >
              Active / In Progress ({tasks.filter(t => t.status === 'In Progress' || t.status === 'Assigned').length})
            </Button>
            <Button
              variant={filterStatus === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('completed')}
            >
              Completed ({tasks.filter(t => t.status === 'Completed' || t.status === 'Verified' || t.status === 'Closed').length})
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Task ID</th>
                  <th className="p-3 text-left font-medium">Title / Complaint</th>
                  <th className="p-3 text-left font-medium">Assigned To</th>
                  <th className="p-3 text-left font-medium">Priority</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-left font-medium">SLA</th>
                  <th className="p-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      Loading tasks…
                    </td>
                  </tr>
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No tasks found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map(task => (
                    <tr key={task.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{task.id}</td>
                      <td className="p-3">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-muted-foreground">Ref: {task.complaintId || 'N/A'}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center">
                          <UserCircle2 className="h-4 w-4 mr-2 text-muted-foreground" />
                          {task.assignedTo}
                        </div>
                        <div className="text-xs text-muted-foreground ml-6">Skill: {task.skill}</div>
                      </td>
                      <td className="p-3">
                        <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={getStatusBadge(task.status)}>{task.status}</Badge>
                      </td>
                      <td className="p-3">{getSLAIndicator(task)}</td>
                      <td className="p-3">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">Details</Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{task.id} - {task.title}</DialogTitle>
                              <DialogDescription>
                                Created on {new Date(task.createdAt).toLocaleString()}
                              </DialogDescription>
                            </DialogHeader>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                              <div className="space-y-4">
                                <div className="border rounded-md p-3 space-y-2">
                                  <h4 className="font-semibold text-sm border-b pb-2 mb-2">Complaint Info</h4>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Ref:</span> {task.complaintId}
                                  </div>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Skill Required:</span> {task.skill}
                                  </div>
                                  {task.complaintPhotoPath && (
                                    <div className="mt-2 h-32 bg-muted rounded flex items-center justify-center border-dashed border-2 overflow-hidden">
                                      <img
                                        src={`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/${task.complaintPhotoPath}`}
                                        alt="Complaint Photo"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="border rounded-md p-3 space-y-2">
                                  <h4 className="font-semibold text-sm border-b pb-2 mb-2">Assignment Details</h4>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Staff:</span> {task.assignedTo}
                                  </div>
                                  <div className="text-sm flex items-center">
                                    <span className="text-muted-foreground mr-2">AI Match Score:</span>
                                    <Badge variant="secondary">
                                      {task.assignmentScore != null ? `${task.assignmentScore}/100` : 'N/A'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="border rounded-md p-3 space-y-2">
                                  <h4 className="font-semibold text-sm border-b pb-2 mb-2">Status & SLA</h4>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Current Status:</span>{' '}
                                    <Badge className={getStatusBadge(task.status)}>{task.status}</Badge>
                                  </div>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Due At:</span>{' '}
                                    {new Date(task.dueAt).toLocaleTimeString()}
                                  </div>
                                  <div className="mt-1">{getSLAIndicator(task)}</div>
                                </div>

                                <div className="border rounded-md p-3 space-y-2">
                                  <h4 className="font-semibold text-sm border-b pb-2 mb-2">Completion / Verification</h4>
                                  {task.completionNotes ? (
                                    <div className="text-sm">
                                      <p className="italic">"{task.completionNotes}"</p>
                                      <div className="mt-2 h-32 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs border-dashed border-2 overflow-hidden">
                                        {task.completionProofPath ? (
                                          <img
                                            src={`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/${task.completionProofPath}`}
                                            alt="Completion Proof"
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          'Photo Proof Attached'
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground italic">Not completed yet.</div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* ── Lifecycle actions ─────────────────────── */}
                            <div className="mt-4 flex justify-end gap-2">
                              {task.status === 'Assigned' && (
                                <Button
                                  onClick={async () => {
                                    try {
                                      await api.updateTaskStatus(task._rawId, 'in_progress')
                                      loadTasks()
                                      alert('Task started')
                                    } catch (e: any) {
                                      alert(e.message || 'Failed to start task')
                                    }
                                  }}
                                >
                                  Start Task
                                </Button>
                              )}

                              {task.status === 'In Progress' && (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="file"
                                    id={`proof-${task.id}`}
                                    accept="image/*"
                                    className="text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                    onChange={async e => {
                                      const file = e.target.files?.[0]
                                      if (file) {
                                        try {
                                          await api.uploadCompletionProof(task._rawId, file)
                                          await api.updateTaskStatus(task._rawId, 'completed')
                                          loadTasks()
                                          alert('Task completed and proof uploaded')
                                        } catch (err: any) {
                                          alert(err.message || 'Failed to complete task')
                                        }
                                      }
                                    }}
                                  />
                                  <label htmlFor={`proof-${task.id}`} className="sr-only">
                                    Upload proof to complete task
                                  </label>
                                </div>
                              )}

                              {task.status === 'Verified' && (
                                <Button
                                  onClick={async () => {
                                    try {
                                      await api.updateTaskStatus(task._rawId, 'closed')
                                      loadTasks()
                                      alert('Task closed')
                                    } catch (e: any) {
                                      alert(e.message || 'Failed to close task')
                                    }
                                  }}
                                >
                                  Close Task
                                </Button>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
