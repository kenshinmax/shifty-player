"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import {
  DEMO_ACCOUNTS,
  resolveLoginRedirect,
  type AuthUser,
} from "@/lib/auth";

export function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const { user, login, signup } = useAuth();

  const [loginEmail, setLoginEmail] = useState(DEMO_ACCOUNTS[0].email);
  const [loginPassword, setLoginPassword] = useState(DEMO_ACCOUNTS[0].password);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);

  const redirectAfterAuth = (authUser: AuthUser) => {
    router.replace(resolveLoginRedirect(authUser, nextPath));
  };

  useEffect(() => {
    if (user) {
      router.replace(resolveLoginRedirect(user, nextPath));
    }
  }, [user, nextPath, router]);

  if (user) {
    return (
      <p className="text-muted-foreground" data-testid="login-redirecting">
        Redirecting…
      </p>
    );
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await login(loginEmail, loginPassword);
    if (result.error || !result.user) {
      setLoginError(result.error ?? "Invalid email or password.");
      return;
    }
    setLoginError(null);
    redirectAfterAuth(result.user);
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await signup({
      name: signupName,
      email: signupEmail,
      password: signupPassword,
    });
    if (result.error || !result.user) {
      setSignupError(result.error ?? "Unable to create account.");
      return;
    }
    setSignupError(null);
    redirectAfterAuth(result.user);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5" data-testid="login-page">
      <header className="space-y-1 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Sign in to register
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in with your parent account, or create one to register your
          child for a program.
        </p>
      </header>

      <div className="flex w-full flex-col items-center gap-4">
        <Card size="xs" className="w-full sm:max-w-[50%]" data-testid="login-form-card">
          <CardHeader className="gap-0.5">
            <CardTitle>Sign in</CardTitle>
            <CardDescription className="text-xs">
              Already have an account? Continue registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="login-page-email">Email</Label>
                <Input
                  id="login-page-email"
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="login-page-password">Password</Label>
                <Input
                  id="login-page-password"
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLoginEmail(account.email);
                      setLoginPassword(account.password);
                      setLoginError(null);
                    }}
                  >
                    Use {account.role}
                  </Button>
                ))}
              </div>

              {loginError ? (
                <p className="text-xs text-destructive" role="alert">
                  {loginError}
                </p>
              ) : null}

              <Button type="submit" size="sm" className="w-full">
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
        <hr className="w-full"/>

        <Card size="xs" className="w-full sm:max-w-[50%]" data-testid="signup-form-card">
          <CardHeader className="gap-0.5">
            <CardTitle>Quick signup</CardTitle>
            <CardDescription className="text-xs">
              New here? Create a parent account in seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="signup-name">Full name</Label>
                <Input
                  id="signup-name"
                  value={signupName}
                  onChange={(event) => setSignupName(event.target.value)}
                  placeholder="Jordan Rivera"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signupEmail}
                  onChange={(event) => setSignupEmail(event.target.value)}
                  placeholder="parent@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                  placeholder="At least 4 characters"
                  autoComplete="new-password"
                />
              </div>

              {signupError ? (
                <p className="text-xs text-destructive" role="alert">
                  {signupError}
                </p>
              ) : null}

              <Button type="submit" size="sm" className="w-full">
                Create account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
