import type { Database } from "@mirai-gikai/supabase";

type BillInsert = Database["public"]["Tables"]["bills"]["Insert"];
type DiscussionPointsInsert =
  Database["public"]["Tables"]["discussion_points"]["Insert"];
type TagInsert = Database["public"]["Tables"]["tags"]["Insert"];
type BillsTagsInsert = Database["public"]["Tables"]["bills_tags"]["Insert"];
type DietSessionInsert =
  Database["public"]["Tables"]["diet_sessions"]["Insert"];
type InterviewConfigInsert =
  Database["public"]["Tables"]["interview_configs"]["Insert"];
type InterviewQuestionInsert =
  Database["public"]["Tables"]["interview_questions"]["Insert"];

// ============================================================
// さいたま市版 PoC シード（最小単位）
// 「議案1本がトップ→詳細→インタビューまで通る」ことを確認するための最小データ。
// 国会版シード（ガソリン税法案など）は git 履歴に残る。
// ※スキーマは未改変。originating_house（衆/参）など国会固有カラムは
//   将来のスキーマ整理ステップで削除予定（現状はプレースホルダ値で投入）。
// ============================================================

// 定例会データ（国会会期テーブル diet_sessions を市議会の定例会として流用）
export const dietSessions: DietSessionInsert[] = [
  {
    name: "令和8年6月定例会",
    slug: "r8-june",
    start_date: "2026-06-09",
    end_date: "2026-06-26",
    is_active: true,
  },
];

// タグデータ
export const tags: TagInsert[] = [
  {
    label: "子育て・教育",
    description: "学校・教育環境、子育て支援に関する議案",
    featured_priority: 1,
  },
];

// サンプル議案（差し替え前提のプレースホルダ）
// 実運用では運用案 §2 の手順で実際の議案に差し替える。
export const bills: BillInsert[] = [
  {
    name: "市立小・中学校 体育館空調設備設置事業",
    // 一院制の市議会では本来不要。スキーマ未改変のため NOT NULL を満たす
    // プレースホルダ値を入れる（将来のスキーマ整理で originating_house ごと削除予定）。
    originating_house: "HR",
    // bill_status_enum は国会版のまま。市議会用の status へは将来のスキーマ整理で書き換える。
    status: "introduced",
    status_note: "6月定例会で審議中",
    submitted_date: "2026-06-09T09:00:00+09:00",
    publish_status: "published",
    is_featured: true,
    thumbnail_url: "https://placehold.co/600x400.png",
  },
];

// 議案とタグの関連付け
export function createBillsTags(
  insertedBills: { id: string; name: string }[],
  insertedTags: { id: string; label: string }[]
): Omit<BillsTagsInsert, "id" | "created_at">[] {
  const billTagMap: { [billName: string]: string[] } = {
    "市立小・中学校 体育館空調設備設置事業": ["子育て・教育"],
  };

  const billsTags: Omit<BillsTagsInsert, "id" | "created_at">[] = [];

  for (const bill of insertedBills) {
    const tagLabels = billTagMap[bill.name] || [];
    for (const tagLabel of tagLabels) {
      const tag = insertedTags.find((t) => t.label === tagLabel);
      if (tag) {
        billsTags.push({
          bill_id: bill.id,
          tag_id: tag.id,
        });
      }
    }
  }

  return billsTags;
}

// 議案ごとの論点整理。
// さいたま市議には該当議員（特定政党）がいないため、主体の賛否は表明せず、
// 賛成の論拠／反対の論拠を中立に併記する。
const discussionPointsData: Omit<DiscussionPointsInsert, "bill_id">[] = [
  {
    pro_points: `- 近年の猛暑で、空調のない体育館は熱中症リスクが高く、児童・生徒の安全と授業（体育・式典）の実施に支障が出ている。
- 体育館は災害時の指定避難所を兼ねており、空調整備は防災対策としても効果が大きい。
- 周辺自治体でも整備が進んでおり、教育環境の地域間格差を是正する必要がある。`,
    con_points: `- 全校整備には多額の初期費用に加え、電気代・保守などの継続的な維持費が市財政を圧迫する。
- 限られた予算の中で、老朽校舎の改修やトイレ改善など他の優先課題との兼ね合いを問う声がある。
- 稼働日数が限られる体育館への大規模投資より、断熱・送風など費用対効果の高い代替策を先に検討すべきとの指摘。`,
  },
];

export function createDiscussionPoints(
  insertedBills: { id: string; name: string }[]
): DiscussionPointsInsert[] {
  return discussionPointsData.map((points, index) => ({
    ...points,
    bill_id: insertedBills[index]?.id || "",
  }));
}

// インタビュー設定を作成（最初の議案用）
export function createInterviewConfig(
  insertedBills: { id: string; name: string }[]
): Omit<InterviewConfigInsert, "id" | "created_at" | "updated_at"> | null {
  const targetBill = insertedBills[0];
  if (!targetBill) return null;

  return {
    bill_id: targetBill.id,
    name: "デフォルト設定",
    status: "public",
    themes: ["賛否", "理由"],
  };
}

// インタビュー質問を作成
export function createInterviewQuestions(
  interviewConfigId: string
): Omit<InterviewQuestionInsert, "id" | "created_at" | "updated_at">[] {
  return [
    {
      interview_config_id: interviewConfigId,
      question: "この議案に賛成ですか？反対ですか？",
      follow_up_guide: "ユーザーの立場を明確にしてください。",
      quick_replies: ["賛成", "反対", "どちらでもない"],
      question_order: 1,
    },
    {
      interview_config_id: interviewConfigId,
      question: "そのように考える理由を教えてください。",
      follow_up_guide: "具体的な理由を引き出してください。",
      quick_replies: null,
      question_order: 2,
    },
  ];
}
