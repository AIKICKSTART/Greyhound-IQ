import Image from "next/image";
import type { CSSProperties } from "react";
import {
  DANIEL_DEMO_PROFILE_ALIGNMENT,
  DANIEL_DEMO_PROFILE_PORTRAIT,
} from "@/lib/demo-profile-media";

type ActorMediaImageProps = {
  src: string;
  alt: string;
  focalX?: number;
  focalY?: number;
  zoom?: number;
  rotation?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
} & (
  | { fill: true; width?: never; height?: never }
  | { fill?: false; width: number; height: number }
);

export function actorMediaStyle({
  focalX = 0.5,
  focalY = 0.5,
  zoom = 1,
  rotation = 0,
}: {
  focalX?: number;
  focalY?: number;
  zoom?: number;
  rotation?: number;
}): CSSProperties {
  return {
    objectPosition: `${focalX * 100}% ${focalY * 100}%`,
    transform: `rotate(${rotation}deg) scale(${zoom})`,
  };
}

export function ActorMediaImage(props: ActorMediaImageProps) {
  const alignment =
    props.src === DANIEL_DEMO_PROFILE_PORTRAIT
      ? DANIEL_DEMO_PROFILE_ALIGNMENT
      : props;
  const common = {
    src: props.src,
    sizes: props.sizes,
    priority: props.priority,
    unoptimized: props.src.startsWith("/api/media/"),
    className: props.className ?? "h-full w-full object-cover",
    style: actorMediaStyle(alignment),
  };

  return props.fill ? (
    <Image {...common} alt={props.alt} fill />
  ) : (
    <Image {...common} alt={props.alt} width={props.width} height={props.height} />
  );
}
