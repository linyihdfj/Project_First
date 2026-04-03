# 古籍在线编辑系统（project_first）

这是一个面向古籍数字化整理场景的全栈项目：前端提供可视化标注编辑器，后端提供鉴权、文章权限、数据持久化、OCR 能力与 XML 导出。

本文档按“老师会追问代码细节”的思路整理，重点回答三件事：

1. 用了什么技术，为什么这么选
2. 解决了什么问题，核心难点在哪里
3. 已实现哪些功能，各功能在代码里的落点是什么

---

## 1. 项目定位与要解决的问题

### 1.1 业务背景

古籍整理常见痛点：

- 原始材料多为扫描图（图片/PDF），文本不可直接编辑
- 标注粒度不统一（字、句、段、图），且经常跨行、跨页
- 异体字/生僻字需要建立“造字映射”
- 团队协作下，编辑与审校职责不同，权限需要隔离
- 产物需要结构化导出（XML），用于后续归档或检索

### 1.2 本项目给出的方案

- 以“文章”为协作单位，建立用户-文章授权关系
- 页面支持批量导入并持久化保存
- 标注支持层级结构与多区域（region）机制，解决跨行跨页问题
- 支持标题树（可拖拽重排）构建结构化目录
- 支持造字库增删导入导出，并可关联标注
- 提供 OCR（当前是百度 Provider）辅助识别与自动框选
- 一键导出 XML（含 content/view/sources）

---

## 2. 技术栈与工程结构

## 2.1 技术栈

- 前端：原生 HTML + CSS + JavaScript（单页应用）
- 后端：Node.js + Express
- 实时协同：Socket.IO
- 数据库：SQLite（sqlite3）
- 图像处理：sharp（用于 OCR 裁剪）
- OCR：可插拔 Provider 机制（当前实现 Baidu OCR）
- 认证：自实现 JWT（HMAC-SHA256）+ 角色权限控制

选择理由：

- SQLite 轻量、零部署，适合作业/原型阶段快速落地
- 原生前端减少构建复杂度，便于展示业务逻辑
- Socket.IO 适合低门槛实现“同页在线可见”的协同体验

## 2.2 目录说明

```text
project_first/
├─ index.html                  # 前端页面结构（登录、文章选择、编辑器、管理弹窗）
├─ app.js                      # 前端核心逻辑（状态管理、绘制标注、API、Socket）
├─ styles.css                  # 样式与响应式布局
├─ server/
│  ├─ index.js                 # API 路由、鉴权、Socket.IO、静态资源、服务启动
│  ├─ db.js                    # SQLite 表结构、迁移、CRUD、权限与认证核心实现
│  ├─ ocr.js                   # OCR 抽象层与 Baidu Provider
│  ├─ xml.js                   # 按快照生成 XML
│  ├─ ocr-config.example.json  # OCR 配置模板
│  └─ ocr-config.json          # OCR 实际配置（本地私有）
├─ data/
│  └─ sdudoc.sqlite            # SQLite 数据库文件
├─ uploads/
│  ├─ pages/                   # 页面图片
│  └─ glyphs/                  # 造字图片
├─ 古籍示例/                    # 示例素材
├─ test-hierarchy.js           # 标题层级与文件切换测试脚本
└─ README.md
```

---

## 3. 系统架构与数据流

```text
Browser(index.html + app.js + styles.css)
        |
        | HTTP/JSON + Socket.IO
        v
Express(server/index.js)
        |
        +-- DB Layer(server/db.js) ----> SQLite(data/sdudoc.sqlite)
        |
        +-- OCR Layer(server/ocr.js) --> Baidu OCR API
        |
        +-- XML Builder(server/xml.js)
        |
        +-- Static Files(uploads + frontend)
```

核心数据流（以标注为例）：

1. 前端在画布创建框选
2. 调用 API 写入 annotations + annotation_regions
3. 后端写库后通过 Socket 广播同页用户
4. 其他客户端收到事件并更新页面状态

---

## 4. 已实现功能清单（可用于答辩）

## 4.1 用户与权限

- 登录/身份校验：Token 鉴权
- 角色模型：admin、editor、reviewer
- 用户管理（仅 admin）：创建、查询、修改、删除
- 文章权限：通过 user_articles 控制某用户可访问哪些文章

实现细节：

- Token 由后端自实现 JWT（7 天有效期）
- 鉴权中间件：requireAuth
- 角色中间件：requireRole(...roles)
- 文章级中间件：requireArticleAccess

## 4.2 文章与页面管理

- 文章列表按“当前用户可访问范围”返回
- 创建文章（admin/editor）后自动给创建者授权
- 删除文章（admin）会级联删除数据并清理磁盘图片
- 页面批量导入（图片/PDF 渲染结果）
- 清空页面时同步清理历史页面资源

## 4.3 标注系统（核心）

- 支持层级：char / sentence / paragraph / image
- 标注样式：highlight / box / underline
- 标注属性：原文、简体、注释、注释类型、编码、关联造字等
- 审校字段：reviewStatus、reviewedBy
- 支持父子标注（parentId + orderIndex）
- 支持批量创建标注

关键设计点：

- 旧版以 x/y/width/height 存单框，现迁移为 annotation_regions 多区域结构
- 一个标注可绑定多个 region，用于表达“跨行/跨页同一句”

## 4.4 标题树与目录导航

- 标题可绑定 page/annotation
- 支持 parentId 构建树结构
- 支持拖拽重排（orderIndex）
- 修改父级时可递归修正子级层级

## 4.5 造字库

- 新增造字（编码校验，格式如 U+E001）
- 造字图片上传与保存
- 造字删除会解除标注关联
- 支持 JSON 导入导出（批量）

## 4.6 OCR 辅助

- 识别接口：对整页或局部框选做文字识别
- 版面检测：返回建议框（可用于自动标注辅助）
- 粒度支持：行级/字符级（字符级不足时回退行级）

## 4.7 XML 导出

- 基于文章快照生成 XML
- 输出结构包含 article/head/content/view/sources
- content 内按段句字（以及 image）映射
- view 中生成 SVG 标注图层（rect/line/text）

## 4.8 实时协同

- 通过 Socket.IO 的房间机制按 page/article 组织广播
- 支持 presence（加入/离开/成员列表）
- 标注与造字变更可实时同步给其他在线用户

---

## 5. 数据模型（数据库表）

核心表：

- articles：文章元信息
- pages：页面元信息与图片路径
- annotations：标注主记录（含层级、文本、审校状态）
- annotation_regions：标注的多区域坐标（跨行/跨页关键）
- headings：标题树（parent_id、order_index）
- glyphs：造字映射
- users：账号与角色
- user_articles：用户-文章授权关系
- xml_versions：XML 版本记录
- comments：评论表（目前为数据库能力预留，API 未对外开放）

---

## 6. API 概览（按模块）

系统与认证：

- GET /api/health
- POST /api/auth/login
- GET /api/auth/me

用户管理（admin）：

- POST /api/auth/register
- GET /api/users
- PATCH /api/users/:userId
- DELETE /api/users/:userId

文章与权限：

- GET /api/articles
- POST /api/articles
- DELETE /api/articles/:articleId
- GET /api/articles/:articleId/access
- POST /api/articles/:articleId/access
- DELETE /api/articles/:articleId/access/:userId

文章数据与导出：

- GET /api/articles/:articleId
- PUT /api/articles/:articleId
- GET /api/articles/:articleId/page-srcs
- GET /api/articles/:articleId/snapshot
- GET /api/articles/:articleId/export-xml

页面与标注：

- POST /api/articles/:articleId/pages/bulk
- DELETE /api/articles/:articleId/pages
- POST /api/pages/:pageId/annotations
- POST /api/pages/:pageId/annotations/batch
- GET /api/pages/:pageId/annotations
- PUT /api/annotations/:annotationId
- PATCH /api/annotations/:annotationId
- DELETE /api/annotations/:annotationId

跨页区域：

- POST /api/annotations/:annotationId/regions
- GET /api/annotations/:annotationId/regions
- PUT /api/annotations/:annotationId/regions/reorder
- DELETE /api/annotation-regions/:regionId
- GET /api/pages/:pageId/cross-page-annotations

标题与造字：

- POST /api/articles/:articleId/headings
- PATCH /api/articles/:articleId/headings/:headingId
- POST /api/articles/:articleId/headings/reorder
- DELETE /api/headings/:headingId
- GET /api/articles/:articleId/glyphs
- POST /api/articles/:articleId/glyphs
- DELETE /api/glyphs/:glyphId
- POST /api/articles/:articleId/glyphs/import

OCR：

- POST /api/ocr/recognize
- POST /api/ocr/layout-detect

---

## 7. 关键难点与对应实现

## 7.1 跨行/跨页标注

问题：同一句文本可能跨两行甚至跨页，单矩形模型无法表达。

实现：

- annotation_regions 支持一个 annotation 对应多个 region
- getAnnotationsForPage 会把父标注及其子标注打包返回
- 更新/删除时会按涉及的所有 page 广播，避免跨页不同步

## 7.2 权限与协作并存

问题：既要多人协同，也要角色隔离和文章隔离。

实现：

- 角色权限由 requireRole 控制
- 文章访问由 checkArticleAccess 控制
- Socket join-article 时再次校验文章访问权

## 7.3 兼容历史数据

问题：模型升级后需要兼容旧数据。

实现：

- 启动时 initDatabase 执行迁移
- migrateAnnotationsToRegions 将旧坐标迁移到 region 表并清零旧字段

---

## 8. 运行方式与环境要求

## 8.1 安装与启动

```bash
npm install
npm run dev
```

默认地址：

- 前端：http://localhost:3000/index.html
- 健康检查：http://localhost:3000/api/health

## 8.2 运行环境建议

- Node.js 18+

说明：项目中使用了 fetch（服务端 OCR 请求），Node 18+ 原生支持。

## 8.3 默认账户

数据库初始化时会自动创建管理员账户：

- 用户名：admin
- 密码：admin123

建议首次登录后立即修改。

## 8.4 OCR 配置

1. 复制 server/ocr-config.example.json 为 server/ocr-config.json
2. 填写百度 OCR 的 apiKey 与 secretKey

未配置时，OCR 接口会返回“服务未配置”提示。

---

## 9. 前端页面结构（老师常问）

页面主要由 3 个 Tab 组成：

- 编辑器：导入页面、绘制标注、索引栏、标注属性、OCR
- 文章信息：文章元信息维护、导出 XML
- 造字库：新增/导入/导出/管理造字映射

前端状态集中在 app.js 的 state 对象：

- 当前用户与角色
- 当前文章与页面列表
- 当前选中标注、标题
- 画布缩放/平移状态
- 造字与标题树
- 在线用户 presence

---

## 10. 可用于课堂答辩的“代码细节要点”

如果老师问“你这个项目不是拼装的吗，具体你做了什么”，可以从下面回答：

1. 我没有用现成编辑器组件，而是自己在 SVG + 图片图层上实现标注交互。
2. 标注模型不是单框，而是 annotation + regions 的多区域结构，专门解决跨行跨页。
3. 权限不是只看角色，还叠加了 user_articles 的文章级授权。
4. Socket 广播使用 room + except(sender) 防止自己回声更新。
5. 数据库初始化内置迁移逻辑，保证旧版本坐标数据可升级到新结构。
6. XML 不是静态模板，而是由快照动态生成，包含内容层和可视化层（view/svg）。

---

## 11. 当前边界与后续优化方向

当前边界：

- 冲突处理是“后写覆盖”模型，尚未做 CRDT/OT
- 评论能力目前只在数据库层预留，未提供 API 与前端界面
- OCR 目前仅接入百度 Provider

可扩展方向：

- 增加评论 API 与审校流转
- 增加 OCR provider（如本地模型或其他云服务）
- 标注协作加入版本号/乐观锁，减少并发覆盖
- 增加操作日志与审计轨迹

---

## 12. 脚本命令

package.json 当前脚本：

- npm start：启动服务（node server/index.js）
- npm run dev：开发启动（当前同 start）
