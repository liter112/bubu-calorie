/* ===== 自测：打开 index.html#selftest 查看 ===== */
window.Nutri = window.Nutri || {};

Nutri.selftest = (function () {
  var results = [];

  function ok(name, cond, detail) {
    results.push({ name: name, pass: !!cond, detail: detail === undefined ? "" : String(detail) });
  }
  function near(name, actual, expected, tol, unit) {
    var pass = Math.abs(actual - expected) <= (tol === undefined ? 0.01 : tol);
    ok(name, pass, "实际 " + (Math.round(actual * 100) / 100) + (unit || "") +
      " / 期望 " + expected + (unit || ""));
  }

  function run() {
    var E = Nutri.engine, S = Nutri.store, R = Nutri.recommend;
    results = [];

    /* 1. 目标计算 */
    var t = Nutri.computeTargets(Nutri.DEFAULT_PROFILE);
    near("BMR（Mifflin）", t.bmr, 1362, 2, " kcal");
    near("TDEE", t.tdee, 1873, 4, " kcal");
    near("目标热量 = TDEE − 500", t.kcal, 1373, 3, " kcal");
    near("蛋白质 1.25 g/kg", t.protein, 80, 1, " g");
    near("脂肪 25%E", t.fat, 38, 2, " g");
    ok("热量不低于 1200 下限", t.kcal >= 1200, t.kcal);
    ok("三大宏量能量自洽", Math.abs(t.protein * 4 + t.fat * 9 + t.carb * 4 - t.kcal) <= 8,
      t.protein * 4 + t.fat * 9 + t.carb * 4 + " vs " + t.kcal);

    /* 2. 食材缩放与烹饪 */
    var carrot = Nutri.foods.filter(function (f) {
      return f.name.indexOf("胡萝卜（红") === 0;
    })[0] || Nutri.foods.filter(function (f) { return f.name.indexOf("胡萝卜") === 0; })[0];
    ok("找到胡萝卜数据", !!carrot, carrot ? carrot.name : "无");
    if (carrot) {
      var plain = E.compute(carrot, 150, "raw");
      near("150 g 胡萝卜生食热量", plain.kcal, 58.5, 1, " kcal");
      var st = E.compute(carrot, 150, "stirfry");
      near("爆炒默认用油 9 g", st.oil, 9, 0.2, " g");
      near("爆炒后热量含油", st.kcal, 139, 2, " kcal");
      near("爆炒脂肪含油", st.n.fat, 9.3, 0.2, " g");
      near("爆炒熟重（缩水 18%）", st.cookedGrams, 123, 1, " g");
      ok("缩水率显示 18%", st.shrinkPct === 18, st.shrinkPct);
      var boiled = E.compute(carrot, 100, "boil");
      ok("水煮用油为 0", boiled.oil === 0, boiled.oil);
      ok("水煮维生素 C 有留存损失", boiled.n.vc < (carrot.per100.vc || 0),
        boiled.n.vc + " < " + carrot.per100.vc);
    }

    /* 3. 手填油量覆盖 */
    if (carrot) {
      var o = E.compute(carrot, 100, "boil", { oil: 5 });
      near("手填油量生效", o.n.fat, (carrot.per100.fat || 0) + 5, 0.2, " g");
      near("手填油量计入热量", o.kcal, Math.round((carrot.per100.kcal || 0) + 5 * 8.99), 2, " kcal");
    }

    /* 4. 日汇总 */
    var a = E.compute(carrot, 100, "raw");
    var b = E.compute(carrot, 200, "raw");
    var sum = E.sumItems([a, b]);
    near("日汇总热量相加", sum.kcal, a.kcal + b.kcal, 1, " kcal");
    ok("未收录营养素保持 null", (function () {
      var f = Nutri.foods.filter(function (x) { return x.per100.b12 === undefined; })[0];
      if (!f) return true;
      return E.compute(f, 100, "raw").n.b12 === null;
    })(), "缺失项不应当成 0");

    /* 5. 达标判断 */
    ok("null 值不判达标", E.statusOf(null, 100) === "unknown", E.statusOf(null, 100));
    ok("90% 判达标", E.statusOf(90, 100) === "ok", E.statusOf(90, 100));
    ok("80% 判略缺", E.statusOf(80, 100) === "near", E.statusOf(80, 100));
    ok("钠超标判 high", E.statusOf(2500, 2000, true) === "high", E.statusOf(2500, 2000, true));

    /* 6. 搜索 */
    var hits = E.search("胡萝卜", null, 10);
    ok("搜索胡萝卜有结果", hits.length > 0, hits.length + " 条");
    ok("搜索结果首条含关键词", hits.length > 0 && hits[0].name.indexOf("胡萝卜") >= 0, hits[0] && hits[0].name);
    ok("搜索不存在的词返回空", E.search("zzzz不存在", null, 10).length === 0);

    /* 7. 食材库校验 */
    var bad = Nutri.library.validate({ not: "array" });
    ok("非数组被拒绝", bad.ok === false, bad.errors[0]);
    var bad2 = Nutri.library.validate([{ name: "", per100: { kcal: "abc" } }]);
    ok("缺字段被拒绝", bad2.ok === false && bad2.errors.length >= 2, bad2.errors.length + " 条错误");
    var good = Nutri.library.validate([{ name: "测试食材", per100: { kcal: 100, protein: 5 } }]);
    ok("合法数据通过校验", good.ok === true, JSON.stringify(good.errors));

    var before = Nutri.library.foods().length;
    var app = Nutri.library.append([
      { name: "测试食材A", cat: "grain", per100: { kcal: 120, protein: 4 } },
      { name: "胡萝卜（红）", cat: "rootVeg", per100: { kcal: 39 } }
    ]);
    ok("追加模式可用", app.ok === true, JSON.stringify(app));
    ok("同名被跳过", app.skipped >= 1, "跳过 " + app.skipped);
    ok("自定义食材进入检索", Nutri.library.foods().length > before, Nutri.library.foods().length);
    ok("自定义食材可被搜到", E.search("测试食材A", null, 5).length > 0);
    var exp = JSON.parse(Nutri.library.exportJson());
    ok("导出结构可被再次校验", Nutri.library.validate(exp).ok === true, exp.length + " 条");
    Nutri.library.reset();
    ok("恢复内置库", Nutri.library.foods().length === Nutri.foods.length, Nutri.library.foods().length);

    /* 8. 推荐 */
    var stats = { kcal: 800, protein: 40, fiber: 10, calcium: 300, iron: 6, vc: 30, va: 200,
      potassium: 900, sodium: 1200, vegFruitGrams: 200, itemCount: 3, b12: 0 };
    var tens = R.dailyTen(stats, t, "2026-11-20", []);
    ok("每日推荐恒为 10 条", tens.length === 10, tens.length);
    var layers = {};
    tens.forEach(function (x) { layers[x.layer] = 1; });
    ok("覆盖至少 4 个宝塔层", Object.keys(layers).length >= 4, Object.keys(layers).join("/"));
    ok("每条都有克数与理由", tens.every(function (x) { return x.grams > 0 && !!x.reason; }));

    var adv = R.advice(stats, t, { sex: "f" });
    ok("缺口分析给出建议", adv.length >= 3, adv.length + " 条");
    ok("蛋白质不足被点名", adv.some(function (x) { return x.key === "protein"; }),
      adv.map(function (x) { return x.key; }).join(","));

    var pyr = R.pyramidProgress(stats, [
      { cat: "leafy", grams: 200 }, { cat: "grain", grams: 150 }, { cat: "fruit", grams: 100 }
    ]);
    ok("宝塔层统计正确", pyr.filter(function (x) { return x.key === "蔬菜"; })[0].grams === 200,
      JSON.stringify(pyr.map(function (x) { return [x.key, x.grams]; })));

    /* 9. 打卡与连续天数（空记录不可打卡） */
    if (S.day().items.length === 0) {
      ok("空记录不能打卡", S.checkIn().ok === false, "应拒绝");
    } else {
      ok("今日已有记录，跳过打卡用例", true, "保护真实数据");
    }
    ok("连续天数有最佳纪录字段", typeof S.streakLive().best === "number", S.streakLive().best);

    /* 10. 格式化 */
    ok("fmt 处理 null", E.fmt(null) === "—", E.fmt(null));
    ok("fmt 保留小数", E.fmt(1.2345, 1) === "1.2", E.fmt(1.2345, 1));

    /* 11. 食物库搜索框：输入时不能被重建（中文输入法依赖同一个节点） */
    try {
      Nutri.ui.switchTab("library");
      var probe = document.getElementById("lib-search");
      if (!probe || typeof probe.dispatchEvent !== "function") {
        ok("食物库搜索框输入不被重建（环境不支持，跳过）", true, "skip");
      } else {
        probe.dispatchEvent(new Event("compositionstart"));
        probe.value = "zhugan";
        probe.dispatchEvent(new Event("input", { bubbles: true }));
        var same = document.getElementById("lib-search") === probe;
        ok("输入时搜索框节点不被重建", same, same ? "同一节点" : "节点被销毁重建，中文输入法会失效");
        probe.value = "猪肝";
        probe.dispatchEvent(new CompositionEvent("compositionend", { data: "猪肝" }));
        ok("组字结束后仍在同一个输入框", document.getElementById("lib-search") === probe, "ok");
      }
      Nutri.ui.switchTab("home");
    } catch (e) {
      ok("食物库搜索框回归测试", false, e && e.message ? e.message : e);
    }

    /* 12. 性别 / 年龄 / 目标 */
    var male = { sex: "m", age: 25, height: 178, weight: 75, activity: 1.375, goal: "fatloss", deficit: 400 };
    var tm = Nutri.computeTargets(male);
    near("男性 BMR", tm.bmr, 1743, 2, " kcal");
    near("男性 TDEE", tm.tdee, 2396, 3, " kcal");
    near("男性减脂目标热量", tm.kcal, 1996, 2, " kcal");
    near("男性蛋白 1.25 g/kg", tm.protein, 94, 1, " g");
    near("男性铁 12 mg", tm.iron, 12, 0.01, " mg");
    near("男性锌 12.5 mg", tm.zinc, 12.5, 0.01, " mg");
    ok("男性 B1 1.4 mg", tm.b1 === 1.4, tm.b1);

    var female = Nutri.computeTargets({ sex: "f", age: 30, height: 160, weight: 55, activity: 1.375, goal: "fatloss", deficit: 400 });
    near("女性铁 18 mg", female.iron, 18, 0.01, " mg");
    var senior = Nutri.computeTargets({ sex: "f", age: 55, height: 160, weight: 58, activity: 1.375, goal: "maintain" });
    near("50+ 女性铁 12 mg", senior.iron, 12, 0.01, " mg");
    near("50+ 钙 1000 mg", senior.calcium, 1000, 0.01, " mg");

    var gain = Nutri.computeTargets({ sex: "m", age: 25, height: 178, weight: 75, activity: 1.375, goal: "gain", surplus: 300 });
    near("增肌 = TDEE + 300", gain.kcal, tm.tdee + 300, 2, " kcal");
    near("增肌蛋白 1.6 g/kg", gain.protein, 120, 1, " g");
    var maint = Nutri.computeTargets({ sex: "f", age: 19, height: 156.5, weight: 64, activity: 1.375, goal: "maintain" });
    near("保持体重 = TDEE", maint.kcal, maint.tdee, 1, " kcal");
    var low = Nutri.computeTargets({ sex: "m", age: 25, height: 160, weight: 45, activity: 1.2, goal: "fatloss", deficit: 500 });
    ok("男性热量下限 1500", low.kcal >= 1500, low.kcal);

    near("BMI 计算", Nutri.bmi({ height: 156.5, weight: 64 }), 26.1, 0.15, "");
    ok("BMI 分级正确", Nutri.bmiLabel(22).label === "正常" && Nutri.bmiLabel(26).label === "超重"
      && Nutri.bmiLabel(17).label === "偏瘦" && Nutri.bmiLabel(30).label === "肥胖",
      Nutri.bmiLabel(26).label);

    /* 13. 破壁打汁：口径与生食一致 */
    var blend = Nutri.METHOD_MAP.blend;
    ok("新增烹饪方式 破壁打汁", !!blend && blend.name === "破壁打汁", blend && blend.name);
    ok("破壁打汁带升糖提示", !!(blend && blend.warn && blend.warn.indexOf("升糖") >= 0), "warn");
    ok("烹饪方式总数 16 种", Nutri.METHODS.length === 16, Nutri.METHODS.length);
    if (carrot) {
      var rawR = E.compute(carrot, 150, "raw");
      var blendR = E.compute(carrot, 150, "blend");
      near("破壁打汁重量不变", blendR.cookedGrams, 150, 0.01, " g");
      ok("破壁打汁用油 0", blendR.oil === 0, blendR.oil);
      near("破壁打汁热量与生食一致", blendR.kcal, rawR.kcal, 0.01, " kcal");
      near("破壁打汁膳食纤维与生食一致", blendR.n.fiber, rawR.n.fiber, 0.001, " g");
      near("破壁打汁碳水与生食一致", blendR.n.carb, rawR.n.carb, 0.001, " g");
    }

    render();
  }

  function render() {
    var pass = results.filter(function (r) { return r.pass; }).length;
    var fail = results.length - pass;
    var body = results.map(function (r, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + (r.pass ? "✅" : "❌") + "</td><td>" +
        r.name + "</td><td class=\"tiny muted\">" + r.detail + "</td></tr>";
    }).join("");
    document.body.innerHTML =
      '<div class="app" style="padding-top:20px"><div class="card">' +
      "<h1>自测结果</h1>" +
      '<div class="row" style="gap:8px;margin:10px 0">' +
      '<span class="chip ' + (fail ? "chip--red" : "chip--green") + '">通过 ' + pass + " / " + results.length + "</span>" +
      (fail ? '<span class="chip chip--red">失败 ' + fail + "</span>" : "") +
      "</div>" +
      '<table class="table"><thead><tr><th>#</th><th></th><th>用例</th><th>详情</th></tr></thead><tbody>' +
      body + "</tbody></table></div>" +
      '<div class="center" style="margin:20px 0"><a class="btn" href="./index.html">回到应用</a></div></div>';
    if (window.console) {
      console.log("[selftest] " + pass + "/" + results.length + " passed");
      results.filter(function (r) { return !r.pass; }).forEach(function (r) {
        console.log("[FAIL] " + r.name + " :: " + r.detail);
      });
    }
  }

  return { run: run };
})();
