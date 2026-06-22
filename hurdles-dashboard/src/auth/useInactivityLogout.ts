import { useEffect, useRef } from "react";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

export function useInactivityLogout(enabled: boolean, onTimeout: () => void) {
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onTimeoutRef.current(), INACTIVITY_TIMEOUT_MS);
    };
    reset();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
    };
  }, [enabled]);
}
