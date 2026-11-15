// 起動。すべてのスクリプトを読み込んだあとに画面を組み立てる。
// コンソール用の入口: AF.dev.simulateRun() / AF.dev.unlockAll() / AF.core.store.state
(function (AF) {
  'use strict';
  window.simulateRun = function (opts) { return AF.dev.simulateRun(opts); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', AF.ui.app.init);
  else AF.ui.app.init();
})(window.AF);
