/**
 * @description 组合区域拖拽与新建能力，暴露统一的区域绘制交互工具。
 * @param {object} deps 依赖注入对象。
 * @returns {object} 区域绘制相关工具集合。
 */
window.createRegionDrawTools = function createRegionDrawTools(deps) {
  const dragTools = window.createRegionDragTools(deps);
  const createTools = window.createRegionCreateTools({
    ...deps,
    ...dragTools,
  });

  return {
    ...dragTools,
    ...createTools,
  };
};
