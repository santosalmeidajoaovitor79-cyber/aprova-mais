import { memo } from "react";

function SubscriptionGateComponent({
  access,
  minimumPlan = "inicial",
  fallback = null,
  children,
}) {
  const allowInitial = access?.isInitial || access?.isPro;
  const allowPro = access?.isPro;
  const isAllowed = minimumPlan === "pro" ? allowPro : allowInitial;

  return isAllowed ? children : fallback;
}

export const SubscriptionGate = memo(SubscriptionGateComponent);
