const express = require("express");
const path = require("path");

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
