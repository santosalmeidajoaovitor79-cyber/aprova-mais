import { useMemo } from "react";
import { buildFeatureAccess } from "../lib/subscriptionPolicy.js";

export function useFeatureAccess(access, usageQuota) {
  return useMemo(() => buildFeatureAccess(access, usageQuota), [access, usageQuota]);
}
