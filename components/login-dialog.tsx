"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import { DEMO_ACCOUNTS, getPostLoginPath, type AuthUser } from "@/lib/auth";

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, called instead of the default post-login redirect. */
  onSuccess?: (user: AuthUser) => void;
};

export function LoginDialog({
  open,
  onOpenChange,
  onSuccess,
}: LoginDialogProps) {
  const router = useRouter();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState(DEMO_ACCOUNTS[0].password);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupMarketingOptIn, setSignupMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = (user: AuthUser) => {
    setError(null);
    onOpenChange(false);
    if (onSuccess) {
      onSuccess(user);
      return;
    }
    router.push(getPostLoginPath(user));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await login(email, password);
    if (result.error || !result.user) {
      setError(result.error ?? "Invalid email or password.");
      return;
    }
    finish(result.user);
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await signup({
      name: signupName,
      email: signupEmail,
      password: signupPassword,
      marketingOptIn: signupMarketingOptIn,
    });
    if (result.error || !result.user) {
      setError(result.error ?? "Unable to create account.");
      return;
    }
    finish(result.user);
  };

  const switchMode = (next: "signin" | "signup") => {
    setMode(next);
    setError(null);
  };

  const fillAccount = (accountEmail: string, accountPassword: string) => {
    setEmail(accountEmail);
    setPassword(accountPassword);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {mode === "signup" ? (
          <>
            <DialogHeader>
              <DialogTitle>Create an account</DialogTitle>
              <DialogDescription>
                New here? Create an account to register your players.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={handleSignup}
              className="space-y-4"
              data-testid="login-dialog-signup"
            >
              <div className="space-y-2">
                <Label htmlFor="dialog-signup-name">Full name</Label>
                <Input
                  id="dialog-signup-name"
                  value={signupName}
                  onChange={(event) => setSignupName(event.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog-signup-email">Email</Label>
                <Input
                  id="dialog-signup-email"
                  type="email"
                  value={signupEmail}
                  onChange={(event) => setSignupEmail(event.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog-signup-password">Password</Label>
                <Input
                  id="dialog-signup-password"
                  type="password"
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <label
                htmlFor="dialog-signup-marketing-opt-in"
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <Checkbox
                  id="dialog-signup-marketing-opt-in"
                  checked={signupMarketingOptIn}
                  onCheckedChange={(checked) =>
                    setSignupMarketingOptIn(checked === true)
                  }
                  className="mt-0.5"
                />
                <span>
                  Email me about upcoming camps, clinics and offers. You can
                  unsubscribe anytime.
                </span>
              </label>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => switchMode("signin")}
                >
                  Sign in
                </Button>
              </p>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create account</Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Sign in</DialogTitle>
              <DialogDescription>
                Use a demo account. Parents land on their dashboard; admins open the
                admin dashboard.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fillAccount(account.email, account.password)}
                  >
                    Use {account.role}
                  </Button>
                ))}
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <p className="text-sm text-muted-foreground">
                New to Shifty Player?{" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => switchMode("signup")}
                >
                  Create an account
                </Button>
              </p>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Sign in</Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
