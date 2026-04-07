(function exposeAuthPermissionsFactory(global) {
  /**
   * @description 创建认证与权限控制工具，负责登录态、角色能力和 UI 权限开关。
   * @param {object} deps 依赖注入对象。
   * @returns {object} 认证权限相关方法集合。
   */
  function createAuthPermissions(deps) {
    const {
      refs,
      state,
      apiPath,
      apiRequest,
      setAuthToken,
      removeAuthToken,
      getAuthToken,
      initSocket,
      getSocket,
      setSocket,
      showArticleSelect,
      hideArticleSelect,
    } = deps;

    /**
     * @description 显示登录遮罩层。
     * @returns {void}
     */
    function showLoginOverlay() {
      if (refs.loginOverlay) refs.loginOverlay.hidden = false;
    }

    /**
     * @description 隐藏登录遮罩层。
     * @returns {void}
     */
    function hideLoginOverlay() {
      if (refs.loginOverlay) refs.loginOverlay.hidden = true;
    }

    /**
     * @description 判断当前用户是否具备编辑权限。
     * @returns {boolean}
     */
    function isEditor() {
      return (
        state.currentUser &&
        (state.currentUser.role === "admin" ||
          state.currentUser.role === "editor")
      );
    }

    /**
     * @description 判断当前用户是否为管理员。
     * @returns {boolean}
     */
    function isAdmin() {
      return state.currentUser && state.currentUser.role === "admin";
    }

    /**
     * @description 判断当前用户是否具备审校权限。
     * @returns {boolean}
     */
    function canReview() {
      return (
        state.currentUser &&
        (state.currentUser.role === "admin" ||
          state.currentUser.role === "reviewer")
      );
    }

    /**
     * @description 按角色更新工具栏和表单控件可编辑性。
     * @returns {void}
     */
    function applyPermissions() {
      const editable = isEditor();
      if (refs.toolbarEditControls) {
        refs.toolbarEditControls.style.display = editable ? "" : "none";
      }
      if (refs.toolbarAnnotationControls) {
        refs.toolbarAnnotationControls.style.display = editable ? "" : "none";
      }
      const aiControls = document.getElementById("toolbar-ai-controls");
      if (aiControls) aiControls.style.display = editable ? "" : "none";
      if (refs.headingAddSection) {
        refs.headingAddSection.style.display = editable ? "" : "none";
      }
      if (refs.metaForm) {
        refs.metaForm.querySelectorAll("input").forEach((input) => {
          input.disabled = !editable;
        });
      }
      if (refs.annotationSvg) {
        refs.annotationSvg.style.cursor = editable ? "crosshair" : "default";
      }
    }

    /**
     * @description 更新顶部用户栏显示信息与管理按钮状态。
     * @returns {void}
     */
    function updateUserBar() {
      if (!refs.userBar) return;
      if (!state.currentUser) {
        refs.userBar.hidden = true;
        return;
      }
      refs.userBar.hidden = false;
      refs.userDisplayName.textContent =
        state.currentUser.displayName || state.currentUser.username;
      const roleLabels = {
        admin: "管理员",
        editor: "编辑者",
        reviewer: "审校者",
      };
      refs.userRoleBadge.textContent =
        roleLabels[state.currentUser.role] || state.currentUser.role;
      refs.userRoleBadge.className = `role-badge ${state.currentUser.role}`;
      if (refs.btnUserManage) {
        refs.btnUserManage.hidden = state.currentUser.role !== "admin";
      }
    }

    /**
     * @description 执行登录流程，成功后初始化权限与协作连接。
     * @returns {Promise<void>}
     */
    async function doLogin() {
      const username = refs.loginUsername.value.trim();
      const password = refs.loginPassword.value;
      if (!username || !password) {
        refs.loginError.textContent = "请输入用户名和密码";
        refs.loginError.hidden = false;
        return;
      }
      refs.loginError.hidden = true;

      try {
        const response = await fetch(apiPath("/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          refs.loginError.textContent = data.message || "登录失败";
          refs.loginError.hidden = false;
          return;
        }
        setAuthToken(data.token);
        state.currentUser = data.user;
        hideLoginOverlay();
        applyPermissions();
        updateUserBar();
        showArticleSelect();
        initSocket();
      } catch (error) {
        refs.loginError.textContent = error.message;
        refs.loginError.hidden = false;
      }
    }

    /**
     * @description 执行登出流程并回到登录/选文前状态。
     * @returns {void}
     */
    function doLogout() {
      const socket = getSocket();
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      removeAuthToken();
      state.currentUser = null;
      hideArticleSelect();
      if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = true;
      showLoginOverlay();
      updateUserBar();
    }

    /**
     * @description 校验本地 token 并恢复会话。
     * @returns {Promise<boolean>} 鉴权成功返回 true。
     */
    async function checkAuth() {
      const token = getAuthToken();
      if (!token) {
        showLoginOverlay();
        return false;
      }
      try {
        const data = await apiRequest("/auth/me");
        state.currentUser = data.user;
        hideLoginOverlay();
        applyPermissions();
        updateUserBar();
        showArticleSelect();
        initSocket();
        return true;
      } catch (error) {
        showLoginOverlay();
        return false;
      }
    }

    return {
      showLoginOverlay,
      hideLoginOverlay,
      doLogin,
      doLogout,
      checkAuth,
      updateUserBar,
      isEditor,
      isAdmin,
      canReview,
      applyPermissions,
    };
  }

  global.createAuthPermissions = createAuthPermissions;
})(window);
