import { UserCircle2, ChevronsUpDown, Check } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AuthService, type AuthUser } from '@/lib/auth'
import { useRoleStore, type Role } from '@/stores/role-store'
import { useNavigate } from '@tanstack/react-router'
import { getDefaultRouteForRole } from '@/config/role-permissions'

const DUMMY_ROLES: { role: Role; label: string; email: string; uid: string; icon: string }[] = [
  { role: 'Manager', label: 'Manager', email: 'manager@smartresort.com', uid: 'dummy-manager-uid', icon: '👑' },
  { role: 'Team Head', label: 'Team Head', email: 'head@smartresort.com', uid: 'dummy-teamhead-uid', icon: '🛡️' },
  { role: 'Staff', label: 'Staff', email: 'staff@smartresort.com', uid: 'dummy-staff-uid', icon: '👷' },
  { role: 'Guest', label: 'Guest', email: 'guest@smartresort.com', uid: 'dummy-guest-uid', icon: '🛎️' },
]

export function TeamSwitcher() {
  const { currentRole, setRole } = useRoleStore()
  const navigate = useNavigate()

  const handleSwitch = (d: typeof DUMMY_ROLES[0]) => {
    const user: AuthUser = {
      uid: d.uid,
      email: d.email,
      displayName: `${d.label} User`,
      role: d.role,
    }
    AuthService.persistSession(user, d.uid)
    setRole(d.role)
    const nextRoute = getDefaultRouteForRole(d.role)
    navigate({ to: nextRoute as any })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer hover:bg-sidebar-accent/50 transition-colors'
            >
              <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
                <UserCircle2 className='size-4' />
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>Smart Resort 360</span>
                <span className='truncate text-xs font-medium text-muted-foreground flex items-center gap-1'>
                  Role: <span className='text-primary font-bold'>{currentRole}</span>
                </span>
              </div>
              <ChevronsUpDown className='ml-auto size-4 shrink-0 opacity-50' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className='w-56 rounded-lg' align='start' side='bottom' sideOffset={4}>
            <DropdownMenuLabel className='text-xs text-muted-foreground font-semibold'>
              Switch Active Role
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {DUMMY_ROLES.map((d) => (
              <DropdownMenuItem
                key={d.role}
                onClick={() => handleSwitch(d)}
                className='flex items-center justify-between cursor-pointer py-2'
              >
                <div className='flex items-center gap-2'>
                  <span>{d.icon}</span>
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium'>{d.label}</span>
                    <span className='text-[11px] text-muted-foreground'>{d.email}</span>
                  </div>
                </div>
                {currentRole === d.role && <Check className='size-4 text-primary ml-2' />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
