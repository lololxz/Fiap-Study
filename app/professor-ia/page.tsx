import { DashboardShell } from '@/components/shared/DashboardShell';
import ProfessorIAClient from './ProfessorIAClient';

export const metadata = { title: 'Professor IA' };

export default function ProfessorIAPage() {
  return (
    <DashboardShell>
      <ProfessorIAClient />
    </DashboardShell>
  );
}
