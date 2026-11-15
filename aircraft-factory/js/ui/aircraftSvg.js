// 機体のSVG文字列を作る。5スロットのユニットのスプライト(sprites.js)を重ねる。出自ごとに色が違う。
// 画面にはこのSVGを直接は出さず、aircraftPixel.js がピクセル画像に変換して表示する。
(function (AF) {
  'use strict';

  // 重ねる順(奥 → 手前)
  var LAYER_ORDER = ['fuselage', 'engine', 'wing', 'armament', 'avionics'];

  // slots: {スロットid: ユニットid}。box: 切り出す範囲 [x, y, 幅, 高さ]。size: 画像の大きさ [幅, 高さ]。
  // only を指定すると、そのスロットだけを描く(胴体は位置合わせにだけ使う)。
  function raw(slots, box, size, only) {
    var IDX = AF.data.index, sprites = AF.ui.sprites;
    var fus = IDX.units[slots && slots.fuselage];
    var anchors = (fus && sprites[fus.sprite] && sprites[fus.sprite].anchors) || AF.ui.spriteDefaultAnchors;
    var body = '';
    LAYER_ORDER.forEach(function (slotId) {
      if (only && only !== slotId) return;
      var unit = IDX.units[slots && slots[slotId]];
      if (!unit || !sprites[unit.sprite]) return;
      var origin = AF.data.ORIGINS[unit.origin] || { color: '#999' };
      body += sprites[unit.sprite].draw({ fill: origin.color, a: anchors });
    });
    // ユニット単体の小さな絵では、線が細くなって消えないよう、線の太さを縮尺に合わせない
    if (only) body = body.replace(/<(path|circle|ellipse|rect) /g, '<$1 vector-effect="non-scaling-stroke" ');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + box.join(' ') + '" width="' + size[0] + '" height="' + size[1] +
      '" shape-rendering="crispEdges">' + body + '</svg>';
  }

  // 出自の凡例(色見本)
  function legend(slots) {
    var IDX = AF.data.index, seen = {}, html = '';
    AF.data.CONFIG.SLOTS.forEach(function (slot) {
      var unit = IDX.units[slots && slots[slot.id]];
      if (!unit || seen[unit.origin]) return;
      seen[unit.origin] = true;
      var o = AF.data.ORIGINS[unit.origin];
      html += '<span class="origin-chip"><i style="background:' + o.color + '"></i>' + AF.ui.esc(o.name) + '</span>';
    });
    return '<div class="origin-legend">' + html + '</div>';
  }

  AF.ui.aircraftSvg = { raw: raw, legend: legend };
})(window.AF);
