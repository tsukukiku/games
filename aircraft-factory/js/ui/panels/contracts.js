// 「受注」パネル: 提示中の契約、受注中の契約、履歴。カードで見せる。
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util, S = AF.systems;
  function IDX() { return AF.data.index; }
  function state() { return AF.core.store.state; }
  var esc = ui.esc;

  function icon(c) { return c.kind === 'part' ? ui.pix.icon(c.itemId, 48) : ui.pix.icon('plane', 48); }
  function deadline(st, c) {
    var left = c.deadlineDay - st.day + 1;
    var cls = left <= 0 ? 'bad' : left <= 7 ? 'warn' : '';
    return ui.res('clock', left > 0 ? 'あと' + left + '日' : (1 - left) + '日超過', cls, '納期 ' + U.formatDate(c.deadlineDay));
  }
  // 受けられるかの目印: 部品は設備と研究、機体は適合する設計
  function condition(st, c) {
    if (c.kind === 'part') {
      var p = IDX().parts[c.itemId], ok = S.production.canMakePart(st, p.id);
      return ui.pix.icon('fac_' + p.facility, 32) + ui.res('work', U.fmt1(p.work * c.qty), '', '工数') +
        (ok ? '' : ui.tag(st.facilities[p.facility] > 0 ? '研究が必要' : '設備なし', 'bad'));
    }
    var fit = S.aircraft.eligibleDesigns(st, c.minSpec);
    return '<span class="spec">' + ui.specText(c.minSpec) + ' 以上</span>' +
      (fit.length ? ui.tag('適合: ' + fit[0].design.name, 'good') : ui.tag('適合する設計なし', 'bad'));
  }

  function offerCard(st, c) {
    return '<div class="card contract ' + c.kind + '"><span class="art">' + icon(c) + '</span><span class="body">' +
      '<b>' + esc(c.name) + ' ×' + c.qty + '</b><span class="sub">' + esc(IDX().companies[c.buyerId].name) + '</span>' +
      '<span class="row">' + ui.coin(c.qty * c.unitPrice) + '<span class="sub">@' + U.fmt1(c.unitPrice) + '</span>' + deadline(st, c) + '</span>' +
      '<span class="row">' + condition(st, c) + '</span></span>' +
      '<span class="btns"><button class="primary" data-action="contract.accept" data-id="' + c.id + '">受注</button>' +
      '<button data-action="contract.decline" data-id="' + c.id + '">見送る</button></span></div>';
  }
  function activeCard(st, c) {
    var can = S.contracts.deliverable(st, c);
    return '<div class="card contract ' + c.kind + (c.late ? ' late' : '') + '"><span class="art">' + icon(c) + '</span><span class="body">' +
      '<b>' + esc(c.name) + '</b><span class="sub">' + esc(IDX().companies[c.buyerId].name) + '</span>' +
      '<span class="row"><span class="pbar wide"><i style="width:' + Math.round(c.delivered / c.qty * 100) + '%"></i></span> ' + c.delivered + '/' + c.qty + '</span>' +
      '<span class="row">' + deadline(st, c) + (c.late ? ui.tag('納期超過', 'bad') : '') + ui.coin((c.qty - c.delivered) * c.unitPrice * ((c.late ? AF.data.CONFIG.CONTRACT.latePriceMul : 1) - (c.advanceRate || 0))) +
      (c.kind === 'aircraft' ? '<span class="spec">' + ui.specText(c.minSpec) + '</span>' : '') + '</span></span>' +
      '<span class="btns"><button class="primary" data-action="contract.deliver" data-id="' + c.id + '" ' + (can > 0 ? '' : 'disabled') + '>納入' + (can > 0 ? ' ' + can : '') + '</button></span></div>';
  }

  var RESULT = { done: ['完納', 'good'], done_late: ['遅れて完納', 'warn'], failed: ['打ち切り', 'bad'] };

  function render(st) {
    var total = st.contractStats.onTime + st.contractStats.late + st.contractStats.failed;
    var offers = st.contracts.offers.map(function (c) { return offerCard(st, c); }).join('');
    var active = st.contracts.active.slice().sort(function (a, b) { return a.deadlineDay - b.deadlineDay; }).map(function (c) { return activeCard(st, c); }).join('');
    var history = st.contracts.history.slice(0, 8).map(function (c) {
      var r = RESULT[c.status] || [c.status, ''];
      return '<div class="hist">' + (c.kind === 'part' ? ui.pix.icon(c.itemId, 16) : ui.pix.icon('plane', 16)) + esc(c.name) + ' ' + c.delivered + '/' + c.qty + ' ' + ui.tag(r[0], r[1]) + '</div>';
    }).join('');
    return '<h3>今月の提示 <i>' + st.contracts.offers.length + '件</i></h3>' + (offers || '<p class="hint">提示はもうありません。翌月1日に新しい契約が届きます。</p>') +
      '<h3>受注中 <i>' + st.contracts.active.length + '件 / 納期達成率 ' + (total ? Math.round(S.contracts.onTimeRate(st) * 100) + '%' : '—') + '</i></h3>' +
      (active || '<p class="hint">受注中の契約はありません。</p>') +
      '<label class="toggle"><input type="checkbox" data-change="contract.auto" ' + (st.autoDeliver ? 'checked' : '') + '><span></span>完成したら自動で納入する</label>' +
      '<p class="hint">受けなかった契約は月末に流れます。機体契約は受注時に前渡金 ' + Math.round(AF.data.CONFIG.CONTRACT.aircraftAdvanceRate * 100) + '% を受け取ります。</p>' +
      (history ? '<h3>履歴</h3>' + history : '');
  }

  ui.on('contract.accept', function (ds) { return S.contracts.accept(state(), ds.id); });
  ui.on('contract.decline', function (ds) { return S.contracts.decline(state(), ds.id); });
  ui.on('contract.deliver', function (ds) { return S.contracts.deliver(state(), ds.id); });
  ui.on('contract.auto', function (ds, el) { state().autoDeliver = el.checked; });

  ui.panels.contracts = { id: 'contracts', label: '受注', icon: 'contracts', render: render,
    badge: function (st) { return st.contracts.offers.length || ''; } };
})(window.AF);
