(function exposeImageCacheFactory(global) {
  /**
   * @description 创建图片缓存工具，支持页面和文章级预加载。
   * @param {(pathname:string, options?:object)=>Promise<any>} apiRequest 通用请求函数。
   * @returns {object} 图片缓存与预加载方法。
   */
  function createImageCache(apiRequest) {
    const imageCache = new Map();
    const imageCacheLoading = new Map();

    /**
     * @description 异步预加载图片并缓存 Blob URL。
     * @param {string} src 图片地址。
     * @returns {void}
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
     * @description 获取缓存后的图片地址，未命中则返回原地址。
     * @param {string} src 原始地址。
     * @returns {string}
     */
    function getCachedImageUrl(src) {
      return imageCache.get(src) || src;
    }

    /**
     * @description 等待指定图片预加载完成。
     * @param {string} src 图片地址。
     * @returns {Promise<string|null>} 可用图片地址。
     */
    async function waitForImage(src) {
      if (imageCache.has(src)) return imageCache.get(src);
      if (imageCacheLoading.has(src)) return await imageCacheLoading.get(src);
      return src;
    }

    /**
     * @description 预加载当前页附近的若干页面图片。
     * @param {number} currentIndex 当前页索引。
     * @param {Array<object>} pages 页面数组。
     * @param {number} [range=3] 前后预加载范围。
     * @returns {void}
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
     * @description 为文章列表预加载每篇文章前几页图片。
     * @param {Array<object>} articles 文章数组。
     * @returns {Promise<void>}
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
