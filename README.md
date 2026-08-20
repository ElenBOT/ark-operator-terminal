# 方舟幹員資料終端

明日方舟幹員資料站。依職業／分支瀏覽，同機制、同攻擊範圍的幹員會分在一起對照。

**成品是純靜態網頁**（HTML／CSS／JS＋一份 JSON）。線上不用 Python、不用 Node、沒有後端。  
**給後續 agent：** 先讀本檔「現況／架構／不要重做」再改；本機怎麼跑、資料管線細節、手動驗收清單看 [`DEVELOPMENT.md`](DEVELOPMENT.md)。

---

## 怎麼用（不用 Python）

整站就是 `web/` 這一層。放到任何靜態空間就能開：

- GitHub Pages（下面有步驟）
- Netlify / Cloudflare Pages 之類，網站根目錄指到 `web/`
- 本機預覽才需要一個靜態伺服器（雙擊 `啟動.bat`，或任何 Live Server）

**不要**直接雙擊 `web/index.html`。瀏覽器的 `file://` 不讓頁面 `fetch` JSON。

`web/data/app-data.json` 已經建好。日常瀏覽不必重建資料。

### 放到 GitHub Pages

這個 repo 已含 `.github/workflows/pages.yml`，會把 `web/` 發到 Pages。

1. 在 GitHub 開一個新 repo，把這個資料夾推上去（預設分支 `main` 或 `master`）
2. repo **Settings → Pages → Source** 選 **GitHub Actions**
3. 等 workflow 跑完，網址會是：

```
https://<你的帳號>.github.io/ark-operator-terminal/
```

另一種不靠 Actions 的做法：新建一個 repo，只把 `web/` **裡面的檔案**放到根目錄，Pages 選 Deploy from branch、`/`（root）。記得根目錄要有 `.nojekyll`。

路由用 hash（`#/o/char_xxx`），Pages 這種沒有後端的站也能直接分享連結。

---

## 開發：什麼時候才要 Python

只有兩件事用到 Python，都跟「上線後的訪客」無關：

| 指令 | 做什麼 |
|---|---|
| `啟動.bat` 或 `python scripts\serve.py` | 本機開 http://127.0.0.1:8765/ 預覽 |
| `python scripts\build_data.py` | 遊戲更新後，從拆包 JSON 重建 `web/data/app-data.json` |

建資料需要 `opencc-python-reimplemented`（簡轉繁）：

```powershell
python -m pip install opencc-python-reimplemented
```

---

## 產品規格（已鎖定）

- 官方**分支**為主分組；同分支再依精 2 範圍、特性形狀、攻擊間隔、阻擋拆小組。
- **不排名、不寫上位替代**。家族表只做同條件數值對照，最高／最低標色。
- 語系：繁中（台服名稱優先，沒有的用 OpenCC `s2twp`）。
- 第一版範圍：家族畫廊 + 家族對照表 + 幹員檔案頁（精英化／等級／潛能／信賴／技能）+ 養成材料計算機（精英化／練級／技能等級／專精材料，含關卡理智期望值與合成配方）。
- 刻意不做：模組、手卡收藏、登入。

---

## 現況（做到哪）

已完成、可用：

- 首頁：8 職業 → 分支底盤卡（範圍縮圖、特性、頭像、特例組數）
- 官方職業圖（先鋒／近衛／重裝…）出現在篩選列、區塊標題、底盤卡、家族頁、搜尋、檔案頁
- 家族頁：精 0／1／2 範圍、同條件表（滿級／1 級、滿信賴）、點幹員進檔案
- 檔案頁：方頭像、兩欄等寬數值、固定尺寸攻擊範圍棋盤、技能 1–7／專精、潛能、信賴
- 檔案頁技能列第一格是「普通攻擊」（進入頁面的預設）。左下範圍跟這個走；點 S1–S3 才會改成技能範圍，並標「目前顯示技能攻擊範圍」
- 普通攻擊說明用該幹員特性（群療、範圍傷害、不攻擊等）
- 技能／特性說明會填 `{atk:0%}` 等佔位符；`<$ba.protect>` 等術語（庇護、暈眩…）滑鼠指上可看說明
- 搜尋幹員／分支；`/` 對準搜尋、`Esc` 從檔案返回
- 檔案頁範圍面板下方有「預覽初始／設為當前／設為目標／預覽滿級」按鈕列：前後兩顆記錄旋鈕上的養成狀態（精英化／等級／共用技能等級／各技能專精），算出中間需要的材料。視窗右側材料面板預設窄版直列，可展開成橫式並換行；點材料看可刷關卡（依理智期望值排序、標最優）或加工站合成配方

已知限制：

- 不含模組改特性／改範圍
- 不含潛能對天賦以外的「隱藏數值」模擬（攻速天賦不加進面板 DPS）
- 頭像走 GitHub raw（`yuanyan3060` → `Aceship` 後援）；離線或被擋時圖會缺，材料圖示同一套後援也有極少數（目前 4 個）兩邊都沒有
- CN 比台服新：台服還沒有的卡用簡轉繁名
- 阿米婭目前資料裡只有術師形態
- 1 星機器人沒有主動技能（檔案頁仍有「普通攻擊」）
- 材料計算機：理智期望值來自企鵝物流 **CN** 矩陣（企鵝物流沒有台服資料，這是唯一可行的數字來源）；經驗換算成書本數量是貪心法、非無浪費最佳解；合成配方只顯示一層，不遞迴拆到最底層原材料；關卡效率清單只留前 8 筆；沒有另外核對關卡是否還開放刷取

---

## 架構

```
方舟/
  啟動.bat                 可選：本機預覽
  .github/workflows/pages.yml  把 web/ 發到 GitHub Pages
  scripts/serve.py         可選：127.0.0.1:8765 靜態站
  scripts/build_data.py    拆包 JSON → web/data/app-data.json
  data/raw/                開發用拆包（不上線）
  web/                     整站成品；Pages 的網站根目錄
  web/.nojekyll            讓 Pages 不要走 Jekyll
  web/index.html
  web/css/app.css
  web/js/app.js            路由、首頁、家族表
  web/js/detail.js         檔案頁、數值／技能說明、養成材料計算機 UI
  web/js/materials.js      養成材料計算純函式（無 DOM）
  web/js/shared.js         頭像、範圍格子、職業名、材料圖示
  web/img/prof/            官方 8 職業圖
  web/data/app-data.json   前端唯一資料檔（約 5.5MB）
```

路由（hash）：

| Hash | 頁面 |
|---|---|
| `#/` | 首頁畫廊 |
| `#/f/{branchId}` | 家族（可再接 `/{groupId}`） |
| `#/o/{charId}` | 幹員檔案 |

資料來源（`build_data.py` 的 `SOURCES`）：

- CN：`Kengxxiao/ArknightsGameData`（jsDelivr）
- TW：`ArknightsAssets/ArknightsGamedata` 的 `tw/`
- 企鵝物流（Penguin Stats）CN 掉落矩陣：`penguin-stats.io` API，只在**建置時**打一次、快取到 `data/raw/penguin_matrix_cn.json`，算出材料的關卡理智期望值。企鵝物流沒有 TW 資料。

前端不連網打 API，只讀同站的 `app-data.json`。頭像／材料圖示才連外。GitHub Pages 只發佈 `web/`，Python 與 `data/raw/` 不會上線。

---

## 資料形狀（改前端必看）

`app-data.json` 頂層：`professions`、`ranges`、`branches`、`operators`、`skills`、`terms`、`materials`、`levelTable`、`expItems`。

- `branches[].groups[]`：同一底盤的一組人。`primary` 為人數最多的那組；其他人在「特例」。
- `operators[id].trait`：已填好數字的純文字（家族卡用）。
- `operators[id].traitEntries[]`：帶 `{placeholder}` 與 `blackboard`，檔案頁依精英化重算。
- `operators[id].skillRefs[]`：`{ id, unlockElite, masteryCost }`，內文在頂層 `skills`。`masteryCost` 是長度 3 的陣列（專 I/II/III），每項 `{materials, unlockElite}`，每個技能各自獨立。
- 技能等級 0–6 = 1–7 級，7–9 = 專Ⅰ–Ⅲ；**注意技能等級 1-7 是所有技能共用的（`skillLevelCost`），只有專精是每個技能各自的**——這是遊戲本身的機制，`detail.js` 的 `skillLevelShared`／`mastery[]` 就是照這個拆的，不要合回同一個欄位。
- 潛能顯示 1–6；`potentials[0]` 是潛 2 的加成。潛能／信賴都不吃材料，材料計算機不算這兩項。
- 信賴 0–200，滿 200 吃完整 `trust` 加成。
- `operators[id].evolveCost`：長度 2 陣列（精 1、精 2），每項 `{materials, lmd}`；沒有下一階精英化就是 `null`。
- `operators[id].skillLevelCost`：長度 6 陣列（技能等級 1→2 … 6→7），每項 `{materials}`。
- `levelTable.expByPhase` / `lmdByPhase`：**依精英化階段（0/1/2）索引，不是依星級**——這點違反直覺，是拿真實幹員 `maxLevel` 資料反推驗證過的，不要改回「依星級查表」。每個階段的等級都從 1 重新查。
- `expItems`：`{ itemId: gainExp }`，四階「作戰記錄」書換算表，`materials.js` 的 `expItems Breakdown` 拿去把經驗總量貪心換算成書本數。
- `materials[id]`：`{ name, rarity, iconId, craft, drops }`。只收會被用到的材料（約 92 種），不是遊戲全部材料。`craft` 是加工站配方（`{goldCost, count, costs}`）或 `null`；`drops` 是依理智期望值排序的關卡清單（`{stageId, code, name, apCost, apPerItem}`），最多 8 筆，兩者皆無就是「沒有已知取得方式」。

攻擊範圍：

- 家族縮圖：只畫該範圍實際佔格（`renderRange` 不傳 frame）。
- 檔案頁：固定棋盤 `RANGE_FRAME`（row -3..3、col -3..6），自身格永遠同一位置。

說明文字請走 `formatSkillDesc`（`detail.js`），不要自己 `innerHTML` 生技能／天賦／特性。它會：

- 大小寫不敏感地對 blackboard
- 填 `{duration}`（從技能本體）
- 把 `<@ba.*>`、`<$ba.*>`、`</>` 收成 span；`<$ba.*>` 會掛 `data-term`，說明來自頂層 `terms`

---

## 改動時注意

- 維持繁中 UI。新文案不要簡體。
- 家族表不要做成強度榜。
- 檔案頁目標是橫屏一覽、少整頁捲動。
- 沒有 Node／bundler。改 `web/` 存檔後硬重新整理即可。上線只推 `web/`（workflow 已設好）。
- 重建資料很慢（讀大 JSON + OpenCC）。`data/raw/` 已存在就不會重下載。
- OpenCC 實例要快取（`build_data.convert` 已做）；不要每次字串 new 一個 converter。

建議後續（還沒做）：

1. 模組：改特性、數值、範圍
2. 離線頭像／技能圖快取
3. 資料更新流程（標 CN／TW 版本日期，含企鵝物流矩陣多久重抓一次）
4. 家族表可選「含潛能」基準
5. 材料計算機：合成配方遞迴展開到最底層原材料、經驗換算改無浪費最佳解

---

## 對話裡已做過的 UI 決策

- 頭像：檔案頁只要方頭貼，不要大立繪背景。
- 數值：生命／攻擊／防禦／法抗／費用等全部兩欄、同一字級。
- 範圍：固定棋盤，不要依幹員裁成不同大小的框。技能改範圍時必須標明「目前顯示技能攻擊範圍」；進檔案預設看普通攻擊。
- 專有名詞（庇護、暈眩等）用 hover 說明，不要另開名詞頁。
- 站名是「方舟幹員資料終端」；副標是「分支資料夾」。左上角 logo 是 1-1 攻擊範圍（自身格 + 前方一格），格子大小與介面範圍圖相同。
- 職業用官方分類圖，不要自己畫；普攻圖示用指向右上的單色劍，不要寫「普」。
- 標題：`返回` + 頭像 + 中文名；下一行 `英文 · 職業 · 分支 · 星`。不要重複分支名。
- 控制列（精／等／潛／信）要拉滿對齊，不要靠左留白。
- 首頁頭像約 48px，家族表約 52px。
