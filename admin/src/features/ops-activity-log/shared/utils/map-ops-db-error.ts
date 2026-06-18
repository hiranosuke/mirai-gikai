type DbError = {
  code: string;
  message: string;
};

type OpsOperation = "作成" | "削除";

/** 作業ログ操作の DB エラーコードを日本語メッセージに変換する純粋関数。 */
export function mapOpsDbError(error: DbError, operation: OpsOperation): string {
  if (error.code === "PGRST116") {
    return "作業ログが見つかりません";
  }
  if (error.code === "23514") {
    return "作業時間は1分以上で入力してください";
  }
  if (error.code === "23503") {
    return "指定された議案が存在しません";
  }
  return `作業ログの${operation}に失敗しました: ${error.message}`;
}
