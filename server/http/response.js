/**
 * @description responseHTTP 辅助模块，负责请求与响应相关的通用逻辑。
 */
/**
 * @description 向客户端发送统一格式的错误响应。
 * @param {*} res Express 响应对象。
 * @param {*} error error参数。
 * @param {*} statusCode statuscode参数。
 * @returns {*} error结果。
 */
function sendError(res, error, statusCode = 400) {
  res.status(statusCode).json({
    ok: false,
    message: error && error.message ? error.message : String(error),
  });
}

module.exports = {
  sendError,
};

