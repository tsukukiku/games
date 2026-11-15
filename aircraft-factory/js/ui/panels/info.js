// 情報を見るだけのパネル: 「市場・戦況」「月報」「システム(セーブ・デバッグ)」。
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util, S = AF.systems;
  function state() { return AF.core.store.state; }
  var esc = ui.esc;

  // ================= 市場・戦況 =================
  function renderMarket(st) {
    var mi = U.monthIndex(Math.min(st.day, U.totalDays() - 1)), score = S.progression.computeScore(st);
    var rows = AF.data.COMPANIES.filter(function (c) { return c.type !== 'agency'; }).map(function (c) {
      var r = st.rivals[c.id], rel = st.relations[c.id];
      return '<tr><td><b>' + esc(c.name) + '</b><div class="sub">' + esc(c.focus) + '</div></td>' +
        '<td class="num">' + (r ? r.capacity : '—') + '</td><td class="num">' + (r ? r.tech : '—') + '</td>' +
        '<td><span class="pbar ' + (rel < 35 ? 'warn' : '') + '"><i style="width:' + Math.round(rel) + '%"></i></span> ' + Math.round(rel) + '</td></tr>';
    });
    var fronts = AF.data.FRONTS.map(function (f) {
      var fs = st.war.fronts[f.id];
      return '<div class="row"><b>' + f.name + '</b>' + (fs.open ? '<span class="pbar wide"><i style="width:' + Math.round(fs.value) + '%"></i></span> ' + Math.round(fs.value) : '<span class="sub">未開戦</span>') + '</div>';
    }).join('');
    return '<div class="note">' + ui.res('plane', U.fmt(U.curveAt(AF.data.MARKET.aircraftCurve, mi)) + ' 機/月', '', 'RLMの総発注量(目安)') +
      '<br>自社の機体納入 <b>' + st.totals.aircraftDelivered + '</b> 機(シェア ' + score.aircraftShare.toFixed(3) + '%)' +
      '<br>自社の部品売上 ' + ui.coin(st.totals.partsRevenue) + '(シェア ' + score.partsShare.toFixed(3) + '%)</div>' +
      '<h3>各社との関係</h3>' + ui.table(['会社', '#生産', '#技術', '関係'], rows) +
      '<p class="hint">納期内に納めると関係が良くなります。' + AF.data.CONFIG.UNIT_BUY_MIN_RELATION + ' を下回ると、その会社のユニットを買えません。</p>' +
      '<h3>戦況</h3>' + fronts + '<p class="hint">戦況の変動・史実イベント・任務の結果は、次の段階で動きます。</p>';
  }

  // ================= 月報 =================
  function ledgerRows(map, sign) {
    var labels = S.monthEnd.LEDGER_LABELS;
    return Object.keys(map).filter(function (k) { return Math.abs(map[k]) >= 0.5; }).map(function (k) {
      return '<tr><td>' + esc(labels[k] || k) + '</td><td class="num">' + sign + U.fmt(map[k]) + '</td></tr>';
    }).join('');
  }
  // 資金の推移の棒グラフ(月ごと)
  function fundsChart(st) {
    if (!st.reports.length) return '';
    var max = 1;
    st.reports.forEach(function (r) { max = Math.max(max, Math.abs(r.fundsEnd)); });
    return '<div class="chart">' + st.reports.map(function (r) {
      var h = Math.max(2, Math.round(Math.abs(r.fundsEnd) / max * 56));
      return '<i class="' + (r.fundsEnd < 0 ? 'neg' : '') + '" style="height:' + h + 'px" title="' + r.label + ' ' + U.fmt(r.fundsEnd) + ' RM"></i>';
    }).join('') + '</div>';
  }
  function reportCard(r) {
    var s = r.stats;
    return '<div class="card report"><span class="body"><b>' + r.label + '</b> <span class="big-num ' + (r.net < 0 ? 'bad' : 'good') + '">' + (r.net >= 0 ? '+' : '') + U.fmt(r.net) + '</span>' +
      '<span class="row">' + ui.coin(r.fundsEnd) + ui.res('star', Math.floor(r.rlmRating) + '(' + (r.ratingDelta >= 0 ? '+' : '') + U.fmt1(r.ratingDelta) + ')') +
      ui.res('jobs', s.partsProduced, '', '部品の生産') + ui.res('plane', s.aircraftDelivered, '', '機体の納入') +
      ui.res('contracts', s.contractsDone + '/' + s.contractsLate + '/' + s.contractsFailed, '', '契約: 納期内/遅れ/打ち切り') + '</span>' +
      '<table class="grid"><tbody>' + ledgerRows(r.income, '+') + ledgerRows(r.expense, '−') + '</tbody></table></span></div>';
  }
  function renderReport(st) {
    var cards = st.reports.slice().reverse().slice(0, 6).map(reportCard).join('');
    var log = st.log.slice(-30).reverse().map(function (l) {
      return '<div class="hist ' + (l.level === 'bad' ? 'bad' : l.level === 'good' ? 'good' : '') + '"><i>' + U.formatDate(l.day).slice(5) + '</i> ' + esc(l.text) + '</div>';
    }).join('');
    return '<h3>資金の推移</h3>' + (fundsChart(st) || '<p class="hint">最初の月報は月末に出ます。</p>') + cards + '<h3>出来事</h3>' + log;
  }

  // ================= システム =================
  function renderSystem(st) {
    return '<div class="note"><b>' + esc(st.companyName) + '</b><br>' + U.formatDate(Math.min(st.day, U.totalDays() - 1)) + '(第' + (U.monthIndex(st.day) + 1) + '月 / 全' + AF.data.CONFIG.TOTAL_MONTHS + '月)</div>' +
      '<div class="row"><button class="primary big" data-action="save.local">セーブ</button><button class="big" data-action="load.local">ロード</button></div>' +
      '<div class="row"><button data-action="save.export">JSONに書き出す</button><button data-action="save.import">JSONを読み込む</button></div>' +
      '<p class="hint">月末ごとに自動でセーブされます。</p>' +
      '<div class="row"><button data-action="map.center">マップを中央にもどす</button></div>' +
      '<h3>デバッグ</h3><label class="toggle"><input type="checkbox" data-change="debug.toggle" ' + (st.debug ? 'checked' : '') + '><span></span>デバッグモード(60倍速)</label>' +
      (st.debug ? '<div class="row"><button data-action="debug.unlock">全解放</button><button data-action="debug.funds">+50,000</button><button data-action="debug.skip">30日進める</button></div>' : '');
  }

  ui.on('save.local', function () {
    var r = AF.core.save.saveLocal(state());
    if (r.ok) ui.toast('セーブしました。', 'good');
    return r;
  });
  ui.on('load.local', function () {
    var r = AF.core.save.loadLocal();
    if (r.ok) { ui.app.loadState(r.state); ui.toast('ロードしました。', 'good'); }
    return r;
  });
  ui.on('save.export', function () { return AF.core.save.exportFile(state()); });
  ui.on('save.import', function () { document.getElementById('import-file').click(); });
  ui.on('map.center', function () { ui.map.center(); });
  ui.on('debug.toggle', function (ds, el) { AF.dev.setDebug(el.checked); });
  ui.on('debug.unlock', function () { AF.dev.unlockAll(); });
  ui.on('debug.funds', function () { AF.dev.addFunds(50000); });
  ui.on('debug.skip', function () { AF.dev.skipDays(30); });

  ui.panels.market = { id: 'market', label: '市場', icon: 'market', render: renderMarket };
  ui.panels.report = { id: 'report', label: '月報', icon: 'report', render: renderReport };
  ui.panels.system = { id: 'system', label: '設定', icon: 'system', render: renderSystem };
})(window.AF);
