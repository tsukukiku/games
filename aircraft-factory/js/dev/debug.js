// 開発用のデバッグ機能。画面右上の「デバッグ」から使う。コンソールからも AF.dev.xxx() で呼べる。
(function (AF) {
  'use strict';
  var dev = AF.dev;

  function current() { return AF.core.store.state; }

  // デバッグモードの切り替え(60倍速ボタンとデバッグ操作が出る)
  dev.setDebug = function (on) {
    var state = current();
    if (!state) return;
    state.debug = !!on;
    if (!on && AF.core.clock.speed > 4) AF.core.clock.speed = 1;
    AF.core.store.notify('action');
  };

  // 全ユニットを解放し、機体の組立も解放する
  dev.unlockAll = function (state) {
    state = state || current();
    AF.data.UNITS.forEach(function (u) { state.unlockedUnits[u.id] = true; });
    AF.data.RESEARCH.forEach(function (n) {
      state.research.revealed[n.id] = true;
      if (n.tree === 'parts' && !state.research.done[n.id]) { state.research.done[n.id] = true; AF.systems.research.applyUnlocks(state, n); }
    });
    AF.data.CONFIG.PHASE2.facilities.forEach(function (id) {
      if (!(state.facilities[id] > 0)) state.facilities[id] = 1;
    });
    AF.systems.facilities.syncLayout(state);
    if (state.phase < 2) {
      state.phase = 2;
      AF.systems.contracts.addAircraftOffers(state);
    }
    AF.core.log.add(state, '[デバッグ] 全ユニットと機体の組立を解放した。', 'info');
    AF.core.store.notify('action');
  };

  dev.addFunds = function (amount, state) {
    state = state || current();
    state.funds += amount == null ? 50000 : amount;
    AF.core.store.notify('action');
  };

  // n日ぶん一気に進める
  dev.skipDays = function (n, state) {
    state = state || current();
    for (var i = 0; i < (n || 30); i++) AF.systems.gameLoop.advanceDay(state);
    AF.core.store.notify('day');
  };
})(window.AF);
