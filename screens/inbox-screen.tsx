import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  enableLiveLocationSharing,
  isLiveLocationSharingEnabled,
} from "@/lib/live-location-sharing";
import { normalizeNearMeRadius } from "@/lib/location-distance";
import {
  deleteMessage,
  editMessage,
  fetchConversationMessages,
  fetchCreatorProfile,
  fetchCreatorVideos,
  fetchInbox,
  fetchNearbyUserIds,
  fetchLookingForUserIds,
  fetchRelationshipState,
  markConversationRead,
  markInboxMessageRead,
  sendJamRequest,
  sendMessage,
  type ChatMessage,
  type Conversation,
  type FeedVideo,
  type InboxMessage,
  type InboxRequest,
  type Profile,
} from "@/lib/native-social-data";
import { getActiveInboxChatUserId, setActiveInboxChatUserId } from "@/lib/active-inbox-chat";
import { locationFilterMatches } from "@/lib/location-filter";
import {
  conversationFromRequest,
} from "@/lib/profile-mappers";
import {
  subscribeJamRelationship,
  withJamRelationship,
} from "@/lib/jam-relationship-sync";
import { getUnreadInboxCount, getUnreadLocalInboxCount } from "@/lib/inbox-unread";
import { confirmNearMeLiveLocationSharing } from "@/lib/near-me-notice";
import type { InboxTab, PreloadedUserProfile, SavedVideoController } from "@/types/app";
import { EMPTY_FILTER_GENRES } from "@/theme/tokens";
import { getActivityIndicatorColor, getChromeIconColor, styles } from "@/theme/styles";
import { Avatar } from "@/components/ui/avatar";
import { GoldBadge, ProBadge } from "@/components/ui/badges";
import { JamSystemAvatar } from "@/components/ui/jam-system-avatar";
import { ChatModal } from "@/components/chat/chat-modal";
import { DmModal } from "@/components/chat/dm-modal";
import { UserProfileModal } from "@/components/profile/user-profile-modal";
import { NearMeIcon } from "@/components/icons/near-me-icon";
import { FeedFilterIcon } from "@/components/icons/feed-filter-icon";
import { FilterSheet } from "@/components/discover/filter-sheet";
import { getTabScreenContentStyle } from "@/components/ui/tab-screen-content-style";

function SegmentedTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {tabs.map((tab) => (
        <Pressable key={tab} style={[styles.segment, active === tab && styles.segmentActive]} onPress={() => onChange(tab)}>
          <Text style={[styles.segmentText, active === tab && styles.segmentTextActive]}>{tab}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ConversationRow({
  conversation,
  onPress,
  onOpenProfile,
  subdued,
}: {
  conversation: Conversation;
  onPress: () => void;
  onOpenProfile: () => void;
  subdued?: boolean;
}) {
  return (
    <Pressable style={[styles.conversationRow, subdued && styles.subdued]} onPress={onPress}>
      <Pressable onPress={onOpenProfile} accessibilityLabel={`open ${conversation.creatorName}'s profile`}>
        <Avatar uri={conversation.avatarUrl} size={52} />
      </Pressable>
      <View style={styles.flex}>
        <View style={styles.row}>
          <Text style={styles.listTitle}>{conversation.creatorName}</Text>
          {conversation.proBadge ? <ProBadge kind={conversation.proBadge} /> : null}
          <Text numberOfLines={1} style={[styles.helper, styles.flex]}>
            {conversation.role} - {conversation.location}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.copy}>{conversation.lastMessage}</Text>
      </View>
      <View style={styles.alignEnd}>
        <Text style={styles.helper}>{conversation.timestamp}</Text>
        {conversation.unread && <View style={styles.unreadDot} />}
      </View>
    </Pressable>
  );
}

function SystemRow({ message, onPress }: { message: InboxMessage; onPress: () => void }) {
  return (
    <Pressable style={styles.conversationRow} onPress={onPress}>
      <JamSystemAvatar size={52} />
      <View style={styles.flex}>
        <View style={styles.row}>
          <Text style={styles.listTitle}>{message.sender_name}</Text>
          <GoldBadge />
        </View>
        <Text numberOfLines={1} style={styles.helper}>{message.body}</Text>
      </View>
      {!message.read && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

function getInboxEmptyCopy({
  tab,
  filtersActive,
  nearMeActive,
}: {
  tab: InboxTab;
  filtersActive: boolean;
  nearMeActive: boolean;
}) {
  if (nearMeActive) {
    if (tab === "requests") return "no nearby requests right now.";
    if (tab === "jams") return "no nearby jams right now.";
    return "no nearby sent jams right now.";
  }
  if (filtersActive) {
    if (tab === "requests") return "no requests match these filters.";
    if (tab === "jams") return "no jams match these filters.";
    return "no sent jams match these filters.";
  }
  if (tab === "requests") return "no requests right now.";
  if (tab === "jams") return "no jams yet. mutual jams will appear here.";
  return "no sent jams waiting right now.";
}

export function InboxScreen({
  userId,
  viewerProfile,
  refreshSignal,
  savedVideoController,
  onUnreadCountChanged,
  onViewerProfileUpdated,
}: {
  userId: string;
  viewerProfile: Profile | null;
  refreshSignal: number;
  savedVideoController: SavedVideoController;
  onUnreadCountChanged: (count: number) => void;
  onViewerProfileUpdated?: (profile: Profile) => void;
}) {
  const [tab, setTab] = useState<InboxTab>("requests");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterLocation, setFilterLocation] = useState("");
  const [lookingForActive, setLookingForActive] = useState(false);
  const [lookingForUserIds, setLookingForUserIds] = useState<Set<string> | null>(null);
  const [lookingForLoading, setLookingForLoading] = useState(false);
  const [nearMeActive, setNearMeActive] = useState(false);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [nearbyUserIds, setNearbyUserIds] = useState<Set<string> | null>(null);
  const [requests, setRequests] = useState<InboxRequest[]>([]);
  const [jams, setJams] = useState<Conversation[]>([]);
  const [sent, setSent] = useState<Conversation[]>([]);
  const [system, setSystem] = useState<InboxMessage[]>([]);
  const [removedInboxUserIds, setRemovedInboxUserIds] = useState<Set<string>>(() => new Set());
  const [activeChat, setActiveChat] = useState<Conversation | InboxMessage | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [preloadedProfile, setPreloadedProfile] = useState<PreloadedUserProfile | null>(null);
  const [activeDm, setActiveDm] = useState<FeedVideo | null>(null);
  const profilePreloadCacheRef = useRef(new Map<string, PreloadedUserProfile>());
  const profileNavigationRequestRef = useRef(0);
  const insets = useSafeAreaInsets();
  const nearMeRadiusMiles = normalizeNearMeRadius(viewerProfile?.near_me_radius_miles);

  const matchesInboxFilters = useCallback(
    (role: string, location: string, otherUserId: string) => {
      const roleMatch =
        filterRoles.length === 0 ||
        filterRoles.some((selectedRole) => selectedRole.toLowerCase() === role.toLowerCase());
      const locationMatch = !filterLocation || locationFilterMatches(location, filterLocation);
      const nearMeMatch = !nearMeActive || (nearbyUserIds?.has(otherUserId) ?? false);
      const lookingForMatch = !lookingForActive || (lookingForUserIds?.has(otherUserId) ?? false);
      return roleMatch && locationMatch && nearMeMatch && lookingForMatch;
    },
    [filterLocation, filterRoles, lookingForActive, lookingForUserIds, nearMeActive, nearbyUserIds],
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter((request) => matchesInboxFilters(request.role, request.location, request.userId)),
    [matchesInboxFilters, requests],
  );
  const filteredJams = useMemo(
    () =>
      jams.filter((conversation) =>
        matchesInboxFilters(conversation.role, conversation.location, conversation.userId),
      ),
    [jams, matchesInboxFilters],
  );
  const filteredSent = useMemo(
    () =>
      sent.filter((conversation) =>
        matchesInboxFilters(conversation.role, conversation.location, conversation.userId),
      ),
    [matchesInboxFilters, sent],
  );
  const filtersActive =
    filterRoles.length > 0 || Boolean(filterLocation) || nearMeActive || lookingForActive;
  const jamTabItems = useMemo(() => {
    const conversationItems = filteredJams.map((conversation) => ({
      type: "conversation" as const,
      id: conversation.id,
      sortAt: conversation.lastActivityAt,
      conversation,
    }));
    // Hide system messages while role/location/near-me filters are on.
    const systemItems = filtersActive
      ? []
      : system.map((message) => ({
          type: "system" as const,
          id: message.id,
          sortAt: message.created_at,
          message,
        }));

    return [...conversationItems, ...systemItems].sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  }, [filteredJams, filtersActive, system]);

  const refreshNearbyUserIds = useCallback(
    async (location: { latitude: number; longitude: number }) => {
      const ids = await fetchNearbyUserIds({
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMiles: nearMeRadiusMiles,
      });
      setNearbyUserIds(ids);
      return ids;
    },
    [nearMeRadiusMiles],
  );

  async function refreshViewerGpsLocation() {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const nextLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    setUserLocation(nextLocation);
    return nextLocation;
  }

  async function toggleNearMe() {
    if (nearMeLoading) return;

    if (nearMeActive) {
      setNearMeActive(false);
      setNearbyUserIds(null);
      return;
    }

    const confirmed = await confirmNearMeLiveLocationSharing(userId);
    if (!confirmed) return;

    setNearMeActive(true);
    setNearMeLoading(true);

    try {
      // Near-me also turns on live location sharing so Settings stays in sync.
      const alreadySharing = await isLiveLocationSharingEnabled(userId);
      if (!alreadySharing) {
        const result = await enableLiveLocationSharing(userId);
        if ("error" in result) {
          setNearMeActive(false);
          Alert.alert("location needed", result.error, [
            { text: "cancel", style: "cancel" },
            { text: "open settings", onPress: () => void Linking.openSettings() },
          ]);
          return;
        }

        onViewerProfileUpdated?.(result.profile);
        let nextLocation: { latitude: number; longitude: number } | null = null;
        if (result.profile.live_latitude != null && result.profile.live_longitude != null) {
          nextLocation = {
            latitude: result.profile.live_latitude,
            longitude: result.profile.live_longitude,
          };
          setUserLocation(nextLocation);
        } else {
          nextLocation = await refreshViewerGpsLocation();
        }
        await refreshNearbyUserIds(nextLocation);
        return;
      }

      const nextLocation = await refreshViewerGpsLocation();
      await refreshNearbyUserIds(nextLocation);
    } catch (err) {
      setNearMeActive(false);
      setNearbyUserIds(null);
      Alert.alert(
        "could not get location",
        err instanceof Error ? err.message : "try again in a moment.",
      );
    } finally {
      setNearMeLoading(false);
    }
  }

  // Refresh nearby IDs when radius changes while near-me is on.
  useEffect(() => {
    if (!nearMeActive || !userLocation || nearMeLoading) return;
    void refreshNearbyUserIds(userLocation).catch(() => undefined);
  }, [nearMeActive, nearMeLoading, nearMeRadiusMiles, refreshNearbyUserIds, userLocation]);

  // Resolve which inbox contacts currently have a looking-for video.
  useEffect(() => {
    if (!lookingForActive) {
      setLookingForUserIds(null);
      setLookingForLoading(false);
      return;
    }

    let cancelled = false;
    const inboxUserIds = Array.from(
      new Set([
        ...requests.map((request) => request.userId),
        ...jams.map((conversation) => conversation.userId),
        ...sent.map((conversation) => conversation.userId),
      ]),
    );

    setLookingForLoading(true);
    void fetchLookingForUserIds(inboxUserIds)
      .then((ids) => {
        if (!cancelled) setLookingForUserIds(ids);
      })
      .catch(() => {
        if (!cancelled) setLookingForUserIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setLookingForLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jams, lookingForActive, requests, sent]);

  useEffect(() => {
    const chatUserId =
      activeChat && !("sender_name" in activeChat)
        ? activeChat.userId
        : activeDm?.userId ?? null;
    setActiveInboxChatUserId(chatUserId);
    return () => {
      if (getActiveInboxChatUserId() === chatUserId) {
        setActiveInboxChatUserId(null);
      }
    };
  }, [activeChat, activeDm]);

  const load = useCallback(async () => {
    const data = await fetchInbox(userId);
    const nextRequests = data.requests.filter((request) => !removedInboxUserIds.has(request.userId));
    const nextJams = data.conversations.filter((conversation) => !removedInboxUserIds.has(conversation.userId));
    const nextSent = data.sent.filter((conversation) => !removedInboxUserIds.has(conversation.userId));
    setRequests(nextRequests);
    setJams(nextJams);
    setSent(nextSent);
    setSystem(data.systemMessages);
    onUnreadCountChanged(getUnreadInboxCount({
      requests: nextRequests,
      conversations: nextJams,
      sent: nextSent,
      systemMessages: data.systemMessages,
    }));
  }, [onUnreadCountChanged, removedInboxUserIds, userId]);

  function removeUserFromInbox(removedUserId: string) {
    const hadUnreadPerson =
      requests.some((request) => request.userId === removedUserId && request.unreadCount > 0) ||
      jams.some((conversation) => conversation.userId === removedUserId && conversation.unreadCount > 0);
    setRemovedInboxUserIds((current) => new Set(current).add(removedUserId));
    setRequests((current) => current.filter((request) => request.userId !== removedUserId));
    setJams((current) => current.filter((conversation) => conversation.userId !== removedUserId));
    setSent((current) => current.filter((conversation) => conversation.userId !== removedUserId));
    setActiveChat((current) =>
      current && !("sender_name" in current) && current.userId === removedUserId ? null : current,
    );
    setActiveDm((current) => (current?.userId === removedUserId ? null : current));
    setProfileUserId(null);
    setPreloadedProfile(null);
    profilePreloadCacheRef.current.delete(removedUserId);
    if (hadUnreadPerson) {
      onUnreadCountChanged(Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - 1));
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [load, refreshSignal]);

  useEffect(() => {
    return subscribeJamRelationship((state) => {
      const cached = profilePreloadCacheRef.current.get(state.userId);
      if (cached) {
        profilePreloadCacheRef.current.set(state.userId, {
          ...cached,
          jammedByMe: state.jammedByMe,
          jammedMe: state.jammedMe,
        });
      }
      setPreloadedProfile((current) =>
        current?.userId === state.userId
          ? {
              ...current,
              jammedByMe: state.jammedByMe,
              jammedMe: state.jammedMe,
            }
          : current,
      );
      setActiveDm((current) =>
        current?.userId === state.userId ? withJamRelationship(current, state) : current,
      );
    });
  }, []);

  async function refreshInbox() {
    setRefreshing(true);
    try {
      await load();
      if (nearMeActive && userLocation) {
        await refreshNearbyUserIds(userLocation);
      }
    } catch (err) {
      Alert.alert("could not refresh inbox", err instanceof Error ? err.message : "try again");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  const preloadProfile = useCallback(async (targetUserId: string) => {
    const cached = profilePreloadCacheRef.current.get(targetUserId);
    if (cached) {
      // Keep cached profile/videos for speed, but always refresh relationship from DB.
      try {
        const relationship = await fetchRelationshipState(userId, targetUserId);
        const nextPreloadedProfile = {
          ...cached,
          jammedByMe: relationship.jammedByMe,
          jammedMe: relationship.jammedMe,
        };
        profilePreloadCacheRef.current.set(targetUserId, nextPreloadedProfile);
        return nextPreloadedProfile;
      } catch {
        return cached;
      }
    }

    const [profile, videos, relationship] = await Promise.all([
      fetchCreatorProfile(userId, targetUserId),
      fetchCreatorVideos(userId, targetUserId),
      fetchRelationshipState(userId, targetUserId),
    ]);
    const nextPreloadedProfile = {
      userId: targetUserId,
      profile,
      videos,
      jammedByMe: relationship.jammedByMe,
      jammedMe: relationship.jammedMe,
    };

    profilePreloadCacheRef.current.set(targetUserId, nextPreloadedProfile);
    return nextPreloadedProfile;
  }, [userId]);

  useEffect(() => {
    if (!activeChat || "sender_name" in activeChat) return;
    void preloadProfile(activeChat.userId).catch(() => undefined);
  }, [activeChat, preloadProfile]);

  async function openProfile(nextUserId: string | null | undefined) {
    try {
      const targetUserId = nextUserId?.trim();
      if (!targetUserId) {
        throw new Error("Profile is unavailable.");
      }

      const requestId = profileNavigationRequestRef.current + 1;
      profileNavigationRequestRef.current = requestId;

      setActiveDm(null);
      setPreloadedProfile(profilePreloadCacheRef.current.get(targetUserId) ?? null);
      setProfileUserId(targetUserId);

      const nextPreloadedProfile = await preloadProfile(targetUserId);
      if (profileNavigationRequestRef.current === requestId) {
        setPreloadedProfile(nextPreloadedProfile);
      }
    } catch (err) {
      Alert.alert("could not open profile", err instanceof Error ? err.message : "try again");
    }
  }

  function openJamFromProfile(profileFeedItem: FeedVideo) {
    setProfileUserId(null);
    setPreloadedProfile(null);
    setActiveDm(profileFeedItem);
  }

  function openRequest(request: InboxRequest) {
    const conversation = conversationFromRequest(request);
    setActiveChat(conversation);
    setRequests((current) =>
      current.map((item) =>
        item.userId === request.userId ? { ...item, unreadCount: 0 } : item,
      ),
    );
    onUnreadCountChanged(
      Math.max(
        0,
        getUnreadLocalInboxCount(requests, jams, sent, system) - (request.unreadCount > 0 ? 1 : 0),
      ),
    );
    void markConversationRead(userId, request.userId).catch(() => undefined);
    void fetchConversationMessages(userId, request.userId)
      .then((page) => {
        setActiveChat((current) => {
          if (!current || "sender_name" in current || current.userId !== request.userId) {
            return current;
          }
          return {
            ...current,
            messages: page.messages.length > 0 ? page.messages : current.messages,
            hasMoreMessages: Boolean(page.nextCursor),
            olderMessagesCursor: page.nextCursor,
          };
        });
      })
      .catch(() => undefined);
  }

  function openConversation(conversation: Conversation) {
    const hadUnreadPerson = jams.some((item) => item.userId === conversation.userId)
      ? conversation.unreadCount > 0
      : false;
    const nextConversation = { ...conversation, unread: false, unreadCount: 0 };
    setActiveChat(nextConversation);
    setJams((current) =>
      current.map((item) =>
        item.userId === conversation.userId ? { ...item, unread: false, unreadCount: 0 } : item,
      ),
    );
    setSent((current) =>
      current.map((item) =>
        item.userId === conversation.userId ? { ...item, unread: false, unreadCount: 0 } : item,
      ),
    );
    onUnreadCountChanged(
      Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - (hadUnreadPerson ? 1 : 0)),
    );
    void markConversationRead(userId, conversation.userId).catch(() => undefined);
    void fetchConversationMessages(userId, conversation.userId)
      .then((page) => {
        setActiveChat((current) => {
          if (!current || "sender_name" in current || current.userId !== conversation.userId) {
            return current;
          }
          return {
            ...current,
            messages: page.messages.length > 0 ? page.messages : current.messages,
            hasMoreMessages: Boolean(page.nextCursor),
            olderMessagesCursor: page.nextCursor,
          };
        });
      })
      .catch(() => undefined);
  }

  async function loadOlderChatMessages(conversation: Conversation) {
    if (!conversation.olderMessagesCursor && !conversation.hasMoreMessages) return;
    const page = await fetchConversationMessages(userId, conversation.userId, {
      cursor: conversation.olderMessagesCursor ?? undefined,
    });
    setActiveChat((current) => {
      if (!current || "sender_name" in current || current.userId !== conversation.userId) {
        return current;
      }
      const existingIds = new Set(current.messages.map((message) => message.id));
      const older = page.messages.filter((message) => !existingIds.has(message.id));
      return {
        ...current,
        messages: [...older, ...current.messages],
        hasMoreMessages: Boolean(page.nextCursor),
        olderMessagesCursor: page.nextCursor,
      };
    });
  }

  function openSystemMessage(message: InboxMessage) {
    const hadUnreadSystem = system.some((item) => !item.read);
    const nextMessage = { ...message, read: true };
    setActiveChat(nextMessage);
    setSystem((current) =>
      current.map((item) => (item.id === message.id ? { ...item, read: true } : item)),
    );
    const stillHasUnreadSystem = system.some(
      (item) => item.id !== message.id && !item.read,
    );
    if (hadUnreadSystem && !stillHasUnreadSystem) {
      onUnreadCountChanged(Math.max(0, getUnreadLocalInboxCount(requests, jams, sent, system) - 1));
    }
    void markInboxMessageRead(message.id).catch(() => undefined);
  }

  return (
    <View style={styles.safeWithNav}>
      <ScrollView
        contentContainerStyle={[
          getTabScreenContentStyle(insets.top),
          // Match discover feedTopBar vertical inset (insets.top + 12).
          { paddingTop: insets.top + 12 },
        ]}
        refreshControl={
          <RefreshControl
            tintColor={getActivityIndicatorColor()}
            refreshing={refreshing}
            onRefresh={refreshInbox}
          />
        }
      >
        <View style={styles.inboxTopBar}>
          <Pressable
            style={[styles.feedNearMeButton, nearMeActive && styles.feedNearMeButtonActive]}
            accessibilityLabel={nearMeActive ? "near me on, sharing live location" : "near me"}
            accessibilityHint="turns on share live location to find creators nearby"
            accessibilityRole="button"
            accessibilityState={{ selected: nearMeActive, busy: nearMeLoading }}
            onPress={() => void toggleNearMe()}
          >
            {nearMeLoading ? (
              <ActivityIndicator color={getActivityIndicatorColor()} size="small" />
            ) : (
              <NearMeIcon active={nearMeActive} color={getChromeIconColor(nearMeActive)} />
            )}
          </Pressable>
          <View style={styles.feedRecentFiltersArea} pointerEvents="none" />
          <Pressable
            onPress={() => setFiltersOpen(true)}
            style={[
              styles.feedFilterButton,
              (filterRoles.length > 0 || Boolean(filterLocation) || lookingForActive) &&
                styles.inboxFilterButtonActive,
            ]}
            accessibilityLabel="filter inbox"
            accessibilityRole="button"
            accessibilityState={{
              selected: filterRoles.length > 0 || Boolean(filterLocation) || lookingForActive,
            }}
          >
            <FeedFilterIcon color={getActivityIndicatorColor()} />
          </Pressable>
        </View>
        <SegmentedTabs tabs={["requests", "jams", "sent"]} active={tab} onChange={(value) => setTab(value as InboxTab)} />
        {loading ||
        (nearMeActive && nearMeLoading && !nearbyUserIds) ||
        (lookingForActive && lookingForLoading && !lookingForUserIds) ? (
          <ActivityIndicator color={getActivityIndicatorColor()} style={styles.loader} />
        ) : tab === "requests" ? (
          <View style={styles.list}>
            {filteredRequests.map((request) => (
              <ConversationRow
                key={request.id}
                conversation={{
                  id: request.id,
                  userId: request.userId,
                  creatorName: request.creatorName,
                  avatarUrl: request.avatarUrl,
                  role: request.role,
                  location: request.location,
                  lastMessage: request.preview,
                  timestamp: request.sentAt,
                  lastActivityAt: request.sentAt,
                  unread: request.unreadCount > 0,
                  unreadCount: request.unreadCount,
                  earlyAdopter: request.earlyAdopter,
                  proBadge: request.proBadge,
                  unlocked: false,
                  messages: [],
                }}
                onPress={() => openRequest(request)}
                onOpenProfile={() => openProfile(request.userId)}
              />
            ))}
            {filteredRequests.length === 0 && (
              <Text style={styles.inboxEmptyText}>
                {getInboxEmptyCopy({
                  tab: "requests",
                  filtersActive: filterRoles.length > 0 || Boolean(filterLocation) || lookingForActive,
                  nearMeActive,
                })}
              </Text>
            )}
          </View>
        ) : tab === "jams" ? (
          <View style={styles.list}>
            {jamTabItems.map((item) =>
              item.type === "conversation" ? (
                <ConversationRow
                  key={item.id}
                  conversation={item.conversation}
                  onPress={() => openConversation(item.conversation)}
                  onOpenProfile={() => openProfile(item.conversation.userId)}
                />
              ) : (
                <SystemRow
                  key={item.id}
                  message={item.message}
                  onPress={() => openSystemMessage(item.message)}
                />
              ),
            )}
            {jamTabItems.length === 0 && (
              <Text style={styles.inboxEmptyText}>
                {getInboxEmptyCopy({
                  tab: "jams",
                  filtersActive: filterRoles.length > 0 || Boolean(filterLocation) || lookingForActive,
                  nearMeActive,
                })}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {filteredSent.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                onPress={() => openConversation(conversation)}
                onOpenProfile={() => openProfile(conversation.userId)}
                subdued
              />
            ))}
            {filteredSent.length === 0 && (
              <Text style={styles.inboxEmptyText}>
                {getInboxEmptyCopy({
                  tab: "sent",
                  filtersActive: filterRoles.length > 0 || Boolean(filterLocation) || lookingForActive,
                  nearMeActive,
                })}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
      <FilterSheet
        visible={filtersOpen}
        selectedRoles={filterRoles}
        selectedGenres={EMPTY_FILTER_GENRES}
        selectedLocation={filterLocation}
        lookingForActive={lookingForActive}
        showLookingFor
        includeGenres={false}
        onClose={() => setFiltersOpen(false)}
        onApply={(nextRoles, _nextGenres, nextLocation, nextLookingFor) => {
          setFilterRoles(nextRoles);
          setFilterLocation(nextLocation);
          setLookingForActive(nextLookingFor);
          setFiltersOpen(false);
        }}
      />
      <ChatModal
        active={activeChat}
        currentUserId={userId}
        savedVideoController={savedVideoController}
        onClose={() => setActiveChat(null)}
        onOpenProfile={openProfile}
        onLoadOlderMessages={loadOlderChatMessages}
        onInboxChanged={() => {
          void load();
        }}
        onSend={async (conversation, body) => {
          const optimisticId = `local-${conversation.userId}-${Date.now()}`;
          const optimisticMessage: ChatMessage = {
            id: optimisticId,
            body,
            incoming: false,
            createdAt: new Date().toISOString(),
          };

          setActiveChat((current) => {
            if (!current || "sender_name" in current || current.userId !== conversation.userId) {
              return current;
            }

            return {
              ...current,
              lastMessage: body,
              timestamp: "now",
              unread: false,
              messages: [...current.messages, optimisticMessage],
            };
          });

          try {
            const savedMessage = conversation.unlocked
              ? await sendMessage(conversation.userId, body)
              : await sendJamRequest(conversation.userId, body);
            const unlocksFromReply = !conversation.unlocked && conversation.messages.some((message) => message.incoming);

            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              return {
                ...current,
                unlocked: current.unlocked || unlocksFromReply,
                lastMessage: savedMessage.body,
                messages: current.messages.map((message) =>
                  message.id === optimisticId
                    ? {
                        id: message.id,
                        serverId: savedMessage.id,
                        body: savedMessage.body,
                        incoming: false,
                        createdAt: savedMessage.created_at,
                      }
                    : message,
                ),
              };
            });

            await load();
            if (unlocksFromReply) setTab("jams");
          } catch (err) {
            setActiveChat((current) => {
              if (!current || "sender_name" in current || current.userId !== conversation.userId) {
                return current;
              }

              const nextMessages = current.messages.filter((message) => message.id !== optimisticId);
              return {
                ...current,
                messages: nextMessages,
                lastMessage: nextMessages.at(-1)?.body ?? conversation.lastMessage,
              };
            });
            Alert.alert("could not send", err instanceof Error ? err.message : "try again");
          }
        }}
        onEditMessage={async (messageId, body) => {
          const updated = await editMessage(messageId, body);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.id === messageId ? { ...message, body: updated.body } : message,
              ),
              lastMessage: current.lastMessage === current.messages.find((message) => message.id === messageId)?.body
                ? updated.body
                : current.lastMessage,
            };
          });
          await load();
        }}
        onDeleteMessage={async (messageId) => {
          await deleteMessage(messageId);
          setActiveChat((current) => {
            if (!current || "sender_name" in current) return current;
            const nextMessages = current.messages.filter((message) => message.id !== messageId);
            return {
              ...current,
              messages: nextMessages,
              lastMessage: nextMessages.at(-1)?.body ?? "",
            };
          });
          await load();
        }}
        profileOverlay={
          activeChat && !("sender_name" in activeChat) && profileUserId ? (
            <UserProfileModal
              currentUserId={userId}
              userId={profileUserId}
              preloadedProfile={preloadedProfile}
              savedVideoController={savedVideoController}
              inline
              onClose={() => {
                setProfileUserId(null);
                setPreloadedProfile(null);
              }}
              onMessage={(profileFeedItem) => {
                openJamFromProfile(profileFeedItem);
              }}
              onInboxChanged={() => {
                void load();
              }}
              onUnjammed={(removedUserId) => {
                removeUserFromInbox(removedUserId);
              }}
              onBlocked={(blockedUserId) => {
                removeUserFromInbox(blockedUserId);
              }}
            />
          ) : null
        }
      />
      <UserProfileModal
        currentUserId={userId}
        userId={activeChat && !("sender_name" in activeChat) ? null : profileUserId}
        preloadedProfile={preloadedProfile}
        savedVideoController={savedVideoController}
        onClose={() => {
          setProfileUserId(null);
          setPreloadedProfile(null);
        }}
        onMessage={(profileFeedItem) => {
          openJamFromProfile(profileFeedItem);
        }}
        onInboxChanged={() => {
          void load();
        }}
        onUnjammed={(removedUserId) => {
          removeUserFromInbox(removedUserId);
        }}
        onBlocked={(blockedUserId) => {
          removeUserFromInbox(blockedUserId);
        }}
      />
      <DmModal
        item={activeDm}
        onClose={() => setActiveDm(null)}
        onOpenProfile={(item) => {
          openProfile(item.userId);
        }}
        onSend={async (body) => {
          if (!activeDm) return;
          await sendJamRequest(activeDm.userId, body, activeDm.id);
          setActiveDm(null);
          await load();
        }}
      />
    </View>
  );
}
