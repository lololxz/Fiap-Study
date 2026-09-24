'use client';

import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  Flame,
  Loader2,
  Lock,
  Pencil,
  Repeat,
  Save,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatCard } from '@/components/shared/StatCard';
import { SkeletonCard, SkeletonList } from '@/components/shared/Skeleton';
import { useToast } from '@/components/ui/use-toast';
import { invalidateUserStats, useUserStats } from '@/lib/hooks/use-user-stats';
import { cn } from '@/lib/utils';
import { formatDateTime, formatRelative } from '@/lib/format';

const GOAL_PRESETS = [5, 10, 20, 30, 50];

export default function PerfilClient() {
  const { toast } = useToast();
  const { data, loading, error, refresh } = useUserStats();

  const [dailyGoal, setDailyGoal] = useState(10);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalDirty, setGoalDirty] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (data?.dailyGoal && !goalDirty) setDailyGoal(data.dailyGoal);
  }, [data?.dailyGoal, goalDirty]);

  useEffect(() => {
    if (data?.user?.name) setName(data.user.name);
  }, [data?.user?.name]);

  const saveGoal = async (value: number) => {
    setSavingGoal(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyGoal: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setGoalDirty(false);
      invalidateUserStats();
      await refresh();
      toast({ title: 'Meta atualizada', description: `Agora são ${value} questões por dia.` });
    } catch (e) {
      toast({
        title: 'Não foi possível salvar',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSavingGoal(false);
    }
  };

  const saveName = async () => {
    if (name.trim().length < 2) {
      toast({ title: 'Nome muito curto', variant: 'destructive' });
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setEditingName(false);
      await refresh();
      toast({ title: 'Nome atualizado' });
    } catch (e) {
      toast({
        title: 'Não foi possível salvar',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSavingName(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonList rows={3} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const user = data?.user;
  const level = user?.level ?? 1;
  const xp = user?.xp ?? 0;
  const xpCurrent = user?.xpForCurrentLevel ?? 0;
  const xpNext = user?.xpForNextLevel ?? 0;
  const span = xpNext - xpCurrent;
  const xpProgress = span > 0 ? Math.min(100, Math.max(0, ((xp - xpCurrent) / span) * 100)) : 100;

  const unlocked = (data?.achievements ?? []).filter((a) => a.unlocked);
  const locked = (data?.achievements ?? []).filter((a) => !a.unlocked);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-2xl font-semibold text-primary">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            {editingName ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1 space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  />
                </div>
                <Button size="sm" onClick={saveName} loading={savingName}>
                  {!savingName && <Save className="h-3.5 w-3.5" />}
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingName(false);
                    setName(user?.name ?? '');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight">{user?.name}</h1>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground"
                  aria-label="Editar nome"
                  onClick={() => setEditingName(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                Nível {level} · {user?.levelName}
              </Badge>
              <Badge variant={(user?.streak ?? 0) > 0 ? 'warning' : 'outline'}>
                <Flame className="h-3 w-3" />
                {user?.streak ?? 0} dias
              </Badge>
              <Badge variant="outline">
                <CalendarDays className="h-3 w-3" />
                desde {formatRelative(user?.createdAt)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Números */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Respondidas" value={data?.totalQuestions ?? 0} icon={Target} />
        <StatCard
          label="Precisão"
          value={`${data?.accuracyRate ?? 0}%`}
          hint={`${data?.totalCorrect ?? 0} acertos`}
          tone={(data?.accuracyRate ?? 0) >= 70 ? 'success' : 'default'}
        />
        <StatCard label="XP total" value={xp} icon={Zap} tone="primary" />
        <StatCard
          label="Conquistas"
          value={`${data?.unlockedCount ?? 0}/${data?.totalAchievements ?? 0}`}
          icon={Trophy}
          tone="warning"
        />
      </div>

      {/* Nível */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Progresso de nível</CardTitle>
          <CardDescription>
            {Math.max(0, xpNext - xp)} XP para alcançar o nível {level + 1}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={xpProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Nível {level} · {xp} XP
            </span>
            <span>
              Nível {level + 1} · {xpNext} XP
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Meta diária */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Meta diária</CardTitle>
          <CardDescription>
            Quantas questões você quer responder por dia. Hoje: {data?.todayCount ?? 0}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setDailyGoal(preset);
                  setGoalDirty(true);
                }}
                className={cn(
                  'tabular rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                  dailyGoal === preset
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="w-32 space-y-1.5">
              <Label htmlFor="goal">Personalizada</Label>
              <Input
                id="goal"
                type="number"
                min={1}
                max={200}
                value={dailyGoal}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setDailyGoal(Number.isFinite(value) ? value : 1);
                  setGoalDirty(true);
                }}
              />
            </div>
            <Button
              onClick={() => saveGoal(Math.min(200, Math.max(1, dailyGoal)))}
              loading={savingGoal}
              disabled={!goalDirty}
            >
              {!savingGoal && <Check className="h-4 w-4" />}
              Salvar meta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conquistas */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Conquistas</CardTitle>
            <CardDescription>
              {unlocked.length} de {data?.totalAchievements ?? 0} desbloqueadas
            </CardDescription>
          </div>
          <Trophy className="h-4 w-4 text-warning" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress
            value={
              data?.totalAchievements
                ? (unlocked.length / data.totalAchievements) * 100
                : 0
            }
            className="h-1.5"
          />

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.achievements ?? []).map((achievement) => (
              <div
                key={achievement.id}
                className={cn(
                  'rounded-lg border p-3 transition-colors',
                  achievement.unlocked
                    ? 'border-border bg-card'
                    : 'border-dashed border-border/70 bg-muted/20',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg',
                      achievement.unlocked ? 'bg-warning/12' : 'bg-muted grayscale',
                    )}
                  >
                    {achievement.unlocked ? achievement.icon : <Lock className="h-4 w-4 text-muted-foreground" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm font-medium', !achievement.unlocked && 'text-muted-foreground')}>
                      {achievement.name}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {achievement.description}
                    </p>

                    {achievement.unlocked ? (
                      <p className="mt-1.5 text-2xs font-medium text-success">
                        +{achievement.xpReward} XP
                        {achievement.unlockedAt && ` · ${formatDateTime(achievement.unlockedAt)}`}
                      </p>
                    ) : achievement.progress ? (
                      <div className="mt-2 space-y-1">
                        <Progress value={achievement.progress.pct} className="h-1" />
                        <p className="tabular text-2xs text-muted-foreground">
                          {achievement.progress.current}/{achievement.progress.target}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-2xs text-muted-foreground">
                        {achievement.xpReward} XP ao desbloquear
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revisão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Repeat className="h-4 w-4 text-primary" />
            Revisão espaçada
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Para revisar" value={data?.dueCount ?? 0} tone={data?.dueCount ? 'primary' : 'default'} />
          <StatCard label="Dominadas" value={data?.masteredCount ?? 0} tone="success" />
          <StatCard
            label="Acompanhadas"
            value={(data?.performances ?? []).length}
            hint="Assuntos com histórico"
          />
        </CardContent>
      </Card>
    </div>
  );
}
