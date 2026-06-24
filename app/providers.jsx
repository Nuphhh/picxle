"use client";

// PostHog product analytics — privacy-first, and only active when an API key is
// configured (NEXT_PUBLIC_POSTHOG_KEY). Until then this is a transparent
// pass-through, so local dev and the app work with analytics fully off.
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { getPlayerId, getPlatform } from "@/lib/analytics";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// EU cloud by default (keeps data in the EU). Override per env if you use US.
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

// Initialise once on the client. Deliberately conservative settings:
//  - no session recording (never record the screen)
//  - no autocapture (so the text players type is never hoovered up automatically)
//  - localStorage only (no tracking cookies)
//  - honour the browser's Do-Not-Track signal
//  - person_profiles "always" so anonymous players still count toward retention
if (typeof window !== "undefined" && KEY && !posthog.__loaded) {
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: "always",
    capture_pageview: false, // sent manually below (App Router needs this)
    capture_pageleave: true, // needed to see drop-off / where people leave
    autocapture: false,
    disable_session_recording: true,
    persistence: "localStorage",
    respect_dnt: true,
  });
  // Tag every event with where it ran (android-app / ios-app / web) so funnels
  // and retention can be filtered to real app users vs the website.
  posthog.register({ platform: getPlatform() });
  const pid = getPlayerId();
  if (pid) posthog.identify(pid); // tie the PostHog person to our anonymous id
  try {
    if (localStorage.getItem("picxle-analytics-optout") === "1") posthog.opt_out_capturing();
  } catch {}
}

// App Router doesn't auto-fire pageviews, so do it on every route change.
function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (!KEY || !posthog.__loaded) return;
    let url = window.location.origin + pathname;
    const qs = search?.toString();
    if (qs) url += "?" + qs;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, search]);
  return null;
}

export default function Providers({ children }) {
  if (!KEY) return children; // analytics off until a key is set
  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
