'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import {
  AlertCircle,
  BookOpen,
  Brain,
  Calendar,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Repeat,
  Sun,
  User,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/utils';

const titles: Array<{ match: (p: string) => boolean; label: string }> = [
  { match: (p) => p === '/dashboard', label: 'Dashboard' },
  { match: (p) => p === '/practice/matematica', label: 'Prática · Matemática' },
  { match: (p) => p === '/practice/portugues', label: 'Prática · Português' },
  { match: (p) => p.startsWith('/simulado'), label: 'Simulados' },
  { match: (p) => p.startsWith('/redacao'), label: 'Redação' },
  { match: (p) => p.startsWith('/professor-ia'), label: 'Professor IA' },
  { match: (p) => p.startsWith('/plano-estudos'), label: 'Plano de Estudos' },
  { match: (p) => p.startsWith('/revisao'), label: 'Revisão' },
  { match: (p) => p.startsWith('/meus-erros'), label: 'Meus Erros' },
  { match: (p) => p.startsWith('/perfil'), label: 'Perfil' },
];

const mobileNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/practice/matematica', label: 'Matemática', icon: Brain },
  { href: '/practice/portugues', label: 'Português', icon: BookOpen },
  { href: '/simulado', label: 'Simulados', icon: Zap },
  { href: '/redacao', label: 'Redação', icon: FileText },
  { href: '/revisao', label: 'Revisão', icon: Repeat },
  { href: '/meus-erros', label: 'Meus Erros', icon: AlertCircle },
  { href: '/plano-estudos', label: 'Plano de Estudos', icon: Calendar },
  { href: '/professor-ia', label: 'Professor IA', icon: MessageSquare },
  { href: '/perfil', label: 'Perfil', icon: User },
];

export function Header({ user }: { user: any }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const title = titles.find((t) => t.match(pathname))?.label ?? 'FIAP Prep';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-2 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
            className="-ml-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/dashboard" className="md:hidden">
            <Logo showText={false} />
          </Link>

          <h1 className="hidden truncate text-sm font-medium text-muted-foreground md:block">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Alternar tema"
              className="text-muted-foreground"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 pl-1.5 pr-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/12 text-2xs font-semibold text-primary">
                  {user?.name?.[0]?.toUpperCase() ?? 'A'}
                </span>
                <span className="hidden max-w-[8rem] truncate text-xs md:block">
                  {user?.name?.split(' ')[0]}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5">
                <p className="truncate text-xs font-medium">{user?.name}</p>
                <p className="truncate text-2xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/perfil">
                  <User className="mr-2 h-4 w-4" />
                  Meu perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {mobileOpen && (
        <nav className="animate-fade-in border-t border-border bg-card px-3 py-3 md:hidden">
          <div className="space-y-0.5">
            {mobileNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60',
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
