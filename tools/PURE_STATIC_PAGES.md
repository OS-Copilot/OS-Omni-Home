# GitHub Pages 纯静态发布包

**2026-11-15 更新：当前正式发布使用同一官方仓库的 `gh-pages` 与 `site-assets-01` 至 `05` 分支。
全部文件已上传，官方 Pages 已启用并通过正式域名检查。请阅读 [当前官方部署说明](OFFICIAL_DEPLOYMENT.md)。
以下多仓库方案和体积表作为历史设计记录保留，不再需要创建所列资源仓库。**

2026-11-12。已将完整 App 与回放快照导出为普通静态文件，不再需要在线 Python 资源服务。
这与参考网站采用相同的“主站 + 独立静态资源项目”组织方式；具体的路径适配实现不同。

最新实际推送状态见 [发布交接记录](PUBLISH_HANDOFF.md)：主站 `gh-pages` 已推送；资源仓库创建被 GitHub 以组织权限不足（403）拒绝，完整网站尚未上线。

## 实际产物

输出目录：`dist/pages-ready/`。

| 仓库 / Pages 项目 | 发布分支 | 实测体积 |
| --- | --- | ---: |
| `OS-Copilot/OS-Omni-Home` | `gh-pages` | 173.22 MiB |
| `OS-Copilot/OS-Omni-Assets-01` | `gh-pages` | 750.00 MiB |
| `OS-Copilot/OS-Omni-Assets-02` | `gh-pages` | 750.00 MiB |
| `OS-Copilot/OS-Omni-Assets-03` | `gh-pages` | 750.00 MiB |
| `OS-Copilot/OS-Omni-Assets-04` | `gh-pages` | 750.00 MiB |
| `OS-Copilot/OS-Omni-Assets-05` | `gh-pages` | 401.29 MiB |

每个项目均低于 Pages 站点的 1 GB 限制；最大的单文件小于 38 MiB。
五个资源仓库名称为本次发布计划，尚未由此工作创建。主站继续使用现有仓库与原定 URL。
源码 `main` 分支与生成的 `gh-pages` 发布分支分开；不将生成资源塞回源码目录。

全部项目合计约 3.49 GiB，略大于 3.38 GiB 的资源服务压缩包，因为保留了 Flutter 子 Service Worker
和地图功能需要直接读取的完整静态文件。这些兼容副本不改变 App 内容。

## 浏览器端如何读取

1. 首次进入时，静态入口注册本项目范围内的浏览器 Service Worker。
2. 浏览器按资源索引从同一组织域名下的资源项目读取去重后的文件。
3. 浏览器还原 gzip 内容，并在原有 App/回放路径返回正确的内容类型。
4. App HTML、脚本、坐标与交互逻辑不重写；当前页面仍运行在原定路径下。
5. Flutter 的三个 OpenDriver 版本、公共运行文件和地图瓦片直接放在主站，兼容其自身缓存机制。

这是浏览器标准能力，不是在线 Python 后端，也不连接原生虚拟机。
必须使用 HTTPS（本地 localhost 也可）和支持 Service Worker / DecompressionStream 的浏览器。
首次访问有短暂准备画面；首页标题、描述和社交预览元数据已保留在静态入口中。
App 用户数据仍使用各 App 原有的浏览器存储；资源适配器不清除 App 数据或其他项目的缓存。

## 已完成的验证

- 全部 **29,053 个资源 URL** 的映射与完整性。
- **14,553 份去重文件、903 个主站直接文件** 的内容校验。
- **60 条案例、4,681 张截图** 与已有预览全部保留。
- 使用普通静态 HTTP 服务，执行了 **299 个资源响应、29 项协议检查**。
- 检查覆盖所有 App 入口、案例首尾截图/预览、gzip、WebP/WASM 类型、HEAD、Range、ETag、目录跳转、根路径兼容、资源丢失返回失败。
- 检查了安装/激活处理、索引缓存后重启、保留 App 缓存的逻辑。

这些是文件和 JavaScript 协议测试，**不等于已完成真实浏览器中的安装、视觉、动画与全部 App 操作验收**。
当前没有进行线上发布。
尝试打开受控预览浏览器时，工具返回 `The browser access host is unavailable`，因此没有完成该项实际浏览器验收。

## 本地预览

在网站仓库中运行普通静态服务器：

```powershell
python -m http.server 8915 --bind 127.0.0.1 --directory dist/pages-ready
```

打开 `http://127.0.0.1:8915/OS-Omni-Home/`。
这个 Python 命令仅是本地文件预览工具；线上由 Pages 直接提供这些文件。

构建与文件验证：

```powershell
python tools/build_pages_site.py
python tools/verify_pages_site.py
```

构建器不覆盖已有非空输出。更改网页或 App 后需要重新生成快照与发布包。
运行时测试入口为 `tools/verify_pages_runtime.mjs` 导出的 `verifyPagesRuntime(directory, origin)`。
精确统计与测试结果分别保存在包目录外层的 `pages-build-report.json`、`pages-verification.json`、
`pages-runtime-verification.json`，不会当作网站文件公开。

## 发布预演与实际操作

默认仅查看计划，不创建仓库、不 push、不修改 Pages：

```powershell
python tools/publish_pages_site.py
python tools/publish_pages_site.py --check-access
```

仅在确认发布目标、资源公开范围和账号权限后，使用 `--publish` 执行：

```powershell
python tools/publish_pages_site.py --publish
```

该操作会创建缺少的五个公开资源仓库，逐个推送 `gh-pages` 并配置 Pages；资源构建完成后才发布主站。
脚本不会 force-push、不会改写源码 `main`，也不会打印或写入 GitHub 凭据。
如果已有自定义域名与计划不符，或已有仓库缺少 push/Pages 配置权限，会在远程写入前停止。
实际发布尚未执行，因此未验证组织建仓策略、分支保护、Pages 构建和线上 CDN 的最终行为。

## 本次账号权限核对

只读查询确认当前 GitHub 账号 `Kiky-88` 对 `OS-Copilot/OS-Omni-Home` 具有 `push: true`，
但 `admin: false`、`maintain: false`。Pages 配置接口未返回现有站点信息。
五个计划中的资源仓库当前对该凭据不可见，不能据此断言它们一定不存在。

因此代码提交权限已确认，但不能把它当成有权配置 Pages 的证明。
需要仓库管理员或维护者完成/授权本次 Pages 发布配置；当前发布脚本会在发现该缺口时先停止，
不会先创建或上传一批资源再失败。只读结果见 `pages-access-check.json`（执行权限检查后生成）。

依据：[GitHub Pages 发布源权限与配置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)、
[Pages 大小限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)、
[参考网站打包脚本](https://github.com/OS-Copilot/OpenMobile2-Home/blob/main/tools/assemble_sim.py)。
