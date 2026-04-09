/**
 * @description index配置模块，负责整理服务端运行参数。
 */
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

module.exports = {
  PORT,
  PROJECT_ROOT,
};

