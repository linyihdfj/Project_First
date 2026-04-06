window.createRegionCreateHelpers = function createRegionCreateHelpers(deps) {
  const {
    state,
    refs,
    uid,
    apiRequest,
    drawOverlay,
    renderAll,
    reloadPageAnnotations,
    getRegionFromAnnotation,
    syncRegionAcrossPages,
  } = deps;

  function buildDraftPayload(body) {
    return {
      ...body,
      id: uid("ann"),
      charId: uid("char"),
      level: refs.annotationLevel.value,
      style: "highlight",
      color: "#d5533f",
      originalText: "",
      simplifiedText: "",
      note: "",
      noteType: "1",
      charCode: "",
      glyphRef: "",
    };
  }

  async function persistDraggedRegion() {
    const dragState = state.regionResize || state.regionMove;
    if (!dragState) return false;

    const key = state.regionResize ? "regionResize" : "regionMove";
    const label = state.regionResize ? "调整区域" : "移动区域";
    state[key] = null;

    const region = getRegionFromAnnotation(
      dragState.annotationId,
      dragState.regionId,
    );
    if (!region) {
      drawOverlay();
      return true;
    }

    const nextRect = {
      x: Math.round(Number(region.x)),
      y: Math.round(Number(region.y)),
      width: Math.round(Number(region.width)),
      height: Math.round(Number(region.height)),
    };
    const origin = dragState.origin;
    const changed =
      nextRect.x !== Math.round(origin.x) ||
      nextRect.y !== Math.round(origin.y) ||
      nextRect.width !== Math.round(origin.width) ||
      nextRect.height !== Math.round(origin.height);

    if (!changed) {
      drawOverlay();
      return true;
    }

    try {
      await apiRequest(
        `/annotation-regions/${encodeURIComponent(dragState.regionId)}`,
        {
          method: "PUT",
          body: nextRect,
        },
      );
      renderAll();
    } catch (error) {
      syncRegionAcrossPages(
        dragState.annotationId,
        dragState.regionId,
        dragState.origin,
      );
      drawOverlay();
      alert(`${label}失败：${error.message}`);
    }

    return true;
  }

  async function addRegionToExisting(page, body) {
    const targetAnnotationId = state.addingRegionForAnnotation;
    try {
      const payload = await apiRequest(
        `/annotations/${encodeURIComponent(targetAnnotationId)}/regions`,
        { method: "POST", body },
      );
      const createdRegionId =
        payload && payload.region && payload.region.id
          ? payload.region.id
          : null;

      state.addingRegionForAnnotation = null;
      await reloadPageAnnotations(page);
      state.selectedAnnotationId = targetAnnotationId;
      state.selectedHeadingId = null;

      if (createdRegionId) {
        state.selectedRegionId = createdRegionId;
      } else {
        const targetAnnotation = (page.annotations || []).find(
          (ann) => ann.id === targetAnnotationId,
        );
        const regions =
          targetAnnotation && Array.isArray(targetAnnotation.regions)
            ? targetAnnotation.regions
            : [];
        state.selectedRegionId = regions.length
          ? regions[regions.length - 1].id
          : null;
      }

      renderAll();
    } catch (error) {
      alert("添加区域失败：" + error.message);
    }
  }

  return {
    buildDraftPayload,
    persistDraggedRegion,
    addRegionToExisting,
  };
};
