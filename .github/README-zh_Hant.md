# Moonlit Echoes Theme for SillyBunny

[English](../README.md)｜**繁體中文**

> [!IMPORTANT]
> 這是 [RivelleDays/SillyTavern-MoonlitEchoesTheme](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme) 的 **SillyBunny 專用分支**，僅供 SillyBunny 使用。原版 SillyTavern 請安裝上游專案。
> 此分支由 **purachina** 維護；分支問題與 SillyBunny 相容性回報請提交至[本專案的 Issues](https://github.com/SillyBunnyTeam/SillyBunny-MoonlitEchoesTheme/issues)。

我將此分支維持為獨立的第三方擴充。導覽、訊息輸入欄尺寸與聊天版面由 SillyBunny 負責，Moonlit 提供主題外觀。一般主題功能不需要修改 SillyBunny 核心；下方的選用安裝工具則需要主程式支援新的路由。

以下保留 Rivelle 的原版 SillyTavern 預覽；本分支的 SillyBunny 截圖請見[英文頁面](../README.md#screenshots)。

![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/visual_novel_mode.png)

**「Moonlit Echoes 月下回聲」** 是 Rivelle 為 SillyTavern 製作的介面主題。此分支將其適配至 SillyBunny，保留原作的桌面與行動裝置主題外觀。

Rivelle 最初於 2024 年 11 月 25 日在 SillyTavern Discord 伺服器公開 Moonlit Echoes，後來將它製作為擴充功能並於 GitHub 開源。我負責此分支的 SillyBunny 適配，原作與作者署名仍屬於 Rivelle。

| UI Interface | System Messages |
|----------------------|-------------------|
| <img src="https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/ui_overview.png"> | <img src="https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/system_messages.png"> |

## 功能與特色

### 核心功能
- **多種訊息樣式**：Flat、Bubble、Document、Echo、Whisper、Hush、Ripple 與 Tide 均為 SillyBunny 原生版面。Moonlit 提供外觀樣式，版面選擇與儲存由 SillyBunny 負責。
- **桌面與行動裝置**：兩者皆有主題配色與外觀設定。標示「舊版」的選項不會取代 SillyBunny 原生的訊息輸入欄或導覽尺寸設定。
  
### Moonlit Echoes 主題預設設定檔
你可以分享 Moonlit 配色預設，並與同名的 SillyBunny UI 主題同步。兩者格式不同，請分別匯入各自的選單。

此分支附帶 [SillyBunny Regex Agent Themes](https://github.com/SillyBunnyTeam/SillyBunny-Regex-Agent-Themes) 的 78 組配色預設，其中 75 組固定配色有對應的 UI 主題，另外 3 組自適應配色跟隨目前的 SillyBunny 顏色。預設只會自動加入一次，不會取代目前使用的預設或同名項目；刪除後也不會在下次啟動時重新加入。

使用預設工具列的調色盤按鈕安裝缺少的 UI 主題，圖片按鈕則安裝 158 張隨附背景。同名檔案會略過，不會覆寫；安裝後請重新載入 SillyBunny。若要覆寫同名的隨附 UI 主題，請使用下方的「重新安裝 / 更新隨附 UI 主題」按鈕並確認。背景預設不會隨配色切換，除非你勾選「切換預設時使用對應的場景背景」。

這兩個選用的安全安裝工具需要主程式支援 `POST /api/themes/create` 與 `POST /api/backgrounds/upload-new`。相關主程式變更尚未合併，更新此擴充不會新增這些路由。檔名已存在時會略過 HTTP 409 回應；舊版主程式若回傳 HTTP 404，安裝會安全停止，不會改用覆寫路由。「重新安裝 / 更新隨附 UI 主題」仍會在你確認後使用 `POST /api/themes/save`。沒有新路由也能正常使用主題，或手動匯入檔案。

<img src="https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/moonlit_theme_presets.png" width="500">

## 螢幕截圖
以下是 Rivelle 的上游 **2.5.0** 截圖，在使用 Chrome 的 MacBook 上截取，展示當時新增的 **「微光 (Glimmer)」** 主題，不代表此分支新增了原生聊天版面。

若要更新本分支的截圖，請依照[截圖工具說明](../README.md#refreshing-the-screenshots)，只使用獨立、可拋棄且沒有私人資料的測試帳號。工具需要 `--disposable-test-profile` 確認旗標，會更改主題設定並寫入 PNG；旗標無法判斷帳號是否真的可拋棄。暫時的系統訊息只顯示在頁面，不會加入聊天紀錄。

![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/1chatstyle_flat.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/2chatstyle_bubble.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/3chatstyle_document.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/4chatstyle_echo.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/5chatstyle_whisper.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/6chatstyle_hush.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/7chatstyle_ripple.png)
![](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/main/.github/ImagePreview/8chatstyle_tide.png)

## 安裝說明

### 前提條件
建議使用 **最新版 SillyBunny** 與 Chrome 瀏覽器。原版 SillyTavern 請改用上游 Moonlit Echoes。

### 安裝步驟

#### 1. 安裝 SillyBunny 專用分支
在 **SillyBunny 擴充管理器**中，點選「安裝擴充功能（Install from URL）」，貼入以下 Git URL：
```
https://github.com/SillyBunnyTeam/SillyBunny-MoonlitEchoesTheme
```

#### 2. 更新 `/SillyBunny/config.yaml` 的縮圖設定
雖然先前建議直接禁用縮圖功能，但這可能會影響行動裝置的圖片載入速度。以下是目前推薦並經過測試的設定：
```
 thumbnails:
    enabled: true
    format: png
    quality: 100
    dimensions:
      bg:
        - 240
        - 135
      avatar:
        - 864
        - 1280
```
建議在應用設定前刪除整個縮圖資料夾（通常位於 `/SillyBunny/data/default-user/thumbnails`）。SillyBunny 會在重新啟動後自動產生新的縮圖。

#### 3. 下載並啟用主題（強烈建議！）
安裝後即可使用月下回聲主題擴充。不過，若想重現預覽圖中的畫面，建議下載 Rivelle 的 **「Glimmer（微光）」** 主題設定檔並匯入 SillyBunny 使用者設定中。
特別推薦 2.5.0 版本中新增的 **「微光（Glimmer）」** 主題。這個主題是專為本次發布設計的——極簡、通用，非常適合在晚上用手機躲在被窩裡使用。

你可以在 GitHub 主題（theme）文件夾中找到它，或直接透過連結下載：
- [Glimmer - by Rivelle.json](https://github.com/SillyBunnyTeam/SillyBunny-MoonlitEchoesTheme/blob/main/theme/Glimmer%20-%20by%20Rivelle.json) → 用於 SillyBunny 使用者設定（User Settings）
- [[Moonlit] Glimmer - by Rivelle.json](https://github.com/SillyBunnyTeam/SillyBunny-MoonlitEchoesTheme/blob/main/theme/%5BMoonlit%5D%20Glimmer%20-%20by%20Rivelle.json) → 用於月下回聲主題預設（Moonlit Echoes Theme Presets）

不用修改檔名，匯入後即可使用。Rivelle 原版的「Glimmer」與「Moonlit Echoes」UI 匯出檔仍含有 `chat_display: 0`，匯入會切回 Flat；自動產生的 Regex Agent 配色檔則不會更改聊天版面。

### 上游 SillyTavern / Termux 說明
此分支只供 SillyBunny 使用。若你透過 Termux 使用原版 SillyTavern，請安裝[上游專案](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme)。以下保留原版 SillyTavern 的 `config.yaml` 修改方法。

> [!Warning]
> 我對 Android 設備或 Termux 沒有經驗，因此無法解答相關問題、測試步驟或保證結果。以下方法由其他使用者提供。

> [!NOTE]
> SillyTavern 資料夾內可能會有兩個 `config.yaml` 檔案。請務必編輯 ST 根目錄 下的 `/SillyTavern/config.yaml`。**請勿修改** `/SillyTavern/default/config.yaml` 或 default 資料夾內的任何內容。

### 方法 1：透過 Termux 編輯
1. 打開 Termux，輸入：`cd SillyTavern`
2. 接著輸入並執行：`nano config.yaml` 以編輯檔案
### 方法 2：使用 Material Files（Android 檔案管理器）
1. 開啟 Material Files > 新增儲存空間 > 前往 Termux > SillyTavern
2. 打開 SillyTavern 資料夾，直接編輯 `config.yaml`

# 使用指南

## 如何使用月下回聲主題預設？
擴充啟用時，月下回聲預設可以與同名的 SillyBunny UI 主題同步。兩者格式仍然獨立；切換或匯入 Moonlit 預設不會建立原生 UI 主題檔案。選用的安裝按鈕會建立缺少的隨附 UI 主題，「重新安裝 / 更新隨附 UI 主題」則可在確認後覆寫同名檔案。

### 匯入與匯出
- Moonlit Echoes 主題預設設定檔的檔案名稱格式為 `[Moonlit] 預設名稱.json`（如：`[Moonlit] Honey Cream.json`）。`[Moonlit]` 之後有一個半形空格
- 這不會影響功能，你 **「不需要」** 在匯入前移除 `[Moonlit] `前綴，只需直接匯入文件即可
- 若匯入的預設未與 SillyBunny 的 UI 主題同步，請重新載入頁面或選擇其他主題來套用變更

## 常見問題

### Ｑ：介面損壞、跑版或與不兼容其他擴充？
**Ａ：** 是的，儘管我盡了最大努力，但我無法保證與每個第三方 SillyTavern 擴充完全兼容。如果你遇到任何問題，請依序嘗試以下排除方式：

1. 確保你使用的是最新版本的 SillyBunny 和最新版本的 Chrome。
2. 暫時禁用此主題擴充，檢查是否是它造成的問題。如果是——或者你使用的第三方擴充尚未得到支持——隨時歡迎回報！

月下回聲是第三方主題擴充，與官方 SillyTavern 項目無關。它是源於對 SillyTavern 的熱愛和對視覺設計的強烈偏好的個人項目。如果你遇到任何問題，請先聯繫我——我會盡力提供協助！

### Ｑ：在預覽圖片中使用了哪些其他擴充？
**Ａ：** 以下是我強烈推薦並確認與月下回聲完全兼容的擴充：
- **[SillyTavern / Extension-TopInfoBar](https://github.com/SillyTavern/Extension-TopInfoBar)**：官方擴充。支援快速切換聊天、搜尋訊息關鍵字、顯示目前的連線設定⋯我的最愛——強烈推薦！
- **[SillyTavern / Extension-QuickPersona](https://github.com/SillyTavern/Extension-QuickPersona)**：官方擴充。從聊天輸入區域輕鬆切換角色，帶有時尚的視覺提示。
- **[SillyTavern / Extension-TypingIndicator](https://github.com/SillyTavern/Extension-TypingIndicator)**：官方擴充。在角色回應時顯示可愛的 `{{char}} 正在輸入...` 指示器。
- **[zerofata / SillyTavern-Dialogue-Colorizer-Plus](https://github.com/zerofata/SillyTavern-Dialogue-Colorizer-Plus)**：原始 [SillyTavern-Dialogue-Colorizer](https://github.com/XanadusWorks/SillyTavern-Dialogue-Colorizer) 的分支，改進了自定義角色對話顏色的變數支持。
- **[qvink / SillyTavern-MessageSummarize](https://github.com/qvink/SillyTavern-MessageSummarize)**：進階版的聊天摘要功能，可為 LLM 模擬長期和短期記憶——非常強大且有用！
- **[LenAnderson / SillyTavern-MoreFlexibleContinues](https://github.com/LenAnderson/SillyTavern-MoreFlexibleContinues/)**：為繼續生成文本添加更多靈活性，並可快速進行切換。
- **[splitclover / rewrite-extension](https://github.com/splitclover/rewrite-extension)**：允許快速部分重寫和刪除訊息內容。

### Ｑ：使用月下回聲切換主題時出現延遲和卡頓？
**Ａ：** 是的，這是行動裝置上的已知問題，而我暫時束手無策。切換時，畫面可能會短暫凍結數秒，請耐心等待載入完成。此問題在桌面端幾乎不會出現。

# 回饋與建議
此 SillyBunny 分支的問題與功能建議，請使用範本回報至[本專案的 Issues](https://github.com/SillyBunnyTeam/SillyBunny-MoonlitEchoesTheme/issues)，由 purachina 處理。原版 SillyTavern 與上游主題的問題請回報至 Rivelle 的原專案。
歡迎在 Discussions 區分享配色方案！無論是 SillyTavern UI 主題還是 Moonlit Echoes 主題預設，我都很期待看到美麗的配色。

# 特別感謝
由衷感謝所有人一路上的幫助與喜愛。

- 感謝 ceruleandeep 在 SillyTavern Discord 群組的初期支援——這一切都是從你開始的。
- 特別感謝 IceFog72 鼓勵我製作 SillyTavern 主題，並開發了 [SillyTavern-CustomThemeStyleInputs](https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs)，這讓我在初期省去了許多麻煩。
- 感謝 Bronya-Rand 的開源貢獻，讓我從你的 SillyTavern 擴充 中學到了許多，並參考了功能排版設計。
- 感謝 vesper，我從你的自定義主題中得到了設計 Ripple 訊息風格的靈感。

最後，特別、特別感謝 Wolfsblvt 和 Cohee，為 SillyTavern 增加了 讓第三方擴充能夠使用 SillyTavern i18n（國際化系統） 的功能。這極大地改善了非英語使用者的體驗，真的非常感謝！

# 授權協議
AGPLv3
