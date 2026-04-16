import { createId } from "../utils/http.js";
import { readCollection, writeCollection } from "./data-store.js";

export async function trackEvent(event) {
  const analytics = await readCollection("analytics");
  analytics.push({
    id: createId("trk"),
    ts: new Date().toISOString(),
    ...event,
  });

  const trimmed = analytics.slice(-2000);
  await writeCollection("analytics", trimmed);
  return trimmed.length;
}

export async function getAnalyticsSummary() {
  const analytics = await readCollection("analytics");

  const byEvent = analytics.reduce((acc, item) => {
    const key = item.event || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    total: analytics.length,
    byEvent,
    lastEvents: analytics.slice(-20).reverse(),
  };
}
