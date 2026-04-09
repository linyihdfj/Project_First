/**
 * @description canvasviewtools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建canvasviewtools。
 * @param {*} deps 模块依赖集合。
 * @returns {*} canvasviewtools结果。
 */
window.createCanvasViewTools = function createCanvasViewTools(deps) {
  const navTools = window.createCanvasNavigationTools(deps);
  const regionTools = window.createRegionHitTools({
    ...deps,
    getCurrentPage: navTools.getCurrentPage,
  });

  return {
    ...navTools,
    ...regionTools,
  };
};

