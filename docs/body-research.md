# 人體控制：可以向業界借什麼，現在先做什麼

這份研究以 **90 分鐘 Hackathon、瀏覽器 3D 遊戲** 為前提。建議繼續使用現在的 **MediaPipe Pose + CPU Worker**；先把左右、蹲住、跳一下測順。換辨識套件會連帶改關鍵點編號、載入、效能及動作門檻，最後 10 分鐘很難證明換了更好。

## 辨識套件能看見什麼

- **MediaPipe Pose / BlazePose GHUM**：輸出 33 個身體關鍵點，包含肩、髖、膝、踝、腳跟及前腳掌。Lite / Full / Heavy 是速度與模型容量的選擇。它負責找出身體位置；「這算不算跳」、「左移多久才切線」仍要遊戲自己定義。[Google 官方概覽](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)
- **TensorFlow MoveNet**：17 個關鍵點，Lightning 偏速度、Thunder 偏準確；官方 JavaScript 版本有預設啟用的時間平滑，可使用 WebGL 或 WASM。少了腳跟與前腳掌，不能直接照搬目前 33 點規則。官方的 30 FPS 以上是特定設備的結果，不能當作這台電腦同時跑 3D 的保證。[官方教學](https://www.tensorflow.org/hub/tutorials/movenet)、[實際套件 README](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/movenet/README.md)

我們已把辨識放在 Worker：Google 文件指出 `detectForVideo()` 會同步執行，放主執行緒可能卡住畫面。保留這個架構對遊戲比較合理。[Web 官方文件](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)

## 實際看過程式的可借用範例

| 範例 | 原始碼實際做了什麼 | 我們可借用／不能直接套用 |
| --- | --- | --- |
| [webcam-pose-runner](https://github.com/Chuyuyan/webcam-pose-runner) | [index.html](https://github.com/Chuyuyan/webcam-pose-runner/blob/main/index.html) 使用身體尺度正規化、EMA 平滑、穩定校準、蹲下與起身不同門檻，以及追蹤中斷後重設速度。 | 最接近我們的攝影機跑酷。可借用「先穩住訊號再觸發」和斷線復原思路。MIT。整頁還含帳號服務設定、2D 遊戲及長蹲自動調整基準；整包搬來會改掉我們的持續蹲下與 3D 架構。 |
| [Subway-Surfers-Motion-Controlled](https://github.com/punyamodi/Subway-Surfers-Motion-Controlled) | [gestures.py](https://github.com/punyamodi/Subway-Surfers-Motion-Controlled/blob/main/gestures.py) 用肩膀中心切三個區域，肩膀兩次取樣的上移量判定跳，鼻／肩／髖比例判定蹲；用 PyAutoGUI 發按鍵。 | 可參考三線道與獨立冷卻時間。其跳躍條件不能證明真的離地，蹲下是重複按鍵事件，沒有「蹲住」狀態。Python、視窗焦點與系統輸入權限不適合最後 10 分鐘導入。README 宣稱 MIT，但若要複製程式仍應確認正式授權檔。 |
| [Squat-Rep-Counter-AI-Powered-Fitness-Tracker](https://github.com/April033/Squat-Rep-Counter-AI-Powered-Fitness-Tracker) | [main.py](https://github.com/April033/Squat-Rep-Counter-AI-Powered-Fitness-Tracker/blob/main/main.py) 以單側髖—膝—踝角度判斷姿勢，低於 100° 進入 down，高於 160° 回 up。程式在「下蹲」時加一次計數。 | MIT。可學不同進出門檻，避免邊界來回抖動。健身深蹲標準太嚴，不適合遊戲；只看單腿且缺少完整可見度檢查，也不是我們可直接照抄的全身控制器。 |

以上查看了實作，沒有只靠專案名稱推薦；也沒有把它們 README 的效果宣稱當成本地測試結果。

## 白話的控制流程

**攝影機找身體點 → 站直校準個人基準 → 讓訊號穩定 → 判斷目前姿勢／一次動作 → 控制 3D 角色。**

1. **找點**：頭、肩、髖、膝與脚是否真的在畫面裡？低可信度時先顯示「往後站／回畫面」。
2. **個人校準**：每個人身高、站位不同，不能所有人用同一條畫面高度。先記錄站直時的身體中心、腳和肩寬。現在至少需要 1.2 秒及 8 個穩定取樣；失去追蹤、姿勢漂移或取樣空窗超過 750 毫秒會重新計時。
3. **平滑與門檻**：左右用平滑後的身體中心；離中心夠遠才切線，回到更靠近中心才回中線。這個「出去要大一點，回來要小一點」就叫遲滯，能減少一秒左右左右亂跳。
4. **姿勢與事件分開**：「蹲著」是持續狀態；「剛剛跳了」是一次事件。跳躍／丟垃圾各有冷卻，不要蹲一下就把跳躍鎖住。
5. **控制角色**：只把 `lane`、`ducking`、`jump`、`throw` 交給遊戲。人物辨識不負責計分，遊戲也不用知道每個骨架點。

## 真跳、踮腳與鏡頭晃動的盲點

現在用「髖升高 + 左右腳踝都升高」判跳，比只看頭／肩升高更能排除單腳抬腿；但 **踮腳時腳踝也會升高，仍可能誤判**。這是工程推論，尚未以真人比較過。

- 真跳：可進一步看兩側前腳掌 31／32 是否也上升；單腳抬腿應只有一側變化。必須看得到鞋，不能在腳被裁掉時硬判。
- 起身：從蹲姿快速站起來會像「身體向上」。應先確認已回到站姿，再重新允許跳躍；別把起身當跳。
- 鏡頭晃：整個人所有點一起位移，可能像跳。最快的方法是把電腦固定在桌上；要用背景追蹤排除震動，是額外功能，現在不值得加入。
- 一般單鏡頭畫面不能可靠證明腳真的離地；世界座標也不是地板壓力感測器。遊戲應採寬容回饋，不宣稱具有健身動作判定的準確度。

## 蹲住、鏡像與左右

蹲下後必須能一直滑到玩家站回來。若只收到一次 `duck`，動畫幾百毫秒後自動站起來，真人還蹲著就會撞障礙；目前已另傳持續 `ducking` 狀態。

右下角影片與骨架一起鏡像，讓畫面像照鏡子；遊戲左線也要跟著玩家在鏡像預覽中的左移。只鏡像影片、忘記改控制方向，會變成「我往左，角色往右」。現有合成測試涵蓋映射，但仍要真人實測兩側。

蹲下時膝或腳被畫面切掉，現在會清除蹲姿並提示追蹤暫停。比亂觸發安全，但可能讓 Demo 不順：**先往後站、完整入鏡，比最後一刻改辨識規則更有效**。可考慮短暫保留最後有效狀態作容錯，但需現場測試後再決定。

已修正的技術盲點：官方 normalized 座標的 x 除以影像寬、y 除以高，直接拿它們算膝角會因 4:3／16:9 而改變。現在 Worker 傳入影像比例，以 `x × 寬高比` 算角度；4:3／16:9 的 134°／136° 門檻測試通過。這是座標定義導出的幾何結論。[官方座標定義](https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/components/containers/NormalizedLandmark)

## 最後 10 分鐘的實測順序

1. 固定電腦，玩家全身入鏡並校準；左右各一次，回中間，確認影片／角色方向一致。
2. 蹲住 3 秒再站起來：角色應持續滑行，站起來不能觸發跳。
3. 真跳 2 次、踮腳 1 次、單腳抬腿 1 次：看是否誤觸；依真人結果調一個門檻，不同時改五件事。
4. 離開畫面再回來：顯示追蹤訊息，回來第一幀不能亂跳／丟垃圾。
5. 跑一次 75 秒完整流程，包含 YouBike 特效；若特效讓辨識／畫面卡頓，先降低裝飾或粒子密度。

已量測的只有 **本地 CPU Worker 對 64×64 空白圖片推論約 0.11–0.13 秒**，模型初始化約 0.13–0.16 秒；資源已暖快取。空白畫面、單次推論不等於真人影片 FPS，也不包含取圖、傳輸、連續追蹤或 3D 的競爭成本。未驗證真人辨識準確率、跳／蹲延遲及整場穩定性。測試入口為 `diagnostics.html`；測試方法另見 [body-interaction.md](./body-interaction.md)。

若還有時間，優先增加一個真人測試影片／紀錄；不要再換整個辨識引擎、引入 Python 控制鍵盤，或打造複雜健身計分。

## 新增參考：ToolKit 體感跑酷

使用者提供 [ToolKit 體感跑酷](https://toolkit.tw/motiongame/parkour)，並回報有人實際玩得準。我們於 2026-10-04 只讀取公開 HTML 與其 CDN 腳本，沒有啟動攝影機、呼叫遊玩額度／排名 API，也沒有複製其遊戲程式。

**已從公開程式確認：**

| 項目 | ToolKit 實作 | Taipei Run 目前實作 |
| --- | --- | --- |
| 套件 | 舊版 `@mediapipe/pose` | 新版 `@mediapipe/tasks-vision` |
| 電腦設定 | 640×480、Full、每個 frame 送辨識 | Lite，辨識放 CPU Worker |
| 手機設定 | 320×240、Lite，每 3 個 frame 送 1 個 | 本次以電腦 Demo 為主 |
| 穩定訊號 | `smoothLandmarks: true`；偵測／追蹤 confidence 0.5 | confidence 0.6，加個人校準與線道遲滯 |
| 開始與基準 | 雙手腕高於鼻子約 1 秒；開始時記錄髖中心高度 | 站直至少 1.2 秒、至少 8 個穩定取樣 |
| 跳／蹲規則 | 髖中心相對基準上移超過 0.08 判跳、下移超過 0.10 判蹲 | 跳看髖＋兩側腳踝；蹲看膝角＋鼻子下移 |

ToolKit 的遊戲是側面 2D 跳／蹲，公開判定沒有左右切線、膝角或逐點可見度檢查。這些是它實際程式的規則，**不代表其精度或 FPS 已由我們測量**。[公開頁面與內嵌程式](https://toolkit.tw/motiongame/parkour)

**GPU 路徑已確認到設定，尚未量測執行：**其公開 [pose.js](https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js) 的模型映射為 complexity 0 → Lite、1 → Full。`useCpuInference` 預設在一般桌機為 false；iOS／符合 Mac 觸控判斷的裝置為 true，並有 WebGL／GPU graph 載入。因此可確認它一般桌機預設選 GPU 路徑，不能據此宣稱每台裝置實際 GPU 委派成功或比較快。

**Full／GPU 值不值得換：**Google 舊版文件說模型較大通常更準、延遲也增加；所以 Full 的優勢是點位品質，不是保證更快。GPU 則是另一個獨立選擇。Tasks 的本地型別也支援 `delegate: 'GPU'`，技術上可做小規模測試；GPU 可能與 3D 渲染競爭，這一點是我們的工程推論。[Google 模型與延遲說明](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/pose.md)

建議先在獨立診斷頁比較 **Lite CPU → Lite GPU**，確認 Worker 初始化成功和推論時間，再以同一段真人影片比較漏判、延遲及遊戲畫面。若點位仍抖動，才比較 **Full GPU**；兩個變數不要同時換。Full 必須取得與 Tasks 相容的 `.task` 模型，不能直接拿參考網站舊版 `.tflite` 替換。目前未換模型、未切 GPU，也未證明它能改善這台電腦的遊戲。

現在可先借用的想法是 **清楚的開始手勢、影片上的基準線、目前跳／蹲狀態提示，以及依設備分品質**。髖高度單一判定也值得作對照：可能更寬容，但也可能把踮腳或鏡頭變動當動作，不能直接當更準的答案。若現場問題是腳被裁掉，先調整站位；換 Full 也不能恢復畫面外的腳。
