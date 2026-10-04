# 體感操作：最短實測

## 現在做法

網頁使用 `@mediapipe/tasks-vision` 的 Pose Landmarker Lite，模型與 WASM 檔案由專案本機 `/models`、`/wasm` 提供。Camera 畫面與人體關節疊圖固定在右下角，兩者一起鏡像。影像不送到伺服器；推論放在 Web Worker，避免阻塞 3D 主畫面。[Google 官方建議](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) 使用 Worker 執行影片推論。

玩家站在原地，以身體左右移動切三線道；角色自動前進。不是要求玩家在房間裡真的往前奔跑。這種控制可獨立於 Temple Run 或 Subway Surfers 的視覺風格選擇。

## 2–3 分鐘現場實測

1. 用活動現場的電腦開 HTTPS 頁面或 `localhost`。按「先開啟 Camera 校準」，由玩家允許相機。先站到頭與雙腳都在右下視訊中，站直約 1.5 秒，直到 `BODY CONNECTED`。
2. 身體向自己左邊移動：右下「← 左」亮起，遊戲角色也進左線道。回中間，再往右。各做 3 次，確認沒有方向相反或在邊界來回跳動。
3. 跳 3 次：每次只有一次角色跳躍。只抬一隻腳、只舉手不該當作跳躍。看現場相機能否拍到起跳後雙腳；不要只依靠程式測試結果。
4. 蹲下並維持 2 秒：角色應持續蹲。站直才恢復。跳完後立即蹲一次，確認跳躍冷卻不會吃掉蹲下。
5. 快速向上揮手一次測丟垃圾。在垃圾車事件窗口外不應計分；右下會顯示「丟出！」。`F` 可作為示範備援。
6. 暫時走出畫面：右下應提示「看不到全身」，不送新操作，解除持續蹲下。回來後不該憑空跳躍或丟垃圾。按「校準」，確認必須重新站直才變成 `BODY CONNECTED`。

若現場只剩 90 秒：優先驗證左右方向、蹲下持續、跳躍、相機關閉後可鍵盤接手。Body threshold 仍需依現場鏡头距离與光线確認。

## 已有驗證與界線

`tests/body-controls.test.ts` 是 **16 項合成人體關節座標測試**，驗證 30 frame 校準、缺失關節、蹲姿不校準、慢速漂移、鏡像左右映射、線道邊界抗抖、持續蹲下、双腳跳躍、跳躍 cooldown、跳後蹲下、追蹤失去與恢復、重新校準、可見手快速丟出、手腕重新出現與異常座標。另有原本 8 項 gameplay / gesture 測試。

這些測試能證明判定邏輯，**不能證明活動現場相機的辨識準確率、延遲、身高差異與光線適應**。只有現場玩家完成上述流程後，才可以記為真人 Camera 驗證。

2026-10-04 已在本機 Chrome 實際按 `/diagnostics.html` 按鈕驗證 Worker：本地模型（5,777,746 bytes）、ES module loader（323,415 bytes）、WASM（11,756,972 bytes）皆 HTTP 200；兩次測得模型初始化 0.16 / 0.13 秒、64 × 64 空白 frame 推論 0.13 / 0.11 秒。回傳 `pose.ready=false`、`tracked=false`、`landmarks=[]`，符合沒有人的圖片，頁面 `PASS` / `errors=[]`。資源預抓後可能已快取，因此這不是首次上網下載時間，也不是全身影片的 FPS 或真人延遲保證。沒有請求 Camera 權限。

Console 記錄包含 MediaPipe 的 `INFO: Created TensorFlow Lite XNNPACK delegate for CPU.`（套件寫到 console.error 的初始化訊息）、OpenGL checking disabled 與 feedback tensor 警告，沒有 loader 或推論 runtime exception。初次健康頁 favicon 404 已改為內嵌 favicon。

## App / Engine 接口

```tsx
<BodyCamera
  onPose={(lane, action) => {
    engine.current?.setLane(lane)
    if (action) engine.current?.action(action)
  }}
  onReady={setCameraReady}
  onDuckChange={active => engine.current?.setBodyDuck(active)}
  onClose={() => setCameraOn(false)}
/>
```

`onReady`、`onDuckChange`、`onTrackingChange` 都是可選回呼，只在狀態變更時發送。`onPose` 只於完成校準且全身可見時發送。持續蹲下應透過 `onDuckChange` 接 engine 的持續狀態；只使用 `action('duck')` 的短動畫會在玩家仍蹲下時提前恢復。

Game 可在 `onReady=false` 時暫停或保留鍵盤備援；若仍前進，必須明說是追蹤暫失時由鍵盤接手，不應把「沒有收到操作」當作使用者穩定辨識成功。

## Vite / MediaPipe 模組載入修正

installed `@mediapipe/tasks-vision@1.0.1` 的 `FilesetResolver.forVisionTasks(basePath, true)` 可指定 ES module WASM loader。module worker 不能使用 classic `importScripts`。套件會退回 dynamic import，dev server 可能將 `/public/wasm/*.js` 當作 source import 而拒絕，出現紅色 overlay。

`pose.worker.ts` 使用 `useModule=true`，並提供套件支援的 `self.import` hook：同源 `fetch` loader，轉成 Blob ES module 再 import。這樣保留本機 WASM binary 路徑，且不需要放寬 Vite public 檔案保護。錯誤回報帶 `model-init` / `inference` stage 方便判斷。未改模型閾值、未上傳Camera畫面。
