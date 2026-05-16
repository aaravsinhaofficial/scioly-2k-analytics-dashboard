import { redirect } from "next/navigation";

export function generateStaticParams() {
  return [
    { slug: "thermodynamics" },
    { slug: "designer-genes" },
    { slug: "fossils" },
    { slug: "experimental-design" },
    { slug: "engineering-cad" },
  ];
}

export default async function EventRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/resources/${slug}`);
}
