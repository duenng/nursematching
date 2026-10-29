# 職員 Google 登入及分權

本機未填憑證時可繼續演練；部署供團隊測試時，使用 Google OAuth 職員登入。此功能保護伺服器電郵驗證流程；原有瀏覽器病人／協調示範仍只用虛構本機資料，並非正式會員系統。

## Google 設定

1. 在 Google Cloud／Google Auth Platform 建立 OAuth 專案、同意畫面及 **Web application** 用戶端。只要求 `openid email profile`。外部應用處於測試狀態時，把測試職員加入 Google 的 test users；Workspace 亦須符合管理員政策。
2. Authorized redirect URI 精確填 `http://localhost:5173/auth/google/callback`（本機開發）。`npm start` 用 3000 時改成 `http://localhost:3000/auth/google/callback`。遠端則為 `https://你的測試網域/auth/google/callback`；不可把 `/#staff` 放進 callback。
3. `.env` 填下列設定，重新啟動；OAuth 憑證只放本機／部署環境，切勿加入版本控制。

```dotenv
BASE_URL=http://localhost:5173
AUTH_MODE=google
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
STAFF_ADMIN_EMAILS=administrator@example.com
STAFF_SENIOR_NURSE_EMAILS=senior-nurse@example.com
```

兩類角色用不同帳戶；名單以逗號分隔。名單重疊或缺必要設定會拒絕啟動。移除帳戶並重新啟動即可撤銷其存取權；登入工作階段最長八小時。切換角色須先登出再選另一個獲准 Google 帳戶。

入口：`/#staff/email`。登入後返回同一工作台。家屬查詢入口：`/#enquire`，不需要登入；家屬及接單護士經電郵的一次性連結操作。

所有 `#staff` 路徑會先向伺服器核實工作階段，未登入時只顯示獨立登入頁；側邊欄、搜尋、通知、個案數目及職員頁面不會掛載。載入中或登入服務故障亦不顯示職員介面。登出、工作階段到期、API 回報失效或定期／返回頁面核實失敗時，會收起整個介面。此介面閘門配合下述 API 授權；隱藏公開入口本身不構成存取控制。

Google OAuth 登入和 Gmail SMTP 是兩套設定。登入不會授權讀取 Gmail 或代寄信；寄信仍使用 [Gmail SMTP 設定](TRL3_EMAIL.md)。沒有接入 Google 實際帳戶前，只能聲稱登入流程程式測試通過。

## 權限

| 角色           | 可操作                                                                         | 資料範圍                                                               |
| -------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 管理員         | 實驗設定、查詢轉錄、地點覆核、銀行轉帳對數、派更、最終時間表批核、退款、驗收與匯出 | 受控完整實驗資料                                                       |
| 資深護士       | 時間表草稿、修改、護士覆核、醫生指示核對失敗                                   | 病人代號及護理資料；不回傳家屬聯絡、單位、付款紀錄、任何家屬／接單連結 |
| 家屬／接單護士 | 自己電郵連結綁定的操作                                                         | 確認頁所需資料                                                         |

Google 模式下管理員不可代按資深護士覆核；資深護士不可對數、退款或最終批核。最終批核要求先由另一位、經 Google 登入的護士覆核。舊本機演練覆核須在護士工作台重新修改／覆核，才能作 Google 模式最終批核。

`AUTH_MODE=local` 只用於原型演練：設定 `WORKFLOW_ADMIN_KEY` 可用共用金鑰；未設定只准 loopback。這些操作分別標 `SHARED-ADMIN-KEY`／`LOCAL-REHEARSAL`，不能當作個人登入及獨立覆核證據。Google 模式完全停用共用金鑰及 loopback 替代登入。

## 驗證及資料

程式使用 Google 官方 Node 驗證程式庫核實 ID token 簽署、audience、issuer 及到期，再檢查 verified email、nonce、職員名單與 Google subject。授權碼配合 PKCE、state 及瀏覽器 cookie 綁定。驗證時鐘使用自然時間，與 TRL 虛擬時鐘分開。

工作階段存 SQLite 的獨立表；瀏覽器只有 HttpOnly、SameSite=Lax cookie，HTTPS 下加 Secure。資料庫只保存工作階段 token 雜湊，登出即撤銷。寫入 API 需正確來源及 CSRF token；伺服器每次檢查角色，並非只隱藏按鈕。

職員電郵及 Google subject 留在受控登入資料表；事件 CSV 使用穩定職員代號、角色及登入方式。完整 SQLite 備份包含登入資料，須限制存取；工作台 JSON 匯出不包含登入工作階段或文件二進位內容；文件存同一 SQLite 的獨立表，須一併受控備份。工作階段及待登入紀錄過期後於開始登入時清理。

測試：`server/auth.test.mjs`、`server/auth-http.test.mjs`、`tests/staff-auth.spec.ts`。HTTP 測試用獨立資料庫的工作階段 fixture，瀏覽器角色測試用攔截回應；應用沒有測試登入後門。簽署測試使用本機產生的 RSA fixture，不能當 Google 真實登入證據。

實際 Google 登入、雙帳戶試用、Gmail 收件及自然時間 24h 實驗仍須由團隊執行並記錄。
