// UI localization layer: intentionally separate from physics, missions and renderer.
(function(){
'use strict';
const messages = {"任务控制": ["MISSION CONTROL", "ミッション管制"], "地面飞行控制": ["Ground Flight Control", "地上飛行管制"], "你坐在地面控制台。把飞船送入 200 km 轨道，完成在轨任务，再让它穿过大气层回到发射塔的机械臂之间。": ["From ground control, guide Starship into a 200 km orbit, complete its missions, then bring it through reentry to the launch tower's catch arms.", "地上の管制室から宇宙船を高度200 kmの軌道に送り、軌道上の任務を遂行した後、大気圏に再突入させ、発射塔のキャッチアームへ帰還させます。"], "一颗卫星，一个部署窗口。适合第一次飞。": ["One satellite and one deployment window. Ideal for a first flight.", "衛星1基、展開ウィンドウ1回。初めての飛行に最適です。"], "三个窗口，途中躲开一片太空垃圾和一股碎石流，再回到正轨。": ["Three windows. Avoid space debris and a meteoroid stream, then return to the target orbit.", "展開ウィンドウ3回。途中で宇宙デブリと流星体群を回避し、目標軌道へ復帰します。"], "再加一段虚构的近距防御战。": ["Adds a fictional close-range defense encounter.", "架空の近距離防衛戦が追加されます。"], "非官方的爱好者模拟，与 SpaceX 无关。轨道、推力、气动、再入加热和姿态力矩按真实量级简化计算；地球自转只做了画面表现，没有计入它带来的横向漂移；UFO 防御纯属虚构。": ["Unofficial fan-made simulation, not affiliated with SpaceX. Orbital motion, thrust, aerodynamics, reentry heating and attitude torque are simplified using realistic scales. Earth's rotation is visual only, with no lateral drift modeled. UFO defense is fictional.", "SpaceXとは無関係の非公式ファン制作シミュレーターです。軌道・推力・空力・再突入加熱・姿勢トルクは実際の規模を参考に簡略化しています。地球の自転は映像表現のみで、横方向のずれは計算していません。UFO防衛はフィクションです。"], "自动驾驶飞完全程，你下达关键指令：发射、部署、规避、离轨。得分 ×0.6。": ["Autopilot flies the mission; you issue key commands: launch, deploy, evade and deorbit. Score ×0.6.", "自動操縦が全行程を担当。発射・展開・回避・離軌道などの重要指令はプレイヤーが出します。得点×0.6。"], "你来飞。飞控计算机替你稳住姿态，你给目标：指引、攻角、落点。着陆时有自动油门。得分 ×1.0。": ["You fly. The flight computer stabilizes attitude while you select guidance, angle of attack and landing target. Automatic landing throttle. Score ×1.0.", "操縦はプレイヤーが担当。飛行コンピューターが姿勢を安定させ、誘導・迎角・着地点を指定します。着陸時は自動スロットル。得点×1.0。"], "纯手动：摇杆直接驱动喷气、襟翼配平和发动机摆角，没有姿态保持。得分 ×1.4。": ["Full manual: the stick directly commands thrusters, flap trim and engine gimbal. No attitude hold. Score ×1.4.", "完全手動：スティックでスラスター、フラップのトリム、エンジンのジンバル角を直接制御します。姿勢保持なし。得点×1.4。"], "单星部署": ["One-Satellite Deployment", "衛星1基の展開"], "三星部署 + 两次规避": ["Three Satellites + Two Avoidance Maneuvers", "衛星3基＋回避機動2回"], "三星 + 两次规避 + UFO 防御": ["Three Satellites + Two Avoidances + UFO Defense", "衛星3基＋回避2回＋UFO防衛"], "操控辅助（飞行中可随时切换）": ["CONTROL ASSIST (change during flight)", "操縦アシスト（飛行中に切替可能）"], "开始任务": ["START MISSION", "ミッション開始"], "从检查点继续": ["RESUME CHECKPOINT", "チェックポイントから再開"], "操作说明": ["CONTROLS / HELP", "操作説明"], "自动": ["AUTO", "自動"], "辅助": ["ASSIST", "アシスト"], "手动": ["MANUAL", "手動"], "发射入轨": ["LAUNCH & ORBIT", "打上げ・軌道投入"], "轨道任务": ["ORBITAL MISSION", "軌道上ミッション"], "再入回收": ["REENTRY & RECOVERY", "再突入・回収"], "发射": ["Launch", "発射"], "起飞": ["Liftoff", "離昇"], "分离": ["Separation", "分離"], "入轨": ["Orbit Insertion", "軌道投入"], "部署": ["Deploy", "展開"], "离轨": ["Deorbit", "離軌道"], "再入": ["Reentry", "再突入"], "翻转": ["Flip", "反転"], "捕获": ["Catch", "キャッチ"], "外部": ["External", "外部"], "襟翼": ["Flaps", "フラップ"], "引擎": ["Engine", "エンジン"], "机头": ["Nose", "機首"], "地面": ["Ground", "地上"], "轨道图": ["Orbit Map", "軌道図"], "跟随指引": ["Follow Guidance", "誘導に追従"], "顺向": ["Prograde", "順行"], "逆向": ["Retrograde", "逆行"], "精调": ["Precision", "微調整"], "平移推进器": ["Translation Thrusters", "並進スラスター"], "平移": ["Translate", "並進"], "推进": ["Thrust", "推進"], "减速": ["Decelerate", "減速"], "加速": ["Accelerate", "加速"], "速度 km/h": ["Speed km/h", "速度 km/h"], "高度 km": ["Altitude km", "高度 km"], "激光能量 · 点击 UFO 开火": ["LASER ENERGY · TAP UFO TO FIRE", "レーザーエネルギー・UFOをタップして発射"], "横屏体验更好": ["Landscape mode recommended", "横画面でのプレイを推奨"], "继续竖屏": ["Continue Portrait", "縦画面で続ける"], "正在生成地球与飞船": ["Generating Earth and spacecraft", "地球と宇宙船を生成中"], "启动发射": ["INITIATE LAUNCH", "発射開始"], "级间分离": ["STAGE SEPARATION", "段間分離"], "发动机关机": ["ENGINE SHUTDOWN", "エンジン停止"], "重新点火": ["ENGINE RELIGHT", "エンジン再点火"], "部署卫星": ["DEPLOY SATELLITE", "衛星を展開"], "展开太阳翼": ["DEPLOY SOLAR ARRAYS", "太陽電池パネル展開"], "规避机动": ["AVOIDANCE MANEUVER", "回避機動"], "取消离轨": ["CANCEL DEORBIT", "離軌道を取消"], "自动离轨": ["AUTO DEORBIT", "自動離軌道"], "翻转点火": ["FLIP & IGNITION", "反転・点火"], "自动油门：开": ["AUTO THROTTLE: ON", "自動スロットル：オン"], "自动油门：关": ["AUTO THROTTLE: OFF", "自動スロットル：オフ"], "卫星离舰中": ["Satellite Deploying", "衛星を分離中"], "入轨成功": ["Orbit Achieved", "軌道投入成功"], "太阳翼展开": ["Solar Arrays Deployed", "太陽電池パネル展開"], "不在部署窗口内": ["Outside deployment window", "展開可能な時間帯ではありません"], "机头需对准顺向（绿圈）": ["Align nose with prograde (green circle)", "機首を順行方向（緑の円）に合わせてください"], "姿态还在转动": ["Attitude still rotating", "姿勢が回転中です"], "高度超出 160–320 km": ["Altitude outside 160–320 km", "高度が160～320 kmの範囲外です"], "先回到正轨：远、近地点都要在 200 km 附近": ["Return to target orbit: apogee and perigee must be near 200 km", "目標軌道へ戻ってください。遠地点・近地点とも約200 kmが必要です"], "点火或喷气中不能部署": ["Cannot deploy while engines or thrusters are firing", "エンジンまたはスラスター噴射中は展開できません"], "碎石流": ["Meteoroid Stream", "流星体群"], "太空垃圾": ["Space Debris", "宇宙デブリ"], "远地点": ["Apogee", "遠地点"], "近地点": ["Perigee", "近地点"], "剩余推进剂": ["Remaining Propellant", "残りの推進剤"], "最大动压": ["Maximum Dynamic Pressure", "最大動圧"], "卫星入轨": ["Satellites in Orbit", "衛星軌道投入"], "机体完好度": ["Hull Integrity", "機体健全度"], "横向误差": ["Lateral Error", "横方向の誤差"], "接触下降率": ["Contact Descent Rate", "接触時の降下速度"], "姿态倾角": ["Attitude Tilt", "姿勢傾斜角"], "隔热瓦 / 机体": ["Heat Shield / Hull", "耐熱タイル／機体"], "操控系数": ["Control Multiplier", "操縦係数"], "总分": ["Total Score", "総合得点"], "入轨确认": ["ORBIT CONFIRMED", "軌道投入確認"], "全部卫星入轨": ["ALL SATELLITES DEPLOYED", "全衛星の軌道投入完了"], "再入界面": ["ENTRY INTERFACE", "再突入開始"], "捕获成功": ["CATCH SUCCESSFUL", "キャッチ成功"], "任务失败": ["MISSION FAILED", "ミッション失敗"], "结构解体": ["STRUCTURAL FAILURE", "機体構造の破損"], "未能入轨": ["ORBIT INSERTION FAILED", "軌道投入失敗"], "再入烧毁": ["BURNED UP ON REENTRY", "再突入時に焼失"], "机体损毁": ["HULL DESTROYED", "機体損壊"], "坠毁": ["CRASHED", "墜落"], "捕获失败": ["CATCH FAILED", "キャッチ失敗"], "撞上发射塔": ["TOWER COLLISION", "発射塔に衝突"], "落在场坪上": ["MISSED THE CATCH TOWER", "キャッチタワーを外れました"], "暂停": ["PAUSED", "一時停止"], "继续飞行": ["RESUME FLIGHT", "飛行を再開"], "重新开始任务": ["RESTART MISSION", "ミッションを最初から"], "返回主菜单": ["BACK TO MAIN MENU", "メインメニューへ戻る"], "重新发射": ["RELAUNCH", "再発射"], "主菜单": ["MAIN MENU", "メインメニュー"], "再飞一次": ["FLY AGAIN", "もう一度飛ぶ"], "声音：": ["SOUND: ", "サウンド："], "从 Stage ": ["From Stage ", "Stage "], "检查点重试": ["checkpoint retry", "のチェックポイントから再試行"], "重试": ["Retry", "再試行"], "明白": ["GOT IT", "了解"], "继续": ["CONTINUE", "続ける"], "开始再入": ["BEGIN REENTRY", "再突入開始"], "进入轨道任务": ["BEGIN ORBITAL MISSION", "軌道上ミッションへ"], "祝贺": ["Congratulations", "おめでとうございます"], "卫星": ["Satellite", "衛星"], "入轨精度": ["Orbit Accuracy", "投入精度"], "精度": ["Accuracy", "精度"], "已展开": ["Deployed", "展開済み"], "展开中": ["Deploying", "展開中"], "温度": ["Temperature", "温度"], "过载": ["G-load", "加速度"], "动压": ["Dynamic Pressure", "動圧"], "高度": ["Altitude", "高度"], "速度": ["Velocity", "速度"], "推进剂": ["Propellant", "推進剤"], "机体": ["Hull", "機体"], "姿态": ["Attitude", "姿勢"], "倾斜": ["Tilt", "傾き"], "角速度": ["Angular Rate", "角速度"], "角加速度": ["Angular Acceleration", "角加速度"], "发动机摆角": ["Engine Gimbal", "エンジンジンバル角"], "前 / 后襟翼": ["Front / Rear Flaps", "前部／後部フラップ"], "前后襟翼": ["Front and rear flaps", "前後のフラップ"], "喷气": ["RCS Thrusters", "スラスター"], "未点火": ["Not ignited", "未点火"], "无气流": ["No airflow", "気流なし"], "关": ["Off", "オフ"], "开": ["On", "オン"], "飞控": ["Flight Control", "飛行制御"], "直控": ["Direct Control", "直接制御"], "上": ["Up", "上"], "下": ["Down", "下"], "左": ["Left", "左"], "右": ["Right", "右"], "远": ["Far", "遠"], "近": ["Near", "近"], "入轨点": ["Orbit insertion point", "軌道投入地点"], "离轨点火点": ["Deorbit burn point", "離軌道噴射点"], "发射塔": ["Launch Tower", "発射塔"], "预计落点": ["Predicted Landing Point", "予測着地点"], "落点误差": ["Landing Error", "着地点誤差"], "偏离": ["Deviation", "偏差"], "正轨": ["Target Orbit", "目標軌道"], "前方半圈": ["Next Half Orbit", "前方半周"], "红点线 = 辅助线": ["Red dotted line = guidance", "赤点線＝誘導線"], "黄 = 预测": ["Yellow = prediction", "黄＝予測"], "地球自转": ["Earth rotation", "地球の自転"], "已转过": ["Rotated", "回転角"], "发射塔、部署窗口、离轨点火点随地面东移": ["Tower, deployment windows and deorbit point shift eastward with Earth", "発射塔・展開ウィンドウ・離軌道点は地球とともに東へ移動"], "还有": ["Remaining", "残り"], "通过高度": ["Passing Altitude", "通過高度"], "在窗口内。机头保持顺向，点击【部署卫星】。": ["Inside deployment window. Hold prograde and select DEPLOY SATELLITE.", "展開ウィンドウ内です。順行方向を維持し、「衛星を展開」を押してください。"], "进入大气层": ["Entering atmosphere", "大気圏に突入"], "亚音速，腹部朝下自由下落": ["Subsonic belly-first descent", "亜音速で腹部を下にして自由降下"], "发动机点火，摆动喷管把飞船甩成竖直": ["Engine ignition; gimbal flips the ship upright", "エンジン点火。ジンバル制御で機体を垂直に反転"], "机械臂已接住飞船": ["Catch arms have secured the ship", "キャッチアームが機体を捕獲"], "热分离，飞船发动机点火": ["Hot staging; ship engines ignite", "ホットステージ分離。宇宙船エンジン点火"], "进入卫星 ": ["Entering satellite ", "衛星 "], " 的部署窗口": [" deployment window", " の展開ウィンドウに進入"], "太阳翼展开中": ["Deploying solar arrays", "太陽電池パネル展開中"], "威胁解除": ["Threat neutralized", "脅威を排除"], "不明飞行物接近。点击目标开火": ["Unidentified craft approaching. Tap targets to fire.", "未確認飛行物体が接近。対象をタップして射撃してください"], "前方发现": ["Detected ahead: ", "前方に検出："], "看底部剖面图": ["Check the bottom trajectory plot", "下部の軌道断面図を確認"], "推进剂耗尽": ["Propellant depleted", "推進剤切れ"], "你已接管油门": ["Manual throttle engaged", "スロットルを手動操作に切替"], "倒计时开始": ["Countdown started", "カウントダウン開始"], "推进剂加注完成": ["Propellant loaded", "推進剤の充填完了"], "33 台发动机预冷完成": ["33 engines chilled", "エンジン33基の予冷完了"], "姿态控制自检通过": ["Attitude control self-test passed", "姿勢制御の自己診断完了"], "点火，塔架脱开": ["Ignition; launch mount releases", "点火、発射台から離脱"], "最大动压 ": ["Maximum Q ", "最大動圧 "], " 已通过": [" passed", " 通過"], "离轨点火完成，滑行至再入": ["Deorbit burn complete. Coast to reentry.", "離軌道噴射完了。再突入まで慣性飛行"], "飞控用喷气把飞船转成腹部朝前": ["Flight control turns ship belly-first using thrusters", "スラスターで機体を腹部前方姿勢へ回転中"], "威胁": ["Threat", "脅威"], "规避": ["Avoidance", "回避"], "次安全通过": [" safe passes", "回安全通過"], "太阳翼": ["Solar arrays", "太陽電池パネル"], "沿线距离": ["Along-track Distance", "進行方向の距離"], "横向速度": ["Lateral Velocity", "横方向速度"], "垂直速度": ["Vertical Velocity", "鉛直速度"], "俯仰": ["Pitch", "ピッチ"], "攻角": ["Angle of Attack", "迎角"], "预定": ["Target", "目標"], "目标": ["Target", "目標"], "下降率": ["Descent Rate", "降下速度"], "落点": ["Landing Point", "着地点"], "距机械臂": ["Distance to Catch Arms", "キャッチアームまでの距離"], "无": ["None", "なし"], "返回": ["Return", "帰還"], "完成": ["Complete", "完了"], "成功": ["Success", "成功"], "已": ["Already", "済み"], "正在": ["Currently", "実行中"], "即将": ["Approaching", "まもなく"], "未": ["Not", "未"], "次": ["times", "回"], "上升与轨道：左右改变俯仰。再入：上下调攻角（上＝飞得更远），左右横移。着陆：推向哪边，飞船就往哪边平移，松手自动刹住。卫星离舰后：摇杆改为控制卫星喷气。": ["Ascent/orbit: left and right change pitch. Reentry: up/down adjust angle of attack (up flies farther); left/right shift laterally. Landing: move the stick in the desired translation direction; releasing it brakes automatically. After satellite release, the stick controls the satellite thrusters.", "上昇・軌道：左右でピッチを調整。再突入：上下で迎角を調整（上＝飛距離が長い）、左右で横移動。着陸：スティックを倒した方向へ機体が移動し、離すと自動制動。衛星分離後は衛星のスラスターを操作します。"], "轨道上的侧向和轴向喷气。机头顺向时，▲▼ 改变垂直速度，◀▶ 改变切向速度。用它躲开危险带，再把三个偏差读数调回 0。": ["Lateral and axial orbital thrusters. With the nose prograde, ▲▼ changes vertical velocity and ◀▶ changes tangential velocity. Avoid danger zones, then bring all three error indicators back to zero.", "軌道上で側方・軸方向に噴射します。機首が順行方向の場合、▲▼で鉛直速度、◀▶で接線速度を調整。危険地帯を回避したら、3つの偏差値を0に戻してください。"], "拖动设定推力。Z 全开，X 关机。辅助模式着陆时油门自动，碰一下油门条就由你接管。": ["Drag to set thrust. Z = full power; X = engine off. Landing throttle is automatic in assist mode; touching the slider takes manual control.", "ドラッグして推力を設定します。Zで全開、Xで停止。アシスト着陸時は自動スロットルですが、スライダーに触れると手動に切り替わります。"], "发射、级间分离、关机、部署卫星、展开太阳翼、翻转点火。": ["Launch, stage separation, engine cutoff, satellite deployment, solar array deployment, flip ignition.", "発射、段間分離、エンジン停止、衛星展開、太陽電池パネル展開、反転点火に使用します。"], "辅助模式的姿态保持：跟随指引、顺速度方向、逆速度方向。": ["Attitude hold in assist mode: follow guidance, prograde, or retrograde.", "アシストモードの姿勢保持：誘導追従、順行方向、逆行方向。"], "时间加速。滑行最高 64×，大气内和点火时自动受限。": ["Time warp up to 64× while coasting; automatically limited in atmosphere or during burns.", "時間加速は慣性飛行中最大64倍。大気圏内や噴射中は自動制限されます。"], "外部、襟翼、引擎、机头、地面跟踪、轨道图。外部和轨道图可拖动旋转、滚轮或双指缩放。": ["External, flaps, engine, nose, ground tracking and orbit map. Drag to rotate external/map views; use a wheel or pinch to zoom.", "外部、フラップ、エンジン、機首、地上追跡、軌道図。外部・軌道図ではドラッグで回転、ホイールやピンチで拡大縮小できます。"], "降低摇杆灵敏度，最后对准塔架时用。": ["Lower stick sensitivity for precise tower alignment.", "スティック感度を下げます。最後に塔へ位置合わせする際に使用します。"], "圆形姿态表：白色指针是机头，绿圈是速度方向，品红三角是预定姿态。把指针压在品红三角上就对了。": ["Attitude dial: the white pointer is the nose, green ring shows velocity, magenta triangle shows target attitude. Align the pointer with the magenta triangle.", "円形姿勢計：白い針は機首、緑の円は速度方向、マゼンタの三角は目標姿勢を示します。針を三角に重ねてください。"], "姿态是真实转动出来的：真空里靠机头机尾的喷气，大气里靠前后襟翼，着陆时靠发动机摆角（力矩 τ = F·L·sinθ），转得多快取决于转动惯量。右侧\"姿态执行机构\"面板显示它们此刻在做什么。": ["Attitude changes through simulated rotation: thrusters in vacuum, fore and aft flaps in atmosphere, and engine gimbal during landing (torque τ = F·L·sinθ). Angular acceleration depends on moment of inertia. The actuator panel shows the current control inputs.", "姿勢は実際の回転運動として計算されます。真空では前後のスラスター、大気圏内では前後フラップ、着陸時はエンジンのジンバル角で制御します（トルク τ = F·L·sinθ）。回転の速さは慣性モーメントに依存します。右側の姿勢アクチュエータ表示に現在の作動状態が表示されます。"], "像跳伞一样，用腹部迎风减速。前襟翼管机头、后襟翼管机尾，四片配合出俯仰和滚转力矩；空气稀薄时由喷气接手。你的任务：让攻角跟住预定值（品红三角），让白色轨迹贴住底部剖面图上的红色辅助线，别让温度越过 1427 °C。": ["Slow down belly-first like a skydiver. Front and rear flaps generate pitch and roll torque; thrusters take over in thin air. Track the target angle of attack (magenta triangle), follow the red guidance line on the trajectory plot, and keep temperature below 1427 °C.", "スカイダイバーのように腹部を風上に向けて減速します。前後4枚のフラップでピッチとロールを制御し、大気が薄いときはスラスターが引き継ぎます。目標迎角（マゼンタの三角）を維持し、下部断面図の赤い誘導線に白い軌跡を沿わせ、温度を1427 °C以下に保ってください。"], "太阳翼全部展开，星座开始工作。接下来回家：等离轨点火点转到前方，逆向点火，把落点拉到发射场。": ["All solar arrays are deployed and the constellation is operational. Time to return: wait for the deorbit point, burn retrograde and bring the predicted landing point to the launch site.", "太陽電池パネルがすべて展開され、衛星コンステレーションが稼働しました。次は帰還です。離軌道噴射点を待ち、逆行方向に噴射して着地点を発射場へ合わせてください。"], "下一步：飞到绿色窗口，机头顺向，释放卫星，再把它沿红色点线送到入轨点。": ["Next: fly to the green window, point prograde, deploy the satellite, and guide it along the red dotted line to its insertion point.", "次は緑のウィンドウまで飛び、機首を順行方向へ向けて衛星を分離し、赤い点線に沿って軌道投入地点へ送ります。"], "下一步：三个部署窗口，途中要先后躲开一片太空垃圾和一股碎石流，每次躲完都要回到 200 km 正轨。底部的轨道剖面图显示前方半圈的情况。": ["Next: three deployment windows. Avoid a debris field and a meteoroid stream, returning to the 200 km target orbit after each. The bottom trajectory plot shows the next half orbit.", "次は展開ウィンドウが3回あります。宇宙デブリと流星体群を順に回避し、その都度200 kmの目標軌道へ復帰します。下部の軌道断面図には前方半周が表示されます。"], "滑行时用右上角的 + 加速时间。": ["Use + at the top right to speed up coasting.", "慣性飛行中は右上の＋で時間を加速できます。"], "动压和攻角载荷超过了箭体极限。穿过 Max-Q 时让机头贴着速度方向（绿圈），动压过 33 kPa 就收一点油门。": ["Dynamic pressure and angle-of-attack loads exceeded structural limits. During Max-Q, align the nose with the green velocity indicator and throttle down above 33 kPa.", "動圧と迎角による荷重が構造限界を超えました。Max-Q通過時は機首を速度方向（緑の円）に合わせ、動圧が33 kPaを超えたらスロットルを絞ってください。"], "水平速度不够，飞船落回了大气层。分离后尽早把机头压向地平线，跟住品红指引。": ["Insufficient horizontal velocity; the ship fell back into the atmosphere. After separation, pitch toward the horizon and follow the magenta guidance marker.", "水平速度が足りず、大気圏に落下しました。分離後は早めに機首を地平線へ倒し、マゼンタの誘導表示に従ってください。"], "隔热瓦失效，或者腹部没有迎向气流。再入时保持攻角在 50°–75°，温度逼近 1427 °C 时把攻角拉高一些。": ["Heat tiles failed or the belly was not windward. Maintain a 50°–75° angle of attack during reentry; increase it if temperature approaches 1427 °C.", "耐熱タイルが損傷したか、腹部が気流を受けていません。再突入時の迎角を50～75°に保ち、温度が1427 °Cに近づいたら迎角を上げてください。"], "机体完好度归零。躲避危险带时，看底部剖面图：白线必须从红色方块的上方或下方绕过去。": ["Hull integrity reached zero. When avoiding hazards, use the trajectory plot: the white line must pass above or below the red hazard box.", "機体健全度がゼロになりました。危険区域の回避では下部の軌道断面図を確認し、白線を赤い危険領域の上下いずれかへ通してください。"], "撞击地面。翻转点火的高度要留够，推荐高度显示在按钮上。": ["Ground impact. Allow sufficient altitude for the flip burn; the suggested altitude is shown on the button.", "地面に衝突しました。反転点火には十分な高度が必要です。推奨高度はボタンに表示されます。"], "到达机械臂高度时超出了容差：位置 8 m、下降 6.5 m/s、水平 3.2 m/s、倾斜 9°。让黄色的预计轨迹贴住红色辅助线再下降。": ["Outside catch tolerances: position 8 m, descent 6.5 m/s, horizontal speed 3.2 m/s, tilt 9°. Align the yellow predicted trajectory with the red guidance line.", "キャッチ高度で許容範囲を超えました。位置8 m、降下速度6.5 m/s、水平速度3.2 m/s、傾斜9°以内が必要です。黄色の予測軌跡を赤い誘導線に合わせて降下してください。"], "塔在捕获点北侧（靶标左方）。靠近时用精调。": ["The tower is north of the catch point (left of the target). Use precision control on approach.", "タワーはキャッチ地点の北側（標的の左）にあります。接近時は微調整を使ってください。"], "飞船没有着陆腿，只能由机械臂接住。它错过了塔架。": ["Starship has no landing legs here; the catch arms must secure it. The tower was missed.", "この機体には着陸脚がなく、アームで捕獲する必要があります。タワーを外れました。"], "摇杆 / 方向键 WASD": ["STICK / ARROW KEYS / WASD", "スティック／矢印キー WASD"], "平移推进 ▲▼◀▶ / I K J L": ["TRANSLATION THRUSTERS ▲▼◀▶ / I K J L", "並進スラスター ▲▼◀▶ / I K J L"], "油门条 / Shift Ctrl": ["THROTTLE / SHIFT CTRL", "スロットル／Shift Ctrl"], "主按钮 / 空格": ["MAIN ACTION / SPACE", "メイン操作／スペース"], "镜头 / 1–6": ["CAMERAS / 1–6", "カメラ／1–6"], "精调 / F": ["PRECISION / F", "微調整／F"]};
// English-only optional voiceover setting. Localize the control, not the spoken lines.
Object.assign(messages, {
  "英语无线电：": ["ENGLISH RADIO: ", "英語無線通信："],
});
// Additional dynamic guidance, event announcements, and HUD strings (v2.2).
Object.assign(messages, {
 "垂直爬升。过了塔顶，把摇杆缓缓推向右。": [
  "Climb vertically. Once clear of the tower, gently move the stick to the right.",
  "垂直に上昇。タワーを越えたら、スティックをゆっくり右へ倒してください。"
 ],
 "飞船已加注完毕。点击【启动发射】。": [
  "Propellant loading complete. Tap INITIATE LAUNCH.",
  "推進剤の充填が完了しました。「発射開始」を押してください。"
 ],
 "倒计时中。T−3 发动机点火。": [
  "Countdown in progress. Engine ignition at T−3.",
  "カウントダウン中。T−3でエンジン点火。"
 ],
 "助推器关机，热分离。": [
  "Booster engines shut down. Execute hot staging.",
  "ブースターエンジン停止。ホットステージ分離へ。"
 ],
 "MECO。点击【级间分离】。": [
  "MECO. Tap STAGE SEPARATION.",
  "MECO。 「段間分離」を押してください。"
 ],
 "自动驾驶正在执行重力转弯。": [
  "Autopilot is executing the gravity turn.",
  "自動操縦で重力ターンを実行中。"
 ],
 "跟住品红指引（或按 FD 让姿态自动跟随）。动压超过 33 kPa 就收油门。": [
  "Follow the magenta guidance marker (or select FD for automatic attitude tracking). Throttle down if dynamic pressure exceeds 33 kPa.",
  "マゼンタの誘導表示に合わせてください（FDで姿勢の自動追従も可能）。動圧が33 kPaを超えたらスロットルを絞ってください。"
 ],
 "把白色指针压在品红指引上。动压超过 33 kPa 就收油门。": [
  "Align the white pointer with the magenta guidance marker. Throttle down above 33 kPa dynamic pressure.",
  "白いポインターをマゼンタの誘導表示に重ねてください。動圧が33 kPaを超えたらスロットルを絞ってください。"
 ],
 "近地点还不到 140 km。重新点火，继续顺向加速。": [
  "Perigee is below 140 km. Relight and continue accelerating prograde.",
  "近地点がまだ140 km未満です。再点火して順行方向へ加速してください。"
 ],
 "入轨。": [
  "Orbit achieved.",
  "軌道投入完了。"
 ],
 "已达轨道速度。现在关机（SECO）。": [
  "Orbital speed reached. Shut down engines now (SECO).",
  "軌道速度に到達。エンジンを停止してください（SECO）。"
 ],
 "飞船正在加速到轨道速度 7.8 km/s。": [
  "Starship is accelerating toward 7.8 km/s orbital speed.",
  "宇宙船は軌道速度7.8 km/sに向けて加速中。"
 ],
 "跟住指引压低机头，把近地点抬到 140 km 以上，目标 200 × 200 km。": [
  "Follow guidance and lower the nose to raise perigee above 140 km. Target: 200 × 200 km.",
  "誘導に従って機首を下げ、近地点を140 km以上へ上げてください。目標は200×200 kmです。"
 ],
 "点击 UFO 开火。红色光环表示它在蓄能，优先打掉。拖动画面环顾四周。": [
  "Tap UFOs to fire. A red halo means they are charging—prioritize those targets. Drag to look around.",
  "UFOをタップして射撃。赤い光輪はエネルギー充填中の印です。優先して撃破してください。ドラッグで周囲を見回せます。"
 ],
 "卫星正沿红色点线离舰。": [
  "Satellite is departing along the red dotted path.",
  "衛星は赤い点線に沿って機体から離脱中です。"
 ],
 "目送卫星离舰。它被排气推偏时，用摇杆点喷气把它推回红色点线。偏差 ": [
  "Monitor the departing satellite. If venting pushes it off course, pulse its thrusters with the stick to return to the red dotted line. Error: ",
  "離脱する衛星を監視してください。排気でずれた場合はスティックでスラスターを短く噴射し、赤い点線に戻します。偏差："
 ],
 "到达入轨点。": [
  "Orbital insertion point reached.",
  "軌道投入地点に到達。"
 ],
 "卫星在入轨点上。点击【展开太阳翼】。": [
  "Satellite is at the insertion point. Tap DEPLOY SOLAR ARRAYS.",
  "衛星が軌道投入地点に到達。「太陽電池パネル展開」を押してください。"
 ],
 "到达入轨点。先把卫星推回红圈里并稳住。": [
  "Insertion point reached. First move the satellite back into the red circle and stabilize it.",
  "軌道投入地点に到達。衛星を赤い円の中に戻して安定させてください。"
 ],
 " 入轨成功。": [
  " successfully inserted into orbit.",
  " 軌道投入成功。"
 ],
 "已离开": [
  "clear of ",
  "離脱しました："
 ],
 "的危险带（": [
  " hazard band (",
  " の危険帯（"
 ],
 "）。保持，": [
  "). Hold course; ",
  "）。このまま維持。"
 ],
 "后通过。": [
  " until passage.",
  "後に通過します。"
 ],
 "前方有": [
  "Ahead: ",
  "前方に"
 ],
 "。点击【规避机动】。": [
  ". Tap AVOIDANCE MANEUVER.",
  "。「回避機動」を押してください。"
 ],
 "碎石流占满 ": [
  "Meteoroids fill ",
  "流星体群が "
 ],
 "，只能从下方钻过去。机头顺向，按住平移 ▼，让通过高度降到 ": [
  ". Pass underneath. Hold prograde and press translation ▼ to lower the crossing altitude below ",
  " を占めています。下側を通過してください。機首を順行方向に向け、並進▼で通過高度を "
 ],
 " km 以下。现在 ": [
  " km. Current: ",
  " km未満へ下げてください。現在 "
 ],
 "太空垃圾在 ": [
  "Space debris at ",
  "宇宙デブリが "
 ],
 "。机头顺向，按住平移 ▲ 或 ▼，让通过高度升到 ": [
  ". Hold prograde and press translation ▲ or ▼ to raise the crossing altitude above ",
  "。順行方向を向き、並進▲または▼で通過高度を "
 ],
 " km 以上或降到 ": [
  " km, or lower it below ",
  " km超、または "
 ],
 "自动驾驶正在用喷气回到 200 km 正轨。": [
  "Autopilot is using thrusters to return to the 200 km target orbit.",
  "自動操縦でスラスターを使い200 kmの目標軌道へ復帰中。"
 ],
 "已在正轨容差内，松开喷气稳住几秒。": [
  "Within target orbit tolerance. Release the thrusters and hold steady for a few seconds.",
  "目標軌道の許容範囲内です。スラスターを離し、数秒間安定させてください。"
 ],
 "回归正轨：机头顺向，用平移 ▲▼ 把高度偏差和垂直速度调回 0，用 ◀▶ 把切向偏差调回 0。三项都变绿就对了。": [
  "Return to target orbit: point prograde; use translation ▲▼ to bring altitude error and vertical speed to zero, then ◀▶ to zero tangential error. All three indicators should turn green.",
  "目標軌道への復帰：機首を順行方向へ向け、並進▲▼で高度偏差と鉛直速度を0に、◀▶で接線方向の偏差を0にしてください。3項目が緑になれば成功です。"
 ],
 " 的窗口在前方 ": [
  " deployment window ahead in ",
  " の展開ウィンドウまであと "
 ],
 "，约 ": [
  ", approximately ",
  "、約 "
 ],
 "。用 + 加速时间。": [
  ". Use + to speed up time.",
  "。＋で時間を加速できます。"
 ],
 "离轨完成。落点误差 ": [
  "Deorbit complete. Landing error: ",
  "離軌道完了。着地点誤差："
 ],
 "进入大气前，用摇杆点喷气把机头抬到攻角 62°，腹部朝前。": [
  "Before atmospheric entry, pulse thrusters with the stick to reach 62° angle of attack, belly forward.",
  "大気圏突入前にスティックでスラスターを短く噴射し、迎角62°で腹部を前方に向けてください。"
 ],
 "飞控正用喷气把飞船转成腹部朝前。": [
  "Flight control is turning the ship belly-first using thrusters.",
  "飛行制御がスラスターで機体を腹部前方姿勢へ回転中。"
 ],
 "可以加速时间。": [
  "You can accelerate time.",
  "時間を加速できます。"
 ],
 "滑行至再入界面。": [
  "Coasting to atmospheric entry.",
  "大気圏突入まで慣性飛行中。"
 ],
 "离轨点火中。": [
  "Deorbit burn in progress.",
  "離軌道噴射中。"
 ],
 "已预约离轨。点火点在前方 ": [
  "Deorbit scheduled. Burn point ahead: ",
  "離軌道予約済み。点火地点まであと "
 ],
 "，可以加速时间。": [
  "; time acceleration available.",
  "。時間を加速できます。"
 ],
 "载荷任务完成。点击【自动离轨】。": [
  "Payload mission complete. Tap AUTO DEORBIT.",
  "ペイロード任務完了。「自動離軌道」を押してください。"
 ],
 "到达点火点。逆向（RETRO）点火，直到落点误差接近 0。": [
  "At burn point. Burn retrograde (RETRO) until landing error approaches zero.",
  "噴射地点に到達。着地点誤差がほぼ0になるまで逆行（RETRO）方向に噴射してください。"
 ],
 "离轨点火点在前方 ": [
  "Deorbit burn point ahead: ",
  "離軌道噴射地点まであと "
 ],
 "（它随地球自转一起东移）。到点后逆向点火，把落点拉到发射场。": [
  "(it shifts east with Earth rotation). Burn retrograde there to bring the landing point toward the launch site.",
  "（地球の自転とともに東へ移動）。到達したら逆行方向に噴射して着地点を発射場へ合わせます。"
 ],
 "规划离轨。": [
  "Plan your deorbit.",
  "離軌道を計画してください。"
 ],
 "腹部没有迎向气流。把攻角调回 50°–75°。": [
  "Belly not facing airflow. Bring angle of attack back to 50°–75°.",
  "腹部が気流を受けていません。迎角を50°～75°へ戻してください。"
 ],
 "温度接近隔热瓦极限。拉高攻角，让飞船在高空多减速。": [
  "Temperature is nearing the heat-tile limit. Increase angle of attack to decelerate more at high altitude.",
  "温度が耐熱タイルの限界に近づいています。迎角を上げ、高高度でさらに減速してください。"
 ],
 "飞控用前后襟翼保持攻角，修正落点。": [
  "Flight control is maintaining angle of attack with front and rear flaps and correcting the landing point.",
  "前後のフラップで迎角を維持し、着地点を修正中。"
 ],
 "空气还太稀，襟翼不起作用。用摇杆上下直接点喷气，把攻角转到预定值并停住。": [
  "Air is too thin for the flaps. Pulse the thrusters using the stick up/down to reach and hold the target angle of attack.",
  "空気が薄すぎてフラップが効きません。スティック上下でスラスターを短く噴射し、迎角を目標値に合わせて静止させてください。"
 ],
 "摇杆上下改变襟翼配平，飞船会晃着靠向新攻角。让攻角贴住预定值，轨迹贴住红色辅助线。": [
  "Stick up/down adjusts flap trim; the ship will oscillate toward the new angle of attack. Hold the target AoA and follow the red trajectory guide.",
  "スティック上下でフラップのトリムを調整します。機体は揺れながら目標迎角へ近づきます。迎角を目標値に合わせ、軌道を赤い誘導線に沿わせてください。"
 ],
 "让攻角跟住预定值（品红三角）：现在偏 ": [
  "Track target angle of attack (magenta triangle). Current error: ",
  "目標迎角（マゼンタの三角）に合わせてください。現在の偏差："
 ],
 "°。摇杆上＝压低攻角飞得远，下＝抬高攻角落得近；左右修正倾斜。白色轨迹要贴住红色辅助线。": [
  "°. Stick up lowers AoA and extends range; down increases AoA and shortens range. Correct tilt left/right. Follow the red guide with the white trajectory.",
  "°。スティック上で迎角を下げて飛距離を伸ばし、下で迎角を上げて飛距離を縮めます。左右で傾斜を調整し、白い軌道を赤い誘導線へ合わせてください。"
 ],
 "腹部朝下自由下落，襟翼控制落点。": [
  "Belly-first free fall. Flaps control the landing point.",
  "腹部を下にした自由落下。フラップで着地点を制御中。"
 ],
 "现在翻转点火。": [
  "Flip and ignite now.",
  "今すぐ反転・点火してください。"
 ],
 "像跳伞一样腹部朝下。用摇杆让黄色预计落点 ✕ 压在红色辅助线的落脚点上，到 ": [
  "Descend belly-first like a skydiver. Use the stick to align the yellow predicted landing marker ✕ with the red guide. At ",
  "スカイダイバーのように腹部を下にして降下します。スティックで黄色の着地点予測✕を赤い誘導線の着地点に合わせ、"
 ],
 " m 时翻转点火。": [
  " m, flip and ignite.",
  " mで反転・点火してください。"
 ],
 "翻转中：发动机摆动喷管产生力矩，前襟翼张开帮忙。": [
  "Flipping: engine gimbals generate torque, assisted by the front flaps.",
  "反転中：エンジンのジンバルでトルクを発生させ、前部フラップが補助します。"
 ],
 "着陆点火，对准机械臂。": [
  "Landing burn: align with the catch arms.",
  "着陸噴射中。キャッチアームに合わせてください。"
 ],
 "摇杆直接摆动发动机喷管：推一下飞船就开始转，要反推才能停住。让倾斜跟住预定值，油门跟住目标下降率。": [
  "The stick directly gimballs the engines: a push starts rotation; counter-steer to stop. Track target tilt and descent rate with throttle.",
  "スティックでエンジンのジンバルを直接操作します。押すと回転が始まり、止めるには逆方向へ操作してください。傾斜を目標値に、スロットルで降下速度を目標値に合わせます。"
 ],
 "自动油门在机械臂上方悬停等你。摇杆推向红色辅助线，松手即刹住；把横向误差压到 3.5 m 内。推进剂有限。": [
  "Auto-throttle is hovering above the catch arms. Move the stick toward the red guide, then release to brake. Get lateral error below 3.5 m; propellant is limited.",
  "自動スロットルでキャッチアーム上にホバリング中。スティックを赤い誘導線へ向け、離すと制動します。横方向の誤差を3.5 m以内にしてください。推進剤には限りがあります。"
 ],
 "已对准，保持住，飞船正在降入机械臂。": [
  "Aligned. Hold steady as Starship descends into the catch arms.",
  "位置合わせ完了。このまま維持してください。機体がキャッチアーム内へ降下中。"
 ],
 "油门控制下降率（跟住目标值），摇杆推向红色辅助线。在机械臂高度做到误差 8 m 内、下降 6.5 m/s 内。": [
  "Use throttle to match target descent rate and steer toward the red guide. At catch height, keep error within 8 m and descent below 6.5 m/s.",
  "スロットルで降下速度を目標値に合わせ、スティックで赤い誘導線へ進めます。キャッチ高度では誤差8 m以内、降下速度6.5 m/s以内にしてください。"
 ],
 "飞船回到了塔上。": [
  "Starship has returned to the tower.",
  "宇宙船が発射塔に帰還しました。"
 ],
 "先把卫星拉回红线并稳住（偏差 ≤ ": [
  "Return the satellite to the red line and stabilize it (error ≤ ",
  "衛星を赤い線に戻して安定させてください（偏差 ≤ "
 ],
 " 起点": [
  " start",
  " 開始地点"
 ],
 "姿态执行机构": [
  "Attitude Actuators",
  "姿勢アクチュエータ"
 ],
 "Stage 3 回收": [
  "Stage 3 Recovery",
  "Stage 3 回収"
 ],
 " · 击落 ": [
  " · Destroyed ",
  "・撃破 "
 ],
 "第 ": [
  "Wave ",
  "第 "
 ],
 " 波 · ": [
  " · ",
  " 波・"
 ],
 " 个目标": [
  " targets",
  " 目標"
 ],
 "通过高度已离开危险带": [
  "Crossing altitude is clear of the hazard band",
  "通過高度は危険帯の外です"
 ],
 "通过高度又回到了危险带里": [
  "Crossing altitude has reentered the hazard band",
  "通過高度が再び危険帯に入りました"
 ],
 "即将穿过": [
  "Approaching ",
  "間もなく通過："
 ],
 "机体受损 −36 %": [
  "Hull damage −36%",
  "機体損傷 −36%"
 ],
 "已安全通过": [
  " passed safely",
  " を安全に通過"
 ],
 "自动回归 200 km 正轨": [
  "Automatic return to 200 km target orbit",
  "200 km目標軌道へ自動復帰"
 ],
 "现在回到 200 km 正轨：把三个偏差调回 0": [
  "Return to the 200 km target orbit: zero all three errors",
  "200 km目標軌道へ復帰：3つの偏差を0にしてください"
 ],
 "已回到正轨 ": [
  "Back on target orbit ",
  "目標軌道へ復帰 "
 ],
 "离轨点火点临近": [
  "Approaching deorbit burn point",
  "離軌道噴射地点に接近"
 ],
 " 离舰，沿红色点线送到入轨点": [
  " leaving the ship; guide it along the red dotted line to the insertion point",
  " が機体から離脱。赤い点線に沿って軌道投入地点へ誘導してください"
 ],
 "到达入轨点。压住红线，展开太阳翼": [
  "At insertion point. Align with the red line and deploy solar arrays",
  "軌道投入地点に到達。赤い線に合わせて太陽電池パネルを展開"
 ],
 "卫星偏离过大，改由星上电脑自主入轨": [
  "Satellite deviation too large; onboard computer will complete insertion",
  "衛星の偏差が大きいため、搭載コンピューターが自律的に軌道投入"
 ],
 "辅助系统接管翻转": [
  "Assist system taking over flip",
  "アシストシステムが反転を引き継ぎます"
 ],
 "俯仰·指引": [
  "Pitch · Guidance",
  "ピッチ・誘導"
 ],
 "高度偏差": [
  "Altitude Error",
  "高度偏差"
 ],
 "切向偏差": [
  "Tangential Error",
  "接線方向偏差"
 ],
 "远/近地点": [
  "Apogee / Perigee",
  "遠地点／近地点"
 ],
 "姿态偏差": [
  "Attitude Error",
  "姿勢偏差"
 ],
 "隔热瓦": [
  "Heat Shield Tiles",
  "耐熱タイル"
 ],
 "偏离红线": [
  "Off Red Guide",
  "赤い誘導線から逸脱"
 ],
 "收拢": [
  "Retracted",
  "収納"
 ],
 "下降·目标": [
  "Descent · Target",
  "降下・目標"
 ],
 "水平速度": [
  "Horizontal Speed",
  "水平速度"
 ],
 " · 预测落点": [
  " · Predicted Landing Point",
  "・予測着地点"
 ],
 "窗口 ": [
  "Window ",
  "ウィンドウ "
 ],
 "力矩 τ": [
  "Torque τ",
  "トルク τ"
 ],
 "压低机头": [
  "Lower Nose",
  "機首を下げる"
 ],
 "抬起机头": [
  "Raise Nose",
  "機首を上げる"
 ],
 "转动：角加速度 = τ / I": [
  "Rotation: Angular Acceleration = τ / I",
  "回転：角加速度 = τ / I"
 ],
 "τ = q·Cn·K·(后襟翼 − 前襟翼)": [
  "τ = q·Cn·K·(rear flap − front flap)",
  "τ = q·Cn·K·(後部フラップ − 前部フラップ)"
 ],
 " · 已避开": [
  " · Avoided",
  "・回避済み"
 ],
 "地球自转 15°/小时 · 已转过 ": [
  "Earth rotates 15°/hour · Rotated ",
  "地球の自転 15°/時・回転済み "
 ],
 "辅助等级": [
  "Assist Level",
  "アシストレベル"
 ],
 "减慢时间": [
  "Slow Time",
  "時間を遅くする"
 ],
 "加快时间": [
  "Speed Up Time",
  "時間を速くする"
 ],
 "任务": [
  "Mission",
  "ミッション"
 ],
 " · ": [
  " · ",
  "・"
 ],
 "前": [
  "Forward",
  "前"
 ],
 "后": [
  "Back",
  "後"
 ],
 "已避开": [
  "Avoided",
  "回避済み"
 ],
 "卫星偏离": [
  "Satellite Deviation",
  "衛星の偏差"
 ],
 "受损": [
  "Damaged",
  "損傷"
 ],
 "窗口": [
  "Window",
  "ウィンドウ"
 ],
 "回归": [
  "Return",
  "復帰"
 ],
 "指引": [
  "Guidance",
  "誘導"
 ],
 "已经": [
  "Already",
  "すでに"
 ],
 "误差": [
  "Error",
  "誤差"
 ],
 "偏差": [
  "Error",
  "偏差"
 ],
 "红线": [
  "Red Guide",
  "赤い誘導線"
 ],
 "点火": [
  "Ignition",
  "点火"
 ],
 "轨道": [
  "Orbit",
  "軌道"
 ],
 "通过": [
  "Passed",
  "通過"
 ],
 "危险带": [
  "Hazard Band",
  "危険帯"
 ],
 "现在": [
  "Now",
  "現在"
 ],
 "以下": [
  "below",
  "以下"
 ],
 "以上": [
  "above",
  "以上"
 ],
 "里": [
  "within",
  "内"
 ],
 "大气": [
  "Atmosphere",
  "大気"
 ]
});
// Final pass: remaining gameplay strings.
Object.assign(messages, {"倾角": ["Tilt", "傾斜角"], "喷气向下，从碎石流下方钻过去": ["Thrust downward to pass below the meteoroid stream", "下方向へスラスターを噴射し、流星体群の下側を通過"], "喷气向上，从垃圾带上方越过去": ["Thrust upward to pass above the debris field", "上方向へスラスターを噴射し、デブリ帯の上側を通過"], "自动驾驶将在点火点执行离轨": ["Autopilot will execute deorbit at the burn point", "自動操縦が噴射地点で離軌道を実行します"], "预计落点 偏 ": ["Predicted Landing Point · Offset ", "予測着地点・偏差 "], "塔架 ": ["Tower ", "タワー "], "无法启动 3D 渲染：这个浏览器不支持 WebGL。": ["3D rendering could not start: this browser does not support WebGL.", "3D描画を開始できません。このブラウザーはWebGLに対応していません。"]});
const keys = Object.keys(messages).sort((a,b)=>b.length-a.length);
const langCodes = {CN:'zh-CN',EN:'en',JP:'ja'};
let lang = 'CN';
const remembered = new WeakMap(), last = new WeakMap();
const cache = new Map();
function tr(source){
 if(lang==='CN' || typeof source!=='string' || !/[\u3400-\u9fff]/.test(source))return source;
 const code=lang==='EN'?0:1, id=lang+'\x00'+source;
 if(cache.has(id))return cache.get(id);
 let result=source;
 for(const key of keys){ if(key.length===1 && source.trim()!==key)continue; if(result.includes(key))result=result.split(key).join(messages[key][code]); }
 cache.set(id,result);if(cache.size>3000)cache.clear();return result;
}
function textNode(node,force){
 const parent=node.parentElement;
 if(!parent||/^(SCRIPT|STYLE|TEXTAREA)$/.test(parent.tagName)||parent.closest('.lang-picker'))return;
 const current=node.nodeValue;
 if(!force && current===last.get(node))return;
 let original=remembered.get(node);
 if(force){ if(original===undefined){original=current;remembered.set(node,original);} }
 else {original=current;remembered.set(node,original);}
 const next=tr(original); last.set(node,next);
 if(next!==current)node.nodeValue=next;
}
function walk(root,force){
 if(root.nodeType===3){textNode(root,force);return;}
 if(root.nodeType!==1)return;
 if(root.matches('script,style,textarea,.lang-picker'))return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const batch=[];while(walker.nextNode())batch.push(walker.currentNode);
 batch.forEach(n=>textNode(n,force));
 if(root.nodeType===1){const attrs=[root,...root.querySelectorAll('[aria-label],[title]')];
 for(const el of attrs){for(const a of ['aria-label','title']){if(!el.hasAttribute(a))continue;const k='data-i18n-original-'+a;
 if(!el.hasAttribute(k))el.setAttribute(k,el.getAttribute(a));el.setAttribute(a,tr(el.getAttribute(k)));}}}
}
function setLang(next){
 if(!langCodes[next])return;
 lang=next;document.documentElement.lang=langCodes[next];
 document.querySelectorAll('.lang-picker [data-lang]').forEach(b=>{const is=b.dataset.lang===next;b.classList.toggle('selected',is);b.setAttribute('aria-pressed',is?'true':'false');});
 cache.clear();walk(document.body,true);
 try{localStorage.setItem('mc.language',next);}catch(e){}
}
const watch = new MutationObserver(changes=>{for(const m of changes){
 if(m.type==='characterData')textNode(m.target,false);
 else if(m.type==='childList')for(const n of m.addedNodes)walk(n,false);
}});
const browserLang=(navigator.language||'').toLowerCase();
let initial='CN';try{initial=localStorage.getItem('mc.language')||'CN';}catch(e){}
if(!langCodes[initial])initial=browserLang.startsWith('ja')?'JP':browserLang.startsWith('en')?'EN':'CN';
document.querySelector('.lang-picker').addEventListener('click',e=>{const b=e.target.closest('[data-lang]');if(b)setLang(b.dataset.lang);});
setLang(initial);watch.observe(document.body,{subtree:true,childList:true,characterData:true});
// Localize text painted into auxiliary 2D HUD canvases without modifying simulation code.
const originalFill=CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText=function(text,...args){return originalFill.call(this,tr(text),...args);};
const originalStroke=CanvasRenderingContext2D.prototype.strokeText;
CanvasRenderingContext2D.prototype.strokeText=function(text,...args){return originalStroke.call(this,tr(text),...args);};
window.STARSHIP_I18N={setLang,tr,get lang(){return lang;}};
})();
// Fullscreen is requested directly within the user's Start/Resume click gesture.
window.STARSHIP_SCREEN=(function(){
 const root=document.documentElement;
 function enter(){
   try{const req=root.requestFullscreen||root.webkitRequestFullscreen||root.msRequestFullscreen;
     if(req&&!document.fullscreenElement&&!document.webkitFullscreenElement){const p=req.call(root,{navigationUI:'hide'});if(p&&p.catch)p.catch(()=>{});}
   }catch(e){try{if(root.requestFullscreen)root.requestFullscreen().catch(()=>{});}catch(_) {}}
   if(screen.orientation&&screen.orientation.lock){try{Promise.resolve(screen.orientation.lock('landscape')).catch(()=>{});}catch(e){}}
   document.body.classList.add('in-mission');
 }
 function leave(){document.body.classList.remove('in-mission');
   try{if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
     else if(document.webkitFullscreenElement&&document.webkitExitFullscreen)document.webkitExitFullscreen();}catch(e){}
   if(screen.orientation&&screen.orientation.unlock){try{screen.orientation.unlock();}catch(e){}}
 }
 return {enter,leave};
})();
