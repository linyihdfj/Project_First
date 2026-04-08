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
    showAppShell,
    hideAppShell,
    onManageAccess,
  } = deps;

  function articleRoleLabel(role) {
    return role === "reviewer" ? "审校者" : "编辑者";
  }

  function showArticleSelect() {
    hideAppShell();
    if (refs.articleSelectOverlay) refs.articleSelectOverlay.hidden = false;
    if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = true;

    if (state.currentUser) {
      if (refs.selectUserDisplayName) {
        refs.selectUserDisplayName.textContent =
          state.currentUser.displayName || state.currentUser.username;
      }
      if (refs.selectUserRoleBadge) {
        const labels = {
          admin: "管理员",
          editor: "编辑者",
          reviewer: "审校者",
        };
        refs.selectUserRoleBadge.textContent =
          labels[state.currentUser.role] || state.currentUser.role;
        refs.selectUserRoleBadge.className = `role-badge ${state.currentUser.role}`;
      }
    }

    if (refs.articleCreateSection) {
      refs.articleCreateSection.hidden = !(
        state.currentUser &&
        (state.currentUser.role === "admin" || state.currentUser.role === "editor")
      );
    }
    if (refs.btnSelectUserManage) {
      refs.btnSelectUserManage.hidden = !(
        state.currentUser && state.currentUser.role === "admin"
      );
    }

    loadArticleList().catch((error) => alert(error.message));
  };

  function hideArticleSelect() {
    if (refs.articleSelectOverlay) refs.articleSelectOverlay.hidden = true;
  }

  async function loadArticleList() {
    try {
      const data = await apiRequest("/articles");
      state.articleList = data.articles || [];
      renderArticleGrid();
      preloadArticleFirstPages(state.articleList);

      if (state.inviteTargetArticleId) {
        const targetId = state.inviteTargetArticleId;
        state.inviteTargetArticleId = "";
        if (state.articleList.some((article) => article.id === targetId)) {
          await openArticle(targetId);
        }
      }
    } catch (error) {
      state.articleList = [];
      renderArticleGrid();
    }
  }

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

  async function deleteArticleById(articleId, title) {
    if (!confirm(`确定删除文章“${title || articleId}”吗？`)) return;
    try {
      await apiRequest(`/articles/${encodeURIComponent(articleId)}`, {
        method: "DELETE",
      });
      await loadArticleList();
    } catch (error) {
      alert(error.message);
    }
  }

  function renderArticleGrid() {
    if (!refs.articleGrid) return;
    refs.articleGrid.innerHTML = "";

    if (!state.articleList.length) {
      refs.articleGrid.innerHTML =
        '<p style="color:#7f6348;grid-column:1/-1">暂无可访问文章。</p>';
      return;
    }

    state.articleList.forEach((article) => {
      const card = document.createElement("div");
      card.className = "article-card";
      card.innerHTML = `
        <h3>${escapeHtml(article.title || "未命名文章")}</h3>
        <p>${escapeHtml(article.subtitle || "")}</p>
        <p>作者：${escapeHtml(article.author || "未知")}</p>
        <p><span class="role-badge ${(article.articleRole || "editor") === "reviewer" ? "reviewer" : "editor"}">${escapeHtml(articleRoleLabel(article.articleRole || "editor"))}</span></p>
        <p style="font-size:11px;color:#a08060">${escapeHtml(article.id)}</p>
        <div class="article-card-actions"></div>
      `;

      card.addEventListener("click", (evt) => {
        if (evt.target.closest(".article-card-actions")) return;
        openArticle(article.id);
      });

      const actions = card.querySelector(".article-card-actions");

      const exportBtn = document.createElement("button");
      exportBtn.textContent = "导出 XML";
      exportBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        exportArticleXml(article.id, article.title);
      });
      actions.appendChild(exportBtn);

      const accessBtn = document.createElement("button");
      accessBtn.textContent = "成员与邀请";
      accessBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        onManageAccess(article.id, article.title);
      });
      actions.appendChild(accessBtn);

      if (isAdmin()) {
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

  async function openArticle(articleId) {
    hideArticleSelect();
    if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = false;
    await loadSnapshot(articleId);
    showAppShell();
  }

  function backToArticleSelect() {
    state.currentArticleRole = "";
    hideAppShell();
    if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = true;
    showArticleSelect();
  }

  async function createNewArticle() {
    const title = refs.newArticleTitle ? refs.newArticleTitle.value.trim() : "";
    const subtitle = refs.newArticleSubtitle
      ? refs.newArticleSubtitle.value.trim()
      : "";
    const author = refs.newArticleAuthor
      ? refs.newArticleAuthor.value.trim()
      : "";

    if (!title) {
      alert("请输入文章标题。");
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
