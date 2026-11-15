// 実時間の時計(ブラウザ専用)。speed 倍で時間を進め、1日ぶんたまるごとに gameLoop.advanceDay を呼ぶ。
// speed: 0=一時停止 / 1, 2, 4 / デバッグ時 60
(function (AF) {
  'use strict';

  var clock = {
    speed: 0,
    acc: 0,        // 今日の経過(ミリ秒、ゲーム内換算)
    _last: 0,
    _timer: null,

    start: function () {
      if (this._timer) return;
      var self = this;
      this._last = performance.now();
      this._timer = setInterval(function () { self._loop(); }, 100);
    },

    setSpeed: function (n) {
      this.speed = n;
      AF.core.store.notify('speed');
    },

    // 今日がどこまで進んだか(0〜1)
    fraction: function () { return this.acc / AF.data.CONFIG.MS_PER_DAY; },

    reset: function () { this.speed = 0; this.acc = 0; },

    _loop: function () {
      var now = performance.now();
      var dt = Math.min(1000, now - this._last); // タブが裏に回ったあとの飛びを抑える
      this._last = now;
      var state = AF.core.store.state;
      if (!state || this.speed <= 0 || state.finished || state.bankrupt) return;

      var MS = AF.data.CONFIG.MS_PER_DAY;
      var reportsBefore = state.reports.length;
      var ticked = 0;
      this.acc += dt * this.speed;
      while (this.acc >= MS && ticked < 12) {
        this.acc -= MS;
        AF.systems.gameLoop.advanceDay(state);
        ticked += 1;
        if (state.finished || state.bankrupt) { this.acc = 0; this.speed = 0; break; }
      }
      if (state.reports.length > reportsBefore) AF.core.save.saveLocal(state); // 月末オートセーブ
      AF.core.store.notify(ticked ? 'day' : 'tick');
    }
  };

  AF.core.clock = clock;
})(window.AF);
