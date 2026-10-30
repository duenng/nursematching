# TRL 3 電郵及人手轉帳流程

目前使用者決定：**電郵先行，沒有 Stripe／FPS 接駁；客人人手銀行轉帳，同事查銀行入帳後確認收款，再派單**。本版本按這項決定調整附件 v3：補齊「切片＋加做」的實驗流程及人工分支，提供可重跑的驗證台。TRL 3 的正式認定取決於申請要求及實驗證據，程式不會自行宣告認證完成。

## 人手銀行轉帳設定（最新）

付款路線已加入 `PAYMENT_MODE=bank_transfer`，不需要 FPS 或銀行 API。管理員在銀行系統查核入帳後，再於工作台確認；客人提交資料不會自行轉成已付款，系統也不會替任何人轉帳。退款同樣須先批核，再由同事到銀行轉帳及記錄。

```dotenv
PAYMENT_MODE=bank_transfer
BANK_NAME=
BANK_ACCOUNT_NAME=
BANK_ACCOUNT_NUMBER=
```

三項銀行資料由團隊提供，未有戶口時可留空。未填齊會阻止接受單次／新套餐付款預約，不發空白付款指示；現有套餐預留不涉及新付款。銀行資料只放進付款指示電郵，不會因這個設定公開在查詢首頁。填妥後須重新啟動。

此模式只能使用自然時間（`time_scale=1`，沒有虛擬時鐘偏移）。舊實驗資料庫若已用虛擬時間，請另用獨立 `WORKFLOW_DB`；不要把加速實驗當實際收款。Gmail 收件 allowlist 及 Google 角色設定仍須完成。登入、部署及臨床流程的待辦仍見 [差距報告](WORKFLOW_V3_GAPS.md)；付款路線改動不代表整個平台已正式上線。

## 保留的舊付款回歸測試流程（非部署付款模式）

以下 `fps_test`／舊 `report_fps` action 只保留作既有回歸測試，並非目前選定的銀行轉帳模式；部署時使用 `PAYMENT_MODE=bank_transfer`。

1. Node.js 22.16+，`npm install`、`npm run dev`，打開 `http://localhost:5173/#staff/email`。Google 模式下先登入；見 [職員登入設定](STAFF_LOGIN.md)。家屬直接用 `/#enquire` 填表，首頁亦有電郵測試查詢連結。
2. 展開「測試設定及管理員連線」，填入本次實驗護士時薪。按「選取完整實驗組合」，檢視並確認儲存。未確認的草稿政策預設停用，只有管理員明確儲存才會啟用；這不代表正式商業政策已確認。
3. 填完整虛構查詢、護理選項、偏好時間及 PRN；先開資料確認頁，再提交。20 種服務選項對應附件；胃造口換喉等未確認分類交人手。
4. 偏遠名單無相符記錄時，個案轉 `MANUAL`；展開人工操作，填原因、覆核 A／B／C 及津貼，再按「人工處理後發報價」。附件 B 的來源檔未提供，不能憑空匯入完整名單。驗收頁支援匯入已核對的版本化 JSON 名單。C12 長洲是明示的測試 fixture。
5. 到收件箱開 T1 報價，接受單次或套餐；新頁 GET 只顯示，POST 確認才生效。一次選擇後其餘報價連結作廢。
6. 客人收到 T8／T8b 的 **銀行轉帳資料及提交連結**。客人自行轉帳後填參考編號；提交後仍是 `PENDING_PAY`，不能派單。
7. 管理員在轉帳對數區選聲明，獨立填銀行入帳參考、金額、時間、核對說明，勾選已核實。全額一致且入帳參考未重用才轉 `PAID`。客人自己填的金額及編號不是收款證據。
8. 預覽及派單 T3 → N01–N04 的個人連結；第一個有效確認得標。N05 未核實不能接單；時段衝突被拒；同時十個 HTTP 請求只能一人得標。
9. 家屬經 T16 提供單位。Google 模式由資深護士帳戶覆核、管理員帳戶最終確認。時間表：規則草稿 → 資深護士核對（可記錄人工修改或醫生指示失敗）→ Yi 確認；只有配對＋地址＋時間表三條件齊才寄 T11 給得標護士，轉 `READY`。
10. T11 的「已到達」在服務開始後轉 `IN_SERVICE`；服務結束後「完成」轉 `DONE`，套餐只扣一次，建立待付護士薪酬紀錄，不實際轉帳。

舊病人網站與原有協調工作區保留瀏覽器示範資料，與這個伺服器實驗資料集分開；原有 mock 沙盒及 `fps_test` 不作銀行入帳證據。完整伺服器驗證從新入口操作。

## 其他已實作流程

- 報價 24h 提醒，再 24h 失效（實驗設定）；12h 付款提醒；24h 無轉帳聲明取消。
- **轉帳期限處理的新路線假設**：期限前有轉帳聲明但仍未核對，保留待付款並警示管理員；不視為付款、不派單、不自動取消可能已付款個案。期限內實際入帳可在稍後對數；逾期入帳交人手。這項保守實驗處理不是附件原有 Stripe 規則。
- 轉帳對數不符：標記聲明 `REJECTED`；期限前可重新提交，期限後取消並提醒如已轉帳應聯絡核對。部分付款不自動當全額收款。
- 派單 24h 無人：客人 T7 一次、管理員 T14b；按設定重發。之後只警示管理員。服務開始無人預設人工處理。
- 單位 12h 追問、服務前資料未齊警示；定時項目前 10 分鐘 T12、未確認一小時 T13、再 15 分鐘管理員警示（設定啟用）；PRN 不提醒。
- 護士放飛：記次數及原因、舊接單／服務／提醒連結作廢，T19／T21 重新招募。原護士不再接同一單；新護士沿用確認版時間表及地址。24h 無人轉待退款；不足服務前 24h 放飛交人手。
- 三次放飛先 `SUSPENDED`，由管理員另行批核 `BLACKLISTED`，不是直接永久封鎖。
- 客人 ≥24h 取消轉 `FULL_REFUND` 待批核，通知護士不用上門；<24h、未配對取消、服務開始後取消及改期交人手，不自創取消費或 credit 規則。
- **銀行轉帳退款分兩步**：管理員批核 → 人手實際轉帳後填退款參考、金額、時間並確認 → `CANCELLED`。按批核本身不代表已退款。實驗只填虛構轉帳。
- 已付款個案因醫生指示失敗、改期或其他原因轉人工，可由管理員填原因提出退款，再走獨立批核及 銀行轉帳退款紀錄；套餐只放回預留。人工決定取消亦通知已配對護士不用上門，不會重新發收款報價。
- 套餐：30h／HK$8,650、新購及同病人現有套餐；預留時數防超賣；服務完成才扣；低餘額 ≤4h 通知一次、0h 用完通知；取消釋放預留（需實驗政策啟用）。夜間／假期／不足時數／跨病人不自動套用。套餐預約取消只釋放時數，不把整個有效套餐當現金退回。
- JSON 備份、CSV 事件匯出、驗收觀察追加、寄件狀態及人工收件確認、T1–T30／X 範圍清單。

## Gmail／Google Workspace 設定

複製 `.env.example` 至 `.env`；檔案已列入 `.gitignore`。只在本機填密碼，不在對話貼密鑰。

```dotenv
BASE_URL=http://localhost:5173
PAYMENT_MODE=bank_transfer
BANK_NAME=
BANK_ACCOUNT_NAME=
BANK_ACCOUNT_NUMBER=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-team-test-account@gmail.com
SMTP_PASS=your-google-app-password
SMTP_FROM="上門護理配對（測試） <your-team-test-account@gmail.com>"
TEST_EMAIL_ALLOWLIST=your-team-test-account@gmail.com,teammate@example.com
ENABLE_TEST_CLOCK=false
```

Gmail SMTP 使用 Google **應用程式密碼**，不是一般登入密碼。帳戶須啟用兩步驗證；Workspace 管理政策、進階保護等可能令此功能不可用。若管理員禁止 SMTP／應用程式密碼，需改用獲准郵件服務或另接 OAuth，職員 Google 登入另有提供，但寄信 adapter 尚未支援 Gmail OAuth。

在驗證台將家屬、N01–N05、管理員電郵改成團隊控制的測試地址，而且每個地址都必須在 `TEST_EMAIL_ALLOWLIST`。可使用同一個受控帳戶的不同有效別名協助辨識角色；資格由 token 綁定 N01–N05，不以電郵字串決定。

重新啟動後，新電郵會透過 SMTP 發出。未設定 SMTP 時 `captured` 僅是本機收件箱；`sent` 只代表 SMTP 接受。實際收件後，管理員另按人工收件確認並在驗收頁填截圖代號。失敗顯示 `failed`／`blocked`／`delivery_unknown`，不自行宣稱送達。

`BASE_URL` 必須是測試參加者可開啟的網址。localhost 連結只在同一部電腦可用；遠端測試部署 HTTPS 並設定正確網域。真實 SMTP、銀行入帳或外部收件結果未在這次程式工作中驗證，也沒有寄出外部郵件。

## 實驗時鐘及證據

`time_scale=60`：一小時當一分鐘；紀錄每項實驗倍率。`time_scale=1` 才是自然時間。真實 24h 無人／逾時實驗需伺服器持續運行，再保存前後時間及收件證據。

本機需要即時測試服務日，可設定 `ENABLE_TEST_CLOCK=true`；只有停用 SMTP 及非 Stripe／銀行轉帳模式可使用虛擬時鐘，介面顯示醒目標記，事件記 `VIRTUAL_NOT_WALL_TIME`。向前推進不能當作真正經過 24h。使用虛擬時鐘後，應以另一個獨立 `WORKFLOW_DB` 做自然時間／SMTP 實驗。

程式測試：

```sh
npm run build
npm run test:workflow
npm test
```

`server/` 測試覆蓋計價、一次性 token、並發、套餐、重新配對、取消退款、銀行轉帳對數及邊界。瀏覽器測試使用獨立資料庫、5180／3002 ports，完整跑人手銀行轉帳套餐至完成扣時，不污染使用者的本機實驗資料。現時 workflow 46／46、browser 24／24 通過；參閱 [驗收對照表](TRL3_ACCEPTANCE.md)。

證據頁允許追加 PASS／FAIL／PENDING、觀察條件及截圖代號；這是管理員記錄，不是系統自動驗收或認證。事件 CSV 不包含原始 token、病人姓名、電話、單位或銀行轉帳參考。完整 JSON 備份包含受控測試個案及動作連結，不能當公開報告分享。

## 架構及部署

Node.js＋SQLite，單程序同步狀態轉換、整次操作成功才保存；失敗回滾。事件、套餐 ledger 由程式追加。資料庫不是防竄改帳本，亦不是正式多租戶醫療資料庫。

`npm start` 提供 API、確認頁及每分鐘 worker，預設 3000；`npm run preview` 只有靜態頁。前後端分開時，Dokploy backend 設定 `PORT=3000`、`BASE_URL=https://api.example.com`、`FRONTEND_URL=https://care.example.com`、`CORS_ORIGINS=https://care.example.com`、`AUTH_MODE=google` 及 OAuth／角色名單，並掛載持久化 volume `/app/data`，只可一個 replica。Cloudflare Pages frontend 使用 `npm run build`、輸出 `dist`，並設定 `VITE_API_BASE_URL=https://api.example.com`。沒有管理員金鑰時只容許 localhost 管理。Google 登入模式提供管理員／資深護士獨立角色；本機／共用金鑰演練不作獨立身份證據。詳見 [職員登入及權限](STAFF_LOGIN.md)。

目前沒有 live AI；草稿是依原有項目及時間做確定性整理。不得把這次測試描述成 AI 臨床能力驗證。正式 TRL 判準須與申請方確認。多次上門／跨日間夜間組合目前需分開查詢或人手處理；醫生指示可透過付款通知連結上載虛構 PDF／PNG／JPEG（最多 2 MB）；護士下載檢閱並記錄文件 ID、SHA-256、覆核說明。Google 模式需確認此文件版本先可完成護士覆核；不會自動判斷文件內容。

附件原文保存在 [參考草稿](reference/workflow-v3-email-draft.md)，只作可追查資料。WhatsApp／SMS、真收款／真退款、入職全流程 T25／T26、正式改期 credit、遲到判定、套餐過期等依文件留待後續或交人手。Stripe adapter 及 FPS 回歸路線只作未來／測試用途，當前銀行轉帳路線無需相關帳戶或密鑰。
