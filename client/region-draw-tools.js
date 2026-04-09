/**
 * @description regiondrawtools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建regiondrawtools。
 * @param {*} deps 模块依赖集合。
 * @returns {*} regiondrawtools结果。
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

