/* SecureTask Cloud frontend controller. Keeps API endpoints unchanged while upgrading the UI. */
const SecureTask = (() => {
  const state = {
    token: localStorage.getItem("token") || "",
    user: JSON.parse(localStorage.getItem("user") || "null"),
    tasks: [],
    view: localStorage.getItem("taskView") || "kanban",
    sortKey: "created_at",
    sortDir: "desc",
    authMode: "login",
    healthSamples: [],
  };

  const statusLabels = { todo: "To Do", "in-progress": "In Progress", done: "Done" };
  const priorityLabels = { low: "Low", medium: "Medium", high: "High" };

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function init() {
    renderIcons();
    const page = document.body.dataset.page;
    bindSharedEvents();
    if (page === "login") initLoginPage();
    if (page === "dashboard") initDashboardPage();
    if (page === "health") initHealthPage();
  }

  function renderIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(path, { ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const message = typeof data === "string" ? data : data.message || data.error || "Request failed";
      throw new Error(message);
    }
    return data;
  }

  function bindSharedEvents() {
    const sidebar = $("sidebar");
    $("mobileMenuBtn")?.addEventListener("click", () => sidebar?.classList.toggle("open"));
    $("logoutBtn")?.addEventListener("click", logout);
    $("logoutMenuBtn")?.addEventListener("click", logout);
    $("avatarBtn")?.addEventListener("click", () => {
      const menu = $("avatarDropdown");
      if (!menu) return;
      menu.classList.toggle("hidden");
      $("avatarBtn").setAttribute("aria-expanded", String(!menu.classList.contains("hidden")));
    });
    document.addEventListener("click", (event) => {
      const menu = $("avatarDropdown");
      const avatar = $("avatarBtn");
      if (menu && avatar && !menu.contains(event.target) && !avatar.contains(event.target)) {
        menu.classList.add("hidden");
        avatar.setAttribute("aria-expanded", "false");
      }
    });
  }

  function initLoginPage() {
    if (state.token) {
      window.location.href = "/dashboard.html";
      return;
    }
    bindAuthTabs();
    $("authForm")?.addEventListener("submit", handleAuthSubmit);
    $("togglePassword")?.addEventListener("click", togglePasswordVisibility);
  }

  function bindAuthTabs() {
    $("loginTab")?.addEventListener("click", () => setAuthMode("login"));
    $("registerTab")?.addEventListener("click", () => setAuthMode("register"));
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    $("loginTab")?.classList.toggle("active", mode === "login");
    $("registerTab")?.classList.toggle("active", mode === "register");
    $("loginTab")?.setAttribute("aria-selected", String(mode === "login"));
    $("registerTab")?.setAttribute("aria-selected", String(mode === "register"));
    const title = $("authTitle");
    const buttonLabel = document.querySelector("#authSubmit .btn-label");
    if (title) title.textContent = mode === "login" ? "Sign in to your account" : "Create your account";
    if (buttonLabel) buttonLabel.textContent = mode === "login" ? "Sign In" : "Create Account";
    clearAuthErrors();
  }

  function togglePasswordVisibility() {
    const password = $("password");
    if (!password) return;
    password.type = password.type === "password" ? "text" : "password";
  }

  function clearAuthErrors() {
    ["emailError", "passwordError", "authMessage"].forEach((id) => { if ($(id)) $(id).textContent = ""; });
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    clearAuthErrors();
    const email = $("email")?.value.trim() || "";
    const password = $("password")?.value || "";
    let valid = true;
    if (!email || !email.includes("@")) {
      $("emailError").textContent = "Enter a valid email address.";
      valid = false;
    }
    if (password.length < 8) {
      $("passwordError").textContent = "Password must be at least 8 characters.";
      valid = false;
    }
    if (!valid) return;

    const button = $("authSubmit");
    button?.classList.add("is-loading");
    button?.setAttribute("disabled", "true");
    try {
      const data = await api(`/api/auth/${state.authMode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      state.token = data.token;
      state.user = data.user || { email };
      localStorage.setItem("token", state.token);
      localStorage.setItem("user", JSON.stringify(state.user));
      showToast("success", "Authentication successful", "Redirecting to your dashboard.");
      setTimeout(() => { window.location.href = "/dashboard.html"; }, 500);
    } catch (error) {
      // A presentation-friendly shortcut: if login fails because the demo user does
      // not exist yet, create it once and continue.
      if (state.authMode === "login" && email === "student@example.com") {
        try {
          const data = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
          state.token = data.token;
          state.user = data.user || { email };
          localStorage.setItem("token", state.token);
          localStorage.setItem("user", JSON.stringify(state.user));
          showToast("success", "Demo account created", "Redirecting to your dashboard.");
          setTimeout(() => { window.location.href = "/dashboard.html"; }, 500);
          return;
        } catch (_) {
          // Fall through and show the original error.
        }
      }
      $("authMessage").textContent = error.message;
      showToast("error", "Authentication failed", error.message);
    } finally {
      button?.classList.remove("is-loading");
      button?.removeAttribute("disabled");
    }
  }

  function initDashboardPage() {
    guardAuth();
    updateUserUI();
    bindDashboardEvents();
    setView(state.view);
    loadTasks();
  }

  function guardAuth() {
    if (!state.token) window.location.href = "/";
  }

  function updateUserUI() {
    const email = state.user?.email || "student@example.com";
    if ($("currentUserEmail")) $("currentUserEmail").textContent = email;
    const initials = email.split("@")[0].split(/[._-]/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ST";
    if ($("avatarBtn")) $("avatarBtn").textContent = initials;
  }

  function bindDashboardEvents() {
    ["newTaskTopBtn", "emptyCreateBtn"].forEach((id) => $(id)?.addEventListener("click", () => openTaskDrawer()));
    $("closeDrawerBtn")?.addEventListener("click", closeTaskDrawer);
    $("cancelTaskBtn")?.addEventListener("click", closeTaskDrawer);
    $("drawerBackdrop")?.addEventListener("click", closeTaskDrawer);
    $("taskForm")?.addEventListener("submit", saveTask);
    $("deleteTaskBtn")?.addEventListener("click", deleteTaskFromDrawer);
    $("taskTitle")?.addEventListener("input", updateTitleCounter);
    $("kanbanViewBtn")?.addEventListener("click", () => setView("kanban"));
    $("tableViewBtn")?.addEventListener("click", () => setView("table"));
    ["searchInput", "statusFilter", "priorityFilter", "dueFilter"].forEach((id) => {
      $(id)?.addEventListener("input", renderTasks);
      $(id)?.addEventListener("change", renderTasks);
    });
    $("clearFiltersBtn")?.addEventListener("click", clearFilters);
    $$(".sort-btn").forEach((button) => button.addEventListener("click", () => setSort(button.dataset.sort)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeTaskDrawer();
    });
    bindKanbanDropZones();
  }

  async function loadTasks() {
    showSkeleton(true);
    try {
      const data = await api("/api/tasks");
      state.tasks = (data.tasks || []).map(normalizeTask);
      renderTasks();
    } catch (error) {
      if (error.message.toLowerCase().includes("token") || error.message.toLowerCase().includes("unauthorized")) logout();
      showToast("error", "Could not load tasks", error.message);
    } finally {
      showSkeleton(false);
    }
  }

  function normalizeTask(task) {
    const status = task.status || (task.completed ? "done" : "todo");
    return {
      ...task,
      status: statusLabels[status] ? status : "todo",
      priority: priorityLabels[task.priority] ? task.priority : "medium",
      due_date: task.due_date || "",
      completed: status === "done" || Boolean(task.completed),
    };
  }

  function showSkeleton(show) {
    $("loadingSkeleton")?.classList.toggle("hidden", !show);
  }

  function renderTasks() {
    const tasks = getFilteredTasks();
    renderStats();
    renderEmptyState(tasks);
    renderKanban(tasks);
    renderTable(tasks);
    renderIcons();
  }

  function getFilteredTasks() {
    const query = ($("searchInput")?.value || "").trim().toLowerCase();
    const status = $("statusFilter")?.value || "all";
    const priority = $("priorityFilter")?.value || "all";
    const dueBefore = $("dueFilter")?.value || "";
    let tasks = state.tasks.filter((task) => {
      const text = `${task.title} ${task.description} ${task.status} ${task.priority}`.toLowerCase();
      const matchesSearch = !query || text.includes(query);
      const matchesStatus = status === "all" || task.status === status;
      const matchesPriority = priority === "all" || task.priority === priority;
      const matchesDue = !dueBefore || (task.due_date && task.due_date <= dueBefore);
      return matchesSearch && matchesStatus && matchesPriority && matchesDue;
    });
    tasks.sort((a, b) => {
      const aValue = String(a[state.sortKey] || "").toLowerCase();
      const bValue = String(b[state.sortKey] || "").toLowerCase();
      return state.sortDir === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
    return tasks;
  }

  function renderStats() {
    const today = new Date().toISOString().slice(0, 10);
    const total = state.tasks.length;
    const completed = state.tasks.filter((task) => task.status === "done").length;
    const inProgress = state.tasks.filter((task) => task.status === "in-progress").length;
    const overdue = state.tasks.filter((task) => task.due_date && task.due_date < today && task.status !== "done").length;
    setText("statTotal", total);
    setText("statCompleted", completed);
    setText("statProgress", inProgress);
    setText("statOverdue", overdue);
    setText("countTodo", state.tasks.filter((task) => task.status === "todo").length);
    setText("countProgress", inProgress);
    setText("countDone", completed);
  }

  function renderEmptyState(tasks) {
    const empty = tasks.length === 0;
    $("emptyState")?.classList.toggle("hidden", !empty);
    $("kanbanBoard")?.classList.toggle("hidden", empty || state.view !== "kanban");
    $("tableView")?.classList.toggle("hidden", empty || state.view !== "table");
  }

  function renderKanban(tasks) {
    const lists = { todo: $("todoList"), "in-progress": $("progressList"), done: $("doneList") };
    Object.values(lists).forEach((list) => { if (list) list.innerHTML = ""; });
    tasks.forEach((task) => lists[task.status]?.appendChild(createTaskCard(task)));
  }

  function createTaskCard(task) {
    const card = document.createElement("article");
    card.className = `task-card ${task.status === "done" ? "done" : ""}`;
    card.draggable = true;
    card.dataset.id = task.id;
    card.innerHTML = `
      <div class="card-meta">
        ${statusPill(task.status)}
        ${priorityPill(task.priority)}
      </div>
      <h3>${escapeHtml(task.title)}</h3>
      <p>${escapeHtml(task.description || "No description added.")}</p>
      <div class="card-meta">
        ${dueChip(task)}
      </div>
      <div class="task-actions">
        <button class="btn btn-ghost" data-action="toggle" type="button">${task.status === "done" ? "Mark Open" : "Mark Complete"}</button>
        <div class="table-actions">
          <button class="icon-btn" data-action="edit" type="button" aria-label="Edit ${escapeHtml(task.title)}"><i data-lucide="pencil"></i></button>
          <button class="icon-btn" data-action="delete" type="button" aria-label="Delete ${escapeHtml(task.title)}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`;
    card.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", String(task.id)));
    card.querySelector('[data-action="toggle"]').addEventListener("click", () => quickToggle(task));
    card.querySelector('[data-action="edit"]').addEventListener("click", () => openTaskDrawer(task));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteTask(task.id));
    return card;
  }

  function renderTable(tasks) {
    const tbody = $("taskTableBody");
    if (!tbody) return;
    tbody.innerHTML = tasks.map((task) => `
      <tr>
        <td><strong>${escapeHtml(task.title)}</strong><br><span class="text-slate-500">${escapeHtml(task.description || "No description")}</span></td>
        <td>${statusPill(task.status)}</td>
        <td>${priorityPill(task.priority)}</td>
        <td>${dueChip(task)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost" data-id="${task.id}" data-action="toggle" type="button">${task.status === "done" ? "Open" : "Complete"}</button>
            <button class="icon-btn" data-id="${task.id}" data-action="edit" type="button" aria-label="Edit task"><i data-lucide="pencil"></i></button>
            <button class="icon-btn" data-id="${task.id}" data-action="delete" type="button" aria-label="Delete task"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`).join("");
    $$('button[data-action]', tbody).forEach((button) => {
      const task = state.tasks.find((item) => String(item.id) === String(button.dataset.id));
      if (!task) return;
      if (button.dataset.action === "toggle") button.addEventListener("click", () => quickToggle(task));
      if (button.dataset.action === "edit") button.addEventListener("click", () => openTaskDrawer(task));
      if (button.dataset.action === "delete") button.addEventListener("click", () => deleteTask(task.id));
    });
  }

  function statusPill(status) {
    return `<span class="status-pill status-${status}">${statusLabels[status] || "To Do"}</span>`;
  }

  function priorityPill(priority) {
    return `<span class="priority-pill priority-${priority}">${priorityLabels[priority] || "Medium"}</span>`;
  }

  function dueChip(task) {
    const today = new Date().toISOString().slice(0, 10);
    const overdue = task.due_date && task.due_date < today && task.status !== "done";
    return `<span class="due-chip ${overdue ? "overdue" : ""}"><i data-lucide="calendar-days"></i>${task.due_date || "No due date"}</span>`;
  }

  function setView(view) {
    state.view = view;
    localStorage.setItem("taskView", view);
    $("kanbanViewBtn")?.classList.toggle("active", view === "kanban");
    $("tableViewBtn")?.classList.toggle("active", view === "table");
    renderTasks();
  }

  function setSort(key) {
    if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    else {
      state.sortKey = key;
      state.sortDir = "asc";
    }
    renderTasks();
  }

  function clearFilters() {
    if ($("searchInput")) $("searchInput").value = "";
    if ($("statusFilter")) $("statusFilter").value = "all";
    if ($("priorityFilter")) $("priorityFilter").value = "all";
    if ($("dueFilter")) $("dueFilter").value = "";
    renderTasks();
  }

  function bindKanbanDropZones() {
    $$(".kanban-column").forEach((column) => {
      column.addEventListener("dragover", (event) => {
        event.preventDefault();
        column.classList.add("drag-over");
      });
      column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
      column.addEventListener("drop", async (event) => {
        event.preventDefault();
        column.classList.remove("drag-over");
        const id = event.dataTransfer.getData("text/plain");
        const status = column.dataset.status;
        if (id && status) await updateTask(id, { status, completed: status === "done" }, "Task moved");
      });
    });
  }

  function openTaskDrawer(task = null) {
    const drawer = $("taskDrawer");
    const backdrop = $("drawerBackdrop");
    if (!drawer || !backdrop) return;
    clearTaskFormErrors();
    $("drawerTitle").textContent = task ? "Edit task" : "Create task";
    $("taskId").value = task?.id || "";
    $("taskTitle").value = task?.title || "";
    $("taskDescription").value = task?.description || "";
    $("taskStatus").value = task?.status || "todo";
    $("taskDueDate").value = task?.due_date || "";
    const priority = task?.priority || "medium";
    $$('input[name="priority"]').forEach((input) => { input.checked = input.value === priority; });
    $("deleteTaskBtn").classList.toggle("hidden", !task);
    updateTitleCounter();
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop.classList.remove("hidden");
    setTimeout(() => $("taskTitle")?.focus(), 120);
  }

  function closeTaskDrawer() {
    const drawer = $("taskDrawer");
    const backdrop = $("drawerBackdrop");
    drawer?.classList.remove("open");
    drawer?.setAttribute("aria-hidden", "true");
    backdrop?.classList.add("hidden");
  }

  function clearTaskFormErrors() {
    if ($("titleError")) $("titleError").textContent = "";
  }

  function updateTitleCounter() {
    if ($("titleCounter") && $("taskTitle")) $("titleCounter").textContent = `${$("taskTitle").value.length}/140`;
  }

  async function saveTask(event) {
    event.preventDefault();
    clearTaskFormErrors();
    const title = $("taskTitle").value.trim();
    if (!title) {
      $("titleError").textContent = "Task title is required.";
      return;
    }
    const id = $("taskId").value;
    const status = $("taskStatus").value;
    const payload = {
      title,
      description: $("taskDescription").value.trim(),
      status,
      completed: status === "done",
      priority: document.querySelector('input[name="priority"]:checked')?.value || "medium",
      due_date: $("taskDueDate").value,
    };
    try {
      if (id) await api(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
      closeTaskDrawer();
      await loadTasks();
      showToast("success", "Task saved", "Your changes were applied successfully.");
    } catch (error) {
      showToast("error", "Save failed", error.message);
    }
  }

  async function quickToggle(task) {
    const nextStatus = task.status === "done" ? "todo" : "done";
    await updateTask(task.id, { status: nextStatus, completed: nextStatus === "done" }, nextStatus === "done" ? "Task completed" : "Task reopened");
  }

  async function updateTask(id, payload, successMessage = "Task updated") {
    try {
      await api(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      await loadTasks();
      showToast("success", successMessage, "Dashboard updated.");
    } catch (error) {
      showToast("error", "Update failed", error.message);
    }
  }

  async function deleteTaskFromDrawer() {
    const id = $("taskId")?.value;
    if (id) await deleteTask(id, true);
  }

  async function deleteTask(id, fromDrawer = false) {
    if (!confirm("Delete this task? This action cannot be undone.")) return;
    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      if (fromDrawer) closeTaskDrawer();
      await loadTasks();
      showToast("success", "Task deleted", "The task was removed.");
    } catch (error) {
      showToast("error", "Delete failed", error.message);
    }
  }

  function initHealthPage() {
    bindSharedHealthEvents();
    refreshHealth();
    setInterval(refreshHealth, 30000);
  }

  function bindSharedHealthEvents() {
    $("refreshHealthBtn")?.addEventListener("click", refreshHealth);
  }

  async function refreshHealth() {
    const started = performance.now();
    setHealthChecking();
    try {
      const response = await fetch("/health", { cache: "no-store" });
      const data = await response.json();
      const responseTime = Math.round(performance.now() - started);
      if (!response.ok) throw new Error(data.message || "Health check failed");
      const apiTime = data.response_time_ms || responseTime;
      state.healthSamples.push(apiTime);
      state.healthSamples = state.healthSamples.slice(-8);
      renderHealth(data, apiTime, true);
    } catch (error) {
      const responseTime = Math.round(performance.now() - started);
      state.healthSamples.push(responseTime);
      state.healthSamples = state.healthSamples.slice(-8);
      renderHealth({ status: "unhealthy", database: "unreachable", api: "degraded", authentication: "unknown" }, responseTime, false, error.message);
    }
  }

  function setHealthChecking() {
    const overall = $("overallStatus");
    if (!overall) return;
    overall.className = "overall-status checking";
    overall.querySelector("strong").textContent = "Checking";
  }

  function renderHealth(data, responseTime, healthy, errorMessage = "") {
    const stateName = healthy && data.status === "healthy" ? "operational" : "degraded";
    const badge = $("healthStateBadge");
    const overall = $("overallStatus");
    badge.className = `status-pill ${stateName}`;
    badge.textContent = stateName === "operational" ? "Operational" : "Degraded";
    overall.className = `overall-status ${stateName}`;
    overall.querySelector("strong").textContent = stateName === "operational" ? "Operational" : "Degraded";
    setText("healthHeadline", stateName === "operational" ? "All systems operational" : "Service degraded");
    setText("healthSummary", stateName === "operational" ? "API, database, and authentication checks are ready for deployment validation." : errorMessage || "One or more components failed the health check.");
    setText("lastChecked", new Date().toLocaleString());
    setText("responseTime", `${Math.round(responseTime)} ms`);
    setText("deployVersion", data.version || "1.0.0-free-aws");
    setText("deployCommit", data.commit || "local-dev");
    setText("deployedAt", data.deployed_at || "local");
    setComponent("apiComponent", stateName, data.api || data.status || "unknown");
    setComponent("dbComponent", data.database === "connected" ? "operational" : "degraded", data.database || "unknown");
    setComponent("authComponent", stateName, data.authentication || "operational");
    renderResponseChart();
    renderIcons();
  }

  function setComponent(id, className, label) {
    const element = $(id);
    if (!element) return;
    element.classList.remove("operational", "degraded", "checking");
    element.classList.add(className);
    element.querySelector("strong").textContent = label === "connected" ? "Operational" : capitalize(String(label).replace("-", " "));
  }

  function renderResponseChart() {
    const chart = $("responseChart");
    if (!chart) return;
    const samples = state.healthSamples.length ? state.healthSamples : [30, 42, 28, 33, 45, 26];
    const max = Math.max(...samples, 100);
    chart.innerHTML = samples.map((value) => {
      const height = Math.max(12, Math.round((value / max) * 130));
      return `<div class="response-bar" style="height:${height}px"><span>${Math.round(value)}ms</span></div>`;
    }).join("");
  }

  function showToast(type, title, message) {
    const region = $("toastRegion");
    if (!region) return;
    const icon = type === "success" ? "circle-check" : type === "error" ? "circle-x" : "info";
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i data-lucide="${icon}"></i><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message || "")}</p></div>`;
    region.appendChild(toast);
    renderIcons();
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      setTimeout(() => toast.remove(), 220);
    }, 3000);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    state.token = "";
    state.user = null;
    window.location.href = "/";
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[char]));
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", SecureTask.init);
