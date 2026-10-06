# ソースの構成の整理（設計）

- 作成日: 2026-10-06
- 位置づけ: 作業中だけ使う。整理が終わったら消し、結果は `docs/design.md` に書く。

## 目的

- `app.js`（485 行・1 つの即時関数・詰め書き）を役割ごとのファイルに分け、issue の影響調査で「どのファイルが変わるか」を言えるようにする。
- 計算だけの部分を画面から切り離し、テストで動きを確かめられるようにする。
- 今後大きく変える予定はないので、土台は軽くする（ビルドしない）。

## 変えないこと

- 動き・見た目・文言。
- 保存の形とキー（`pomo.data.v1`・`pomo.timer.v1`・`pomo.look.v1`・`pomo.drawer.v1`）。今の記録はそのまま読めること。
- バックアップ（JSON）の形。前に書き出したファイルを取り込めること。
- 途中で見つけたバグらしきものは直さない（後で issue にする）。

## 土台

- ES モジュール（`<script type="module" src="src/main.js">`）、ビルドなし。GitHub Pages にファイルをそのまま置く。
- 開発のときだけ npm を使う（`package.json` に vitest・prettier を devDependencies で入れる）。`node_modules/` は git で無視する。公開物には要らない。
- ファイルを直接（`file://`）開くと動かない。作業用のサーバー（`python3 -m http.server 8000`）で開く。

## ファイル

```
index.html  style.css  sw.js  manifest.webmanifest  icon-*.png
src/
  main.js            起動。store を読み込み、各 ui を初期化し、subscribe で renderAll をつなぐ。0.25 秒ごとの tick
  config.js          APP_CONFIG を export（今の config.js を移す）
  core/              DOM・localStorage を使わない。テストの対象
    time.js          pad・dayKey・monthKey・hm・fmt・startOfDay・weekStart・genId
    timer.js         タイマーの状態の遷移: remaining・start・pause・resetTo・afterFocus（次のモード）・dur
    stats.js         記録の集計: 今日・今週・今月・連続日数、直近 14 日の科目別、今週の科目別、履歴の日ごとのまとめ
    tasks.js         タスクの追加・更新・削除・完了の切り替え・実績を 1 足す・残りポモ数
    backup.js        CSV の文字列、バックアップの JSON、取り込み（重複を除いて足す）
  store.js           状態（settings・months・tasks・タイマー t）を持つ唯一の場所。localStorage の読み書き、別タブの変更、subscribe / notify
  ui/
    timer-view.js    文字盤・目盛り・ボタン・キー操作、終わったときの処理（記録・チャイム・花火・トースト）
    stats-view.js    記録タブ（数字・グラフ・科目別・履歴・手動で追加・CSV）
    tasks-view.js    ドロワー、タスクの一覧・編集フォーム、下の欄、科目のチップ、今回のメモ
    settings-view.js 設定タブ、設定の保存、書き出し・取り込み
    look.js          見た目（シンプル・グラデーション・アニメ）の切り替え、集中中の自動非表示
    background.js    canvas の背景と花火
    feedback.js      トースト、チャイム、保存できなかったときの表示
test/                vitest（core/ の各ファイルに 1 つ）
```

- 時刻を使う関数（集計・タイマー）は「今」を引数で受け取る（`now`）。テストで時刻を決められるようにするため。
- 関数の中身は今のコードをそのまま移す。名前を変えるのは、ファイルをまたぐと分かりにくいものだけ。

## つなぎ方

- 依存は `ui/` → `store.js` → `core/`・`config.js` の向きだけ。`core/` は `config.js` 以外を読まない。`ui/` どうしは `main.js` でつなぐ（例: タイマーが終わったら background の花火を呼ぶ関数を main で渡す）。
- 状態を変えるのは `store.js` の関数だけ（`addSession`・`deleteSession`・`saveSettings`・`setTasks`・`saveTimer`・`importBackup` など）。保存したら subscribe された関数を呼ぶ。`main.js` は renderAll を登録する。
- 今の `typeof wake==='function'` のような、定義の順を避ける書き方はなくす。

## 書き方

- prettier で整える（JS・CSS・HTML）。設定は `.prettierrc`（printWidth 100、シングルクォート、セミコロンあり）。
- コメントは今と同じくらい（区切りと分かりにくい所だけ、日本語）。

## 確かめ方

1. 分ける前に、今の `app.js` の計算の動きを写したテストを書く（集計・連続日数・週の初め（月曜）・fmt・次のモード・残りポモ数・取り込みの重複除き・CSV の形）。今のコードから関数を取り出した仮のファイルで通す。
2. 分けたあと、同じテストを `core/` に向けて通す。
3. 作業用のサーバーで画面を開き、次を確かめる: 開始・一時停止・再開、記録して終了、休憩をスキップ、リセット、時間切れ（集中 1 分にして）、タスクの追加・編集・選択・完了・削除、手動で追加・履歴の削除、設定の保存、CSV・JSON の書き出しと取り込み、見た目の 3 つの切り替え、ドロワーの開け閉め、リロードしても状態が続くこと、前の localStorage の中身がそのまま読めること。
4. `node --check` に代わり、`npm test` と prettier の確認（`npx prettier --check .`）。

## 後片付け

- `sw.js` のキャッシュの一覧を新しいファイルにし、`CACHE` を `focus-timer-v3` に上げる。
- `docs/design.md` の 1.1・1.2 を新しい構成に直す。
- `CLAUDE.md` の構成・環境・テストの節を直す（`npm test`、prettier）。
- README の更新の手順はそのまま（`CACHE` を上げる）。
- この設計書と実装の計画を消す。
