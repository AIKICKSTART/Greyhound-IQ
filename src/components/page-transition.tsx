export function PageTransition({
  children,
  soft = false,
}: {
  children: React.ReactNode;
  soft?: boolean;
}) {
  return <div className={soft ? "giq-page-enter-soft" : "giq-page-enter"}>{children}</div>;
}
