/* ===== 胡萝卜吉祥物「卜卜」 ===== */
window.Nutri = window.Nutri || {};

Nutri.mascot = (function () {
  var defsId = 0;

  function svg(mood, cls) {
    var gid = "carrot-grad-" + (++defsId);
    return '' +
      '<svg class="mascot ' + (cls || "") + (mood ? " is-" + mood : "") + '" viewBox="0 0 160 180" role="img" aria-label="胡萝卜吉祥物卜卜">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#ffa733"/><stop offset="100%" stop-color="#f47c1d"/>' +
      '</linearGradient></defs>' +
      '<ellipse class="mascot__shadow" cx="80" cy="170" rx="34" ry="7"/>' +
      /* 叶子 */
      '<g class="mascot__leaf mascot__leaf--l">' +
      '<path d="M78 60 C70 42 56 34 46 36 C49 50 60 60 78 60 Z" fill="#58cc02" stroke="#3f9a00" stroke-width="2.5" stroke-linejoin="round"/>' +
      '</g>' +
      '<g class="mascot__leaf mascot__leaf--r">' +
      '<path d="M82 60 C90 40 104 30 116 32 C113 48 100 60 82 60 Z" fill="#58cc02" stroke="#3f9a00" stroke-width="2.5" stroke-linejoin="round"/>' +
      '</g>' +
      '<path d="M80 62 C76 44 78 32 80 24 C86 36 88 50 84 62 Z" fill="#7ee02f" stroke="#3f9a00" stroke-width="2.5" stroke-linejoin="round"/>' +
      /* 身体 */
      '<g class="mascot__body">' +
      '<path d="M51 64 C51 46 109 46 109 64 L98 134 C95 154 86 162 80 162 C74 162 65 154 62 134 Z" ' +
      'fill="url(#' + gid + ')" stroke="#e06c12" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M64 78 C66 96 68 112 71 126" stroke="#ffffff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round" fill="none"/>' +
      '<path d="M70 96 L90 94 M72 112 L88 110 M74 126 L85 125" stroke="#d9630e" stroke-opacity=".35" stroke-width="3.5" stroke-linecap="round"/>' +
      /* 手臂 */
      '<path class="mascot__arm mascot__arm--l" d="M52 92 C44 96 40 102 39 108" stroke="#e06c12" stroke-width="6" stroke-linecap="round" fill="none"/>' +
      '<path class="mascot__arm mascot__arm--r" d="M108 92 C116 96 120 102 121 108" stroke="#e06c12" stroke-width="6" stroke-linecap="round" fill="none"/>' +
      /* 眼睛 */
      '<circle cx="62" cy="84" r="9" fill="#fff" stroke="#e06c12" stroke-width="2"/>' +
      '<circle cx="98" cy="84" r="9" fill="#fff" stroke="#e06c12" stroke-width="2"/>' +
      '<circle cx="64" cy="85" r="4.2" fill="#3c3c3c"/>' +
      '<circle cx="100" cy="85" r="4.2" fill="#3c3c3c"/>' +
      '<circle cx="65.6" cy="83" r="1.5" fill="#fff"/>' +
      '<circle cx="101.6" cy="83" r="1.5" fill="#fff"/>' +
      '<ellipse class="mascot__lid mascot__lid--l" cx="62" cy="84" rx="9.5" ry="9.5" fill="#f99033"/>' +
      '<ellipse class="mascot__lid mascot__lid--r" cx="98" cy="84" rx="9.5" ry="9.5" fill="#f99033"/>' +
      /* 腮红 */
      '<ellipse cx="48" cy="99" rx="7" ry="4.5" fill="#ff6b6b" opacity=".38"/>' +
      '<ellipse cx="112" cy="99" rx="7" ry="4.5" fill="#ff6b6b" opacity=".38"/>' +
      /* 嘴 */
      '<path class="mascot__mouth" d="M72 101 Q80 110 88 101" stroke="#8a3f00" stroke-width="3" stroke-linecap="round" fill="none"/>' +
      '</g>' +
      '</svg>';
  }

  function moodFor(stats, targets, checkedIn) {
    if (checkedIn) return "celebrate";
    if (!stats || !stats.itemCount) return "sleepy";
    var p = Nutri.engine.pctOf(stats.protein, targets.protein) || 0;
    var v = stats.vegFruitGrams || 0;
    if (p >= 90 && v >= 400) return "happy";
    if (p < 40 && v < 150) return "sad";
    return "idle";
  }

  function bubbleText(stats, targets, checkedIn) {
    if (checkedIn) return "今天打卡完成啦！";
    if (!stats || !stats.itemCount) return "记下第一口食物，我就在这儿等你～";
    var p = Nutri.engine.pctOf(stats.protein, targets.protein) || 0;
    var v = stats.vegFruitGrams || 0;
    if (p < 60) return "蛋白质还差一点，来个鸡蛋或一杯奶？";
    if (v < 300) return "蔬菜还差 " + Math.round(Math.max(0, 500 - v)) + " g，加个胡萝卜吧！";
    if (p >= 90 && v >= 400) return "今天很棒，离打卡只差一步！";
    return "继续加油，今天的目标快到了～";
  }

  function confetti() {
    var box = document.createElement("div");
    box.className = "confetti";
    var colors = ["#58cc02", "#1cb0f6", "#ff9600", "#ff4b4b", "#ce82ff", "#ffc800"];
    for (var i = 0; i < 70; i++) {
      var p = document.createElement("i");
      p.style.left = (Math.random() * 100) + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (1.6 + Math.random() * 1.4) + "s";
      p.style.animationDelay = (Math.random() * 0.5) + "s";
      p.style.width = (5 + Math.random() * 5) + "px";
      p.style.height = (8 + Math.random() * 8) + "px";
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 3600);
  }

  return { svg: svg, moodFor: moodFor, bubbleText: bubbleText, confetti: confetti };
})();
