"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { InstagramIcon } from "@/components/icons/instagram";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type InviteCheck = "none" | "checking" | "valid" | "used" | "expired" | "revoked" | "invalid";

const INVITE_MESSAGES: Record<Exclude<InviteCheck, "none" | "checking" | "valid">, string> = {
  invalid: "This invite link isn't valid.",
  used: "This invite link has already been used.",
  expired: "This invite link has expired. Ask for a new one.",
  revoked: "This invite link was revoked. Ask for a new one.",
};

/** Accepts a bare code or a pasted invite link. */
function extractInviteCode(value: string): string {
  const trimmed = value.trim();
  const match = /[?&]invite=([^&#\s]+)/.exec(trimmed);
  return match ? decodeURIComponent(match[1]) : trimmed;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInstagram, setHasInstagram] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteCheck, setInviteCheck] = useState<InviteCheck>("none");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("invite");
    if (code) setInviteCode(code);
  }, []);

  // Tell people up front whether their link still works
  useEffect(() => {
    const code = extractInviteCode(inviteCode);
    if (!code) {
      setInviteCheck("none");
      return;
    }
    setInviteCheck("checking");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/invites/${encodeURIComponent(code)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: { status?: InviteCheck }) => setInviteCheck(data.status ?? "invalid"))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inviteCode]);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((res) => res.json())
      .then((providers) => {
        if (providers?.instagram) setHasInstagram(true);
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name.trim() || undefined,
          inviteCode: extractInviteCode(inviteCode) || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();

        if (res.status === 409) {
          setError("An account with this email already exists");
        } else {
          setError(data.error || "Registration failed. Please try again.");
        }
        return;
      }

      // Auto-login after successful registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Account created but auto-login failed — redirect to login
        router.push("/login");
      } else {
        router.push("/artists");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-border/50 shadow-2xl shadow-black/25">
      <CardHeader className="pb-2 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Create your account
        </CardTitle>
        <CardDescription>
          Travelink is invite-only. Use the invite link you were sent.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Registration form */}
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="invite">Invite code</Label>
            <Input
              id="invite"
              type="text"
              placeholder="Paste your invite link or code"
              autoComplete="off"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              disabled={isLoading}
              aria-describedby="invite-status"
            />
            <p id="invite-status" className="min-h-4 text-xs" aria-live="polite">
              {inviteCheck === "valid" && (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Invite accepted
                </span>
              )}
              {inviteCheck === "checking" && (
                <span className="text-muted-foreground">Checking invite…</span>
              )}
              {inviteCheck !== "valid" && inviteCheck !== "checking" && inviteCheck !== "none" && (
                <span className="text-destructive">{INVITE_MESSAGES[inviteCheck]}</span>
              )}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">
              Name{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              autoComplete="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create account
          </Button>
        </form>

        {/* Divider + Instagram OAuth — only when provider is available */}
        {hasInstagram && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                or
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-border/60 hover:border-pink-500/40 hover:bg-pink-500/5"
              onClick={() => signIn("instagram", { callbackUrl: "/artists" })}
              disabled={isLoading}
            >
              <InstagramIcon className="h-4 w-4 text-pink-400" />
              Continue with Instagram
            </Button>
          </>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
