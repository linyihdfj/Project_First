window.createAnnotationHierarchyTools = function createAnnotationHierarchyTools(
  deps,
) {
  const {
    state,
    refs,
    escapeHtml,
    isEditor,
    canReview,
    apiRequest,
    getCurrentPage,
    getAnnotationById,
    levelLabel,
    renderAll,
    scheduleAnnotationPersist,
    annotationSaveTimers,
    setReviewStatus,
  } = deps;

  function recalcParentTextFromChildren(parentId) {
    if (!parentId) return;
    const currentPage = getCurrentPage();
    const currentPageId = currentPage ? currentPage.id : null;

    const parentCopies = [];
    for (const page of state.pages) {
      for (const ann of page.annotations) {
        if (ann.id === parentId) {
          parentCopies.push({ pageId: page.id, ann });
        }
      }
    }
    if (!parentCopies.length) return;

    const parentEntry =
      parentCopies.find((item) => item.pageId === currentPageId) ||
      parentCopies[0];
    const parent = parentEntry.ann;
    if (parent.level !== "paragraph" && parent.level !== "sentence") return;

    const childrenMap = new Map();

    function scoreTextCompleteness(ann) {
      return (
        String(ann.originalText || "").length +
        String(ann.simplifiedText || "").length
      );
    }

    for (const page of state.pages) {
      for (const ann of page.annotations) {
        if (ann.parentId !== parentId) continue;
        const existing = childrenMap.get(ann.id);
        if (!existing) {
          childrenMap.set(ann.id, { pageId: page.id, ann });
          continue;
        }
        const existingIsCurrent = existing.pageId === currentPageId;
        const candidateIsCurrent = page.id === currentPageId;
        const existingScore = scoreTextCompleteness(existing.ann);
        const candidateScore = scoreTextCompleteness(ann);
        if (
          (!existingIsCurrent && candidateIsCurrent) ||
          (existingIsCurrent === candidateIsCurrent &&
            candidateScore > existingScore)
        ) {
          childrenMap.set(ann.id, { pageId: page.id, ann });
        }
      }
    }

    const children = [...childrenMap.values()].map((item) => item.ann);
    children.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    const nextOriginalText = children
      .map((child) => child.originalText || "")
      .join("");
    const nextSimplifiedText = children
      .map((child) => child.simplifiedText || "")
      .join("");

    for (const item of parentCopies) {
      item.ann.originalText = nextOriginalText;
      item.ann.simplifiedText = nextSimplifiedText;
    }

    scheduleAnnotationPersist(parent);
    if (parent.parentId) {
      recalcParentTextFromChildren(parent.parentId);
    }
  }

  async function reparentAnnotation(childId, newParentId) {
    const page = getCurrentPage();
    if (!page) return;

    const child = getAnnotationById(childId);
    const parent = getAnnotationById(newParentId);
    if (!child || !parent) return;
    if (parent.parentId === childId) return;
    if (childId === newParentId) return;

    const siblingIds = new Set();
    for (const p of state.pages) {
      for (const ann of p.annotations) {
        if (ann.parentId === newParentId && ann.id !== childId) {
          siblingIds.add(ann.id);
        }
      }
    }

    const oldParentId = child.parentId;
    const nextOrderIndex = siblingIds.size;

    for (const p of state.pages) {
      for (const ann of p.annotations) {
        if (ann.id === childId) {
          ann.parentId = newParentId;
          ann.orderIndex = nextOrderIndex;
        }
      }
    }
    child.parentId = newParentId;
    child.orderIndex = nextOrderIndex;

    try {
      await apiRequest(`/annotations/${encodeURIComponent(childId)}`, {
        method: "PUT",
        body: { parentId: newParentId, orderIndex: nextOrderIndex },
      });

      recalcParentTextFromChildren(newParentId);
      if (oldParentId && oldParentId !== newParentId) {
        recalcParentTextFromChildren(oldParentId);
      }

      const flushIds = new Set([newParentId]);
      if (oldParentId) flushIds.add(oldParentId);
      for (const fid of flushIds) {
        if (!fid) continue;
        if (annotationSaveTimers.has(fid)) {
          clearTimeout(annotationSaveTimers.get(fid));
          annotationSaveTimers.delete(fid);
        }
        const flushAnn = getAnnotationById(fid);
        if (flushAnn) {
          await apiRequest(`/annotations/${encodeURIComponent(fid)}`, {
            method: "PUT",
            body: flushAnn,
          });
        }
      }

      renderAll();
    } catch (error) {
      alert("设置父子关系失败：" + error.message);
    }
  }

  async function reorderAnnotation(draggedId, targetId, position) {
    const page = getCurrentPage();
    if (!page) return;

    const dragged = page.annotations.find((ann) => ann.id === draggedId);
    const target = page.annotations.find((ann) => ann.id === targetId);
    if (!dragged || !target) return;

    const oldParentId = dragged.parentId;
    dragged.parentId = target.parentId;

    const siblings = page.annotations
      .filter((ann) => ann.parentId === target.parentId && ann.id !== draggedId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    const targetIdx = siblings.findIndex((ann) => ann.id === targetId);
    if (position === "before") {
      siblings.splice(targetIdx, 0, dragged);
    } else {
      siblings.splice(targetIdx + 1, 0, dragged);
    }

    for (let i = 0; i < siblings.length; i++) {
      siblings[i].orderIndex = i;
      if (annotationSaveTimers.has(siblings[i].id)) {
        clearTimeout(annotationSaveTimers.get(siblings[i].id));
        annotationSaveTimers.delete(siblings[i].id);
      }
      await apiRequest(`/annotations/${encodeURIComponent(siblings[i].id)}`, {
        method: "PUT",
        body: siblings[i],
      });
    }

    if (oldParentId) {
      recalcParentTextFromChildren(oldParentId);
    }
    if (target.parentId && target.parentId !== oldParentId) {
      recalcParentTextFromChildren(target.parentId);
    }

    const flushIds = new Set();
    if (oldParentId) flushIds.add(oldParentId);
    if (target.parentId) flushIds.add(target.parentId);
    for (const fid of flushIds) {
      if (annotationSaveTimers.has(fid)) {
        clearTimeout(annotationSaveTimers.get(fid));
        annotationSaveTimers.delete(fid);
      }
      let fAnn = null;
      for (const p of state.pages) {
        fAnn = p.annotations.find((ann) => ann.id === fid);
        if (fAnn) break;
      }
      if (fAnn) {
        await apiRequest(`/annotations/${encodeURIComponent(fid)}`, {
          method: "PUT",
          body: fAnn,
        });
      }
    }

    renderAll();
  }

  function buildAnnotationList() {
    const page = getCurrentPage();
    refs.annotationList.innerHTML = "";
    if (!page) {
      return;
    }

    const statusLabels = {
      pending: "待审",
      approved: "通过",
      rejected: "驳回",
    };

    function makeReviewBadge(ann) {
      const st = ann.reviewStatus || "pending";
      return `<span class="review-badge-sm ${st}">${statusLabels[st] || st}</span>`;
    }

    const allAnnotations = [...page.annotations];
    const topLevel = [];
    const childMap = new Map();

    allAnnotations.forEach((ann) => {
      if (ann.parentId) {
        if (!childMap.has(ann.parentId)) childMap.set(ann.parentId, []);
        childMap.get(ann.parentId).push(ann);
      } else {
        topLevel.push(ann);
      }
    });

    topLevel.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    for (const [, children] of childMap) {
      children.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    }

    if (!state.annotationExpandedState) state.annotationExpandedState = {};

    function renderAnnotationItem(ann, depth) {
      const item = document.createElement("li");
      item.className = "annotation-list-item";
      if (ann.id === state.selectedAnnotationId) {
        item.classList.add("active");
      }
      if (depth > 0) {
        item.style.paddingLeft = `${depth * 16 + 8}px`;
      }

      item.draggable = isEditor();
      item.dataset.annId = ann.id;
      if (isEditor()) {
        item.addEventListener("dragstart", (evt) => {
          evt.dataTransfer.setData("text/plain", ann.id);
          evt.dataTransfer.effectAllowed = "move";
          item.classList.add("dragging");
        });
        item.addEventListener("dragend", () => {
          item.classList.remove("dragging");
        });
        item.addEventListener("dragover", (evt) => {
          evt.preventDefault();
          evt.dataTransfer.dropEffect = "move";
          const rect = item.getBoundingClientRect();
          const relY = evt.clientY - rect.top;
          const h = rect.height;
          item.classList.remove("drop-before", "drop-after", "drag-over");
          if (relY < h * 0.25) {
            item.classList.add("drop-before");
          } else if (relY > h * 0.75) {
            item.classList.add("drop-after");
          } else {
            item.classList.add("drag-over");
          }
        });
        item.addEventListener("dragleave", () => {
          item.classList.remove("drop-before", "drop-after", "drag-over");
        });
        item.addEventListener("drop", (evt) => {
          evt.preventDefault();
          const draggedId = evt.dataTransfer.getData("text/plain");
          if (!draggedId || draggedId === ann.id) {
            item.classList.remove("drop-before", "drop-after", "drag-over");
            return;
          }
          if (item.classList.contains("drop-before")) {
            reorderAnnotation(draggedId, ann.id, "before");
          } else if (item.classList.contains("drop-after")) {
            reorderAnnotation(draggedId, ann.id, "after");
          } else {
            reparentAnnotation(draggedId, ann.id).catch((e) =>
              alert(e.message),
            );
          }
          item.classList.remove("drop-before", "drop-after", "drag-over");
        });
      }

      const brief = ann.originalText || ann.simplifiedText || "(未填文本)";
      const badge = makeReviewBadge(ann);
      const hasChildren =
        childMap.has(ann.id) && childMap.get(ann.id).length > 0;
      const isExpanded = state.annotationExpandedState[ann.id] === true;
      const expandIcon = hasChildren ? (isExpanded ? "▼" : "▶") : "  ";

      item.innerHTML = `<span class="ann-expand">${expandIcon}</span><span class="ann-text-wrap">[${levelLabel(ann.level)}] ${escapeHtml(brief)}</span>${badge}`;

      if (hasChildren) {
        item.querySelector(".ann-expand").style.cursor = "pointer";
        item.querySelector(".ann-expand").addEventListener("click", (evt) => {
          evt.stopPropagation();
          state.annotationExpandedState[ann.id] = !isExpanded;
          buildAnnotationList();
        });
      }

      if (canReview()) {
        const badgeEl = item.querySelector(".review-badge-sm");
        if (badgeEl) {
          badgeEl.classList.add("clickable");
          badgeEl.addEventListener("click", (evt) => {
            evt.stopPropagation();
            const cycle = {
              pending: "approved",
              approved: "rejected",
              rejected: "pending",
            };
            const next = cycle[ann.reviewStatus || "pending"];
            setReviewStatus(ann.id, next);
          });
        }
      }

      item.addEventListener("click", () => {
        let pageChanged = false;
        if (state.selectedAnnotationId === ann.id) {
          state.selectedAnnotationId = null;
        } else {
          state.selectedAnnotationId = ann.id;
          if (!ann.regions || !ann.regions.length) {
            for (let i = 0; i < state.pages.length; i++) {
              const found = state.pages[i].annotations.find(
                (a) => a.id === ann.id && a.regions && a.regions.length > 0,
              );
              if (found && i !== state.currentPageIndex) {
                state.currentPageIndex = i;
                pageChanged = true;
                break;
              }
            }
          }
        }
        state.selectedHeadingId = null;
        state.selectedRegionId = null;
        if (pageChanged) {
          renderAll({ skipFormRebuild: true });
        } else {
          renderAll();
        }
      });
      refs.annotationList.appendChild(item);

      if (hasChildren && isExpanded) {
        for (const child of childMap.get(ann.id)) {
          renderAnnotationItem(child, depth + 1);
        }
      }
    }

    topLevel.forEach((ann) => renderAnnotationItem(ann, 0));
  }

  return {
    buildAnnotationList,
    reparentAnnotation,
    reorderAnnotation,
    recalcParentTextFromChildren,
  };
};
