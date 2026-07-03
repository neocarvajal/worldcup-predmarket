declare module 'web-push' {
  interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  interface SendResult {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function sendNotification(
    subscription: PushSubscription,
    payload: string,
    options?: { TTL?: number }
  ): Promise<SendResult>;

  export const VapidKeys: {
    createKeys(): { publicKey: string; privateKey: string };
  };
}
