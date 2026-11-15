# 官方网站部署状态

更新：2026-11-15。正式地址固定为 **https://os-copilot.github.io/OS-Omni-Home/**。

## 文件已全部上传

所有内容均在现有仓库 `OS-Copilot/OS-Omni-Home`，不需要创建其他仓库。

| 用途 | 分支 | 提交 |
| --- | --- | --- |
| 主站 | `gh-pages` | `0fda4f706b8ab49b46fccce28eaba1bddf3db628` |
| 资源 1 | `site-assets-01` | `541554c78972b07034700cc708979c6b9d7d0703` |
| 资源 2 | `site-assets-02` | `3b60efcaf4cb84029e1c6717443e268b2ffe2d24` |
| 资源 3 | `site-assets-03` | `24b2623332b1ae4f71cbc4f84ad926bc309daa4b` |
| 资源 4 | `site-assets-04` | `b2b1342a7f87e21fdabdaa6e3bd3ab7bcec27f7a` |
| 资源 5 | `site-assets-05` | `2ca69a7f9cbaa54aadd0658519d2abd276769df8` |

主站约 178.44 MiB；资源通过固定提交的公开 Raw 地址读取。源码 `main` 未改动。
版本为 `8d437234d605571d`。已核对 29,053 个资源 URL、14,553 份去重内容、903 个直接文件，
并通过 299 个响应和 30 项协议检查，包括公开读取、跨域许可、gzip、Range 与大小写兼容。
全部 60 条案例、4,681 张截图及既有预览保留。

## 剩下的一次设置

当前 Git 登录账号 `Kiky-88` 有 push 权限，但没有仓库 maintainer/admin 权限。
启用 Pages 的 API 请求返回 `HTTP 404: Not Found`，正式地址仍返回 404；尚不能视为上线成功。

请仓库维护者/管理员：

1. 打开 https://github.com/OS-Copilot/OS-Omni-Home/settings/pages 。
2. **Source** 选择 **Deploy from a branch**。
3. **Branch** 选择 **gh-pages**。
4. **Folder** 选择 **/(root)**，点击 **Save**。

无需下载、重传资源、创建其他仓库或运行本地服务。
若打开设置页是 404 或没有对应选项，请使用有维护权限的账号操作。
保存后核对正式地址的 `osomni-pages-sw.js` 和资源索引是否为上述版本，再进行浏览器验收。
当前文件/协议检查不替代真实浏览器中的安装、视觉、动画和全部 App 操作测试。

## 发布工具

- `upload_existing_repo_assets.py --push`：上传资源到现有仓库分支。
- `wire_existing_repo_assets.py`：将主站绑定到资源的固定提交。
- `verify_pages_site.py` / `verify_pages_runtime.mjs`：校验精确版本。
- `finish_official_pages.py --publish`：推送主站、尝试启用并核对正式发布。

本地包：`dist/pages-ready/`。其中 `OS-Omni-Assets-*` 是本地目录名，不代表需要同名仓库。
该目录下 `official-deployment.json` 记录最新状态，不作为网站文件公开。

资源分支较大，只需源码时建议单分支浅克隆：

```powershell
git clone --single-branch --branch main --depth 1 https://github.com/OS-Copilot/OS-Omni-Home.git
```

网站线上无需 Python，也不连接原生 VM。浏览器资源适配器保留原有路径和用户数据，
通过同仓库的公开资源读取文件。后续可以将资源接口迁移到对象存储/CDN，而保持官网地址不变。
