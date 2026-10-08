import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/useTheme'
import ConversationList from './ConversationList'
import { CloseIcon, MonitorIcon, MoonIcon, PlusIcon, SparkIcon, SunIcon } from './icons'

const THEME_LABEL = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' }
const THEME_ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon }

function ThemeToggle() {
  const { theme, cycle } = useTheme()
  const Icon = THEME_ICON[theme]
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={THEME_LABEL[theme]}
      title={`${THEME_LABEL[theme]} — click to change`}
      className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-raised hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Icon />
    </button>
  )
}

export default function Sidebar({
  conversations,
  activeId,
  loading,
  open,
  onClose,
  onNew,
  onSelect,
  onRename,
  onDelete,
}) {
  const { user, logout } = useAuth()
  const initial = (user?.display_name || user?.email || '?').trim().charAt(0).toUpperCase()

  return (
    <>
      {/* Mobile scrim. Hidden from assistive tech; the close button is the real control. */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-[2px] md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Conversations"
        className={`fixed inset-y-0 left-0 z-30 flex w-[264px] flex-col border-r border-line bg-surface transition-transform duration-200 md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Identity: the product needs a name somewhere. */}
        <div className="flex items-center gap-2 px-3 pt-3.5 pb-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-ink">
            <SparkIcon width={15} height={15} />
          </span>
          <h1 className="flex-1 text-[13px] font-semibold tracking-tight text-ink">
            AI Chatbot
          </h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-raised hover:text-ink md:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onNew}
            className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink transition hover:border-line-strong hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <PlusIcon width={15} height={15} />
            New conversation
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            loading={loading}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
          />
        </nav>

        <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] font-semibold text-ink-muted"
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] text-ink" title={user?.email}>
              {user?.display_name || user?.email}
            </p>
            <button
              type="button"
              onClick={logout}
              className="text-[11px] text-ink-muted transition hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Sign out
            </button>
          </div>
          <ThemeToggle />
        </div>
      </aside>
    </>
  )
}
