# 古籍整理协作平台

这是一个面向古籍数字整理场景的全栈 Web 应用。项目把“页面导入、图像标注、标题层级整理、造字管理、多人协作、OCR 辅助识别、XML 导出”整合在同一套系统里，适合作为课程项目、原型系统或继续扩展的基础工程。

项目当前已经完成最近一轮代码收敛：

- 删除了未接线的旧 DOM、无入口的旧样式和无调用方的辅助接口。
- 保留了当前网页仍会实际走到的能力，包括段级/句级 OCR 依赖的 `layout-detect` 流程。
- 前后端都改成了更清晰的模块化组织，`app.js` 只负责装配前端模块，`server/` 负责路由、数据库、OCR、Socket 和 XML 生成。

## 主要功能

- 用户登录、邀请注册和基于角色的权限控制
- 文章列表、文章创建、文章删除、文章权限分配与邀请链接
- 页面图片与 PDF 导入，生成页面数据并进入编辑界面
- 页面级图像浏览、缩放、拖拽、翻页与页码跳转
- 标注创建、区域增删改、跨区域标注、层级标注维护
- 标题树管理、标题拖拽排序、标题与标注联动
- 造字截图、造字库维护、造字导入导出与标注引用
- 审校状态展示与多人实时协作同步
- OCR 选区识别、版面检测、句/段识别辅助
- 文章快照导出 XML
- 繁简转换辅助接口

## 技术栈

### 前端

- 原生 `HTML` + `CSS` + `JavaScript`
- 无构建步骤，浏览器直接加载 `index.html`、`styles.css`、`app.js` 与 `client/*.js`
- 前端模块通过 `window.createXxxTools()` 形式暴露工厂函数，由 `app.js` 统一装配

### 后端

- `Node.js`
- `Express`
- `Socket.IO`
- `SQLite3`
- `sharp`
- `opencc-js`

### 可选外部能力

- OCR Provider（当前服务端支持通过配置文件接入）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

开发环境也可以直接使用：

```bash
npm run dev
```

默认监听地址：

- `http://localhost:3000`

服务入口在 [server/index.js](/C:/Users/13702/Desktop/project_learning/project_first/server/index.js)。

## OCR 配置

OCR 能力通过服务端配置文件加载。

1. 复制 [server/ocr-config.example.json](/C:/Users/13702/Desktop/project_learning/project_first/server/ocr-config.example.json)
2. 新建 `server/ocr-config.json`
3. 按实际 Provider 填入配置

如果没有配置 OCR，系统的基础编辑功能仍可运行，但 OCR 接口不会返回可用结果。

OCR 相关实现位于：

- [server/ocr.js](/C:/Users/13702/Desktop/project_learning/project_first/server/ocr.js)
- [server/routes/ocr.js](/C:/Users/13702/Desktop/project_learning/project_first/server/routes/ocr.js)

## 目录结构

```text
project_first/
├─ app.js
├─ index.html
├─ styles.css
├─ README.md
├─ package.json
├─ test-hierarchy.js
├─ client/
├─ server/
├─ data/
├─ uploads/
├─ 古籍示例/
├─ XML-V0.1.docx
├─ 作业二说明.docx
└─ 说明.txt
```

### 顶层文件

- [app.js](/C:/Users/13702/Desktop/project_learning/project_first/app.js)：前端总装配入口，负责依赖注入、模块联动和启动流程
- [index.html](/C:/Users/13702/Desktop/project_learning/project_first/index.html)：单页应用的静态 DOM 骨架
- [styles.css](/C:/Users/13702/Desktop/project_learning/project_first/styles.css)：全局样式与界面布局
- [test-hierarchy.js](/C:/Users/13702/Desktop/project_learning/project_first/test-hierarchy.js)：层级相关接口回归脚本

### `client/`

`client/` 目录中的文件按能力拆分，例如：

- 认证与权限：`auth-permissions.js`、`auth-storage.js`
- 文章与权限管理：`article-select-tools.js`、`article-access-tools.js`
- 页面与画布：`page-import-tools.js`、`page-render-tools.js`、`canvas-navigation-tools.js`
- 标注与区域：`annotation-*.js`、`region-*.js`、`overlay-render-tools.js`
- 标题与审校：`heading-tools.js`、`review-status-tools.js`
- 造字与文件：`glyph-*.js`、`file-helpers.js`、`file-pdf-utils.js`
- 协作：`socket-collab-tools.js`、`socket-event-handlers.js`
- 基础设施：`refs.js`、`state.js`、`utils.js`、`api-client.js`

### `server/`

`server/` 目录负责服务端能力：

- [server/index.js](/C:/Users/13702/Desktop/project_learning/project_first/server/index.js)：Express 入口和依赖装配
- [server/bootstrap.js](/C:/Users/13702/Desktop/project_learning/project_first/server/bootstrap.js)：启动初始化
- [server/db.js](/C:/Users/13702/Desktop/project_learning/project_first/server/db.js)：SQLite 数据访问层
- [server/socket.js](/C:/Users/13702/Desktop/project_learning/project_first/server/socket.js)：Socket.IO 协作层
- [server/ocr.js](/C:/Users/13702/Desktop/project_learning/project_first/server/ocr.js)：OCR Provider 封装与图片裁剪
- [server/xml.js](/C:/Users/13702/Desktop/project_learning/project_first/server/xml.js)：XML 快照生成
- [server/text-convert.js](/C:/Users/13702/Desktop/project_learning/project_first/server/text-convert.js)：繁简转换
- `server/routes/*.js`：按业务拆分的 HTTP 路由模块
- `server/http/*.js`：请求/响应与静态资源辅助
- `server/middleware/*.js`：认证与权限中间件
- `server/config/*.js`：服务端运行配置

## 前端结构说明

前端是一个无构建流程的原生 JavaScript 单页应用。

### 页面层

- [index.html](/C:/Users/13702/Desktop/project_learning/project_first/index.html) 预先放置登录层、文章选择页、编辑页、权限弹窗、造字弹窗等容器
- [styles.css](/C:/Users/13702/Desktop/project_learning/project_first/styles.css) 负责主布局、面板、工具栏、弹窗、标注树、表单与状态样式

### 装配层

- [app.js](/C:/Users/13702/Desktop/project_learning/project_first/app.js) 创建状态、引用、API 请求器，再把各个 `client/*.js` 工厂模块串起来
- 这里不再保留无调用方的旧包装层，当前保留的函数都参与真实页面流程

### 模块层

前端模块基本遵循“工厂函数 + 内部具名函数”的组织方式：

- 工厂函数接收 `deps`
- 内部函数处理具体 UI、数据同步或事件绑定
- 最后只返回外部真正需要的最小接口

## 后端结构说明

后端通过一个 Express 进程同时提供 API、静态资源和协作能力。

### 启动流程

1. [server/index.js](/C:/Users/13702/Desktop/project_learning/project_first/server/index.js) 创建 `app`、`httpServer` 与中间件
2. 装配数据库、权限中间件、OCR、XML、Socket 相关依赖
3. 调用 [server/routes/index.js](/C:/Users/13702/Desktop/project_learning/project_first/server/routes/index.js) 注册全部业务路由
4. 调用 [server/bootstrap.js](/C:/Users/13702/Desktop/project_learning/project_first/server/bootstrap.js) 初始化数据库并监听端口

### 路由分层

当前路由按业务拆分，包括：

- 认证与用户：`auth.js`、`users.js`
- 文章与页面：`articles.js`、`article-pages.js`、`article-export.js`
- 标注与区域：`annotations.js`、`annotation-regions.js`
- 邀请与权限：`article-invites.js`
- OCR 与文本转换：`ocr.js`、`text-convert.js`
- 造字与标题：`glyphs.js`、`headings.js`

说明：

- 旧的 `/api/health` 已经移除，不再作为当前文档的一部分
- `/api/ocr/layout-detect` 仍然保留，并且仍被前端句/段 OCR 流程使用

## 数据与存储

### SQLite

默认数据库文件：

- `data/sdudoc.sqlite`

数据库访问层位于 [server/db.js](/C:/Users/13702/Desktop/project_learning/project_first/server/db.js)。

### 上传目录

- 页面图片：`uploads/pages/`
- 造字图片：`uploads/glyphs/`

### 快照与导出

- XML 导出基于文章快照生成
- 相关逻辑位于 [server/xml.js](/C:/Users/13702/Desktop/project_learning/project_first/server/xml.js)

## 协作与权限模型

### 角色

系统同时存在全局角色与文章内角色：

- 全局角色：用于用户管理与更高层级权限控制
- 文章角色：用于文章级的查看、编辑、审校、授权等能力

### 协作

- Socket 房间按文章和页面维度组织
- 支持在线成员显示
- 支持远端标注、区域、标题、造字等变更同步

协作逻辑位于：

- [server/socket.js](/C:/Users/13702/Desktop/project_learning/project_first/server/socket.js)
- [client/socket-collab-tools.js](/C:/Users/13702/Desktop/project_learning/project_first/client/socket-collab-tools.js)
- [client/socket-event-handlers.js](/C:/Users/13702/Desktop/project_learning/project_first/client/socket-event-handlers.js)

## 与 OCR / XML 相关的当前状态

### OCR

- 字级 OCR：支持对单个选区识别文本
- 句级 / 段级 OCR：前端会先走版面检测，再生成子标注
- 当前页面确实还在使用 `layout-detect` 链路，因此该能力没有被清理掉

### XML

- 可从当前文章快照导出 XML
- 适用于结构化整理结果的保存与展示

## 测试与资料

- [test-hierarchy.js](/C:/Users/13702/Desktop/project_learning/project_first/test-hierarchy.js)：层级行为的接口测试脚本
- `古籍示例/`：示例素材
- `XML-V0.1.docx`、`作业二说明.docx`、`说明.txt`：说明文档与作业材料

## 开发说明

- 项目当前没有前端打包流程，修改前端文件后刷新浏览器即可看到结果
- 代码中已经统一补齐文件头注释与具名函数注释，方便继续维护
- 如果继续扩展，建议保持当前“工厂函数 + 依赖注入 + 最小返回面”的模块组织方式
