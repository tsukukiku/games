// 画面全体の組み立て。描き直しのタイミング、通知と演出、ゲームの開始・終了、キー操作。
// 構成: 上部バー(hud) / 左のボタン列(sidebar) / マップ(map、常に描画) / 引き出し(drawer、パネル)
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util;

  var app = { lastLogSeq: 0, lastFxSeq: 0, endShown: false, _lastRender: 0, _pending: null, _rendering: false, _again: false };

  app.init = function () {
    document.getElementById('app').innerHTML =
      '<header id="hud"></header><nav id="sidebar"></nav>' +
      '<div id="stage"><canvas id="map"></canvas>' +
      '<aside id="drawer" class="drawer"><div id="drawer-head"></div><div id="drawer-body"></div></aside>' +
      '<div id="overlay"></div></div>';
    ['pop-root', 'flash-root', 'scene-root'].forEach(function (id) {
      var el = document.createElement('div'); el.id = id; document.body.appendChild(el);
    });
    ui.bindGlobal(document.body);
    ui.map.init(document.getElementById('map'));

    // JSONファイルの読み込み
    var file = document.getElementById('import-file');
    file.addEventListener('change', function () {
      if (!file.files || !file.files[0]) return;
      AF.core.save.importFile(file.files[0], function (r) {
        file.value = '';
        if (!r.ok) { ui.toast(r.reason, 'bad'); return; }
        app.loadState(r.state);
        ui.toast('JSONを読み込みました。', 'good');
      });
    });

    // スペース: 一時停止/再開。Esc: 設置をやめる → シーンを閉じる → パネルを閉じる。
    document.addEventListener('keydown', function (e) {
      if (!AF.core.store.state || ui.modal.isOpen()) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (e.code === 'Escape') {
        if (ui.scenes.current) ui.scenes.close();
        else if (ui.map.placing) ui.map.stopPlacing();
        else if (ui.map.selected) ui.map.selected = null;
        else ui.hud.open = null;
        AF.core.store.notify('action');
      } else if (e.code === 'Space' && tag !== 'input' && tag !== 'button' && !ui.scenes.current) {
        e.preventDefault();
        AF.core.clock.setSpeed(AF.core.clock.speed === 0 ? 1 : 0);
      }
    });

    AF.core.store.subscribe(function (reason) { app.onStore(reason); });
    AF.core.clock.start();
    ui.modal.showStart();
  };

  // state を差し替えて始める(新規・ロード共通)
  app.loadState = function (state) {
    AF.core.clock.reset();
    app.lastLogSeq = state.logSeq;
    app.lastFxSeq = state.fxSeq;
    app.endShown = false;
    ui.hud.shownFunds = state.funds;
    ui.hud.open = null;
    ui.map.placing = null; ui.map.selected = null;
    ui.mapFx.reset(state);
    Object.keys(ui.panels).forEach(function (id) { if (ui.panels[id].onStateLoaded) ui.panels[id].onStateLoaded(state); });
    ui.modal.close();
    AF.core.store.setState(state);
    ui.map.center();
  };

  app.onStore = function (reason) {
    if (!AF.core.store.state || reason === 'tick') return;   // 日の途中の動きはマップ側の毎コマ描画が受け持つ
    if (reason === 'day') {
      // 高速時は描き直しを間引く
      var now = Date.now();
      if (now - app._lastRender < 200) {
        if (!app._pending) app._pending = setTimeout(function () { app._pending = null; app.onStore('day'); }, 220);
        return;
      }
    }
    app.render();
  };

  // 描き直し。入れ子で呼ばれたら、終わってからやり直す。
  app.render = function () {
    if (app._rendering) { app._again = true; return; }
    app._rendering = true;
    try { app._renderNow(); } finally { app._rendering = false; }
    if (app._again) { app._again = false; app.render(); }
  };

  app._renderNow = function () {
    var state = AF.core.store.state;
    if (!state) return;
    app._lastRender = Date.now();
    ui.setHtml(document.getElementById('hud'), ui.hud.renderTop(state));
    document.getElementById('sidebar').innerHTML = ui.hud.renderSidebar(state);
    ui.hud.renderDrawer(state);
    document.getElementById('overlay').innerHTML = overlayHtml(state);
    ui.aircraftPixel.paintAll();
    app.flush(state);

    if ((state.finished || state.bankrupt) && !app.endShown) {
      app.endShown = true;
      ui.modal.showEnd(state);
    }
  };

  // マップの下に出す札: 設置の案内、または選んだ設備
  function overlayHtml(state) {
    var IDX = AF.data.index, map = ui.map;
    if (map.placing) {
      var f = IDX.facilities[map.placing.type];
      return '<div>' + ui.pix.icon('fac_' + f.id, 48) + '<span><b>' + f.name + '</b> を置く升目をタップ' +
        (map.placing.moveUid ? '' : ' ' + ui.coin(AF.systems.facilities.cost(state, f.id))) + '</span>' +
        '<button data-action="map.cancel">やめる</button></div>';
    }
    var p = map.selected && state.layout.filter(function (q) { return q.uid === map.selected; })[0];
    if (p) {
      var fac = IDX.facilities[p.type];
      var cap = fac.capacity ? ui.res('work', U.fmt1(AF.systems.facilities.capacity(state, p.type)) + '/日', '', 'この種類の設備全体の能力') : '';
      return '<div>' + ui.pix.icon('fac_' + p.type, 48) + '<span><b>' + fac.name + '</b> ' + cap + '</span>' +
        (fac.capacity ? '<button class="primary" data-action="fac.jobs" data-type="' + p.type + '">ここで作る</button>' : '') +
        '<button data-action="fac.move" data-uid="' + p.uid + '">移動</button><button data-action="fac.close">×</button></div>';
    }
    return '';
  }

  // 新しい出来事を、通知と演出にする
  app.flush = function (state) {
    var fresh = state.log.filter(function (l) { return l.seq > app.lastLogSeq && l.level !== 'info'; });
    app.lastLogSeq = state.logSeq;
    fresh.slice(-3).forEach(function (l) { ui.toast(l.text, l.level); });

    var pay = 0;
    state.fx.forEach(function (e) {
      if (e.seq <= app.lastFxSeq) return;
      if (e.type === 'deliver') pay += e.pay;
      if (e.type === 'research') app.flash('研究完了', AF.data.index.research[e.id].name);
      if (e.type === 'phase2') app.flash('解放', '機体の組立');
    });
    app.lastFxSeq = state.fxSeq;
    if (pay > 0) ui.hud.pop('+' + U.fmt(pay), true);
  };

  // 画面中央の大きな知らせ
  app.flash = function (small, big) {
    var root = document.getElementById('flash-root'), el = document.createElement('div');
    el.className = 'flash';
    el.innerHTML = ui.esc(small) + '<b>' + ui.esc(big) + '</b>';
    root.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2400);
  };

  // ---- 操作 ----
  ui.on('game.new', function () {
    var name = String(ui.form.startName || '').trim() || AF.data.CONFIG.DEFAULT_COMPANY_NAME;
    app.loadState(AF.core.state.create(name.slice(0, 30), Date.now() % 2147483647));
  });
  ui.on('game.loadLocal', function () {
    var r = AF.core.save.loadLocal();
    if (r.ok) app.loadState(r.state);
    return r;
  });
  ui.on('game.restart', function () { ui.modal.showStart(); });
  ui.on('modal.close', function () { ui.modal.close(); });

  ui.app = app;
})(window.AF);
