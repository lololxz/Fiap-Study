import { DashboardShell } from '@/components/shared/DashboardShell';
import { RevisaoClient } from './RevisaoClient';

export const metadata = { title: 'Revisão espaçada' };

export default function RevisaoPage() {
  return (
    <DashboardShell>
      <RevisaoClient />
    </DashboardShell>
  );
}
