(function exposeUserManagementFactory(global) {
  /**
   * @description 创建用户管理工具，负责用户列表与账号操作。
   * @param {object} deps 依赖注入对象。
   * @returns {object} 用户管理方法集合。
   */
  function createUserManagement(deps) {
    const { refs, apiRequest, escapeHtml } = deps;

    /**
     * @description 打开用户管理弹窗并加载用户列表。
     * @returns {void}
     */
    function showUserManageDialog() {
      if (refs.userManageDialog) {
        refs.userManageDialog.hidden = false;
        loadUserList();
      }
    }

    /**
     * @description 关闭用户管理弹窗。
     * @returns {void}
     */
    function hideUserManageDialog() {
      if (refs.userManageDialog) refs.userManageDialog.hidden = true;
    }

    /**
     * @description 拉取并渲染全部用户列表。
     * @returns {Promise<void>}
     */
    async function loadUserList() {
      if (!refs.userList) return;
      try {
        const data = await apiRequest("/users");
        refs.userList.innerHTML = "";
        (data.users || []).forEach((user) => {
          const div = document.createElement("div");
          div.className = "user-item";
          const roleLabels = {
            admin: "管理员",
            editor: "编辑者",
            reviewer: "审校者",
          };
          div.innerHTML = `
            <div class="user-item-info">
              <strong>${escapeHtml(user.displayName || user.username)}</strong>
              <span class="role-badge ${user.role}">${roleLabels[user.role] || user.role}</span>
              <small>(${escapeHtml(user.username)})</small>
            </div>
            <div class="user-item-actions"></div>
          `;
          const actions = div.querySelector(".user-item-actions");

          const roleSelect = document.createElement("select");
          ["admin", "editor", "reviewer"].forEach((r) => {
            const opt = document.createElement("option");
            opt.value = r;
            opt.textContent = roleLabels[r];
            if (r === user.role) opt.selected = true;
            roleSelect.appendChild(opt);
          });
          roleSelect.addEventListener("change", () => {
            changeUserRole(user.id, roleSelect.value);
          });
          actions.appendChild(roleSelect);

          const resetBtn = document.createElement("button");
          resetBtn.textContent = "重置密码";
          resetBtn.addEventListener("click", () => {
            const newPw = prompt("输入新密码：");
            if (newPw) resetUserPassword(user.id, newPw);
          });
          actions.appendChild(resetBtn);

          if (user.username !== "admin") {
            const delBtn = document.createElement("button");
            delBtn.textContent = "删除";
            delBtn.className = "danger";
            delBtn.addEventListener("click", () => {
              if (confirm(`确定删除用户 ${user.username}？`)) {
                deleteUserById(user.id);
              }
            });
            actions.appendChild(delBtn);
          }

          refs.userList.appendChild(div);
        });
      } catch (error) {
        alert(error.message);
      }
    }

    /**
     * @description 创建新用户。
     * @returns {Promise<void>}
     */
    async function createNewUser() {
      const username = refs.newUserUsername.value.trim();
      const password = refs.newUserPassword.value;
      const displayName = refs.newUserDisplayName.value.trim();
      const role = refs.newUserRole.value;
      if (!username || !password) {
        alert("用户名和密码不能为空");
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
        loadUserList();
      } catch (error) {
        alert(error.message);
      }
    }

    /**
     * @description 修改用户角色。
     * @param {string} userId 用户 ID。
     * @param {string} role 角色值。
     * @returns {Promise<void>}
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
     * @description 重置用户密码。
     * @param {string} userId 用户 ID。
     * @param {string} password 新密码。
     * @returns {Promise<void>}
     */
    async function resetUserPassword(userId, password) {
      try {
        await apiRequest(`/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          body: { password },
        });
        alert("密码已重置");
      } catch (error) {
        alert(error.message);
      }
    }

    /**
     * @description 删除指定用户。
     * @param {string} userId 用户 ID。
     * @returns {Promise<void>}
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
