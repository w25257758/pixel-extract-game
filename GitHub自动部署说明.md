# GitHub 自动部署配置

本目录已经初始化成 Git 仓库，并创建了第一次提交。

## 1. 推送源码到 GitHub

推荐使用 GitHub Desktop：

1. 安装并打开 GitHub Desktop
2. 登录 GitHub 账号
3. 点击 `File` → `Add local repository`
4. 选择目录：

   `C:\Users\86158\Documents\deepseek-harness\default-workspace\games`

5. 点击 `Publish repository`
6. 仓库名可以填 `pixel-extract`，公开或私有都可以
7. 不要勾选初始化 README，点击发布

之后每次修改游戏，在 GitHub Desktop 里：

1. 填写提交说明
2. 点击 `Commit to main`
3. 点击 `Push origin`

## 2. 让 Netlify 连接 GitHub 仓库

1. 打开 Netlify 项目：

   `https://app.netlify.com/projects/shiny-lolly-80eafb`

2. 进入 `Site configuration`
3. 找到 `Build & deploy` → `Continuous deployment`
4. 点击 `Link repository`
5. 授权 GitHub，选择刚创建的 `pixel-extract` 仓库
6. 分支选择 `main`
7. Build command 留空
8. Publish directory 填 `.`
9. 保存并部署

连接成功后，以后每次 `Push` 到 GitHub，Netlify 都会自动重新部署同一个网址：

`https://shiny-lolly-80eafb.netlify.app`

## 3. 注意事项

- 仓库根目录必须保留 `index.html`。
- `netlify.toml` 已配置发布目录为 `.`。
- `sw.js` 使用网络优先缓存，部署后在线刷新即可获取新版本。
- 不要修改 Netlify 网址，否则浏览器存档会跟着换来源。
- 部署配置或源码更新后，手机可能需要关闭并重新打开游戏一次。
