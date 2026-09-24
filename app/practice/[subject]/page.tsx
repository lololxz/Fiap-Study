import { notFound } from 'next/navigation';
import { DashboardShell } from '@/components/shared/DashboardShell';
import { SUBJECTS } from '@/lib/subjects';
import { PracticeClient } from './PracticeClient';

export function generateStaticParams() {
  return SUBJECTS.map((subject) => ({ subject: subject.id }));
}

export function generateMetadata({ params }: { params: { subject: string } }) {
  const subject = SUBJECTS.find((s) => s.id === params.subject);
  return { title: subject ? `Praticar ${subject.label}` : 'Praticar' };
}

export default function PracticePage({
  params,
  searchParams,
}: {
  params: { subject: string };
  searchParams: { topic?: string };
}) {
  const subject = SUBJECTS.find((s) => s.id === params.subject);
  if (!subject) notFound();

  // Só aceita um tópico que existe nesta matéria.
  const requestedTopic = searchParams.topic;
  const initialTopic = subject.topics.some((t) => t.id === requestedTopic)
    ? requestedTopic
    : undefined;

  return (
    <DashboardShell>
      <PracticeClient subject={subject} initialTopic={initialTopic} />
    </DashboardShell>
  );
}
