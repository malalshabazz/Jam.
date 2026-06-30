"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GoldBadge } from "@/components/jam/gold-badge";
import { GearIcon } from "@/components/jam/icons";
import { useSwipeBack } from "@/components/jam/use-swipe-back";
import {
  fetchLikedVideos,
  fetchMyVideos,
} from "@/lib/social-data";
import { creatorRoles, locationSuggestions } from "@/lib/options";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  creator_types: string[] | null;
  location: string | null;
  avatar_url: string | null;
  onboarding_complete: boolean | null;
  early_adopter: boolean | null;
};

type ProfileTab = "videos" | "liked";
type ProfileVideo = {
  id: string;
  caption: string | null;
  hashtags?: string[] | null;
  media_url?: string | null;
  mediaUrl?: string | null;
  cloudflare_stream_id?: string | null;
  cloudflareStreamId?: string | null;
  created_at?: string;
  creatorName?: string;
};

const MAX_BIO_LENGTH = 150;
const NAV_BAR_HEIGHT_CLASS = "h-[calc(96px+env(safe-area-inset-bottom))]";
const FEED_VIDEO_HEIGHT_CLASS =
  "h-[calc(100svh-(96px+env(safe-area-inset-bottom)))]";

export function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [creatorTypes, setCreatorTypes] = useState<string[]>([]);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [location, setLocation] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("videos");
  const [settingsMounted, setSettingsMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [myVideos, setMyVideos] = useState<ProfileVideo[]>([]);
  const [likedVideos, setLikedVideos] = useState<ProfileVideo[]>([]);
  const [fullscreenVideo, setFullscreenVideo] = useState<ProfileVideo | null>(null);
  const settingsTimersRef = useRef<number[]>([]);
  const pageSwipeBack = useSwipeBack(() => router.back(), {
    disabled: editing || settingsMounted || Boolean(fullscreenVideo),
  });

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

      const [{ data, error: profileError }, ownVideos, liked] = await Promise.all([
        supabase
        .from("profiles")
        .select(
          "id, display_name, first_name, last_name, bio, creator_types, location, avatar_url, onboarding_complete, early_adopter",
        )
        .eq("id", user.id)
          .maybeSingle(),
        fetchMyVideos(user.id),
        fetchLikedVideos(user.id),
      ]);

      if (cancelled) return;

      if (profileError) {
        setError(profileError.message);
      } else {
        setProfile(data);
        setMyVideos(ownVideos);
        setLikedVideos(liked);
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    return () => {
      settingsTimersRef.current.forEach((id) => window.clearTimeout(id));
      settingsTimersRef.current = [];
    };
  }, []);

  function openEditor() {
    if (!profile) return;

    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
    setCreatorTypes(profile.creator_types ?? []);
    setLocation(profile.location ?? "");
    setLocationQuery(profile.location ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
    setCreatorQuery("");
    setError(null);
    setEditing(true);
  }

  function openSettings() {
    setSettingsMounted(true);
    settingsTimersRef.current.push(
      window.setTimeout(() => setSettingsOpen(true), 0),
    );
  }

  function closeSettings() {
    setSettingsOpen(false);
    settingsTimersRef.current.push(
      window.setTimeout(() => setSettingsMounted(false), 260),
    );
  }

  function editFromSettings() {
    closeSettings();
    openEditor();
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

  async function saveProfile() {
    if (!profile) return;

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

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
        creator_types: creatorTypes,
        location: location.trim() || null,
        avatar_url: avatarUrl,
      })
      .eq("id", user.id)
      .select(
        "id, display_name, first_name, last_name, bio, creator_types, location, avatar_url, onboarding_complete, early_adopter",
      )
      .single();

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setProfile(data);
    setEditing(false);
  }

  async function logOut() {
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/auth");
  }

  const display = profile?.display_name || "Your profile";
  const initials = getInitials(display, profile?.first_name, profile?.last_name);

  return (
    <main
      {...pageSwipeBack}
      className="h-[100svh] overflow-y-auto overscroll-contain bg-[#0a0a0a] px-4 pb-32 pt-8 text-white"
    >
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center justify-between">
          <h1 className="text-4xl font-semibold tracking-tight">jam.</h1>
          <button
            type="button"
            onClick={openSettings}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-950 text-zinc-300"
            aria-label="Open settings"
          >
            <GearIcon className="h-5 w-5" />
          </button>
        </header>

        {loading ? (
          <ProfileSkeleton />
        ) : profile ? (
          <section className="mt-5">
            <div className="flex flex-col items-center text-center">
              <Avatar avatarUrl={profile.avatar_url} initials={initials} size="large" />
              <div className="mt-4 flex items-center justify-center gap-2">
                <h2 className="text-2xl font-semibold">{display}</h2>
                {profile.early_adopter && <GoldBadge />}
              </div>

              {(profile.creator_types?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {profile.creator_types?.map((role) => (
                    <span
                      key={role}
                      className="rounded-full border border-white/10 bg-zinc-900 px-3 py-1 text-xs capitalize text-zinc-300"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              )}

              {profile.location && (
                <p className="mt-3 text-sm text-zinc-400">{profile.location}</p>
              )}

              {profile.bio ? (
                <p className="mt-3 text-sm leading-6 text-zinc-300">{profile.bio}</p>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">No bio yet.</p>
              )}
            </div>

            <button
              type="button"
              onClick={openEditor}
              className="mt-5 w-full rounded-2xl border border-white/15 bg-zinc-900 px-3 py-3 text-sm font-medium"
            >
              Edit profile
            </button>
          </section>
        ) : (
          <section className="mt-5 rounded-3xl border border-white/10 bg-zinc-950 p-4">
            <p className="text-sm text-zinc-400">
              No profile found. Complete onboarding to set up your profile.
            </p>
            <button
              type="button"
              onClick={() => router.push("/onboarding")}
              className="mt-4 w-full rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-black"
            >
              Go to onboarding
            </button>
          </section>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <section className="mt-6">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-zinc-950 p-1">
            {[
              { id: "videos" as const, label: "your videos" },
              { id: "liked" as const, label: "liked videos" },
            ].map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-medium capitalize transition-colors",
                    selected
                      ? "bg-white text-black"
                      : "text-zinc-400 hover:text-white",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "videos" ? (
            myVideos.length > 0 ? (
              <LikedVideosGrid
                videos={myVideos}
                onVideoClick={setFullscreenVideo}
              />
            ) : (
              <EmptySection message="no videos yet" />
            )
          ) : likedVideos.length > 0 ? (
            <LikedVideosGrid videos={likedVideos} privateCopy />
          ) : (
            <EmptySection message="no liked videos yet" privateCopy />
          )}
        </section>
      </div>

      {settingsMounted && (
        <div className="fixed bottom-0 left-1/2 top-0 z-[70] flex w-full max-w-[390px] -translate-x-1/2 justify-end overflow-hidden">
          <button
            type="button"
            className={[
              "absolute inset-0 bg-black/60 transition-opacity duration-300",
              settingsOpen ? "opacity-100" : "opacity-0",
            ].join(" ")}
            aria-label="Close settings"
            onClick={closeSettings}
          />
          <aside
            className={[
              "relative flex h-full w-3/4 max-w-[292px] flex-col border-l border-white/10 bg-zinc-950 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-8 shadow-2xl transition-transform duration-300 ease-out",
              settingsOpen ? "translate-x-0" : "translate-x-full",
            ].join(" ")}
          >
            <div className="border-b border-white/10 pb-5">
              <p className="text-xl font-semibold">{display}</p>
              <p className="mt-1 text-sm capitalize text-zinc-500">
                {(profile?.creator_types ?? []).join(", ") || "Creator"}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <SettingsButton onClick={editFromSettings}>Edit profile</SettingsButton>
              <div className="flex items-center justify-between rounded-2xl px-3 py-3 text-sm text-zinc-200">
                <span>Notifications</span>
                <button
                  type="button"
                  onClick={() => setNotificationsEnabled((current) => !current)}
                  className={[
                    "relative h-5 w-9 rounded-full transition-colors",
                    notificationsEnabled ? "bg-white" : "bg-zinc-800",
                  ].join(" ")}
                  aria-pressed={notificationsEnabled}
                >
                  <span
                    className={[
                      "absolute top-0.5 h-4 w-4 rounded-full transition-transform",
                      notificationsEnabled
                        ? "translate-x-[18px] bg-black"
                        : "translate-x-0.5 bg-zinc-400",
                    ].join(" ")}
                  />
                </button>
              </div>
              <SettingsButton>Privacy</SettingsButton>
              <SettingsButton>Help & feedback</SettingsButton>
            </div>

            <button
              type="button"
              onClick={logOut}
              className="mt-auto rounded-2xl px-3 py-3 text-left text-sm text-red-300/80"
            >
              Log out
            </button>
          </aside>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[70] flex justify-center bg-black/60">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close edit profile"
            onClick={() => setEditing(false)}
          />
          <div className="relative mt-auto max-h-[85svh] w-full max-w-[390px] overflow-y-auto rounded-t-3xl border border-b-0 border-white/15 bg-zinc-950 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-semibold">Edit profile</p>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-sm text-zinc-400"
              >
                cancel
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <Avatar avatarUrl={avatarUrl} initials={initials} />
              <label className="flex-1 cursor-pointer rounded-2xl border border-dashed border-white/20 bg-zinc-900/60 px-4 py-3 text-center text-sm text-zinc-300">
                {avatarUrl ? "Change photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="space-y-4">
              <Input
                value={displayName}
                onChange={setDisplayName}
                placeholder="Display name"
              />

              <div>
                {creatorTypes.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
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
              </div>

              <div>
                <textarea
                  value={bio}
                  maxLength={MAX_BIO_LENGTH}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Bio"
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-white/15 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
                <p className="mt-1 text-right text-xs text-zinc-500">
                  {bio.length}/{MAX_BIO_LENGTH}
                </p>
              </div>

              <div>
                {location && (
                  <div className="mb-2">
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
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </div>
        </div>
      )}

      {fullscreenVideo && (
        <VideoFullscreenViewer
          video={fullscreenVideo}
          onClose={() => setFullscreenVideo(null)}
        />
      )}

    </main>
  );
}

function Avatar({
  avatarUrl,
  initials,
  size = "normal",
}: {
  avatarUrl: string | null | undefined;
  initials: string;
  size?: "normal" | "large";
}) {
  const className =
    size === "large"
      ? "h-24 w-24 text-2xl"
      : "h-14 w-14 text-base";

  if (avatarUrl) {
    return (
      <div
        aria-label="Profile photo"
        className={[className, "rounded-full bg-cover bg-center"].join(" ")}
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
    );
  }

  return (
    <div
      className={[
        className,
        "flex items-center justify-center rounded-full bg-zinc-800 font-semibold",
      ].join(" ")}
    >
      {initials}
    </div>
  );
}

function EmptySection({
  message,
  privateCopy,
}: {
  message: string;
  privateCopy?: boolean;
}) {
  return (
    <div className="mt-4">
      <div className="rounded-3xl border border-dashed border-white/10 bg-zinc-950 px-4 py-8 text-center">
        <p className="text-sm text-zinc-500">{message}</p>
      </div>
      {privateCopy && (
        <p className="mt-2 text-xs text-zinc-500">Only visible to you.</p>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mt-6 animate-pulse">
      <div className="flex flex-col items-center">
        <div className="h-24 w-24 rounded-full bg-white/10" />
        <div className="mt-4 h-7 w-40 rounded-full bg-white/10" />
        <div className="mt-3 flex gap-2">
          <div className="h-6 w-20 rounded-full bg-white/5" />
          <div className="h-6 w-24 rounded-full bg-white/5" />
        </div>
        <div className="mt-4 h-4 w-48 rounded-full bg-white/5" />
        <div className="mt-3 h-4 w-full max-w-xs rounded-full bg-white/5" />
      </div>
      <div className="mt-6 h-12 rounded-2xl bg-white/10" />
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
        <div className="h-10 rounded-xl bg-white/10" />
        <div className="h-10 rounded-xl bg-white/5" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="aspect-square bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function LikedVideosGrid({
  videos,
  privateCopy,
  onVideoClick,
}: {
  videos: ProfileVideo[];
  privateCopy?: boolean;
  onVideoClick?: (video: ProfileVideo) => void;
}) {
  return (
    <div className="mt-4">
      <div className="grid grid-cols-3 gap-1">
        {videos.map((video) => {
          const content = (
            <>
              <div
                className={[
                  "absolute inset-0 bg-gradient-to-b",
                  getVideoGradient(video.id),
                ].join(" ")}
              />
              <p className="relative z-10 line-clamp-2 text-[10px] font-medium leading-tight text-white">
                {video.creatorName ?? video.caption ?? "Video"}
              </p>
            </>
          );

          if (onVideoClick) {
            return (
              <button
                key={video.id}
                type="button"
                onClick={() => onVideoClick(video)}
                className="relative flex aspect-square items-end overflow-hidden p-2 text-left"
                title={video.caption ?? undefined}
              >
                {content}
              </button>
            );
          }

          return (
            <article
              key={video.id}
              className="relative flex aspect-square items-end overflow-hidden p-2"
              title={video.caption ?? undefined}
            >
              {content}
            </article>
          );
        })}
      </div>
      {privateCopy && (
        <p className="mt-2 text-xs text-zinc-500">Only visible to you.</p>
      )}
    </div>
  );
}

function VideoFullscreenViewer({
  video,
  onClose,
}: {
  video: ProfileVideo;
  onClose: () => void;
}) {
  const streamId = video.cloudflareStreamId ?? video.cloudflare_stream_id;
  const mediaUrl = video.mediaUrl ?? video.media_url;
  const swipeBack = useSwipeBack(onClose);

  return (
    <div {...swipeBack} className="fixed inset-0 z-[80] bg-black text-white">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-8 z-10 rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-sm"
      >
        close
      </button>
      <div className="mx-auto flex h-[100svh] w-full max-w-[390px] flex-col bg-black">
        <div className={`relative w-full bg-black ${FEED_VIDEO_HEIGHT_CLASS}`}>
          {streamId ? (
            <iframe
              src={`https://iframe.videodelivery.net/${streamId}?autoplay=true&controls=true&loop=true&muted=false&preload=true`}
              title={video.caption ?? "Video"}
              className="h-full w-full border-0 bg-black"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : mediaUrl ? (
            <video
              src={mediaUrl}
              controls
              autoPlay
              playsInline
              className="h-full w-full bg-black object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
              Video unavailable.
            </div>
          )}
        </div>
        <div
          className={`w-full shrink-0 bg-black ${NAV_BAR_HEIGHT_CLASS}`}
          aria-hidden
        />
      </div>
    </div>
  );
}

function getVideoGradient(id: string) {
  const gradients = [
    "from-zinc-700 to-zinc-900",
    "from-stone-700 to-zinc-900",
    "from-slate-700 to-black",
  ];
  return gradients[id.charCodeAt(0) % gradients.length];
}

function SettingsButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl px-3 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-900"
    >
      {children}
    </button>
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
    <ul className="mt-2 max-h-40 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900">
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

function getInitials(
  displayName: string,
  firstName?: string | null,
  lastName?: string | null,
) {
  if (firstName || lastName) {
    return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  }

  return displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
