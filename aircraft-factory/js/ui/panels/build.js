// 「建設」パネル: 設備を選んで、マップの升目に置く。
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util, S = AF.systems;
  function state() { return AF.core.store.state; }

  function render(st) {
    var cards = AF.data.FACILITIES.map(function (f) {
      var n = st.facilities[f.id] || 0, cost = S.facilities.cost(st, f.id);
      var max = n >= f.maxCount, poor = st.funds < cost;
      return '<button class="card build-card" data-action="build.pick" data-id="' + f.id + '" ' + (max ? 'disabled' : '') + '>' +
        '<span class="art">' + ui.pix.icon('fac_' + f.id, f.size[0] > 1 ? 96 : 64) + '</span>' +
        '<span class="body"><b>' + f.name + '</b> <i class="own">×' + n + '</i>' +
        '<span class="sub">' + f.desc + '</span>' +
        '<span class="row">' + ui.coin(cost, poor ? 'bad' : '') +
        (f.capacity ? ui.res('work', f.capacity + '/日', '', '能力(工数/日)') : '') +
        ui.res('skilled', f.staff.skilled, '', '必要な熟練工') + ui.res('general', f.staff.general, '', '必要な一般工') +
        ui.res('clock', '-' + U.fmt(f.upkeep) + '/月', '', '維持費') +
        '<span class="res">' + f.size[0] + '×' + f.size[1] + '升</span>' +
        (max ? ui.tag('上限', 'bad') : '') + '</span></span></button>';
    }).join('');

    var extra = '';
    if (st.phase < 2) {
      var ps = S.progression.phase2Status(st);
      extra = '<div class="note"><b>機体の組立の解放</b><br>' + ps.items.map(function (i) {
        return '<span class="cond ' + (i.ok ? 'ok' : '') + '">' + (i.ok ? '✔ ' : '□ ') + ui.esc(i.label) + '</span>';
      }).join('<br>') + '</div>';
    }
    return '<p class="hint">設備を選ぶと、マップに置けます。置いた設備はタップで選んで移動できます。</p>' + cards + extra;
  }

  ui.on('build.pick', function (ds) {
    var st = state(), f = AF.data.index.facilities[ds.id];
    if (st.funds < S.facilities.cost(st, ds.id)) return { ok: false, reason: '資金が不足しています' };
    ui.map.startPlacing(ds.id);
    ui.hud.open = null;
  });
  // マップのタップから呼ばれる
  ui.on('map.place', function (ds) {
    var st = state(), pl = ui.map.placing;
    if (!pl) return;
    var r = pl.moveUid ? S.facilities.move(st, pl.moveUid, Number(ds.x), Number(ds.y)) : S.facilities.buy(st, pl.type, Number(ds.x), Number(ds.y));
    if (r.ok) ui.map.stopPlacing();
    return r;
  });
  ui.on('map.cancel', function () { ui.map.stopPlacing(); });
  ui.on('fac.move', function (ds) {
    var p = state().layout.filter(function (q) { return q.uid === ds.uid; })[0];
    if (p) ui.map.startPlacing(p.type, p.uid);
  });
  ui.on('fac.jobs', function (ds) { ui.form.job.facility = ds.type; ui.form.job.item = ''; ui.hud.open = 'jobs'; ui.map.selected = null; });
  ui.on('fac.close', function () { ui.map.selected = null; });

  ui.panels.build = { id: 'build', label: '建設', icon: 'build', render: render };
})(window.AF);
