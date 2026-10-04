# Taipei Run 公開 GitHub 交付

這份文件是交付準備與素材說明。公開 repo、部署網址和影片是否已完成，以整合者最後提供的實際連結與下載檔為準。

## 評審應該收到什麼

1. 公開 GitHub repository，包含原始碼、lockfile、README 與實際引用素材。
2. 同一版本的可玩網頁，以及 `/styles.html` 風格比較入口。
3. 真正產出的 60 秒 Demo 影片，放在 repository 或 Release 附件；README 連到可開啟的實際檔案。
4. 啟動方法：`npm ci`、`npm run dev`；驗證方法：`npm test`、`npm run lint`、`npm run build`。
5. 一句清楚的錄影描述：自動演出展示遊戲流程；真人體感演示只有在真的操作、錄到本人與角色同步時才這樣標示。

主影片下載後應核對實際長度、畫面尺寸、有沒有音軌與能不能播放。不要只看網頁出現「下載」就算影片完成。YouBike 和右下 Camera 是網頁上的 DOM 畫面時，不會因為 canvas 被錄製就自動進影片；以下載檔的畫面為準。

## Credits 可以直接引用的資訊

| 實際內容 | 來源／位置 | 授權與用途 |
| --- | --- | --- |
| 原創跑道、角色幾何、玩法、CSS/SVG 特效 | `src/game/models.ts`、`src/game/engine.ts`、`src/BoostEffect.tsx` | 本專案程式；沒有從 Temple Run／Subway Surfers 抽取模型或動畫。專案原始碼授權看根目錄 LICENSE。 |
| 原創動作合成音效與 144 BPM 配樂 | `src/game/audio.ts`、`src/game/music.ts` | 自製 WebAudio；中文教練使用裝置語音合成。 |
| 三個腳步／撞擊音檔 | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds)；`public/audio/` | CC0。保留 `LICENSE-Kenney.txt` 和 `credits.json`，轉檔及原音檔名稱可追溯。 |
| YouBike 標誌 | [YouBike 官方 SVG](https://www.youbike.com.tw/region/assets/images/logo.svg)；`public/branding/youbike-logo.svg` | 官方品牌素材，未附 CC0 再授權聲明；作 Demo 模式識別，原有權利保留。不可把它標成我們的 CC0／MIT 素材，也不代表 YouBike 合作或背書。 |
| 靜態美術概念圖 | `public/styles/`；生成說明 `docs/image-prompts.json` | AI 生成的美術方向參考，非實際遊戲截圖；不與 Kenney 素材合併宣稱 CC0。 |
| 風格與節奏參考 | [Temple Run 2 官方](https://imangistudios.com/thegames/temple-run-2/)、[Subway Surfers 官方影片](https://www.youtube.com/watch?v=fGy-x3H-nxU) | 僅參考；不是本專案的可再散布素材。 |
| 食物介紹 | [臺北市官方美食介紹](https://www.travel.taipei/en/must-visit/tasterguide)、[饒河街觀光夜市](https://www.travel.taipei/en/attraction/details/1691) | 自己撰寫短介紹並保留來源連結；Google Maps 按鈕是食物品項搜尋。 |
| MediaPipe 人體追蹤套件與 WASM | `@mediapipe/tasks-vision`、`public/wasm/` | 安裝套件標示 Apache-2.0；[官方 MediaPipe LICENSE](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE)。模型檔另保留下載來源／版本，不因套件開源就統一改成 CC0。 |

Kenney、Quaternius、Poly Haven 的其他城市與人物包是研究候選，這次沒有下載或整合的項目不能寫成「遊戲已使用」。實際狀態見 `docs/asset-manifest.json`。

已安裝主要程式依賴的套件宣告：React／React DOM／Three.js 為 MIT、Lucide React 為 ISC、MediaPipe Tasks Vision 為 Apache-2.0。這些是依賴自身的授權，不等於我們把整個 repository 選成 MIT。上傳或轉送套件檔案時保留其原授權／notice。

## Repository 的 LICENSE

本交付準備沒有自動替作者選擇一個根 LICENSE。若根目錄尚無 LICENSE，README 就先寫「原始碼公開供 Hackathon 評審檢視；第三方素材各自保留原授權」，不要寫整包 MIT 或 CC0。

GitHub 公開可看、可 fork，和作者選擇讓他人重用的開源授權，是不同設定；[GitHub 官方授權說明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)。之後若作者選 MIT，可以用根 LICENSE 授權原創程式，並繼續保留上表的第三方素材界線。

## 最後 10 分鐘的實用順序

1. 親跑 `npm run build`，它會執行 `tsc -b` 與 Vite production build；單跑根設定的 `tsc --noEmit` 不能代替 project references 的完整編譯。
2. 用要演示的瀏覽器跑一次鍵盤／體感流程，確認左右、跳、蹲、投垃圾、YouBike、分數和結尾。
3. 下載 60 秒影片，核對垃圾車、YouBike、結尾和收集／動作音效；中文裝置朗讀是否錄入另看實際音軌。
4. README 補上實際已驗證的遊戲、風格與影片連結，標明尚未真人實測的項目。
5. 最後才提交並確認公開 repository 可由未登入視窗查看。

本文件不會把「錄影功能存在」寫成「影片已交付」，也不把先前單元測試寫成真人 Camera 驗收。
