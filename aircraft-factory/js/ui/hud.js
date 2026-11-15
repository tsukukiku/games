// 常に出ている部分: 上部の資源バー、左のボタン列、ボタンから開くパネル(引き出し)。
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util;
  var hud = { shownFunds: null, open: null };

  // 左のボタンの並び(ui.panels に登録されたパネルのid)
  var SIDEBAR = ['build', 'jobs', 'stock', 'shop', 'staff', 'contracts', 'research', 'design', 'market', 'report', 'system'];

  // ---- 上部バー: 日付・資金・評価・資材・人員・速度 ----
  hud.renderTop = function (st) {
    var C = AF.data.CONFIG, clock = AF.core.clock, S = AF.systems;
    var d = U.dateOf(Math.min(st.day, U.totalDays() - 1));
    if (hud.shownFunds == null) hud.shownFunds = st.funds;
    var req = S.workforce.required(st);

    var mats = AF.data.MATERIALS.map(function (m) {
      var n = Math.floor(st.materials[m.id] || 0), quota = Math.floor(S.economy.quotaAvailable(st, m.id));
      return '<button class="chip" data-action="panel.open" data-panel="shop" title="' + m.name + ' 在庫 ' + n + m.unit + ' / 買える枠 ' + quota + '">' +
        ui.pix.icon(m.id, 32) + '<span><b class="' + (n < 1 ? 'bad' : '') + '">' + U.fmt(n) + '</b><i>枠' + U.fmt(quota) + '</i></span></button>';
    }).join('');
    var staff = C.STAFF_TYPES.map(function (t) {
      return '<button class="chip" data-action="panel.open" data-panel="staff" title="' + t.name + ' 在籍 / 全設備に必要">' +
        ui.pix.icon(t.id, 32) + '<span><b class="' + (st.staff[t.id] < req[t.id] ? 'bad' : '') + '">' + st.staff[t.id] + '</b><i>/' + req[t.id] + '</i></span></button>';
    }).join('');

    var speeds = C.SPEEDS.slice();
    if (st.debug) speeds.push(C.DEBUG_SPEED);
    var speedBtns = '<button class="spd ' + (clock.speed === 0 ? 'on' : '') + '" data-action="speed.set" data-speed="0" title="一時停止(スペース)">❚❚</button>' +
      speeds.map(function (s) {
        return '<button class="spd ' + (clock.speed === s ? 'on' : '') + '" data-action="speed.set" data-speed="' + s + '" title="' + s + '倍">' +
          (s === 1 ? '▶' : s === 2 ? '▶▶' : s === 4 ? '▶▶▶' : '×' + s) + '</button>';
      }).join('');

    return '<div class="hud-date"><b>' + d.year + '.' + d.month + '.' + d.day + '</b>' +
      '<span class="daybar"><i id="daybar-fill" style="width:' + Math.round(clock.fraction() * 100) + '%"></i></span>' +
      '<i>' + (st.phase >= 2 ? '機体の組立' : '部品の製造') + '</i></div>' +
      '<div class="chip money ' + (st.funds < 0 ? 'neg' : '') + '" title="資金(RM)">' + ui.pix.icon('coin', 32) +
      '<span><b id="hud-funds">' + U.fmt(hud.shownFunds) + '</b><i>' + (st.funds < 0 ? '倒産まで' + (C.BANKRUPTCY_DAYS - st.negativeDays) + '日' : 'RM') + '</i></span></div>' +
      '<div class="chip" title="RLM評価(0〜100)">' + ui.pix.icon('star', 32) + '<span><b>' + Math.floor(st.rlmRating) + '</b><i>評価</i></span></div>' +
      '<div class="hud-group">' + mats + '</div><div class="hud-group">' + staff + '</div>' +
      '<div class="hud-speed">' + speedBtns + '</div>';
  };

  // 毎コマ: 資金の数字をなめらかに追いつかせ、日の進み具合の棒を動かす
  hud.tick = function (st, dt) {
    var diff = st.funds - hud.shownFunds;
    if (Math.abs(diff) > 0.5) {
      hud.shownFunds += Math.abs(diff) < 3 ? diff : diff * Math.min(1, dt / 220);
      var el = document.getElementById('hud-funds');
      if (el) el.textContent = U.fmt(hud.shownFunds);
    }
    var bar = document.getElementById('daybar-fill');
    if (bar) bar.style.width = Math.round(AF.core.clock.fraction() * 100) + '%';
  };

  // 資金のそばに「+1,980」などを浮かせる
  hud.pop = function (text, good) {
    var root = document.getElementById('pop-root'), anchor = document.getElementById('hud-funds');
    if (!root || !anchor) return;
    var r = anchor.getBoundingClientRect(), el = document.createElement('div');
    el.className = 'money-pop ' + (good ? 'good' : 'bad');
    el.textContent = text;
    el.style.left = Math.round(r.left) + 'px';
    el.style.top = Math.round(r.bottom + 2 + root.children.length * 14) + 'px';
    root.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1300);
  };

  // ---- 左のボタン列 ----
  hud.renderSidebar = function (st) {
    return SIDEBAR.map(function (id) {
      var p = ui.panels[id];
      if (!p) return '';
      var badge = p.badge ? p.badge(st) : '';
      return '<button class="side-btn ' + (hud.open === id ? 'on' : '') + '" data-action="panel.open" data-panel="' + id + '" title="' + p.label + '">' +
        ui.pix.icon(p.icon, 32) + '<span>' + p.label + '</span>' + (badge ? '<em>' + badge + '</em>' : '') + '</button>';
    }).join('');
  };

  // ---- 引き出し(パネル) ----
  hud.renderDrawer = function (st) {
    var el = document.getElementById('drawer');
    var p = hud.open && ui.panels[hud.open];
    el.className = 'drawer ' + (p ? 'open w-' + (p.width || 'm') : '');
    if (!p) return;
    document.getElementById('drawer-head').innerHTML = ui.pix.icon(p.icon, 32) + '<h2>' + p.label + '</h2>' +
      '<button class="close" data-action="panel.close" title="とじる">×</button>';
    ui.setHtml(document.getElementById('drawer-body'), p.render(st));
  };

  ui.on('panel.open', function (ds) {
    hud.open = hud.open === ds.panel ? null : ds.panel;
    var body = document.getElementById('drawer-body');
    if (body) body.scrollTop = 0;
  });
  ui.on('panel.close', function () { hud.open = null; });
  ui.on('speed.set', function (ds) { AF.core.clock.setSpeed(Number(ds.speed)); });

  ui.panels = ui.panels || {};
  ui.hud = hud;
})(window.AF);
