// ユニットごとのSVG部品(側面図・機首が左)。js/data/units.js の sprite キーで引く。
//
// 座標系: viewBox 0 0 440 180。地面は y=152 付近。
// 約束ごと: エンジンと胴体の継ぎ目は x=130 (上 y=62 / 下 y=100)。どの組み合わせでもつながるよう、
//           エンジンは x=130 で終わり、胴体は x=130 から始める。主翼の付け根は x=146〜256, y=98 付近。
// 各スプライト: draw(c) が SVG文字列を返す。c = { fill(出自の色), a(胴体のアンカー) }
//   胴体は anchors を持ち、電子機器(アンテナ)や武装(爆弾)の位置合わせに使う。
//   anchors = { mast: アンテナ柱の根元, finTop: 垂直尾翼の上端, belly: 胴体下面, sight: 照準器の位置 }
(function (AF) {
  'use strict';

  var INK = '#2b2a26', GLASS = '#cddcd8', DARK = '#3d3a34', TIRE = '#2f2d2a';

  function shape(d, fill, sw) {
    return '<path d="' + d + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="' + (sw || 1.6) + '" stroke-linejoin="round"/>';
  }
  function line(d, sw) {
    return '<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + (sw || 1.3) + '" stroke-linecap="round"/>';
  }
  function circle(x, y, r, fill) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (fill || 'none') + '" stroke="' + INK + '" stroke-width="1.5"/>';
  }
  function ellipse(x, y, rx, ry, fill) {
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="1.5"/>';
  }
  function rect(x, y, w, h, fill) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="1.2"/>';
  }
  function prop(x) { return ellipse(x, 81, 2.6, 45, '#8d8a80'); }
  function stubs(x0, y, n) { // 排気管の列
    var s = '';
    for (var i = 0; i < n; i++) s += rect(x0 + i * 7, y, 4.5, 3.2, DARK);
    return s;
  }

  var DEFAULT_ANCHORS = { mast: [248, 60], finTop: [380, 34], belly: [215, 100], sight: [204, 50] };

  var sprites = {
    // ================= エンジン =================
    eng_radial: { draw: function (c) { // 星型: 太く短いカウリング
      return prop(64) +
        shape('M130,62 L86,56 Q72,56 72,68 L72,94 Q72,106 86,106 L130,100 Z', c.fill) +
        line('M86,56 L86,106') + line('M98,58 L98,104', 1) +
        shape('M72,73 Q58,81 72,89 Z', DARK) +
        line('M112,104 L128,109', 2.4);
    } },
    eng_db601a: { draw: function (c) { // 細身で尖ったスピナー、下に小さな冷却器
      return prop(57) +
        shape('M130,62 L86,64 L66,70 L66,92 L86,100 L130,100 Z', c.fill) +
        shape('M66,70 Q36,81 66,92 Z', DARK) +
        shape('M92,100 Q104,113 124,100 Z', c.fill) +
        stubs(86, 79, 6);
    } },
    eng_jumo211: { draw: function (c) { // 顎の大きな冷却器
      return prop(61) +
        shape('M130,62 L90,60 L70,68 L70,94 L130,100 Z', c.fill) +
        shape('M74,94 Q70,124 104,121 L130,106 L130,100 Z', c.fill) +
        line('M78,104 L86,117') + line('M84,103 L92,118', 1) +
        shape('M70,71 Q50,81 70,91 Z', DARK) +
        stubs(90, 75, 6);
    } },
    eng_db601e: { draw: function (c) { // 大きく丸いスピナー、浅い冷却器
      return prop(60) +
        shape('M130,62 L92,63 L74,66 L74,96 L92,100 L130,100 Z', c.fill) +
        shape('M74,66 Q26,81 74,96 Z', DARK) +
        shape('M98,100 Q108,108 126,100 Z', c.fill) +
        line('M100,71 q7,-6 14,0', 1.6) +
        stubs(92, 80, 5);
    } },

    // ================= 胴体 =================
    fus_hs123: { anchors: { mast: [252, 60], finTop: [380, 33], belly: [215, 100], sight: [209, 49] },
      draw: function (c) { // 開放式の操縦席、丸い尾翼
        return shape('M352,68 Q358,30 382,32 Q394,36 396,74 Z', c.fill) +
          shape('M130,62 L200,57 Q214,72 236,58 L330,66 L396,74 L398,82 L330,92 L200,100 L130,100 Z', c.fill) +
          line('M200,57 L208,46 L214,59', 1.6) +
          line('M140,82 L380,80', 0.8) +
          line('M350,73 L404,73', 3) +
          circle(388, 92, 4, TIRE);
      } },
    fus_ju87b: { anchors: { mast: [226, 38], finTop: [379, 24], belly: [215, 106], sight: [197, 44] },
      draw: function (c) { // 深い胴体、長い温室風防、角ばった尾翼
        return shape('M358,66 L364,24 L394,24 L402,71 Z', c.fill) +
          shape('M130,62 L185,56 L290,60 L400,70 L404,82 L310,96 L215,106 L130,100 Z', c.fill) +
          shape('M178,57 L190,38 L262,38 L290,60 Z', GLASS) +
          line('M205,38 L203,57', 1) + line('M225,38 L225,58', 1) + line('M245,38 L247,59', 1) +
          line('M350,52 L408,52', 3) + line('M372,52 L384,74', 1.2) +
          circle(392, 92, 5, TIRE);
      } },
    fus_bf109e: { anchors: { mast: [246, 60], finTop: [379, 33], belly: [215, 100], sight: [203, 49] },
      draw: function (c) { // 細い胴体、角ばった枠の風防、支柱つきの水平尾翼
        return shape('M364,70 L370,34 L388,32 L400,74 Z', c.fill) +
          shape('M130,62 L195,58 L255,61 L400,74 L402,81 L300,92 L200,100 L130,100 Z', c.fill) +
          shape('M188,58 L196,43 L238,43 L254,61 Z', GLASS) +
          line('M210,43 L209,58', 1) + line('M226,43 L227,59', 1) +
          line('M356,58 L404,58', 3) + line('M374,58 L382,76', 1.2) +
          circle(386, 90, 4, TIRE);
      } },
    fus_bf109f: { anchors: { mast: [246, 60], finTop: [381, 32], belly: [215, 100], sight: [203, 49] },
      draw: function (c) { // 丸みのある尾翼、支柱なし
        return shape('M362,70 Q368,30 384,32 Q396,36 400,76 Z', c.fill) +
          shape('M130,62 L195,58 L255,61 Q340,68 402,76 L402,82 Q300,94 200,100 L130,100 Z', c.fill) +
          shape('M188,58 L196,43 L238,43 L254,61 Z', GLASS) +
          line('M210,43 L209,58', 1) + line('M226,43 L227,59', 1) +
          line('M358,67 L404,67', 3);
      } },

    // ================= 主翼(脚を含む) =================
    wng_hs123: { draw: function (c) { // 一葉半: 大きな上翼と小さな下翼、スパッツつき固定脚
      return line('M172,30 L166,58', 1.6) + line('M208,30 L214,58', 1.6) + line('M180,31 L184,97', 2.2) +
        ellipse(192, 26, 50, 5, c.fill) +
        ellipse(190, 100, 32, 4, c.fill) +
        line('M178,103 L172,136', 2.4) +
        circle(172, 142, 8, TIRE) +
        shape('M156,136 Q172,122 190,139 Q176,146 156,141 Z', c.fill);
    } },
    wng_ju87b: { draw: function (c) { // 逆ガル翼、大きなズボン型の脚、急降下ブレーキ
      return shape('M148,98 Q200,90 258,98 Q200,108 148,98 Z', c.fill) +
        circle(178, 146, 8, TIRE) +
        shape('M170,100 L162,136 Q164,151 180,149 Q195,146 194,136 L192,102 Z', c.fill) +
        line('M196,111 L246,111', 3) + line('M204,104 L204,111', 1) + line('M238,104 L238,111', 1);
    } },
    wng_bf109e: { draw: function (c) { // 低翼、細い引込脚、翼下の冷却器
      return shape('M146,98 Q196,91 252,97 Q196,105 146,98 Z', c.fill) +
        rect(206, 101, 22, 6, c.fill) +
        line('M172,100 L160,138', 2.2) +
        shape('M168,102 L158,128 L164,130 L173,104 Z', c.fill, 1.2) +
        circle(160, 140, 9, TIRE);
    } },
    wng_wood: { draw: function (c) { // 角ばった木製翼、簡素な固定脚
      return shape('M148,94 L252,93 L254,101 L148,103 Z', c.fill) +
        line('M156,97 L246,96', 0.7) + line('M156,100 L246,99', 0.7) +
        line('M176,103 L176,138', 2.4) + line('M176,122 L194,103', 1.4) +
        circle(176, 141, 8, TIRE);
    } },

    // ================= 武装 =================
    arm_mg17: { draw: function () { // 機首上面の機銃2挺
      return line('M134,60 L104,57', 2.2) + line('M134,64 L108,62', 2.2);
    } },
    arm_mgff: { draw: function () { // 主翼前縁から突き出す機関砲
      return rect(116, 95.5, 36, 3.6, DARK) + rect(112, 96.3, 5, 2, DARK) + line('M134,60 L106,58', 2.2);
    } },
    arm_bomb: { draw: function (c) { // 胴体下の爆弾
      var x = c.a.belly[0], y = c.a.belly[1];
      return line('M' + (x - 10) + ',' + y + ' l-4,9', 1.4) + line('M' + (x + 12) + ',' + y + ' l4,9', 1.4) +
        shape('M' + (x + 24) + ',' + (y + 17) + ' l15,-9 l0,18 Z', DARK, 1.2) +
        ellipse(x, y + 17, 30, 8, DARK) +
        line('M134,60 L108,58', 2.2);
    } },

    // ================= 電子機器 =================
    avi_radio: { draw: function (c) { // アンテナ柱と空中線
      var m = c.a.mast, f = c.a.finTop;
      return line('M' + m[0] + ',' + m[1] + ' L' + m[0] + ',' + (m[1] - 16), 2) +
        line('M' + m[0] + ',' + (m[1] - 16) + ' L' + f[0] + ',' + f[1], 0.8);
    } },
    avi_revi: { draw: function (c) { // アンテナ + 風防内の照準器
      var m = c.a.mast, f = c.a.finTop, s = c.a.sight;
      return line('M' + m[0] + ',' + m[1] + ' L' + m[0] + ',' + (m[1] - 16), 2) +
        line('M' + m[0] + ',' + (m[1] - 16) + ' L' + f[0] + ',' + f[1], 0.8) +
        rect(s[0] - 3, s[1] - 1, 6, 5, DARK) + line('M' + s[0] + ',' + (s[1] - 1) + ' l-3,-6', 1.6);
    } },
    avi_ju87: { draw: function (c) { // アンテナ + 胴体下の方向探知ループ + ピトー管
      var m = c.a.mast, f = c.a.finTop, b = c.a.belly;
      return line('M' + m[0] + ',' + m[1] + ' L' + m[0] + ',' + (m[1] - 16), 2) +
        line('M' + m[0] + ',' + (m[1] - 16) + ' L' + f[0] + ',' + f[1], 0.8) +
        circle(b[0] + 62, b[1] - 1, 5.5) +
        line('M150,104 L124,107', 1.6);
    } }
  };

  AF.ui.sprites = sprites;
  AF.ui.spriteDefaultAnchors = DEFAULT_ANCHORS;
})(window.AF);
