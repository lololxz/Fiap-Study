import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DashboardShell } from '@/components/shared/DashboardShell';
import { DashboardClient } from './DashboardClient';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <DashboardShell>
      <DashboardClient userName={session?.user?.name ?? 'Aluno'} />
    </DashboardShell>
  );
}
