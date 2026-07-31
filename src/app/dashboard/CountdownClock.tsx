"use client";

import { useEffect, useState } from "react";

/** Live-ticking "Xd Xh Xm remaining" clock, used for both boost expiry and subscription renewal. */
export default function CountdownClock({ until, className }: { until: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(until).getTime();
  const remainingMs = Math.max(0, target - now);

  const dd = Math.floor(remainingMs / 86_400_000);
  const hh = Math.floor((remainingMs % 86_400_000) / 3_600_000);
  const mm = Math.floor((remainingMs % 3_600_000) / 60_000);

  const label = dd > 0 ? `${dd}d ${hh}h ${mm}m` : `${hh}h ${mm}m`;

  return <span className={className}>{remainingMs > 0 ? `${label} remaining` : "Renewing…"}</span>;
}
