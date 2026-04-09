/**
 * @description filepdfutils相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 处理exposefilepdfutilsfactory相关逻辑。
 * @param {*} global global参数。
 * @returns {*} filepdfutilsfactory结果。
 */
(function exposeFilePdfUtilsFactory(global) {

  /**
   * @description 创建filepdfutils。
   * @param {*} createPageFromImage createpageimage参数。
   * @returns {*} filepdfutils结果。
   */
  function createFilePdfUtils(createPageFromImage) {
    const PDF_JS_SOURCES = [
      {
        lib: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
        worker:
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
      },
      {
        lib: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
        worker:
          "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
      },
      {
        lib: "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js",
        worker: "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
      },
    ];

    let pdfJsLoadingPromise = null;
    let activePdfWorkerSrc = PDF_JS_SOURCES[0].worker;
    const {
      isPdfFile,
      isImageFile,
      readFileAsArrayBuffer,
      imageUrlToDataUrl,
      readFileAsDataUrl,
    } = global.createFileHelpers();

    /**
     * @description 加载scriptonce。
     * @param {*} src src参数。
     * @returns {*} scriptonce结果。
     */
    function loadScriptOnce(src) {
      return new Promise((resolve, reject) => {
        const exists = document.querySelector(`script[data-src="${src}"]`);
        if (exists) {
          if (exists.dataset.loaded === "1") {
            resolve();
          } else {
            exists.addEventListener("load", () => resolve(), { once: true });
            exists.addEventListener(
              "error",
              () => reject(new Error(`脚本加载失败: ${src}`)),
              { once: true },
            );
          }
          return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.dataset.src = src;
        script.addEventListener(
          "load",
          () => {
            script.dataset.loaded = "1";
            resolve();
          },
          { once: true },
        );
        script.addEventListener(
          "error",
          () => reject(new Error(`脚本加载失败: ${src}`)),
          { once: true },
        );
        document.head.appendChild(script);
      });
    }

    /**
     * @description 加载pdfjsanycdn。
     * @returns {*} pdfjsanycdn结果。
     */
    async function loadPdfJsFromAnyCdn() {
      let lastError = null;
      for (const source of PDF_JS_SOURCES) {
        try {
          await loadScriptOnce(source.lib);
          activePdfWorkerSrc = source.worker;
          return;
        } catch (error) {
          lastError = error;
          console.warn(`PDF 引擎 CDN 加载失败: ${source.lib}`);
        }
      }
      throw lastError || new Error("PDF 引擎脚本加载失败");
    }

    /**
     * @description 判断是否为workerlikelyblocked。
     * @param {*} error error参数。
     * @returns {boolean} workerlikelyblocked是否成立。
     */
    function isWorkerLikelyBlocked(error) {
      const message = String((error && error.message) || error || "");
      return /worker|cross-origin|origin|Failed to construct 'Worker'|Cannot load script/i.test(
        message,
      );
    }

    /**
     * @description 加载pdfdocument。
     * @param {*} pdfjsLib pdfjslib参数。
     * @param {*} buffer buffer参数。
     * @returns {*} pdfdocument结果。
     */
    async function loadPdfDocument(pdfjsLib, buffer) {
      const data =
        buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
      if (window.location.protocol === "file:") {
        return pdfjsLib.getDocument({ data, disableWorker: true }).promise;
      }

      try {
        return await pdfjsLib.getDocument({ data }).promise;
      } catch (error) {
        if (!isWorkerLikelyBlocked(error)) {
          throw error;
        }
        console.warn("PDF Worker 不可用，回退为主线程解析。", error);
        return pdfjsLib.getDocument({ data, disableWorker: true }).promise;
      }
    }

    /**
     * @description 处理ensurepdfjsloaded相关逻辑。
     * @returns {void} 无返回值。
     */
    async function ensurePdfJsLoaded() {
      if (window.pdfjsLib && window.pdfjsLib.getDocument) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = activePdfWorkerSrc;
        return window.pdfjsLib;
      }

      if (!pdfJsLoadingPromise) {
        pdfJsLoadingPromise = loadPdfJsFromAnyCdn()
          .then(() => {
            if (!window.pdfjsLib || !window.pdfjsLib.getDocument) {
              throw new Error("PDF 引擎初始化失败");
            }
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = activePdfWorkerSrc;
            return window.pdfjsLib;
          })
          .finally(() => {
            pdfJsLoadingPromise = null;
          });
      }

      return pdfJsLoadingPromise;
    }

    /**
     * @description 处理extractpdfpagesasimages相关逻辑。
     * @param {*} file file参数。
     * @param {*} options options参数。
     * @returns {*} pdfpagesasimages结果。
     */
    async function extractPdfPagesAsImages(file, options = {}) {
      const { onProgress } = options;
      const pdfjsLib = await ensurePdfJsLoaded();
      const buffer = await readFileAsArrayBuffer(file);
      const pdf = await loadPdfDocument(pdfjsLib, buffer);
      const pages = [];
      const total = pdf.numPages;

      for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.8 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        const src = canvas.toDataURL("image/png");
        pages.push(
          createPageFromImage(
            src,
            `${file.name} - 第${pageNumber}页`,
            canvas.width,
            canvas.height,
          ),
        );

        if (typeof onProgress === "function") {
          onProgress({
            fileName: file.name,
            current: pageNumber,
            total,
          });
        }
      }

      return pages;
    }

    return {
      isPdfFile,
      isImageFile,
      readFileAsDataUrl,
      imageUrlToDataUrl,
      extractPdfPagesAsImages,
    };
  }

  global.createFilePdfUtils = createFilePdfUtils;
})(window);

