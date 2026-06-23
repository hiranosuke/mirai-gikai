import { User } from "lucide-react";
import { cn } from "@/lib/utils";

type BillSentiment = "期待" | "懸念" | null;
type SentimentKey = NonNullable<BillSentiment> | "none";

/** stance(期待/懸念) に応じた背景円の色。 */
const bgClass: Record<SentimentKey, string> = {
  期待: "bg-stance-for-bg",
  懸念: "bg-stance-against-bg",
  none: "bg-mirai-surface-warm",
};

/** stance に応じたシルエット色（currentColor で塗る）。 */
const fgClass: Record<SentimentKey, string> = {
  期待: "text-primary-accent",
  懸念: "text-stance-against-light",
  none: "text-mirai-text-muted",
};

interface PersonAvatarProps {
  sentiment: BillSentiment;
  className?: string;
}

/**
 * 回答者アバター（人物シルエット）。
 * 背景円・シルエット色は stance（期待/懸念）に追従する。
 */
export function PersonAvatar({ sentiment, className }: PersonAvatarProps) {
  const key: SentimentKey = sentiment ?? "none";
  return (
    <span
      className={cn(
        "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full",
        bgClass[key],
        className
      )}
    >
      <User className={cn("size-6", fgClass[key])} aria-hidden="true" />
    </span>
  );
}
