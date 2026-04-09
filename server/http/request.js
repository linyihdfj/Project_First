/**
 * @description requestHTTP 辅助模块，负责请求与响应相关的通用逻辑。
 */
/**
 * @description 从请求对象中提取文章 ID。
 * @param {*} req Express 请求对象。
 * @returns {*} idreq结果。
 */
function articleIdFromReq(req) {
  return String(req.params.articleId || "article-1").trim() || "article-1";
}

module.exports = {
  articleIdFromReq,
};

