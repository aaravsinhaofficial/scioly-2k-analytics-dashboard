import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { getAuthenticatedStudent } from "@/lib/auth";

export default async function ResetPasswordPage() {
  const user = await getAuthenticatedStudent();

  return (
    <Suspense>
      <AuthCard mode={user ? "reset-update" : "reset-request"} />
    </Suspense>
  );
}
