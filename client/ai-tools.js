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
   * @description 根据当前选中状态更新 AI 识别按钮可用性。
   * @returns {void}
   */
  function updateAiButtonStates() {
    if (refs.btnAiOcrRegion) {
      refs.btnAiOcrRegion.disabled = !state.selectedAnnotationId;
    }
  }

  /**
   * @description 对当前选中标注执行 AI 识别；字级直接识别文本，句/段级执行版面检测并生成子字标注。
   * @returns {Promise<void>}
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
            pageId: region.pageId || page.id,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
          },
        });
        const texts = (payload.results || []).map((r) => r.text).join("");
        if (texts) {
          ann.originalText = texts;
          ann.simplifiedText = texts;
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
            await apiRequest(`/annotations/${encodeURIComponent(child.id)}`, {
              method: "DELETE",
            });
            childPage.annotations = childPage.annotations.filter(
              (a) => a.id !== child.id,
            );
          }
        }

        let allOriginalText = "";
        let orderCounter = 0;

        for (const region of allRegions) {
          const regionPageId = region.pageId || page.id;
          const payload = await apiRequest("/ocr/layout-detect", {
            method: "POST",
            body: {
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
            const annotations = detectedRegions.map((r) => ({
              id: uid("ann"),
              charId: uid("char"),
              level: "char",
              style: "highlight",
              color: "#d5533f",
              originalText: r.text || "",
              simplifiedText: r.text || "",
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
            allOriginalText += detectedRegions
              .map((r) => r.text || "")
              .join("");
          }
        }

        if (allOriginalText) {
          ann.originalText = allOriginalText;
          ann.simplifiedText = allOriginalText;

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
