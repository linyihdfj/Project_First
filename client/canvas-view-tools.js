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
