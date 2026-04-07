/**
 * @description 组合画布导航与区域命中能力，向上层暴露统一画布视图工具集。
 * @param {object} deps 依赖注入对象。
 * @returns {object} 合并后的画布视图工具。
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
