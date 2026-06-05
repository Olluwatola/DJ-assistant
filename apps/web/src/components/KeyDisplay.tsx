import { formatKey } from "../lib/pitchClass";

interface Props {
  keyInt: number | null | undefined;
  mode: number | null | undefined;
}

export default function KeyDisplay({ keyInt, mode }: Props) {
  return <span className="font-mono text-xs text-gray-400">{formatKey(keyInt, mode)}</span>;
}
