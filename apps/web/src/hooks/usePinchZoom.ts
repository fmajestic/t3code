import { useEffect, useEffectEvent, type RefObject } from "react";

type PinchPoint = { clientX: number; clientY: number };
// Safari reports a trackpad pinch as gesture events instead of Ctrl+wheel.
type GestureEvent = Event & PinchPoint & { scale: number };

/** A trackpad pinch arrives as many small Ctrl+wheel deltas, a mouse wheel notch as one large one. */
function wheelZoomFactor(deltaY: number) {
  return Math.exp(-Math.max(-50, Math.min(50, deltaY)) / 100);
}

/**
 * Calls `onPinch` with the zoom factor and pointer of each trackpad pinch or Ctrl+wheel step over
 * the element, and keeps the browser from zooming the whole page instead. Electron never zooms the
 * page, so without this a pinch on desktop does nothing.
 */
export function usePinchZoom(
  ref: RefObject<HTMLElement | null>,
  onPinch: (factor: number, at: PinchPoint) => void,
) {
  const pinch = useEffectEvent(onPinch);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- React's onWheel is passive and cannot stop the page zoom, and it has no gesture events.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let gesture: number | null = null;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (gesture !== null || event.deltaY === 0) return;
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? node.clientHeight
            : 1;
      pinch(wheelZoomFactor(event.deltaY * unit), event);
    };
    const start = (event: Event) => {
      event.preventDefault();
      gesture = 1;
    };
    const change = (event: Event) => {
      event.preventDefault();
      const next = event as GestureEvent;
      if (gesture === null || !next.scale) return;
      pinch(next.scale / gesture, next);
      gesture = next.scale;
    };
    const end = (event: Event) => {
      event.preventDefault();
      gesture = null;
    };
    node.addEventListener("wheel", wheel, { passive: false });
    node.addEventListener("gesturestart", start);
    node.addEventListener("gesturechange", change);
    node.addEventListener("gestureend", end);
    return () => {
      node.removeEventListener("wheel", wheel);
      node.removeEventListener("gesturestart", start);
      node.removeEventListener("gesturechange", change);
      node.removeEventListener("gestureend", end);
    };
  }, [ref]);
}
