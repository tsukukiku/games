// 画面づくりの小道具。HTMLは文字列で組み立て、tab-body などへ流し込む。
(function (AF) {
  'use strict';
  var ui = AF.ui;

  // 画面だけが持つ入力途中の値(セーブしない)。data-input="job.qty" のように経路で書き込む。
  ui.form = {
    startName: '',
    job: { facility: '', kind: 'part', item: '', qty: 20 },
    design: { id: null, name: '', slots: {} },
    stockSel: '',
    research: { tree: 'parts', sel: '' }
  };

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  ui.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return ESC[ch]; }); };
  ui.$ = function (sel) { return document.querySelector(sel); };

  // 経路("job.qty")で ui.form に値を書く
  ui.setFormValue = function (path, value) {
    var keys = path.split('.'), obj = ui.form;
    for (var i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
  };

  // 中身を差し替える。入力中のフォーカスとカーソル位置は保つ(id を持つ要素のみ)。
  ui.setHtml = function (el, html) {
    var active = document.activeElement, id = null, start = null, end = null;
    if (active && active.id && el.contains(active)) {
      id = active.id;
      try { start = active.selectionStart; end = active.selectionEnd; } catch (e) { /* number入力などは非対応 */ }
    }
    el.innerHTML = html;
    if (id) {
      var again = document.getElementById(id);
      if (again) {
        again.focus();
        try { if (start != null) again.setSelectionRange(start, end); } catch (e) { /* 同上 */ }
      }
    }
  };

  // ---- よく使う部品 ----
  ui.tag = function (text, kind) { return '<span class="tag ' + (kind || '') + '">' + ui.esc(text) + '</span>'; };
  ui.bar = function (ratio, kind) {
    var pct = Math.round(AF.core.util.clamp(ratio, 0, 1) * 100);
    return '<span class="bar ' + (kind || '') + '"><i style="width:' + pct + '%"></i></span>';
  };
  ui.panel = function (title, body, extra) {
    return '<section class="panel"><h2>' + ui.esc(title) + (extra ? '<span class="panel-extra">' + extra + '</span>' : '') + '</h2>' + body + '</section>';
  };
  // rows は <tr>… の文字列の配列。空なら emptyText を出す。
  ui.table = function (headers, rows, emptyText) {
    if (!rows.length) return '<p class="empty">' + ui.esc(emptyText || 'なし') + '</p>';
    return '<table class="grid"><thead><tr>' + headers.map(function (h) {
      var num = h.charAt(0) === '#';
      return '<th' + (num ? ' class="num"' : '') + '>' + ui.esc(num ? h.slice(1) : h) + '</th>';
    }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  };

  // アイコン + 数字の小さな札。cls に 'bad' などを付けられる。
  ui.res = function (icon, text, cls, title) {
    return '<span class="res ' + (cls || '') + '"' + (title ? ' title="' + ui.esc(title) + '"' : '') + '>' + AF.ui.pix.icon(icon, 16) + '<b>' + text + '</b></span>';
  };
  ui.coin = function (n, cls) { return ui.res('coin', AF.core.util.fmt(n), cls); };

  // 6数値の最低仕様を短く書く(例: 攻4 機5 信4)
  ui.specText = function (minSpec) {
    var parts = [];
    AF.data.CONFIG.STATS.forEach(function (s) { if (minSpec[s.id] != null) parts.push(s.short + minSpec[s.id]); });
    return parts.join(' ') || '条件なし';
  };

  // 通知(右下に数秒出る)
  ui.toast = function (text, level) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (level || 'info');
    el.textContent = text;
    root.appendChild(el);
    while (root.children.length > 4) root.removeChild(root.firstChild);
    setTimeout(function () { el.classList.add('fade'); }, 5200);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 6000);
  };
})(window.AF);
