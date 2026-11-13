# 同效果的无损瘦身发布包

后续新增：[GitHub Pages 纯静态分包](PURE_STATIC_PAGES.md)。本文描述的是之前的资源服务包，
它仍保留作为无损基准与备份，不代表只能用 Python 才能部署完整网站。

日期：2026-11-12。原来的源码、浏览器 App 包、60 条轨迹和全部原图均未改动。

## 实测结果

| 指标 | 结果 |
| --- | ---: |
| 原始完整静态内容 | 8.47 GiB |
| 无损瘦身包 | 4.24 GiB |
| 体积减少 | 约 50.0% |
| 原有资源路径 | 29,053 个，全部保留 |
| 去重后唯一内容 | 15,323 份 |
| HTTP 抽查 | 441 个入口/资源 |

独立发布包位于 `dist/compact-site/`，不纳入源码 Git 提交。
精确字节统计见其中的 `build-report.json`；完整性和 HTTP 验证见 `verification.json`。

## 为什么效果保持一致

同内容文件按 SHA-256 只存一份，其余路径映射到这一份内容。压缩使用可逆 gzip。
资源服务仍在原来的 URL 返回解压后相同的文件，并根据原 URL 提供 MIME 类型。
HTML、CSS、JS、字体、图片、App 数据、PDF、全部回放步骤和原图的响应字节没有改变。
图片没有缩小尺寸或降低质量，App 资源引用没有改写，也没有将任何资源替换为外站下载。

校验器独立读取了全部源文件和全部压缩内容，核对解压后的 SHA-256。
HTTP 验证覆盖 App 入口、60 条回放的首尾原图/预览、gzip 与 identity 响应、HEAD、
PDF/JSON Range、后缀 Range、If-Range、416、ETag 304，以及项目子路径。

文件内容一致性不等于完成了新服务下每个 App 的人工视觉与交互验收。本次没有重新
声称所有浏览器 App 与原生镜像功能等价。

## 构建与验证

先保证原来的完整生成资源已准备好。使用 Python 3.11 或更新版本，无第三方运行依赖：

```powershell
python tools/build_compact_site.py --output dist/compact-site
python tools/verify_compact_site.py --package dist/compact-site
```

构建器要求一个空的输出目录，不覆盖已有发布包。需要重建时使用另一个目录名。
原目录中的 `tools/serve_browser.py` 及 8899/8900 预览方式继续保留。

预览瘦身包：

```powershell
python dist/compact-site/serve.py --port 8912
# http://127.0.0.1:8912/
```

在 `/OS-Omni-Home/` 子路径预览：

```powershell
python dist/compact-site/serve.py --port 8913 --base-path /OS-Omni-Home
```

## 部署约束

这是带有资源映射服务的静态内容包，不能把其中的 `blobs/` 文件夹直接当普通静态网站根目录发布。
部署时需要使用随包提供的 `serve.py` 或实现相同资源映射、MIME、解压与 Range 行为的服务。
该服务只读取静态内容；App 逻辑、各访客的状态与数据仍在浏览器运行。

同一域名和原路径部署时，已有浏览器 localStorage 的来源地址不变；换到新的端口或域名
预览时，浏览器会使用新来源自己的存储。这是浏览器的来源隔离，发布包不迁移或清空原数据。

4.24 GiB 仍高于 GitHub Pages 的 1 GB 网站限额，因此此次没有宣称可以直接推送到 Pages 上线，
也没有执行任何线上部署。源码仍推送至 `OS-Copilot/OS-Omni-Home`；发布包需要容量和运行方式兼容的托管。
