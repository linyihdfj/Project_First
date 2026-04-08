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
      onInviteAccepted,
    } = deps;

    function inviteTokenFromLocation() {
      const params = new URLSearchParams(window.location.search);
      return String(params.get("invite") || "").trim();
    }

    function clearInviteTokenFromLocation() {
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, document.title, url.toString());
    }

    function clearLoginError() {
      if (!refs.loginError) return;
      refs.loginError.textContent = "";
      refs.loginError.hidden = true;
    }

    function showLoginError(message) {
      if (!refs.loginError) return;
      refs.loginError.textContent = message;
      refs.loginError.hidden = false;
    }

    function setText(id, text) {
      const element = document.getElementById(id);
      if (element) element.textContent = text;
    }

    function applyStaticCopy() {
      const loginBox = document.querySelector(".login-box");
      if (loginBox) {
        const heading = loginBox.querySelector("h1");
        const subheading = loginBox.querySelector(":scope > p");
        if (heading) heading.textContent = "古籍在线编辑系统";
        if (subheading) subheading.textContent = "多人协同编辑与审校";
      }

      const inviteInfoTitle = document.querySelector(".invite-info-title");
      if (inviteInfoTitle) inviteInfoTitle.textContent = "邀请加入文章";
      setText("btn-login", "🔐 登录");
      setText("btn-show-invite-register", "✨ 没有账号？去注册");
      setText("btn-invite-register", "✨ 注册并加入");
      setText("btn-show-invite-login", "↩️ 已有账号？返回登录");
      setText("btn-select-user-manage", "⚙️ 用户管理");
      setText("btn-select-logout", "🚪 退出");
      setText("btn-create-article", "➕ 创建文章");
      setText("btn-back-to-select", "↩️ 返回选择");
      setText("btn-user-manage", "⚙️ 用户管理");
      setText("btn-logout", "🚪 退出");
      setText("btn-clear-pages", "🗑️ 清空页面");
      setText("btn-export-xml", "📤 导出 XML");
      setText("btn-grant-access", "👤 授权");
      setText("btn-create-invite", "🔗 生成邀请链接");
      setText("btn-create-user", "👤 创建用户");
      setText("btn-export-glyph", "📤 导出造字映射");

      const importLabel = document.querySelector('label[for="image-upload"]');
      if (importLabel) importLabel.textContent = "📥 导入古籍";
    }

    function roleLabel(role) {
      const labels = {
        admin: "管理员",
        editor: "编辑者",
        reviewer: "审校者",
      };
      return labels[role] || role;
    }

    function showLoginOverlay() {
      hideArticleSelect();
      hideAppShell();
      if (refs.loginOverlay) refs.loginOverlay.hidden = false;
    }

    function hideLoginOverlay() {
      if (refs.loginOverlay) refs.loginOverlay.hidden = true;
    }

    function showAppShell() {
      if (refs.appTopbar) refs.appTopbar.hidden = false;
      if (refs.appTabs) refs.appTabs.hidden = false;
      if (refs.appMain) refs.appMain.hidden = false;
    }

    function hideAppShell() {
      if (refs.appTopbar) refs.appTopbar.hidden = true;
      if (refs.appTabs) refs.appTabs.hidden = true;
      if (refs.appMain) refs.appMain.hidden = true;
    }

    function isEditor() {
      if (!state.currentUser) return false;
      if (state.currentUser.role === "admin") return true;
      return state.currentArticleRole === "editor";
    }

    function isAdmin() {
      return !!(state.currentUser && state.currentUser.role === "admin");
    }

    function canReview() {
      if (!state.currentUser) return false;
      if (state.currentUser.role === "admin") return true;
      return state.currentArticleRole === "reviewer";
    }

    function setInviteAuthMode(mode) {
      state.inviteAuthMode = mode === "register" ? "register" : "login";
      renderInviteMode();
    }

    function showInviteLoginMode() {
      setInviteAuthMode("login");
    }

    function showInviteRegisterMode() {
      if (!state.pendingInvite) return;
      setInviteAuthMode("register");
    }

    function renderInviteMode() {
      applyStaticCopy();
      const invite = state.pendingInvite;
      if (
        !refs.inviteInfoBox ||
        !refs.inviteLoginForm ||
        !refs.inviteRegisterForm ||
        !refs.inviteLoginHint
      ) {
        return;
      }

      const hasInvite = !!invite;
      const isInviteRegister =
        hasInvite && state.inviteAuthMode === "register";
      const isInviteLogin = hasInvite && state.inviteAuthMode === "login";
      const showRegister = isInviteRegister;
      const showLogin = !isInviteRegister;

      if (refs.authPanelTitle) {
        refs.authPanelTitle.textContent = hasInvite ? "登录已有账号" : "账号登录";
      }
      if (refs.authPanelDescription) {
        refs.authPanelDescription.textContent = hasInvite
          ? "已有账号可直接登录并接受这次邀请。"
          : "登录后进入文章选择页面。";
      }
      if (refs.inviteRegisterTitle) {
        refs.inviteRegisterTitle.textContent = "注册新账号";
      }
      if (refs.inviteRegisterDescription) {
        refs.inviteRegisterDescription.textContent = hasInvite
          ? "创建账号后将自动加入这篇文章。"
          : "创建账号后可登录并进入文章选择页面。";
      }

      refs.inviteInfoBox.hidden = !hasInvite;
      refs.inviteInfoBox.style.display = hasInvite ? "" : "none";
      refs.inviteLoginForm.hidden = !showLogin;
      refs.inviteLoginForm.style.display = showLogin ? "" : "none";
      refs.inviteRegisterForm.hidden = !showRegister;
      refs.inviteRegisterForm.style.display = showRegister ? "" : "none";
      refs.inviteLoginHint.hidden = true;
      refs.inviteLoginHint.style.display = "none";

      if (refs.btnShowInviteRegister) {
        refs.btnShowInviteRegister.hidden = !isInviteLogin;
      }
      if (refs.btnShowInviteLogin) {
        refs.btnShowInviteLogin.hidden = !isInviteRegister;
      }

      if (!hasInvite) {
        state.inviteAuthMode = "login";
        if (refs.inviteArticleTitle) refs.inviteArticleTitle.textContent = "";
        if (refs.inviteRoleBadge) {
          refs.inviteRoleBadge.textContent = "";
          refs.inviteRoleBadge.className = "role-badge";
        }
        if (refs.inviteCreatedBy) refs.inviteCreatedBy.textContent = "";
        return;
      }

      if (refs.inviteArticleTitle) {
        refs.inviteArticleTitle.textContent =
          invite.articleTitle || invite.articleId || "";
      }
      if (refs.inviteRoleBadge) {
        refs.inviteRoleBadge.textContent = roleLabel(invite.role);
        refs.inviteRoleBadge.className = `role-badge ${invite.role || "editor"}`;
      }
      if (refs.inviteCreatedBy) {
        refs.inviteCreatedBy.textContent =
          invite.createdByDisplayName || invite.createdBy || "未知用户";
      }
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
      refs.userRoleBadge.textContent = roleLabel(state.currentUser.role);
      refs.userRoleBadge.className = `role-badge ${state.currentUser.role}`;

      if (refs.btnUserManage) {
        refs.btnUserManage.hidden = state.currentUser.role !== "admin";
      }
    }

    async function resolveInviteFromLocation() {
      const token = inviteTokenFromLocation();
      if (!token) {
        state.pendingInvite = null;
        state.inviteAuthMode = "login";
        renderInviteMode();
        return null;
      }

      try {
        const response = await fetch(
          `${apiPath("/article-invites/resolve")}?token=${encodeURIComponent(token)}`,
        );
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(
            data && data.message ? data.message : "邀请链接无效。",
          );
        }
        state.pendingInvite = { ...data.invite, token };
        state.inviteAuthMode = "login";
        renderInviteMode();
        return state.pendingInvite;
      } catch (error) {
        state.pendingInvite = null;
        state.inviteAuthMode = "login";
        clearInviteTokenFromLocation();
        renderInviteMode();
        showLoginError(error.message || "邀请链接已失效。");
        return null;
      }
    }

    async function acceptPendingInvite() {
      if (!state.currentUser || !state.pendingInvite || !state.pendingInvite.token) {
        return null;
      }

      const data = await apiRequest("/article-invites/accept", {
        method: "POST",
        body: { token: state.pendingInvite.token },
      });

      state.pendingInvite = null;
      state.inviteAuthMode = "login";
      clearInviteTokenFromLocation();
      renderInviteMode();

      if (data && data.invite && data.invite.articleId && onInviteAccepted) {
        onInviteAccepted(data.invite.articleId);
      }

      return data.invite || null;
    }

    async function finalizeAuthenticatedSession(user) {
      state.currentUser = user;
      hideLoginOverlay();
      hideAppShell();
      updateUserBar();
      showArticleSelect();
      initSocket();

      if (state.pendingInvite) {
        try {
          await acceptPendingInvite();
          showLoginError("已接受邀请。");
        } catch (error) {
          showLoginError(error.message);
        }
      }

      applyPermissions();
    }

    async function doLogin() {
      const username = refs.loginUsername.value.trim();
      const password = refs.loginPassword.value;

      if (!username || !password) {
        showLoginError("请输入用户名和密码。");
        return;
      }

      clearLoginError();

      try {
        const response = await fetch(apiPath("/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          showLoginError(data.message || "登录失败。");
          return;
        }

        setAuthToken(data.token);
        await finalizeAuthenticatedSession(data.user);
      } catch (error) {
        showLoginError(error.message);
      }
    }

    async function doInviteRegister() {
      if (!state.pendingInvite || !state.pendingInvite.token) return;

      const username = refs.inviteRegisterUsername.value.trim();
      const password = refs.inviteRegisterPassword.value;
      const displayName = refs.inviteRegisterDisplayName.value.trim();

      if (!username || !password) {
        showLoginError("请输入用户名和密码。");
        return;
      }

      clearLoginError();

      try {
        const response = await fetch(apiPath("/auth/register-by-invite"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            displayName,
            token: state.pendingInvite.token,
          }),
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(
            data && data.message ? data.message : "通过邀请注册失败。",
          );
        }

        setAuthToken(data.token);
        state.pendingInvite = null;
        state.inviteAuthMode = "login";
        clearInviteTokenFromLocation();
        renderInviteMode();

        if (data.invite && data.invite.articleId && onInviteAccepted) {
          onInviteAccepted(data.invite.articleId);
        }

        await finalizeAuthenticatedSession(data.user);
      } catch (error) {
        showLoginError(error.message);
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
      state.currentArticleRole = "";
      state.pendingInvite = null;
      state.inviteAuthMode = "login";
      hideArticleSelect();
      clearLoginError();

      if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = true;

      showLoginOverlay();
      updateUserBar();
      renderInviteMode();
    }

    async function checkAuth() {
      await resolveInviteFromLocation();

      const token = getAuthToken();
      if (!token) {
        showLoginOverlay();
        return false;
      }

      try {
        const data = await apiRequest("/auth/me");
        await finalizeAuthenticatedSession(data.user);
        return true;
      } catch (error) {
        showLoginOverlay();
        return false;
      }
    }

    return {
      showLoginOverlay,
      hideLoginOverlay,
      showAppShell,
      hideAppShell,
      doLogin,
      doInviteRegister,
      setInviteAuthMode,
      showInviteLoginMode,
      showInviteRegisterMode,
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
