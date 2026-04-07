window.createArticleSelectTools = function createArticleSelectTools(deps) {
  const {
    refs,
    state,
    apiRequest,
    apiPath,
    escapeHtml,
    isAdmin,
    getAuthToken,
    preloadArticleFirstPages,
    loadSnapshot,
    onManageAccess,
  } = deps;

  /**
   * @description 显示文章选择界面并刷新用户与文章列表信息。
   * @returns {void}
   */
  function showArticleSelect() {
    if (refs.articleSelectOverlay) refs.articleSelectOverlay.hidden = false;
    if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = true;

    if (state.currentUser) {
      if (refs.selectUserDisplayName) {
        refs.selectUserDisplayName.textContent =
          state.currentUser.displayName || state.currentUser.username;
      }
      if (refs.selectUserRoleBadge) {
        const roleLabels = {
          admin: "管理员",
          editor: "编辑者",
          reviewer: "审校者",
        };
        refs.selectUserRoleBadge.textContent =
          roleLabels[state.currentUser.role] || state.currentUser.role;
        refs.selectUserRoleBadge.className = `role-badge ${state.currentUser.role}`;
      }
    }

    if (refs.articleCreateSection) {
      refs.articleCreateSection.hidden = !(
        state.currentUser &&
        (state.currentUser.role === "admin" ||
          state.currentUser.role === "editor")
      );
    }
    if (refs.btnSelectUserManage) {
      refs.btnSelectUserManage.hidden = !(
        state.currentUser && state.currentUser.role === "admin"
      );
    }

    loadArticleList().catch((error) => alert(error.message));
  }

  /**
   * @description 隐藏文章选择界面。
   * @returns {void}
   */
  function hideArticleSelect() {
    if (refs.articleSelectOverlay) refs.articleSelectOverlay.hidden = true;
  }

  /**
   * @description 拉取文章列表并渲染卡片，同时预加载封面页。
   * @returns {Promise<void>}
   */
  async function loadArticleList() {
    try {
      const data = await apiRequest("/articles");
      state.articleList = data.articles || [];
      renderArticleGrid();
      preloadArticleFirstPages(state.articleList);
    } catch (error) {
      state.articleList = [];
      renderArticleGrid();
    }
  }

  /**
   * @description 导出指定文章为 XML 文件并触发浏览器下载。
   * @param {string} articleId 文章 ID。
   * @param {string} title 文章标题。
   * @returns {Promise<void>}
   */
  async function exportArticleXml(articleId, title) {
    try {
      const token = getAuthToken();
      const response = await fetch(
        apiPath(`/articles/${encodeURIComponent(articleId)}/export-xml`),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data && data.message ? data.message : "导出失败");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || articleId}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message);
    }
  }

  /**
   * @description 删除指定文章并刷新文章列表。
   * @param {string} articleId 文章 ID。
   * @param {string} title 文章标题。
   * @returns {Promise<void>}
   */
  async function deleteArticleById(articleId, title) {
    if (!confirm(`确定删除文章「${title || articleId}」？此操作不可恢复。`))
      return;
    try {
      await apiRequest(`/articles/${encodeURIComponent(articleId)}`, {
        method: "DELETE",
      });
      await loadArticleList();
    } catch (error) {
      alert(error.message);
    }
  }

  /**
   * @description 渲染文章卡片网格及其操作按钮。
   * @returns {void}
   */
  function renderArticleGrid() {
    if (!refs.articleGrid) return;
    refs.articleGrid.innerHTML = "";

    if (!state.articleList.length) {
      refs.articleGrid.innerHTML =
        '<p style="color:#7f6348;grid-column:1/-1">暂无可访问的文章</p>';
      return;
    }

    state.articleList.forEach((article) => {
      const card = document.createElement("div");
      card.className = "article-card";
      card.innerHTML = `
        <h3>${escapeHtml(article.title || "未命名文章")}</h3>
        <p>${escapeHtml(article.subtitle || "")}</p>
        <p>作者: ${escapeHtml(article.author || "未知")}</p>
        <p style="font-size:11px;color:#a08060">${escapeHtml(article.id)}</p>
        <div class="article-card-actions"></div>
      `;

      card.addEventListener("click", (evt) => {
        if (evt.target.closest(".article-card-actions")) return;
        openArticle(article.id);
      });

      const actions = card.querySelector(".article-card-actions");
      const exportBtn = document.createElement("button");
      exportBtn.textContent = "导出XML";
      exportBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        exportArticleXml(article.id, article.title);
      });
      actions.appendChild(exportBtn);

      if (isAdmin()) {
        const accessBtn = document.createElement("button");
        accessBtn.textContent = "权限管理";
        accessBtn.addEventListener("click", (evt) => {
          evt.stopPropagation();
          onManageAccess(article.id, article.title);
        });
        actions.appendChild(accessBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = "删除";
        delBtn.className = "danger";
        delBtn.addEventListener("click", (evt) => {
          evt.stopPropagation();
          deleteArticleById(article.id, article.title);
        });
        actions.appendChild(delBtn);
      }

      refs.articleGrid.appendChild(card);
    });
  }

  /**
   * @description 打开指定文章并加载其完整快照。
   * @param {string} articleId 文章 ID。
   * @returns {Promise<void>}
   */
  async function openArticle(articleId) {
    hideArticleSelect();
    if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = false;
    await loadSnapshot(articleId);
  }

  /**
   * @description 返回文章选择界面。
   * @returns {void}
   */
  function backToArticleSelect() {
    if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = true;
    showArticleSelect();
  }

  /**
   * @description 根据输入信息创建新文章并刷新列表。
   * @returns {Promise<void>}
   */
  async function createNewArticle() {
    const title = refs.newArticleTitle ? refs.newArticleTitle.value.trim() : "";
    const subtitle = refs.newArticleSubtitle
      ? refs.newArticleSubtitle.value.trim()
      : "";
    const author = refs.newArticleAuthor
      ? refs.newArticleAuthor.value.trim()
      : "";
    if (!title) {
      alert("请输入文章标题");
      return;
    }

    try {
      await apiRequest("/articles", {
        method: "POST",
        body: { title, subtitle, author, book: title, volume: subtitle },
      });
      if (refs.newArticleTitle) refs.newArticleTitle.value = "";
      if (refs.newArticleSubtitle) refs.newArticleSubtitle.value = "";
      if (refs.newArticleAuthor) refs.newArticleAuthor.value = "";
      await loadArticleList();
    } catch (error) {
      alert(error.message);
    }
  }

  return {
    showArticleSelect,
    hideArticleSelect,
    loadArticleList,
    renderArticleGrid,
    openArticle,
    backToArticleSelect,
    createNewArticle,
    exportArticleXml,
  };
};
