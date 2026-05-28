"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoldBadge } from "@/components/jam/gold-badge";
import { useSwipeBack } from "@/components/jam/use-swipe-back";
import {
  fetchInbox,
  likeCreator,
  sendMessage as sendDirectMessage,
  type ChatMessage,
  type Conversation,
  type InboxRequest,
} from "@/lib/social-data";
import { supabase } from "@/lib/supabase";

type Tab = "requests" | "jams" | "sent";
type ActiveChat =
  | { type: "system"; message: InboxMessage }
  | { type: "friend"; friend: Conversation };

type InboxMessage = {
  id: string;
  sender_name: string;
  sender_avatar: string | null;
  body: string;
  created_at: string;
  read: boolean;
};

export function CollabsScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sentConversations, setSentConversations] = useState<Conversation[]>([]);
  const [systemMessages, setSystemMessages] = useState<InboxMessage[]>([]);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [activeRequest, setActiveRequest] = useState<InboxRequest | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [dailyLikesUsed, setDailyLikesUsed] = useState(0);
  const requestSwipeBack = useSwipeBack(() => setActiveRequest(null), {
    disabled: !activeRequest,
  });
  const chatSwipeBack = useSwipeBack(() => setActiveChat(null), {
    disabled: !activeChat,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSystemMessages() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      if (!cancelled) setUserId(user.id);

      const [{ data }, inbox] = await Promise.all([
        supabase
        .from("inbox_messages")
        .select("id, sender_name, sender_avatar, body, created_at, read")
        .eq("recipient_id", user.id)
          .order("created_at", { ascending: false }),
        fetchInbox(user.id),
      ]);

      if (!cancelled) {
        setSystemMessages(data ?? []);
        setRequests(inbox.requests);
        setConversations(inbox.conversations);
        setSentConversations(inbox.sent);
        setAuthLoading(false);
      }
    }

    loadSystemMessages();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function refreshInbox(nextUserId = userId) {
    if (!nextUserId) return;
    const inbox = await fetchInbox(nextUserId);
    setRequests(inbox.requests);
    setConversations(inbox.conversations);
    setSentConversations(inbox.sent);
  }

  function likeBack(request: InboxRequest) {
    if (!userId) return;

    likeCreator(userId, request.userId)
      .then(() => refreshInbox(userId))
      .catch(() => undefined);
    setDailyLikesUsed((current) => current + 1);
    setActiveRequest(null);
    setActiveTab("jams");
  }

  function messageRequest(request: InboxRequest) {
    const existingConversation =
      conversations.find((friend) => friend.userId === request.userId) ??
      sentConversations.find((friend) => friend.userId === request.userId) ??
      conversationFromRequest(request);

    setActiveRequest(null);
    setActiveChat({ type: "friend", friend: existingConversation });
  }

  function sendMessage(friend: Conversation) {
    if (!userId) return;

    const body = draftMessage.trim();
    if (!body) return;

    if (friend.unlocked === false && friend.messages?.some((item) => !item.incoming)) {
      return;
    }

    const message: ChatMessage = {
      id: `${friend.userId}-${Date.now()}`,
      body,
      incoming: false,
      createdAt: new Date().toISOString(),
    };

    sendDirectMessage(friend.userId, body)
      .then(() => refreshInbox(userId))
      .catch(() => undefined);

    const updatedFriend = {
      ...friend,
      lastMessage: body,
      timestamp: "now",
      unread: false,
      messages: [...friend.messages, message],
    };

    if (friend.unlocked) {
      setConversations((current) => [
        updatedFriend,
        ...current.filter((item) => item.userId !== friend.userId),
      ]);
    } else {
      setSentConversations((current) => [
        updatedFriend,
        ...current.filter((item) => item.userId !== friend.userId),
      ]);
    }

    setActiveChat((current) =>
      current?.type === "friend" && current.friend.userId === friend.userId
        ? {
            type: "friend",
            friend: updatedFriend,
          }
        : current,
    );
    setDraftMessage("");
  }

  if (activeRequest) {
    return (
      <main
        {...requestSwipeBack}
        className="flex min-h-screen flex-col bg-[#0a0a0a] px-4 pb-32 pt-8 text-white"
      >
        <header className="flex items-center">
          <button
            type="button"
            onClick={() => setActiveRequest(null)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-zinc-950 text-xl"
            aria-label="Back to requests"
          >
            ←
          </button>
        </header>

        <section className="mt-7 min-h-0 flex-1 overflow-y-auto">
          <div className="text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 text-2xl font-semibold">
              {activeRequest.avatarFallback}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <h1 className="text-2xl font-semibold">{activeRequest.creatorName}</h1>
              {activeRequest.earlyAdopter && <GoldBadge />}
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              {activeRequest.role} - {activeRequest.location}
            </p>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-zinc-300">
              Building ideas in public and looking for people who can add a new
              perspective. Open to serious collaborations and quick sketches.
            </p>
            <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => likeBack(activeRequest)}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black"
              >
                Like / connect
              </button>
              <button
                type="button"
                onClick={() => messageRequest(activeRequest)}
                className="rounded-2xl border border-white/15 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Message
              </button>
            </div>
          </div>

          <div className="mx-auto mt-5 max-w-sm rounded-3xl bg-zinc-900 px-4 py-3">
            <p className="text-sm leading-6 text-zinc-200">
              {activeRequest.preview}
            </p>
          </div>

          <p className="mt-6 rounded-2xl border border-white/10 bg-zinc-950 p-4 text-center text-sm text-zinc-500">
            Videos from this creator will appear here when available.
          </p>
        </section>
        <p className="mt-2 text-center text-xs text-zinc-500">
          {Math.max(0, 10 - dailyLikesUsed)} daily likes left
        </p>

      </main>
    );
  }

  if (activeChat) {
    const isSystem = activeChat.type === "system";
    const name = isSystem
      ? activeChat.message.sender_name
      : activeChat.friend.creatorName;
    const avatar = isSystem
      ? (activeChat.message.sender_avatar ?? "jam.")
      : activeChat.friend.avatarFallback;
    const earlyAdopter = !isSystem && activeChat.friend.earlyAdopter;
    const canSendMessage =
      !isSystem &&
      (activeChat.friend.unlocked !== false ||
        !activeChat.friend.messages?.some((message) => !message.incoming));
    const chatStatus = isSystem
      ? "system message"
      : activeChat.friend.unlocked
        ? "messages unlocked"
        : canSendMessage
          ? "one opener available"
          : "waiting for a jam";
    const thread: ChatMessage[] = isSystem
      ? [
          {
            id: activeChat.message.id,
            body: activeChat.message.body,
            incoming: true,
            createdAt: activeChat.message.created_at,
          },
        ]
      : activeChat.friend.messages
        ? activeChat.friend.messages
      : [
          {
            id: `${activeChat.friend.id}-1`,
            body: activeChat.friend.lastMessage,
            incoming: true,
            createdAt: new Date().toISOString(),
          },
          {
            id: `${activeChat.friend.id}-2`,
            body: "Sounds good. I'm working on something new this week.",
            incoming: false,
            createdAt: new Date().toISOString(),
          },
        ];

    return (
      <main
        {...chatSwipeBack}
        className="flex min-h-screen flex-col bg-[#0a0a0a] px-4 pb-32 pt-8 text-white"
      >
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveChat(null)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-zinc-950 text-xl"
            aria-label="Back to collabs"
          >
            ←
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
            {avatar}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-xl font-semibold">{name}</p>
              {isSystem ? (
                <GoldBadge />
              ) : (
                earlyAdopter && <GoldBadge />
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {chatStatus}
            </p>
          </div>
        </header>

        <section className="mt-6 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {thread.map((message) => (
            <div
              key={message.id}
              className={[
                "max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-6",
                message.incoming
                  ? "self-start bg-zinc-900 text-zinc-100"
                  : "self-end bg-white text-black",
              ].join(" ")}
            >
              {message.body}
            </div>
          ))}
        </section>

        {!isSystem && (
          <form
            className="mt-4 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (activeChat.type === "friend" && canSendMessage) {
                sendMessage(activeChat.friend);
              }
            }}
          >
            <input
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder={
                canSendMessage
                  ? "Message..."
                  : "Waiting for a mutual like"
              }
              disabled={!canSendMessage}
              className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!canSendMessage}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black"
            >
              Send
            </button>
          </form>
        )}

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 pb-32 pt-8 text-white">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-4xl font-semibold tracking-tight">jam.</h1>

        <div className="mt-5 inline-flex rounded-xl border border-white/15 bg-zinc-900 p-1">
          {(["requests", "jams", "sent"] as const).map((tab) => {
            const selected = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={[
                  "rounded-lg px-4 py-1.5 text-sm capitalize",
                  selected ? "bg-zinc-100 text-black" : "text-zinc-300",
                ].join(" ")}
              >
                {tab === "jams" ? "Jams" : tab}
              </button>
            );
          })}
        </div>

        {authLoading ? (
          <MessagesSkeleton />
        ) : activeTab === "requests" && (
          <section className="mt-5 space-y-3">
            {requests.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => setActiveRequest(request)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-950 p-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
                    {request.avatarFallback}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold">{request.creatorName}</p>
                      {request.earlyAdopter && <GoldBadge />}
                    </div>
                    <p className="text-sm text-zinc-400">
                      {request.role} - {request.location}
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">{request.preview}</p>
                  </div>
                  <span className="text-xs text-zinc-500">{request.sentAt}</span>
                </div>
              </button>
            ))}
            {requests.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-500">
                No requests right now.
              </p>
            )}
          </section>
        )}

        {!authLoading && activeTab === "jams" && (
          <section className="mt-5">
            {conversations.map((friend) => (
              <button
                key={friend.id}
                type="button"
                onClick={() => setActiveChat({ type: "friend", friend })}
                className="flex w-full items-center gap-3 border-b border-white/10 py-4 text-left"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
                  {friend.avatarFallback}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold leading-none">{friend.creatorName}</p>
                    {friend.earlyAdopter && <GoldBadge />}
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-400">{friend.lastMessage}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-zinc-500">
                  <span>{friend.timestamp}</span>
                  {friend.unread ? <span className="h-2.5 w-2.5 rounded-full bg-pink-500" /> : null}
                </div>
              </button>
            ))}
            {systemMessages.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => setActiveChat({ type: "system", message })}
                className="flex w-full items-center gap-3 border-b border-white/10 py-4 text-left"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                  {message.sender_avatar ?? "jam."}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold leading-none">
                      {message.sender_name}
                    </p>
                    <GoldBadge />
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-400">
                    {message.body}
                  </p>
                </div>
                {!message.read && (
                  <span className="h-2.5 w-2.5 rounded-full bg-pink-500" />
                )}
              </button>
            ))}
            {conversations.length === 0 && systemMessages.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-500">
                No jams yet. Mutual likes will appear here.
              </p>
            )}
          </section>
        )}

        {!authLoading && activeTab === "sent" && (
          <section className="mt-5 space-y-2">
            {sentConversations.map((sent) => (
              <button
                key={sent.id}
                type="button"
                onClick={() => setActiveChat({ type: "friend", friend: sent })}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/60 px-3 py-3 text-left opacity-80"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                  {sent.avatarFallback}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-200">
                      {sent.creatorName}
                    </p>
                    {sent.earlyAdopter && <GoldBadge />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {sent.lastMessage}
                  </p>
                </div>
                <span className="text-[10px] text-zinc-600">{sent.timestamp}</span>
              </button>
            ))}
            {sentConversations.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-500">
                No sent likes or openers waiting right now.
              </p>
            )}
          </section>
        )}
      </div>

    </main>
  );
}

function conversationFromRequest(request: InboxRequest): Conversation {
  return {
    id: request.userId,
    userId: request.userId,
    creatorName: request.creatorName,
    avatarUrl: request.avatarUrl,
    avatarFallback: request.avatarFallback,
    role: request.role,
    location: request.location,
    lastMessage: "Send one opener or like back to jam.",
    timestamp: "now",
    unread: false,
    earlyAdopter: request.earlyAdopter,
    unlocked: false,
    messages: [],
  };
}

function MessagesSkeleton() {
  return (
    <div className="mt-5 animate-pulse space-y-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-white/10" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-5 w-2/3 rounded-full bg-white/10" />
              <div className="h-3 w-full rounded-full bg-white/5" />
            </div>
            <div className="h-3 w-8 rounded-full bg-white/5" />
          </div>
        ))}
    </div>
  );
}
