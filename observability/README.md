# observability — みらい議会＠さいたま PoC の計測スタック

PoC の主目的「個人が自費・自力で現実的に回せるか（コスト・労力）」を
継続的に可視化するための Grafana スタック。ローカル Supabase の Postgres を
直接読み取り、AI コスト・インタビュー参加状況・運用負荷プロキシを表示する。

運用案の全体像は [`docs/20260613_2200_みらい議会さいたま市PoC運用案.md`](../docs/20260613_2200_みらい議会さいたま市PoC運用案.md) を参照。

## 構成

```
observability/
├── docker-compose.yml                      # Grafana コンテナ
└── grafana/
    ├── provisioning/
    │   ├── datasources/supabase.yaml       # Postgres データソース定義
    │   └── dashboards/provider.yaml        # ダッシュボード自動読み込み設定
    └── dashboards/
        └── poc-overview.json               # PoC オーバービュー ダッシュボード
```

## 前提

- ローカル Supabase が起動していること（`npx supabase start`）。
  Postgres は `supabase/config.toml` の `db.port`（既定 **54432**）で待ち受ける。
- Docker / Docker Compose が使えること。

## 起動

```bash
cd observability
docker compose up -d
```

- Grafana: http://localhost:3002 （web=3000 / admin=3001 と衝突しない 3002 を使用）
- 初期ログイン: `admin` / `admin`（初回ログイン時に変更を促される）
- 「みらい議会」フォルダに `みらい議会＠さいたま PoC オーバービュー` が自動で現れる。

停止・削除:

```bash
docker compose down        # コンテナ停止（ダッシュボード設定は再起動で復元）
docker compose down -v      # Grafana のデータボリュームごと削除
```

## 接続先の変更

既定値はローカル Supabase 向け。リモート DB を見たい場合は環境変数で上書きする
（`observability/.env` を作るか、シェルで export する）。

| 環境変数 | 既定値 | 用途 |
|---|---|---|
| `MIRAI_DB_HOST` | `host.docker.internal` | DB ホスト |
| `MIRAI_DB_PORT` | `54432` | DB ポート |
| `MIRAI_DB_NAME` | `postgres` | DB 名 |
| `MIRAI_DB_USER` | `postgres` | 接続ユーザー |
| `MIRAI_DB_PASSWORD` | `postgres` | 接続パスワード |
| `GF_ADMIN_USER` | `admin` | Grafana 管理ユーザー |
| `GF_ADMIN_PASSWORD` | `admin` | Grafana 管理パスワード |

> リモート（本番）DB に接続する場合は、必ず読み取り専用ユーザーを用意し、
> パスワードを既定値から変更すること。

## 主なパネルとデータ元

| パネル | データ元 |
|---|---|
| 累計 / 当月 AI コスト、日次コスト、モデル別コスト | `chat_usage_events` |
| インタビュー完了率、日次インタビュー（開始/完了） | `interview_sessions` |
| 公開レポート数、スタンス分布 | `interview_report` |
| 公開議案数の推移 | `bills` |
| インタビュー設定作成数 | `interview_configs` |

> 運用開始前はデータが空のためパネルもほぼ空になる。議案を公開し
> インタビューを回すと埋まっていく。これが PoC の「計器盤」になる。

## ダッシュボードを育てる

見たい指標が増えたら `grafana/dashboards/poc-overview.json` にパネルを追加するか、
新しい `*.json` を同ディレクトリに置けば自動で読み込まれる。集計が重い場合は
Supabase 側に view / function を追加し、Grafana から呼び出す。
