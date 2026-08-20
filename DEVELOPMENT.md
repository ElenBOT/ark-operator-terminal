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

- 第一次跑會把 `SOURCES` 列出的拆包 JSON 下載到 `data/raw/`（jsDelivr 鏡像 `Kengxxiao/ArknightsGameData` 的 CN 資料、`ArknightsAssets/ArknightsGamedata` 的 TW 資料）。`data/raw/` 已存在的檔案（>1KB）不會重下載，想強制更新就手動刪掉對應檔案再跑。
- 輸出只有一份：`web/data/app-data.json`（純前端資料檔，約 4.8MB，`ensure_ascii=False` + 無縮排壓成一行）。
- `data/raw/term_table.json` 是**手動維護**的補充術語表，會被 commit 進 repo（`.gitignore` 特別放行這一個檔案），當 `gamedata_const` 裡沒有某個 `ba.*` 術語時拿來補。不要刪。
- `data/raw/` 其他檔案都是下載快取，`.gitignore` 排除、不進 repo。如果手動塞過其他拆包表（`item_table.json`、`stage_table.json`、`building_data.json` 之類）但 `build_data.py` 沒有引用到，純粹佔硬碟，可以刪，不影響建置。

### 這次修過的一個資料管線缺口

`pack_terms()`（技能／天賦說明裡 `<$ba.xxx>` 滑鼠說明的資料來源）原本要讀 `data/raw/gamedata_const.json`（CN）和 `data/raw/gamedata_const_tw.json`（TW），但 `SOURCES` 沒把這兩個檔案列進自動下載清單——在乾淨環境（新 clone、CI）跑 `build_data.py` 完全不會產生它們，術語說明會整組空白，而且沒人會發現，因為 `pack_terms()` 對缺檔案做了靜默容錯（`os.path.exists` 檔案不在就跳過，不會報錯）。

現在 `SOURCES` 已經補上這兩筆（TW 那筆用的是 `ArknightsAssets/ArknightsGamedata` 同路徑的 `gamedata_const.json`，存成本地的 `gamedata_const_tw.json`，跟 `character_table_tw.json` 那組的做法一致）。改 `SOURCES` 或 `pack_terms()` 時，記得清一次 `data/raw/gamedata_const*.json` 重跑，確認 `terms` 數量沒有掉回個位數。

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
