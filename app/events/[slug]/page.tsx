import { redirect } from "next/navigation";

export default function EventRedirectPage({ params }: { params: { slug: string } }) {
  redirect(`/resources/${params.slug}`);
}
