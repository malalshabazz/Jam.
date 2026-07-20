let activeInboxChatUserId: string | null = null;

export function setActiveInboxChatUserId(userId: string | null) {
  activeInboxChatUserId = userId;
}

export function getActiveInboxChatUserId() {
  return activeInboxChatUserId;
}
