// セーブ/ロード。localStorage と、JSONファイルの書き出し・読み込み。
(function (AF) {
  'use strict';
  var save = {};
  function C() { return AF.data.CONFIG; }

  save.toJSON = function (state) { return JSON.stringify(state); };

  // 読み込んだデータに、新しく増えた項目の初期値を補う(配列は読み込んだ側をそのまま使う)
  function mergeDefaults(def, loaded) {
    if (loaded === undefined) return def;
    if (def && typeof def === 'object' && !Array.isArray(def) && loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      var out = {};
      Object.keys(def).forEach(function (k) { out[k] = mergeDefaults(def[k], loaded[k]); });
      Object.keys(loaded).forEach(function (k) { if (!(k in def)) out[k] = loaded[k]; });
      return out;
    }
    return loaded;
  }

  save.fromJSON = function (text) {
    var data = JSON.parse(text);
    if (!data || typeof data !== 'object' || typeof data.day !== 'number' || !data.inventory) {
      throw new Error('セーブデータの形式が違います');
    }
    if (data.version > C().SAVE_VERSION) throw new Error('新しい版のセーブデータです');
    var def = AF.core.state.create(data.companyName, data.rngSeed);
    var state = mergeDefaults(def, data);
    // 途中経過として初期値が入る項目は、読み込んだ値を優先する
    ['contracts', 'log', 'reports', 'quotaBase', 'quotaGrant', 'unitMarket', 'spotSold', 'hirePool'].forEach(function (k) {
      if (data[k] !== undefined) state[k] = data[k];
    });
    AF.systems.facilities.syncLayout(state); // 配置のない古いセーブは自動で床に置く
    state.version = C().SAVE_VERSION;
    return state;
  };

  save.saveLocal = function (state) {
    try {
      localStorage.setItem(C().SAVE_KEY, save.toJSON(state));
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'ブラウザに保存できませんでした(' + e.message + ')' };
    }
  };

  save.hasLocal = function () {
    try { return !!localStorage.getItem(C().SAVE_KEY); } catch (e) { return false; }
  };

  save.loadLocal = function () {
    try {
      var text = localStorage.getItem(C().SAVE_KEY);
      if (!text) return { ok: false, reason: 'セーブデータがありません' };
      return { ok: true, state: save.fromJSON(text) };
    } catch (e) {
      return { ok: false, reason: '読み込めませんでした(' + e.message + ')' };
    }
  };

  // JSONファイルとして書き出す(ブラウザ専用)
  save.exportFile = function (state) {
    try {
      var blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var d = AF.core.util.dateOf(state.day);
      a.href = url;
      a.download = 'factory-save-' + d.year + '-' + ('0' + d.month).slice(-2) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: '書き出せませんでした(' + e.message + ')' };
    }
  };

  // JSONファイルを読み込む(ブラウザ専用)。done({ok, state|reason})
  save.importFile = function (file, done) {
    var reader = new FileReader();
    reader.onload = function () {
      try { done({ ok: true, state: save.fromJSON(String(reader.result)) }); }
      catch (e) { done({ ok: false, reason: '読み込めませんでした(' + e.message + ')' }); }
    };
    reader.onerror = function () { done({ ok: false, reason: 'ファイルを開けませんでした' }); };
    reader.readAsText(file);
  };

  AF.core.save = save;
})(window.AF);
