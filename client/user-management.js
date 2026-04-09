/**
 * @description usermanagement相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 处理exposeusermanagementfactory相关逻辑。
 * @param {*} global global参数。
 * @returns {*} usermanagementfactory结果。
 */
(function exposeUserManagementFactory(global) {

  /**
   * @description 创建usermanagement。
   * @param {*} deps 模块依赖集合。
   * @returns {*} usermanagement结果。
   */
  function createUserManagement(deps) {
    const { refs, apiRequest, escapeHtml } = deps;
    let userSearchTimer = null;

    /**
     * @description 处理rolelabel相关逻辑。
     * @param {*} role 角色值。
     * @returns {*} label结果。
     */
    function roleLabel(role) {
      return (
        {
          admin: "管理员",
          user: "用户",
        }[role] || role
      );
    }

    /**
     * @description 应用roleoptions。
     * @returns {void} 无返回值。
     */
    function applyRoleOptions() {
      if (!refs.newUserRole) return;
      refs.newUserRole.innerHTML = `
        <option value="user">普通用户</option>
        <option value="admin">管理员</option>
      `;
    }

    /**
     * @description 显示usermanagedialog。
     * @returns {void} 无返回值。
     */
    function showUserManageDialog() {
      applyRoleOptions();
      if (refs.userManageDialog) {
        refs.userManageDialog.hidden = false;
        loadUserList();
      }
    }

    /**
     * @description 隐藏usermanagedialog。
     * @returns {void} 无返回值。
     */
    function hideUserManageDialog() {
      if (refs.userManageDialog) refs.userManageDialog.hidden = true;
    }

    /**
     * @description 加载userlist。
     * @returns {*} userlist结果。
     */
    async function loadUserList() {
      if (!refs.userList) return;
      const query = refs.userSearchInput ? refs.userSearchInput.value.trim() : "";
      try {
        const data = await apiRequest(
          `/users${query ? `?q=${encodeURIComponent(query)}` : ""}`,
        );
        refs.userList.innerHTML = "";
        if (!(data.users || []).length) {
          refs.userList.innerHTML =
            '<div class="empty-hint">没有找到匹配的用户。</div>';
          return;
        }

        (data.users || []).forEach((user) => {
          const div = document.createElement("div");
          div.className = "user-item";
          div.innerHTML = `
            <div class="user-item-info">
              <strong>${escapeHtml(user.displayName || user.username)}</strong>
              <span class="role-badge ${user.role}">${roleLabel(user.role)}</span>
              <small>@${escapeHtml(user.username)}</small>
            </div>
            <div class="user-item-actions"></div>
          `;
          const actions = div.querySelector(".user-item-actions");

          const roleSelect = document.createElement("select");
          ["user", "admin"].forEach((role) => {
            const opt = document.createElement("option");
            opt.value = role;
            opt.textContent = roleLabel(role);
            opt.selected = role === user.role;
            roleSelect.appendChild(opt);
          });
          roleSelect.addEventListener("change", () => {
            changeUserRole(user.id, roleSelect.value);
          });
          actions.appendChild(roleSelect);

          const resetBtn = document.createElement("button");
          resetBtn.textContent = "重置密码";
          resetBtn.addEventListener("click", () => {
            const newPw = prompt(`请输入用户 ${user.username} 的新密码`);
            if (newPw) resetUserPassword(user.id, newPw);
          });
          actions.appendChild(resetBtn);

          if (user.username !== "admin") {
            const delBtn = document.createElement("button");
            delBtn.textContent = "删除";
            delBtn.className = "danger";
            delBtn.addEventListener("click", () => {
              if (confirm(`确定删除用户 ${user.username} 吗？`)) {
                deleteUserById(user.id);
              }
            });
            actions.appendChild(delBtn);
          }

          refs.userList.appendChild(div);
        });
      } catch (error) {
        refs.userList.innerHTML = `<div class="empty-hint">${escapeHtml(error.message)}</div>`;
      }
    }

    /**
     * @description 创建newuser。
     * @returns {*} newuser结果。
     */
    async function createNewUser() {
      const username = refs.newUserUsername.value.trim();
      const password = refs.newUserPassword.value;
      const displayName = refs.newUserDisplayName.value.trim();
      const role = refs.newUserRole.value;
      if (!username || !password) {
        alert("用户名和密码不能为空。");
        return;
      }
      try {
        await apiRequest("/auth/register", {
          method: "POST",
          body: { username, password, displayName, role },
        });
        refs.newUserUsername.value = "";
        refs.newUserPassword.value = "";
        refs.newUserDisplayName.value = "";
        applyRoleOptions();
        loadUserList();
      } catch (error) {
        alert(error.message);
      }
    }

    /**
     * @description 处理changeuserrole相关逻辑。
     * @param {*} userId 用户 ID。
     * @param {*} role 角色值。
     * @returns {*} userrole结果。
     */
    async function changeUserRole(userId, role) {
      try {
        await apiRequest(`/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          body: { role },
        });
        loadUserList();
      } catch (error) {
        alert(error.message);
      }
    }

    /**
     * @description 重置userpassword。
     * @param {*} userId 用户 ID。
     * @param {*} password password参数。
     * @returns {void} 无返回值。
     */
    async function resetUserPassword(userId, password) {
      try {
        await apiRequest(`/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          body: { password },
        });
        alert("密码已重置。");
      } catch (error) {
        alert(error.message);
      }
    }

    /**
     * @description 处理deleteuserid相关逻辑。
     * @param {*} userId 用户 ID。
     * @returns {void} 无返回值。
     */
    async function deleteUserById(userId) {
      try {
        await apiRequest(`/users/${encodeURIComponent(userId)}`, {
          method: "DELETE",
        });
        loadUserList();
      } catch (error) {
        alert(error.message);
      }
    }

    applyRoleOptions();

    if (refs.userSearchInput) {
      refs.userSearchInput.addEventListener("input", () => {
        window.clearTimeout(userSearchTimer);
        userSearchTimer = window.setTimeout(() => {
          loadUserList();
        }, 250);
      });
    }

    return {
      showUserManageDialog,
      hideUserManageDialog,
      loadUserList,
      createNewUser,
      changeUserRole,
      resetUserPassword,
      deleteUserById,
    };
  }

  global.createUserManagement = createUserManagement;
})(window);

