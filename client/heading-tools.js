window.createHeadingTools = function createHeadingTools(deps) {
  const {
    state,
    refs,
    escapeHtml,
    isEditor,
    getCurrentPage,
    getSelectedAnnotation,
    saveArticleMeta,
    apiRequest,
    normalizeArticleId,
    renderAll,
    resetCanvasView,
    joinCurrentPageRoom,
  } = deps;

  /**
   * @description 将标注层级值转换为中文显示文本。
   * @param {string} level 标注层级值。
   * @returns {string} 层级显示文本。
   */
  function levelLabel(level) {
    if (level === "char") {
      return "字";
    }
    if (level === "sentence") {
      return "句";
    }
    if (level === "image") {
      return "图";
    }
    return "段";
  }

  /**
   * @description 将标题深度级别转换为中文显示文本。
   * @param {number} level 标题级别数字。
   * @returns {string} 标题级别显示文本。
   */
  function headingLevelLabel(level) {
    if (level === 1) {
      return "大标题";
    }
    if (level === 2) {
      return "子标题";
    }
    if (level === 3) {
      return "子子标题";
    }
    return "四级标题";
  }

  /**
   * @description 按页面 ID 查找页面索引。
   * @param {string} pageId 页面 ID。
   * @returns {number} 页面索引，未找到返回 -1。
   */
  function findPageIndexById(pageId) {
    return state.pages.findIndex((page) => page.id === pageId);
  }

  /**
   * @description 基于当前选中标注或输入文本创建新标题并加入索引。
   * @returns {Promise<void>}
   */
  async function addHeadingFromSelection() {
    const page = getCurrentPage();
    if (!page) {
      alert("请先导入并选择页面");
      return;
    }

    const selectedAnn = getSelectedAnnotation();
    const level = 1;

    let titleText = refs.headingTitleInput
      ? refs.headingTitleInput.value.trim()
      : "";
    if (!titleText && selectedAnn) {
      titleText = (
        selectedAnn.originalText ||
        selectedAnn.simplifiedText ||
        ""
      ).trim();
    }
    if (!titleText) {
      alert("请输入标题文本，或先选中一个含文本的标注");
      return;
    }

    await saveArticleMeta();
    const payload = await apiRequest(
      `/articles/${encodeURIComponent(state.article.id)}/headings`,
      {
        method: "POST",
        body: {
          pageId: page.id,
          annotationId: selectedAnn ? selectedAnn.id : null,
          titleText,
          level,
          y: selectedAnn
            ? Number(((selectedAnn.regions || [])[0] || {}).y || 0)
            : 0,
        },
      },
    );

    if (payload && payload.heading) {
      state.headings.push(payload.heading);
      state.selectedHeadingId = payload.heading.id;
    }

    if (refs.headingTitleInput) {
      refs.headingTitleInput.value = "";
    }
    renderAll();
  }

  /**
   * @description 删除指定标题并同步更新当前选中状态。
   * @param {string} headingId 标题 ID。
   * @returns {Promise<void>}
   */
  async function deleteHeadingById(headingId) {
    if (!window.confirm("确定删除该标题吗？")) {
      return;
    }
    await apiRequest(`/headings/${encodeURIComponent(headingId)}`, {
      method: "DELETE",
    });
    state.headings = state.headings.filter(
      (heading) => heading.id !== headingId,
    );
    if (state.selectedHeadingId === headingId) {
      state.selectedHeadingId = null;
    }
    renderAll();
  }

  /**
   * @description 计算标题在树中的深度（根为 0）。
   * @param {string} headingId 标题 ID。
   * @returns {number} 深度值。
   */
  function calcHeadingDepth(headingId) {
    let depth = 0;
    let currentId = headingId;
    const visited = new Set();
    while (currentId) {
      const heading = state.headings.find((item) => item.id === currentId);
      if (!heading || !heading.parentId || visited.has(currentId)) break;
      visited.add(currentId);
      currentId = heading.parentId;
      depth++;
    }
    return depth;
  }

  /**
   * @description 从指定父节点开始递归刷新其所有子孙标题的级别字段。
   * @param {string|null} parentId 父标题 ID。
   * @returns {void}
   */
  function updateChildLevels(parentId) {
    state.headings.forEach((heading) => {
      if (heading.parentId === parentId) {
        heading.level = calcHeadingDepth(heading.id) + 1;
        updateChildLevels(heading.id);
      }
    });
  }

  /**
   * @description 判断某标题是否为另一个标题的后代节点，用于避免拖拽成环。
   * @param {string} headingId 待判断标题 ID。
   * @param {string} ancestorId 祖先标题 ID。
   * @returns {boolean} 是后代返回 true。
   */
  function isDescendantOf(headingId, ancestorId) {
    let currentId = headingId;
    const visited = new Set();
    while (currentId) {
      if (currentId === ancestorId) return true;
      const heading = state.headings.find((item) => item.id === currentId);
      if (!heading || !heading.parentId || visited.has(currentId)) return false;
      visited.add(currentId);
      currentId = heading.parentId;
    }
    return false;
  }

  /**
   * @description 移动标题到新父节点与新顺序，并同步后端与本地树结构。
   * @param {string} headingId 被移动标题 ID。
   * @param {string|null} newParentId 新父标题 ID，null 表示顶级。
   * @param {number} newOrderIndex 新顺序索引。
   * @returns {Promise<void>}
   */
  async function moveHeading(headingId, newParentId, newOrderIndex) {
    const articleId = normalizeArticleId(state.article.id);
    const newLevel = newParentId ? calcHeadingDepth(newParentId) + 2 : 1;

    await apiRequest(
      `/articles/${encodeURIComponent(articleId)}/headings/${encodeURIComponent(headingId)}`,
      {
        method: "PATCH",
        body: {
          parentId: newParentId || null,
          orderIndex: newOrderIndex,
          level: newLevel,
        },
      },
    );

    const heading = state.headings.find((item) => item.id === headingId);
    if (heading) {
      heading.parentId = newParentId || null;
      heading.orderIndex = newOrderIndex;
      heading.level = newLevel;
      updateChildLevels(heading.id);
    }

    const siblings = state.headings
      .filter(
        (item) =>
          (item.parentId || null) === (newParentId || null) &&
          item.id !== headingId,
      )
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    siblings.splice(newOrderIndex, 0, heading);
    const orderedIds = siblings.filter(Boolean).map((item, index) => {
      item.orderIndex = index;
      return item.id;
    });

    await apiRequest(
      `/articles/${encodeURIComponent(articleId)}/headings/reorder`,
      {
        method: "POST",
        body: {
          parentId: newParentId || null,
          orderedIds,
        },
      },
    ).catch(() => {});

    renderHeadingIndex();
  }

  /**
   * @description 跳转到指定标题关联的页面和标注位置。
   * @param {object} heading 标题对象。
   * @returns {void}
   */
  function jumpToHeading(heading) {
    const pageIndex = findPageIndexById(heading.pageId);
    if (pageIndex < 0) {
      alert("标题关联页面不存在");
      return;
    }

    if (state.currentPageIndex !== pageIndex) {
      state.currentPageIndex = pageIndex;
      resetCanvasView();
      joinCurrentPageRoom();
    }
    state.selectedHeadingId = heading.id;

    if (heading.annotationId) {
      const page = state.pages[pageIndex];
      const ann = page.annotations.find(
        (item) => item.id === heading.annotationId,
      );
      state.selectedAnnotationId = ann ? ann.id : null;
    } else {
      state.selectedAnnotationId = null;
    }

    renderAll();
  }

  /**
   * @description 渲染标题索引树，并绑定展开、拖拽、跳转与删除事件。
   * @returns {void}
   */
  function renderHeadingIndex() {
    if (!refs.headingIndexList) {
      return;
    }

    refs.headingIndexList.innerHTML = "";
    const pageNoMap = new Map(
      state.pages.map((page) => [page.id, page.pageNo || 0]),
    );

    const tree = {};

    state.headings.forEach((heading) => {
      const parentId = heading.parentId || "root";
      if (!tree[parentId]) {
        tree[parentId] = [];
      }
      tree[parentId].push(heading);
    });

    Object.keys(tree).forEach((parentId) => {
      tree[parentId].sort((a, b) => {
        const orderA = Number(a.orderIndex || 0);
        const orderB = Number(b.orderIndex || 0);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return String(a.createdAt || "").localeCompare(
          String(b.createdAt || ""),
        );
      });
    });

    if (refs.headingDropRootZone && !refs.headingDropRootZone._dragBound) {
      refs.headingDropRootZone._dragBound = true;
      refs.headingDropRootZone.addEventListener("dragover", (evt) => {
        if (!isEditor()) return;
        evt.preventDefault();
        evt.dataTransfer.dropEffect = "move";
        refs.headingDropRootZone.classList.add("drag-over");
      });
      refs.headingDropRootZone.addEventListener("dragleave", () => {
        refs.headingDropRootZone.classList.remove("drag-over");
      });
      refs.headingDropRootZone.addEventListener("drop", (evt) => {
        if (!isEditor()) return;
        evt.preventDefault();
        refs.headingDropRootZone.classList.remove("drag-over");
        if (state.headingDragState.draggedHeadingId) {
          const draggedId = state.headingDragState.draggedHeadingId;
          const rootChildren = state.headings.filter((h) => !h.parentId).length;
          moveHeading(draggedId, null, rootChildren).catch((error) =>
            alert(error.message),
          );
        }
      });
    }

    /**
     * @description 递归渲染指定父节点下的标题树。
     * @param {string} parentId 父标题 ID。
     * @param {number} depth 当前深度。
     * @returns {void}
     */
    function renderHeadingTree(parentId, depth = 0) {
      const children = tree[parentId] || [];
      if (children.length === 0) {
        return;
      }

      children.forEach((heading, index) => {
        const hasChildren = !!(tree[heading.id] && tree[heading.id].length > 0);
        const isExpanded = state.headingExpandedState[heading.id] !== false;

        const item = document.createElement("li");
        item.className = `index-list-item heading-item level-${heading.level}`;
        item.style.marginLeft = `${depth * 20}px`;
        item.dataset.headingId = heading.id;
        item.dataset.parentId = parentId;
        item.dataset.index = index;
        if (heading.id === state.selectedHeadingId) {
          item.classList.add("active");
        }
        if (state.headingDragState.draggedHeadingId === heading.id) {
          item.classList.add("dragging");
        }

        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.width = "100%";
        wrapper.style.gap = "4px";

        if (hasChildren) {
          const expandBtn = document.createElement("button");
          expandBtn.type = "button";
          expandBtn.className = "heading-expand-btn";
          expandBtn.style.flex = "0 0 24px";
          expandBtn.style.padding = "2px 4px";
          expandBtn.style.minWidth = "24px";
          expandBtn.style.cursor = "pointer";
          expandBtn.style.border = "none";
          expandBtn.style.background = "transparent";
          expandBtn.style.fontSize = "12px";
          expandBtn.textContent = isExpanded ? "▼" : "▶";
          expandBtn.title = isExpanded ? "折叠" : "展开";
          expandBtn.addEventListener("click", (evt) => {
            evt.stopPropagation();
            state.headingExpandedState[heading.id] =
              !state.headingExpandedState[heading.id];
            renderHeadingIndex();
          });
          wrapper.appendChild(expandBtn);
        } else {
          const spacer = document.createElement("div");
          spacer.style.width = "24px";
          wrapper.appendChild(spacer);
        }

        const pageNo = pageNoMap.get(heading.pageId) || "?";
        const depthLabel = headingLevelLabel(calcHeadingDepth(heading.id) + 1);
        const link = document.createElement("button");
        link.type = "button";
        link.className = "index-link";
        link.style.flex = "1";
        link.draggable = isEditor();
        link.innerHTML = `<span>${escapeHtml(heading.titleText)}</span><small>P${pageNo} · ${depthLabel}</small>`;
        link.addEventListener("click", () => {
          jumpToHeading(heading);
        });

        if (isEditor()) {
          link.addEventListener("dragstart", (evt) => {
            evt.dataTransfer.effectAllowed = "move";
            state.headingDragState.draggedHeadingId = heading.id;
            item.classList.add("dragging");
          });
          link.addEventListener("dragend", () => {
            state.headingDragState.draggedHeadingId = null;
            document
              .querySelectorAll(".drop-before,.drop-after,.drop-child")
              .forEach((el) => {
                el.classList.remove("drop-before", "drop-after", "drop-child");
              });
            item.classList.remove("dragging");
          });

          item.addEventListener("dragover", (evt) => {
            evt.preventDefault();
            evt.dataTransfer.dropEffect = "move";

            if (
              !state.headingDragState.draggedHeadingId ||
              state.headingDragState.draggedHeadingId === heading.id
            ) {
              return;
            }

            document
              .querySelectorAll(".drop-before,.drop-after,.drop-child")
              .forEach((el) => {
                el.classList.remove("drop-before", "drop-after", "drop-child");
              });

            const rect = item.getBoundingClientRect();
            const ratio = (evt.clientY - rect.top) / rect.height;
            if (ratio < 0.25) {
              item.classList.add("drop-before");
            } else if (ratio > 0.75) {
              item.classList.add("drop-after");
            } else {
              item.classList.add("drop-child");
            }
          });

          item.addEventListener("dragleave", () => {
            item.classList.remove("drop-before", "drop-after", "drop-child");
          });

          item.addEventListener("drop", (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            item.classList.remove("drop-before", "drop-after", "drop-child");

            const draggedId = state.headingDragState.draggedHeadingId;
            if (!draggedId || draggedId === heading.id) return;

            if (isDescendantOf(heading.id, draggedId)) return;

            const rect = item.getBoundingClientRect();
            const ratio = (evt.clientY - rect.top) / rect.height;
            const targetParentId = heading.parentId || null;

            if (ratio < 0.25) {
              moveHeading(draggedId, targetParentId, index).catch((error) =>
                alert(error.message),
              );
            } else if (ratio > 0.75) {
              moveHeading(draggedId, targetParentId, index + 1).catch((error) =>
                alert(error.message),
              );
            } else {
              const childCount = (tree[heading.id] || []).length;
              moveHeading(draggedId, heading.id, childCount).catch((error) =>
                alert(error.message),
              );
            }
          });
        }

        wrapper.appendChild(link);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "heading-delete";
        del.style.flex = "0 0 24px";
        del.textContent = "×";
        del.title = "删除标题";
        del.addEventListener("click", (evt) => {
          evt.stopPropagation();
          deleteHeadingById(heading.id).catch((error) => alert(error.message));
        });
        wrapper.appendChild(del);

        item.appendChild(wrapper);
        refs.headingIndexList.appendChild(item);

        if (isExpanded && hasChildren) {
          renderHeadingTree(heading.id, depth + 1);
        }
      });
    }

    if (!state.headings.length) {
      const empty = document.createElement("li");
      empty.className = "index-list-item";
      empty.innerHTML =
        '<button type="button" class="index-link" disabled>暂无标题</button>';
      refs.headingIndexList.appendChild(empty);
      return;
    }

    renderHeadingTree("root");
  }

  /**
   * @description 刷新“添加标题”提示文案，反映当前页面与选中标注状态。
   * @returns {void}
   */
  function renderHeadingAddTip() {
    if (!refs.headingAddTip) {
      return;
    }
    const page = getCurrentPage();
    const ann = getSelectedAnnotation();

    if (!page) {
      refs.headingAddTip.textContent = "请先导入页面，再添加标题。";
      return;
    }

    if (ann) {
      const region = (ann.regions || [])[0];
      const posText = region ? `(x:${region.x}, y:${region.y})` : "";
      refs.headingAddTip.textContent = `已关联当前标注 ${posText}，添加后可精准跳转。`;
      return;
    }

    refs.headingAddTip.textContent =
      "当前未选标注，添加后将按页面顶部位置跳转。";
  }

  return {
    levelLabel,
    addHeadingFromSelection,
    renderHeadingIndex,
    renderHeadingAddTip,
  };
};
