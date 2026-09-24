import { DashboardShell } from '@/components/shared/DashboardShell';
import MeusErrosClient from './MeusErrosClient';

export const metadata = { title: 'Meus Erros' };

export default function MeusErrosPage() {
  return (
    <DashboardShell>
      <MeusErrosClient />
    </DashboardShell>
  );
}
