Starship 任务控制  v2.0  (2026-11-16)
====================================

怎么玩
------
双击 index.html，用 Chrome / Edge / Safari 打开即可。
index.html 和 three.min.js 必须放在同一个文件夹里。

手机上玩：把整个文件夹放到任意网页服务器（见下），用手机浏览器访问，横屏。

放到 Synology NAS
-----------------
1. 在 DSM 里启用 Web Station（或直接用 web 共享文件夹）。
2. 把本文件夹整个拷到 web 共享文件夹下，例如 /web/starship/。
3. 浏览器访问  http://<NAS 地址>/starship/

也可以在电脑上临时起一个服务器（在本文件夹里运行）：
    python3 -m http.server 8080
然后访问 http://localhost:8080/

联网说明
--------
游戏本身不需要联网：三维引擎 three.js (r128, MIT 许可) 已经放在本文件夹里。
唯一会联网的是两种字体（Google Fonts 的 Saira Condensed 和 Noto Sans SC）；
断网时自动改用系统字体，功能不受影响，只是字形略有不同。

存档
----
最高分和检查点保存在浏览器本地（localStorage），换浏览器或清除数据后会消失。

文件
----
index.html      游戏本体（界面、物理、渲染全部在这一个文件里）
three.min.js    三维引擎
source/         源码，改完后运行  node build.js  重新生成 dist/index.html
    src/sim.js          飞行物理、制导、自动驾驶、姿态力矩动力学
    src/gfx.js          三维渲染
    src/tex.js          程序化贴图
    src/mask.js         陆地掩膜
    src/ui.js           任务流程、HUD、输入、音效
    src/index.tpl.html  页面与样式
    test/               无界面飞行测试（node test/simtest.js 等）
  注意：source 生成的 dist/index.html 从 cdnjs 加载 three.js；
  要离线使用，把其中的 three.js 地址改成 three.min.js。
