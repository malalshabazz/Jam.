import type {
  Conversation,
  InboxData,
  InboxMessage,
  InboxRequest,
} from "@/lib/native-social-data";

export function getUnreadInboxCount(inbox: InboxData) {
  return getUnreadLocalInboxCount(
    inbox.requests,
    inbox.conversations,
    inbox.sent,
    inbox.systemMessages,
  );
}

export function getUnreadLocalInboxCount(
  requests: InboxRequest[],
  conversations: Conversation[],
  _sent: Conversation[],
  systemMessages: InboxMessage[],
) {
  // Badge = distinct people with unread messages, plus system as one more "account"
  // when any system message is unread.
  const unreadPeople =
    requests.filter((request) => request.unreadCount > 0).length +
    conversations.filter((conversation) => conversation.unreadCount > 0).length;
  const unreadSystem = systemMessages.some((message) => !message.read) ? 1 : 0;
  return unreadPeople + unreadSystem;
}
