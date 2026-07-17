import { useRef } from "react";

interface Props {
  onResize: (deltaX: number) => void;
}

export default function Resizer({ onResize }: Props) {
  const startXRef = useRef(0);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    startXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    const deltaX = e.clientX - startXRef.current;
    startXRef.current = e.clientX;
    onResize(deltaX);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="separator"
      aria-orientation="vertical"
      className="w-1.5 flex-shrink-0 mx-0.5 cursor-col-resize rounded-full hover:bg-gray-700 active:bg-green-600 transition-colors"
    />
  );
}
