// dsh-agent-mobile-adapt · 浏览器半
//
// ★ 目的：手机竖屏（触摸设备）访问同一个 GUI 时，把它收成「手机 App 形态」。
//   PC 端布局**一律不动** —— 全靠 body.<ACTIVE> 前缀 + 激活条件双重隔离。
//
// ★ 激活条件（与官方 remote-web-ui 的适配层同一判据，但互不依赖）：
//     portrait  ×  (pointer: coarse)  ×  innerWidth < 1100  ×  没设强制桌面
//   任一不满足 → 移除 body class、撤掉标记 → 回到官方 PC 布局。
//   另有 URL 开关 `?dsh-mobile=1|0` 用于桌面验收（见 forcedMode）。
//
// ★ 为什么每条规则都带 !important：官方 remote-web-ui 的适配层也在改同一批
//   元素（它会往 head 里追加自己的 <style>）。谁后注入谁赢，我们不赌顺序。
//
// ★ 为什么用「后缀类名」选择器（[class$="_header"]）：
//   官方用 CSS Modules，真实类名是 `pI_x6G_header` 这种「哈希前缀 + 语义后缀」。
//   哈希每次构建都会变，语义后缀才是稳定的。
//
// ★ exports.inject 必须写，否则整个包静默失效（Host 报 running，浏览器里一行不跑）。

window.__ModuleLoader__.load({
  id: "dsh-agent-mobile-adapt",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    /** 手机形态生效时挂在 body 上的类。 */
    var ACTIVE = "dsh-mobile-app";
    /** JS 给「桌面浮层」打的标记类（余额气泡等），CSS 负责折叠它。 */
    var FOLD = "dsh-mobile-fold";
    /** sessionStorage 逃生开关：置 1 = 手机上也要桌面布局。 */
    var FORCE_DESKTOP = "dsh-mobile-force-desktop";
    /** 注入的样式表身份。 */
    var STYLE_ID = "dsh-agent-mobile-adapt/style";
    /** 自己造的侧栏入口按钮 id。 */
    var BTN_ID = "dsh-mobile-sidebar-btn";
    /** 官方适配层自带入口按钮（#dshRemoteWhale）存在时我们让位 —— 两者位置重合。 */
    var WHALE_CLS = "dsh-mobile-has-whale";
    /** 超过这个宽度就不算手机（平板横屏、PC 窄窗都不该被改）。 */
    var MAX_W = 1100;

    /** 汉堡图标：手机上比鲸鱼更像"打开侧栏"。 */
    var BARS_ICON =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>';

    // ------------------------------------------------------------------
    // 样式
    // ------------------------------------------------------------------
    var CSS = [
      // ============ 1. 应用框架：铺满动态视口，三段栅格塌成单列 ============
      // 官方 frame 是 grid: [rail|sidebar] [center] [details]，由 inline style
      // 给列宽；手机上把两翼钉成 0，只留中列。显式写 grid-column 是因为
      // 官方折叠态侧栏会变成 absolute 浮层、脱离栅格流，此时 auto-place
      // 会把中列塞进第一轨（0px）导致会话塌成一条线。
      'body.' + ACTIVE + ' [class*="_frame"]:has([class*="_centerCol"]){width:100%!important;height:100vh!important;height:100dvh!important;grid-template-columns:0 minmax(0,1fr) 0!important}',
      'body.' + ACTIVE + ' [class*="_centerCol"]{grid-column:2/3!important;min-width:0!important}',
      'body.' + ACTIVE + ' [class$="_detailsCol"]{display:none!important}',
      'body.' + ACTIVE + ' [class*="_overlayLayer"] [class$="_workbench"]{display:none!important}',

      // ============ 2. 侧栏：折叠时让位，展开时全屏抽屉 ============
      'body.' + ACTIVE + ' [class*="_sidebarCol"]{grid-column:1/2!important;min-width:0!important}',
      'body.' + ACTIVE + ' [class*="_frame"][data-sidebar-collapsed] [class*="_sidebarCol"]{display:none!important}',
      'body.' + ACTIVE + ' [class*="_frame"]:not([data-sidebar-collapsed]) [class*="_sidebarCol"]{position:fixed!important;left:0!important;top:0!important;right:0!important;bottom:auto!important;width:100%!important;max-width:100%!important;height:100vh!important;height:100dvh!important;z-index:2147483300!important}',
      'body.' + ACTIVE + ' [class*="_sidebarCol"] [class$="_newSession"],body.' + ACTIVE + ' [class*="_sidebarCol"] [class*="_sessionRow"],body.' + ACTIVE + ' [class*="_sidebarCol"] [class*="_projectRow"]{min-height:44px}',

      // ============ 3. 手机上看不到的桌面装饰 ============
      // 宠物插件：手机上整块撤掉（拍板）。
      'body.' + ACTIVE + ' .yq-pet,body.' + ACTIVE + ' .yq-pet-loading{display:none!important}',
      'body.' + ACTIVE + ' [data-dsh-plugin="pet"]{display:none!important}',
      // JS 打标的桌面浮层（余额气泡等）。
      'body.' + ACTIVE + ' .' + FOLD + '{display:none!important}',
      // 会话日志下载按钮：手机上没地方放。
      'body.' + ACTIVE + ' [class$="_headerUtilities"]{display:none!important}',

      // ============ 4. 头部：压成紧凑两行，tabs 可横滑 ============
      'body.' + ACTIVE + ' [class$="_header"]{padding-top:calc(4px + env(safe-area-inset-top))!important;padding-bottom:4px!important;padding-left:6px!important;padding-right:6px!important;gap:2px!important}',
      'body.' + ACTIVE + ' [class$="_header"] [class$="_tabs"]{overflow-x:auto!important;overflow-y:hidden!important;flex-wrap:nowrap!important;scrollbar-width:none;-webkit-overflow-scrolling:touch}',
      'body.' + ACTIVE + ' [class$="_header"] [class$="_tabs"]::-webkit-scrollbar{display:none}',
      // 给左上角的侧栏按钮让位（只推标题簇，不推 tabs 行）。
      'body.' + ACTIVE + ' [class$="_header"] [class$="_titleCluster"]{padding-left:46px!important}',
      // 顶部 tabs 触摸目标太小（实测只有 25px 高），手指容易点偏。
      // 用伪元素把可点区域扩到 ~43px 高，不改变视觉布局。
      'body.' + ACTIVE + ' [class$="_header"] [class$="_tab"]{position:relative!important}',
      'body.' + ACTIVE + ' [class$="_header"] [class$="_tab"]::after{content:"";position:absolute;left:-6px;right:-6px;top:-9px;bottom:-9px}',

      // ============ 5. 消息区：贴边 ============
      'body.' + ACTIVE + ' [class$="_scroll"]{padding:6px 10px!important}',

      // ============ 6. 输入区：安全区 + 16px 防 iOS 聚焦缩放 ============
      'body.' + ACTIVE + ' [class$="_composer"]{padding-bottom:calc(6px + env(safe-area-inset-bottom))!important}',
      'body.' + ACTIVE + ' [class*="_composerSeat"] [class$="_input"],body.' + ACTIVE + ' textarea{font-size:16px!important}',
      // ============ 6.5 输入区底部工具条：一行放下，不撑厚 ============
      // 实测（360px 宽）：五个按钮本身都是 28px 高，但"个性化"胶囊宽 155px、
      // 模型按钮也会撑宽，一行放不下，导致换行、整行从 42px 变成 82px。
      // 这里用媒体查询（不依赖 body 类）：胶囊只留短文字、模型只留图标。
      '@media (max-width:480px){' +
        '[class$="_composerSeat"] [class$="_row"]{flex-wrap:nowrap!important;gap:3px!important;padding-left:4px!important;padding-right:4px!important}' +
        '[class$="_composerSeat"] [class$="_tools"]{gap:4px!important;min-width:0!important}' +
        // 个性化：保留文字（隐藏 "· 自定义"），限宽防撑爆一行
        '.soul-quick-toggle{max-width:96px!important;min-width:0!important;padding:0 8px!important;gap:4px!important;overflow:hidden!important;white-space:nowrap!important;font-size:11px!important}' +
        '.soul-quick-toggle-name{display:none!important}' +
        // 模型：只留图标 + 下拉箭头（隐藏模型名文字）。图标在窄屏会被官方
        // 样式 display:none 掉，这里强制显示；按钮 40px 才放得下图标和箭头。
        '[class$="_composerSeat"] button[aria-label^="选择模型"]{font-size:0!important;width:40px!important;min-width:40px!important;max-width:40px!important;padding:0 2px!important;justify-content:center!important;gap:2px!important}' +
        '[class$="_composerSeat"] button[aria-label^="选择模型"] svg[class*="triggerIcon"]{display:block!important;width:16px!important;height:16px!important;flex:none!important}' +
      '}',

      // ============ 7. 自造的侧栏入口按钮 ============
      // 官方那个 toggle 在折叠态是 0×0，手机上没有可用入口；这里补一个。
      // 侧栏展开（抽屉）时它自己让位。
      '#' + BTN_ID + '{display:none}',
      // 官方适配层的鲸鱼入口与本按钮位置重合 —— 它出现时我们让位。
      'body.' + ACTIVE + '.' + WHALE_CLS + ' #' + BTN_ID + '{display:none!important}',
      'body.' + ACTIVE + ' #' + BTN_ID + '{position:fixed;top:calc(6px + env(safe-area-inset-top));left:8px;width:38px;height:38px;min-width:38px;padding:0;border-radius:11px;background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2147483400;box-shadow:0 1px 6px rgba(0,0,0,.25);touch-action:manipulation}',
      'body.' + ACTIVE + ' #' + BTN_ID + ' svg{width:20px;height:20px;display:block}',
      'body.' + ACTIVE + ' #' + BTN_ID + ':active{opacity:.7}',
      // 抽屉展开时按钮**继续留着** —— 它是用户最确定的出口，
      // 藏掉它就可能把人困在抽屉里。代价是它会压住抽屉的 logo 行，
      // 所以把那行右移让位。
      'body.' + ACTIVE + ' [class*="_sidebarCol"] [class$="_logoRow"]{padding-left:46px!important}',

      // ============ 8. 手机上不显示滚动条 ============
      'body.' + ACTIVE + ' *::-webkit-scrollbar{width:0;height:0}',

      // ============ 9. 浮层菜单：必须压在抽屉之上 ============
      // 抽屉 z-index 是 2147483300，而官方 portal 菜单只有 1100，
      // 结果底部的"更多（账号菜单）"被抽屉整个盖住，看起来点了没反应。
      'body.' + ACTIVE + ' [class*="_portal_"]{z-index:2147483500!important}',
      // 菜单项本来只有文字那么高点，手指容易点偏；放大成 44px 触摸目标。
      'body.' + ACTIVE + ' [class*="_portal_"] button,body.' + ACTIVE + ' [class*="_portal_"] [role="menuitem"]{min-height:44px!important}',

      // ============ 10. 设置页：压过抽屉 + 手机横向标签 ============
      // 设置浮层 z-index 只有 1000，打开后仍被抽屉盖着，要退出侧栏才看得见。
      // 手机上左栏 188px 固定宽，把右侧内容挤到 ~120px；改成顶部横向标签。
      'body.' + ACTIVE + ' [class$="_overlay"]{z-index:2147483500!important}',
      '@media (max-width:480px){' +
        '[class$="_overlay"]>[class$="_panel"]{flex-direction:column!important;width:calc(100vw - 48px)!important;max-width:calc(100vw - 48px)!important;height:calc(100dvh - 48px)!important;max-height:calc(100dvh - 48px)!important}' +
        '[class$="_overlay"]>[class$="_panel"]>[class$="_nav"]{width:100%!important;height:auto!important;flex:none!important;flex-direction:row!important;align-items:center!important;gap:8px!important;overflow-x:auto!important;padding-bottom:6px!important}' +
        '[class$="_overlay"]>[class$="_panel"]>[class$="_nav"] [class$="_navTitle"]{display:none!important}' +
        '[class$="_overlay"]>[class$="_panel"]>[class$="_nav"] [class$="_navList"]{flex-direction:row!important;overflow-x:auto!important;gap:4px!important;width:100%!important;height:auto!important}' +
        '[class$="_overlay"]>[class$="_panel"]>[class$="_nav"] [class$="_navCell"]{width:auto!important;flex:none!important;white-space:nowrap!important;min-height:40px!important}' +
        '[class$="_overlay"]>[class$="_panel"]>[class$="_content"]{width:100%!important;max-width:100%!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important}' +
      '}',
      // ============ 11. 侧栏长按：禁掉浏览器长按菜单/选中，行内按钮不撑布局 ============
      // 长按会话行时安卓会弹“标记为广告”之类的系统菜单，同时行内操作按钮
      // 会因 hover 被挤出来把整行撑歪。这里：侧栏禁选+禁系统菜单；
      // 操作按钮改为绝对定位且不可见（程序化 click 仍可触发）。
      'body.' + ACTIVE + ' [class*="_sidebarCol"]{-webkit-touch-callout:none!important;user-select:none!important;-webkit-user-select:none!important}',
      // 会话行自带 draggable="true"（桌面拖拽排序）；安卓长按会进入拖拽导致行浮起错位，
      // 这里在手机端关掉原生拖拽，长按事件才能稳定落到我们自己的计时器上。
      'body.' + ACTIVE + ' [class*="_sidebarCol"] [class*="_sessionRow"]{position:relative!important;-webkit-user-drag:none!important;user-drag:none!important;-webkit-touch-callout:none!important}',
      'body.' + ACTIVE + ' [class*="_sidebarCol"] [class*="_sessionRow"] button[aria-label*="的操作"],' +
        'body.' + ACTIVE + ' [class*="_sidebarCol"] [class*="_sessionRow"] button[aria-label*="归档会话"],' +
        'body.' + ACTIVE + ' [class*="_sidebarCol"] [class*="_sessionRow"] button[aria-label*="置顶会话"]{position:absolute!important;right:2px!important;top:50%!important;transform:translateY(-50%)!important;opacity:0!important;pointer-events:none!important;width:24px!important;height:24px!important;min-width:24px!important;margin:0!important;padding:0!important}',
      // ============ 12. toast 与对话框：同样要压在抽屉之上 ============
      // 复制提示 toast 是 z-index 1100，重命名对话框是 1000，都被抽屉盖住。
      'body.' + ACTIVE + ' [class*="_toast_"]{z-index:2147483500!important}',
      'body.' + ACTIVE + ' [class*="_root"]:has([class*="_dialog_"]){z-index:2147483500!important}',
    ].join("");

    // ------------------------------------------------------------------
    // 判定与注入
    // ------------------------------------------------------------------

    /**
     * URL 上的强制开关：`?dsh-mobile=1` 无论设备都按手机形态渲染，
     * `?dsh-mobile=0` 无论设备都按桌面布局渲染。没有该参数时返回 null。
     * 用途：桌面浏览器里验收手机布局（Chromium 的设备模拟不一定让
     * `(pointer: coarse)` 成立，光靠媒体查询验不了手机形态）。
     */
    function forcedMode() {
      try {
        var m = /[?&]dsh-mobile=([01])/.exec(window.location.search || "");
        if (!m) return null;
        return m[1] === "1";
      } catch (e) {
        return null;
      }
    }

    /** 当前视口是不是"该用手机形态"的设备。任何一步抛错都判否。 */
    function isPhone() {
      try {
        if (typeof window === "undefined" || typeof document === "undefined") return false;
        var forced = forcedMode();
        if (forced !== null) return forced;
        if (typeof window.matchMedia !== "function") return false;
        if (!window.matchMedia("(orientation: portrait)").matches) return false;
        if (!window.matchMedia("(pointer: coarse)").matches) return false;
        if (window.innerWidth >= MAX_W) return false;
        if (window.sessionStorage && window.sessionStorage.getItem(FORCE_DESKTOP) === "1") return false;
        return true;
      } catch (e) {
        return false;
      }
    }

    /** 幂等地把样式表放进 head，并保证它排在最后（赢过官方适配层）。 */
    function ensureStyle() {
      try {
        var old = document.getElementById(STYLE_ID);
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var tag = document.createElement("style");
        tag.id = STYLE_ID;
        tag.setAttribute("data-plugin", "mobile-adapt");
        tag.textContent = CSS;
        (document.head || document.documentElement).appendChild(tag);
      } catch (e) {
        /* 注入失败也不能影响页面 */
      }
    }

    /**
     * 给 body 下的「桌面浮层」打标记：无类名的、脱离文档流的、可见文本像余额的。
     * 只碰 body 的直接子元素，且只加一个自己的类 —— 不改结构、不改内联样式。
     * ★ 用 innerText（可见文本），因为那个容器里塞着内联 <style>，
     *   textContent 会把 @keyframes 也算进去。
     */
    function tagDesktopOverlays(on) {
      try {
        if (!document.body) return;
        var kids = document.body.children;
        for (var i = 0; i < kids.length; i++) {
          var el = kids[i];
          if (!el || el.nodeType !== 1 || el.tagName !== "DIV") continue;
          if (el.id === "root") continue;
          if (el.hasAttribute("data-dsh-plugin")) continue;
          if (el.hasAttribute("data-dsh-pet-root")) continue;
          if (!on) {
            if (el.classList && el.classList.contains(FOLD)) el.classList.remove(FOLD);
            continue;
          }
          if (el.classList && el.classList.contains(FOLD)) continue;
          var pos = "";
          try { pos = window.getComputedStyle(el).position; } catch (e2) { continue; }
          if (pos !== "fixed" && pos !== "absolute") continue;
          var txt = "";
          try { txt = (el.innerText || "").replace(/\s+/g, " ").trim(); } catch (e3) { continue; }
          if (txt.length === 0 || txt.length > 200) continue;
          if (/余额|Balance/i.test(txt)) el.classList.add(FOLD);
        }
      } catch (e) {
        /* 打标失败只是不折叠，不影响可用性 */
      }
    }

    /**
     * 造一个自己的侧栏入口按钮。
     * 官方的 toggle（button[aria-label="打开侧边栏"]）在折叠态是 0×0，
     * 手机上没有可见入口；我们只是替用户去点它（React 事件照常冒泡）。
     */
    function ensureSidebarButton() {
      try {
        if (document.getElementById(BTN_ID)) return;
        var btn = document.createElement("button");
        btn.id = BTN_ID;
        btn.type = "button";
        btn.setAttribute("aria-label", "打开侧栏");
        btn.innerHTML = BARS_ICON;
        btn.addEventListener("click", function () {
          try {
            var t =
              document.querySelector('button[aria-label*="边栏"]') ||
              document.querySelector('button[aria-label*="idebar"]') ||
              document.querySelector('[class*="_toggle"]');
            if (t && typeof t.click === "function") t.click();
          } catch (e) { /* 点不到就算了，不要抛 */ }
        });
        (document.body || document.documentElement).appendChild(btn);
      } catch (e) {
        /* 造不出来也不影响别的 */
      }
    }

    /**
     * 手机抽屉里点会话/新会话后，自动把抽屉收起来。
     * 为什么：DSH 选中会话后不会关抽屉，用户得手动退。
     * 这里替用户收起来，同时保留"选中后自动弹键盘"的行为。
     */
    function ensureAutoCloseOnSessionPick() {
      if (window.__dshMobileAutoClose) return;
      window.__dshMobileAutoClose = true;
      document.addEventListener("click", function (e) {
        try {
          if (!document.body || !document.body.classList.contains(ACTIVE)) return;
          var t = e.target;
          if (!t || !t.closest) return;
          if (!t.closest('[class*="_sidebarCol"]')) return;
          // 侧栏开关自己就负责开合，别再重复点一次（否则会关掉又打开）。
          if (t.closest('[class*="_toggle"]')) return;
          // 会话行内的“操作/归档/置顶”按钮：点它们是要弹菜单，不是选会话。
          var inner = t.closest("button");
          var innerLabel = inner ? (inner.getAttribute("aria-label") || "") : "";
          if (/的操作|归档会话|置顶会话/.test(innerLabel)) return;
          // 需要自动收起的入口：会话行、新会话、面板项（插件/自动化/上下文洞察），
          // 以及工作区行右侧的“在 xxx 中新建会话”按钮。
          var hit = t.closest('[class*="_sessionRow"], [class*="_newSession"], [class*="_panelRow"]');
          if (!hit) {
            var btn = t.closest("button");
            var label = btn ? (btn.getAttribute("aria-label") || "") : "";
            if (!/新建会话/.test(label)) return;
          }
          window.setTimeout(function () {
            try {
              var frame = document.querySelector('[class*="_frame"]');
              if (!frame || frame.hasAttribute("data-sidebar-collapsed")) return;
              var toggle =
                document.querySelector('button[aria-label*="边栏"]') ||
                document.querySelector('[class*="_toggle"]');
              if (toggle && typeof toggle.click === "function") toggle.click();
            } catch (e2) { /* 收不起来也不致命 */ }
          }, 160);
        } catch (err) { /* 不影响点击本身 */ }
      }, true);
    }

    /**
     * 手机上没法悬停，长按会话行弹出该会话的“…”菜单（归档/置顶等都在里面）。
     * 触发方式：按住 520ms 且手指基本不动；从长按位置向上找恰好包住一个
     * “会话‘xxx’的操作”按钮的容器，程序化点它（不依赖会话行类名）。
     */
    function ensureLongPressSessionMenu() {
      if (window.__dshMobileLongPress) return;
      window.__dshMobileLongPress = true;
      var timer = null;
      var startX = 0;
      var startY = 0;
      var target = null;
      var suppressUntil = 0;
      function clear() {
        if (timer) { clearTimeout(timer); timer = null; }
      }
      document.addEventListener("touchstart", function (e) {
        try {
          if (!document.body.classList.contains(ACTIVE)) return;
          var t = e.target;
          if (!t || !t.closest || !t.closest('[class*="_sidebarCol"]')) return;
          var p = e.touches && e.touches[0];
          if (!p) return;
          target = t; startX = p.clientX; startY = p.clientY;
          clear();
          timer = setTimeout(function () {
            timer = null;
            var node = target;
            for (var i = 0; i < 8 && node && node !== document.body; i++) {
              var btns = node.querySelectorAll('button[aria-label^="会话"]');
              if (btns.length === 1) {
                try { btns[0].click(); } catch (e2) { /* 打不开就算了 */ }
                // 长按松手后浏览器可能补一个 click（导致误开该会话），
                // 这里在之后 500ms 内把这种 click 吞掉。
                suppressUntil = Date.now() + 500;
                return;
              }
              if (btns.length > 1) return;
              node = node.parentElement;
            }
          }, 520);
        } catch (err) { /* 不影响正常点击 */ }
      }, { passive: true });
      document.addEventListener("touchmove", function (e) {
        try {
          var p = e.touches && e.touches[0];
          if (!p || !timer) return;
          if (Math.abs(p.clientX - startX) > 10 || Math.abs(p.clientY - startY) > 10) clear();
        } catch (err) { /* 忽略 */ }
      }, { passive: true });
      document.addEventListener("touchend", clear, { passive: true });
      document.addEventListener("touchcancel", clear, { passive: true });
      // 安卓长按会弹系统菜单（“标记为广告”等），侧栏里直接禁掉。
      document.addEventListener("contextmenu", function (e) {
        try {
          if (!document.body.classList.contains(ACTIVE)) return;
          if (e.target && e.target.closest && e.target.closest('[class*="_sidebarCol"]')) e.preventDefault();
        } catch (err) { /* 忽略 */ }
      }, false);
      // 会话行是 draggable="true" 的，长按会启动原生拖拽（行浮起/错位）。
      // 除了 CSS 的 -webkit-user-drag:none，再兜一层 dragstart 阻止。
      document.addEventListener("dragstart", function (e) {
        try {
          if (!document.body.classList.contains(ACTIVE)) return;
          if (e.target && e.target.closest && e.target.closest('[class*="_sidebarCol"]')) e.preventDefault();
        } catch (err) { /* 忽略 */ }
      }, false);
      document.addEventListener("click", function (e) {
        if (Date.now() < suppressUntil) {
          e.stopPropagation();
          e.preventDefault();
        }
      }, true);
    }

    /**
     * 复制 Session ID：安卓上 DSH 的剪贴板写入会失败（连同步 execCommand 也会
     * 假成功）。改成弹出一个小浮层直接展示 id，让用户长按选中手动复制。
     */
    function ensureClipboardFallback() {
      if (window.__dshClipboardHooked) return;
      window.__dshClipboardHooked = true;

      function showSessionId(id) {
        try {
          var old = document.getElementById("dsh-session-id-layer");
          if (old) old.remove();
          var mask = document.createElement("div");
          mask.id = "dsh-session-id-layer";
          mask.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box";
          var box = document.createElement("div");
          box.style.cssText = "background:#1f1f1f;color:#fff;border-radius:12px;padding:16px;width:100%;max-width:340px;box-sizing:border-box;box-shadow:0 8px 30px rgba(0,0,0,.5)";
          var title = document.createElement("div");
          title.textContent = "Session ID（长按选中复制）";
          title.style.cssText = "font-size:13px;opacity:.7;margin-bottom:10px";
          var idBox = document.createElement("div");
          idBox.textContent = id;
          idBox.style.cssText = "background:#2a2a2a;border:1px solid #444;border-radius:8px;padding:10px;font-size:13px;word-break:break-all;line-height:1.5;user-select:text;-webkit-user-select:text";
          var close = document.createElement("button");
          close.textContent = "关闭";
          close.style.cssText = "margin-top:12px;width:100%;padding:10px;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-size:14px";
          close.addEventListener("click", function () { mask.remove(); });
          mask.addEventListener("click", function (e) { if (e.target === mask) mask.remove(); });
          box.appendChild(title);
          box.appendChild(idBox);
          box.appendChild(close);
          mask.appendChild(box);
          document.body.appendChild(mask);
        } catch (e) { /* 忽略 */ }
      }

      // 记住最近点开菜单的那个会话行（菜单项点击时用它取 session id）。
      document.addEventListener("click", function (e) {
        try {
          var t = e.target;
          if (!t || !t.closest) return;
          var btn = t.closest('button[aria-label^="会话"]');
          if (btn) window.__dshMenuRow = btn.closest('[class*="_sessionRow"]') || null;
        } catch (err) { /* 忽略 */ }
      }, true);

      // 拦截“复制 Session ID”菜单项：不再尝试写剪贴板，直接展示 id。
      document.addEventListener("click", function (e) {
        try {
          if (!document.body || !document.body.classList.contains(ACTIVE)) return;
          var t = e.target;
          if (!t || !t.closest) return;
          // 菜单项按钮本身或它内部任意元素被点中都算；文字在 button 内部。
          var btn = t.closest('button, [role="menuitem"]');
          if (!btn || !/复制\s*Session\s*ID/i.test(btn.textContent || "")) return;
          var row = window.__dshMenuRow || document.querySelector('[class*="_sessionRow"][aria-selected="true"]');
          var key = row ? (row.getAttribute("data-row-key") || "") : "";
          var id = key.replace(/^session:/, "");
          if (!id) return;
          e.preventDefault();
          e.stopPropagation();
          showSessionId(id);
          setTimeout(function () { try { document.body.click(); } catch (e2) {} }, 60);
        } catch (err) { /* 忽略 */ }
      }, true);
    }

    function apply(ctx) {
      ensureStyle();
      ensureAutoCloseOnSessionPick();
      ensureLongPressSessionMenu();
      ensureClipboardFallback();

      var active = false;
      var observer = null;
      var pending = null;

      /** 把三类变化收敛成一次重排：加/撤 body class、打标、清标。 */
      function sync() {
        var want = isPhone();
        if (want !== active) {
          active = want;
          try {
            if (active) document.body.classList.add(ACTIVE);
            else document.body.classList.remove(ACTIVE);
          } catch (e) { /* body 还没挂上也就算了 */ }
        }
        if (active) {
          ensureSidebarButton();
          // 官方适配层（remote-web-ui）激活时会在同一角落放一个鲸鱼入口，
          // 两个按钮会叠在一起 —— 让位给它，别让用户看到两个汉堡。
          try {
            if (document.getElementById("dshRemoteWhale")) document.body.classList.add(WHALE_CLS);
            else document.body.classList.remove(WHALE_CLS);
          } catch (e) { /* 无所谓 */ }
        }
        tagDesktopOverlays(active);
        ensureStyle();
      }

      function schedule() {
        if (pending !== null) return;
        try {
          pending = window.requestAnimationFrame(function () {
            pending = null;
            sync();
          });
        } catch (e) {
          pending = window.setTimeout(function () { pending = null; sync(); }, 120);
        }
      }

      // 首帧可能还没有 body：等 DOM 就绪再同步一次。
      sync();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", sync, { once: true });
      }

      try {
        window.addEventListener("resize", schedule, { passive: true });
        window.addEventListener("orientationchange", schedule, { passive: true });
      } catch (e) { /* 监听不上也不致命 */ }

      // 浮层/侧栏都是 React 后挂载的 —— 用 MutationObserver 兜住它们。
      try {
        if (typeof MutationObserver !== "undefined" && document.body) {
          observer = new MutationObserver(schedule);
          observer.observe(document.body, { childList: true, subtree: false });
        }
      } catch (e) { /* 没有 observer 就只在 resize 时同步 */ }

      // 插件被禁用时把痕迹收干净。
      var teardown = function () {
        try {
          if (observer) { observer.disconnect(); observer = null; }
          window.removeEventListener("resize", schedule);
          window.removeEventListener("orientationchange", schedule);
          if (document.body) document.body.classList.remove(ACTIVE);
          tagDesktopOverlays(false);
          var btn = document.getElementById(BTN_ID);
          if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
          var tag = document.getElementById(STYLE_ID);
          if (tag && tag.parentNode) tag.parentNode.removeChild(tag);
        } catch (e) { /* 清理失败无所谓 */ }
      };

      try {
        if (ctx && typeof ctx.effect === "function") ctx.effect(function () { return teardown; }, "mobile-adapt");
      } catch (e) { /* 没有 effect 服务就一直挂着，页面重载自然复位 */ }

      // 调试口子：手机上想看真实布局时，控制台跑
      //   __dshMobileAdapt.sync()  → 立刻重算
      //   __dshMobileAdapt.off()   → 本次会话强制桌面布局
      try {
        window.__dshMobileAdapt = {
          sync: sync,
          isActive: function () { return active; },
          off: function () {
            try { window.sessionStorage.setItem(FORCE_DESKTOP, "1"); } catch (e) {}
            sync();
          },
          on: function () {
            try { window.sessionStorage.removeItem(FORCE_DESKTOP); } catch (e) {}
            sync();
          },
        };
      } catch (e) { /* 无所谓 */ }
    }

    exports.apply = apply;
    exports.inject = ["slots"]; // ★★★ 少写这行整包静默失效
    return module.exports;
  },
});
