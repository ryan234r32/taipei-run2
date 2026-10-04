# Taipei Run · 跑起來，吃回來。

一段 60 秒的台灣體感跑酷（3 秒從宇宙降落台灣＋47 秒跑程＋結尾美食清單）：玩家原地左右移、跳、蹲，一路吃珍珠奶茶、鹽酥雞、台灣啤酒，一邊逃離崩潰的健身教練；中途追垃圾車丟垃圾、騎 YouBike 暴衝、經過全家聽到「歡迎光臨」，最後把吃到的美食變成 Google Maps 清單。

關卡每一秒對應簡報講稿，見 [60 秒 Demo 時間軸](docs/demo-timeline.md)。排練單一段落可在網址加 `?t=秒數`（例如 `/?t=35` 直接從 YouBike 開始）。

開場倒數用約三秒從 3D 星空地球飛向台灣，再切進夜市；大陸輪廓與台灣定位為簡化示意，不是地理重建，也不另加一段漫長影片。

這是 90 分鐘 Hackathon 的網頁 Demo。用瀏覽器與攝影機即可，不需要安裝 App、帳號或資料庫。饒河夜市場景是為玩法設計的 3D 藝術重組，沒有宣稱還原真實地理。

## 快速啟動

使用 Node.js 22.19+ 或 24 與 npm：

```sh
npm ci
npm run dev
```

開啟 Vite 輸出的網址（預設 `http://localhost:5173`）。攝影機需 `localhost` 或 HTTPS，以及玩家親自允許相機權限。

- 主遊戲：`/`。
- 九種靜態風格比較：`/styles.html`，可放大與兩張並排比較。
- 診斷頁：`/diagnostics.html`，供模型載入、音效和錄影檢查。

九種風格概念是選美術的參考，不是九套可玩 3D 場景。遊戲目前保留共用跑道的三種即時 3D 渲染方向，正式 Demo 只需鎖定其中一種。

概念圖：`cartoon`、`adventure`、`anime`、`painted`、`clay`、`lowpoly`、`voxel`、`retro`、`hybrid`，放在 `public/styles/`。混合推薦款適合保留柔和卡通主體，再加 Cel 式爆衝特效。

## 遊戲與操作

首頁有饒河、西門町、101／信義區與九份四張場景卡；只有饒河可玩，其餘 Locked。固定流程 47 秒跑程，依序是：左右閃、跳、蹲 → 珍奶、鹽酥雞、台啤 → 垃圾車 → YouBike Boost → 全家「歡迎光臨」→ 巨大珍奶被教練抓到 → 美食護照（Google Maps）。分數只累積跑動、小吃和成功投垃圾，沒有熱量或複雜評分面向。

| 操作 | 真人體感 | 鍵盤 |
| --- | --- | --- |
| 左／右 | 身體向自己的左／右移 | `←`／`→` 或 `A`／`D` |
| Jump | 雙腳真的離地 | 空白鍵、`↑` 或 `W` |
| Duck | 蹲下，站直恢復 | `↓` 或 `S` |
| Throw | 快速向上揮手；垃圾事件內才計分 | `F` |
| 暫停／繼續 | 畫面按鈕 | `Esc` |

體感試玩：先開 Camera，讓頭到雙腳都在右下鏡像視訊裡，站直約 1.5 秒完成校準，再開始跑。右下角保留本人畫面與骨架回饋。人體推論在本機 MediaPipe Worker 進行，模型與 WASM 檔案隨專案提供；鍵盤可作現場備援。

**現場至少花 90 秒測試：** 左右各三次、跳三次、持續蹲兩秒、揮手一次，再走出畫面回來一次。完整方法與尚未驗證界線見 [體感實測](docs/body-interaction.md)。單元測試通過不能代替這個真人測試。

## 聲音與 YouBike

食物有金幣式 DING；左右移動、Jump HOO、落地 THUMP、蹲下、BONK、WHOOSH／垃圾投中和 YouBike 都有不同音效。YouBike 搭配解鎖嗶、鈴聲、蓄力／爆發與加速風聲；視覺元件有啟動衝擊環、短字幕、速度線及上方 YouBike／BOOST 標示。

聲音以 WebAudio 原創合成為主，另外納入 Kenney 的三個 CC0 碰撞／腳步樣本。Jump HOO 是合成人聲感；垃圾車音樂是合成旋律，不是現場錄音。中文教練吐槽由瀏覽器語音合成，實際語音取決於裝置。

[音效來源與錄音驗證](docs/sound-design.md) · [Boost 整合與官方標誌來源](docs/boost-effect.md)

## 60 秒影片與評審交付

首頁「看完整演出」與「錄製 60 秒 Demo」會啟動自動演出，畫面應清楚標示「非體感示範」。錄完後用頁面的下載入口保存 WebM。這是遊戲流程展示，不能當作真人 Camera 已通過的證據。

交付前必須下載、重播影片，核對：垃圾車、YouBike、結尾均出現，食物和動作音效確實有聲。若要證明真人體感，請另外實際操作並錄到本人畫面與角色同步；不能把開著 Camera 的自動演出稱為體感錄影。

遊戲 WebAudio 可以錄進影片；中文 `speechSynthesis` 和真人麥克風目前不包含在這條音軌。影片請保留教練字幕。Camera 預覽是否出現在影片，需以實際下載檔確認，不只看網頁上有沒有視訊窗。

公開 GitHub 交付應附可開啟的遊戲網址、風格比較網址與確實產出的 60 秒影片。此 README 不把錄影功能等同已完成影片，也不宣稱尚未生成／提交的影片檔已存在。

## 結尾的美食護照

結尾「我的台灣美食清單 / YOUR FOOD TRAIL」整理這一趟真正收集到的小吃：每種類型的數量、中英名稱，以及對應的 Google Maps 搜尋連結。清單可下載為 HTML，讓評審帶走這趟跑步的美食護照。

它提供外部搜尋連結，**不會替玩家的 Google 帳號建立已儲存 Maps 清單**，也沒有餐廳推薦排名、定位或 Places API。遊戲收集結果是真正的遊戲紀錄；實際店家資訊與排序由 Google Maps 顯示，沒有宣稱逐家核實。

## 驗證與專案結構

```sh
npm test
npm run lint
npm run build
```

本次文件查核親自執行 `npm test`：**24／24 通過**，包含鏡像左右、全身校準、持續蹲、雙腳跳、追蹤失去、丟垃圾窗口、YouBike 與簡單計分。這是合成關節／規則測試；現場光線、攝影機距離、真人辨識和整支交付影片仍須另驗。

| 位置 | 用途 |
| --- | --- |
| `src/App.tsx` | 首頁、教學、遊戲 UI 與入口整合 |
| `src/game/engine.ts` | Three.js 跑道與 75 秒事件 |
| `src/BodyCamera.tsx`、`src/game/pose.worker.ts` | 相機、校準與本機人體推論 |
| `src/game/gestures.ts`、`src/game/rules.ts` | 動作判定、碰撞、簡單計分 |
| `src/game/audio.ts`、`src/game/recorder.ts` | 遊戲聲音與影片錄製 |
| `src/game/arrival.ts` | 三秒 3D 地球／台灣示意開場 |
| `src/BoostEffect.tsx` | YouBike 必殺技視覺 |
| `src/FoodTrail.tsx`、`src/game/food-guide.ts` | 實際收集結果與可下載的美食護照 |
| `public/styles.html`、`public/styles/` | 靜態風格比較與概念圖 |
| `public/audio/`、`public/branding/` | 實際引用素材與來源 |
| `tests/` | 合成體感與遊戲規則測試 |

[60 秒舞台講法與驗收](docs/presentation.md) · [現場盲點與三項必修](docs/blindspots.md) · [風格／資源與工時取捨](docs/style-resources.md) · [素材清單](docs/asset-manifest.json)

Claude 唯讀第二意見本次因本機 OAuth 過期未完成；盲點文件明確分開保留失敗原回覆與 Codex 自己的程式證據。沒有把未取得的建議寫成 Claude 的結論。
