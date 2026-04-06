(function exposeFileHelpersFactory(global) {

  function createFileHelpers() {

    function isPdfFile(file) {
      const name = (file.name || "").toLowerCase();
      const type = (file.type || "").toLowerCase();
      return name.endsWith(".pdf") || type === "application/pdf";
    }

    function isImageFile(file) {
      const type = (file.type || "").toLowerCase();
      const name = (file.name || "").toLowerCase();
      return (
        type.startsWith("image/") ||
        /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(name)
      );
    }

    function readFileAsArrayBuffer(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(reader.error || new Error("读取文件失败"));
        reader.readAsArrayBuffer(file);
      });
    }

    function readBlobAsDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(reader.error || new Error("读取文件失败"));
        reader.readAsDataURL(blob);
      });
    }

    async function imageUrlToDataUrl(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`示例图片读取失败: ${url}`);
      }
      const blob = await response.blob();
      return readBlobAsDataUrl(blob);
    }

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
