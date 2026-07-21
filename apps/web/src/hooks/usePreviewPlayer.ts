import { useCallback, useEffect, useRef, useState } from "react";

export function usePreviewPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.addEventListener("ended", () => setPlayingId(null));
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const toggle = useCallback(
    (id: string, url: string | null) => {
      if (!url) return;
      const audio = getAudio();
      if (playingId === id) {
        audio.pause();
        setPlayingId(null);
        return;
      }
      audio.src = url;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      setPlayingId(id);
    },
    [playingId, getAudio]
  );

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  return { playingId, toggle };
}
