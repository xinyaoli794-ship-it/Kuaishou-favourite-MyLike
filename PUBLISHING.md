# 发布到 GitHub：完整步骤

这份文档写给「不想研究 Git」的人：照着做，每一步都有命令和预期结果。
命令都在 **PowerShell** 里执行（Win + X → 终端）。

---

## 0. 上传前检查（很重要）

| 检查项 | 说明 |
|---|---|
| `.real-data/` | **含你的快手登录 Cookie**，绝对不要提交。已在 `.gitignore` 里排除 |
| `node_modules/`、`dist/`、`out/` | 体积巨大，已排除 |
| `shots-electron/*.png` | 截图里是你赞过的内容（都是公开视频），介意的话删掉再传 |
| `LICENSE`、`NOTICE.md`、`DISCLAIMER.md` | 必须保留：这是 MIT 授权和免责声明 |

确认命令：

```powershell
cd C:\Users\Lenovo\Documents\deepseek-harness\default-workspace\kuaishou-mylike
git status --short
```

正常应该只看到源码、文档、截图、配置文件的改动，**看不到** `.real-data`、`node_modules`、`dist`。

---

## 1. 安装 Git

三选一，推荐第一种。

### 方式 A：winget（最快）

```powershell
winget install --id Git.Git -e --source winget
```

装完**关掉终端重新打开**，验证：

```powershell
git --version
# 期望输出：git version 2.x.x
```

### 方式 B：官网安装包

打开 https://git-scm.com/download/win ，下载 64-bit 安装包，一路「下一步」即可。

### 方式 C：GitHub Desktop（纯图形界面，自带 Git）

打开 https://desktop.github.com/ 下载安装。装完可以完全用鼠标操作，
本文件第 4 步之后的命令都可以跳过，直接在软件里点 Publish repository。

---

## 2. 告诉 Git 你是谁

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

> 建议用 GitHub 提供的隐私邮箱（Settings → Emails → Keep my email addresses private），
> 形如 `12345678+用户名@users.noreply.github.com`，避免真实邮箱被公开。

---

## 3. 把本地目录变成仓库

如果我已经帮你初始化过（目录里已有 `.git`），跳过本步。

```powershell
cd C:\Users\Lenovo\Documents\deepseek-harness\default-workspace\kuaishou-mylike
git init -b main
git add .
git status          # 再检查一遍，确认没有敏感目录
git commit -m "feat: MyLike 快手版，复刻抖音版界面并接入快手赞过采集"
```

---

## 4. 在 GitHub 上创建仓库

1. 打开 https://github.com ，登录
2. 右上角 `+` → **New repository**
3. 填写：
   - **Repository name**：`kuaishou-mylike`
   - **Description**：`整理、搜索和回看快手「赞过」的 Windows 桌面应用（Electron + React + TypeScript）`
   - 选择 **Public**
   - **不要**勾选 Add a README file / Add .gitignore / Choose a license（本地已经有了）
4. 点 **Create repository**
5. 复制页面上显示的地址，形如：
   `https://github.com/你的用户名/kuaishou-mylike.git`

---

## 5. 关联并推送

```powershell
git remote add origin https://github.com/你的用户名/kuaishou-mylike.git
git push -u origin main
```

### 第一次推送会要求登录

GitHub 从 2021 年起**不接受账号密码**，要用 Token：

1. GitHub → 右上角头像 → **Settings**
2. 左侧最下 → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
4. Note 随便写（如 `mylike-push`），Expiration 选 90 天
5. 勾选 **repo** 这一整个大项
6. 点 **Generate token**，复制生成的字符串（只显示一次，务必存好）
7. 回到终端，`push` 时：
   - Username：你的 GitHub 用户名
   - Password：**粘贴刚才的 token**（不是账号密码）

Windows 会弹窗问是否保存凭据，选「Git Credential Manager」即可，以后不用再输。

### 如果公司/学校网络推不上去

```powershell
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
```

端口按你自己的代理软件改；取消代理：

```powershell
git config --global --unset http.proxy
git config --global --unset https.proxy
```

---

## 5.5 只用网页上传（不想碰命令行就看这里）

GitHub 网页本身就能上传文件，不需要 Git、不需要 token。

**准备**：我已经把「只该上传的文件」整理到
`C:\Users\Lenovo\Documents\deepseek-harness\default-workspace\kuaishou-mylike-上传`
这个文件夹里（142 个文件，16.9MB，不含 `.git`、`node_modules`、`dist`、登录数据）。
**只从这个文件夹拖文件**，不要从原项目文件夹拖。

**操作**：

1. 按第 4 步在网页上建好空仓库
2. 进入仓库页，点 **Add file** → **Upload files**
3. **第一批**：打开 `kuaishou-mylike-上传`，把 `src` 文件夹拖进网页
   （会自动展开成 88 个文件，保留目录结构）
4. 页面下方 **Commit changes** 提交
5. 点回仓库首页，再次 **Add file** → **Upload files**
6. **第二批**：把剩下的全部拖进去 —— `assets`、`public`、`shots`、`shots-electron`、`tools`
   五个文件夹，加上根目录的 `README.md`、`LICENSE`、`NOTICE.md`、`DISCLAIMER.md`、
   `PUBLISHING.md`、`package.json`、`package-lock.json`、`tsconfig.json`、
   `vite.config.ts`、`electron.vite.config.ts`、`electron-builder.yml`、`.gitignore`
7. 再点 **Commit changes**

**为什么要分两批**：GitHub 网页一次最多接受 100 个文件；`src` 有 88 个，剩下的有 54 个。

**注意**：

- 单个文件上限 25MB（本项目最大的视频素材约 1.1MB，没问题）
- 拖文件夹时保持目录结构，不要一个个单独拖散
- `.gitignore` 是隐藏文件，Windows 资源管理器要先勾选「显示隐藏的项目」才能看到；
  漏了也不影响运行，只是以后用命令行的人会少一层保护
- 别拖 `.git`、`node_modules`、`dist`、`out`、`.real-data` —— 这些都不在整理好的文件夹里

---

## 6. 常见问题

| 现象 | 原因与解决 |
|---|---|
| `src refspec main does not match any` | 还没有提交：先 `git add .` 和 `git commit` |
| `remote origin already exists` | 已经加过：`git remote set-url origin 新地址` |
| `Authentication failed` | 密码位置必须填 **token**，不是账号密码 |
| `file is 159 MB; this exceeds GitHub's file size limit of 100 MB` | 说明 `dist/` 被加进来了：`git rm -r --cached dist` 后重新提交 |
| 推送卡住 / 超时 | 用上面的代理配置，或换网络 |
| 中文文件名显示成乱码 | `git config --global core.quotepath false` |
| 每次都要输密码 | 安装 Git Credential Manager（Git for Windows 自带，默认勾选） |

---

## 7. 发布一个可下载的版本（可选）

exe 体积 159MB，**不要**放进仓库；用 Release 附件：

1. 仓库页面右侧 → **Releases** → **Draft a new release**
2. **Choose a tag** 输入 `v0.1.0` → 点 `Create new tag`
3. Title 写 `v0.1.0 首个可用版本`
4. 描述里写清楚：支持扫码登录、采集赞过、本地回看；收藏与取消点赞未接入
5. 把 `dist\MyLike-Kuaishou-0.1.0-win-x64.zip` 拖进附件区
6. 点 **Publish release**

> Release 单个附件上限 2GB，159MB 没问题；但仓库本身仍然禁止 >100MB 的文件。

---

## 8. 以后改了代码怎么更新

```powershell
cd C:\Users\Lenovo\Documents\deepseek-harness\default-workspace\kuaishou-mylike
git add -A
git commit -m "fix: 说明这次改了什么"
git push
```

---

## 9. 仓库设置建议

进入仓库 **Settings**：

- **About**（右上角齿轮）：填 Description，Topics 建议
  `electron` `react` `typescript` `kuaishou` `desktop-app` `sqlite`
- **License**：GitHub 会自动识别 MIT
- **Features**：Issues 建议保留，Wiki/Projects 可以关掉
- **Security**：永远不要把 token、Cookie 写进代码或 Issue

---

## 10. 一键复制版

把 `<你的用户名>` 换成你的，然后整段粘贴：

```powershell
cd C:\Users\Lenovo\Documents\deepseek-harness\default-workspace\kuaishou-mylike
git init -b main
git add .
git status
git commit -m "feat: MyLike 快手版，复刻抖音版界面并接入快手赞过采集"
git remote add origin https://github.com/<你的用户名>/kuaishou-mylike.git
git push -u origin main
```

---

## 附：这个仓库里都有什么

```
README.md          项目介绍、截图、怎么运行
DISCLAIMER.md      免责声明（使用边界、账号风险、版权）
NOTICE.md          上游项目出处与 MIT 归属
LICENSE            MIT 许可证
src/               源码（Electron 主进程 + React 界面 + 快手引擎）
shots/             浏览器版截图
shots-electron/    桌面版真实采集截图
tools/             构建、截图、端到端脚本
```

上传完成后，建议在 README 顶部补一行仓库地址，方便别人点 Star。
