/**
 * @description aitools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建aitools。
 * @param {*} deps 模块依赖集合。
 * @returns {*} aitools结果。
 */
window.createAiTools = function createAiTools(deps) {
  const {
    refs,
    state,
    uid,
    apiRequest,
    getCurrentPage,
    getSelectedAnnotation,
    renderAnnotationForm,
    scheduleAnnotationPersist,
    recalcParentTextFromChildren,
    annotationSaveTimers,
    renderAll,
  } = deps;

  /**
   * @description 更新aibuttonstates。
   * @returns {void} 无返回值。
   */
  function updateAiButtonStates() {
    if (refs.btnAiOcrRegion) {
      refs.btnAiOcrRegion.disabled = !state.selectedAnnotationId;
    }
  }

  /**
   * @description 转换recognizedtext。
   * @param {*} text text参数。
   * @returns {*} recognizedtext结果。
   */
  async function convertRecognizedText(text) {
    const originalText = String(text || "");
    if (!originalText) {
      return "";
    }
    try {
      const payload = await apiRequest("/text/convert-simplified", {
        method: "POST",
        body: { text: originalText },
      });
      return String(payload.simplifiedText || originalText);
    } catch (error) {
      console.warn("[AI] 简体转换失败，回退为原文", error);
      return originalText;
    }
  }

  /**
   * @description 处理airecognizeselected相关逻辑。
   * @returns {*} recognizeselected结果。
   */
  async function aiRecognizeSelected() {
    const page = getCurrentPage();
    const ann = getSelectedAnnotation();
    if (!page || !ann) return;

    let allRegions = ann.regions || [];
    if (ann.level === "sentence" || ann.level === "paragraph") {
      try {
        const regionPayload = await apiRequest(
          `/annotations/${encodeURIComponent(ann.id)}/regions`,
        );
        allRegions = regionPayload.regions || allRegions;
      } catch (error) {}
    }

    if (!allRegions.length) {
      alert("该标注没有区域，无法识别");
      return;
    }

    refs.btnAiOcrRegion.disabled = true;
    refs.btnAiOcrRegion.textContent = "识别中...";

    try {
      if (ann.level === "char") {
        const region = allRegions[0];
        const payload = await apiRequest("/ocr/recognize", {
          method: "POST",
          body: {
            articleId: state.article && state.article.id ? state.article.id : "",
            pageId: region.pageId || page.id,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
          },
        });
        const texts = (payload.results || []).map((r) => r.text).join("");
        if (texts) {
          const simplifiedText = await convertRecognizedText(texts);
          ann.originalText = texts;
          ann.simplifiedText = simplifiedText;
          renderAnnotationForm();
          scheduleAnnotationPersist(ann);
        }
      } else {
        if (ann.level === "sentence") {
          const childChars = [];
          for (const p of state.pages) {
            for (const a of p.annotations) {
              if (a.parentId === ann.id && a.level === "char") {
                childChars.push({ annotation: a, page: p });
              }
            }
          }
          for (const { annotation: child, page: childPage } of childChars) {
            try {
              await apiRequest(`/annotations/${encodeURIComponent(child.id)}`, {
                method: "DELETE",
              });
            } catch (error) {
              const message = String(
                error && error.message ? error.message : "",
              );
              if (
                !message.includes("未找到对应文章") &&
                !message.includes("not found") &&
                !message.includes("404")
              ) {
                throw error;
              }
            }
            childPage.annotations = childPage.annotations.filter(
              (a) => a.id !== child.id,
            );
          }
        }

        let allOriginalText = "";
        let allSimplifiedText = "";
        let orderCounter = 0;

        for (const region of allRegions) {
          const regionPageId = region.pageId || page.id;
          const payload = await apiRequest("/ocr/layout-detect", {
            method: "POST",
            body: {
              articleId:
                state.article && state.article.id ? state.article.id : "",
              pageId: regionPageId,
              level: "char",
              x: region.x,
              y: region.y,
              width: region.width,
              height: region.height,
            },
          });

          const detectedRegions = payload.regions || [];
          if (detectedRegions.length > 0) {
            const regionPage =
              state.pages.find((p) => p.id === regionPageId) || page;
            const convertedTexts = await Promise.all(
              detectedRegions.map((r) =>
                convertRecognizedText(r.text || ""),
              ),
            );
            const annotations = detectedRegions.map((r, index) => ({
              id: uid("ann"),
              charId: uid("char"),
              level: "char",
              style: "highlight",
              color: "#d5533f",
              originalText: r.text || "",
              simplifiedText: convertedTexts[index] || r.text || "",
              note: "",
              noteType: "1",
              charCode: "",
              glyphRef: "",
              x: Math.round(r.x),
              y: Math.round(r.y),
              width: Math.round(r.width),
              height: Math.round(r.height),
              parentId: ann.id,
              orderIndex: orderCounter++,
            }));

            const batchPayload = await apiRequest(
              `/pages/${encodeURIComponent(regionPageId)}/annotations/batch`,
              { method: "POST", body: { annotations } },
            );
            (batchPayload.annotations || []).forEach((a) =>
              regionPage.annotations.push(a),
            );
            allOriginalText += detectedRegions.map((r) => r.text || "").join("");
            allSimplifiedText += convertedTexts.join("");
          }
        }

        if (allOriginalText) {
          ann.originalText = allOriginalText;
          ann.simplifiedText = allSimplifiedText || allOriginalText;

          if (annotationSaveTimers.has(ann.id)) {
            clearTimeout(annotationSaveTimers.get(ann.id));
            annotationSaveTimers.delete(ann.id);
          }

          await apiRequest(`/annotations/${encodeURIComponent(ann.id)}`, {
            method: "PUT",
            body: ann,
          });

          if (ann.parentId) {
            recalcParentTextFromChildren(ann.parentId);
            if (annotationSaveTimers.has(ann.parentId)) {
              clearTimeout(annotationSaveTimers.get(ann.parentId));
              annotationSaveTimers.delete(ann.parentId);
            }
            let parent = null;
            for (const p of state.pages) {
              parent = p.annotations.find((a) => a.id === ann.parentId);
              if (parent) break;
            }
            if (parent) {
              await apiRequest(
                `/annotations/${encodeURIComponent(parent.id)}`,
                {
                  method: "PUT",
                  body: parent,
                },
              );
            }
          }
        }
        renderAll();
      }
    } catch (error) {
      alert("识别失败：" + error.message);
    } finally {
      refs.btnAiOcrRegion.textContent = "识别文字";
      updateAiButtonStates();
    }
  }

  return {
    updateAiButtonStates,
    aiRecognizeSelected,
  };
};

