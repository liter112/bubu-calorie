/* ===== 界面渲染与交互 ===== */
window.Nutri = window.Nutri || {};

Nutri.ui = (function () {
  var E = Nutri.engine, S = Nutri.store, R = Nutri.recommend;
  var root = null;
  var tab = "home";
  var log = { food: null, grams: 150, method: "boil", oil: null, sugarOn: true, saltOn: true, query: "", showSuggest: false };
  var lib = { query: "", cat: "all", limit: 100 };

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function el(id) { return document.getElementById(id); }
  function val(id) { var n = el(id); return n ? n.value : ""; }
  function num(v) { var x = parseFloat(v); return isNaN(x) ? 0 : x; }
  function money(n, d) { return E.fmt(n, d === undefined ? 0 : d); }

  function toast(msg, type) {
    var box = el("toasts");
    if (!box) return;
    var t = document.createElement("div");
    t.className = "toast" + (type ? " toast--" + type : "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  }

  function modal(html, opts) {
    opts = opts || {};
    closeModal();
    var wrap = document.createElement("div");
    wrap.className = "overlay";
    wrap.id = "overlay";
    wrap.innerHTML = '<div class="modal ' + (opts.wide ? "modal--wide" : "") + '">' + html + "</div>";
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap && opts.dismissible !== false) closeModal();
    });
    document.body.appendChild(wrap);
    return wrap;
  }
  function closeModal() {
    var o = el("overlay");
    if (o && o.parentNode) o.parentNode.removeChild(o);
  }

  function todayLabel() {
    var d = new Date();
    var w = "日一二三四五六".charAt(d.getDay());
    return (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 · 周" + w;
  }

  function ring(label, pct, valueLabel, cls) {
    var r = 30, c = 2 * Math.PI * r;
    var p = Math.max(0, Math.min(100, pct || 0));
    var dash = p / 100 * c;
    return '<div class="ring ' + (cls || "") + '">' +
      '<svg class="ring__svg" viewBox="0 0 74 74" aria-hidden="true">' +
      '<circle class="ring__track" cx="37" cy="37" r="' + r + '"/>' +
      '<circle class="ring__bar" cx="37" cy="37" r="' + r + '" stroke-dasharray="' + dash.toFixed(1) + ' ' + c.toFixed(1) + '"/>' +
      '</svg>' +
      '<div class="ring__pct">' + valueLabel + "</div>" +
      '<div class="ring__label">' + label + "</div>" +
      "</div>";
  }

  function barRow(label, value, target, unit, dec, maxFlag) {
    var pct = E.pctOf(value, target);
    var shown = value === null || value === undefined ? "未收录" : money(value, dec) + " / " + money(target, dec);
    var w = pct === null ? 0 : Math.min(100, pct);
    var cls = pct === null ? "bar--purple" : (pct > 110 ? "bar--orange" : (pct < 70 ? "bar--red" : ""));
    if (maxFlag) cls = pct !== null && pct > 100 ? "bar--red" : "";
    return '<div class="bar-row">' +
      '<div class="bar-row__name">' + esc(label) + "</div>" +
      '<div class="bar ' + cls + ' bar--thin"><i class="bar__fill" style="width:' + w + '%"></i></div>' +
      '<div class="bar-row__val">' + (pct === null ? '<span class="muted">未收录</span>'
        : "<b>" + shown + "</b> " + esc(unit) + " · " + Math.round(pct) + "%") + "</div>" +
      "</div>";
  }

  function chip(text, cls) { return '<span class="chip ' + (cls || "") + '">' + text + "</span>"; }

  function catEmoji(cat) { return Nutri.CAT_EMOJI[cat] || "🍽️"; }

  function statusChip(pct, maxFlag) {
    if (pct === null) return chip("未收录", "chip--silent");
    if (maxFlag) {
      if (pct > 100) return chip("超出", "chip--red");
      if (pct > 85) return chip("接近上限", "chip--orange");
      return chip("正常", "chip--green");
    }
    if (pct >= 90) return chip("达标", "chip--green");
    if (pct >= 70) return chip("略缺", "chip--blue");
    return chip("不足", "chip--red");
  }

  /* ---------- 顶部栏 ---------- */
  function renderTop() {
    var state = S.load();
    var live = S.streakLive();
    var lv = S.levelProgress(state.xp);
    var t = el("topbar");
    if (!t) return;
    t.innerHTML =
      '<div class="topbar__inner">' +
      '<div class="brand"><span class="brand__mark">🥕</span><span class="brand__name">卜卜卡路里</span></div>' +
      '<div class="topbar__spacer"></div>' +
      '<div class="topbar__stat topbar__stat--fire" title="连续打卡天数">🔥 ' + live.count + "</div>" +
      '<div class="topbar__stat topbar__stat--xp" title="经验值 / 等级">⚡ ' + state.xp + " · Lv." + lv.level + "</div>" +
      "</div>";
  }

  function renderNav() {
    var nav = el("tabbar");
    if (!nav) return;
    var items = [
      ["home", "🏠", "今日"], ["log", "✏️", "记录"], ["analysis", "📊", "分析"],
      ["library", "📚", "食物库"], ["settings", "⚙️", "设置"]
    ];
    nav.innerHTML = '<div class="tabbar__inner">' + items.map(function (it) {
      return '<button class="tab' + (tab === it[0] ? " is-active" : "") + '" data-tab="' + it[0] + '" aria-label="' + it[2] + '">' +
        '<span class="tab__icon">' + it[1] + "</span><span>" + it[2] + "</span></button>";
    }).join("") + "</div>";
  }

  /* ---------- 首页 ---------- */
  function homeView() {
    var state = S.load();
    var d = S.day();
    var stats = S.totals();
    var targets = Nutri.computeTargets(state.profile);
    var live = S.streakLive();
    var lv = S.levelProgress(state.xp);
    var kcalPct = E.pctOf(stats.kcal, targets.kcal) || 0;
    var protPct = E.pctOf(stats.protein, targets.protein) || 0;
    var vegPct = Math.min(100, (stats.vegFruitGrams || 0) / 500 * 100);

    var okCount = 0, known = 0;
    Nutri.NUTRIENTS.forEach(function (n) {
      var v = stats[n.k], t = targets[n.k];
      if (v === null || v === undefined || !t) return;
      known++;
      var p = v / t * 100;
      if (n.max ? p <= 100 : p >= 90) okCount++;
    });

    var quests = S.questDefs(stats);
    var recs = R.dailyTen(stats, targets, S.today(), d.items.map(function (i) { return i.foodId; }));
    var mood = Nutri.mascot.moodFor(stats, targets, d.checkedIn);
    var bubble = Nutri.mascot.bubbleText(stats, targets, d.checkedIn);

    return '<div class="view">' +
      '<div class="card card--hero section">' +
      '<div class="row row--between" style="align-items:flex-start">' +
      '<div><div class="small muted bold">' + todayLabel() + "</div>" +
      "<h1>今天也要好好吃饭</h1>" +
      '<div class="row row--wrap" style="margin-top:8px">' +
      chip("🔥 连续 " + live.count + " 天", "chip--orange") +
      chip("⚡ Lv." + lv.level + " · " + lv.cur + "/" + lv.need, "chip--blue") +
      chip("🎯 " + Nutri.GOAL_LABEL[state.profile.goal || "fatloss"] +
        (state.profile.goal === "gain" ? " +" + (state.profile.surplus || 300) : "") +
        (state.profile.goal === "fatloss" ? " −" + (state.profile.deficit || 0) : ""), "chip--green") +
      (d.checkedIn ? chip("✅ 今日已打卡", "chip--green") : "") +
      "</div></div>" +
      '<div style="transform:scale(.82);transform-origin:top right">' + Nutri.mascot.svg(mood, "mascot--sm") + "</div>" +
      "</div>" +
      '<div class="rings" style="margin-top:14px">' +
      ring("热量", kcalPct, Math.round(stats.kcal || 0), "ring--orange") +
      ring("蛋白质", protPct, Math.round(stats.protein || 0) + "g", "") +
      ring("蔬果", vegPct, Math.round(stats.vegFruitGrams || 0) + "g", "ring--blue") +
      ring("微量", known ? okCount / known * 100 : 0, d.items.length ? okCount + "/" + known : "—", "ring--purple") +
      "</div></div>" +

      /* 任务 */
      '<div class="card section"><div class="card__title">今日任务</div>' +
      quests.map(function (q) {
        return '<div class="quest' + (q.done ? " is-done" : "") + '">' +
          '<span class="quest__dot">' + (q.done ? "✓" : "") + "</span>" +
          '<span class="quest__text">' + esc(q.label) + "</span>" +
          '<span class="quest__xp">+' + q.xp + " XP</span></div>";
      }).join("") + "</div>" +

      /* 记录 */
      '<div class="card section"><div class="row row--between" style="margin-bottom:4px">' +
      '<div class="card__title" style="margin:0">今日记录</div>' +
      '<button class="btn btn--sm btn--ghost" data-tab="log">+ 添加</button></div>' +
      (d.items.length ? d.items.slice().reverse().map(logRow).join("")
        : '<div class="empty"><div class="empty__icon">🍽️</div><div class="empty__title">还没有记录</div>' +
          '<div class="small">点「记录」搜索食材，选好克数和做法，我来帮你算</div>' +
          '<button class="btn btn--sm" style="margin-top:12px" data-tab="log">记录第一口</button></div>') +
      "</div>" +

      /* 推荐 */
      '<div class="section"><div class="section__head"><div class="section__title">今日推荐 · 10 种</div>' +
      '<div class="section__hint">按膳食宝塔搭配</div></div>' +
      '<div class="rec-scroll">' + recs.map(recCard).join("") + "</div></div>" +

      /* 打卡 */
      '<div class="card card--flat section" style="background:#fbfdf7">' +
      '<div class="row" style="gap:14px"><div>' + Nutri.mascot.svg(mood) + "</div>" +
      '<div style="flex:1"><div class="bubble" style="border:0;box-shadow:none;padding:0;background:transparent">' + esc(bubble) + "</div></div></div>" +
      '<button class="btn btn--lg btn--block" style="margin-top:12px" data-act="checkin"' +
      (d.checkedIn ? " disabled" : "") + ">" +
      (d.checkedIn ? "今天已经打卡啦" : "完成今日打卡 +50 XP") + "</button></div>" +
      "</div>";
  }

  function logRow(it) {
    return '<div class="log-item">' +
      '<div class="log-item__emoji">' + catEmoji(it.cat) + "</div>" +
      '<div class="log-item__main"><div class="log-item__name">' + esc(it.name) + "</div>" +
      '<div class="log-item__meta">' + esc(it.methodName) + " · " + money(it.grams, 0) + " g 生重" +
      (it.cookedGrams && it.cookedGrams !== it.grams ? " → 熟重 " + money(it.cookedGrams, 0) + " g" : "") +
      (it.oil ? " · 油 " + money(it.oil, 1) + " g" : "") + "</div></div>" +
      '<div class="log-item__kcal">' + Math.round(it.kcal) + " kcal</div>" +
      '<button class="log-item__del" data-act="del-item" data-uid="' + esc(it.uid) + '" aria-label="删除">✕</button>' +
      "</div>";
  }

  function recCard(rec) {
    var f = rec.food;
    return '<div class="rec" data-act="open-food" data-id="' + esc(f.id) + '">' +
      '<div class="rec__emoji">' + catEmoji(f.cat) + "</div>" +
      '<div class="rec__name">' + esc(f.name) + "</div>" +
      '<div class="small muted bold">建议 ' + rec.grams + " g · " + rec.kcal + " kcal</div>" +
      '<div class="rec__why">' + esc(rec.reason) + "</div></div>";
  }

  /* ---------- 记录页 ---------- */
  function logView() {
    var f = log.food;
    var html = '<div class="view">' +
      '<div class="card section">' +
      '<div class="card__title">第一步 · 选食材</div>' +
      '<div class="search"><span class="search__icon">🔍</span>' +
      '<input class="search__input" id="food-search" placeholder="输入食材名，如 胡萝卜 / 鸡胸 / 蓝莓" value="' + esc(log.query) + '" autocomplete="off">' +
      '<button class="search__clear" id="search-clear" aria-label="清空">✕</button></div>' +
      '<div id="suggest"></div></div>';

    if (f) {
      var p = f.per100;
      html += '<div class="card section"><div class="row row--between">' +
        '<div class="row"><span style="font-size:26px">' + catEmoji(f.cat) + "</span>" +
        '<div><div class="bold" style="font-size:16px">' + esc(f.name) + "</div>" +
        '<div class="tiny muted">每 100 g 生重 · ' + esc(Nutri.CAT_LABEL[f.cat] || "其他") +
        (f.src === "USDA" ? ' · <span class="badge badge--usda">USDA</span>' : "") + "</div></div></div>" +
        '<button class="btn btn--xs btn--ghost" data-act="open-food" data-id="' + esc(f.id) + '">详情</button></div>' +
        '<div class="result-kv" style="margin-top:10px">' +
        kv("热量", money(p.kcal, 0), "kcal") + kv("蛋白质", money(p.protein, 1), "g") +
        kv("脂肪", money(p.fat, 1), "g") + kv("碳水", money(p.carb, 1), "g") +
        kv("膳食纤维", money(p.fiber, 1), "g") + kv("钙", money(p.calcium, 0), "mg") +
        "</div>" +
        (log.method === "blend"
          ? '<div class="warn-box" id="blend-warn">' + esc(Nutri.METHOD_MAP.blend.warn) + "</div>"
          : "") +
        "</div>";

      html += '<div class="card section"><div class="card__title">第二步 · 克数与做法</div>' +
        '<div class="grid grid--2">' +
        '<div class="field"><label class="field__label" for="grams">生重（克）</label>' +
        '<div class="input-group"><input class="input" id="grams" type="number" min="0" max="5000" step="1" value="' + log.grams + '">' +
        '<span class="unit">g</span></div>' +
        '<div class="tiny muted" id="grams-err" style="color:var(--red)"></div></div>' +
        '<div class="field"><label class="field__label" for="oil">用油（克，可留空自动）</label>' +
        '<div class="input-group"><input class="input" id="oil" type="number" min="0" max="200" step="0.5" value="' + (log.oil === null ? "" : log.oil) + '" placeholder="自动">' +
        '<span class="unit">g</span></div>' +
        '<div class="tiny muted">默认菜籽油 899 kcal/100 g</div></div></div>' +
        '<div class="field" style="margin-top:12px"><label class="field__label">烹饪方式（显示缩水率与用油量）</label>' +
        '<div class="methods" id="methods">' + Nutri.METHODS.map(function (m) { return methodCard(m, f); }).join("") + "</div></div>" +
        '<div class="row row--wrap" style="margin-top:10px">' +
        '<label class="row" style="gap:6px;font-size:13px;font-weight:800"><input type="checkbox" id="sugar-on"' + (log.sugarOn ? " checked" : "") + "> 计入红烧/炖的附加糖</label>" +
        '<label class="row" style="gap:6px;font-size:13px;font-weight:800"><input type="checkbox" id="salt-on"' + (log.saltOn ? " checked" : "") + "> 计入附加盐</label>" +
        "</div></div>";

      html += '<div id="preview">' + previewHtml(f) + "</div>";
    } else {
      html += '<div class="card section"><div class="empty"><div class="empty__icon">🥕</div>' +
        '<div class="empty__title">先搜一个食材</div><div class="small">内置 ' + Nutri.foods.length +
        " 条《中国食物成分表》数据，支持中文名和别名</div></div></div>";
    }
    return html + "</div>";
  }

  function kv(k, v, unit) {
    return '<div class="kv"><div class="kv__k">' + esc(k) + '</div><div class="kv__v">' + v +
      " <small>" + esc(unit) + "</small></div></div>";
  }

  function methodCard(m, food) {
    var pv = E.preview(food, log.grams || 100, m.id);
    var shrink = pv.yield > 1 ? "增重 " + pv.gainPct + "%" : "缩水 " + pv.shrinkPct + "%";
    if (pv.yield === 1) shrink = "重量不变";
    return '<button class="method' + (log.method === m.id ? " is-active" : "") + '" data-act="pick-method" data-id="' + m.id + '">' +
      '<div class="method__top"><span class="method__icon">' + m.icon + "</span><span>" + esc(m.name) + "</span></div>" +
      '<div class="method__stats">' +
      '<span class="method__stat method__stat--shrink">' + shrink + "</span>" +
      '<span class="method__stat method__stat--oil">用油 ' + (pv.oilPer100 ? pv.oilPer100 + " g/100g" : "0") + "</span>" +
      (m.warn ? '<span class="method__stat method__stat--warn">⚠️ 升糖更快</span>' : "") +
      "</div></button>";
  }

  function previewHtml(f) {
    var g = num(log.grams);
    if (!f || !(g > 0)) return '<div class="card section"><div class="empty small">输入克数后这里会实时算出营养</div></div>';
    var res = E.compute(f, g, log.method, {
      oil: log.oil === null ? undefined : log.oil,
      sugarApplied: log.sugarOn, saltApplied: log.saltOn
    });
    var pv = E.preview(f, g, log.method);
    return '<div class="card section"><div class="card__title">第三步 · 这一份的结果</div>' +
      '<div class="result-hero"><div><div class="result-hero__num">' + res.kcal + '</div>' +
      '<div class="result-hero__unit">kcal</div></div><div style="flex:1">' +
      '<div class="row row--wrap" style="gap:6px">' +
      chip("生重 " + money(g, 0) + " g", "chip--blue") +
      chip("熟重 " + money(res.cookedGrams, 0) + " g", "chip--green") +
      chip(pv.yield > 1 ? "吸水增重 " + pv.gainPct + "%" : "缩水 " + Math.max(0, res.shrinkPct) + "%", "") +
      chip("用油 " + money(res.oil, 1) + " g", "chip--orange") +
      (res.sugar ? chip("附加糖 " + money(res.sugar, 1) + " g", "chip--orange") : "") +
      (res.salt ? chip("附加盐 " + money(res.salt, 2) + " g", "") : "") +
      (res.method === "blend" ? chip("⚠️ 升糖更快", "chip--red") : "") +
      "</div>" + rateLine(res) + "</div></div>" +
      '<div class="result-kv" style="margin-top:12px">' +
      kv("蛋白质", money(res.n.protein, 1), "g") + kv("脂肪", money(res.n.fat, 1), "g") +
      kv("碳水", money(res.n.carb, 1), "g") + kv("膳食纤维", money(res.n.fiber, 1), "g") +
      kv("糖", money(res.n.sugar, 1), "g") + kv("钠", money(res.n.sodium, 0), "mg") +
      "</div>" +
      '<button class="btn btn--block btn--lg" style="margin-top:14px" data-act="add-item">加入今日</button>' +
      "</div>";
  }

  function rateLine(res) {
    var t = Nutri.computeTargets(S.load().profile);
    var parts = [];
    [["protein", "蛋白质"], ["fiber", "纤维"], ["vc", "维C"]].forEach(function (x) {
      var v = res.n[x[0]];
      if (v === null || v === undefined) return;
      var pct = E.pctOf(v, t[x[0]]);
      if (pct >= 15) parts.push(x[1] + "占今日 " + Math.round(pct) + "%");
    });
    if (!parts.length) return "";
    return '<div class="small muted bold" style="margin-top:8px">' + parts.join(" · ") + "</div>";
  }

  function refreshPreview() {
    var box = el("preview");
    if (box && log.food) box.innerHTML = previewHtml(log.food);
    var g = el("grams");
    if (g) {
      var m = el("methods");
      if (m) m.innerHTML = Nutri.METHODS.map(function (x) { return methodCard(x, log.food); }).join("");
    }
  }

  function refreshSuggest() {
    var box = el("suggest");
    if (!box) return;
    var q = log.query;
    var list = q ? E.search(q, null, 8) : E.search("", null, 8);
    if (!list.length) {
      box.innerHTML = '<div class="suggest" style="max-height:none"><div class="suggest__empty">' +
        "没有找到「" + esc(q) + "」。可以换个说法，或到「设置 → 食材库管理」上传自定义食材" +
        (S.load().settings.usdaEnabled && S.load().settings.usdaKey ? "；也可以尝试 USDA 联网查询" : "") +
        "</div>" +
        (S.load().settings.usdaEnabled && S.load().settings.usdaKey
          ? '<div style="padding:0 14px 14px"><button class="btn btn--sm btn--blue btn--block" data-act="usda-search">用 USDA 查询「' + esc(q) + "」</button></div>" : "") +
        "</div>";
      return;
    }
    box.innerHTML = '<div class="suggest">' + list.map(function (f) {
      return '<div class="suggest__item" data-act="pick-food" data-id="' + esc(f.id) + '">' +
        '<span style="font-size:19px">' + catEmoji(f.cat) + "</span>" +
        '<div style="flex:1;min-width:0"><div class="suggest__name">' + esc(f.name) + "</div>" +
        '<div class="suggest__meta">' + esc(Nutri.CAT_LABEL[f.cat] || "其他") + " · " +
        money(f.per100.kcal, 0) + " kcal/100g · 蛋白 " + money(f.per100.protein, 1) + " g</div></div>" +
        (f.common ? '<span class="badge">常用</span>' : "") +
        "</div>";
    }).join("") + "</div>";
  }

  /* ---------- 分析页 ---------- */
  function analysisView() {
    var state = S.load();
    var d = S.day();
    var stats = S.totals();
    var targets = Nutri.computeTargets(state.profile);
    var advice = R.advice(stats, targets, state.profile);
    var pyra = R.pyramidProgress(stats, d.items);

    if (!d.items.length) {
      return '<div class="view"><div class="card"><div class="empty"><div class="empty__icon">📊</div>' +
        '<div class="empty__title">今天还没有数据</div><div class="small">记录几样食物后，这里会显示营养缺口和宝塔达标情况</div>' +
        '<button class="btn btn--sm" style="margin-top:12px" data-tab="log">去记录</button></div></div></div>';
    }

    var groups = [["core", "能量与宏量"], ["vit", "维生素"], ["min", "矿物质"]];

    return '<div class="view">' +
      '<div class="card section"><div class="card__title">今日建议</div>' +
      advice.map(function (a) {
        var icon = a.type === "warn" ? "⚠️" : (a.type === "ok" ? "🎉" : "💡");
        return '<div class="row" style="align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px dashed #f0f0f0">' +
          '<span>' + icon + '</span><div class="small" style="flex:1;line-height:1.6">' + esc(a.text) + "</div></div>";
      }).join("") + "</div>" +

      '<div class="card section"><div class="card__title">膳食宝塔 · 今日</div>' +
      '<div class="pyramid">' + pyra.map(pyrRow).join("") + "</div>" +
      '<div class="tiny muted" style="margin-top:8px">生重计算；颜色：绿=达标，黄=不足，红=超出上限</div></div>' +

      groups.map(function (g) {
        return '<div class="card section"><div class="card__title">' + g[1] + "</div>" +
          Nutri.NUTRIENTS.filter(function (n) { return n.group === g[0]; }).map(function (n) {
            return barRow(n.label, stats[n.k], targets[n.k], n.unit, n.dec, n.max);
          }).join("") + "</div>";
      }).join("") +

      specialBlock(d) +
      "</div>";
  }

  function pyrRow(p) {
    var color = p.status === "ok" ? "#58cc02" : (p.status === "low" ? "#ffc800" : (p.status === "over" ? "#ff4b4b" : "#e2e2e2"));
    var w = Math.max(12, Math.min(100, p.pct));
    return '<div class="pyr-row"><div class="pyr-label">' + esc(p.key) + "</div>" +
      '<div style="flex:1"><div class="pyr-bar" style="width:' + w + "%;background:" + color + '">' +
      p.grams + " g</div></div>" +
      '<div class="pyr-val">' + p.min + "–" + p.max + " g</div></div>";
  }

  function specialBlock(d) {
    var seen = {};
    var list = [];
    d.items.forEach(function (it) {
      var f = Nutri.library.byId(it.foodId);
      if (!f || !f.special) return;
      f.special.forEach(function (s) {
        if (seen[s.n]) return;
        seen[s.n] = true;
        list.push({ food: f.name, n: s.n, a: s.a, d: s.d });
      });
    });
    if (!list.length) return "";
    return '<div class="card section card--orange"><div class="card__title">今天的特殊营养素</div>' +
      list.slice(0, 8).map(function (x) {
        return '<div style="padding:8px 0;border-bottom:1px dashed #ffe4b8">' +
          '<div class="row row--between"><span class="bold">' + esc(x.n) + "</span>" +
          '<span class="tiny muted">' + esc(x.food) + "</span></div>" +
          '<div class="small" style="color:var(--text-soft)">' + esc(x.a) + " · " + esc(x.d) + "</div></div>";
      }).join("") + "</div>";
  }

  /* ---------- 食物库 ---------- */
  function libraryResultsHtml() {
    var all = Nutri.library.foods();
    var q = lib.query.trim();
    var list;
    if (q) {
      list = E.search(q, null, 600);
    } else {
      var catOrder = Object.keys(Nutri.CAT_LABEL);
      list = all.slice().sort(function (a, b) {
        if (!!b.common !== !!a.common) return b.common ? 1 : -1;
        return (catOrder.indexOf(a.cat) - catOrder.indexOf(b.cat)) ||
          (a.name.length - b.name.length) || (a.name < b.name ? -1 : 1);
      });
    }
    if (lib.cat !== "all") list = list.filter(function (f) { return f.cat === lib.cat; });
    var shown = list.slice(0, lib.limit);

    return (shown.length ? shown.map(function (f) {
      return '<div class="food-row" data-act="open-food" data-id="' + esc(f.id) + '">' +
        '<span class="food-row__emoji">' + catEmoji(f.cat) + "</span>" +
        '<div class="food-row__main"><div class="food-row__name">' + esc(f.name) + "</div>" +
        '<div class="food-row__meta">' + esc(Nutri.CAT_LABEL[f.cat] || "其他") +
        (f.custom ? " · 自定义" : "") + (f.src === "USDA" ? " · USDA" : "") + "</div></div>" +
        '<div class="food-row__nums"><b>' + money(f.per100.kcal, 0) + "</b><span>kcal</span></div>" +
        '<div class="food-row__nums"><b>' + money(f.per100.protein, 1) + "</b><span>蛋白 g</span></div>" +
        "</div>";
    }).join("")
      : '<div class="empty"><div class="empty__icon">🔍</div><div class="empty__title">没有匹配的食材</div>' +
        (q ? '<div class="small">换个说法试试，或到「设置 → 食材库管理」上传自定义食材</div>' : "") + "</div>") +
      (list.length > shown.length
        ? '<button class="btn btn--ghost btn--block" style="margin-top:12px" data-act="lib-more">再加载 100 条（还剩 ' + (list.length - shown.length) + " 条）</button>"
        : "");
  }

  /* 只刷新结果区，绝不重建搜索框（否则中文输入法的组字会被打断） */
  function renderLibResults() {
    var box = el("lib-results");
    if (box) box.innerHTML = libraryResultsHtml();
  }

  var libTimer = null;
  function scheduleLibRender(value) {
    lib.query = value;
    lib.limit = 100;
    if (libTimer) clearTimeout(libTimer);
    libTimer = setTimeout(function () { libTimer = null; renderLibResults(); }, 120);
  }

  function libraryView() {
    var all = Nutri.library.foods();
    var cats = ["all"].concat(Object.keys(Nutri.CAT_LABEL));

    return '<div class="view">' +
      '<div class="card section"><div class="row row--between" style="margin-bottom:8px">' +
      '<div class="card__title" style="margin:0">食物库</div>' +
      '<div class="small muted bold">共 ' + all.length + " 条" +
      (Nutri.library.isTemp() ? " · 含自定义" : "") + "</div></div>" +
      '<div class="search"><span class="search__icon">🔍</span>' +
      '<input class="search__input" id="lib-search" placeholder="搜索食材" value="' + esc(lib.query) + '" autocomplete="off">' +
      '<button class="search__clear" id="lib-clear" aria-label="清空">✕</button></div>' +
      '<div class="row row--wrap" style="margin-top:10px;gap:6px">' +
      cats.map(function (c) {
        return '<button class="chip chip--btn' + (lib.cat === c ? " is-active" : "") + '" data-act="lib-cat" data-id="' + c + '">' +
          (c === "all" ? "全部" : (Nutri.CAT_LABEL[c] || c)) + "</button>";
      }).join("") + "</div></div>" +

      '<div class="card section" id="lib-results">' + libraryResultsHtml() + "</div></div>";
  }

  /* ---------- 食物详情弹窗 ---------- */
  function foodModal(id) {
    var f = Nutri.library.byId(id);
    if (!f) return;
    var rows = Nutri.NUTRIENTS.filter(function (n) { return n.group !== "core"; }).map(function (n) {
      var v = f.per100[n.k];
      return '<tr><td>' + esc(n.label) + "</td><td class=\"num\">" +
        (v === null || v === undefined ? '<span class="muted">未收录</span>' : money(v, n.dec) + " " + esc(n.unit)) +
        "</td></tr>";
    }).join("");
    var p = f.per100;
    modal('<div class="modal__head"><div><div class="modal__title">' + catEmoji(f.cat) + " " + esc(f.name) + "</div>" +
      '<div class="tiny muted">' + esc(Nutri.CAT_LABEL[f.cat] || "其他") + " · 每 100 g 可食部生重" +
      (f.custom ? " · 自定义" : "") + "</div></div>" +
      '<button class="modal__close" data-act="close-modal">✕</button></div>' +
      '<div class="result-hero" style="padding:12px"><div><div class="result-hero__num">' + money(p.kcal, 0) + "</div>" +
      '<div class="result-hero__unit">kcal / 100 g</div></div><div style="flex:1">' +
      '<div class="row row--wrap" style="gap:6px">' +
      chip("蛋白 " + money(p.protein, 1) + " g") + chip("脂肪 " + money(p.fat, 1) + " g") +
      chip("碳水 " + money(p.carb, 1) + " g") + chip("纤维 " + money(p.fiber, 1) + " g") + "</div></div></div>" +
      (f.special && f.special.length ? '<div class="card card--orange" style="margin-top:12px;padding:12px">' +
        '<div class="card__title" style="margin-bottom:6px">特殊营养素</div>' +
        f.special.map(function (s) {
          return '<div class="small" style="padding:3px 0"><b>' + esc(s.n) + "</b> " + esc(s.a || "") +
            '<div class="tiny muted">' + esc(s.d || "") + "</div></div>";
        }).join("") + "</div>" : "") +
      (f.remark ? '<div class="tiny muted" style="margin-top:8px">备注：' + esc(f.remark) + "</div>" : "") +
      '<details class="panel" style="margin-top:12px"><summary>其他营养素（25 项）</summary>' +
      '<table class="table"><tbody>' + rows + "</tbody></table></details>" +
      '<div class="modal__foot"><button class="btn btn--ghost" data-act="fav-food" data-id="' + esc(f.id) + '">' +
      ((S.load().favorites || []).indexOf(f.id) >= 0 ? "★ 已收藏" : "☆ 收藏") + "</button>" +
      '<button class="btn" data-act="use-food" data-id="' + esc(f.id) + '">用这个记录</button></div>' +
      '<div class="tiny muted" style="margin-top:10px">数据来源：' +
      (f.src === "USDA" ? "USDA FoodData Central（近似值，标注 est）" : "《中国食物成分表》第 6 版") +
      "。数值为典型值，不同品种/产地会有波动。</div>", { wide: true });
  }

  /* ---------- 首次引导 ---------- */
  var onb = {
    step: 0,
    d: { sex: "f", age: 25, height: 165, weight: 60, activity: 1.375,
         goal: "fatloss", deficit: 400, surplus: 300 }
  };
  var ONB_TOTAL = 5;

  function onbDots() {
    var s = "";
    for (var i = 0; i < ONB_TOTAL; i++) s += '<i class="' + (i <= onb.step ? "on" : "") + '"></i>';
    return '<div class="onb-dots">' + s + "</div>";
  }

  function onbOpt(id, title, desc, active, act) {
    return '<button type="button" class="opt' + (active ? " is-active" : "") + '" data-act="' + act + '" data-id="' + esc(id) + '">' +
      '<div class="opt__t">' + title + "</div>" +
      (desc ? '<div class="opt__d">' + desc + "</div>" : "") + "</button>";
  }

  function onbStep0() {
    var d = onb.d;
    return '<div class="field"><label class="field__label">性别</label><div class="opt-grid">' +
      onbOpt("f", "女", "铁 18 mg、蛋白按体重算", d.sex === "f", "onb-sex") +
      onbOpt("m", "男", "铁 12 mg、蛋白按体重算", d.sex === "m", "onb-sex") +
      "</div></div>" +
      '<div class="field" style="margin-top:14px"><label class="field__label">年龄</label>' +
      '<div class="input-group"><input class="input" id="onb-age" type="number" min="10" max="100" value="' + d.age +
      '"><span class="unit">岁</span></div></div>';
  }

  function onbStep1() {
    var d = onb.d;
    var bmi = d.height > 0 ? Nutri.bmi(d) : 0;
    var bl = Nutri.bmiLabel(bmi);
    return '<div class="grid grid--2">' +
      '<div class="field"><label class="field__label">身高</label>' +
      '<div class="input-group"><input class="input" id="onb-height" type="number" step="0.5" min="100" max="250" value="' + d.height +
      '"><span class="unit">cm</span></div></div>' +
      '<div class="field"><label class="field__label">体重</label>' +
      '<div class="input-group"><input class="input" id="onb-weight" type="number" step="0.1" min="30" max="300" value="' + d.weight +
      '"><span class="unit">kg</span></div></div></div>' +
      '<div class="row row--wrap" style="margin-top:12px;gap:6px" id="onb-bmi">' +
      chip("BMI " + bmi.toFixed(1) + " · " + bl.label, bl.cls) + "</div>" +
      '<div class="tiny muted" style="margin-top:6px">BMI 只是参考，肌肉量高的人会偏高。</div>';
  }

  function onbStep2() {
    var d = onb.d;
    return '<div class="opt-grid">' + Nutri.ACTIVITY.map(function (a) {
      return onbOpt(String(a.v), a.label, a.desc, Math.abs(d.activity - a.v) < 0.001, "onb-act");
    }).join("") + "</div>";
  }

  function onbStep3() {
    var d = onb.d;
    var body = '<div class="opt-grid">' +
      onbOpt("fatloss", "减脂", "热量缺口，保住肌肉", d.goal === "fatloss", "onb-goal") +
      onbOpt("maintain", "保持", "热量平衡，维持现在的体重", d.goal === "maintain", "onb-goal") +
      onbOpt("gain", "增肌", "热量盈余，配合力量训练", d.goal === "gain", "onb-goal") +
      "</div>";
    if (d.goal === "maintain") {
      body += '<div class="tiny muted" style="margin-top:12px">保持体重：目标热量 = 每日消耗</div>';
    } else if (d.goal === "gain") {
      body += '<div class="field" style="margin-top:12px"><label class="field__label">盈余强度</label>' +
        '<select class="input" id="onb-strength">' +
        '<option value="200"' + ((d.surplus || 300) === 200 ? " selected" : "") + ">轻盈 · +200 kcal</option>" +
        '<option value="300"' + ((d.surplus || 300) === 300 ? " selected" : "") + ">标准 · +300 kcal</option>" +
        "</select></div>";
    } else {
      body += '<div class="field" style="margin-top:12px"><label class="field__label">缺口强度</label>' +
        '<select class="input" id="onb-strength">' +
        '<option value="250"' + ((d.deficit || 400) === 250 ? " selected" : "") + ">温和 · −250 kcal（每周约 0.25 kg）</option>" +
        '<option value="400"' + ((d.deficit || 400) === 400 ? " selected" : "") + ">标准 · −400 kcal（每周约 0.4 kg）</option>" +
        '<option value="500"' + ((d.deficit || 400) === 500 ? " selected" : "") + ">激进 · −500 kcal（每周约 0.5 kg）</option>" +
        "</select></div>";
    }
    return body;
  }

  function onbStep4() {
    var d = onb.d;
    var t = Nutri.computeTargets(d);
    var bmi = Nutri.bmi(d);
    var bl = Nutri.bmiLabel(bmi);
    var goalText = Nutri.GOAL_LABEL[t.goal] +
      (t.goal === "fatloss" ? " · 缺口 " + t.deficit : (t.goal === "gain" ? " · 盈余 " + t.surplus : " · 热量平衡"));
    return '<div class="result-hero"><div><div class="result-hero__num">' + t.kcal +
      '</div><div class="result-hero__unit">kcal / 天</div></div><div style="flex:1">' +
      '<div class="row row--wrap" style="gap:6px">' +
      chip(goalText, "chip--green") + chip("BMI " + bmi.toFixed(1) + " " + bl.label, bl.cls) + "</div>" +
      '<div class="tiny muted" style="margin-top:8px">BMR ' + t.bmr + " kcal · TDEE " + t.tdee +
      " kcal · 热量下限 " + t.floor + " kcal</div></div></div>" +
      '<div class="result-kv" style="margin-top:12px">' +
      kv("蛋白质", t.protein, "g") + kv("脂肪", t.fat, "g") + kv("碳水", t.carb, "g") +
      kv("膳食纤维", t.fiber, "g") + kv("铁", t.iron, "mg") + kv("钙", t.calcium, "mg") +
      "</div>" +
      (bmi < 15 || bmi > 45
        ? '<div class="err" style="margin-top:10px">BMI 有点极端，请确认身高体重是否填对。</div>' : "") +
      '<div class="tiny muted" style="margin-top:10px">参考《中国居民膳食营养素参考摄入量（2023）》。孕期、哺乳期、慢性病或进食障碍史请咨询医生或注册营养师。</div>';
  }

  function onbRead() {
    var d = onb.d;
    if (onb.step === 0) { var a = el("onb-age"); if (a) d.age = num(a.value); }
    if (onb.step === 1) {
      var h = el("onb-height"); if (h) d.height = num(h.value);
      var w = el("onb-weight"); if (w) d.weight = num(w.value);
    }
    if (onb.step === 3) {
      var st = el("onb-strength");
      if (st) {
        if (d.goal === "gain") d.surplus = num(st.value) || 300;
        else if (d.goal === "fatloss") d.deficit = num(st.value) || 400;
      }
    }
  }

  function onbValidate() {
    var d = onb.d;
    if (onb.step === 0 && !(d.age >= 10 && d.age <= 100)) return "年龄请填 10–100 岁";
    if (onb.step === 1) {
      if (!(d.height >= 100 && d.height <= 250)) return "身高请填 100–250 cm";
      if (!(d.weight >= 30 && d.weight <= 300)) return "体重请填 30–300 kg";
    }
    return "";
  }

  function onbError(msg) {
    var box = el("onb-err");
    if (box) box.textContent = msg;
  }

  function renderOnb() {
    var titles = ["先认识一下你", "你的身高和体重", "平时动得多吗", "你想达成什么", "这是给你的每日目标"];
    var body = "";
    if (onb.step === 0) body = onbStep0();
    else if (onb.step === 1) body = onbStep1();
    else if (onb.step === 2) body = onbStep2();
    else if (onb.step === 3) body = onbStep3();
    else body = onbStep4();

    var foot = (onb.step > 0 ? '<button type="button" class="btn btn--ghost" data-act="onb-back">上一步</button>' : "") +
      (onb.step < ONB_TOTAL - 1
        ? '<button type="button" class="btn" data-act="onb-next">下一步</button>'
        : '<button type="button" class="btn" data-act="onb-finish">开始使用</button>');

    modal('<div class="modal__head"><div><div class="modal__title">' + titles[onb.step] + "</div>" +
      '<div class="tiny muted">第 ' + (onb.step + 1) + " / " + ONB_TOTAL +
      " 步 · 数据只保存在你自己的浏览器里</div></div></div>" +
      onbDots() +
      '<div class="modal__body">' + body + '<div class="err" id="onb-err" style="margin-top:8px"></div></div>' +
      '<div class="modal__foot">' + foot + "</div>", { dismissible: false });

    if (onb.step === 1) {
      ["onb-height", "onb-weight"].forEach(function (id) {
        var input = el(id);
        if (!input) return;
        input.addEventListener("input", function () {
          onbRead();
          var box = el("onb-bmi");
          if (!box) return;
          var b = Nutri.bmi(onb.d);
          var l = Nutri.bmiLabel(b);
          box.innerHTML = chip("BMI " + b.toFixed(1) + " · " + l.label, l.cls);
        });
      });
    }
  }

  function showOnboarding() {
    onb.step = 0;
    renderOnb();
  }

  function finishOnboarding() {
    var d = onb.d;
    S.finishOnboarding({
      sex: d.sex, age: d.age, height: d.height, weight: d.weight,
      activity: d.activity, goal: d.goal, deficit: d.deficit, surplus: d.surplus
    });
    closeModal();
    render();
    toast("档案已保存，开始记录你的第一餐吧", "ok");
  }

  /* ---------- 设置页 ---------- */
  function goalValue(p) {
    if (p.goal === "maintain") return "maintain:0";
    if (p.goal === "gain") return "gain:" + (p.surplus || 300);
    return "fatloss:" + (p.deficit || 400);
  }

  function goalOptions(p) {
    var cur = goalValue(p);
    var opts = [
      ["fatloss:250", "减脂 · 温和（缺口 250 kcal）"],
      ["fatloss:400", "减脂 · 标准（缺口 400 kcal）"],
      ["fatloss:500", "减脂 · 激进（缺口 500 kcal）"],
      ["maintain:0", "保持体重"],
      ["gain:200", "增肌 · 盈余 200 kcal"],
      ["gain:300", "增肌 · 盈余 300 kcal"]
    ];
    return opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === cur ? " selected" : "") + ">" + o[1] + "</option>";
    }).join("");
  }

  function settingsView() {
    var s = S.load();
    var p = s.profile;
    var t = Nutri.computeTargets(p);
    var st = Nutri.library.stats();
    var bmi = Nutri.bmi(p);
    var bl = Nutri.bmiLabel(bmi);
    return '<div class="view">' +
      '<div class="card section"><div class="card__title">我的档案</div>' +
      '<div class="grid grid--2">' +
      field("age", "年龄", p.age, "岁") + field("height", "身高", p.height, "cm") +
      field("weight", "体重", p.weight, "kg") +
      '<div class="field"><label class="field__label">性别</label>' +
      '<select class="input" id="p-sex">' +
      '<option value="f"' + (p.sex !== "m" ? " selected" : "") + ">女</option>" +
      '<option value="m"' + (p.sex === "m" ? " selected" : "") + ">男</option>" +
      "</select></div>" +
      '<div class="field"><label class="field__label">活动量</label>' +
      '<select class="input" id="p-activity">' + Nutri.ACTIVITY.map(function (a) {
        return '<option value="' + a.v + '"' + (Math.abs(a.v - p.activity) < 0.001 ? " selected" : "") + ">" +
          a.label + "（" + a.desc + "）</option>";
      }).join("") + "</select></div></div>" +
      '<div class="field" style="margin-top:12px"><label class="field__label">目标</label>' +
      '<select class="input" id="p-goal">' + goalOptions(p) + "</select></div>" +
      '<div class="card card--blue" style="margin-top:12px;padding:12px">' +
      '<div class="small bold">当前目标</div>' +
      '<div class="row row--wrap" style="gap:6px;margin-top:6px">' +
      chip(Nutri.GOAL_LABEL[t.goal] + (t.goal === "fatloss" ? " −" + t.deficit : (t.goal === "gain" ? " +" + t.surplus : "")), "chip--green") +
      chip("能量 " + t.kcal + " kcal", "chip--orange") + chip("蛋白 " + t.protein + " g") +
      chip("脂肪 " + t.fat + " g") + chip("碳水 " + t.carb + " g") +
      chip("BMI " + bmi.toFixed(1) + " " + bl.label, bl.cls) + "</div>" +
      '<div class="tiny muted" style="margin-top:6px">BMR ' + t.bmr + " kcal · TDEE " + t.tdee +
      " kcal · 热量下限 " + t.floor + " kcal</div>" +
      '<div class="tiny muted" style="margin-top:4px">参考 DRIs 2023；孕期、哺乳期、慢性病请咨询医生。</div></div>' +
      '<button class="btn btn--block" style="margin-top:12px" data-act="save-profile">保存档案</button></div>' +

      '<div class="card section"><div class="card__title">食材库管理</div>' +
      '<div class="small muted" style="margin-bottom:10px">内置 ' + st.builtin + " 条《中国食物成分表》数据。上传的自定义食材" +
      "<b>只存在于本次打开的内存里</b>，刷新页面就会恢复内置库；打卡记录不受影响。</div>" +
      (st.temp ? '<div class="chip chip--orange" style="margin-bottom:10px">当前为临时库：' +
        (st.replaced ? "全量替换 " + st.replaced + " 条" : "追加 " + st.custom + " 条") + "</div>" : "") +
      '<div class="row row--wrap" style="gap:8px">' +
      '<label class="btn btn--blue btn--sm" style="cursor:pointer">📁 追加食材<input type="file" id="file-append" accept=".json,application/json" hidden></label>' +
      '<label class="btn btn--ghost btn--sm" style="cursor:pointer">📦 全量替换<input type="file" id="file-replace" accept=".json,application/json" hidden></label>' +
      '<button class="btn btn--ghost btn--sm" data-act="export-lib">⬇️ 导出当前库</button>' +
      '<button class="btn btn--ghost btn--sm" data-act="reset-lib"' + (st.temp ? "" : " disabled") + ">♻️ 恢复内置库</button>" +
      "</div>" +
      '<div class="tiny muted" style="margin-top:10px">JSON 格式：<code>[{"name":"胡萝卜","cat":"rootVeg","per100":{"kcal":39,"protein":1.0}}]</code>，' +
      "与「导出」文件结构一致；name 与 per100.kcal 必填。</div></div>" +

      '<div class="card section"><div class="card__title">USDA 联网补全（可选）</div>' +
      '<div class="small muted" style="margin-bottom:10px">内置库查不到时，可用你的 api.data.gov KEY 查询 USDA FoodData Central。KEY 只保存在本机浏览器，不会上传。</div>' +
      '<div class="field"><label class="field__label">API KEY</label>' +
      '<input class="input" id="usda-key" type="password" placeholder="粘贴你的 api.data.gov KEY" value="' + esc(s.settings.usdaKey) + '"></div>' +
      '<label class="row" style="gap:8px;margin-top:10px;font-size:13.5px;font-weight:800">' +
      '<input type="checkbox" id="usda-on"' + (s.settings.usdaEnabled ? " checked" : "") + "> 开启联网查询（本地库无结果时才调用）</label>" +
      '<div class="tiny muted" style="margin-top:8px">注意：浏览器直连 USDA 可能被 CORS 拦截；失败会自动回退内置数据。</div>' +
      '<button class="btn btn--block btn--sm" style="margin-top:10px" data-act="save-usda">保存</button></div>' +

      '<div class="card section"><div class="card__title">分享给朋友</div>' +
      '<div class="small muted">把这个 <b>index.html</b> 发给朋友（微信文件、邮件、网盘都行）。对方第一次打开会先填自己的性别、年龄、身高、体重、活动量和目标，'
      + "之后就是他自己的记录本——你们的数据各存各的浏览器，互不影响。</div>" +
      '<div class="tiny muted" style="margin-top:8px">手机微信里直接点 HTML 会显示成文件而不是网页，需要在电脑上双击打开；'
      + "换电脑或清理浏览器数据前，先导出备份（备份里不含 USDA KEY，新设备要重新填）。</div>" +
      '<div class="row row--wrap" style="gap:8px;margin-top:10px">' +
      '<button class="btn btn--blue btn--sm" data-act="export-backup">⬇️ 导出我的备份</button>' +
      '<label class="btn btn--ghost btn--sm" style="cursor:pointer">⬆️ 导入备份<input type="file" id="file-backup" accept=".json,application/json" hidden></label>' +
      "</div></div>" +

      '<div class="card section"><div class="card__title">数据与隐私</div>' +
      '<div class="small muted">打卡记录保存在本机 localStorage（' + (S.canStore() ? "可用" : "不可用，本次不会保存") + "）。" +
      "食物数据来自《中国食物成分表》第 6 版公开转换版与 USDA，仅为营养参考，不构成医疗建议。</div>" +
      '<button class="btn btn--red btn--sm" style="margin-top:12px" data-act="reset-all">清空所有打卡记录</button></div>' +
      "</div>";
  }

  function field(id, label, value, unit) {
    return '<div class="field"><label class="field__label" for="p-' + id + '">' + label + "</label>" +
      '<div class="input-group"><input class="input" id="p-' + id + '" type="number" step="0.5" value="' + value + '">' +
      '<span class="unit">' + unit + "</span></div></div>";
  }

  /* ---------- 打卡 ---------- */
  function doCheckIn() {
    var r = S.checkIn();
    if (!r.ok) {
      toast(r.reason === "empty" ? "先记录至少一种食物再打卡哦" : "今天已经打过卡啦", "err");
      return;
    }
    var tip = S.pickTip();
    var state = S.load();
    var lv = S.levelProgress(state.xp);
    Nutri.mascot.confetti();
    modal('<div class="center">' + Nutri.mascot.svg("celebrate", "mascot--lg") +
      '<h2 style="margin-top:6px">打卡成功！</h2>' +
      '<div class="row" style="justify-content:center;gap:8px;margin:10px 0">' +
      chip("🔥 连续 " + r.streak + " 天", "chip--orange") + chip("+50 XP", "chip--blue") +
      chip("Lv." + lv.level) + "</div></div>" +
      '<div class="tip-card" style="margin-top:6px"><div class="tip-card__label">今日营养小知识</div>' +
      '<div class="tip-card__title">' + esc(tip.title) + "</div>" +
      '<div class="tip-card__body">' + esc(tip.body) + "</div></div>" +
      '<div class="modal__foot"><button class="btn" data-act="close-modal">收下啦</button></div>', { dismissible: true });
    render();
  }

  /* ---------- 渲染入口 ---------- */
  function render() {
    var state = S.load();
    S.day();
    S.refreshQuests();
    var html;
    switch (tab) {
      case "log": html = logView(); break;
      case "analysis": html = analysisView(); break;
      case "library": html = libraryView(); break;
      case "settings": html = settingsView(); break;
      default: html = homeView();
    }
    root.innerHTML = html;
    renderTop();
    renderNav();
    mount();
  }

  function mount() {
    if (tab === "log") {
      var s = el("food-search");
      if (s) {
        s.addEventListener("input", function () {
          log.query = s.value;
          log.showSuggest = true;
          refreshSuggest();
        });
        s.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            var first = document.querySelector(".suggest__item");
            if (first) first.click();
          }
        });
      }
      var c = el("search-clear");
      if (c) c.addEventListener("click", function () {
        log.query = ""; log.food = null; log.showSuggest = false;
        el("food-search").value = "";
        render();
      });
      var g = el("grams");
      if (g) g.addEventListener("input", function () {
        log.grams = num(g.value);
        var err = el("grams-err");
        if (err) err.textContent = (log.grams <= 0 || log.grams > 5000) ? "请输入 1–5000 克" : "";
        refreshPreview();
      });
      var o = el("oil");
      if (o) o.addEventListener("input", function () {
        log.oil = o.value === "" ? null : num(o.value);
        refreshPreview();
      });
      var so = el("sugar-on");
      if (so) so.addEventListener("change", function () { log.sugarOn = so.checked; refreshPreview(); });
      var sa = el("salt-on");
      if (sa) sa.addEventListener("change", function () { log.saltOn = sa.checked; refreshPreview(); });
      if (log.query && log.showSuggest) refreshSuggest();
    }
    if (tab === "library") {
      var ls = el("lib-search");
      if (ls) {
        var composing = false;
        ls.addEventListener("compositionstart", function () { composing = true; });
        ls.addEventListener("compositionend", function () {
          composing = false;
          scheduleLibRender(ls.value);
        });
        ls.addEventListener("input", function (e) {
          /* 组字过程中不筛选，否则中文输入法的候选词会被打断 */
          if (composing || (e && e.isComposing)) return;
          scheduleLibRender(ls.value);
        });
      }
      var lc = el("lib-clear");
      if (lc) lc.addEventListener("click", function () {
        var input = el("lib-search");
        if (input) { input.value = ""; input.focus(); }
        scheduleLibRender("");
      });
    }
  }

  /* ---------- 事件委托 ---------- */
  function bindGlobal() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-tab],[data-act]");
      if (!t) return;
      var tabName = t.getAttribute("data-tab");
      if (tabName) { switchTab(tabName); return; }
      var act = t.getAttribute("data-act");
      var id = t.getAttribute("data-id");
      switch (act) {
        case "close-modal": closeModal(); break;
        case "pick-food":
          log.food = Nutri.library.byId(id); log.query = log.food ? log.food.name : "";
          log.showSuggest = false;
          render();
          break;
        case "open-food": foodModal(id); break;
        case "use-food": closeModal(); log.food = Nutri.library.byId(id); log.grams = 100; switchTab("log"); break;
        case "fav-food": {
          var on = S.toggleFav(id);
          toast(on ? "已收藏" : "已取消收藏", "ok");
          foodModal(id);
          break;
        }
        case "pick-method":
          log.method = id;
          render();
          if (id === "blend") {
            var warnEl = el("blend-warn");
            if (warnEl && typeof warnEl.scrollIntoView === "function") {
              warnEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
          break;
        case "add-item": addCurrent(); break;
        case "del-item": S.removeItem(t.getAttribute("data-uid")); toast("已删除", "ok"); render(); break;
        case "checkin": doCheckIn(); break;
        case "lib-cat":
          lib.cat = id;
          lib.limit = 100;
          Array.prototype.forEach.call(document.querySelectorAll('[data-act="lib-cat"]'), function (b) {
            b.classList.toggle("is-active", b.getAttribute("data-id") === id);
          });
          renderLibResults();
          break;
        case "lib-more": lib.limit += 100; renderLibResults(); break;
        case "onb-sex": onbRead(); onb.d.sex = id === "m" ? "m" : "f"; renderOnb(); break;
        case "onb-act": onbRead(); onb.d.activity = num(id) || 1.375; renderOnb(); break;
        case "onb-goal": onbRead(); onb.d.goal = id; renderOnb(); break;
        case "onb-next": {
          onbRead();
          var e1 = onbValidate();
          if (e1) { onbError(e1); break; }
          onb.step += 1;
          renderOnb();
          break;
        }
        case "onb-back":
          onbRead();
          onb.step = Math.max(0, onb.step - 1);
          renderOnb();
          break;
        case "onb-finish": {
          onbRead();
          var e2 = onbValidate();
          if (e2) { onbError(e2); break; }
          finishOnboarding();
          break;
        }
        case "save-profile": saveProfile(); break;
        case "export-backup": exportBackup(); break;
        case "confirm-import": doImport(); break;
        case "save-usda": saveUsda(); break;
        case "export-lib": exportLib(); break;
        case "reset-lib": Nutri.library.reset(); toast("已恢复内置库", "ok"); render(); break;
        case "reset-all":
          modal('<div class="modal__head"><div class="modal__title">清空所有记录？</div></div>' +
            '<div class="modal__body">打卡记录、连续天数、XP、收藏都会被删除，且无法恢复。食材库不受影响。</div>' +
            '<div class="modal__foot"><button class="btn btn--ghost" data-act="close-modal">取消</button>' +
            '<button class="btn btn--red" data-act="confirm-reset">确认清空</button></div>');
          break;
        case "confirm-reset": S.resetAll(); closeModal(); toast("已清空", "ok"); render(); break;
        case "usda-search": usdaSearch(log.query); break;
        case "usda-pick": {
          var idx = +t.getAttribute("data-idx");
          var arr = Nutri.ui._usdaCache || [];
          if (arr[idx]) {
            log.food = arr[idx];
            log.query = arr[idx].name;
            render();
          }
          break;
        }
      }
    });

    document.addEventListener("change", function (e) {
      if (e.target.id === "file-append") handleFile(e.target.files[0], "append");
      if (e.target.id === "file-replace") handleFile(e.target.files[0], "replace");
      if (e.target.id === "file-backup") handleBackup(e.target.files[0]);
    });
  }

  function switchTab(name) {
    tab = name;
    if (libTimer) { clearTimeout(libTimer); libTimer = null; }
    if (name === "log") { log.query = ""; }
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addCurrent() {
    var f = log.food;
    if (!f) { toast("先选一个食材", "err"); return; }
    var g = num(log.grams);
    if (!(g > 0) || g > 5000) { toast("克数请填 1–5000", "err"); return; }
    var res = E.compute(f, g, log.method, {
      oil: log.oil === null ? undefined : log.oil,
      sugarApplied: log.sugarOn, saltApplied: log.saltOn
    });
    res.food = Object.assign({}, f, { id: f.id, name: f.name, cat: f.cat });
    S.addItem(res);
    toast("已加入今日 · " + Math.round(res.kcal) + " kcal", "ok");
    log.food = null; log.query = ""; log.grams = 150; log.oil = null;
    render();
  }

  function saveProfile() {
    var p = {
      age: num(val("p-age")), height: num(val("p-height")), weight: num(val("p-weight")),
      activity: num(val("p-activity")), sex: val("p-sex") === "m" ? "m" : "f"
    };
    var gv = String(val("p-goal") || "fatloss:400").split(":");
    p.goal = gv[0] === "maintain" || gv[0] === "gain" ? gv[0] : "fatloss";
    p.deficit = p.goal === "fatloss" ? (parseInt(gv[1], 10) || 400) : 0;
    p.surplus = p.goal === "gain" ? (parseInt(gv[1], 10) || 300) : 0;
    if (!(p.age > 0 && p.age < 120)) { toast("年龄请填 1–120", "err"); return; }
    if (!(p.height > 100 && p.height < 250)) { toast("身高请填 100–250 cm", "err"); return; }
    if (!(p.weight > 30 && p.weight < 300)) { toast("体重请填 30–300 kg", "err"); return; }
    S.setProfile(p);
    toast("档案已更新，目标已重算", "ok");
    render();
  }

  function saveUsda() {
    S.setSettings({ usdaKey: val("usda-key").trim(), usdaEnabled: el("usda-on").checked });
    toast("已保存", "ok");
  }

  function handleFile(file, mode) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { showImportResult(false, ["文件超过 8 MB，请拆分后再上传。"]); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); }
      catch (err) { showImportResult(false, ["JSON 解析失败：" + err.message]); return; }
      var res = mode === "append" ? Nutri.library.append(data) : Nutri.library.replaceAll(data);
      if (!res.ok) { showImportResult(false, res.errors); return; }
      showImportResult(true, [], mode === "append"
        ? "已追加 " + res.added + " 条" + (res.skipped ? "，跳过同名 " + res.skipped + " 条" : "")
        : "已全量替换为 " + res.added + " 条（仅本次生效）");
      render();
    };
    reader.onerror = function () { showImportResult(false, ["读取文件失败，请重试。"]); };
    reader.readAsText(file, "utf-8");
  }

  function showImportResult(ok, errors, msg) {
    modal('<div class="modal__head"><div class="modal__title">' + (ok ? "✅ 导入成功" : "❌ 导入失败") + "</div>" +
      '<button class="modal__close" data-act="close-modal">✕</button></div>' +
      '<div class="modal__body">' + (ok ? esc(msg || "") : '<div class="small">共 ' + errors.length + " 处问题：</div>" +
        '<ul class="small" style="padding-left:18px;margin-top:8px;max-height:260px;overflow:auto">' +
        errors.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>") + "</div>" +
      '<div class="modal__foot"><button class="btn" data-act="close-modal">知道了</button></div>', { wide: true });
  }

  function exportLib() {
    try {
      var blob = new Blob([Nutri.library.exportJson()], { type: "application/json;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "foods-export-" + S.today().replace(/-/g, "") + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 400);
      toast("已导出 " + Nutri.library.foods().length + " 条", "ok");
    } catch (e) {
      toast("导出失败：" + e.message, "err");
    }
  }

  /* ---------- 备份 ---------- */
  var pendingImport = null;

  function exportBackup() {
    try {
      var blob = new Blob([S.exportState()], { type: "application/json;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "nutri-backup-" + S.today().replace(/-/g, "") + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 400);
      toast("已导出备份（不含 USDA KEY）", "ok");
    } catch (e) {
      toast("导出失败：" + e.message, "err");
    }
  }

  function handleBackup(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      pendingImport = String(reader.result);
      var obj = null;
      try { obj = JSON.parse(pendingImport); } catch (e) { /* 交给 importState 报错 */ }
      var days = obj && obj.days ? Object.keys(obj.days).length : 0;
      modal('<div class="modal__head"><div class="modal__title">导入备份？</div></div>' +
        '<div class="modal__body">这份备份包含 <b>' + days + '</b> 天记录。导入后，"当前这台浏览器上的档案与打卡记录" 会被完全覆盖（食材库不受影响）。</div>' +
        '<div class="modal__foot"><button class="btn btn--ghost" data-act="close-modal">取消</button>' +
        '<button class="btn" data-act="confirm-import">确认导入</button></div>');
    };
    reader.onerror = function () { toast("读取文件失败", "err"); };
    reader.readAsText(file, "utf-8");
  }

  function doImport() {
    if (!pendingImport) { closeModal(); return; }
    var r = S.importState(pendingImport);
    pendingImport = null;
    closeModal();
    if (!r.ok) { toast("导入失败：" + r.error, "err"); return; }
    toast("已导入备份（" + r.days + " 天记录）", "ok");
    render();
  }

  function usdaSearch(q) {
    var s = S.load().settings;
    if (!s.usdaKey) { toast("请先在设置里填写 USDA KEY", "err"); return; }
    var list = el("suggest");
    if (list) list.innerHTML = '<div class="suggest"><div class="suggest__empty">正在查询 USDA…</div></div>';
    Nutri.usda.search(q, s.usdaKey).then(function (items) {
      if (!items.length) { toast("USDA 也没有找到，试试英文名", "err"); render(); return; }
      var box = el("suggest");
      if (!box) return;
      box.innerHTML = '<div class="suggest">' + items.map(function (f, i) {
        return '<div class="suggest__item" data-act="usda-pick" data-idx="' + i + '">' +
          '<span style="font-size:19px">🍽️</span><div style="flex:1;min-width:0">' +
          '<div class="suggest__name">' + esc(f.name) + '</div><div class="suggest__meta">USDA · ' +
          money(f.per100.kcal, 0) + " kcal/100g</div></div></div>";
      }).join("") + "</div>";
      Nutri.ui._usdaCache = items;
    }).catch(function (err) {
      toast("USDA 查询失败：" + (err && err.message ? err.message : "网络/CORS 受限"), "err");
      render();
    });
  }

  function init() {
    root = el("view");
    bindGlobal();
    render();
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) render();
    });
  }

  return {
    init: init, render: render, switchTab: switchTab, toast: toast,
    modal: modal, closeModal: closeModal, foodModal: foodModal,
    renderTop: renderTop, showOnboarding: showOnboarding
  };
})();
