# OpenMobile-2 的 Pages 发布方式核查

日期：2026-11-12。仅检查公开线上页面、GitHub 文件树、README 与构建脚本；未修改或部署对方仓库。

## 确认的实现

| 部分 | 实际组织 | 当前文件体积 |
| --- | --- | ---: |
| 主页、图表、回放 | `OS-Copilot/OpenMobile2-Home` | 854 个文件，35.57 MiB |
| 完整模拟器 | 独立项目 `OS-Copilot/OpenMobile2-Sim` | 9,179 个文件，621.25 MiB |
| 主题、图标及部分基础媒体 | `https://cdn.mobilegym.dev` | 未统计远端完整内容 |

体积统计为 GitHub API 返回的当前树中全部 blob 的 `size` 求和，不是仓库 Git 历史的大小。
Home 树固定于 `3a602058e5f7099c0630f6f30d430e473f508b88`；Sim 树固定于
`3801d243dfd014a11feddc0b8b0af3e844d4ece6`。README 中旧的约 490 MB 不作为当前实测值。

主页 `static/js/om2-page.js` 的 hero 和 live demo 均指定：

```javascript
src: "/OpenMobile2-Sim/"
```

两个地址都在 `os-copilot.github.io` 下，因此 iframe 保持同源。主页可直接访问模拟器的
`__OS__`、`__SIM__` 和工具 API。它并没有将整个模拟器放进主页仓库。
模拟器在浏览器执行，无需主页运行 Python 应用服务。

`tools/assemble_sim.py` 的构建方式包括：

1. 将约 3.2 GB 的原始构建组装成独立 Sim 项目。
2. 删除已由 Vite 打进 `assets/` 的重复 App 媒体目录；动态拼接路径涉及的文件仍保留。
3. 将大于 24 KiB、可可靠重写引用的 PNG/JPEG 转成 WebP，并同步修改 JS/CSS/JSON 引用。
4. WebP 默认 `quality=82`，不是 `lossless=True`；这是有损转码，不能证明像素完全一致。
5. 部分主题路径改为 `cdn.mobilegym.dev/themes/`；主页图标同样使用该 CDN。
6. 写入 `.nojekyll`，保留许可证、地图 service worker 与缓存。

回放构建器 `tools/build_viewer_data.py` 将帧转换为 540×1200 的 JPEG，质量 78；卡片海报质量 72。
当前 viewer index 有 59 条 episode，viewer 目录约 34.66 MiB。它没有把全部原始截图一起放进主页。

## 对 OS-Omni 的含义

- GitHub Pages 不是只能承载一个项目。可以将主站与独立的模拟器/数据项目分开发布，保持同一组织域名下的同源路径。
- 之前的 4.24 GiB 无损资源包是一个可验证的资源服务方案，不是唯一可行的发布组织方式，也不是直接适用于 Pages 的目录。
- 可借鉴静态分包、同源 iframe、按需加载，以及有引用依据的去重；不能在“效果完全一致”的要求下直接采用对方的有损转码与缩小截图策略。
- 我们仍应保留所有现有 App、60 条轨迹、所有步骤与原图。需要按资源引用重新组织 Pages 发布包，并逐端验证；不能只把当前 42 MiB 源码 push 后就宣称完整上线。
- 多个资源项目或 CDN 仍需要实际的资源发布和地址配置。主站域名保持一致，不代表大资源无需托管。

本轮完成的是架构调查，尚未创建 OS-Omni 的新资源仓库、重写当前发布路径或进行线上发布。

## 公开依据

- [主页仓库 README 的 Live demo 部分](https://github.com/OS-Copilot/OpenMobile2-Home#live-demo)
- [主页挂载配置](https://github.com/OS-Copilot/OpenMobile2-Home/blob/main/static/js/om2-page.js)
- [模拟器组装脚本](https://github.com/OS-Copilot/OpenMobile2-Home/blob/main/tools/assemble_sim.py)
- [回放构建脚本](https://github.com/OS-Copilot/OpenMobile2-Home/blob/main/tools/build_viewer_data.py)
- [独立模拟器项目](https://github.com/OS-Copilot/OpenMobile2-Sim)
- [GitHub Pages 项目站点与同组织域名结构](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
