import { DashboardShell } from '@/components/shared/DashboardShell';
import PerfilClient from './PerfilClient';

export const metadata = { title: 'Perfil' };

export default function PerfilPage() {
  return (
    <DashboardShell>
      <PerfilClient />
    </DashboardShell>
  );
}
