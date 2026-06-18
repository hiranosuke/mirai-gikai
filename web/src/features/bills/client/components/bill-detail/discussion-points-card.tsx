import type { DiscussionPoints } from "../../../shared/types";

interface DiscussionPointsCardProps {
  discussionPoints?: DiscussionPoints;
}

export function DiscussionPointsCard({
  discussionPoints,
}: DiscussionPointsCardProps) {
  const pro = discussionPoints?.pro_points?.trim();
  const con = discussionPoints?.con_points?.trim();

  // 賛成・反対する理由がどちらも無ければ非表示
  if (!pro && !con) {
    return null;
  }

  return (
    <section>
      <h2 className="text-[22px] font-bold mb-2">考えるヒント</h2>
      <p className="text-sm text-mirai-text-muted mb-4">
        議案資料・議事録をもとにAIが整理し、運営者が確認した、賛成・反対それぞれの主な理由です。特定の立場を推奨するものではありません。
      </p>
      <div className="flex flex-col gap-4">
        {pro && (
          <div className="bg-stance-for-bg rounded-lg px-6 py-5">
            <h3 className="text-lg font-bold text-primary-accent mb-2">
              賛成する理由
            </h3>
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {pro}
            </p>
          </div>
        )}
        {con && (
          <div className="bg-stance-against-bg rounded-lg px-6 py-5">
            <h3 className="text-lg font-bold text-stance-against mb-2">
              反対する理由
            </h3>
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {con}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
