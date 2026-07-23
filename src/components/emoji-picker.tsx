"use client";

import { Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Curated, self-contained emoji palette (no external picker lib / network — CSP
// safe). Grouped loosely: reactions, gestures, faces, racing/greyhound, money.
const EMOJI_GROUPS: { label: string; emoji: string[] }[] = [
  {
    label: "Reactions",
    emoji: ["👍", "👎", "❤️", "🔥", "🎉", "👏", "🙌", "🙏", "💪", "💯", "⭐", "✅"],
  },
  {
    label: "Faces",
    emoji: ["😀", "😄", "😁", "😂", "🙂", "😉", "😍", "😎", "🤩", "🥳", "🤔", "😅", "😳", "🥺", "😢", "😡"],
  },
  {
    label: "Racing",
    emoji: ["🐕", "🐶", "🦴", "🏁", "🏆", "🥇", "🥈", "🥉", "⚡", "📈", "📉", "🎯"],
  },
  {
    label: "Money",
    emoji: ["💰", "💸", "🤑", "💵", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "❌"],
  },
];

/**
 * Popover emoji picker. Emits the chosen emoji via onSelect; the caller inserts
 * it into its own field at the cursor. Closes on outside click / Escape.
 */
export function EmojiPicker({
  onSelect,
  ariaLabel = "Insert emoji",
}: {
  onSelect: (emoji: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={ariaLabel}
        className="giq-icon-button grid h-9 w-9 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-white/[0.06] hover:text-[hsl(var(--primary-bright))]"
      >
        <Smile className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Emoji"
          className="giq-panel absolute bottom-[calc(100%+0.5rem)] right-0 z-30 w-[236px] rounded-xl border border-white/[0.12] bg-[hsl(var(--surface-1)/0.98)] p-2 shadow-2xl backdrop-blur-xl"
        >
          <div className="max-h-[220px] space-y-2 overflow-y-auto pr-0.5">
            {EMOJI_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="giq-eyebrow mb-1 px-1 text-[9px] text-[hsl(var(--subtle-foreground))]">
                  {group.label}
                </p>
                <div className="grid grid-cols-6 gap-0.5">
                  {group.emoji.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onSelect(emoji);
                        setOpen(false);
                      }}
                      className="grid h-8 w-8 place-items-center rounded-md text-[18px] leading-none transition-transform hover:scale-125 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.7)]"
                      aria-label={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Insert text at the caret of an input/textarea, preserving an uncontrolled
 * field's value + firing React's onChange. Returns focus with the caret after
 * the inserted text.
 */
export function insertAtCursor(
  field: HTMLInputElement | HTMLTextAreaElement | null,
  text: string,
): void {
  if (!field) return;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  const next = field.value.slice(0, start) + text + field.value.slice(end);
  const proto =
    field instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(field, next);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  const caret = start + text.length;
  field.focus();
  field.setSelectionRange(caret, caret);
}
