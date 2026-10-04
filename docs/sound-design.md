# Taipei Run 音效交付

目標是「身體做一個動作，遊戲立刻大聲回應」，同時讓食物、跳躍、撞擊、投垃圾、YouBike 必殺技聽起來各有個性。參考跑酷遊戲的聲音節奏；沒有抽取 Temple Run 或 Subway Surfers 的音檔。

## 已實作聲音

| 觸發 | 聲音設計 | RunAudio 方法 |
|---|---|---|
| 吃到食物 | 明亮雙音金幣 DING，短音頭＋稍長尾巴 | `ding()` |
| 開跑／教練追上 | 兩個接近頻率的尖銳哨聲＋空氣感 | `whistle()` |
| 左右換道 | 短促空氣擦過＋音高上揚，立即回應 | `lane()` |
| Jump | 原創合成 HOO 母音、喘氣音頭、上衝風聲；不依賴瀏覽器朗讀 | `jump()` |
| 落地 | CC0 混凝土地面腳步＋下降低頻 THUMP | `thump()` |
| 撞到／教練撞棚 | CC0 木頭重擊＋滑落音高的喜劇 BONK | `bonk()` |
| 蹲／Slide | 高頻往低頻的長一點風聲＋貼地摩擦 | `duck()` |
| 丟垃圾起手 | 越飛越高的 WHOOSH，獨立於撞擊 | `throw()` |
| 垃圾丟中 | CC0 金屬桶撞擊＋低頻 THUNK＋成功三音 | `throwHit()` |
| YouBike | 解鎖嗶→兩次鈴→短蓄力→低頻爆裂→升高的狂奔風聲 | `bike()`，內含 `boost()` |
| 垃圾車 | 用振盪器演奏熟悉的《給愛麗絲》開頭旋律；不是垃圾車錄音 | `truck()` |
| 教練中文吐槽 | 瀏覽器語音合成，減少聲音互相覆蓋 | `speak()` |

HOO 目前是**合成的人聲感**，沒有聲称已錄到真人的喊聲。若最後試聽覺得不夠自然，可替換成隊友現場錄的 0.4 秒 HOO；主音效不需要因此重寫。

## 用到的真素材與授權

只下載並納入 [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) 裡三個音檔。作者頁與下載包內均標示 CC0；[Kenney 官方授權說明](https://kenney.nl/support) 說明可以個人或商業使用、署名不強制。仍保留署名方便評審核對。

- `public/audio/landing.wav` ← `Audio/footstep_concrete_002.ogg`
- `public/audio/bonk.wav` ← `Audio/impactWood_heavy_002.ogg`
- `public/audio/trash-hit.wav` ← `Audio/impactTin_medium_001.ogg`
- 為瀏覽器相容性，已轉為 mono／22050Hz WAV，總計約 26 KB。
- 原始授權：`public/audio/LICENSE-Kenney.txt`；來源與轉檔記錄：`public/audio/credits.json`。

其餘 SFX 由 `src/game/audio.ts` 原創 WebAudio 合成，不需要額外套件。所有合成和樣本都經過同一個 compressor，再連到揚聲器與 `MediaStreamAudioDestinationNode`。靜音控制也在這個共用輸出層，已播放中的聲音會一起靜音。

## 錄影邊界

`audio.stream` 包含遊戲動作音效，給 `DemoRecorder` 與遊戲 canvas 結合。Jump 的 HOO 也走這條音訊路線，能一起錄進 60 秒影片。

**目前中文教練的 `speechSynthesis` 是現場播放，不能由這條 WebAudio stream 捕獲。** 影片需保留字幕；不可宣稱影片已包含中文教練人聲。要捕獲真人演示者講話也必須另外混入麥克風，現在沒有自動錄入麥克風。

`stop()` 會中止所有已排程與播放的音源，暫停／回主畫面時不留下持續爆衝聲。樣本未載入時仍保留原創合成層，動作聲音不因素材錯誤而全部消失。

## 本次已驗證

- `npx tsc --noEmit`：通過。
- `npm exec -- oxlint src/game/audio.ts`：通過。
- 在本地 Vite／Chromium 裡解碼並載入 3 個 WAV，音訊 stream 有 1 条音軌。
- 真正用 Chrome `MediaRecorder` 錄成 14.6 秒 Opus 音訊檔，ffmpeg 量測平均 -28.9 dB、最高 -4.2 dB；不是無聲檔，也沒有碰到 0 dB 硬剪波。
- 進一步逐一錄下 11 種動作／事件音效：全部有音訊、沒有頁面 JS 錯誤；獨立片段最高峰介於 -15.3 至 -4.0 dB。靜音後觸發 YouBike，錄製器沒有產出有聲音訊封包。
- 聲音喜不喜歡、現場喇叭音量與真人操作節奏，仍由現場試玩判定；數值驗證不能取代試聽。

只要在首次點擊 Play 時啟用 AudioContext，後續操作即可即時發聲。最短驗收流程：吃食物→左右移動→跳→蹲→丟→投中→YouBike，確認每個動作有不同聲音，再用內建錄影重播一次。

## 原創競速配樂

`src/game/music.ts` 是不增加套件的 WebAudio sequencer。144 BPM，使用原創明亮音符排列、chiptune 方波旋律、triangle bass、合成 kick／snare／hi-hat，保持夜市歡樂感和跑步鼓點。沒有下載或改寫商業遊戲配樂。

背景音量先降低，再和音效一起進原有 compressor／master／錄影音訊 stream；靜音設定兩者一起處理。YouBike 52–65 秒開 boost 後增加四拍 kick、較密的 hi-hat、較明亮的旋律和快速 arpeggio，結束後恢復原配器。聲音設計的好不好聽，仍需要現場試聽。

引擎整合介面：

```ts
audio.startMusic()              // 倒數或 GO 開始；重跑會從頭播放
audio.setMusicBoost(true)       // 52 秒進 YouBike
audio.setMusicBoost(false)      // 65 秒結束 YouBike
audio.pauseMusic()              // 暫停：立即停音並保留播放位置
audio.resumeMusic()             // 恢復：接續原來節拍位置
audio.stopMusic()               // 結尾或回首頁：停音並重置位置
```

關卡在 75 秒結束時要呼叫 `stopMusic()`；sequencer 本身可循環，不另外設一個與遊戲不同步的 75 秒計時器。`audio.stop()` 維持停止動作音效／教練的用途，不停止配樂；暫停、回首頁與結束需同時呼叫上面的配樂介面。`dispose()` 已清除配樂排程 timer 與音源。

排程使用短 look-ahead。若瀏覽器分頁被節流，恢復時跳到目前節拍，不把漏掉的音符一口氣擠在一起播放。

配樂已在 Chromium 真正錄成 Opus：一般段平均 -42.7 dB／峰值 -19.1 dB，boost 段平均 -36.8 dB／峰值 -14.3 dB。pause、mute、stop 均降到測量底限 -91 dB；resume 和 unmute 恢復有聲。播放狀態順序為 playing → paused → playing → stopped，沒有 JS 錯誤；TypeScript 與 oxlint 通過。
