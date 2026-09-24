import { DashboardShell } from '@/components/shared/DashboardShell';
import RedacaoClient from './RedacaoClient';

export const metadata = { title: 'Redação' };

export default function RedacaoPage() {
  return (
    <DashboardShell>
      <RedacaoClient />
    </DashboardShell>
  );
}
