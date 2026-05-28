"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function ordinal(value: number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const mod100 = value % 100;
  const suffix = suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0];
  return `${value}${suffix}`;
}

export default function WelcomePage() {
  const router = useRouter();
  const [memberNumber, setMemberNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWelcome() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_complete, welcome_seen")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        if (!cancelled) {
          setError(profileError.message);
          setLoading(false);
        }
        return;
      }

      if (!profile?.onboarding_complete) {
        router.replace("/onboarding");
        return;
      }

      if (profile.welcome_seen) {
        router.replace("/feed");
        return;
      }

      const { data: signupPosition, error: positionError } = await supabase
        .rpc("get_signup_position", { target_user_id: user.id });

      if (cancelled) return;

      if (positionError) {
        setError(positionError.message);
      } else {
        setMemberNumber(signupPosition ?? 1);
      }

      setLoading(false);
    }

    loadWelcome();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function startJamming() {
    setSaving(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSaving(false);
      router.replace("/auth");
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ welcome_seen: true })
      .eq("id", user.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    router.replace("/feed");
  }

  const numberText = ordinal(memberNumber ?? 1);

  if (loading) {
    return (
      <main className="flex h-[100svh] items-center justify-center bg-[#0a0a0a] px-5 text-white">
        <p className="text-sm text-zinc-400">Getting your welcome ready...</p>
      </main>
    );
  }

  return (
    <main className="flex h-[100svh] flex-col bg-[#0a0a0a] px-5 py-8 text-white">
      <section className="min-h-0 flex-1 overflow-y-auto">
        <p className="text-sm tracking-wide text-zinc-500">
          A quick message,
        </p>

        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight">
          You are the {numberText} person to ever have jam.
        </h1>

        <div className="mt-8 space-y-5 text-base leading-8 text-zinc-300">
          <p>
            This started as an idea from a bedroom. No investors, no
            connections, no starting fan base.
          </p>

          <p>
            You&apos;re joining an empty platform - hopefully because of a passion
            for creativity, and because you have faith that this could change
            the game. And that means a lot.
          </p>

          <p className="rounded-3xl border border-white/10 bg-zinc-950 p-4 font-semibold text-white">
            As a thank you, accept a lifetime of pro features on us.
          </p>

          <p>
            The feed might be empty to begin with. But as long as people like
            you continue to have faith, it will grow before our eyes - and you
            will find what you&apos;re looking for.
          </p>

          <p className="text-xl font-semibold text-white">Welcome to Jam.</p>
        </div>

        {error && <p className="mt-5 text-sm text-red-400">{error}</p>}
      </section>

      <footer className="shrink-0 pb-[env(safe-area-inset-bottom)] pt-5">
        <button
          type="button"
          onClick={startJamming}
          disabled={saving}
          className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Starting..." : "Start Jamming"}
        </button>
      </footer>
    </main>
  );
}
