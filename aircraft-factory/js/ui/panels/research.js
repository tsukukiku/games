// 「研究」パネル: 研究ツリー。ノードを上から下へ並べ、前提を線でつなぐ。ノードを選んで研究を始める。
// ノードの位置は data/research.js の tree / col / row で決まる。
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util, S = AF.systems;
  function IDX() { return AF.data.index; }
  function state() { return AF.core.store.state; }
  var esc = ui.esc;

  var NW = 176, NH = 92, GX = 200, GY = 140, PAD = 16;   // ノードの大きさと間隔(px)
  var LABEL = { done: '研究済み', active: '研究中', available: '研究できる', blocked: '条件不足', hidden: '???' };

  function nodePos(n) { return { x: PAD + n.col * GX, y: PAD + n.row * GY }; }

  function nodeHtml(st, n) {
    var status = S.research.nodeStatus(st, n.id), p = nodePos(n), sel = ui.form.research.sel === n.id;
    var style = 'left:' + p.x + 'px;top:' + p.y + 'px;width:' + NW + 'px;height:' + NH + 'px';
    if (status === 'hidden') {
      return '<button class="rnode hidden ' + (sel ? 'sel' : '') + '" style="' + style + '" data-action="research.pick" data-id="' + n.id + '">' +
        '<span class="ric">' + ui.pix.icon('lock', 32) + '</span><b>???</b></button>';
    }
    var a = S.research.activeEntry(st, n.id), foot;
    if (status === 'active') foot = '<span class="pbar run"><i style="width:' + Math.round((1 - a.daysLeft / a.days) * 100) + '%"></i></span><span class="sub">あと' + a.daysLeft + '日</span>';
    else if (status === 'done') foot = '<span class="done-mark">' + ui.pix.icon('check', 16) + '研究済み</span>';
    else foot = ui.coin(n.cost.funds, st.funds < n.cost.funds ? 'bad' : '') + ui.res('clock', n.cost.days + '日');
    return '<button class="rnode ' + status + ' src-' + n.source + ' ' + (sel ? 'sel' : '') + '" style="' + style + '" data-action="research.pick" data-id="' + n.id + '" title="' + esc(n.desc) + '">' +
      '<span class="ric">' + ui.pix.icon(n.icon, n.icon.indexOf('unit:') === 0 ? 44 : 32) + '</span><b>' + esc(n.name) + '</b><span class="foot">' + foot + '</span></button>';
  }

  // 前提 → ノード の線(縦・横・縦の折れ線)
  function linesSvg(st, nodes, w, h) {
    var d = '';
    nodes.forEach(function (n) {
      n.requires.forEach(function (rid) {
        var r = IDX().research[rid];
        if (!r || r.tree !== n.tree) return;
        var a = nodePos(r), b = nodePos(n);
        var x1 = a.x + NW / 2, y1 = a.y + NH, x2 = b.x + NW / 2, y2 = b.y, my = Math.round((y1 + y2) / 2);
        var on = st.research.done[rid];
        d += '<path d="M' + x1 + ',' + y1 + ' V' + my + ' H' + x2 + ' V' + y2 + '" class="' + (on ? 'on' : '') + '"/>';
      });
    });
    return '<svg class="rlines" width="' + w + '" height="' + h + '" shape-rendering="crispEdges">' + d + '</svg>';
  }

  function detail(st) {
    var n = IDX().research[ui.form.research.sel];
    if (!n) return '<div class="rdetail"><p class="hint">ノードを選ぶと、内容と条件が出ます。</p></div>';
    var status = S.research.nodeStatus(st, n.id);
    if (status === 'hidden') return '<div class="rdetail"><b>???</b><p>' + esc(n.hint || '') + '</p></div>';
    var blockers = S.research.blockers(st, n), c = n.cost;
    var full = st.research.active.length >= st.research.slots;
    var can = status === 'available' && !full && st.funds >= c.funds;
    var why = status === 'available' ? (full ? '研究の枠がいっぱいです' : st.funds < c.funds ? '資金が足りません' : '') : '';
    return '<div class="rdetail"><div class="row"><span class="ric">' + ui.pix.icon(n.icon, 48) + '</span><span><b>' + esc(n.name) + '</b> ' +
      ui.tag(LABEL[status], status === 'done' || status === 'available' ? 'good' : status === 'active' ? 'accent' : 'bad') +
      (n.source === 'license' ? ui.tag('ライセンス', 'warn') : '') + '<br>' + esc(n.desc) + '</span></div>' +
      '<div class="row">' + ui.coin(c.funds, st.funds < c.funds ? 'bad' : '') + ui.res('clock', c.days + '日') +
      (c.facilities || []).map(function (id) { return '<span class="res ' + (st.facilities[id] > 0 ? '' : 'bad') + '" title="必要な設備: ' + IDX().facilities[id].name + '">' + ui.pix.icon('fac_' + id, 32) + '</span>'; }).join('') +
      (c.royaltyRate ? '<span class="res" title="この許諾のユニットを使った機体の売上から払う">ライセンス料 ' + Math.round(c.royaltyRate * 100) + '%</span>' : '') + '</div>' +
      (blockers.length && status !== 'done' && status !== 'active' ? '<div class="row bad">足りない条件: ' + blockers.map(esc).join(' / ') + '</div>' : '') +
      (status === 'available' || status === 'blocked' ? '<div class="row"><button class="primary big" data-action="research.start" data-id="' + n.id + '" ' + (can ? '' : 'disabled') + '>研究を始める</button><span class="sub">' + why + '</span></div>' : '') +
      '</div>';
  }

  function render(st) {
    var f = ui.form.research;
    var tabs = '<div class="seg">' + AF.data.RESEARCH_TREES.map(function (t) {
      var n = AF.data.RESEARCH.filter(function (x) { return x.tree === t.id; });
      var done = n.filter(function (x) { return st.research.done[x.id]; }).length;
      return '<button class="' + (f.tree === t.id ? 'on' : '') + '" data-action="research.tree" data-id="' + t.id + '">' + t.name + '<span class="sub">' + done + '/' + n.length + '</span></button>';
    }).join('') + '</div>';

    var slots = '';
    for (var i = 0; i < st.research.slots; i++) {
      var a = st.research.active[i];
      slots += a ? '<span class="rslot on">' + ui.pix.icon(IDX().research[a.id].icon, 32) + '<span><b>' + esc(IDX().research[a.id].name) + '</b>' +
        '<span class="pbar run"><i style="width:' + Math.round((1 - a.daysLeft / a.days) * 100) + '%"></i></span></span><i>あと' + a.daysLeft + '日</i></span>'
        : '<span class="rslot">' + ui.pix.icon('research', 32) + '<span>研究の枠が空いています</span></span>';
    }

    var nodes = AF.data.RESEARCH.filter(function (n) { return n.tree === f.tree; });
    var cols = 0, rows = 0;
    nodes.forEach(function (n) { cols = Math.max(cols, n.col + 1); rows = Math.max(rows, n.row + 1); });
    var w = PAD * 2 + (cols - 1) * GX + NW, h = PAD * 2 + (rows - 1) * GY + NH;
    return tabs + '<div class="rslots">' + slots + '</div>' +
      '<div class="rtree-wrap"><div class="rtree" style="width:' + w + 'px;height:' + h + 'px">' + linesSvg(st, nodes, w, h) +
      nodes.map(function (n) { return nodeHtml(st, n); }).join('') + '</div></div>' + detail(st);
  }

  ui.on('research.tree', function (ds) { ui.form.research.tree = ds.id; ui.form.research.sel = ''; });
  ui.on('research.pick', function (ds) { ui.form.research.sel = ds.id; });
  ui.on('research.start', function (ds) {
    var r = S.research.start(state(), ds.id);
    if (r.ok) ui.hud.pop('-' + U.fmt(IDX().research[ds.id].cost.funds), false);
    return r;
  });

  ui.panels.research = { id: 'research', label: '研究', icon: 'research', width: 'xl', render: render,
    badge: function (st) {
      if (st.research.active.length >= st.research.slots) return '';
      return AF.data.RESEARCH.some(function (n) { return S.research.nodeStatus(st, n.id) === 'available' && st.funds >= n.cost.funds; }) ? '!' : '';
    } };
})(window.AF);
