# 古籍在线编辑系统（project_first）

本项目是一个面向古籍整理场景的在线编辑系统，包含前端编辑器、Node.js API 服务、SQLite 持久化、OCR 接口扩展与 XML 导出能力。

核心目标：

- 导入古籍扫描页（图片/PDF）
- 在画布上进行字/句/段标注与属性编辑
- 管理标题树与造字映射
- 支持多用户登录、文章权限与基础协同
- 按 XML-V0.1 结构导出成果

## 技术栈

- 前端：原生 HTML + CSS + JavaScript（单页）
- 后端：Node.js + Express + Socket.IO
- 数据库：SQLite（sqlite3）
- 图像处理：sharp
- OCR：可插拔 Provider（当前内置百度 OCR 适配）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

默认地址：

- 前端入口：http://localhost:3000/index.html
- 健康检查：http://localhost:3000/api/health

### 3. 数据与上传目录

- 数据库文件：data/sdudoc.sqlite
- 页面图片：uploads/pages/
- 造字图片：uploads/glyphs/

## 项目整体架构

```text
Browser (index.html + app.js + styles.css)
        |
        | HTTP/JSON + Socket.IO
        v
Node/Express (server/index.js)
        |
        +-- DB access (server/db.js) ----> SQLite (data/sdudoc.sqlite)
        |
        +-- XML build (server/xml.js)
        |
        +-- OCR provider (server/ocr.js + ocr-config.json)
        |
        +-- Static files (/uploads, frontend files)
```

## 目录结构与文件功能

### 根目录

- index.html：前端页面骨架（登录、文章选择、编辑器、造字库、管理弹窗）
- styles.css：整体视觉样式与响应式布局
- app.js：前端主逻辑（状态管理、画布标注、API 调用、Socket.IO 协同）
- package.json：Node 依赖和启动脚本
- test-hierarchy.js：用于验证标题层级/文件切换行为的脚本
- README.md：项目说明文档（本文档）
- 说明.txt：需求与设计要点补充说明
- 作业一说明.docx：作业要求文档
- XML-V0.1.docx：XML 结构规范文档

### server/

- server/index.js：后端入口，职责包括：
  - 认证与鉴权（登录、角色校验、文章访问校验）
  - 文章、页面、标注、标题、造字、OCR、XML 导出等 API
  - Socket.IO 实时广播（标注/标题更新同步）
  - 静态资源托管（前端与 uploads）
- server/db.js：SQLite 数据访问层，职责包括：
  - 表结构初始化与迁移（articles/pages/annotations/glyphs/headings/users 等）
  - 业务 CRUD 与快照聚合
  - 图片 DataURL 解析与落盘
  - 密码哈希、Token 相关辅助逻辑
- server/xml.js：将文章快照组装为 XML-V0.1 风格内容
- server/ocr.js：OCR 抽象层与百度 OCR Provider 实现
- server/ocr-config.json：OCR 实际配置（本地私有配置，通常不提交）
- server/ocr-config.example.json：OCR 配置模板

### data/

- data/sdudoc.sqlite：SQLite 持久化数据库

### uploads/

- uploads/pages/：导入页面图片存储
- uploads/glyphs/：造字图片存储

### 古籍示例/

- 按场景组织的示例素材目录（标准样式、表格、不规则、顶格、封面、横排、图片）

## 核心模块说明

### 1. 前端编辑器模块（app.js）

- 管理全局状态：当前用户、当前文章、页面列表、标注选中态、标题树、造字集等
- 页面操作：导入图片/PDF、翻页、缩放、平移、清空
- 标注操作：
  - 支持 char/sentence/paragraph 三层级
  - 支持多区域（同一句跨行、多页）
  - 支持样式（高亮/边框/下划线）与属性编辑
- 标题索引：创建、拖拽重排、父子关系调整
- 造字库：新增、导入导出、从当前标注截取字形
- 协同：通过 Socket.IO 接收并应用其他用户的变更广播

### 2. API 模块（server/index.js）

按职责可分为：

- 系统与认证：
  - /api/health
  - /api/auth/login
  - /api/auth/me
- 用户管理（管理员）：
  - /api/auth/register
  - /api/users
  - /api/users/:userId
- 文章与权限：
  - /api/articles
  - /api/articles/:articleId
  - /api/articles/:articleId/access
- 页面与标注：
  - /api/articles/:articleId/pages/bulk
  - /api/pages/:pageId/annotations
  - /api/annotations/:annotationId
  - /api/annotations/:annotationId/regions
- OCR 与导出：
  - /api/ocr/recognize
  - /api/ocr/layout-detect
  - /api/articles/:articleId/export-xml

### 3. 数据层模块（server/db.js）

主要数据实体：

- articles：文章元信息
- pages：页面信息（尺寸、页号、资源路径）
- annotations：标注主记录（层级、样式、文本、审核状态等）
- annotation_regions：标注区域（支持跨行/跨页多矩形）
- headings：标题树结构（parent_id + order_index）
- glyphs：造字映射
- users：账号体系
- user_articles：用户-文章授权关系
- xml_versions：XML 版本记录

## 关键业务流程

### 1. 导入与标注流程

1. 前端导入图片/PDF，生成页面数据
2. 调用页面批量创建接口写入 pages
3. 用户在画布框选，创建 annotations + regions
4. 编辑属性后实时保存并广播给同页用户

### 2. 标题层级流程

1. 创建标题并可绑定当前标注/页位置
2. 通过拖拽修改 parent_id 和 order_index
3. 前端按树结构渲染并支持跳转定位

### 3. XML 导出流程

1. 后端读取 article snapshot
2. xml.js 将标注层级映射为 paragraph/sentence/word/char
3. 同步生成 view/svg 与 sources
4. 返回 XML 下载响应

## 与 XML-V0.1 的对应关系

- article/head/content/view/sources 五大段落均有实现
- content 中按 page_mode="1" 组织 page/panel/textfield
- 标注层级映射为 paragraph -> sentence -> word -> char
- view 中根据标注样式输出 rect/line/text

## 当前已解决的典型问题

- 同一句跨行：通过一个标注绑定多个矩形区域表示
- 同一句/段跨页：通过跨页区域机制处理
- 画布过于杂乱：仅突出显示当前选中标注区域
- 多人协作不同步：通过 Socket.IO 广播增量更新
- 标题关联弱：通过拖拽形成标题树层级关系

## 开发与维护建议

- OCR 配置：复制 server/ocr-config.example.json 为 server/ocr-config.json 后填入密钥
- 环境建议：Node.js 18+
- 生产部署前建议补充：
  - Token 过期与刷新策略
  - 更细粒度的协同冲突控制
  - API 参数校验与日志审计

## 后续可扩展方向

- 更丰富的 XML 模式支持（非 page_mode=1）
- 审校工作流（批注、通过/驳回、回溯）完善
- OCR 供应商扩展与识别后自动框选
- 大体量 PDF 的异步任务化导入与进度追踪

## 新成员上手指南

### 接口清单（按模块）

以下为高频接口速查，完整定义请以服务端路由实现为准：

| 模块     | 方法   | 路径                                           | 说明                   |
| -------- | ------ | ---------------------------------------------- | ---------------------- |
| 系统     | GET    | /api/health                                    | 健康检查               |
| 认证     | POST   | /api/auth/login                                | 用户登录               |
| 认证     | GET    | /api/auth/me                                   | 获取当前登录用户       |
| 用户管理 | POST   | /api/auth/register                             | 管理员创建用户         |
| 用户管理 | GET    | /api/users                                     | 管理员查看用户列表     |
| 用户管理 | PATCH  | /api/users/:userId                             | 管理员更新用户         |
| 用户管理 | DELETE | /api/users/:userId                             | 管理员删除用户         |
| 文章     | GET    | /api/articles                                  | 获取当前用户可访问文章 |
| 文章     | POST   | /api/articles                                  | 新建文章               |
| 文章     | DELETE | /api/articles/:articleId                       | 删除文章（管理员）     |
| 文章权限 | GET    | /api/articles/:articleId/access                | 查询文章授权用户       |
| 文章权限 | POST   | /api/articles/:articleId/access                | 为文章授权用户         |
| 文章权限 | DELETE | /api/articles/:articleId/access/:userId        | 取消用户文章权限       |
| 文章数据 | GET    | /api/articles/:articleId                       | 获取文章元信息         |
| 文章数据 | PUT    | /api/articles/:articleId                       | 更新文章元信息         |
| 快照     | GET    | /api/articles/:articleId/snapshot              | 获取文章完整快照       |
| 导出     | GET    | /api/articles/:articleId/export-xml            | 导出 XML               |
| 页面     | POST   | /api/articles/:articleId/pages/bulk            | 批量创建页面           |
| 页面     | DELETE | /api/articles/:articleId/pages                 | 清空文章页面           |
| 标注     | POST   | /api/pages/:pageId/annotations                 | 创建标注               |
| 标注     | PUT    | /api/annotations/:annotationId                 | 更新标注               |
| 标注审校 | PATCH  | /api/annotations/:annotationId                 | 审校状态更新           |
| 标注     | DELETE | /api/annotations/:annotationId                 | 删除标注               |
| 标注区域 | POST   | /api/annotations/:annotationId/regions         | 新增标注区域           |
| 标注区域 | GET    | /api/annotations/:annotationId/regions         | 获取标注区域           |
| 标注区域 | DELETE | /api/annotation-regions/:regionId              | 删除标注区域           |
| 标注区域 | PUT    | /api/annotations/:annotationId/regions/reorder | 区域重排               |
| 标注查询 | GET    | /api/pages/:pageId/annotations                 | 获取页内标注           |
| 标注查询 | GET    | /api/pages/:pageId/cross-page-annotations      | 获取跨页标注           |
| OCR      | POST   | /api/ocr/recognize                             | 识别选区文字           |
| OCR      | POST   | /api/ocr/layout-detect                         | 版面检测/自动框选辅助  |
| 造字     | GET    | /api/articles/:articleId/glyphs                | 获取造字映射           |
| 造字     | POST   | /api/articles/:articleId/glyphs                | 新增造字映射           |
| 造字     | DELETE | /api/glyphs/:glyphId                           | 删除造字映射           |
| 造字     | POST   | /api/articles/:articleId/glyphs/import         | 批量导入造字映射       |
| 标题     | POST   | /api/articles/:articleId/headings              | 创建标题               |
| 标题     | PATCH  | /api/articles/:articleId/headings/:headingId   | 更新标题层级/父子关系  |
| 标题     | POST   | /api/articles/:articleId/headings/reorder      | 标题重排               |
| 标题     | DELETE | /api/headings/:headingId                       | 删除标题               |

### 角色权限矩阵

| 功能                 | admin              | editor             | reviewer           |
| -------------------- | ------------------ | ------------------ | ------------------ |
| 登录与查看可访问文章 | 是                 | 是                 | 是                 |
| 创建文章             | 是                 | 是                 | 否                 |
| 删除文章             | 是                 | 否                 | 否                 |
| 用户管理（增删改查） | 是                 | 否                 | 否                 |
| 文章授权管理         | 是                 | 否                 | 否                 |
| 页面导入/清空        | 是                 | 是                 | 否                 |
| 标注创建/编辑/删除   | 是                 | 是                 | 否                 |
| 标注审校状态更新     | 是                 | 否                 | 是                 |
| 标题增删改与重排     | 是                 | 是                 | 否                 |
| 造字增删改导入导出   | 是                 | 是                 | 否                 |
| OCR 调用             | 是                 | 是                 | 否                 |
| XML 导出             | 是（需文章访问权） | 是（需文章访问权） | 是（需文章访问权） |

说明：

- 最终权限仍以后端鉴权中间件为准。
- 即使是管理员导出 XML，也要求能够访问目标文章。

### 开发调试清单

1. 基础检查

- Node 版本建议 18+
- 先执行 npm install 再执行 npm start
- 访问 /api/health 确认服务就绪

2. 登录与权限检查

- 先登录，再进行文章和标注操作
- 若出现 401，通常是 token 失效或未携带 Authorization
- 若出现 403，通常是角色权限或文章访问权不足

3. 数据与文件检查

- 核对 data/sdudoc.sqlite 是否生成
- 核对 uploads/pages 和 uploads/glyphs 是否有新文件落盘
- 若导入后页面为空，先检查前端请求是否成功，再查数据库 pages 表

4. OCR 调试

- 复制 server/ocr-config.example.json 为 server/ocr-config.json
- 确认 provider、apiKey、secretKey 配置有效
- 若 OCR 接口失败，优先检查配置与网络连通性

5. 协同同步检查

- 打开两个浏览器会话，进入同一文章/页面
- 在 A 端创建或修改标注，观察 B 端是否收到更新
- 若未同步，检查 Socket.IO 连接与页面房间加入逻辑

6. 导出检查

- 执行 XML 导出后，检查 article/head/content/view/sources 五段是否齐全
- 检查标注层级映射是否符合 paragraph -> sentence -> word -> char
- 检查 view 中图形元素与标注样式是否一致（rect 或 line）

7. 常见故障定位顺序

- 先看浏览器控制台错误
- 再看服务端终端报错
- 再核对请求路径、参数、权限
- 最后检查数据库记录与上传目录文件
