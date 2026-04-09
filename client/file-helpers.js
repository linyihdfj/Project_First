/**
 * @description filehelpers相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 处理exposefilehelpersfactory相关逻辑。
 * @param {*} global global参数。
 * @returns {*} filehelpersfactory结果。
 */
(function exposeFileHelpersFactory(global) {

  /**
   * @description 创建filehelpers。
   * @returns {*} filehelpers结果。
   */
  function createFileHelpers() {

    /**
     * @description 判断是否为pdffile。
     * @param {*} file file参数。
     * @returns {boolean} pdffile是否成立。
     */
    function isPdfFile(file) {
      const name = (file.name || "").toLowerCase();
      const type = (file.type || "").toLowerCase();
      return name.endsWith(".pdf") || type === "application/pdf";
    }

    /**
     * @description 判断是否为imagefile。
     * @param {*} file file参数。
     * @returns {boolean} imagefile是否成立。
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
     * @description 处理readfileasarraybuffer相关逻辑。
     * @param {*} file file参数。
     * @returns {*} fileasarraybuffer结果。
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
     * @description 处理readblobasdataurl相关逻辑。
     * @param {*} blob blob参数。
     * @returns {*} blobasdataurl结果。
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
     * @description 处理imageurldataurl相关逻辑。
     * @param {*} url url参数。
     * @returns {*} urldataurl结果。
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
     * @description 处理readfileasdataurl相关逻辑。
     * @param {*} file file参数。
     * @returns {*} fileasdataurl结果。
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

