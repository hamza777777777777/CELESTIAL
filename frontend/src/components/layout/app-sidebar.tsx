import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import { useRoleStore } from '@/stores/role-store'
import { isRouteAllowedForRole } from '@/config/role-permissions'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { currentRole } = useRoleStore()

  // Filter navigation groups and items strictly according to the active role (RBAC)
  const filteredNavGroups = sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.url) {
          return isRouteAllowedForRole(currentRole, item.url)
        }
        if (item.items && item.items.length > 0) {
          return item.items.some((sub) => isRouteAllowedForRole(currentRole, sub.url || ''))
        }
        return true
      }),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {filteredNavGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
