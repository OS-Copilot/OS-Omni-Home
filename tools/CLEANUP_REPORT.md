# 网站清理与源码推送说明

检查日期：2026-11-12；仅限 `D:\OTHER\osomni\OS-Omni-Home`。

## 已完成的清理

- 757 个确认无用的文件已移入 Windows 回收站，移出工作区约 195.03 MiB；另移除 47 个空目录。
- 其中包括 364 张已退出展示的原始截图、364 张对应预览、6 个临时源文件索引、3 张论文临时渲染图、13 个 Python 字节码缓存和下列 7 个旧版界面文件。
- 删除前核对了页面/构建脚本引用，并将当前轨迹 JSON 的图片集合与两个来源清单比对。当前 60 条轨迹的 4,681 张原图及 4,681 张预览全部保留。
- 实验日志和下载的原始轨迹审计缓存保留；没有清理仓库外的 benchmark、镜像或实验目录。

移除的旧界面文件：

```text
static/css/application-coverage.css
static/css/live-workspace.css
static/js/live-workspace.js
static/css/workflow-explorer.css
static/data/workflow-stories.json
static/js/osomni-charts.js
public/social/og-image.png
```

仍有生成、调试或来源审计用途的工具和品牌源图保留。尤其保留 App 包中按平台区分的前端、地图、航班数据、字体和参考 PDF，避免误删动态加载的应用素材。

## 源码应推送到哪里

本地 Git 的 `origin`（fetch/push）均为：

```text
https://github.com/OS-Copilot/OS-Omni-Home
```

当前分支为 `main`。这是网站源码仓库，区别于 `111` 的 benchmark 代码和 Hugging Face 结果仓库。本次未创建提交、未 push、未部署。

清理后的 Git 候选源码为约 42 MiB、472 个文件；最大文件是约 5.55 MiB 的轨迹 JSON。候选集合中没有生成的 App/回放目录或 `tmp/` 文件；检查常见 API token 格式未发现匹配，不代表全面安全审计。

`.gitignore` 已排除完整 `tmp/`、本地凭据以及以下可重建的大资源：

```text
public/playground/
public/case-studies/
public/case-previews/
```

这些目录只从源码提交中排除，当前使用中的本地文件仍然存在。生成来源、导入脚本、平台配置、轨迹选择和 SHA-256 清单均保留在源码中。

## 推送源码不等于网站已经上线

完整静态内容超过 8 GiB，主要来自浏览器 App 包及回放图片。[GitHub Pages 已发布网站上限为 1 GB](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。当前版本不能直接通过推送源码根目录实现完整 Pages 发布：生成的大资源未包含在源码 Git 提交中，而且完整包超过 Pages 的大小限制。

上线前需要给这些资源安排独立托管并配置资源地址，或将完整静态包部署到容量足够的静态服务。现有资源地址和页面交互未因本次清理而改写。

打包前可运行：

```powershell
python tools/check_site.py
python tools/package_browser_site.py --check-only
```

第二条命令只检查打包输入和统计体积，不复制或部署文件。缺少回放原图或预览时会阻止打包，避免生成能打开首页却缺少 App/回放资源的网站。

## 清理后验证

- 页面预检无错误：9,643 个本地资产、60 条回放、300 条正式任务均通过检查。
- 当前 64 个成绩与所提供 Camera Ready 表格一致。
- 打包输入校验通过：60 条案例、9,362 个回放媒体文件，完整静态内容 29,051 个文件、8.47 GiB；本次未复制发布包。
- 本地首页返回 HTTP 200，回放数据仍为 60 条。
- 公开 Paper/arXiv/Code/Benchmark 链接、引用署名等原有待办未因清理而宣称已完成；未进行新的实屏视觉验收或线上部署验收。
