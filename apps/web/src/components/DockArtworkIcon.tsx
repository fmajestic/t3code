import { useEffect, useRef } from "react";

import { useEnvironmentIdentificationMode } from "../hooks/useSettings";
import { useTheme } from "../hooks/useTheme";
import {
  resolveEnvironmentIdentificationPillLabel,
  type SidebarStageBackdropVariant,
  StageBackdropArt,
  useEnvironmentStageLabel,
  useSidebarStageBackdropVariant,
} from "./SidebarStageBackdrop";
import { T3Wordmark } from "./T3Wordmark";

const ICON_SIZE = 512;

/**
 * Fork-local: the macOS app-icon layout (824-unit squircle on a 1024 canvas) filled with the
 * compact stage art, matching the baked assets/majestic icon.
 */
export function composeDockIconSvg(artSvg: string, wordmarkPath: string): string {
  const art = artSvg.replace("<svg ", '<svg x="100" y="100" width="824" height="824" ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
<clipPath id="dock-squircle"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>
<filter id="dock-drop" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="14"/><feOffset dy="12"/><feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="dock-glyph" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="1.2"/><feOffset dy="1"/><feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<linearGradient id="dock-silver" x1="0" y1="37" x2="0" y2="94" gradientUnits="userSpaceOnUse"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#d9d9de"/></linearGradient>
</defs>
<g filter="url(#dock-drop)"><g clip-path="url(#dock-squircle)">${art}</g></g>
<g transform="translate(100 100) scale(6.4375)" filter="url(#dock-glyph)"><path d="${wordmarkPath}" fill="url(#dock-silver)"/></g>
<rect x="100.5" y="100.5" width="823" height="823" rx="185" fill="none" stroke="#fff" stroke-opacity="0.12"/>
</svg>`;
}

// An SVG drawn as an image cannot see the document's custom properties, so inline them.
function inlineCustomProperties(svg: string): string {
  const style = getComputedStyle(document.documentElement);
  return svg.replace(/var\((--[\w-]+)\)/g, (_, name: string) =>
    style.getPropertyValue(name).trim(),
  );
}

async function rasterize(svg: string): Promise<string> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  canvas.getContext("2d")?.drawImage(image, 0, 0, ICON_SIZE, ICON_SIZE);
  return canvas.toDataURL("image/png");
}

/** Mirrors the Alpha stage artwork onto the running Dock tile. */
export function DockArtworkIcon() {
  const mode = useEnvironmentIdentificationMode();
  const isAlpha = resolveEnvironmentIdentificationPillLabel(useEnvironmentStageLabel()) === "Alpha";
  const variant = useSidebarStageBackdropVariant(mode === "artwork" && isAlpha);
  const { theme, resolvedTheme } = useTheme();
  const sourceRef = useRef<HTMLDivElement>(null);
  const setDockIcon = typeof window === "undefined" ? undefined : window.desktopBridge?.setDockIcon;

  useEffect(() => {
    if (!setDockIcon || !isAlpha) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const art = sourceRef.current?.querySelector("[data-stage-art]")?.outerHTML;
      const wordmark = sourceRef.current
        ?.querySelector("[data-dock-wordmark] path")
        ?.getAttribute("d");
      if (!art || !wordmark) {
        void setDockIcon(null);
        return;
      }
      void rasterize(inlineCustomProperties(composeDockIconSvg(art, wordmark)))
        .then((image) => (cancelled ? undefined : setDockIcon(image)))
        .catch((error: unknown) => console.warn("Could not update the Dock icon", error));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Redraw when the rendered art or the theme behind its colors changes.
  }, [isAlpha, setDockIcon, variant, theme, resolvedTheme]);

  if (!setDockIcon || !isAlpha) return null;
  return (
    <div ref={sourceRef} hidden aria-hidden>
      {variant ? <DockArtworkSource variant={variant} /> : null}
    </div>
  );
}

function DockArtworkSource({ variant }: { variant: SidebarStageBackdropVariant }) {
  return (
    <>
      <StageBackdropArt variant={variant} compact />
      <T3Wordmark data-dock-wordmark="" />
    </>
  );
}
