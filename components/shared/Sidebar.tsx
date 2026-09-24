'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  MessageSquare,
  Calendar,
  AlertCircle,
  Brain,
  Zap,
  Repeat,
  Settings,
} from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { Progress } from '@/components/ui/progress';
import { cn, getLevelName, getXpForLevel } from '@/lib/utils';
import { useUserStats } from '@/lib/hooks/use-user-stats';

const sections = [
  {
    label: 'Visão geral',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Praticar',
    items: [
      { href: '/practice/matematica', label: 'Matemática', icon: Brain },
      { href: '/practice/portugues', label: 'Português', icon: BookOpen },
      { href: '/simulado', label: 'Simulados', icon: Zap },
      { href: '/redacao', label: 'Redação', icon: FileText },
    ],
  },
  {
    label: 'Acompanhar',
    items: [
      { href: '/revisao', label: 'Revisão', icon: Repeat },
      { href: '/meus-erros', label: 'Meus Erros', icon: AlertCircle },
      { href: '/plano-estudos', label: 'Plano de Estudos', icon: Calendar },
      { href: '/professor-ia', label: 'Professor IA', icon: MessageSquare },
    ],
  },
];

export function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const { data } = useUserStats();

  const xp = data?.user?.xp ?? 0;
  const level = data?.user?.level ?? 1;
  const streak = data?.user?.streak ?? 0;
  const xpCurrent = getXpForLevel(level);
  const xpNext = getXpForLevel(level + 1);
  const span = xpNext - xpCurrent;
  const progress = span > 0 ? Math.min(100, Math.max(0, ((xp - xpCurrent) / span) * 100)) : 100;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/dashboard" className="rounded-md">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-2 pb-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href + '/')) ||
                  (item.href.startsWith('/practice') && pathname === item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                      isActive
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isActive ? 'text-primary' : 'text-muted-foreground/80',
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/perfil"
          className="block rounded-lg border border-sidebar-border bg-card p-3 transition-colors hover:border-primary/30"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">
              Nível {level}
              <span className="ml-1 text-muted-foreground">· {getLevelName(level)}</span>
            </span>
            <span className="tabular text-2xs text-muted-foreground">{xp} XP</span>
          </div>
          <Progress value={progress} className="mt-2 h-1" />
          <div className="mt-2 flex items-center justify-between text-2xs text-muted-foreground">
            <span>{Math.max(0, xpNext - xp)} XP para o nível {level + 1}</span>
            {streak > 0 && <span className="tabular font-medium text-warning">{streak}d 🔥</span>}
          </div>
        </Link>

        <div className="mt-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{user?.name ?? 'Aluno'}</p>
            <p className="truncate text-2xs text-muted-foreground">{user?.email}</p>
          </div>
          <Link
            href="/perfil"
            aria-label="Perfil"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
