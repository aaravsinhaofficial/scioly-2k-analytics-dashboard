import { redirect } from "next/navigation";
import { sciolyEvents } from "@/lib/resource-data";

export function generateStaticParams() {
  return sciolyEvents.map((event) => ({ slug: event.slug }));
}

export default async function EventRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/resources/${slug}`);
}
