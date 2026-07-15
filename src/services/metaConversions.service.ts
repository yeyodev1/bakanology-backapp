import crypto from "crypto";

export type MetaBrowserEventName = "PageView" | "AddToCart";
type MetaEventName = MetaBrowserEventName | "Purchase";

interface MetaEventInput {
  eventName: MetaEventName;
  eventId: string;
  sourceUrl: string;
  userData?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    externalId?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
    fbp?: string;
    fbc?: string;
  };
  customData?: Record<string, unknown>;
}

export interface MetaApiResponse {
  events_received: number;
  messages?: string[];
  fbtrace_id?: string;
}

function hash(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? crypto.createHash("sha256").update(normalized).digest("hex") : undefined;
}

export async function sendMetaEvent(input: MetaEventInput): Promise<MetaApiResponse> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN;
  if (!pixelId || !accessToken) throw new Error("Meta Conversions API is not configured");

  const userData = input.userData || {};
  const payload: Record<string, unknown> = {
    data: [{
      event_name: input.eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      event_source_url: input.sourceUrl,
      action_source: "website",
      user_data: {
        em: hash(userData.email) ? [hash(userData.email)] : undefined,
        fn: hash(userData.firstName) ? [hash(userData.firstName)] : undefined,
        ln: hash(userData.lastName) ? [hash(userData.lastName)] : undefined,
        external_id: hash(userData.externalId) ? [hash(userData.externalId)] : undefined,
        client_ip_address: userData.clientIpAddress,
        client_user_agent: userData.clientUserAgent,
        fbp: userData.fbp,
        fbc: userData.fbc,
      },
      custom_data: input.customData,
    }],
  };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  const graphVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${pixelId}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json() as MetaApiResponse & { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message || `Meta API request failed with ${response.status}`);
  return result;
}
