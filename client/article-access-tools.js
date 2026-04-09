/**
 * @description articleaccesstools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建articleaccesstools。
 * @param {*} deps 模块依赖集合。
 * @returns {*} articleaccesstools结果。
 */
window.createArticleAccessTools = function createArticleAccessTools(deps) {
  const { refs, state, apiRequest, escapeHtml } = deps;
  let accessSearchTimer = null;
  let selectedAccessUser = null;
  const inviteTokensById = new Map();

  /**
   * @description 处理globalrolelabel相关逻辑。
   * @param {*} role 角色值。
   * @returns {*} rolelabel结果。
   */
  function globalRoleLabel(role) {
    return role === "admin" ? "管理员" : "用户";
  }

  /**
   * @description 处理articlerolelabel相关逻辑。
   * @param {*} role 角色值。
   * @returns {*} rolelabel结果。
   */
  function articleRoleLabel(role) {
    if (role === "admin") return "文章管理员";
    if (role === "reviewer") return "审校者";
    return "编辑者";
  }

  /**
   * @description 判断是否可以manageinvites。
   * @returns {boolean} manageinvites是否成立。
   */
  function canManageInvites() {
    if (!state.currentUser) return false;
    return (
      state.currentUser.role === "admin" ||
      state.currentArticleRole === "admin" ||
      state.currentArticleRole === "editor" ||
      state.currentArticleRole === "reviewer"
    );
  }

  /**
   * @description 判断是否可以directgrant。
   * @returns {boolean} directgrant是否成立。
   */
  function canDirectGrant() {
    return !!(
      state.currentUser &&
      (state.currentUser.role === "admin" || state.currentArticleRole === "admin")
    );
  }

  /**
   * @description 应用accessroleoptions。
   * @returns {void} 无返回值。
   */
  function applyAccessRoleOptions() {
    if (refs.accessArticleRole) {
      refs.accessArticleRole.innerHTML = `
        <option value="admin">文章管理员</option>
        <option value="editor">共同编辑</option>
        <option value="reviewer">参与审校</option>
      `;
    }

    if (!refs.accessInviteRole) return;
    const options = [];
    if (state.currentUser && (state.currentUser.role === "admin" || state.currentArticleRole === "admin")) {
      options.push('<option value="admin">文章管理员</option>');
      options.push('<option value="editor">共同编辑</option>');
      options.push('<option value="reviewer">参与审校</option>');
    } else if (state.currentArticleRole === "editor") {
      options.push('<option value="editor">共同编辑</option>');
    } else if (state.currentArticleRole === "reviewer") {
      options.push('<option value="reviewer">参与审校</option>');
    }
    refs.accessInviteRole.innerHTML = options.join("");
  }

  /**
   * @description 渲染selectedaccessuser。
   * @returns {void} 无返回值。
   */
  function renderSelectedAccessUser() {
    if (!refs.accessSelectedUser) return;

    if (!selectedAccessUser) {
      refs.accessSelectedUser.textContent = "尚未选择用户。";
      return;
    }

    refs.accessSelectedUser.innerHTML = `已选择：<strong>${escapeHtml(
      selectedAccessUser.displayName || selectedAccessUser.username,
    )}</strong> <span class="muted">@${escapeHtml(
      selectedAccessUser.username,
    )}</span>`;
  }

  /**
   * @description 渲染accesslist。
   * @param {*} users users参数。
   * @returns {void} 无返回值。
   */
  function renderAccessList(users) {
    if (!refs.accessUserList) return;
    refs.accessUserList.innerHTML = "";

    if (!users.length) {
      refs.accessUserList.innerHTML =
        '<div class="empty-hint">暂无可见文章成员。</div>';
      return;
    }

    users.forEach((user) => {
      const div = document.createElement("div");
      div.className = "user-item";
      div.innerHTML = `
        <div class="user-item-info">
          <strong>${escapeHtml(user.displayName || user.username)}</strong>
          <span class="role-badge ${user.articleRole || "editor"}">${articleRoleLabel(user.articleRole || "editor")}</span>
          <small>@${escapeHtml(user.username)}</small>
          <small>${globalRoleLabel(user.role)}</small>
        </div>
        <div class="user-item-actions"></div>
      `;

      const actions = div.querySelector(".user-item-actions");
      if (canDirectGrant()) {
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "移除";
        removeBtn.className = "danger";
        removeBtn.addEventListener("click", () => revokeAccess(user.id));
        actions.appendChild(removeBtn);
      }
      refs.accessUserList.appendChild(div);
    });
  }

  /**
   * @description 加载accesslist。
   * @param {*} articleId 文章 ID。
   * @returns {*} accesslist结果。
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
   * @description 渲染usersearchresults。
   * @param {*} users users参数。
   * @param {*} errorMessage errormessage参数。
   * @returns {void} 无返回值。
   */
  function renderUserSearchResults(users, errorMessage) {
    if (!refs.accessUserResults) return;
    refs.accessUserResults.innerHTML = "";

    if (errorMessage) {
      refs.accessUserResults.innerHTML = `<div class="empty-hint">${escapeHtml(
        errorMessage,
      )}</div>`;
      return;
    }

    if (!users.length) {
      refs.accessUserResults.innerHTML =
        '<div class="empty-hint">未找到匹配用户。</div>';
      return;
    }

    users.forEach((user) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result-item";
      button.innerHTML = `
        <strong>${escapeHtml(user.displayName || user.username)}</strong>
        <span>@${escapeHtml(user.username)}</span>
        <small>${globalRoleLabel(user.role)}</small>
      `;
      button.addEventListener("click", () => {
        selectedAccessUser = user;
        renderSelectedAccessUser();
      });
      refs.accessUserResults.appendChild(button);
    });
  }

  /**
   * @description 处理searchusers相关逻辑。
   * @returns {*} users结果。
   */
  async function searchUsers() {
    if (!canDirectGrant()) return;

    const query = refs.accessUserSearch ? refs.accessUserSearch.value.trim() : "";
    if (!query) {
      renderUserSearchResults([], "请输入用户名或显示名进行搜索。");
      return;
    }

    try {
      const data = await apiRequest(`/users?q=${encodeURIComponent(query)}`);
      renderUserSearchResults(data.users || []);
    } catch (error) {
      renderUserSearchResults([], error.message);
    }
  }

  /**
   * @description 构建inviteurl。
   * @param {*} token 认证令牌。
   * @returns {*} inviteurl结果。
   */
  function buildInviteUrl(token) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("invite", token);
    return url.toString();
  }

  /**
   * @description 格式化invitecreated。
   * @param {*} value 待处理的值。
   * @returns {string} invitecreated后的字符串。
   */
  function formatInviteCreatedAt(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  }

  /**
   * @description 加载invitelist。
   * @param {*} articleId 文章 ID。
   * @returns {*} invitelist结果。
   */
  async function loadInviteList(articleId) {
    if (!canManageInvites() || !refs.accessInviteList) return;

    try {
      const data = await apiRequest(
        `/articles/${encodeURIComponent(articleId)}/invites`,
      );
      const invites = data.invites || [];
      refs.accessInviteList.innerHTML = "";

      if (!invites.length) {
        refs.accessInviteList.innerHTML =
          '<div class="empty-hint">暂无邀请链接。</div>';
        return;
      }

      invites.forEach((invite) => {
        if (invite.token) {
          inviteTokensById.set(invite.id, invite.token);
        }

        const row = document.createElement("div");
        row.className = "user-item";
        row.innerHTML = `
          <div class="user-item-info">
            <strong>${articleRoleLabel(invite.role)}</strong>
            <small>${escapeHtml(invite.createdByDisplayName || "")}</small>
            <small>${escapeHtml(formatInviteCreatedAt(invite.createdAt))}</small>
          </div>
          <div class="user-item-actions"></div>
        `;

        const actions = row.querySelector(".user-item-actions");
        const token = invite.token || inviteTokensById.get(invite.id) || "";

        if (token) {
          const copyBtn = document.createElement("button");
          copyBtn.textContent = "📋 复制链接";
          copyBtn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(buildInviteUrl(token));
            alert("邀请链接已复制。");
          });
          actions.appendChild(copyBtn);
        }

        const stopBtn = document.createElement("button");
        stopBtn.textContent = "🛑 停用";
        stopBtn.className = "danger";
        stopBtn.addEventListener("click", async () => {
          if (!confirm("确定停用这条邀请链接吗？")) return;
          await apiRequest(
            `/article-invites/${encodeURIComponent(invite.id)}`,
            { method: "DELETE" },
          );
          inviteTokensById.delete(invite.id);
          await loadInviteList(articleId);
        });
        actions.appendChild(stopBtn);

        refs.accessInviteList.appendChild(row);
      });
    } catch (error) {
      refs.accessInviteList.innerHTML = `<div class="empty-hint">${escapeHtml(
        error.message,
      )}</div>`;
    }
  }

  /**
   * @description 创建invite。
   * @returns {*} invite结果。
   */
  async function createInvite() {
    if (!state.accessArticleId || !refs.accessInviteRole) return;

    try {
      const data = await apiRequest(
        `/articles/${encodeURIComponent(state.accessArticleId)}/invites`,
        {
          method: "POST",
          body: { role: refs.accessInviteRole.value },
        },
      );
      if (data.invite && data.invite.id && data.invite.token) {
        inviteTokensById.set(data.invite.id, data.invite.token);
        await navigator.clipboard.writeText(buildInviteUrl(data.invite.token));
      }
      await loadInviteList(state.accessArticleId);
      alert("邀请链接已生成并复制。");
    } catch (error) {
      alert(error.message);
    }
  }

  /**
   * @description 显示accessdialog。
   * @param {*} articleId 文章 ID。
   * @param {*} title title参数。
   * @returns {void} 无返回值。
   */
  async function showAccessDialog(articleId, title) {
    state.accessArticleId = articleId;
    selectedAccessUser = null;
    renderSelectedAccessUser();
    applyAccessRoleOptions();

    if (refs.accessArticleTitle) {
      refs.accessArticleTitle.textContent = title || articleId;
    }
    if (refs.articleAccessDialog) refs.articleAccessDialog.hidden = false;
    if (refs.accessDirectGrantSection) {
      refs.accessDirectGrantSection.hidden = !canDirectGrant();
    }
    if (refs.accessInviteSection) {
      refs.accessInviteSection.hidden = !canManageInvites();
    }
    if (refs.accessUserResults) refs.accessUserResults.innerHTML = "";
    if (refs.accessInviteList) refs.accessInviteList.innerHTML = "";
    if (refs.accessUserSearch) refs.accessUserSearch.value = "";

    await loadAccessList(articleId);
    await loadInviteList(articleId);
  }

  /**
   * @description 隐藏accessdialog。
   * @returns {void} 无返回值。
   */
  function hideAccessDialog() {
    if (refs.articleAccessDialog) refs.articleAccessDialog.hidden = true;
    state.accessArticleId = null;
    selectedAccessUser = null;
  }

  /**
   * @description 处理grantaccess相关逻辑。
   * @returns {*} access结果。
   */
  async function grantAccess() {
    if (!state.accessArticleId || !canDirectGrant()) return;

    const userId = selectedAccessUser && selectedAccessUser.id;

    if (!userId) {
      alert("请先搜索并选择一个用户。");
      return;
    }

    try {
      await apiRequest(
        `/articles/${encodeURIComponent(state.accessArticleId)}/access`,
        {
          method: "POST",
          body: {
            userId,
            articleRole: refs.accessArticleRole
              ? refs.accessArticleRole.value
              : "editor",
          },
        },
      );
      await loadAccessList(state.accessArticleId);
    } catch (error) {
      alert(error.message);
    }
  }

  /**
   * @description 处理revokeaccess相关逻辑。
   * @param {*} userId 用户 ID。
   * @returns {*} access结果。
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

  if (refs.accessUserSearch) {
    refs.accessUserSearch.addEventListener("input", () => {
      window.clearTimeout(accessSearchTimer);
      accessSearchTimer = window.setTimeout(() => {
        searchUsers();
      }, 250);
    });
  }

  return {
    showAccessDialog,
    hideAccessDialog,
    grantAccess,
    createInvite,
  };
};

