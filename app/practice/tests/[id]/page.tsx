import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { InteractivePracticeTest } from "@/components/practice/InteractivePracticeTest";
import { getCurrentUser } from "@/lib/data";
import { getPracticeQuestions, getPracticeTestRecord } from "@/lib/practice-data";
import { roleMeets } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface InteractivePracticeTestPageProps {
  params: Promise<{ id: string }>;
}

const getCachedPracticeTestRecord = cache(getPracticeTestRecord);

export async function generateMetadata({ params }: InteractivePracticeTestPageProps): Promise<Metadata> {
  const { id } = await params;
  const testId = Number(id);
  if (!Number.isInteger(testId) || testId <= 0) return { title: "Practice test" };
  const test = await getCachedPracticeTestRecord(testId);
  return test
    ? { title: test.title, description: test.description ?? `Interactive practice for ${test.eventName}.` }
    : { title: "Practice test" };
}

export default async function InteractivePracticeTestPage({ params }: InteractivePracticeTestPageProps) {
  const { id } = await params;
  const testId = Number(id);
  if (!Number.isInteger(testId) || testId <= 0) notFound();
  const [currentUser, test, questions] = await Promise.all([
    getCurrentUser(),
    getCachedPracticeTestRecord(testId),
    getPracticeQuestions(testId),
  ]);
  if (!test) notFound();
  const testOverview = {
    ...test,
    questionCount: questions.length,
    totalPoints: questions.reduce((sum, question) => sum + question.points, 0),
  };

  return (
    <AppShell currentUser={currentUser}>
      <div className="min-w-0 space-y-6">
        <Link href="/practice" className="inline-flex min-h-11 items-center text-sm font-medium text-cyan-300 hover:text-white">← Back to practice library</Link>
        <PageHeader
          label={`${test.eventName} · ${test.format ?? "Practice test"}`}
          title={test.title}
          description="Answer at your own pace. Progress saves automatically; submit once to see multiple-choice results and review free responses against model answers."
          actions={roleMeets(currentUser.role, "officer") ? <Link href={`/admin/library/tests/${test.id}`} className="inline-flex min-h-11 items-center rounded-md border border-court-line px-4 text-sm font-medium text-zinc-600 hover:border-cyan-400 hover:text-white">Edit questions</Link> : undefined}
        />
        <InteractivePracticeTest key={test.id} test={testOverview} />
      </div>
    </AppShell>
  );
}
