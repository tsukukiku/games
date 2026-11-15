// 画面中央の窓。開始画面と、終了画面(期間満了・倒産)。
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util;
  var modal = {};

  modal.show = function (html) {
    var root = document.getElementById('modal-root');
    root.innerHTML = '<div class="modal-back"><div class="modal">' + html + '</div></div>';
  };
  modal.close = function () { document.getElementById('modal-root').innerHTML = ''; };
  modal.isOpen = function () { return !!document.getElementById('modal-root').firstChild; };

  modal.showStart = function () {
    ui.form.startName = AF.data.CONFIG.DEFAULT_COMPANY_NAME;
    var hasSave = AF.core.save.hasLocal();
    modal.show(
      '<h1>航空部品工場 1939–1941</h1>' +
      '<p>1939年9月。あなたは小さな航空機部品工場の社長です。部品の下請けから始め、設備を整え、やがて自社で機体を組み立てます。期間は1941年12月までの28か月。資金のマイナスが続くと倒産です。</p>' +
      '<label class="field">会社名<input type="text" id="start-name" maxlength="30" data-input="startName" value="' + ui.esc(ui.form.startName) + '"></label>' +
      '<div class="modal-buttons">' +
      '<button class="primary" data-action="game.new">新しく始める</button>' +
      (hasSave ? '<button data-action="game.loadLocal">セーブから再開</button>' : '') +
      '<button data-action="save.import">JSONを読み込む</button>' +
      '</div>' +
      '<p class="sub">時間は止まった状態で始まります。右上の ▶ で進みます。マップはドラッグで移動、ホイールやピンチで拡大縮小できます。</p>'
    );
  };

  modal.showEnd = function (state) {
    var score = state.score || AF.systems.progression.computeScore(state);
    var title = state.bankrupt ? '倒産' : '1941年12月 — 区切り';
    var lead = state.bankrupt
      ? U.formatDate(state.day) + '、資金繰りが尽き、' + ui.esc(state.companyName) + ' は工場を閉じた。'
      : ui.esc(state.companyName) + ' は28か月を乗り切った。';
    modal.show(
      '<h1>' + title + '</h1><p>' + lead + '</p>' +
      '<table class="grid"><tbody>' +
      '<tr><td>機体市場のシェア</td><td class="num">' + score.aircraftShare.toFixed(3) + ' %</td></tr>' +
      '<tr><td>部品市場のシェア</td><td class="num">' + score.partsShare.toFixed(3) + ' %</td></tr>' +
      '<tr><td>総生産機数(納入 ' + score.aircraftDelivered + ' 機)</td><td class="num">' + score.aircraftProduced + ' 機</td></tr>' +
      '<tr><td>研究済みノード数</td><td class="num">' + score.researchCount + '</td></tr>' +
      '<tr><td>戦況への貢献</td><td class="num">' + score.contribution + '</td></tr>' +
      '<tr><td>最終資金</td><td class="num">' + U.money(state.funds) + '</td></tr>' +
      '<tr class="total"><td>最終スコア</td><td class="num">' + U.fmt(score.total) + '</td></tr>' +
      '</tbody></table>' +
      '<div class="modal-buttons"><button class="primary" data-action="game.restart">最初からやり直す</button>' +
      '<button data-action="modal.close">記録を見る</button></div>'
    );
  };

  ui.modal = modal;
})(window.AF);
