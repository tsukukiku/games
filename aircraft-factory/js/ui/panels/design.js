// 「設計」パネル: 5スロットにユニットを選んで機体を組む。ピクセルのプレビュー、6数値、役割、保存した設計。
(function (AF) {
  'use strict';
  var ui = AF.ui, U = AF.core.util, S = AF.systems;
  function C() { return AF.data.CONFIG; }
  function IDX() { return AF.data.index; }
  function state() { return AF.core.store.state; }
  var esc = ui.esc;

  var AVAIL = { make: ['製造可', 'good'], buy: ['購入のみ', 'warn'], locked: ['未解放', 'bad'] };

  // 入力中の設計の初期値: 各スロットで最初に使えるユニット
  function ensureDraft(st) {
    var d = ui.form.design;
    C().SLOTS.forEach(function (slot) {
      var cur = IDX().units[d.slots[slot.id]];
      if (cur && S.aircraft.unitAvailability(st, cur.id) !== 'locked') return;
      var first = AF.data.UNITS.filter(function (u) { return u.slot === slot.id && S.aircraft.unitAvailability(st, u.id) !== 'locked'; })[0];
      d.slots[slot.id] = first ? first.id : '';
    });
    if (!d.name) d.name = '試作' + (st.designSeq + 1) + '号';
    return d;
  }
  function statText(stats) {
    return C().STATS.map(function (s) { return stats[s.id] ? s.short + (stats[s.id] > 0 ? '+' : '') + stats[s.id] : ''; }).filter(Boolean).join(' ');
  }

  function slotRow(st, slot, draft) {
    var tiles = AF.data.UNITS.filter(function (u) { return u.slot === slot.id; }).map(function (u) {
      var av = S.aircraft.unitAvailability(st, u.id);
      var secret = av === 'locked' && u.source === 'conditional' && !st.debug;
      if (secret) return '<button class="tile wide locked" disabled title="条件を満たすと解放">' + ui.pix.icon('lock', 32) + '<span>???</span></button>';
      return '<button class="tile wide unit av-' + av + ' ' + (draft.slots[slot.id] === u.id ? 'on' : '') + '" data-action="design.slot" data-slot="' + slot.id + '" data-id="' + u.id + '" ' +
        (av === 'locked' ? 'disabled' : '') + ' title="' + esc(u.name + '〔' + AF.data.ORIGINS[u.origin].name + '〕' + statText(u.stats) + ' / ' + AVAIL[av][0]) + '">' +
        ui.pix.icon('unit:' + u.id, 56) + '<span>' + esc(u.name) + '</span><i class="dot"></i></button>';
    }).join('');
    var unit = IDX().units[draft.slots[slot.id]], info = '';
    if (unit) {
      var av = S.aircraft.unitAvailability(st, unit.id), t = unit.trait;
      info = '<div class="sub">' + ui.tag(AVAIL[av][0], AVAIL[av][1]) + ' ' + statText(unit.stats) + '　「' + esc(t.label) + '」' +
        IDX().missions[t.mission].name + 'で' + IDX().stats[t.stat].name + (t.mod > 0 ? '+' : '') + t.mod +
        '　' + (unit.purchasable ? ui.coin(unit.buyPrice) : '') + ' 在庫' + (st.inventory.units[unit.id] || 0) + '</div>';
    }
    return '<div class="slot-row"><h4>' + slot.name + '</h4><div class="tiles">' + tiles + '</div>' + info + '</div>';
  }

  function statBars(calc) {
    // 棒は -5〜+15 の範囲で描く
    return '<div class="statbars">' + C().STATS.map(function (s) {
      var v = calc.stats[s.id], ratio = U.clamp((v + 5) / 20, 0, 1);
      return '<div class="statbar"><span>' + s.name + '</span>' +
        '<span class="track"><i class="zero"></i><i class="fill ' + (v < 0 ? 'neg' : '') + '" style="width:' + Math.round(ratio * 100) + '%"></i></span><b>' + v + '</b></div>';
    }).join('') + '</div>';
  }

  function render(st) {
    var draft = ensureDraft(st);
    var calc = S.aircraft.computeAircraftStats(draft.slots), role = S.aircraft.getRole(calc.stats), cost = S.aircraft.designCost(draft.slots);
    var editing = draft.id && S.aircraft.getDesign(st, draft.id);

    var left = '<div class="preview">' + ui.aircraftPixel.html(draft.slots, 440) + ui.aircraftSvg.legend(draft.slots) + '</div>' +
      '<div class="row"><span class="role ' + role.id + '">' + role.name + '</span><span class="res">合計 <b>' + calc.total + '</b></span>' +
      ui.res('coin', U.fmt(S.aircraft.basePrice(calc.total)), '', '目安の価格') + ui.res('work', cost.work, '', '直接工数') + '</div>' +
      statBars(calc) +
      '<label class="field">機体の名前<input type="text" id="design-name" maxlength="30" data-input="design.name" value="' + esc(draft.name) + '"></label>' +
      '<div class="row"><button class="primary big" data-action="design.save">' + (editing ? '上書き保存' : '設計を保存') + '</button>' +
      (editing ? '<button data-action="design.saveAs">別名で保存</button>' : '') + '<button data-action="design.new">新規</button>' +
      '<button data-action="design.fly">試験飛行を見る</button></div>' +
      (st.phase < 2 ? '<p class="hint">機体の生産は「機体の組立」の解放後。設計は今から用意できます。</p>' : '');

    var right = C().SLOTS.map(function (slot) { return slotRow(st, slot, draft); }).join('');

    var saved = st.designs.map(function (d) {
      var c = S.aircraft.computeAircraftStats(d.slots), r = S.aircraft.getRole(c.stats);
      return '<div class="card saved">' + ui.aircraftPixel.html(d.slots, 154) + '<span class="body"><b>' + esc(d.name) + '</b> <span class="role small ' + r.id + '">' + r.name + '</span>' +
        '<span class="sub">' + C().STATS.map(function (s) { return s.short + c.stats[s.id]; }).join(' ') + ' / 合計' + c.total + ' / 在庫' + (st.inventory.aircraft[d.id] || 0) + '</span>' +
        '<span class="row"><button data-action="design.edit" data-id="' + d.id + '">編集</button>' +
        '<button class="primary" data-action="design.produce" data-id="' + d.id + '" ' + (st.phase < 2 ? 'disabled' : '') + '>1機つくる</button>' +
        '<button data-action="design.flySaved" data-id="' + d.id + '">試験飛行</button>' +
        '<button data-action="design.delete" data-id="' + d.id + '">削除</button></span></span></div>';
    }).join('');

    return '<div class="design-grid"><div>' + left + '</div><div>' + right + '</div></div>' +
      '<h3>保存した設計 <i>' + st.designs.length + '件</i></h3>' + (saved || '<p class="hint">まだ設計がありません。</p>');
  }

  function resetDraft() { ui.form.design = { id: null, name: '', slots: {} }; }

  ui.on('design.slot', function (ds) { ui.form.design.slots[ds.slot] = ds.id; });
  ui.on('design.save', function () {
    var d = ui.form.design;
    var r = S.aircraft.saveDesign(state(), { id: d.id, name: d.name, slots: d.slots });
    if (r.ok) { d.id = r.id; ui.toast('設計「' + d.name + '」を保存しました。', 'good'); }
    return r;
  });
  ui.on('design.saveAs', function () {
    var d = ui.form.design;
    var r = S.aircraft.saveDesign(state(), { name: d.name, slots: d.slots });
    if (r.ok) { d.id = r.id; ui.toast('別の設計として保存しました。', 'good'); }
    return r;
  });
  ui.on('design.new', function () { resetDraft(); });
  ui.on('design.edit', function (ds) {
    var d = S.aircraft.getDesign(state(), ds.id);
    if (d) ui.form.design = { id: d.id, name: d.name, slots: U.deepCopy(d.slots) };
    document.getElementById('drawer-body').scrollTop = 0;
  });
  ui.on('design.delete', function (ds) {
    var r = S.aircraft.deleteDesign(state(), ds.id);
    if (r.ok && ui.form.design.id === ds.id) ui.form.design.id = null;
    return r;
  });
  ui.on('design.produce', function (ds) {
    var r = S.production.addJob(state(), 'aircraft', ds.id, 1);
    if (r.ok) ui.toast('生産のキューに入れました。', 'good');
    return r;
  });
  ui.on('design.fly', function () { ui.scenes.open('testFlight', { slots: U.deepCopy(ui.form.design.slots), name: ui.form.design.name }); });
  ui.on('design.flySaved', function (ds) {
    var d = S.aircraft.getDesign(state(), ds.id);
    if (d) ui.scenes.open('testFlight', { slots: U.deepCopy(d.slots), name: d.name });
  });

  ui.panels.design = { id: 'design', label: '設計', icon: 'design', width: 'xl', render: render, onStateLoaded: resetDraft };
})(window.AF);
