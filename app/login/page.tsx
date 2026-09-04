import { Suspense } from "react";
import { LoginPageContent } from "@/components/login-page-content";

export default function LoginPage() {
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Loading sign in…</p>}
    >
      <LoginPageContent />
    </Suspense>
  );
}
