function articleIdFromReq(req) {
  return String(req.params.articleId || "article-1").trim() || "article-1";
}

module.exports = {
  articleIdFromReq,
};
