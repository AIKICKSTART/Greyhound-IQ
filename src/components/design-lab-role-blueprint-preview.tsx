import Link from "next/link";

import {
  DESIGN_LAB_ROLES,
  type DesignLabRole,
} from "./design-lab-role-blueprints";
import {
  PROTOTYPE_TEMPLATE_COMPOSITIONS,
  PROTOTYPE_VARIANTS,
  type PrototypeVariant,
} from "./prototype-variants";
import styles from "./design-lab-role-blueprint-preview.module.css";

type SignalTone = "positive" | "attention" | "neutral";

type RolePreviewContent = {
  kicker: string;
  headline: string;
  summary: string;
  primarySignal: string;
  metrics: readonly {
    label: string;
    value: string;
    detail: string;
  }[];
  focusTitle: string;
  focusDetail: string;
  focus: readonly {
    label: string;
    detail: string;
    value: string;
    tone: SignalTone;
  }[];
  queueTitle: string;
  queue: readonly {
    label: string;
    meta: string;
  }[];
  activityTitle: string;
  activity: readonly {
    source: string;
    time: string;
    body: string;
  }[];
};

const ROLE_PREVIEW_CONTENT = {
  business: {
    kicker: "Racing operations command",
    headline: "One morning brief for the whole operation.",
    summary:
      "Commercial activity, team coverage and racing performance are aligned before the first nomination closes.",
    primarySignal: "Operation health · 92%",
    metrics: [
      { label: "Dogs in program", value: "12", detail: "4 racing this week" },
      { label: "Staff coverage", value: "8 / 9", detail: "One handover gap" },
      { label: "30-day revenue", value: "$42.8k", detail: "+11.4% on prior" },
    ],
    focusTitle: "Operations pulse",
    focusDetail: "Today across kennel, owners and commercial work",
    focus: [
      {
        label: "Race nominations",
        detail: "Two venues · closes 3:00pm",
        value: "4 ready",
        tone: "positive",
      },
      {
        label: "Team coverage",
        detail: "Kennel handover · 5:30pm",
        value: "1 gap",
        tone: "attention",
      },
      {
        label: "Owner reporting",
        detail: "Three summaries remain queued",
        value: "9 / 12 sent",
        tone: "neutral",
      },
    ],
    queueTitle: "Decision queue",
    queue: [
      { label: "Approve Wentworth R7 allocation", meta: "High priority · 22 min" },
      { label: "Review syndicate renewal", meta: "Commercial · Today" },
      { label: "Close payroll exception", meta: "Operations · Before 4pm" },
    ],
    activityTitle: "Team intelligence",
    activity: [
      {
        source: "Kennel team",
        time: "8 min",
        body: "Row Beau completed recovery work and remains green for Thursday.",
      },
      {
        source: "Owner desk",
        time: "24 min",
        body: "Three connection updates are prepared for approval and release.",
      },
      {
        source: "Performance review",
        time: "41 min",
        body: "Middle-distance strike rate moved above the rolling 30-day target.",
      },
    ],
  },
  trainer: {
    kicker: "Race-day training cockpit",
    headline: "Six runners, three tracks, no missed detail.",
    summary:
      "Readiness, race suitability and kennel communication stay together from morning checks to box draw.",
    primarySignal: "Race-ready · 5 of 6",
    metrics: [
      { label: "Runner readiness", value: "5 / 6", detail: "One monitor flag" },
      { label: "Race fit score", value: "82%", detail: "+6 pts this week" },
      { label: "Recovery watch", value: "1", detail: "Review at 2:30pm" },
    ],
    focusTitle: "Runner readiness",
    focusDetail: "Latest checks against the selected program",
    focus: [
      {
        label: "Row Beau",
        detail: "Wentworth Park · 520m · Box 7",
        value: "Ready",
        tone: "positive",
      },
      {
        label: "Midnight Halo",
        detail: "Gunnedah · 431m · Box 2",
        value: "Monitor",
        tone: "attention",
      },
      {
        label: "Copper Riot",
        detail: "Healesville · 350m · Box 5",
        value: "Ready",
        tone: "positive",
      },
    ],
    queueTitle: "Trainer actions",
    queue: [
      { label: "Confirm kennel seven transport", meta: "Logistics · 35 min" },
      { label: "Compare R5 early splits", meta: "Form review · Today" },
      { label: "Send Row Beau owner brief", meta: "Connections · Draft ready" },
    ],
    activityTitle: "Kennel channel",
    activity: [
      {
        source: "Trackwork",
        time: "6 min",
        body: "Copper Riot held line through the final sectional and cooled down cleanly.",
      },
      {
        source: "Race planner",
        time: "18 min",
        body: "Box-speed profile now favours the Healesville program over the reserve option.",
      },
      {
        source: "Veterinary note",
        time: "33 min",
        body: "Midnight Halo is cleared for light work pending the afternoon check.",
      },
    ],
  },
  owner: {
    kicker: "Ownership portfolio view",
    headline: "Every dog and milestone in one clear story.",
    summary:
      "Upcoming starts, trainer updates and ownership returns are organised around the dogs that matter to you.",
    primarySignal: "Portfolio status · On track",
    metrics: [
      { label: "Dogs followed", value: "7", detail: "3 active this week" },
      { label: "Next seven days", value: "3 starts", detail: "2 venues" },
      { label: "Season returns", value: "$18.6k", detail: "Across 21 starts" },
    ],
    focusTitle: "My greyhounds",
    focusDetail: "Current status from each training connection",
    focus: [
      {
        label: "Row Beau",
        detail: "Next: Wentworth Park · Thursday",
        value: "Confirmed",
        tone: "positive",
      },
      {
        label: "Velvet Comet",
        detail: "Recovery block · update due Friday",
        value: "Resting",
        tone: "neutral",
      },
      {
        label: "Golden Current",
        detail: "Nomination pending · Angle Park",
        value: "Awaiting",
        tone: "attention",
      },
    ],
    queueTitle: "Owner updates",
    queue: [
      { label: "Row Beau race brief available", meta: "New · 12 min" },
      { label: "March syndicate statement", meta: "Finance · Ready" },
      { label: "Golden Current nomination", meta: "Decision · By 3pm" },
    ],
    activityTitle: "Connections feed",
    activity: [
      {
        source: "Mark Gatt",
        time: "12 min",
        body: "Row Beau is bright after his final gallop and travels tomorrow morning.",
      },
      {
        source: "Syndicate update",
        time: "1 hr",
        body: "The March ownership statement is ready with race-by-race returns.",
      },
      {
        source: "Race alert",
        time: "2 hr",
        body: "Golden Current has an open nomination window at Angle Park.",
      },
    ],
  },
  punter: {
    kicker: "Evidence-first race desk",
    headline: "See the market move, then test the reason.",
    summary:
      "Form, price movement and model confidence surface together so every shortlist has an evidence trail.",
    primarySignal: "Model watch · 3 qualifiers",
    metrics: [
      { label: "Race shortlist", value: "8", detail: "Across 4 meetings" },
      { label: "Market movers", value: "3", detail: "Since 9:00am" },
      { label: "Top model edge", value: "+12.4%", detail: "Demo estimate" },
    ],
    focusTitle: "Market watch",
    focusDetail: "Price movement checked against form signals",
    focus: [
      {
        label: "Wentworth R7 · Row Beau",
        detail: "$4.20 to $3.70 · strong late sectionals",
        value: "+12.4%",
        tone: "positive",
      },
      {
        label: "Gunnedah R5 · Midnight Halo",
        detail: "$5.50 to $4.80 · box-speed query",
        value: "+6.8%",
        tone: "attention",
      },
      {
        label: "Healesville R3 · Copper Riot",
        detail: "$3.10 steady · map advantage",
        value: "+8.1%",
        tone: "neutral",
      },
    ],
    queueTitle: "Research queue",
    queue: [
      { label: "Compare Wentworth R7 maps", meta: "Model flag · 14 min" },
      { label: "Review Gunnedah box splits", meta: "Form query · Open" },
      { label: "Set Healesville price alert", meta: "Watchlist · $3.30" },
    ],
    activityTitle: "Racing intelligence",
    activity: [
      {
        source: "Market monitor",
        time: "3 min",
        body: "Row Beau shortened another ten cents while exchange volume increased.",
      },
      {
        source: "Form model",
        time: "11 min",
        body: "Copper Riot retains the best first-turn map in the Healesville field.",
      },
      {
        source: "Watchlist",
        time: "27 min",
        body: "Midnight Halo triggered a review after the inside runners drifted.",
      },
    ],
  },
} as const satisfies Record<DesignLabRole, RolePreviewContent>;

export function DesignLabRoleBlueprintPreview({
  role,
  variant,
}: {
  role: DesignLabRole;
  variant: PrototypeVariant;
}) {
  const roleOption = DESIGN_LAB_ROLES.find((option) => option.key === role)!;
  const variantOption = PROTOTYPE_VARIANTS.find(
    (option) => option.key === variant
  )!;
  const composition = PROTOTYPE_TEMPLATE_COMPOSITIONS[variant];
  const content = ROLE_PREVIEW_CONTENT[role];

  return (
    <div
      data-role-blueprint-lab
      data-role-blueprint={role}
      data-app-template={variant}
      data-composition-family={composition.family}
      className={styles.lab}
    >
      <div className={styles.pageShell}>
        <header className={styles.masthead}>
          <div>
            <p className={styles.overline}>GreyhoundIQ · Design Lab</p>
            <h1>Role Blueprint Studio</h1>
            <p className={styles.intro}>
              Review how each member role changes the information priorities
              inside every approved A1-C2 composition direction.
            </p>
          </div>
          <dl className={styles.selectionSummary}>
            <div>
              <dt>Role</dt>
              <dd>{roleOption.label}</dd>
            </div>
            <div>
              <dt>Template</dt>
              <dd>{variant}</dd>
            </div>
            <div>
              <dt>Dock pairing</dt>
              <dd>{composition.recommendedDock}</dd>
            </div>
          </dl>
        </header>

        <aside className={styles.notice}>
          <strong>Non-persistent mock data</strong>
          <span>
            This isolated review surface does not read or save account, racing,
            wagering, billing or sponsored-delivery data.
          </span>
        </aside>

        <section className={styles.controls} aria-label="Role blueprint controls">
          <div className={styles.controlGroup}>
            <div>
              <span className={styles.controlLabel}>Member role</span>
              <span className={styles.controlHint}>Changes priorities and content</span>
            </div>
            <nav className={styles.choiceList} aria-label="Choose member role">
              {DESIGN_LAB_ROLES.map((option) => (
                <Link
                  key={option.key}
                  href={`/design-lab/role-blueprints?role=${option.key}&variant=${variant}`}
                  aria-current={option.key === role ? "page" : undefined}
                  className={option.key === role ? styles.activeChoice : styles.choice}
                >
                  <strong>{option.label}</strong>
                  <span>{option.priorities[0]}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className={styles.controlGroup}>
            <div>
              <span className={styles.controlLabel}>App template</span>
              <span className={styles.controlHint}>Changes composition and density</span>
            </div>
            <nav className={styles.choiceList} aria-label="Choose app template">
              {PROTOTYPE_VARIANTS.map((option) => (
                <Link
                  key={option.key}
                  href={`/design-lab/role-blueprints?role=${role}&variant=${option.key}`}
                  aria-current={option.key === variant ? "page" : undefined}
                  className={
                    option.key === variant ? styles.activeChoice : styles.choice
                  }
                >
                  <strong>{option.key}</strong>
                  <span>{option.detail}</span>
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <section className={styles.previewFrame} aria-labelledby="blueprint-preview-title">
          <div className={styles.previewHeader}>
            <div>
              <p className={styles.previewLabel}>Selected blueprint</p>
              <h2 id="blueprint-preview-title">
                {roleOption.label} · {variantOption.label} / {variantOption.detail}
              </h2>
            </div>
            <div className={styles.compositionTags} aria-label="Composition contract">
              <span>{composition.family}</span>
              <span>{composition.hero} hero</span>
              <span>{composition.feed} feed</span>
            </div>
          </div>

          <div className={styles.appScreen}>
            <div className={styles.appBar}>
              <div className={styles.brandMark} aria-label="GreyhoundIQ">
                <span>GIQ</span>
                <strong>{roleOption.label} workspace</strong>
              </div>
              <div className={styles.mockStatus}>
                <span aria-hidden="true" />
                Review data only
              </div>
            </div>

            <section className={styles.hero}>
              <div className={styles.heroCopy}>
                <p>{content.kicker}</p>
                <h3>{content.headline}</h3>
                <span className={styles.heroSummary}>{content.summary}</span>
                <div className={styles.priorityList} aria-label={`${roleOption.label} priorities`}>
                  {roleOption.priorities.map((priority) => (
                    <span key={priority}>{priority}</span>
                  ))}
                </div>
              </div>
              <div className={styles.heroMetrics}>
                <div className={styles.primarySignal}>
                  <span>Primary signal</span>
                  <strong>{content.primarySignal}</strong>
                </div>
                {content.metrics.map((metric) => (
                  <div key={metric.label} className={styles.metric}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <small>{metric.detail}</small>
                  </div>
                ))}
              </div>
            </section>

            <div className={styles.workspace}>
              <section className={`${styles.panel} ${styles.focusPanel}`}>
                <PanelHeading title={content.focusTitle} detail={content.focusDetail} />
                <div className={styles.focusList}>
                  {content.focus.map((item) => (
                    <article key={item.label} className={styles.focusRow}>
                      <span className={styles.signalDot} data-tone={item.tone} aria-hidden="true" />
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <b data-tone={item.tone}>{item.value}</b>
                    </article>
                  ))}
                </div>
              </section>

              <section className={`${styles.panel} ${styles.queuePanel}`}>
                <PanelHeading title={content.queueTitle} detail="Ordered by the selected role" />
                <ol className={styles.queueList}>
                  {content.queue.map((item, index) => (
                    <li key={item.label}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{item.label}</strong>
                        <small>{item.meta}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section className={`${styles.panel} ${styles.activityPanel}`}>
                <PanelHeading
                  title={content.activityTitle}
                  detail={
                    composition.family === "social"
                      ? "Expanded collaboration context"
                      : "Latest role-relevant updates"
                  }
                />
                <div className={styles.activityList}>
                  {content.activity.map((item) => (
                    <article key={`${item.source}-${item.time}`}>
                      <div className={styles.avatar} aria-hidden="true">
                        {item.source.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p>
                          <strong>{item.source}</strong>
                          <time>{item.time}</time>
                        </p>
                        <span>{item.body}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PanelHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <header className={styles.panelHeading}>
      <div>
        <p>{title}</p>
        <span>{detail}</span>
      </div>
      <span className={styles.panelPulse} aria-hidden="true" />
    </header>
  );
}
