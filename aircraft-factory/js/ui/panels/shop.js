// 「資材」パネル(資材購入の専用パネル): 割当枠から資材を買う。フェーズ2からは他社製ユニットの調達もここ。
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util, S = AF.systems;
  function IDX() { return AF.data.index; }
  function state() { return AF.core.store.state; }
  var esc = ui.esc;

  function render(st) {
    var cards = AF.data.MATERIALS.map(function (m) {
      var stock = st.materials[m.id] || 0, base = Math.floor(st.quotaBase[m.id] || 0), grant = Math.floor(st.quotaGrant[m.id] || 0);
      var avail = base + grant, full = S.economy.monthlyQuota(st, m.id) || 1;
      var scar = S.economy.scarcity(st, m.id);
      function btn(q, label, cls) {
        var cost = Math.min(q, avail) * m.price;
        return '<button class="' + (cls || '') + '" data-action="material.buy" data-id="' + m.id + '" data-qty="' + q + '" ' + (avail < 1 ? 'disabled' : '') + ' title="' + U.fmt(cost) + ' RM">' + label + '</button>';
      }
      return '<div class="card mat-card"><span class="art">' + ui.pix.icon(m.id, 64) + '</span><span class="body">' +
        '<b>' + m.name + '</b> <span class="big-num">' + U.fmt(stock) + '<i>' + m.unit + '</i></span>' +
        (scar < 0.95 ? ui.tag('逼迫 ' + Math.round(scar * 100) + '%', 'warn') : '') +
        '<span class="quota" title="今月の割当の残り ' + base + ' / 契約の割当の残り ' + grant + '">' +
        '<span class="pbar"><i style="width:' + Math.round(Math.min(1, base / full) * 100) + '%"></i></span>' +
        '<span class="sub">今月の枠 ' + U.fmt(base) + (grant ? ' ＋ 契約の枠 ' + U.fmt(grant) : '') + '</span></span>' +
        '<span class="row">' + ui.res('coin', m.price.toFixed(1) + '/' + m.unit) + btn(50, '+50') + btn(200, '+200') + btn(avail, '枠いっぱい', 'primary') + '</span>' +
        '</span></div>';
    }).join('');

    var auto = '<label class="toggle"><input type="checkbox" data-change="material.auto" ' + (st.autoBuy ? 'checked' : '') + '><span></span>生産を始めるとき、足りない分を自動で買う</label>';

    var market = '';
    if (st.phase >= 2) {
      market = '<h3>ユニットの調達(他社から購入)</h3><div class="tiles">' + AF.data.UNITS.filter(function (u) { return u.purchasable; }).map(function (u) {
        var can = S.aircraft.canBuyUnit(st, u.id), left = st.unitMarket[u.id] || 0;
        var off = !can.ok || left < 1 || st.funds < u.buyPrice;
        var supplier = u.supplier === 'market' ? '一般市場' : IDX().companies[u.supplier].name;
        return '<button class="tile wide buy" data-action="unit.buy" data-id="' + u.id + '" ' + (off ? 'disabled' : '') + ' title="' + esc(u.name + ' / ' + supplier + (can.ok ? '' : ' / ' + can.reason)) + '">' +
          ui.pix.icon('unit:' + u.id, 56) + '<em>残' + left + '</em><span>' + esc(u.name) + '</span>' + ui.coin(u.buyPrice, st.funds < u.buyPrice ? 'bad' : '') + '</button>';
      }).join('') + '</div><p class="hint">買ったユニットは在庫に入ります。月ごとに買える数が決まっています。</p>';
    }
    return cards + auto +
      '<p class="hint">資材は割当制です。「今月の枠」は毎月もどり、「契約の枠」は受注したときに付きます。</p>' + market;
  }

  ui.on('material.buy', function (ds) {
    var r = S.economy.buyMaterial(state(), ds.id, Number(ds.qty));
    if (r.ok) ui.hud.pop('-' + U.fmt(r.cost), false);
    return r;
  });
  ui.on('material.auto', function (ds, el) { state().autoBuy = el.checked; });
  ui.on('unit.buy', function (ds) {
    var r = S.aircraft.buyUnit(state(), ds.id, 1);
    if (r.ok) ui.hud.pop('-' + U.fmt(IDX().units[ds.id].buyPrice), false);
    return r;
  });

  ui.panels.shop = { id: 'shop', label: '資材', icon: 'shop', render: render };
})(window.AF);
