# YouBike Boost：90 分鐘 Demo 的實作

## 接上遊戲

本元件是原生 React + CSS/SVG；不需額外 npm 套件，不需粒子框架。

```tsx
import BoostEffect from './BoostEffect';

// 與遊戲 canvas 放在同一個 position: relative 的容器。
<div className="game-stage">
  <canvas />
  <BoostEffect active={isYouBikeBoost} />
</div>
```

- `active` 由 false 變 true：播放一次必殺技啟動、柔和強光、兩層衝擊環，以及約 1.35 秒的 BOOST 字幕。
- 持續 true：上方官方 YouBike 圖示／BOOST 標示、四周速度線與綠黃色邊光。
- 變 false：立即清掉特效。再次啟動會重播爆發，不需 key 或額外計時器。
- `prefers-reduced-motion: reduce`：保留靜態上方標示與邊光，關掉爆發、強光和速度線。
- `pointer-events: none`：不擋遊戲或攝影機控制。右下角特效逐漸淡出，攝影機視訊窗應放在特效更高一層。
- 此元件只負責視覺。引擎仍須同步提升場景前進速度／Camera FOV，並播放刷車「嗶」、鈴鐺與風聲；單靠速度線不算真的加速。
- 預設路徑 `/branding/youbike-logo.svg`。圖檔載入失敗會自動顯示清楚的 `YouBike` 文字。

可選 props：`className`（調整位置）、`logoSrc`（替換圖檔）。

## 資源、來源與授權界線

2026-10-04 查核：

| 資源 | 來源 | 狀態 | 本次用途 |
| --- | --- | --- | --- |
| YouBike 官方網站標誌 | https://www.youbike.com.tw/region/assets/images/logo.svg | 官方首頁使用的公開 SVG；6,863 bytes、viewBox `0 0 255.3 85.7`，無 script。網站未附 CC0／開源再授權聲明，商標仍屬 YouBike；使用來源不代表官方合作。 | 保留原圖於 `public/branding/youbike-logo.svg`，作 Demo 裡模式的識別。 |
| Kenney Particle Pack | https://kenney.nl/assets/particle-pack | 官方頁明確標示 Creative Commons CC0；80 個粒子圖檔。 | 已查核可用，未下載／引用；之後要補碎光、閃光貼圖可用。 |
| Kenney Smoke Particles | https://kenney.nl/assets/smoke-particles | 官方頁明確標示 Creative Commons CC0；70 個煙霧／爆炸素材。 | 已查核可用，未下載／引用；之後要補煙塵可用。 |
| 啟動爆發、衝擊環、速度線、閃電圖形 | 此專案的 CSS/SVG | 自製；沒有取用商業遊戲的素材或角色。 | 本次實際動畫。 |

這一版的選擇是先做出可運作的必殺技視覺，節省素材下載、材質調整和套件整合時間。Kenney 的資源是可接續使用的候選來源，不能在 README 說已用到那些貼圖。

## 驗證方式

在遊戲或測試頁做以下動作：

1. `active=false` 時 DOM 沒有 `.boost-effect`。
2. 啟動後一秒內有爆發，1.35 秒後中間字幕消失；上方標示和周圍速度線維持。
3. 持續 true 不應再次閃光。關閉再開啟才重播。
4. 模擬減少動態：保留標示，沒有強光／移動線條。
5. 設定不存在的 `logoSrc`：應切到 YouBike 文字，不留下破圖。
6. 遊戲中測試視訊窗在右下角仍清楚、操作按鈕可點、跑者與下一個障礙物看得見。

已通過單獨元件的 TypeScript 型別檢查與 `oxlint src/BoostEffect.tsx`。官方 SVG 已用 XML parser 確認可解析且没有 script。整場遊戲的建置、瀏覽器實際視覺、速度／FOV／聲音同步仍由整合者驗證，避免把單獨元件檢查當成整場遊戲驗收。

```sh
./node_modules/.bin/tsc --ignoreConfig --noEmit --skipLibCheck --jsx react-jsx --esModuleInterop --lib ES2022,DOM --module ESNext --moduleResolution bundler --types vite/client src/BoostEffect.tsx
./node_modules/.bin/oxlint src/BoostEffect.tsx
```
