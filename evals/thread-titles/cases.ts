import type { ThreadTitleMessage } from "@t3tools/provider-core/server/threadTitleContext";

const PRIORITY = "priority";
const NICE_TO_HAVE = "nice-to-have / unapproved / proactive";
const MIGRATIONS = "migrations / restructures";
const TOOLING = "tooling";

/** Sidebar sections offered with --sections, from a maintainer's own setup. */
export const evaluationSections = [PRIORITY, "waiting-review", NICE_TO_HAVE, MIGRATIONS, TOOLING];

/** Thread title instructions sent with --sections, as a user would write them to guide filing. */
export const evaluationSectionInstructions = `Sidebar sections:
- priority: work tied to a ticket or issue (a link or an ID such as ABC-123), or investigating a bug.
- nice-to-have / unapproved / proactive: ideas and questions such as "could we", "how hard would it be", or something the project has never had.
- migrations / restructures: framework or dependency migrations and large restructures.
- tooling: developer tooling, scripts, hooks, and CI.
- waiting-review: never for a new thread.`;

export const threadTitleEvaluationCases = [
  {
    id: "referenced-thread-startup",
    source: "Maintainer report of chart thread references overriding a startup question",
    request: "Explain why one example thread failed to start and another needed a retry.",
    previousTitle: "Fix Chart Formatting",
    messages: [
      {
        role: "user",
        text: "[xlsx: chart data labels use the cells' number format](t3-context://v1/thread/thread_labels) why could this thread not start up? [Run chart format tests on external target](t3-context://v1/thread/thread_tests) why did i have to say it like this over here to get it working?",
      },
    ],
    rubric:
      "Name thread startup or prompt/retry behavior. Chart formatting and tests are titles of example threads, not the requested work. Replace the inaccurate previous title.",
  },
  {
    id: "referenced-thread-subject",
    source: "Control for maintainer report of referenced thread titles overriding the request",
    request: "Continue the actual chart formatting work in a referenced thread.",
    previousTitle: "Chart Label Number Formats",
    messages: [
      {
        role: "user",
        text: "Continue [xlsx: chart data labels use the cells' number format](t3-context://v1/thread/thread_labels). Make the chart labels inherit the cells' number formats.",
      },
    ],
    rubric:
      "Name chart label number formatting. Referenced titles can supply the subject when the user explicitly continues that work.",
  },
  {
    id: "linked-reset-credits",
    source: "https://github.com/pingdotgg/t3code/pull/10462",
    request: "Review the reset credit routing change.",
    previousTitle: "Review PR 10462",
    messages: [{ role: "user", text: "Review https://github.com/pingdotgg/t3code/pull/10462" }],
    rubric: "Name reset credit routing. Distinguish it from displaying credit balances.",
  },
  {
    id: "onboarding-merge",
    source: "https://github.com/pingdotgg/t3code/pull/10465",
    request: "Make onboarding one shared wizard across computers, then merge when green.",
    previousTitle: "Finish onboarding PR",
    messages: [
      { role: "user", text: "Make onboarding one shared wizard across computers." },
      {
        role: "assistant",
        text: "The wizard now handles pairing, agent selection, and project import.",
      },
      { role: "user", text: "File a PR and merge it when green." },
    ],
    rubric: "Keep the multi-computer onboarding subject. Do not title it after merging.",
  },
  {
    id: "vague-opening",
    source: "Existing lazy thread feed title scenario",
    request: "A failing test is later identified as a lazy thread feed mismatch.",
    previousTitle: "Fix failing test",
    messages: [
      { role: "user", text: "Fix this failing test." },
      {
        role: "assistant",
        text: "The lazy thread feed test expects a full message body before the client requests it.",
      },
    ],
    rubric: "Name the lazy thread feed test. Do not invent a wider mobile regression.",
  },
  {
    id: "scope-change",
    source: "Title context budget scenario",
    request: "Change the goal from QR layout to pairing expiry, despite long assistant replies.",
    previousTitle: "Improve QR layout",
    messages: [
      { role: "user", text: "Improve QR sharing layout." },
      {
        role: "user",
        text: "Change of plan. Fix pairing token expiry. Keep remote access working.",
      },
      {
        role: "assistant",
        text: "The token expires before redemption. " + "Implementation detail. ".repeat(800),
      },
      { role: "user", text: "Ship it." },
    ],
    rubric: "Name pairing expiry and honor the explicit scope change.",
  },
  {
    id: "review-umbrella",
    source: "Existing subagent monitoring title scenario",
    request: "Review subagent monitoring risks. A Codex roster issue is one finding.",
    previousTitle: "Review subagent monitoring risks",
    messages: [
      { role: "user", text: "Review subagent monitoring risks." },
      {
        role: "assistant",
        text: "One finding is a stale Codex roster. " + "Roster detail. ".repeat(800),
      },
      { role: "user", text: "Fix the findings and babysit CI." },
    ],
    rubric: "Preserve the monitoring review scope. The previous title can stay unchanged.",
  },
  {
    id: "long-opening",
    source: "Title message truncation scenario",
    request: "Investigate Android pairing while preserving the iOS flow.",
    previousTitle: "Inspect logs",
    messages: [
      {
        role: "user",
        text:
          "Investigate Android pairing. " +
          "Connection logs. ".repeat(800) +
          " Preserve the iOS pairing flow.",
      },
    ],
    rubric: "Name Android pairing. Logs are supporting evidence.",
  },
  {
    id: "research",
    source: "Maintainer title generation request",
    request: "How can we improve title generation in T3 Code?",
    previousTitle: "Research title gen improvements",
    messages: [
      { role: "user", text: "How can we improve title gen further in T3 Code?" },
      {
        role: "assistant",
        text: "Prioritize user messages, refine vague titles once, and resolve PR subjects.",
      },
      {
        role: "user",
        text: "Make these changes and file a PR. Babysit until everything is green.",
      },
    ],
    rubric: "Keep title generation as the subject. Do not focus on filing the PR.",
  },
  {
    id: "project-name",
    source: "https://github.com/pingdotgg/t3code/pull/33418",
    request: "Make hyperdrive init create a default config instead of crashing.",
    projectTitle: "Hyperdrive",
    previousTitle: "Hyperdrive Init Missing Config Crash",
    messages: [
      {
        role: "user",
        text: "hyperdrive init crashes when ~/.hyperdrive/config.toml is missing. Make hyperdrive create a default config instead of throwing.",
      },
      {
        role: "assistant",
        text: "Hyperdrive's loadConfig now writes a default config.toml when the file is absent.",
      },
    ],
    rubric: "Name the default config on init. Leave out Hyperdrive, the project name.",
  },
  ...[
    {
      id: "section-speculative-analytics",
      source: "Maintainer thread: cookieless frontend usage analytics",
      text: 'consider how we would add some basic analytics to the frontend. things like "how much is a certain feature used", like reports/exports, or what viewport sizes our users have. no cookie or consent banners. only foss and self-hostable, and we cannot deploy new apps easily.',
      previousTitle: "Frontend Usage Analytics",
      section: [NICE_TO_HAVE],
    },
    {
      id: "section-ticket-bug",
      source: "Section filing scenario: ticket-backed bug",
      text: "ACME-1234: the export button on the reports page throws a 500 when the date range is empty. Fix it.",
      previousTitle: "Fix Empty Range Report Export",
      section: [PRIORITY],
    },
    {
      id: "section-bug-investigation",
      source: "Section filing scenario: bug investigation without a ticket",
      text: "users say the login page hangs after the SSO redirect, only in Safari. find out why.",
      previousTitle: "Safari SSO Login Hang",
      section: [PRIORITY],
    },
    {
      id: "section-how-hard",
      source: "Section filing scenario: effort question",
      text: "how hard would it be to add a dark theme to the admin panel?",
      previousTitle: "Admin Panel Dark Theme",
      section: [NICE_TO_HAVE],
    },
    {
      id: "section-could-we",
      source: "Section filing scenario: proposal",
      text: "could we cache the dashboard queries so the landing page loads faster?",
      previousTitle: "Cache Dashboard Queries",
      section: [NICE_TO_HAVE],
    },
    {
      id: "section-framework-migration",
      source: "Section filing scenario: framework upgrade",
      text: "migrate the backend from Spring Boot 2.7 to 3.3, including the javax to jakarta rename.",
      previousTitle: "Spring Boot 3 Migration",
      section: [MIGRATIONS],
    },
    {
      id: "section-restructure",
      source: "Section filing scenario: package restructure",
      text: "split the shared utils package into per-feature modules, move the files and fix every import.",
      previousTitle: "Split Utils Into Feature Modules",
      section: [MIGRATIONS],
    },
    {
      id: "section-tooling-hook",
      source: "Section filing scenario: developer tooling",
      text: "add a pre-commit hook that runs the formatter and linter on staged files only.",
      previousTitle: "Pre-commit Format and Lint Hook",
      section: [TOOLING],
    },
    {
      id: "section-ticket-review-comments",
      source: "Section filing scenario: review follow-up never files as waiting-review",
      text: "the PR for ACME-88 got review comments, address them.",
      previousTitle: "Address ACME-88 Review Comments",
      section: [PRIORITY],
    },
    {
      id: "section-none-question",
      source: "Control: a quick question fits no section",
      text: "what does this regex accept: ^(?=.*\\d).{8,}$",
      previousTitle: "Password Regex Meaning",
      section: [null],
    },
  ].map(({ text, ...fixture }) => ({
    ...fixture,
    request: text,
    messages: [{ role: "user" as const, text }],
    rubric: "Name the subject of the request.",
  })),
] satisfies ReadonlyArray<{
  id: string;
  source: string;
  request: string;
  projectTitle?: string;
  previousTitle: string;
  messages: ReadonlyArray<ThreadTitleMessage>;
  rubric: string;
  /** Accepted section picks when titled with --sections; null means no section. */
  section?: ReadonlyArray<string | null>;
}>;
