// 「人員」パネル: 雇用・解雇と、稼働(通常/残業)。
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util, S = AF.systems;
  function C() { return AF.data.CONFIG; }
  function state() { return AF.core.store.state; }

  function render(st) {
    var req = S.workforce.required(st), costs = S.economy.monthlyCosts(st);
    var cards = C().STAFF_TYPES.map(function (t) {
      var n = st.staff[t.id], need = req[t.id], people = '';
      for (var i = 0; i < Math.max(n, need); i++) {
        people += '<span class="' + (i < n ? '' : 'ghost') + '">' + ui.pix.icon(t.id, 16) + '</span>';
        if (i >= 39) break;
      }
      return '<div class="card"><span class="art">' + ui.pix.icon(t.id, 64) + '</span><span class="body">' +
        '<b>' + t.name + '</b> <span class="big-num ' + (n < need ? 'bad' : '') + '">' + n + '<i>/ 必要 ' + need + '</i></span>' +
        '<span class="people">' + people + '</span>' +
        '<span class="row">' + ui.res('coin', U.fmt(S.economy.wage(st, t.id)) + '/月', '', '月給') +
        '<button class="primary" data-action="staff.hire" data-type="' + t.id + '" ' + (st.hirePool[t.id] < 1 ? 'disabled' : '') + '>雇う ' + U.fmt(C().HIRE_COST[t.id]) + '</button>' +
        '<button data-action="staff.fire" data-type="' + t.id + '" ' + (n < 1 ? 'disabled' : '') + '>減らす</button>' +
        '<span class="res">今月あと ' + st.hirePool[t.id] + ' 人</span></span></span></div>';
    }).join('');

    var shifts = '<div class="seg">' + Object.keys(C().SHIFTS).map(function (id) {
      var sh = C().SHIFTS[id];
      return '<button class="' + (st.shift === id ? 'on' : '') + '" data-action="staff.shift" data-id="' + id + '">' + sh.name +
        '<span class="sub">能力×' + sh.rate + ' 賃金×' + sh.wageMul + '</span></button>';
    }).join('') + '</div>';

    var factor = S.workforce.staffFactor(st, Object.keys(st.facilities));
    return cards + '<h3>稼働</h3>' + shifts +
      '<div class="note">人員係数 <span class="pbar ' + (factor < 1 ? 'warn' : '') + '"><i style="width:' + Math.round(factor * 100) + '%"></i></span> ' + Math.round(factor * 100) + '%' +
      '<br><span class="sub">人が足りないと、すべての設備の能力が落ちます。試験場と検査設備は、動かしていなくても人が要ります。</span></div>' +
      '<div class="note">月末の固定費 ' + ui.coin(costs.wages + costs.upkeep + costs.overhead) +
      '<span class="sub">(賃金 ' + U.fmt(costs.wages) + ' / 維持費 ' + U.fmt(costs.upkeep) + ' / 固定費 ' + U.fmt(costs.overhead) + ')</span></div>';
  }

  ui.on('staff.hire', function (ds) { return S.workforce.hire(state(), ds.type, 1); });
  ui.on('staff.fire', function (ds) { return S.workforce.fire(state(), ds.type, 1); });
  ui.on('staff.shift', function (ds) { state().shift = ds.id; });

  ui.panels.staff = { id: 'staff', label: '人員', icon: 'staff', render: render };
})(window.AF);
