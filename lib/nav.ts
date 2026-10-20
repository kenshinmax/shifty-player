export type NavLink = { href: string; label: string };

/** Nav links inside an organization's pages. */
export function orgNavLinks(slug: string): NavLink[] {
  return [
    { href: `/o/${slug}`, label: "Home" },
    { href: `/o/${slug}/programs`, label: "Programs" },
    { href: `/o/${slug}/clinics`, label: "Clinics" },
  ];
}

/** Nav links on platform pages outside any organization. */
export const PLATFORM_NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
];
