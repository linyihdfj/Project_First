(function exposeAuthPermissionsFactory(global) {

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

    function showLoginOverlay() {
      if (refs.loginOverlay) refs.loginOverlay.hidden = false;
    }

    function hideLoginOverlay() {
      if (refs.loginOverlay) refs.loginOverlay.hidden = true;
    }

    function isEditor() {
      return (
        state.currentUser &&
        (state.currentUser.role === "admin" ||
          state.currentUser.role === "editor")
      );
    }

    function isAdmin() {
      return state.currentUser && state.currentUser.role === "admin";
    }

    function canReview() {
      return (
        state.currentUser &&
        (state.currentUser.role === "admin" ||
          state.currentUser.role === "reviewer")
      );
    }

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
