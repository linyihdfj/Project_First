/**
 * @description staticHTTP 辅助模块，负责请求与响应相关的通用逻辑。
 */
const express = require("express");
const path = require("path");

/**
 * @description 注册静态资源目录和前端入口回退路由。
 * @param {*} app Express 应用实例。
 * @param {*} projectRoot 项目根目录路径。
 * @returns {void} 无返回值。
 */
function registerStaticRoutes(app, projectRoot) {
  app.use(
    "/uploads",
    express.static(path.join(projectRoot, "uploads"), {
      maxAge: "7d",
      immutable: true,
    }),
  );
  app.use(express.static(projectRoot));

  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ ok: false, message: "接口不存在" });
      return;
    }
    next();
  });

  app.get("*", (req, res) => {
    res.sendFile(path.join(projectRoot, "index.html"));
  });
}

module.exports = {
  registerStaticRoutes,
};

