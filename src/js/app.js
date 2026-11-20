/* ===== 启动 ===== */
(function () {
  function boot() {
    if (location.hash === "#selftest") {
      /* 自测里有几条用例会操作真实界面，所以先初始化一次，初始化失败也不影响其余断言 */
      try { Nutri.ui.init(); } catch (e) { if (window.console) console.warn(e); }
      Nutri.selftest.run();
      return;
    }
    try {
      Nutri.ui.init();
    } catch (e) {
      var box = document.getElementById("view");
      if (box) {
        box.innerHTML = '<div class="card" style="margin-top:20px"><h2>页面加载出错</h2>' +
          '<p class="small muted" style="margin-top:8px">' + (e && e.message ? e.message : e) + "</p>" +
          '<p class="small muted" style="margin-top:8px">可以打开 <a href="./index.html#selftest">自测页</a> 看看是哪一步出错。</p></div>';
      }
      if (window.console) console.error(e);
      return;
    }
    /* 第一次打开（或引导没做完）先让用户填档案；老用户 migrate 时已标记完成，不会弹 */
    try {
      if (!Nutri.store.load().onboarded) Nutri.ui.showOnboarding();
    } catch (e) {
      if (window.console) console.error(e);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
