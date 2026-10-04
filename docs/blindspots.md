# Taipei Run 現場盲點：文字第二意見與實測分開

查核日期：2026-10-04。時間預算是 90 分鐘；目標是公開 GitHub、順暢的網頁 Demo 與 60 秒影片。

## Claude 第二意見：未完成

使用者授權後，以本機 Claude CLI 做唯讀呼叫：`-p --tools '' --no-session-persistence --permission-mode plan`，180 秒硬性停止。只提供遊戲需求、體感／聲音／錄影界線及 Google Maps 清單規劃文字；沒有傳帳號檔、敏感資料或讓 Claude 讀寫專案。

2.3 秒後結束，exit code 1。Claude 原回覆完整如下：

```text
Failed to authenticate: OAuth session expired and could not be refreshed
```

**沒有取得 Claude 的盲點建議。以下是 Codex 親自讀文件／程式後的結論，不冒稱為 Claude 回覆。**

## Unknown Unknowns｜你沒想到要問的

- 「辨識到蹲」不等於「一直蹲」。要接持續狀態，否則真人沒站起，角色先撞棚。[E1]
- 相機開著不等於辨識成功。校準、離開畫面、回來要有明確狀態與鍵盤備援。[E2]
- 錄影成功不等於錄到全部。遊戲音、中文教練、本人視訊／麥克風是不同來源；自動演出不能當真人驗收。[E3]
- 用近景、FOV、風聲做速度感；Throw 窗口與首次 Jump／Duck 仍須留時間給真人反應。[E4]

## Unknown Knowns｜看到才認得的

比較卡通、Cel、低多邊形、半寫實靜態圖，限時 2–3 分鐘選一種。九張概念圖不是九套可玩模型。[E4]

## Known Unknowns｜已知未決的

現場才知道：能否拍到全身？首次 Throw 是否來得及？影片選自動還是真人？Maps 清單只是外連，不改核心。[E2–E4]

## 現在三項必修

1. 接好持續蹲與追蹤狀態；真人左右各三次、跳三次、蹲兩秒、揮手一次。
2. 下載重播影片，確認垃圾車、YouBike、結尾與聲音；自動影片標「非體感示範」。
3. 鎖定一種美術、一條跑道，保留真人試玩及影片時間。

## 改寫後的精準 prompt

> 在 90 分鐘內完成 Taipei Run 網頁 Demo：保留一個饒河藝術重組場景、三車道、75 秒固定事件、簡單總分、食物 DING、健身教練、垃圾 Throw、YouBike 必殺技與結尾。先展示九種靜態風格概念，只選一種可玩美術。Camera 玩家原地移動，右下鏡像預覽；接持續蹲與追蹤狀態，鍵盤可備援。驗收：真人左右／跳／蹲／丟與角色一致；完整75秒可跑完；下載的60秒影片包含指定事件與遊戲聲，並標明自動或真人。Google Maps 食物清單只作外連。不要做App、登入、多人、四套場景或複雜計分。

## 證據與親自驗證的界線

- **E1：** `src/App.tsx:112`（掃描當時）僅接 `onPose/onClose`；`docs/body-interaction.md:28–40` 說明 `onDuckChange → setBodyDuck`。此接線已通知整合者修正；行號會隨後續整合變動。
- **E2：** `src/App.tsx:104,117`（掃描當時）以 Camera 開關呈現模式，開始按鈕尚未依 ready 條件限制；`docs/body-interaction.md:11–18,22–24,40–42` 為現場校準／失去追蹤及測試界線。
- **E3：** `src/App.tsx:69–73,104,119–120`（掃描當時）錄影進入自動模式並提供下載；`docs/sound-design.md:36–40` 明列 WebAudio 可錄、speechSynthesis 與真人麥克風未混入。
- **E4：** `docs/style-resources.md` 的「官方畫面／影片參考與競速感」與「別在 90 分鐘裡掉進去的坑」。速度／反應窗口是本專案調整起點，不是已量測原遊戲數據。
- 本輪**親自執行 `npm test`：24／24 通過**，包含合成身體座標、鏡像左右、持續蹲、跳躍、Throw 窗口、YouBike 與計分規則。沒有真人參與，因此不記為真人 Camera 成功。
- 本輪親自檢查 Boost 元件 TypeScript／oxlint 和官方 SVG 可解析；未親測整場瀏覽器互動、現場相機、60秒交付影片或 Google Maps 清單內容。
- 音效錄製／解碼的瀏覽器證據來自聲音負責者的 `docs/sound-design.md:44–51`；不是本文件作者親自試聽。

以上是唯讀掃描的時間快照；整合修正後仍應按照三項必修驗收，而不是只消掉文件上的提醒。
