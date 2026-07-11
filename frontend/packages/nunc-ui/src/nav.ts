// The one navigation authority for the gate-fronted surfaces. hrefs are
// gate paths (single origin). `spa` marks routes that live inside the
// Formans SPA (RouterLink there); other apps link them all as plain <a>.
export interface ShellNavItem {
  label: string
  href: string
  spa: boolean
}

export const SHELL_NAV: ShellNavItem[] = [
  { label: 'ME', href: '/', spa: true },
  { label: 'World', href: '/world', spa: true },
  { label: 'Timeline', href: '/timeline', spa: true },
  { label: 'Profiles', href: '/profiles', spa: true },
  { label: 'Runs', href: '/runs', spa: true },
  { label: 'FourFive', href: '/fourfive/', spa: false },
  { label: 'Apps', href: '/apps/', spa: false },
]
