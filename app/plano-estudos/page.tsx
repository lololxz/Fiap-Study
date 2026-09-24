import { DashboardShell } from '@/components/shared/DashboardShell';
import PlanoEstudosClient from './PlanoEstudosClient';

export const metadata = { title: 'Plano de Estudos' };

export default function PlanoEstudosPage() {
  return (
    <DashboardShell>
      <PlanoEstudosClient />
    </DashboardShell>
  );
}
