window.createAnnotationSelectionTools = function createAnnotationSelectionTools(
  deps,
) {
  const {
    state,
    annotationSaveTimers,
    apiRequest,
    getCurrentPage,
    recalcParentTextFromChildren,
    renderAll,
  } = deps;

  function getSelectedAnnotation() {
    const page = getCurrentPage();
    if (!page || !state.selectedAnnotationId) {
      return null;
    }
    return (
      page.annotations.find((ann) => ann.id === state.selectedAnnotationId) ||
      null
    );
  }

  function getAnnotationById(annotationId) {
    if (!annotationId) {
      return null;
    }
    const currentPage = getCurrentPage();
    if (currentPage) {
      const currentPageAnn = currentPage.annotations.find(
        (item) => item.id === annotationId,
      );
      if (currentPageAnn) {
        return currentPageAnn;
      }
    }
    for (const page of state.pages) {
      const ann = page.annotations.find((item) => item.id === annotationId);
      if (ann) {
        return ann;
      }
    }
    return null;
  }

  function scheduleAnnotationPersist(ann) {
    if (!ann || !ann.id) {
      return;
    }

    const annotationId = ann.id;

    if (annotationSaveTimers.has(annotationId)) {
      clearTimeout(annotationSaveTimers.get(annotationId));
    }

    const timer = window.setTimeout(async () => {
      annotationSaveTimers.delete(annotationId);
      try {
        const latestAnn =
          state.selectedAnnotationId === annotationId
            ? getSelectedAnnotation() || getAnnotationById(annotationId)
            : getAnnotationById(annotationId);
        if (!latestAnn) {
          return;
        }
        await apiRequest(`/annotations/${encodeURIComponent(annotationId)}`, {
          method: "PUT",
          body: latestAnn,
        });
      } catch (error) {
        alert(error.message);
      }
    }, 300);

    annotationSaveTimers.set(annotationId, timer);
  }

  async function removeSelectedAnnotation() {
    const page = getCurrentPage();
    if (!page || !state.selectedAnnotationId) {
      return;
    }
    const removedAnnotationId = state.selectedAnnotationId;
    const removedAnn = page.annotations.find(
      (a) => a.id === removedAnnotationId,
    );
    const parentId = removedAnn ? removedAnn.parentId : null;

    await apiRequest(
      `/annotations/${encodeURIComponent(state.selectedAnnotationId)}`,
      {
        method: "DELETE",
      },
    );

    for (const p of state.pages) {
      p.annotations = p.annotations.filter(
        (ann) => ann.id !== removedAnnotationId,
      );
    }
    if (annotationSaveTimers.has(removedAnnotationId)) {
      clearTimeout(annotationSaveTimers.get(removedAnnotationId));
      annotationSaveTimers.delete(removedAnnotationId);
    }
    state.headings.forEach((heading) => {
      if (heading.annotationId === removedAnnotationId) {
        heading.annotationId = null;
      }
    });
    state.selectedAnnotationId = parentId || null;
    if (
      state.selectedHeadingId &&
      !state.headings.some((heading) => heading.id === state.selectedHeadingId)
    ) {
      state.selectedHeadingId = null;
    }

    if (parentId) {
      recalcParentTextFromChildren(parentId);
      const idsToFlush = [parentId];
      let cur = null;
      for (const p of state.pages) {
        cur = p.annotations.find((a) => a.id === parentId);
        if (cur) break;
      }
      if (cur && cur.parentId) idsToFlush.push(cur.parentId);
      for (const flushId of idsToFlush) {
        if (annotationSaveTimers.has(flushId)) {
          clearTimeout(annotationSaveTimers.get(flushId));
          annotationSaveTimers.delete(flushId);
        }
        let flushAnn = null;
        for (const p of state.pages) {
          flushAnn = p.annotations.find((a) => a.id === flushId);
          if (flushAnn) break;
        }
        if (flushAnn) {
          await apiRequest(`/annotations/${encodeURIComponent(flushId)}`, {
            method: "PUT",
            body: flushAnn,
          });
        }
      }
    }
    renderAll();
  }

  return {
    getSelectedAnnotation,
    getAnnotationById,
    scheduleAnnotationPersist,
    removeSelectedAnnotation,
  };
};
