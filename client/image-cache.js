(function exposeImageCacheFactory(global) {

  function createImageCache(apiRequest) {
    const imageCache = new Map();
    const imageCacheLoading = new Map();

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

    function getCachedImageUrl(src) {
      return imageCache.get(src) || src;
    }

    async function waitForImage(src) {
      if (imageCache.has(src)) return imageCache.get(src);
      if (imageCacheLoading.has(src)) return await imageCacheLoading.get(src);
      return src;
    }

    function preloadAdjacentPages(currentIndex, pages, range = 3) {
      const start = Math.max(0, currentIndex - range);
      const end = Math.min(pages.length - 1, currentIndex + range);
      for (let i = start; i <= end; i++) {
        if (pages[i] && pages[i].src) {
          preloadImage(pages[i].src);
        }
      }
    }

    async function preloadArticleFirstPages(articles) {
      for (const article of articles) {
        try {
          const data = await apiRequest(
            `/articles/${encodeURIComponent(article.id)}/page-srcs?limit=3`,
          );
          (data.srcs || []).forEach(preloadImage);
        } catch (error) {

        }
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
