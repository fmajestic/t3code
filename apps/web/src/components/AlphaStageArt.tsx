import * as Schema from "effect/Schema";
import { type ReactElement, useId } from "react";

import { useLocalStorage } from "../hooks/useLocalStorage";

// Fork-local: selectable header art for Alpha builds. Palettes are `--stage-<scene>-*` in
// index.css; each scene darkens its top band so the white titlebar text keeps contrast.

// The Dev blueprint is deliberately not offered, so a fork build never passes for a dev one.
export const AlphaStageArtVariant = Schema.Literals(["contour", "ridge", "sunrise", "halftone"]);
export type AlphaStageArtVariant = typeof AlphaStageArtVariant.Type;

export const ALPHA_STAGE_ART_LABELS: Record<AlphaStageArtVariant, string> = {
  contour: "Contour",
  ridge: "Ridge",
  sunrise: "Sunrise",
  halftone: "Halftone",
};

export const DEFAULT_ALPHA_STAGE_ART: AlphaStageArtVariant = "ridge";

export function useAlphaStageArt() {
  return useLocalStorage("t3code:alpha-stage-art", DEFAULT_ALPHA_STAGE_ART, AlphaStageArtVariant);
}

const VIEW_BOX_WIDTH_AND_HEIGHT = "8192 96";

// Origin shift for the send button, chosen so its 96-unit circle frames each scene's focal point.
const BUTTON_ORIGIN_X: Record<AlphaStageArtVariant, number> = {
  contour: 96,
  ridge: 222,
  sunrise: 222,
  halftone: 100,
};

export function AlphaStageArt({
  variant,
  compact = false,
}: {
  variant: AlphaStageArtVariant;
  compact?: boolean;
}) {
  const idPrefix = useId().replaceAll(":", "");
  const Scene = SCENES[variant];
  return (
    <svg
      data-stage-art={variant}
      className="h-full w-full"
      fill="none"
      preserveAspectRatio="xMinYMin slice"
      viewBox={`${compact ? BUTTON_ORIGIN_X[variant] : 0} 0 ${VIEW_BOX_WIDTH_AND_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <Scene id={(name) => `${idPrefix}-stage-${variant}-${name}`} />
    </svg>
  );
}

type SceneProps = { id: (name: string) => string };

function TitlebarScrim({ id, color, opacity }: { id: string; color: string; opacity: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="96" gradientUnits="userSpaceOnUse">
      <stop style={{ stopColor: color }} stopOpacity={opacity} />
      <stop offset="0.45" style={{ stopColor: color }} stopOpacity={opacity * 0.35} />
      <stop offset="0.7" style={{ stopColor: color }} stopOpacity="0" />
    </linearGradient>
  );
}

const round = (value: number) => Number(value.toFixed(1));

const CONTOUR_RINGS = (() => {
  const centers = [
    [170, 46],
    [430, 74],
    [650, 30],
  ] as const;
  let minor = "";
  let major = "";
  centers.forEach(([cx, cy], hill) => {
    for (let ring = 1; ring <= 9; ring++) {
      let d = "";
      for (let step = 0; step <= 64; step++) {
        const t = (step / 64) * Math.PI * 2;
        const radius =
          ring *
          11 *
          (1 + 0.13 * Math.sin(3 * t + hill * 2 + ring * 0.4) + 0.07 * Math.cos(5 * t + ring));
        d += `${step === 0 ? "M" : "L"}${round(cx + Math.cos(t) * radius * 1.45)} ${round(cy + Math.sin(t) * radius * 0.8)}`;
      }
      if (ring % 3 === 0) major += `${d}Z`;
      else minor += `${d}Z`;
    }
  });
  return { minor, major };
})();

function ContourScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <linearGradient
          id={id("base")}
          x1="0"
          y1="0"
          x2="200"
          y2="96"
          gradientUnits="userSpaceOnUse"
          spreadMethod="reflect"
        >
          <stop style={{ stopColor: "var(--stage-contour-top)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--stage-contour-mid)" }} />
          <stop offset="1" style={{ stopColor: "var(--stage-contour-bottom)" }} />
        </linearGradient>
        <TitlebarScrim id={id("scrim")} color="var(--stage-contour-scrim)" opacity={0.55} />
        <pattern id={id("map")} width="768" height="96" patternUnits="userSpaceOnUse">
          <path
            d={CONTOUR_RINGS.minor}
            style={{ stroke: "var(--stage-contour-line)" }}
            strokeOpacity="0.18"
            strokeWidth="0.45"
          />
          <path
            d={CONTOUR_RINGS.major}
            style={{ stroke: "var(--stage-contour-line)" }}
            strokeOpacity="0.42"
            strokeWidth="0.7"
          />
          <path
            d="M167 46h6M170 43v6M427 74h6M430 71v6"
            style={{ stroke: "var(--stage-contour-mark)" }}
            strokeOpacity="0.8"
            strokeWidth="0.6"
            strokeLinecap="round"
          />
          <g
            style={{ fill: "var(--stage-contour-mark)" }}
            fillOpacity="0.75"
            fontFamily="ui-monospace,monospace"
            fontSize="4.2"
          >
            <text x="176" y="43">
              1842
            </text>
            <text x="436" y="71">
              967
            </text>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="96" fill={`url(#${id("base")})`} />
      <rect width="100%" height="96" fill={`url(#${id("map")})`} />
      <rect width="100%" height="96" fill={`url(#${id("scrim")})`} />
    </>
  );
}

function ridgePath(seed: number, base: number, amplitude: number, step: number) {
  let d = `M0 96V${base}`;
  for (let x = 0; x <= 512; x += step) {
    const y =
      base -
      amplitude *
        (0.55 + 0.45 * Math.sin(x * 0.021 + seed)) *
        (0.6 + 0.4 * Math.abs(Math.sin(x * 0.067 + seed * 2)));
    d += `L${x} ${round(y)}`;
  }
  return `${d}L512 ${base}V96Z`;
}

const RIDGES = [ridgePath(1, 56, 24, 8), ridgePath(4, 64, 22, 6), ridgePath(7, 72, 16, 5)] as const;

function RidgeScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="96" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: "var(--stage-ridge-sky-top)" }} />
          <stop offset="0.28" style={{ stopColor: "var(--stage-ridge-sky-mid)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--stage-ridge-sky-low)" }} />
          <stop offset="0.7" style={{ stopColor: "var(--stage-ridge-sky-horizon)" }} />
        </linearGradient>
        <radialGradient
          id={id("sun")}
          cx="0"
          cy="0"
          r="1"
          gradientTransform="translate(270 40) scale(120 60)"
          gradientUnits="userSpaceOnUse"
        >
          <stop style={{ stopColor: "var(--stage-ridge-sun-core)" }} />
          <stop
            offset="0.15"
            style={{ stopColor: "var(--stage-ridge-sun-glow)" }}
            stopOpacity="0.85"
          />
          <stop
            offset="0.5"
            style={{ stopColor: "var(--stage-ridge-sun-haze)" }}
            stopOpacity="0.3"
          />
          <stop offset="1" style={{ stopColor: "var(--stage-ridge-sun-edge)" }} stopOpacity="0" />
        </radialGradient>
        <TitlebarScrim id={id("scrim")} color="var(--stage-ridge-scrim)" opacity={0.55} />
        <pattern id={id("range")} width="512" height="96" patternUnits="userSpaceOnUse">
          <rect width="512" height="96" fill={`url(#${id("sun")})`} />
          <circle cx="270" cy="40" r="10" style={{ fill: "var(--stage-ridge-sun)" }} />
          <path d={RIDGES[0]} style={{ fill: "var(--stage-ridge-far)" }} />
          <path d={RIDGES[1]} style={{ fill: "var(--stage-ridge-mid)" }} />
          <path d={RIDGES[2]} style={{ fill: "var(--stage-ridge-near)" }} />
        </pattern>
      </defs>
      <rect width="100%" height="96" fill={`url(#${id("sky")})`} />
      <rect width="100%" height="96" fill={`url(#${id("range")})`} />
      <rect width="100%" height="96" fill={`url(#${id("scrim")})`} />
    </>
  );
}

const SUNRISE_HORIZON = 50;
const SUNRISE_X = 270;

const SUNRISE_RAYS = (() => {
  let d = "";
  for (let ray = 0; ray < 20; ray++) {
    const start = Math.PI * (ray / 19);
    const end = start + Math.PI / 64;
    d += `M${SUNRISE_X} ${SUNRISE_HORIZON}`;
    for (const angle of [start, end]) {
      d += `L${round(SUNRISE_X - Math.cos(angle) * 420)} ${round(SUNRISE_HORIZON - Math.sin(angle) * 420)}`;
    }
    d += "Z";
  }
  return d;
})();

const SUNRISE_GLINTS = Array.from({ length: 8 }, (_, index) => {
  const width = 56 - index * 6;
  return {
    d: `M${SUNRISE_X - width / 2} ${round(SUNRISE_HORIZON + 3 + index * 2.4)}h${width}`,
    opacity: round(0.75 - index * 0.08),
    dash: `${round(7 - index * 0.6)} ${round(2 + index * 0.7)}`,
  };
});

function SunriseScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="96" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: "var(--stage-sunrise-sky-top)" }} />
          <stop offset="0.26" style={{ stopColor: "var(--stage-sunrise-sky-mid)" }} />
          <stop offset="0.44" style={{ stopColor: "var(--stage-sunrise-sky-low)" }} />
          <stop offset="0.52" style={{ stopColor: "var(--stage-sunrise-sky-horizon)" }} />
          <stop offset="0.521" style={{ stopColor: "var(--stage-sunrise-water-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--stage-sunrise-water-bottom)" }} />
        </linearGradient>
        <radialGradient
          id={id("glow")}
          cx="0"
          cy="0"
          r="1"
          gradientTransform={`translate(${SUNRISE_X} ${SUNRISE_HORIZON}) scale(170 52)`}
          gradientUnits="userSpaceOnUse"
        >
          <stop style={{ stopColor: "var(--stage-sunrise-glow-core)" }} stopOpacity="0.95" />
          <stop offset="0.2" style={{ stopColor: "var(--stage-sunrise-glow)" }} stopOpacity="0.6" />
          <stop
            offset="0.6"
            style={{ stopColor: "var(--stage-sunrise-glow-edge)" }}
            stopOpacity="0.18"
          />
          <stop
            offset="1"
            style={{ stopColor: "var(--stage-sunrise-glow-edge)" }}
            stopOpacity="0"
          />
        </radialGradient>
        <linearGradient
          id={id("rays")}
          x1="0"
          y1={SUNRISE_HORIZON}
          x2="0"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop style={{ stopColor: "var(--stage-sunrise-rays)" }} stopOpacity="0.3" />
          <stop offset="0.85" style={{ stopColor: "var(--stage-sunrise-rays)" }} stopOpacity="0" />
        </linearGradient>
        <clipPath id={id("above-horizon")}>
          <rect width="640" height={SUNRISE_HORIZON} />
        </clipPath>
        <TitlebarScrim id={id("scrim")} color="var(--stage-sunrise-scrim)" opacity={0.5} />
        <pattern id={id("scene")} width="640" height="96" patternUnits="userSpaceOnUse">
          <g clipPath={`url(#${id("above-horizon")})`}>
            <path d={SUNRISE_RAYS} fill={`url(#${id("rays")})`} />
            <rect width="640" height="96" fill={`url(#${id("glow")})`} />
            <circle
              cx={SUNRISE_X}
              cy={SUNRISE_HORIZON + 3}
              r="11"
              style={{ fill: "var(--stage-sunrise-sun)" }}
            />
          </g>
          <path
            d={`M0 ${SUNRISE_HORIZON}H640`}
            style={{ stroke: "var(--stage-sunrise-horizon)" }}
            strokeOpacity="0.75"
            strokeWidth="0.6"
          />
          {SUNRISE_GLINTS.map((glint) => (
            <path
              key={glint.d}
              d={glint.d}
              style={{ stroke: "var(--stage-sunrise-glint)" }}
              strokeOpacity={glint.opacity}
              strokeWidth="0.8"
              strokeDasharray={glint.dash}
            />
          ))}
          <g style={{ fill: "var(--stage-sunrise-star)" }} fillOpacity="0.6">
            <circle cx="70" cy="12" r="0.5" />
            <circle cx="380" cy="9" r="0.55" />
            <circle cx="520" cy="20" r="0.45" />
            <circle cx="600" cy="7" r="0.4" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="96" fill={`url(#${id("sky")})`} />
      <rect width="100%" height="96" fill={`url(#${id("scene")})`} />
      <rect width="100%" height="96" fill={`url(#${id("scrim")})`} />
    </>
  );
}

// One path of circles, so the dot field stays two DOM nodes instead of hundreds.
const HALFTONE_DOTS = (() => {
  let d = "";
  for (let y = 6; y < 104; y += 12) {
    for (let x = ((y - 6) / 12) % 2 === 0 ? 0 : 6; x < 392; x += 12) {
      const level =
        0.5 + 0.5 * Math.sin(x * 0.022 + Math.sin(y * 0.05) * 2) * Math.cos(y * 0.04 - x * 0.005);
      const r = round(0.8 + level * 4.6);
      d += `M${round(x - r)} ${y}a${r} ${r} 0 1 0 ${round(2 * r)} 0a${r} ${r} 0 1 0 ${round(-2 * r)} 0`;
    }
  }
  return d;
})();

function HalftoneScene({ id }: SceneProps) {
  return (
    <>
      <defs>
        <linearGradient
          id={id("paper")}
          x1="0"
          y1="0"
          x2="160"
          y2="96"
          gradientUnits="userSpaceOnUse"
          spreadMethod="reflect"
        >
          <stop style={{ stopColor: "var(--stage-halftone-paper-start)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--stage-halftone-paper-mid)" }} />
          <stop offset="1" style={{ stopColor: "var(--stage-halftone-paper-end)" }} />
        </linearGradient>
        <filter
          id={id("soft")}
          x="-10"
          y="-10"
          width="420"
          height="120"
          filterUnits="userSpaceOnUse"
        >
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
        <TitlebarScrim id={id("scrim")} color="var(--stage-halftone-scrim)" opacity={0.5} />
        <pattern id={id("dots")} width="384" height="96" patternUnits="userSpaceOnUse">
          <g filter={`url(#${id("soft")})`}>
            <path
              d={HALFTONE_DOTS}
              style={{ fill: "var(--stage-halftone-ink-shadow)" }}
              fillOpacity="0.45"
              transform="translate(3 2.5)"
            />
            <path
              d={HALFTONE_DOTS}
              style={{ fill: "var(--stage-halftone-ink)" }}
              fillOpacity="0.5"
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="96" fill={`url(#${id("paper")})`} />
      <rect width="100%" height="96" fill={`url(#${id("dots")})`} />
      <rect width="100%" height="96" fill={`url(#${id("scrim")})`} />
    </>
  );
}

const SCENES: Record<AlphaStageArtVariant, (props: SceneProps) => ReactElement> = {
  contour: ContourScene,
  ridge: RidgeScene,
  sunrise: SunriseScene,
  halftone: HalftoneScene,
};
