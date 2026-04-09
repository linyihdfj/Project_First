/**
 * @description reviewstatustools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建reviewstatustools。
 * @param {*} deps 模块依赖集合。
 * @returns {*} reviewstatustools结果。
 */
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
   * @description 渲染reviewstatus。
   * @returns {void} 无返回值。
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
      refs.reviewStatusDisplay.innerHTML += `<span style="font-size:12px;color:#7f6348"> 审校者：${escapeHtml(ann.reviewedBy)}</span>`;
    }
  }

  /**
   * @description 设置reviewstatus。
   * @param {*} annotationIdOrStatus annotationidstatus参数。
   * @param {*} statusArg statusarg参数。
   * @returns {*} reviewstatus结果。
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
      const data = await apiRequest(`/annotations/${encodeURIComponent(annId)}`, {
        method: "PATCH",
        body: {
          reviewStatus: status,
          reviewedBy: state.currentUser ? state.currentUser.displayName : "",
        },
      });

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

