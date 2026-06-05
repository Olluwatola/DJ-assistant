import type { Platform } from "@dj-assistant/types";

interface Props {
  platform: Platform;
}

const styles: Record<Platform, string> = {
  spotify: "bg-green-900 text-green-300",
  soundcloud: "bg-orange-900 text-orange-300",
};

const labels: Record<Platform, string> = {
  spotify: "Spotify",
  soundcloud: "SoundCloud",
};

export default function PlatformBadge({ platform }: Props) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${styles[platform]}`}>
      {labels[platform]}
    </span>
  );
}
