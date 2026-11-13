# OS-Omni 网页汇报前检查

检查日期：2026-11-10。对象为本地 `OS-Omni-Home` 工作区，不代表线上站点已部署。

## 当前结论

可以作为内部功能演示版本汇报：页面结构、数据来源和入口脚本检查通过。
不能据此宣称正式公开发布完成、所有原生 App 功能已经复刻，或五端实屏视觉验收已经完成。

## 本轮已整理的问题

| 问题 | 修改与依据 |
| --- | --- |
| 部分介绍和分享摘要仍写五个平台 | 正式 benchmark 统一为六平台＋跨设备；五端浏览器演示单独标明，不包含独立 Web 设备壳。`index.html` |
| 分享图片仍为 OSReward 旧模板 | 已实际查看旧图，改用 OS-Omni 的 `public/cover.png`；同步图片尺寸和分享摘要。`index.html` |
| 资源区出现修改 class/href 的开发说明 | 改为面向访客的资源与公开状态说明；三张资源卡改用三列布局。`index.html` |
| Models 入口与当前资源不对应 | 移除资源区对自有模型发布的暗示和页脚 Models 入口，保留七个被评测模型的全部成绩。`index.html` |
| Code 公开链接返回 404 | `https://github.com/OS-Copilot/OS-Omni` 的未登录公开访问检查返回 404；不推断仓库不存在或非私有。页面入口已改为待公开，待确认正确地址后启用。 |
| 引用条目把未确认的发表信息写成 arXiv preprint | 标注 Draft citation，删除未经确认的 arXiv 发表声明；作者和最终发表信息仍需核定。`index.html` |
| 页内导航与实际顺序不一致 | 导航统一为 Benchmark → Leaderboard → Findings；Playground 纳入滚动定位。`index.html`、`static/js/main.js` |
| 仍加载未使用的旧图表库 | 移除 `osomni-charts.js` 的入口引用及对应旧 redraw 依赖；当前结果由 `paper-results.js` 渲染。 |
| 返回桌面后右侧 App 高亮可能残留 | Home、关闭/最小化和切换已打开窗口同步更新目录状态；打开应用时不再直接声称“已保存”。`static/js/browser-playground.js` |
| README/数据说明介绍了已经删除的功能 | 同步当前结构：单一五端演示、无 Tour、无重复 coverage、真实轨迹库、自动循环的统一标注流程、一张可切换的结果条形图。 |

## 核对结果

- 页面没有重复 ID、断开的页内锚点或缺失的直接本地资源引用。
- 检查 280 个本地资产路径；146 个本地 HTTP 入口返回 200，包括设备 App 页面和数据入口。
- 当前加载的 13 个 JS 文件和 1 段内联脚本语法通过；13 个本地 CSS 文件解析通过。
- 300 条任务的 ID、路径、平台分组、来源分类及完整 instruction 与 `111/tasks/v1/manifest.json` 和对应 YAML 核对一致。过程只读，没有执行 initializer/evaluator。
- 六个单平台分组各 48 条，跨设备 12 条；来源分类 181 / 31 / 76 / 12，总计 300。
- 七个模型及人类参考的 64 个成绩与用户提供的 Camera Ready 第 9 页 Table 1 一致。保留论文公布的平均值和精度，不按任务数重新加权。
- 原先的示意任务讲解板块已删除。Recorded trajectories 已接入 Windows、macOS、iOS、Linux、Web 各 12 条，共 60 条、4,681 张未经修改的原始截图。步数分别为 40–99、30–96、31–137、26–300、30–243；Linux 为补足 12 个完整任务，保留三条 26/29 步真实记录，不补帧增加步数。按 Desktop / Mobile / Browser 分组；空组不显示。支持 App 筛选和任务搜索，评分未通过的尝试明确显示 FAIL，episode runner 与最终 evaluator 的状态分别保留。使用同一个模型组，页面不展示模型名称。归档 instruction 可能与当前任务版本不同，回放展示归档版本。播放使用轻量 WebP 预览与缓冲；原图保持不变。标注动画仍是方法示意，与真实轨迹回放区分。
- 平台来源由 `tools/case-study-sources.json` 单独固定：原有三端保留 `c8c004959aed92a8a32202560370fb9ae87aeafa`；Linux 使用 `158ee7f9b9ceba8ac0dfc8d03b0be936d87ac28a` 的 `ubuntu/gpt6_astra/`；Web 使用 `2192b2324ca816144265f9f270fee53dc10d157b` 的 `web/gpt6_astra/`，尽管任务 ID 仍以 `linux.` 开头，页面按 catalog 的 `track=web` 正确分组。已逐条核对所选轨迹引用的全部截图。仓库文档写“已添加”不代表原始轨迹和截图已上传完成，不据汇总表生成虚构回放。
- 五端浏览器入口数：Linux 37、Windows 43、macOS 39、Android 31、iOS 30。这些是可启动的浏览器实现入口数，不是完整原生功能通过验收的数量。
- 已检查榜单视角切换、排序与模型高亮、平均分/平台共享图表、标注动画循环和离屏暂停，以及 Home 与目录状态同步的脚本逻辑。

## 汇报和发布边界

1. **实屏检查待完成**：浏览器控制工具返回 `The browser access host is unavailable`。本轮没有桌面/移动断点截图验收，不对最终间距、动画观感或所有 App 内部操作作已通过承诺。
2. **公开入口待补齐**：Paper、arXiv、Code、Benchmark 当前仍待公开。Trajectories 已接入本地 60 个真实轨迹案例；完整 Hugging Face 归档通过现有登录可读，匿名访问返回 401，因此源仓库链接注明可能需要登录，不宣称全部资源已经公开下载。
3. **署名与引用待确认**：当前展示集体署名，BibTeX 明确为草稿；正式对外分享前补齐作者、出版信息和可用链接。
4. **部署待验证**：这里只检查本地工作区和本地 HTTP 服务，没有发布或确认线上版本。大量新增前端文件目前尚未纳入 Git；`public/playground/`、`public/case-studies/`、`public/case-previews/` 为忽略的生成资源。发布时必须包含完整静态应用和回放素材，不能只推送 `index.html`。完整静态内容超过 8 GiB，不能直接作为 1 GB 限额内的 GitHub Pages 网站上传；需先处理大资源托管。源码仓库为 `OS-Copilot/OS-Omni-Home` 的 `main` 分支。
5. **App 功能边界**：演示用浏览器适配/重建实现，具有各平台 audit 记录的限制。它不是远程原生 VM，也不会执行正式 benchmark 评分。

## 建议的五分钟演示顺序

1. 首页 → 五端设备：切换一次桌面/手机，展示不同启动样式，打开一个 App。
2. Data Distribution / Composition：说明 300 条任务、六平台和 12 条跨设备任务。
3. Leaderboard：展示 Average，再切 Linux / iOS，说明平台间差异；人类参考固定，榜单可排序。
4. One pipeline：展示统一五阶段流程及自动循环的阶段进度。
5. Task Explorer：按平台和 App 筛选，展开一条实际 instruction，说明数据可追溯。

汇报表述可用：
“目前完成了以 Camera Ready 和正式 v1 任务为数据源的交互项目页，包含五端浏览器演示、任务分布、模型结果和任务检索。数据与入口代码已经核对；公开资源链接、正式署名以及桌面/手机实屏验收，是对外发布前最后需要完成的部分。”

## 重复检查

```powershell
python tools/check_site.py --benchmark-source ../111 --paper "../_NeurIPS_2026_Release__OS_Omni (1).pdf"
```

该命令不修改代码、论文、任务或实验日志。它不代替浏览器端交互和视觉检查。
