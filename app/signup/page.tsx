import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function SignupPage() {
  await redirectIfAuthenticated();

  return (
    <Suspense>
      <AuthCard mode="signup" />
    </Suspense>
  );
}
