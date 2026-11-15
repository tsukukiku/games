// 操作の受け口。HTML側は属性で操作名を指定し、ここでまとめて拾う(個別に addEventListener しない)。
//   <button data-action="facility.buy" data-id="lathe">   … クリックで ui.actions['facility.buy'](dataset, 要素)
//   <select data-change="job.kind">                        … 値が変わったら ui.actions['job.kind'](dataset, 要素)
//   <input data-input="job.qty">                           … 入力のたびに ui.form.job.qty へ書くだけ(再描画しない)
//   <input data-input="job.qty" data-live="job.info">      … さらに ui.live['job.info']() を呼び、画面の一部だけ更新する
// 入力欄に data-change を付けて全体を描き直すのは避ける(入力直後のボタンのクリックが、描き直しで消えてしまうため)。
// 操作の関数が { ok: false, reason } を返したら、reason を通知に出す。操作のあとは画面を描き直す。
(function (AF) {
  'use strict';
  var ui = AF.ui;

  ui.actions = {};
  ui.on = function (name, fn) { ui.actions[name] = fn; };
  ui.live = {};

  function run(name, el) {
    var fn = ui.actions[name];
    if (!fn) { console.warn('未定義の操作: ' + name); return; }
    var result = fn(el.dataset, el);
    if (result && result.ok === false && result.reason) ui.toast(result.reason, 'warn');
    AF.core.store.notify('action');
  }

  // 属性を介さずに操作を呼ぶ(マップのタップなど)
  ui.run = function (name, ds) { run(name, { dataset: ds || {} }); };

  ui.bindGlobal = function (root) {
    root.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el || el.disabled) return;
      run(el.dataset.action, el);
    });
    root.addEventListener('change', function (e) {
      var el = e.target.closest('[data-change]');
      if (el) run(el.dataset.change, el);
    });
    root.addEventListener('input', function (e) {
      var el = e.target.closest('[data-input]');
      if (!el) return;
      ui.setFormValue(el.dataset.input, el.dataset.numeric != null ? (parseInt(el.value, 10) || 0) : el.value);
      if (el.dataset.live && ui.live[el.dataset.live]) ui.live[el.dataset.live]();
    });
  };
})(window.AF);
