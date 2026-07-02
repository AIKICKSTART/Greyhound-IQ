"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export function ResponsibleUseAlert() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
  }

  return (
    <section className="giq-alert-wrap" aria-label="Responsible use notice">
      <div className="giq-alert giq-alert-warning" role="alert">
        <AlertTriangle className="giq-alert-icon" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="giq-alert-title">Not a wagering service</p>
          <p className="giq-alert-body">
            GreyhoundIQ provides form, data and analytics only. No bets or
            odds. Gamble responsibly. 18+.
          </p>
        </div>
        <button
          type="button"
          className="giq-alert-dismiss"
          onClick={dismiss}
          aria-label="Dismiss responsible use notice"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
