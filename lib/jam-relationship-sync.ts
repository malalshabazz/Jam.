export type JamRelationshipState = {
  userId: string;
  jammedByMe: boolean;
  jammedMe: boolean;
};

export type JamRelationshipListener = (state: JamRelationshipState) => void;

const listeners = new Set<JamRelationshipListener>();

export function subscribeJamRelationship(listener: JamRelationshipListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishJamRelationship(state: JamRelationshipState) {
  for (const listener of listeners) {
    listener(state);
  }
}

export function withJamRelationship<T extends {
  jammedByMe?: boolean;
  jammedMe?: boolean;
  mutual?: boolean;
}>(
  entry: T,
  state: Pick<JamRelationshipState, "jammedByMe" | "jammedMe">,
): T {
  return {
    ...entry,
    jammedByMe: state.jammedByMe,
    jammedMe: state.jammedMe,
    mutual: state.jammedByMe && state.jammedMe,
  };
}
