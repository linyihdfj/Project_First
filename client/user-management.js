(function exposeUserManagementFactory(global) {

  function createUserManagement(deps) {
    const { refs, apiRequest, escapeHtml } = deps;

    function showUserManageDialog() {
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
        alert("密码已重置");
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
