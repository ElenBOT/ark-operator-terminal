# 開發文檔

給要改這個專案的人（含後續 agent）。產品規格、UI 決策、資料形狀請看 `README.md`；這份只講「怎麼跑起來、怎麼確認沒改壞」。

---

## 環境需求

- Python 3.11+（`scripts/build_data.py`、`scripts/serve.py` 用得到；`from __future__ import annotations` 需要）
- 只有**重建資料**才需要：
  ```powershell
  python -m pip install opencc-python-reimplemented
  ```
- 前端沒有 Node、沒有 bundler、沒有任何 npm 套件。`web/` 存檔後直接重新整理瀏覽器即可看到效果。

---

## 本機跑起來

```powershell
python scripts\serve.py
```

或雙擊 `啟動.bat`（Windows，會自動找 Python 路徑）。兩者都會：

1. 檢查 `web/data/app-data.json` 存不存在，不存在就先跑 `build_data.py` 補一份。
2. 在 `127.0.0.1:8765`（被佔用會往後找到 8784）開一個沒有快取的靜態伺服器。
3. 開瀏覽器。

**不要**直接雙擊 `web/index.html`——瀏覽器 `file://` 不給頁面 `fetch` JSON，首頁會卡在「讀取幹員資料中…」。

停掉伺服器：終端機按 `Ctrl+C`；如果是背景執行緒或忘了 PID，找佔用 8765 埠的行程砍掉：

```powershell
Get-NetTCPConnection -LocalPort 8765 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

---

## 重建資料（`build_data.py`）

只有遊戲更新、或改了 `scripts/build_data.py` 的打包邏輯才需要。

```powershell
python scripts\build_data.py
```

- 第一次跑會把 `SOURCES` 列出的拆包 JSON 下載到 `data/raw/`（jsDelivr 鏡像 `Kengxxiao/ArknightsGameData` 的 CN 資料、`ArknightsAssets/ArknightsGamedata` 的 TW 資料），另外還會打一次企鵝物流（Penguin Stats）API 抓 CN 掉落矩陣，存成 `data/raw/penguin_matrix_cn.json`。`data/raw/` 已存在的檔案（>1KB）不會重下載，想強制更新就手動刪掉對應檔案再跑。
- 輸出只有一份：`web/data/app-data.json`（純前端資料檔，約 5.5MB，`ensure_ascii=False` + 無縮排壓成一行）。
- `data/raw/term_table.json` 是**手動維護**的補充術語表，會被 commit 進 repo（`.gitignore` 特別放行這一個檔案），當 `gamedata_const` 裡沒有某個 `ba.*` 術語時拿來補。不要刪。
- `data/raw/` 其他檔案都是下載快取，`.gitignore` 排除、不進 repo。`item_table.json`／`stage_table.json`／`building_data.json`（連同 TW 版本）現在都會被 `build_data.py` 用到（養成材料計算機的資料來源），不要當成沒用的殘骸清掉。`penguin_matrix_cn.json` 也是同理。

### 這次修過的一個資料管線缺口

`pack_terms()`（技能／天賦說明裡 `<$ba.xxx>` 滑鼠說明的資料來源）原本要讀 `data/raw/gamedata_const.json`（CN）和 `data/raw/gamedata_const_tw.json`（TW），但 `SOURCES` 沒把這兩個檔案列進自動下載清單——在乾淨環境（新 clone、CI）跑 `build_data.py` 完全不會產生它們，術語說明會整組空白，而且沒人會發現，因為 `pack_terms()` 對缺檔案做了靜默容錯（`os.path.exists` 檔案不在就跳過，不會報錯）。

現在 `SOURCES` 已經補上這兩筆（TW 那筆用的是 `ArknightsAssets/ArknightsGamedata` 同路徑的 `gamedata_const.json`，存成本地的 `gamedata_const_tw.json`，跟 `character_table_tw.json` 那組的做法一致）。改 `SOURCES` 或 `pack_terms()` 時，記得清一次 `data/raw/gamedata_const*.json` 重跑，確認 `terms` 數量沒有掉回個位數。

### 養成材料計算機的資料管線

`operators[cid]` 多了 `evolveCost`（精英化材料+龍門幣）、`skillLevelCost`（技能等級 1-7 共用材料）；`skillRefs[i]` 多了 `masteryCost`（每個技能各自的專精材料）。頂層多了 `materials`（材料本身的名稱/圖示/取得方式）、`levelTable`（練級經驗/龍門幣）、`expItems`（經驗書換算表）。

**一個容易踩的地雷、已經驗證過、不要改回去**：`gamedata_const.json` 的 `characterExpMap`／`characterUpgradeCostMap` 只有 3 個子陣列，**是依精英化階段（0/1/2）索引，不是依星級**——這跟直覺相反（人會覺得「6★ 比 1★ 貴」所以應該依星級查表），但實際上：

1. 這兩個表**真的只有 3 列**，不是 6 列。
2. 用「拿幹員實際 `phases[].maxLevel` 反推」驗證過：每一列的有效長度（非 -1 的筆數）剛好對應「所有星級在該精英化階段的最高等級」（階段 0 最高 50、階段 1 最高 80、階段 2 最高 90），跟依星級分組完全對不上（3★ 精 1 封頂 55、4★ 精 1 封頂 60，都會落在「階段」而非「星級」的分組裡）。
3. 幹員精英化材料／龍門幣（`evolveCost`／`evolveGoldCost`）才是依星級索引，這個沒錯，兩份表**索引方式不一樣**，別搞混。

如果之後要改 `scripts/build_data.py` 這段，先用同樣的反推法（`operators[cid]["phases"]` 的 `maxLevel` 分組跑一次）驗證過再動，不要單憑陣列長度或欄位名稱猜索引方式。

企鵝物流矩陣是**建置時**打一次的外部依賴，只有 CN 資料（企鵝物流沒有 TW 服務器），`data.materials[id].drops` 的理智期望值全部是 CN 代理值，不是台服真實掉落率。

---

## 沒有自動化測試——手動驗收清單

目前這個專案**完全沒有測試框架**，`.github/workflows/pages.yml` 也只是部署、不跑任何檢查。改完東西後照這份清單手動點一輪：

**首頁**
- [ ] 8 個職業分類都有底盤卡，人數統計合理
- [ ] 職業篩選列切換正常，「全部」能回到完整畫廊
- [ ] 頭像載入失敗時有 fallback（`imgEl` 換源），不會整排空白 broken image icon 卡住版面

**家族頁 `#/f/{branchId}`**
- [ ] 精 0／1／2 分頁切換，範圍縮圖跟著變
- [ ] 有特例組的分支（例如先鋒·尖兵）「常見幹員」跟「特例」分頁能切
- [ ] 表格欄位可排序（點欄名切換升降冪），最大/最小值有標色
- [ ] 「滿級／1 級」「滿信賴」開關會即時改變數值
- [ ] 點幹員名字能開檔案頁，從檔案頁「← 返回」或 `Esc` 能回到同一個家族頁（不是回首頁）

**檔案頁 `#/o/{charId}`**
- [ ] 精英化／等級／潛能／信賴四個控制項互動時，數值（含 DPS）即時更新且合理（潛能 6 通常比潛能 1 略強、費用略低）
- [ ] 技能分頁：普攻、S1–S3（含專精 Ⅰ–Ⅲ 等級）都能點，說明文字沒有殘留 `{xxx}` 佔位符或裸露的 `<tag>`
- [ ] 左下角攻擊範圍：普攻/技能切換時棋盤跟著換，且技能有自己範圍時標「目前顯示技能攻擊範圍」
- [ ] 滑鼠移到說明文字裡的專有名詞（例如「暈眩」「庇護」）上有 tooltip；找不到定義的詞不應該掛 tooltip 也不該整段消失
- [ ] 頭像連去 PRTS Wiki 的連結網址正確（幹員中文名對得上）
- [ ] 養成材料計算機：切換技能分頁時，共用技能等級（1-7）反白同步、專精（Ⅰ-Ⅲ）維持各分頁獨立（不會因為切分頁互相污染）
- [ ] 按「預覽初始」「預覽滿級」左側旋鈕整組跳到底/滿；按「設為當前」「設為目標」旋鈕本身不動，只記錄狀態；兩者都設過後右側材料面板才會列材料，只設一邊會看到引導文字
- [ ] 右側材料面板：預設窄版直列可捲動；點展開把手變寬版橫式並自動換行；點材料展開明細，只有一個能同時展開
- [ ] 材料明細：有掉落來源的顯示關卡表（依理智期望值由低到高排序、第一筆標最優）；只能合成的顯示配方＋龍門幣；兩者都沒有顯示「沒有已知取得方式」
- [ ] 換一個精英化上限不同的幹員（1★／3★／6★都試一次）不會壞掉；材料面板會重置成未設定狀態

**搜尋**
- [ ] 打字有即時結果、`Enter` 選第一筆、`Esc` 關閉並清空焦點
- [ ] 從搜尋結果點幹員，會落在正確的特例分組（不是永遠回到常見組）

**建置**
- [ ] `python scripts\build_data.py` 在乾淨的 `data/raw/`（只留 `term_table.json`）能跑完，不用手動放任何檔案
- [ ] 跑完印出的 operators／branches／skills／ranges／terms 數量沒有掉到 0 或明顯偏低

**主控台**
- [ ] 上面任何一輪操作，瀏覽器 DevTools console 不應該有紅字 error（本專案用 headless Chrome + `read_console_messages` 驗證過一輪重構沒有引入新 error，之後改動比照辦理）

如果要把這份清單自動化，比較划算的切入點：

1. `scripts/build_data.py` 裡的純函式（`lookup_bb`、`fill_template`、`trait_shape`、`rarity_of`……）都是無副作用的字串/字典處理，適合直接上 `pytest`，不用真的下載拆包資料。
2. 前端數值計算（`shared.js` 的 `baseStatsAt`／`applyTrust`、`detail.js` 的 `computeStats`）也是純函式，可以用最小的 Node test runner（`node --test`）配假資料驗證，不必啟動瀏覽器。
3. 上面「手動驗收清單」的互動流程，適合用 Playwright/Chromium 自動化腳本重放（本次驗證用的就是這條路，只是手動下指令，沒有存成腳本）。

---

## 這次重構動了什麼

- `web/js/shared.js` 新增 `baseStatsAt` / `applyTrust` / `withDps`：把原本在 `app.js`（家族表）跟 `detail.js`（檔案頁）各寫一份、幾乎一樣的精英化／等級數值內插邏輯合成一份共用函式。行為沒變（已用瀏覽器實測家族表跟檔案頁在同一幹員、同精英化/等級/信賴下數值一致）。
- `scripts/build_data.py`：`SOURCES` 補上 `gamedata_const.json`／`gamedata_const_tw.json`，修掉上面提到的術語資料缺口。
- `啟動.bat`：訊息換成繁中；**修掉一個實際會炸的 bug**——檔案原本是純 LF 換行，混合 `chcp 65001` 使用時會讓 cmd.exe 的批次檔解析器錯位（連完全沒改過的英文 PY 偵測區塊都會被拆成一堆「不是內部或外部命令」的錯誤，甚至誤觸發 Python 直譯器互動模式）。已轉成 CRLF 並實機驗證（`Start-Process` 起這個檔案，確認繁中訊息正常顯示、伺服器正常啟動、瀏覽器正常打開頁面）。

## 養成材料計算機（新增功能）

- 資料管線：`scripts/build_data.py` 新增 `item_table`／`stage_table`／`building_data`（CN+TW）+ 企鵝物流 CN 矩陣，算出 `operators[cid].evolveCost`／`skillLevelCost`／`skillRefs[i].masteryCost`，以及頂層 `materials`／`levelTable`／`expItems`。細節與「精英化階段 vs 星級」索引地雷見上面「養成材料計算機的資料管線」一節。
- `web/js/materials.js`（新檔）：`planMaterials(data, op, current, target)` 純函式，算精英化+練級+技能等級+專精材料差額，龍門幣與經驗（換算成書）併入同一份材料清單，不另開欄位。已用 Python 重算一遍比對過真實幹員數字（Amiya E0Lv1→E2 滿級：約 82 萬龍門幣、73 萬經驗，數量級跟社群估算一致）。
- `web/js/detail.js`：技能等級狀態拆成 `skillLevelShared`（1-7，全技能共用）跟 `mastery[]`（每技能 0-3，各自獨立）——**這同時修掉一個既有 bug**：原本兩者共用同一個 `skillLevel` 欄位，切技能分頁時專精會互相污染。新增按鈕列（`planBar`）與右側材料停靠面板（`materialsDock`／`syncMaterialsDock`），`matPlan.current`／`matPlan.target` 存兩次旋鈕快照。
- `web/js/app.js`：`showOperator` 的 `handlers` 補 `onPreviewBase`／`onPreviewMax`／`onSetCurrent`／`onSetTarget`。
- `web/css/app.css`：`.plan-bar`、`.mat-dock`（`position: fixed` 貼視窗右緣，獨立於 `.file-body` 既有兩欄版面之外，收合/展開靠 `.expanded` class 切寬度）、材料卡／關卡表／合成配方樣式，含手機斷點的簡化版（底部橫條）。
- 已知：材料圖示走跟頭像同一套 GitHub raw 後援鏈，目前有 4 個材料（`MTL_SL_XWB`／`HTT`／`XW`／`HT` 這幾個 iconId）兩邊都連不到圖，純圖示缺角，不影響數字。
- 實測方式：本機起純 `python -m http.server`（不要用 `serve.py`，會自動開真的瀏覽器視窗）＋ headless Chrome，記得**強制重新整理（Ctrl+Shift+R）**——plain http.server 沒有 `Cache-Control: no-store`，一般重新整理／`navigate` 工具換 hash 都可能吃到瀏覽器快取的舊 `app.css`／`app.js`，導致新樣式或邏輯看起來「沒生效」，其實是快取問題不是程式碼問題。
