/**
 * Inline icons: a shared 20px grid, 1.5 stroke, currentColor.
 *
 * Hand-rolled rather than an icon package -- this is nine glyphs, and a
 * dependency would ship hundreds.
 */

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

export const PlusIcon = (p) => (
  <svg {...base} {...p}><path d="M10 4.5v11M4.5 10h11" /></svg>
)

export const SendIcon = (p) => (
  <svg {...base} {...p}><path d="M3.5 10 16 4l-3 12-3.5-4.5L3.5 10Z" /></svg>
)

export const StopIcon = (p) => (
  <svg {...base} {...p}><rect x="5.5" y="5.5" width="9" height="9" rx="1.5" fill="currentColor" stroke="none" /></svg>
)

export const CopyIcon = (p) => (
  <svg {...base} {...p}><rect x="7" y="7" width="9" height="9" rx="2" /><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4H5.5A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" /></svg>
)

export const CheckIcon = (p) => (
  <svg {...base} {...p}><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
)

export const PencilIcon = (p) => (
  <svg {...base} {...p}><path d="M13.5 3.5 16.5 6.5 7 16H4v-3l9.5-9.5Z" /></svg>
)

export const TrashIcon = (p) => (
  <svg {...base} {...p}><path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6M8.5 9v4M11.5 9v4" /></svg>
)

export const MenuIcon = (p) => (
  <svg {...base} {...p}><path d="M3.5 6h13M3.5 10h13M3.5 14h13" /></svg>
)

export const CloseIcon = (p) => (
  <svg {...base} {...p}><path d="m5.5 5.5 9 9M14.5 5.5l-9 9" /></svg>
)

export const ArrowDownIcon = (p) => (
  <svg {...base} {...p}><path d="M10 4v12M5.5 11.5 10 16l4.5-4.5" /></svg>
)

export const SunIcon = (p) => (
  <svg {...base} {...p}><circle cx="10" cy="10" r="3.25" /><path d="M10 2.5v1.75M10 15.75v1.75M17.5 10h-1.75M4.25 10H2.5M15.3 4.7l-1.24 1.24M5.94 14.06 4.7 15.3M15.3 15.3l-1.24-1.24M5.94 5.94 4.7 4.7" /></svg>
)

export const MoonIcon = (p) => (
  <svg {...base} {...p}><path d="M16 11.7A6.5 6.5 0 0 1 8.3 4a6.5 6.5 0 1 0 7.7 7.7Z" /></svg>
)

export const MonitorIcon = (p) => (
  <svg {...base} {...p}><rect x="2.75" y="4" width="14.5" height="9.5" rx="1.5" /><path d="M7 16.5h6" /></svg>
)

export const SparkIcon = (p) => (
  <svg {...base} {...p}><path d="M10 3.25 11.5 8 16.25 9.5 11.5 11 10 15.75 8.5 11 3.75 9.5 8.5 8 10 3.25Z" /></svg>
)
