(function exposeFileHelpersFactory(global) {
  /**
   * @description 创建文件处理辅助工具集合。
   * @returns {object} 文件类型判断与读取工具。
   */
  function createFileHelpers() {
    /**
     * @description 判断文件是否为 PDF。
     * @param {File} file 文件对象。
     * @returns {boolean}
     */
    function isPdfFile(file) {
      const name = (file.name || "").toLowerCase();
      const type = (file.type || "").toLowerCase();
      return name.endsWith(".pdf") || type === "application/pdf";
    }

    /**
     * @description 判断文件是否为图片。
     * @param {File} file 文件对象。
     * @returns {boolean}
     */
    function isImageFile(file) {
      const type = (file.type || "").toLowerCase();
      const name = (file.name || "").toLowerCase();
      return (
        type.startsWith("image/") ||
        /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(name)
      );
    }

    /**
     * @description 以 ArrayBuffer 形式读取文件。
     * @param {File|Blob} file 文件或二进制对象。
     * @returns {Promise<ArrayBuffer>}
     */
    function readFileAsArrayBuffer(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(reader.error || new Error("读取文件失败"));
        reader.readAsArrayBuffer(file);
      });
    }

    /**
     * @description 以 Data URL 形式读取 Blob。
     * @param {Blob} blob 二进制对象。
     * @returns {Promise<string>}
     */
    function readBlobAsDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(reader.error || new Error("读取文件失败"));
        reader.readAsDataURL(blob);
      });
    }

    /**
     * @description 拉取远端图片并转为 Data URL。
     * @param {string} url 图片地址。
     * @returns {Promise<string>}
     */
    async function imageUrlToDataUrl(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`示例图片读取失败: ${url}`);
      }
      const blob = await response.blob();
      return readBlobAsDataUrl(blob);
    }

    /**
     * @description 以 Data URL 形式读取文件。
     * @param {File|Blob} file 文件或二进制对象。
     * @returns {Promise<string>}
     */
    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }

    return {
      isPdfFile,
      isImageFile,
      readFileAsArrayBuffer,
      imageUrlToDataUrl,
      readFileAsDataUrl,
    };
  }

  global.createFileHelpers = createFileHelpers;
})(window);
