/**
 * @description imagecache相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 处理exposeimagecachefactory相关逻辑。
 * @param {*} global global参数。
 * @returns {*} imagecachefactory结果。
 */
(function exposeImageCacheFactory(global) {

  /**
   * @description 创建imagecache。
   * @param {*} apiRequest apirequest参数。
   * @returns {*} imagecache结果。
   */
  function createImageCache(apiRequest) {
    const imageCache = new Map();
    const imageCacheLoading = new Map();

    /**
     * @description 预加载image。
     * @param {*} src src参数。
     * @returns {*} image结果。
     */
    function preloadImage(src) {
      if (!src || imageCache.has(src) || imageCacheLoading.has(src)) {
        return;
      }
      const promise = fetch(src)
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          imageCache.set(src, blobUrl);
          imageCacheLoading.delete(src);
          return blobUrl;
        })
        .catch(() => {
          imageCacheLoading.delete(src);
          return null;
        });
      imageCacheLoading.set(src, promise);
    }

    /**
     * @description 获取cachedimageurl。
     * @param {*} src src参数。
     * @returns {*} cachedimageurl结果。
     */
    function getCachedImageUrl(src) {
      return imageCache.get(src) || src;
    }

    /**
     * @description 等待image。
     * @param {*} src src参数。
     * @returns {*} image结果。
     */
    async function waitForImage(src) {
      if (imageCache.has(src)) return imageCache.get(src);
      if (imageCacheLoading.has(src)) return await imageCacheLoading.get(src);
      return src;
    }

    /**
     * @description 预加载adjacentpages。
     * @param {*} currentIndex currentindex参数。
     * @param {*} pages pages参数。
     * @param {*} range range参数。
     * @returns {*} adjacentpages结果。
     */
    function preloadAdjacentPages(currentIndex, pages, range = 3) {
      const start = Math.max(0, currentIndex - range);
      const end = Math.min(pages.length - 1, currentIndex + range);
      for (let i = start; i <= end; i++) {
        if (pages[i] && pages[i].src) {
          preloadImage(pages[i].src);
        }
      }
    }

    /**
     * @description 预加载articlefirstpages。
     * @param {*} articles 文章列表。
     * @returns {*} articlefirstpages结果。
     */
    async function preloadArticleFirstPages(articles) {
      for (const article of articles) {
        try {
          const data = await apiRequest(
            `/articles/${encodeURIComponent(article.id)}/page-srcs?limit=3`,
          );
          (data.srcs || []).forEach(preloadImage);
        } catch (error) {}
      }
    }

    return {
      preloadImage,
      getCachedImageUrl,
      waitForImage,
      preloadAdjacentPages,
      preloadArticleFirstPages,
    };
  }

  global.createImageCache = createImageCache;
})(window);

