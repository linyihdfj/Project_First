window.createReviewStatusTools = function createReviewStatusTools(deps) {
  const {
    state,
    refs,
    escapeHtml,
    apiRequest,
    getSelectedAnnotation,
    drawOverlay,
    buildAnnotationList,
  } = deps;

  /**
   * @description 渲染当前选中标注的审校状态与审校人信息。
   * @returns {void}
   */
  function renderReviewStatus() {
    const ann = getSelectedAnnotation();
    if (!refs.reviewStatusSection) return;

    if (!ann) {
      refs.reviewStatusSection.hidden = true;
      return;
    }

    refs.reviewStatusSection.hidden = false;
    const status = ann.reviewStatus || "pending";
    const labels = { pending: "待审", approved: "通过", rejected: "驳回" };
    refs.reviewStatusDisplay.innerHTML = `<span class="review-badge ${status}">${labels[status] || status}</span>`;

    if (ann.reviewedBy) {
      refs.reviewStatusDisplay.innerHTML += `<span style="font-size:12px;color:#7f6348"> 审校者: ${escapeHtml(ann.reviewedBy)}</span>`;
    }
  }

  /**
   * @description 设置标注审校状态，支持显式传入 annotationId。
   * @param {string|number} annotationIdOrStatus 标注 ID 或状态值。
   * @param {string} [statusArg] 状态值（approved/rejected/pending）。
   * @returns {Promise<void>}
   */
  async function setReviewStatus(annotationIdOrStatus, statusArg) {
    let annId;
    let status;

    if (statusArg !== undefined) {
      annId = annotationIdOrStatus;
      status = statusArg;
    } else {
      annId = state.selectedAnnotationId;
      status = annotationIdOrStatus;
    }

    if (!annId) return;

    let ann = null;
    for (const page of state.pages) {
      ann = page.annotations.find((item) => item.id === annId);
      if (ann) break;
    }
    if (!ann) return;

    try {
      const data = await apiRequest(
        `/annotations/${encodeURIComponent(annId)}`,
        {
          method: "PATCH",
          body: {
            reviewStatus: status,
            reviewedBy: state.currentUser ? state.currentUser.displayName : "",
          },
        },
      );

      for (const page of state.pages) {
        const copy = page.annotations.find((item) => item.id === annId);
        if (copy) {
          copy.reviewStatus = data.annotation.reviewStatus;
          copy.reviewedBy = data.annotation.reviewedBy;
        }
      }

      renderReviewStatus();
      drawOverlay();
      buildAnnotationList();
    } catch (error) {
      alert(error.message);
    }
  }

  return {
    renderReviewStatus,
    setReviewStatus,
  };
};
