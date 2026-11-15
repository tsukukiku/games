// グローバル名前空間。全ファイルは (function (AF) { ... })(window.AF); の形でここへ追加する。
// ビルド工程なし・file:// でそのまま動かすため、ESモジュールは使わない。
window.AF = {
  data: {},     // 定数データ      (js/data/)
  core: {},     // 共通基盤        (js/core/)
  systems: {},  // ゲームのルール  (js/systems/)
  ui: {},       // 画面            (js/ui/)
  dev: {}       // 開発用          (js/dev/)
};
