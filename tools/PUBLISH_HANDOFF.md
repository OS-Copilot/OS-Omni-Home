# 本次推送与上线状态

**最新状态（2026-11-15）：主站及全部资源已上传到现有官方仓库，现不需要新建资源仓库。
只差维护者启用 Pages。请以 [当前官方部署说明](OFFICIAL_DEPLOYMENT.md) 为准。**

以下是 2026-11-12 的历史交接记录，所述五个独立资源仓库方案已由同仓库分支方案替代。

2026-11-12，用户已要求执行 push。

## 已上传

- 主站发布分支：`OS-Copilot/OS-Omni-Home:gh-pages`。
- 发布提交：`302a86df58a7cb2a1f4c243ff511eba878de5bef`。
- 网站源码快照使用独立分支：`codex/pages-site-8d631c695cf87f39`；不覆盖现有 `main`。

## 尚未上线的原因

实际尝试创建第一个资源仓库 `OS-Copilot/OS-Omni-Assets-01` 时，GitHub API 返回：

> HTTP 403: You need admin access to the organization before adding a repository to it.

因此本次没有创建这五个资源仓库，也没有上传它们的资源。
当前账号能 push 主站代码，但不具备本次所需的组织建仓与主站 Pages 配置权限。
这不是压缩或前端交互的失败。

## 维护者需要完成

1. 创建/授权 `OS-Omni-Assets-01` 至 `OS-Omni-Assets-05` 五个仓库。
2. 使用本地已验证的 `dist/pages-ready/` 包先上传五个资源项目，并将各自 Pages 发布源设为 `gh-pages`、`/(root)`。
3. 资源上线后，再将主站 Pages 发布源设为 `gh-pages`、`/(root)`。
4. 对照本地检查首次打开、五端切换、App 打开和回放；当前工具未完成真实浏览器视觉验收。

主站分支现在已包含完整主站文件及资源索引，但其引用的资源项目尚未上线。
不要把“主站分支推送成功”当成“完整网站已可供用户使用”。

维护者可参考 [纯静态发布说明](PURE_STATIC_PAGES.md)，使用有相应权限的账号运行
`python tools/publish_pages_site.py --publish` 完成剩余发布。
