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
