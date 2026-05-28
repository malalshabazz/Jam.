"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { creatorRoles, locationSuggestions } from "@/lib/options";
import { supabase } from "@/lib/supabase";

type Step = 1 | 2 | 3 | 4 | 5;
type Direction = "forward" | "back";

const MAX_BIO_LENGTH = 150;
const TOTAL_STEPS = 5;
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState<Direction>("forward");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [creatorTypes, setCreatorTypes] = useState<string[]>([]);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creatorSuggestions = useMemo(() => {
    const q = creatorQuery.trim().toLowerCase();
    return creatorRoles.filter(
      (role) =>
        !creatorTypes.includes(role) && (q.length === 0 || role.includes(q)),
    );
  }, [creatorQuery, creatorTypes]);

  const locationMatches = useMemo(() => {
    const q = locationQuery.trim().toLowerCase();
    if (q.length === 0) return [];
    return locationSuggestions.filter((item) => item.toLowerCase().includes(q));
  }, [locationQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select(
          "display_name, first_name, last_name, bio, creator_types, location, avatar_url, onboarding_complete",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (data?.onboarding_complete) {
        router.replace("/feed");
        return;
      }

      if (data) {
        setFirstName(data.first_name ?? "");
        setLastName(data.last_name ?? "");
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setCreatorTypes(data.creator_types ?? []);
        setLocation(data.location ?? "");
        setLocationQuery(data.location ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function goToStep(nextStep: Step, nextDirection: Direction) {
    setError(null);
    setDirection(nextDirection);
    setStep(nextStep);
  }

  function goBack() {
    if (step === 1) return;
    goToStep((step - 1) as Step, "back");
  }

  function continueStep() {
    setError(null);

    if (step === 1) {
      if (!firstName.trim() || !lastName.trim() || !displayName.trim()) {
        setError("Add your name and display name to continue.");
        return;
      }
      goToStep(2, "forward");
      return;
    }

    if (step === 2) {
      if (creatorTypes.length === 0) {
        setError("Select at least one creator type.");
        return;
      }
      goToStep(3, "forward");
      return;
    }

    if (step === 3) {
      goToStep(4, "forward");
      return;
    }

    if (step === 4) {
      goToStep(5, "forward");
    }
  }

  function skipStep() {
    if (step === 3) {
      setBio("");
      goToStep(4, "forward");
      return;
    }

    if (step === 4) {
      setLocation("");
      setLocationQuery("");
      goToStep(5, "forward");
      return;
    }

    if (step === 5) {
      setAvatarUrl(null);
      finishOnboarding(null);
    }
  }

  function addCreatorType(role: string) {
    if (creatorTypes.includes(role)) return;
    setCreatorTypes((current) => [...current, role]);
    setCreatorQuery("");
  }

  function removeCreatorType(role: string) {
    setCreatorTypes((current) => current.filter((item) => item !== role));
  }

  function selectLocation(nextLocation: string) {
    setLocation(nextLocation);
    setLocationQuery(nextLocation);
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarUrl(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function finishOnboarding(nextAvatarUrl = avatarUrl) {
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

    const { data: savedProfile, error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        display_name: displayName.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim(),
        creator_types: creatorTypes,
        location: location.trim() || null,
        avatar_url: nextAvatarUrl,
        onboarding_complete: true,
        welcome_seen: false,
      })
      .select("early_adopter")
      .single();

    if (profileError) {
      setSaving(false);
      setError(profileError.message);
      return;
    }

    if (savedProfile?.early_adopter) {
      await supabase.rpc("create_early_adopter_welcome");
    }

    router.replace("/welcome");
  }

  const slideTransform = `translateX(-${(step - 1) * 100}%)`;

  if (loading) {
    return (
      <main className="flex h-[100svh] items-center justify-center bg-[#0a0a0a] px-4 text-white">
        <p className="text-sm text-zinc-400">Loading onboarding...</p>
      </main>
    );
  }

  return (
    <main className="h-[100svh] overflow-hidden bg-[#0a0a0a] text-white">
      <div className="flex h-full flex-col">
        <header className="shrink-0 px-4 pb-4 pt-9">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-zinc-900 text-xl text-white disabled:opacity-0"
              aria-label="Go back"
            >
              ←
            </button>
            <p className="text-sm text-zinc-400">
              {step} of {TOTAL_STEPS}
            </p>
            <div className="h-10 w-10" />
          </div>

          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, index) => {
              const item = index + 1;
              return (
                <div
                  key={item}
                  className={[
                    "h-1.5 flex-1 rounded-full transition-colors",
                    item <= step ? "bg-white" : "bg-white/15",
                  ].join(" ")}
                />
              );
            })}
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-hidden">
          <div
            className={[
              "flex h-full transition-transform duration-300 ease-out",
              direction === "forward" ? "motion-safe:duration-300" : "motion-safe:duration-250",
            ].join(" ")}
            style={{ transform: slideTransform }}
          >
            <OnboardingPanel>
              <StepHeading
                title="Your name"
                description="Start with the basics collaborators will see on your profile."
              />
              <div className="space-y-3">
                <Input
                  value={firstName}
                  onChange={setFirstName}
                  placeholder="First name"
                />
                <Input
                  value={lastName}
                  onChange={setLastName}
                  placeholder="Last name"
                />
                <Input
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder='Display name e.g. "Nia P."'
                />
              </div>
            </OnboardingPanel>

            <OnboardingPanel>
              <StepHeading
                title="What type of creator are you?"
                description="Pick one or more roles so people can find you."
              />
              {creatorTypes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {creatorTypes.map((role) => (
                    <Chip
                      key={role}
                      label={role}
                      onRemove={() => removeCreatorType(role)}
                    />
                  ))}
                </div>
              )}
              <Input
                value={creatorQuery}
                onChange={setCreatorQuery}
                placeholder="Search creator type"
              />
              {creatorSuggestions.length > 0 && (
                <SuggestionList>
                  {creatorSuggestions.map((role) => (
                    <SuggestionButton
                      key={role}
                      label={role}
                      onClick={() => addCreatorType(role)}
                      capitalize
                    />
                  ))}
                </SuggestionList>
              )}
            </OnboardingPanel>

            <OnboardingPanel>
              <StepHeading
                title="Short bio"
                description="A quick line about your sound, style, or what you want to make."
              />
              <div>
                <textarea
                  value={bio}
                  maxLength={MAX_BIO_LENGTH}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Write a short bio"
                  rows={6}
                  className="w-full resize-none rounded-2xl border border-white/15 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
                <p className="mt-1 text-right text-xs text-zinc-500">
                  {bio.length}/{MAX_BIO_LENGTH}
                </p>
              </div>
              <SkipButton onClick={skipStep}>Skip bio for now</SkipButton>
            </OnboardingPanel>

            <OnboardingPanel>
              <StepHeading
                title="Where are you?"
                description="Optional, but useful for local collaborators."
              />
              {location && (
                <div>
                  <Chip
                    label={location}
                    onRemove={() => {
                      setLocation("");
                      setLocationQuery("");
                    }}
                  />
                </div>
              )}
              <Input
                value={locationQuery}
                onChange={(value) => {
                  setLocationQuery(value);
                  if (!value.trim()) setLocation("");
                }}
                placeholder="Search city or country"
              />
              {locationMatches.length > 0 && (
                <SuggestionList>
                  {locationMatches.map((item) => (
                    <SuggestionButton
                      key={item}
                      label={item}
                      onClick={() => selectLocation(item)}
                    />
                  ))}
                </SuggestionList>
              )}
              <SkipButton onClick={skipStep}>Skip location for now</SkipButton>
            </OnboardingPanel>

            <OnboardingPanel>
              <StepHeading
                title="Profile photo"
                description="Optional. Add a face, logo, or visual identity."
              />
              <label className="block cursor-pointer rounded-3xl border border-dashed border-white/20 bg-zinc-900/60 px-4 py-8 text-center text-sm text-zinc-300">
                {avatarUrl ? "Change profile photo" : "Upload profile photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="sr-only"
                />
              </label>
              {avatarUrl && (
                <div
                  aria-label="Profile preview"
                  className="h-24 w-24 rounded-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${avatarUrl})` }}
                />
              )}
              <SkipButton onClick={skipStep}>Skip photo for now</SkipButton>
            </OnboardingPanel>
          </div>
        </section>

        <footer className="shrink-0 space-y-3 px-4 pb-6 pt-4">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="button"
            onClick={() => {
              if (step === 5) {
                finishOnboarding();
                return;
              }

              continueStep();
            }}
            disabled={saving}
            className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : step === 5 ? "Start Jamming" : "Continue"}
          </button>
        </footer>
      </div>
    </main>
  );
}

function OnboardingPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full shrink-0 flex-col gap-5 overflow-y-auto px-4 py-4">
      {children}
    </div>
  );
}

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-white/15 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
    />
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-zinc-900 px-3 py-1.5 text-sm capitalize text-zinc-200">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:text-white"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  );
}

function SuggestionList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="max-h-44 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900">
      {children}
    </ul>
  );
}

function SuggestionButton({
  label,
  onClick,
  capitalize,
}: {
  label: string;
  onClick: () => void;
  capitalize?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={[
          "w-full px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-800",
          capitalize ? "capitalize" : "",
        ].join(" ")}
      >
        {label}
      </button>
    </li>
  );
}

function SkipButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-white/15 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300"
    >
      {children}
    </button>
  );
}
