window.createArticleAccessTools = function createArticleAccessTools(deps) {
  const { refs, state, apiRequest, escapeHtml } = deps;

  /**
   * @description 加载文章授权用户列表并渲染。
   * @param {string} articleId 文章 ID。
   * @returns {Promise<void>}
   */
  async function loadAccessList(articleId) {
    try {
      const data = await apiRequest(
        `/articles/${encodeURIComponent(articleId)}/access`,
      );
      renderAccessList(data.users || []);
    } catch (error) {
      renderAccessList([]);
    }
  }

  /**
   * @description 渲染已授权用户列表。
   * @param {Array<object>} users 用户数组。
   * @returns {void}
   */
  function renderAccessList(users) {
    if (!refs.accessUserList) return;
    refs.accessUserList.innerHTML = "";

    if (!users.length) {
      refs.accessUserList.innerHTML =
        '<p style="color:#7f6348;font-size:13px">暂无已授权用户</p>';
      return;
    }

    const roleLabels = {
      admin: "管理员",
      editor: "编辑者",
      reviewer: "审校者",
    };
    users.forEach((user) => {
      const div = document.createElement("div");
      div.className = "user-item";
      div.innerHTML = `
        <div class="user-item-info">
          <strong>${escapeHtml(user.displayName || user.username)}</strong>
          <span class="role-badge ${user.role}">${roleLabels[user.role] || user.role}</span>
        </div>
        <div class="user-item-actions"></div>
      `;
      const actions = div.querySelector(".user-item-actions");
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "移除";
      removeBtn.className = "danger";
      removeBtn.addEventListener("click", () => revokeAccess(user.id));
      actions.appendChild(removeBtn);
      refs.accessUserList.appendChild(div);
    });
  }

  /**
   * @description 打开权限管理弹窗并初始化候选用户与授权列表。
   * @param {string} articleId 文章 ID。
   * @param {string} title 文章标题。
   * @returns {Promise<void>}
   */
  async function showAccessDialog(articleId, title) {
    state.accessArticleId = articleId;
    if (refs.accessArticleTitle)
      refs.accessArticleTitle.textContent = title || articleId;
    if (refs.articleAccessDialog) refs.articleAccessDialog.hidden = false;

    try {
      const data = await apiRequest("/users");
      if (refs.accessUserSelect) {
        refs.accessUserSelect.innerHTML = "";
        (data.users || []).forEach((user) => {
          const opt = document.createElement("option");
          opt.value = user.id;
          opt.textContent = `${user.displayName || user.username} (${user.username})`;
          refs.accessUserSelect.appendChild(opt);
        });
      }
    } catch (error) {
      alert(error.message);
    }

    await loadAccessList(articleId);
  }

  /**
   * @description 关闭权限管理弹窗并清理当前文章上下文。
   * @returns {void}
   */
  function hideAccessDialog() {
    if (refs.articleAccessDialog) refs.articleAccessDialog.hidden = true;
    state.accessArticleId = null;
  }

  /**
   * @description 为当前文章新增用户访问权限。
   * @returns {Promise<void>}
   */
  async function grantAccess() {
    if (!state.accessArticleId || !refs.accessUserSelect) return;
    const userId = refs.accessUserSelect.value;
    if (!userId) return;

    try {
      await apiRequest(
        `/articles/${encodeURIComponent(state.accessArticleId)}/access`,
        {
          method: "POST",
          body: { userId },
        },
      );
      await loadAccessList(state.accessArticleId);
    } catch (error) {
      alert(error.message);
    }
  }

  /**
   * @description 移除当前文章指定用户的访问权限。
   * @param {string} userId 用户 ID。
   * @returns {Promise<void>}
   */
  async function revokeAccess(userId) {
    if (!state.accessArticleId) return;

    try {
      await apiRequest(
        `/articles/${encodeURIComponent(state.accessArticleId)}/access/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      await loadAccessList(state.accessArticleId);
    } catch (error) {
      alert(error.message);
    }
  }

  return {
    showAccessDialog,
    hideAccessDialog,
    loadAccessList,
    renderAccessList,
    grantAccess,
    revokeAccess,
  };
};
