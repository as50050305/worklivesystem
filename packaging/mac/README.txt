工作生活規劃（Mac 版）
======================

★ 先做這一步：解除 Mac 的下載封鎖
--------------------------------
從網路下載的檔案會被 Mac 擋住（出現「無法打開」「Apple 無法驗證」）。
解壓縮並把 WorkLifePlanner 資料夾放到想放的位置後：

1. 打開「終端機」（Launchpad → 其他 → 終端機，或按 ⌘＋空白鍵 搜尋「終端機」）。
2. 輸入下面這串，最後面要有一個空格（先不要按 return）：

     xattr -dr com.apple.quarantine 

3. 把 WorkLifePlanner 資料夾從 Finder 拖進終端機視窗，路徑會自動填上，例如：

     xattr -dr com.apple.quarantine /Users/你的名字/Documents/WorkLifePlanner

4. 按 return。沒有出現任何訊息就是成功了。
5. 接著就可以直接雙擊 install.command。

（每次下載新的 zip 重新安裝時，都要再做一次；用 update.command 更新則不需要。）

全部資料都存在你的電腦，不需要註冊任何帳號。支援 Apple 晶片（M 系列）與 Intel Mac。

【第一次安裝】
1. 雙擊 zip 解壓縮，把「WorkLifePlanner」資料夾移到你想放的位置
   （例如「文件」裡）。之後不要再移動它，桌面的啟動檔會找不到。
2. 依照最上面「先做這一步」解除封鎖，然後雙擊 install.command。
   如果還是被擋，也可以：
   方法 A：在 install.command 上按右鍵（或 control＋點按）→「打開」→「打開」。
   方法 B：到「系統設定 → 隱私權與安全性」，在下方找到 install.command 的訊息，按「強制打開」。
   方法 C：打開「終端機」，輸入 bash 和一個空格，把 install.command 拖進視窗，按 return。
3. 安裝完成後，桌面會出現「工作生活規劃」啟動檔。

【每天使用】
雙擊桌面的「工作生活規劃」，瀏覽器會自動打開 http://localhost:5858/
使用期間會有一個終端機視窗，關掉它就是結束程式。

【更新】
雙擊 update.command，會從 GitHub 下載最新版。你的資料（data 資料夾）不會受影響。
第一次更新時，如果 GitHub 專案是私有的，會請你貼上一組唯讀權杖（畫面上有步驟）。

【備份】
- 每天第一次開啟時，會自動備份整個資料庫到 data/snapshots（保留 14 天）。
- 每次更新資料庫結構前，也會先備份一份（檔名有「升級前」）。
- 但這些都在同一台電腦。請定期在 App 的「設定 → 匯出／匯入」下載備份，
  存到隨身碟或 iCloud 雲碟。

【搬到新電腦】
在新電腦安裝後，用 App 的「設定 → 匯出／匯入」匯入備份檔；
或關掉程式後，把整個 data 資料夾複製到新電腦的同一位置。

【從自動快照還原】
1. 關掉程式的終端機視窗。
2. 打開「終端機」，輸入 cd 和一個空格，把 WorkLifePlanner 資料夾拖進視窗，按 return，再輸入：
   ./.local/node/bin/node local/server.mjs --restore-snapshot data/snapshots/檔名.tar.gz
   （目前的資料會先移到 data/pgdata-還原前-… 保留）
