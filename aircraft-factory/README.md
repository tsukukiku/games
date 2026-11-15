# 航空部品工場 1939–1941

第二次世界大戦期のドイツの小さな航空機部品工場を経営する、ブラウザ用シミュレーション。
ピクセルアートの画面で、クォータービューの工場に設備を置いて生産する。
HTML + CSS + 素の JavaScript だけで動く(ビルド工程なし)。絵はすべてコードで描いており、画像ファイルは使わない。
同梱しているのはピクセルフォント DotGothic16(SIL OFL 1.1、`assets/fonts/`)のみ。

## 動かし方

- **遊ぶ**: `index.html` をブラウザで開く(ダブルクリックでよい。サーバー不要)。
- **操作**: マップはドラッグで移動、ホイール/ピンチで拡大縮小、タップで設備を選ぶ。左のボタンでパネルを開く。スペースで一時停止、Esc で閉じる。
- **自動プレイで検証**: `node tools/run-sim.js`(28か月を1周)。`node tools/run-sim.js multi` で10周。ブラウザのコンソールでは `simulateRun()`。
- **デバッグ**: 左の「設定」→ デバッグモード(60倍速、全解放、資金追加、30日送り)。

## フォルダ構成

```
index.html              読み込み順の定義(<script> の一覧)。ファイルを足したらここに追記する
assets/fonts/           ピクセルフォント(DotGothic16)とライセンス
css/
  pixel.css             フォント・色・画面の枠組み(上部バー、左ボタン、マップ、引き出し)・窓・通知・シーン
  panels.css            パネルの中身(ボタン、カード、アイコンの升、研究ツリー、設計)
js/
  namespace.js          window.AF = { data, core, systems, ui, dev }
  data/                 ★定数データだけ(ロジックを書かない)
    config.js             期間・開始状態・床の大きさ(GRID)・賃金・品質・受注などのバランス値
    materials.js / facilities.js / parts.js / units.js / companies.js / contracts.js
    research.js           研究ノード(tree / col / row でツリー上の位置を決める)
    events.js / missions.js   史実イベント・任務(まだデータのみ)
    index.js              id → データの索引(AF.data.index)
  core/                 共通基盤
    util.js               乱数(seed式)・日付・書式
    log.js                出来事の記録(add)と、画面演出のきっかけ(fx)
    state.js              state の生成と store
    save.js / clock.js    セーブ、実時間の時計
  systems/              ★ゲームのルール。DOMに触らない。すべて第1引数に state を取る
    economy.js            記帳、資材の割当と仕入れ、固定費、倒産判定
    workforce.js          雇用、人員係数
    facilities.js         設備の購入と床への配置(state.layout)、能力
    aircraft.js           機体の合計値(computeAircraftStats)、役割、設計、ユニット購入
    production.js         生産ジョブ、品質判定、部品の研究ロック
    contracts.js          契約の提示・受注・納入、スポット販売
    research.js           研究の着手・進行・完了、条件解放、ライセンス料
    progression.js        機体組立の解放、最終スコア
    monthEnd.js / gameLoop.js   月末集計、1日ぶんの進行
    events.js / war.js / missions.js / rivals.js   【ひな形】次の段階で実装
  ui/                   画面
    dom.js / actions.js   小道具、操作の受け口(data-action)
    pix/                  ピクセルアートの素材
      pixel.js              色の表、縁取り、アイコンのHTML(ui.pix.icon)
      icons.js              16×16 アイコンの定義(部品・資材・ボタン)
      iso.js                クォータービューの描画と、設備・木・トラックの絵
      aircraftPixel.js      機体・ユニットのピクセル画像(sprites.js のSVGを変換)
    sprites.js / aircraftSvg.js   機体ユニットの形(SVG部品)と、その重ね合わせ
    map/
      factoryMap.js         工場マップ(カメラ、入力、毎コマの描画)
      effects.js            工員、トラック、浮かぶ数字、粒
    hud.js                上部の資源バー、左のボタン列、引き出し
    panels/               左のボタンから開くパネル(1ファイル=1〜数パネル)
      build.js  jobs.js  stock.js  shop.js(資材の購入)  staff.js
      contracts.js  research.js(研究ツリー)  design.js  info.js(市場・月報・設定)
    scenes/               全画面のピクセルアニメーション
      scenes.js             シーンの管理(register / open / close)
      testFlight.js         試験飛行(下準備の版)
    modal.js / app.js     開始・終了の窓、全体の組み立て
  dev/                  デバッグ操作、自動プレイ simulateRun()
  main.js               起動
tools/run-sim.js        Node で systems だけを動かす検証用スクリプト(依存なし)
```

## 設計の約束ごと(編集するときに守ること)

1. **依存の向きは一方通行**: `data → core → systems → ui`。systems から ui を呼ばない。
2. **全ファイルは同じ書き出し**: `(function (AF) { 'use strict'; ... })(window.AF);`。ESモジュールは使わない(file:// で動かすため)。
3. **state は素のJSON**。項目を足すときは `core/state.js` の `create()` に初期値を書く(古いセーブには自動で補われる)。
4. **systems は DOM に触らない**。画面への知らせは2通り:
   - `AF.core.log.add(state, 文, level)` … 記録と通知
   - `AF.core.log.fx(state, type, data)` … 演出のきっかけ(`ui/map/effects.js` と `ui/app.js` の `flush` が拾う)
5. **乱数は `AF.core.util.rand(state)`**(ルール側)。見た目だけの乱数(工員の動きなど)は `Math.random()` でよい。
6. **画面の操作は属性で指定**: `<button data-action="job.add">` と書き、`ui.on('job.add', fn)` で受ける。マップなど属性を使えない所は `ui.run('名前', {…})`。
7. **絵はコードで描く**: アイコンは `icons.js` に1行、設備は `iso.js` の `FAC` に箱を積む関数を1つ足す。
8. **機体の合計値の計算は1か所**: `systems/aircraft.js` の `computeAircraftStats()`。

## よくある変更の手順

| やりたいこと | 触るファイル |
|---|---|
| 部品を足す | `data/parts.js` に1行 + `ui/pix/icons.js` に同じ id のアイコンを1行 |
| 設備を足す | `data/facilities.js` に1行(size も) + `ui/pix/iso.js` の `FAC` に絵 |
| 研究ノードを足す | `data/research.js` に1行(tree / col / row / requires / unlocks)。効果の種類を増やすなら `systems/research.js` の `applyUnlocks` |
| ユニットを足す | `data/units.js` + `ui/sprites.js` に形 |
| パネルを足す | `ui/panels/xxx.js` で `ui.panels.xxx = { id, label, icon, render }` → `hud.js` の `SIDEBAR` と `index.html` に追記 |
| 演出を足す | ルール側で `log.fx(state, '種類', {…})` → `ui/map/effects.js` の `consume` か `ui/app.js` の `flush` で受ける |
| シーンを足す | `ui/scenes/xxx.js` で `AF.ui.scenes.register('名前', { init, update, draw })` → `AF.ui.scenes.open('名前', 引数)` |
| バランスを変える | `data/config.js` → `node tools/run-sim.js multi` で確認 |

## 試験飛行シーンについて(これから作り込む場所)

- 入口: 設計パネルの「試験飛行を見る」→ `ui.scenes.open('testFlight', { slots, name })`。
- 機体の絵: `ui.aircraftPixel.get(slots, null, cb)` が 220×90 のピクセル画像(機首が左)を返す。どのシーンでも使える。
- 段取りは `testFlight.js` の `PHASES`(始動 → 滑走 → 離陸 → 上昇 → 通過 → 完了)。いまは速度の数値で加速が少し変わるだけ。
- 今後の候補: 完成機ごとに自動で再生する(`fx` の `jobDone` で kind が aircraft のとき)、信頼性が低いと不具合の演出、着陸、結果を評価に反映。

## 実装の状況

- 動いているもの: 時計、資金・資材・人員、設備の配置、生産、受注と納入、研究ツリー、設計、月報、セーブ/ロード、試験飛行(見た目のみ)。
- ひな形のみ: 史実イベント、戦況値、任務判定、ライバルの行動(`systems/` の該当ファイルの TODO)。
