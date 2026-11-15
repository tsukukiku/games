// 「在庫」パネル: 部品・ユニット・完成機の在庫。部品は選んでスポット売却できる。
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util, S = AF.systems;
  function IDX() { return AF.data.index; }
  function state() { return AF.core.store.state; }
  var esc = ui.esc;

  function render(st) {
    var reserved = S.production.reservedParts(st);
    var grid = '<div class="tiles">' + AF.data.PARTS.map(function (p) {
      var n = st.inventory.parts[p.id] || 0;
      return '<button class="tile ' + (ui.form.stockSel === p.id ? 'on ' : '') + (n ? '' : 'empty') + '" data-action="stock.pick" data-id="' + p.id + '" title="' + esc(p.name) + '">' +
        ui.pix.icon(p.id, 32) + '<em>' + n + '</em><span>' + esc(p.name) + '</span></button>';
    }).join('') + '</div>';

    var sel = IDX().parts[ui.form.stockSel], detail = '';
    if (sel) {
      var n = st.inventory.parts[sel.id] || 0, room = S.contracts.spotRemaining(st, sel.id);
      var off = n < 1 || room < 1 ? 'disabled' : '';
      detail = '<div class="order"><div class="row">' + ui.pix.icon(sel.id, 32) + '<b>' + esc(sel.name) + '</b> 在庫 ' + n +
        (reserved[sel.id] ? '<span class="sub">(自社で使う予定 ' + reserved[sel.id] + ')</span>' : '') + '</div>' +
        '<div class="row">スポット売却 ' + ui.coin(S.contracts.spotPrice(st, sel.id)) + '<span class="res">今月あと ' + room + ' 個</span>' +
        '<button data-action="spot.sell" data-id="' + sel.id + '" data-qty="10" ' + off + '>10個</button>' +
        '<button class="primary" data-action="spot.sell" data-id="' + sel.id + '" data-qty="99999" ' + off + '>全部売る</button></div></div>';
    }

    var extra = '';
    if (st.phase >= 2) {
      var units = AF.data.UNITS.filter(function (u) { return (st.inventory.units[u.id] || 0) > 0; }).map(function (u) {
        return '<div class="tile wide static" title="' + esc(u.name) + '">' + ui.pix.icon('unit:' + u.id, 56) + '<em>' + st.inventory.units[u.id] + '</em><span>' + esc(u.name) + '</span></div>';
      }).join('');
      var planes = st.designs.filter(function (d) { return (st.inventory.aircraft[d.id] || 0) > 0; }).map(function (d) {
        return '<div class="tile wide static">' + ui.aircraftPixel.html(d.slots, 110) + '<em>' + st.inventory.aircraft[d.id] + '</em><span>' + esc(d.name) + '</span></div>';
      }).join('');
      extra = '<h3>ユニット</h3><div class="tiles">' + (units || '<p class="hint">なし</p>') + '</div>' +
        '<h3>完成機</h3><div class="tiles">' + (planes || '<p class="hint">なし</p>') + '</div>';
    }
    return '<h3>部品</h3>' + grid + (detail || '<p class="hint">部品を選ぶと、契約なしで売れます(安値・月ごとに上限)。</p>') + extra;
  }

  ui.on('stock.pick', function (ds) { ui.form.stockSel = ds.id; });
  ui.on('spot.sell', function (ds) { return S.contracts.sellSpot(state(), ds.id, Number(ds.qty)); });

  ui.panels.stock = { id: 'stock', label: '在庫', icon: 'stock', render: render };
})(window.AF);
