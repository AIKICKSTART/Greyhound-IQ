import type { ReactNode } from "react";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div data-onboarding-target="account-shell">
      <div data-onboarding-target="account-page-content">{children}</div>
    </div>
  );
}
