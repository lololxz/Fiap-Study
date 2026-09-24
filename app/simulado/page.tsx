import { DashboardShell } from '@/components/shared/DashboardShell';
import SimuladoClient from './SimuladoClient';

export const metadata = { title: 'Simulados' };

export default function SimuladoPage() {
  return (
    <DashboardShell>
      <SimuladoClient />
    </DashboardShell>
  );
}
