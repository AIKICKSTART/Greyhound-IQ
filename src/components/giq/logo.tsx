import Image, { type ImageProps } from "next/image";

import { cn } from "./utils";

export type GiqLogoVariant = "auto" | "full" | "compact" | "mark" | "app-icon";
export type GiqLogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const heightForSize: Record<GiqLogoSize, number> = {
  xs: 18,
  sm: 24,
  md: 32,
  lg: 48,
  xl: 78,
};

const minHeight: Record<Exclude<GiqLogoVariant, "auto">, number> = {
  full: 28,
  compact: 20,
  mark: 16,
  "app-icon": 24,
};

const assets: Record<Exclude<GiqLogoVariant, "auto">, { src: string; width: number; height: number }> = {
  full: { src: "/images/logo-main-purple-gold.webp", width: 1200, height: 360 },
  compact: { src: "/images/wordmark-compact-ghiq.png", width: 1536, height: 864 },
  mark: { src: "/images/brand/greyhoundiq-icon-mark.png", width: 1536, height: 864 },
  "app-icon": { src: "/images/brand/greyhoundiq-app-icon-dark.png", width: 1536, height: 864 },
};

export function Logo({
  variant = "auto",
  size = "md",
  className,
  alt,
  ...props
}: Omit<ImageProps, "src" | "width" | "height" | "alt"> & {
  variant?: GiqLogoVariant;
  size?: GiqLogoSize;
  alt?: string;
}) {
  const targetHeight = heightForSize[size];
  const resolved = variant === "auto" ? (targetHeight >= 40 ? "full" : "compact") : variant;
  const image = assets[resolved];
  const height = Math.max(targetHeight, minHeight[resolved]);

  return (
    <Image
      src={image.src}
      width={image.width}
      height={image.height}
      alt={
        alt ??
        (resolved === "mark" || resolved === "app-icon"
          ? "GreyhoundIQ"
          : "GreyhoundIQ - Australian greyhound racing intelligence")
      }
      className={cn(resolved === "app-icon" && "rounded-[22%]", className)}
      style={{ height, width: "auto", ...props.style }}
      {...props}
    />
  );
}
