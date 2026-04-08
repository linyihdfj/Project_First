(function exposeUserManagementFactory(global) {
  function createUserManagement(deps) {
    const { refs, apiRequest, escapeHtml } = deps;
    let userSearchTimer = null;

    function roleLabel(role) {
      return (
        {
          admin: "管理员",
          user: "用户",
        }[role] || role
      );
    }

    function applyRoleOptions() {
      if (!refs.newUserRole) return;
      refs.newUserRole.innerHTML = `
        <option value="user">普通用户</option>
        <option value="admin">管理员</option>
      `;
    }

    function showUserManageDialog() {
      applyRoleOptions();
      if (refs.userManageDialog) {
        refs.userManageDialog.hidden = false;
        loadUserList();
      }
    }

    function hideUserManageDialog() {
      if (refs.userManageDialog) refs.userManageDialog.hidden = true;
    }

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
