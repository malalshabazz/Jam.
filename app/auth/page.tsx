"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { emailConfirmationCallback } from "@/lib/auth-callback";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  async function redirectAfterLogin() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) throw userError ?? new Error("Not authenticated");

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_complete, welcome_seen")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!data?.onboarding_complete) {
      router.push("/onboarding");
      return;
    }

    router.push(data.welcome_seen ? "/feed" : "/welcome");
  }

  useEffect(() => {
    const callback = emailConfirmationCallback;
    if (!callback) return;
    const confirmationCallback = callback;

    let cancelled = false;

    async function handleEmailConfirmation() {
      try {
        setConfirmingEmail(true);

        if (confirmationCallback.tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: confirmationCallback.tokenHash,
            type: "email",
          });
          if (verifyError) throw verifyError;
        } else if (confirmationCallback.implicit) {
          // Let the Supabase client finish reading tokens from the URL hash.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        await supabase.auth.signOut({ scope: "local" });

        if (cancelled) return;

        setEmailConfirmed(true);
        setMode("login");
        setSignupSuccess(false);
        router.replace("/auth");
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not confirm your email",
        );
      } finally {
        if (!cancelled) setConfirmingEmail(false);
      }
    }

    handleEmailConfirmation();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSignupSuccess(false);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (signUpError) throw signUpError;
        setSignupSuccess(true);
        setEmail("");
        setPassword("");
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (data.user) await redirectAfterLogin();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSignupSuccess(false);
    setEmailConfirmed(false);
  }

  return (
    <main className="min-h-full flex flex-col items-center justify-center px-4 py-10 bg-[#0a0a0a] text-[#ededed]">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-center mb-1">
          Jam
        </h1>
        <p className="text-sm text-neutral-400 text-center mb-8">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </p>

        {confirmingEmail ? (
          <p className="text-sm text-neutral-400 text-center">
            Confirming your email…
          </p>
        ) : signupSuccess ? (
          <p
            role="status"
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-200 text-center"
          >
            Check your email to confirm your account
          </p>
        ) : (
          <>
            {emailConfirmed && (
              <p
                role="status"
                className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200 text-center mb-4"
              >
                Email confirmed, you can now log in
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={6}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-400 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white text-black py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Please wait…"
                : mode === "login"
                  ? "Log in"
                  : "Sign up"}
            </button>
          </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-neutral-400">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="text-white underline underline-offset-2"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-white underline underline-offset-2"
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
