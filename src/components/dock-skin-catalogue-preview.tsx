"use client";

import {
  Activity,
  Home,
  Menu,
  MessageCircle,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  DOCK_ACTION_REGISTRY,
  DOCK_SKIN_REGISTRY,
  type DockActionKey,
  type DockSkinKey,
} from "./dock-skin-catalogue";
import styles from "./dock-skin-catalogue-preview.module.css";

const ACTION_ICONS: Record<DockActionKey, LucideIcon> = {
  home: Home,
  feed: Activity,
  post: Plus,
  chat: MessageCircle,
  menu: Menu,
};

export function DockSkinPreview({
  activeAction,
  onActionChange,
  skinKey,
}: {
  activeAction: DockActionKey;
  onActionChange: (action: DockActionKey) => void;
  skinKey: DockSkinKey;
}) {
  const skin = DOCK_SKIN_REGISTRY.find((item) => item.key === skinKey)!;

  return (
    <nav
      aria-label={`${skin.label} dock preview`}
      className={styles.dock}
      data-dock-skin={skinKey}
    >
      {DOCK_ACTION_REGISTRY.map((action) => {
        const Icon = ACTION_ICONS[action.key];
        const isActive = activeAction === action.key;

        return (
          <button
            key={action.key}
            type="button"
            aria-label={
              action.key === "chat" ? "Chat, 3 unread messages" : undefined
            }
            aria-pressed={isActive}
            className={styles.action}
            data-action={action.key}
            data-active={isActive}
            onClick={() => onActionChange(action.key)}
          >
            <span className={styles.iconShell} aria-hidden="true">
              <Icon strokeWidth={action.key === "post" ? 2.6 : 2} />
              {action.key === "chat" ? (
                <span className={styles.unreadBadge}>3</span>
              ) : null}
            </span>
            <span className={styles.actionLabel}>{action.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function DockSkinCataloguePreview({
  initialSkin,
}: {
  initialSkin: DockSkinKey;
}) {
  const [selectedSkin, setSelectedSkin] = useState<DockSkinKey>(initialSkin);
  const [activeAction, setActiveAction] = useState<DockActionKey>("home");
  const skin = DOCK_SKIN_REGISTRY.find((item) => item.key === selectedSkin)!;
  const activeLabel = DOCK_ACTION_REGISTRY.find(
    (item) => item.key === activeAction
  )!.label;

  function selectSkin(key: DockSkinKey) {
    setSelectedSkin(key);
    setActiveAction("home");
  }

  return (
    <div className={styles.catalogue} data-dock-skin-lab>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Design Lab · Mobile navigation</p>
          <h1>Persistent dock skin catalogue</h1>
          <p className={styles.intro}>
            Six materially different shells over one fixed five-action model.
            This review surface does not change production dock behaviour.
          </p>
        </div>
        <dl className={styles.summary} aria-label="Catalogue summary">
          <div>
            <dt>Skins</dt>
            <dd>06</dd>
          </div>
          <div>
            <dt>Actions</dt>
            <dd>05</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>Lab</dd>
          </div>
        </dl>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.selectorPanel} aria-labelledby="dock-skin-selector-title">
          <div className={styles.panelHeading}>
            <div>
              <p>Catalogue</p>
              <h2 id="dock-skin-selector-title">Choose a skin</h2>
            </div>
            <span>{selectedSkin}/D6</span>
          </div>

          <div className={styles.selectorList}>
            {DOCK_SKIN_REGISTRY.map((option) => {
              const isSelected = option.key === selectedSkin;

              return (
                <button
                  key={option.key}
                  type="button"
                  aria-controls="dock-skin-review-stage"
                  aria-pressed={isSelected}
                  className={styles.selectorButton}
                  data-selected={isSelected}
                  data-skin={option.key}
                  onClick={() => selectSkin(option.key)}
                >
                  <span className={styles.selectorIndex}>{option.key}</span>
                  <span className={styles.selectorCopy}>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </span>
                  <span className={styles.selectorSwatch} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section
          id="dock-skin-review-stage"
          className={styles.stage}
          aria-labelledby="dock-skin-stage-title"
        >
          <div className={styles.stageHeading}>
            <div>
              <p>Live review</p>
              <h2 id="dock-skin-stage-title">
                {selectedSkin} · {skin.label}
              </h2>
            </div>
            <div className={styles.variantTag}>
              Recommended with <strong>{skin.recommendedVariant}</strong>
            </div>
          </div>

          <div className={styles.phoneShell}>
            <div className={styles.phoneScreen}>
              <div className={styles.statusBar} aria-hidden="true">
                <span>9:41</span>
                <span className={styles.dynamicIsland} />
                <span>5G&nbsp; 92%</span>
              </div>

              <div className={styles.previewHeader}>
                <div>
                  <span>GreyhoundIQ</span>
                  <strong>Race intelligence</strong>
                </div>
                <span className={styles.livePill}>Live</span>
              </div>

              <div className={styles.raceCard}>
                <div className={styles.raceMeta}>
                  <span>Wentworth Park · R7</span>
                  <strong>2m 14s</strong>
                </div>
                <h3>NSW Sprint Final</h3>
                <p>520m · Grade 5 · Track: Good</p>
                <div className={styles.runnerRow}>
                  <span>4</span>
                  <div>
                    <strong>Velocity Spark</strong>
                    <small>Model confidence 84%</small>
                  </div>
                  <b>$3.10</b>
                </div>
              </div>

              <div className={styles.signalGrid} aria-hidden="true">
                <span style={{ height: "38%" }} />
                <span style={{ height: "54%" }} />
                <span style={{ height: "46%" }} />
                <span style={{ height: "72%" }} />
                <span style={{ height: "63%" }} />
                <span style={{ height: "88%" }} />
                <span style={{ height: "76%" }} />
                <span style={{ height: "100%" }} />
              </div>

              <div className={styles.activeReadout} role="status" aria-live="polite">
                <span>Selected action</span>
                <strong>{activeLabel}</strong>
              </div>

              <DockSkinPreview
                activeAction={activeAction}
                onActionChange={setActiveAction}
                skinKey={selectedSkin}
              />
            </div>
          </div>

          <footer className={styles.contractStrip}>
            <span>Shared semantic contract</span>
            <ol>
              {DOCK_ACTION_REGISTRY.map((action, index) => (
                <li key={action.key}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  {action.label}
                </li>
              ))}
            </ol>
          </footer>
        </section>
      </div>
    </div>
  );
}
