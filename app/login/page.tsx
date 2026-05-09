import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <Suspense>
      <AuthCard mode="login" />
    </Suspense>
  );
}
