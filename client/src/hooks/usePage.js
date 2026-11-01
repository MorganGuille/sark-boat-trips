import { useLocation } from 'react-router'

// The page's address as the code compares it: '/dashboard', '/charters', '/'. The router also opens a page
// for '/Dashboard' or '/dashboard/' (a phone may capitalise the address or add a slash), so the case and a
// trailing slash are ignored here; comparing the raw address once greyed out the owner's off-season days.
export const pagePath = (pathname) => (pathname.toLowerCase().replace(/\/+$/, '') || '/')

function usePage() {
    return pagePath(useLocation().pathname)
}

export default usePage
