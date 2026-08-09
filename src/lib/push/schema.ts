export type PushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
  created_at: string;
};

export type StoredPushSubscription = {
  endpoint: string;
  keys: PushSubscriptionKeys;
};
