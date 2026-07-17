import type { ReactNode } from "react";

type PageTitleProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  size?: "compact" | "page" | "display";
};

export function PageTitle({
  children,
  className,
  id,
  size = "page",
}: PageTitleProps) {
  return (
    <h1
      id={id}
      data-page-title="true"
      data-page-title-size={size}
      className={`giq-page-title${className ? ` ${className}` : ""}`}
    >
      {children}
    </h1>
  );
}
