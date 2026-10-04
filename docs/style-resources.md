# Taipei Run：風格、素材與 90 分鐘取捨

查核日期：2026-10-04。以下分開標示「官方來源」、「可用素材候選」與「本專案建議」。素材候選尚未下載或整合；概念圖只用於選風格，不是可玩的 3D 模型。

## 先做的決定

**本專案建議：直線三車道 + 柔和卡通 3D；低多邊形是第二選擇。** 玩家在攝影機前原地操作，遊戲角色固定在畫面下方，路面與攤販迎面而來。這仍然可以是真 3D：模型、透視、燈光、遮擋都在三維空間。玩家本人不需要向前走。

「角色向前移動」與「場景往後移動」是實作選擇，不能只看畫面判斷原遊戲怎麼寫。Temple Run 和 Subway Surfers 都不要求真人向前跑；本次要借用的是直覺動作、可讀障礙與追逐的視覺節奏。Temple Run 官方列出跑、轉彎、跳、滑；Subway 官方列出閃避列車、收集物品與追逐。[Temple Run 官方](https://imangistudios.com/thegames/temple-run/)、[Temple Run 2 官方](https://imangistudios.com/thegames/temple-run-2/)、[SYBO 官方](https://sybogames.com/)。

## 8 種真的有差異的美術方向

下列時間是**選定一種後，在已有可跑場景上加美術的粗估額外工時**，不是來源公布的數字，也不含完整體感開發和影片交付。八種只做靜態圖比較；不做八套遊戲。

| 方向 | 肉眼怎麼分辨 | 動畫可以怎麼做 | 可用實作資源 | 90 分鐘內風險／粗估額外時間 |
|---|---|---|---|---|
| 冒險半寫實（Temple Run 參考） | 正常人物比例、較多表面細節、自然光影 | 動作重心清楚，落地有重量 | Poly Haven CC0 材質、HDRI；Mixamo 動作需 Adobe ID | 高；35–60 分鐘，易卡在模型/材質統一 |
| 柔和卡通 3D（Subway 參考） | 大輪廓、圓邊、鮮明色塊、少細節 | 誇張擺臂、彈跳、急速換道 | Kenney City Kit；Quaternius 動畫角色 | 低至中；10–20 分鐘，首選 |
| 動漫 Cel Shading | 深淺分段、輪廓線、銳利光影 | 姿勢停頓、漫畫衝擊線、必殺技切入 | Three.js MeshToonMaterial；模型可用 CC0 基底 | 中；15–30 分鐘，描邊要注意效能 |
| 手繪繪本 3D | 紙感、筆刷材質、柔和調色 | 輕微步格感、手繪煙霧與星星 | CC0 模型可重做材質；未核實現成完整台灣繪本套件 | 中高；25–45 分鐘，容易只做成一張好看圖 |
| 黏土／玩具微縮 | 圓胖人物、霧面黏土、微縮模型比例 | Squash/stretch、短暫定格、玩具爆炸 | Kenney 模型基底，自己改圓角與霧面材質 | 中；15–30 分鐘，需要整套比例一致 |
| Low-poly Flat Facets | 多邊形切面直接看得見、平色、少材質 | 清楚有力的跑步節奏、幾何爆炸粒子 | Kenney City Kit；Quaternius CC0 包 | 低；5–15 分鐘，最穩備案 |
| Voxel 方塊世界 | 人、食物、房子都由方塊組成 | 方塊散落、跳格、方塊煙霧 | 可直接用 Three.js InstancedMesh 建立自製方塊；尚未核實合用完整台灣 Voxel 包 | 中；15–30 分鐘，方塊太多會吃效能 |
| 復古 PS1 | 低解析材質、硬輪廓、色階與抖動 | 幾格姿勢、復古衝擊閃白 | Kenney Retro Urban Kit CC0；Godot Asset Library 可參考 shader，但不能直接插進 Three.js | 低至中；10–20 分鐘；需保持障礙辨識度 |

[Kenney City Kit Commercial：50 個檔案、CC0](https://kenney.nl/assets/city-kit-commercial)、[Kenney City Kit Roads：CC0](https://kenney.nl/assets/city-kit-roads)、[Kenney Retro Urban Kit：120 個檔案、CC0](https://kenney.nl/assets/retro-urban-kit)、[Kenney 授權說明](https://kenney.nl/support)。

[Quaternius 官方資源目錄](https://quaternius.com/)、[Quaternius 動畫角色包的作者發布：CC0](https://www.patreon.com/quaternius/posts/ultimate-pack-31403272)、[Downtown City MegaKit](https://quaternius.com/packs/downtowncitymegakit.html)。Downtown 套件偏 Boston/NYC；作者寫明只有約 60–70% 是免費版，完整 Source 版含額外內容，不可把全部說成免費台北素材。

[Poly Haven 授權：模型、材質、HDRI 為 CC0](https://polyhaven.com/license)。網站範例渲染、文字與標誌並不隨資產一起變成 CC0。

[Mixamo 官方 FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) 說明需 Adobe ID，角色與動畫可免費用於個人、商業、非營利作品；**它不是 CC0 素材庫**。公開 GitHub 優先用 CC0 角色；不要把原始 Mixamo 動作檔當獨立開源資產包公開。[Mixamo Additional Terms](https://wwwimages2.adobe.com/content/dam/cc/en/legal/servicetou/Mixamo-Addl-Terms-en_US-20210623.pdf)。

[Three.js 官方文件](https://threejs.org/docs/)、[Three.js MIT 授權](https://github.com/mrdoob/three.js/blob/dev/LICENSE)、[Godot Asset Library shader 分類](https://godotengine.org/asset-library/asset?category=3)。Godot Library 每個項目各有自己的授權，列表同時有 MIT、CC0、CC-BY、GPL；不是全部可以同樣處理。

## 官方畫面／影片參考與競速感

- Temple Run 2 官方頁提供遊戲畫面及 Lantern Festival Trailer：[官方頁](https://imangistudios.com/thegames/temple-run-2/)、[官方頁內嵌影片](https://www.youtube.com/watch?v=gGPEmulg9ds)。
- Subway Surfers 的官方頻道 Trailer：[Subway Surfers Official Trailer](https://www.youtube.com/watch?v=fGy-x3H-nxU)；官方商店含遊戲截圖：[Google Play／SYBO](https://play.google.com/store/apps/details?id=com.kiloo.subwaysurf&hl=en_US)。
- 這次已查核來源歸屬、官方描述與圖像入口；沒有量測原遊戲逐幀速度，也沒有核實其內部座標移動或引擎。原遊戲畫面與音效只作參考，不下載或重用其商業素材。

**本專案可實測的調整起點：**

1. 角色保持畫面下方 1/3，留出前方反應區；攝影機不跟著真人的細微抖動晃。
2. 三道換道 0.16–0.24 秒完成，角色有短促側傾；真人左右控制加中心死區，免得站著也一直跳車道。
3. 路面小物/攤販掠過，比遠處天空移動明顯，近景帶出速度；食物排成連續路線。
4. 一般段先留 1.5–2.0 秒看清障礙，這是體感試玩起點，不是原遊戲數據。讓 3 個首次玩家不用解釋就成功閃過，再縮短反應窗口。
5. YouBike 短切入 0.4–0.7 秒：原創爆炸粒子、放射線、亮出 YouBike 字樣/圖形、重低音啟動；接著 2–3 秒平滑加速，FOV 可從 65° 試到 78°。不把跳躍或蹲下的視覺提前量一起縮成無法反應。
6. 把「速度快」和「輸入晚」分開測：速度感可以由近景、FOV、風聲、動畫與粒子增加，不能用攝影機辨識延遲去製造難度。

## 四個地点的資源調查結果

| 場景 | 目前真正核實到的模型資源 | 台灣感與玩法 | 本專案判斷 |
|---|---|---|---|
| 饒河夜市 | 沒核實到免費、完整、可直接匯入的整條街景。找到 Raohe Steakhouse 付費／Standard License 項目，而且頁面標示可能已下架；不採用 | 夜市攤販、食物、布棚最自然；垃圾車/YouBike 可安排在出口後接街道 | **首選藝術重組**：用模組化攤販、燈籠、機車、招牌做直線走廊。不是地理重建 |
| 西門町 | 找到一個可供 3D 列印的街區微縮項目，未核實遊戲模型格式與授權；不當 ready-to-use 資產 | 店面、街頭活力好做，但需較多不同立面、招牌維持辨識 | 第二順位；既有城市包要台灣化 |
| 101／信義區 | Romain PERRONE 的 Taipei 101 模型頁明确提供下載、2.2k 三角面、CC Attribution；尚未下載验证 | 地標明確，但單棟地標不等於完整信義街景，也不直接提供夜市笑點 | 若更重視現成地標可選；採用必須附作者/來源/授權 |
| 九份 | 找到作者 3D 作品集及 Polycam Qingyun temple Gaussian Splatting capture；未核實可再散布授權與可碰撞跑道，不採用 | 燈籠與坡道漂亮，但窄路、階梯、彎道會增加体感控制與場景成本 | 本次不選；不能把作品集或 splat 視為現成可跑关卡 |

資源證據：[Raohe Steakhouse 原資源頁](https://www.turbosquid.com/FullPreview/2337609)、[西門町微縮模型作者頁](https://framescapr.hgross.eu/miniatures/3477/)、[Taipei 101 模型作者頁／CC Attribution](https://sketchfab.com/3d-models/taipei-101-0a14fe9530c24becbc7188a9888cf528)、[九份作品集](https://www.behance.net/gallery/34880739/Jiufen)、[九份 Qingyun temple capture 作者頁](https://poly.cam/explore/capture/f0bb2fce-f93e-44be-b613-f12156e243a6/Jiufen%2BQingyun%2Btemple%2BTaiwan)。

場景參考：[臺北市官方饒河介紹](https://www.travel.taipei/file/35055/)、[臺北市官方西門町介紹](https://www.travel.taipei/file/34767/)、[新北市官方九份介紹](https://newtaipei.travel/en/attractions/detail/112939)。文字與照片僅供場景研究，沒有宣稱可重用其攝影著作。

## 別在 90 分鐘裡掉進去的坑

- 風格圖選完後，只保留一個可玩方向。選圖 2–3 分鐘；不要等八種都動起來。
- 靜態 AI 圖沒有骨架、碰撞、背面模型或可控攝影機；美術選圖和可玩 3D 是兩個交付。
- 先讓左右移動＋跳／蹲＋聲音能穩定跑，再把 throw 放入定時事件；每個動作都要能從右下角鏡像視訊看懂。
- Webcam 預覽可以一直放右下角；錄影要實際確認同時有遊戲、玩家畫面和聲音。聲音播放成功不等於已錄進影片。
- 不需要 App、帳號、線上排行榜、資料庫或多人。網頁＋HTTPS／localhost 可以完成這個單機 demo。
- 預留最後 15–20 分鐘給一次真攝影機試玩、60 秒影片及公開 GitHub。前面的工時若超出，就縮裝飾密度；保留角色、路、食物、教練、爆衝與結尾。
