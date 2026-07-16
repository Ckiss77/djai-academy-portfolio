const adminLoginView = document.getElementById("adminLoginView");
const adminAppView = document.getElementById("adminAppView");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminLoginStatus = document.getElementById("adminLoginStatus");
const adminStatus = document.getElementById("adminStatus");
const adminSummary = document.getElementById("adminSummary");
const adminLogoutButton = document.getElementById("adminLogoutButton");
const categoryForm = document.getElementById("categoryForm");
const courseForm = document.getElementById("courseForm");
const videoForm = document.getElementById("videoForm");
const documentForm = document.getElementById("documentForm");
const courseAdminList = document.getElementById("courseAdminList");
const userForm = document.getElementById("userForm");
const userAdminList = document.getElementById("userAdminList");
const courseAccessList = document.getElementById("courseAccessList");
const clearUserForm = document.getElementById("clearUserForm");

let adminClient;
let adminSession;
let courseData = { categories: [], courses: [], videos: [], documents: [] };
let userData = { users: [], courses: [] };

function toggleAdmin(isLoggedIn) {
  adminLoginView.classList.toggle("is-hidden", isLoggedIn);
  adminAppView.classList.toggle("is-hidden", !isLoggedIn);
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function normalizeDate(value) {
  return value ? new Date(value).toISOString() : null;
}

function boolValue(value) {
  return value === true || value === "true";
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...window.DJAI_PORTAL.authHeaders(adminSession),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "Admin request failed.");
  return payload;
}

async function courseAction(action, payload) {
  const result = await api("/.netlify/functions/admin-courses", {
    method: "POST",
    body: JSON.stringify({ action, payload }),
  });
  courseData = result.data;
  renderAdmin();
}

async function userAction(action, payload) {
  const result = await api("/.netlify/functions/admin-users", {
    method: "POST",
    body: JSON.stringify({ action, payload }),
  });
  userData = result.data;
  renderUsers();
}

async function loadAdminData() {
  window.DJAI_PORTAL.setStatus(adminStatus, "Loading admin data...");
  const [courses, users] = await Promise.all([
    api("/.netlify/functions/admin-courses"),
    api("/.netlify/functions/admin-users"),
  ]);
  courseData = courses;
  userData = users;
  window.DJAI_PORTAL.setStatus(adminStatus, "Ready", "ok");
  renderAdmin();
}

function fillSelects() {
  const categoryOptions = ['<option value="">No category</option>']
    .concat(courseData.categories.map((item) => `<option value="${item.id}">${item.name}</option>`))
    .join("");
  courseForm.elements.category_id.innerHTML = categoryOptions;

  const courseOptions = courseData.courses.map((item) => `<option value="${item.id}">${item.title}</option>`).join("");
  videoForm.elements.course_id.innerHTML = courseOptions;
  documentForm.elements.course_id.innerHTML = courseOptions;

  courseAccessList.innerHTML = courseData.courses
    .map((course) => `<label><input type="checkbox" value="${course.id}" /> ${course.title}</label>`)
    .join("");
}

function renderCourses() {
  courseAdminList.innerHTML = "";
  courseData.courses.forEach((course) => {
    const category = courseData.categories.find((item) => item.id === course.category_id);
    const videos = courseData.videos.filter((item) => item.course_id === course.id);
    const docs = courseData.documents.filter((item) => item.course_id === course.id);
    const item = document.createElement("article");
    item.className = "admin-item";
    item.innerHTML = `
      <strong>${course.title}</strong>
      <p>${category?.name || "No category"} | ${course.is_published ? "Published" : "Draft"} | ${videos.length} videos | ${docs.length} docs</p>
      <div class="admin-actions">
        <button class="btn btn-secondary" data-edit-course="${course.id}" type="button">Edit</button>
        <button class="btn btn-secondary" data-delete-course="${course.id}" type="button">Delete</button>
      </div>
    `;
    courseAdminList.appendChild(item);
  });

  if (!courseData.courses.length) {
    courseAdminList.innerHTML = '<div class="admin-item">No courses yet.</div>';
  }
}

function renderUsers() {
  userAdminList.innerHTML = "";
  userData.users.forEach((user) => {
    const profile = user.profile || {};
    const allowed = user.course_access
      .map((access) => userData.courses.find((course) => course.id === access.course_id)?.title)
      .filter(Boolean)
      .join(", ");
    const item = document.createElement("article");
    item.className = "admin-item";
    item.innerHTML = `
      <strong>${profile.full_name || user.email}</strong>
      <p>${user.email} | ${profile.role || "student"} | ${profile.is_active ? "Active" : "Inactive"}</p>
      <p>${allowed || "No course access"}</p>
      <div class="admin-actions">
        <button class="btn btn-secondary" data-edit-user="${user.id}" type="button">Edit</button>
        <button class="btn btn-secondary" data-toggle-user="${user.id}" type="button">${profile.is_active ? "Set inactive" : "Set active"}</button>
        <button class="btn btn-secondary" data-reset-user="${user.id}" type="button">Reset password</button>
      </div>
    `;
    userAdminList.appendChild(item);
  });

  if (!userData.users.length) {
    userAdminList.innerHTML = '<div class="admin-item">No users yet.</div>';
  }
}

function renderAdmin() {
  fillSelects();
  renderCourses();
  renderUsers();
}

function setForm(form, values) {
  Object.entries(values).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
}

function clearUser() {
  userForm.reset();
  userForm.elements.id.value = "";
  courseAccessList.querySelectorAll("input").forEach((input) => {
    input.checked = false;
  });
}

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  window.DJAI_PORTAL.setStatus(adminLoginStatus, "Signing in...");
  const form = formObject(adminLoginForm);
  const { data, error } = await adminClient.auth.signInWithPassword({
    email: form.email,
    password: form.password,
  });

  if (error) {
    window.DJAI_PORTAL.setStatus(adminLoginStatus, error.message, "error");
    return;
  }

  adminSession = data.session;
  adminSummary.textContent = adminSession.user.email;
  toggleAdmin(true);
  await loadAdminData();
});

adminLogoutButton.addEventListener("click", async () => {
  await adminClient.auth.signOut();
  toggleAdmin(false);
});

document.querySelectorAll("[data-admin-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-tab]").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(`${button.dataset.adminTab}Panel`).classList.add("active");
  });
});

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = formObject(categoryForm);
  await courseAction("upsertCategory", {
    id: values.id || undefined,
    name: values.name,
    slug: values.slug || slugify(values.name),
    description: values.description || "",
  });
  categoryForm.reset();
});

courseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = formObject(courseForm);
  await courseAction("upsertCourse", {
    id: values.id || undefined,
    category_id: values.category_id || null,
    title: values.title,
    slug: values.slug || slugify(values.title),
    description: values.description || "",
    thumbnail_url: values.thumbnail_url || "",
    is_published: boolValue(values.is_published),
    sort_order: Number(values.sort_order || 0),
  });
  courseForm.reset();
});

videoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = formObject(videoForm);
  await courseAction("upsertVideo", {
    id: values.id || undefined,
    course_id: values.course_id,
    title: values.title,
    youtube_url: values.youtube_url,
    description: values.description || "",
    sort_order: Number(values.sort_order || 0),
  });
  videoForm.reset();
});

documentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = formObject(documentForm);
  const file = documentForm.elements.file.files[0];
  if (!file) return;

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  await courseAction("uploadDocument", {
    course_id: values.course_id,
    title: values.title,
    sort_order: Number(values.sort_order || 0),
    file_name: file.name,
    content_type: file.type || "application/octet-stream",
    base64,
  });
  documentForm.reset();
});

courseAdminList.addEventListener("click", async (event) => {
  const editId = event.target.dataset.editCourse;
  const deleteId = event.target.dataset.deleteCourse;
  if (editId) {
    const course = courseData.courses.find((item) => item.id === editId);
    setForm(courseForm, course);
  }
  if (deleteId && window.confirm("Delete this course?")) {
    await courseAction("deleteCourse", { id: deleteId });
  }
});

userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = formObject(userForm);
  const courseIds = [...courseAccessList.querySelectorAll("input:checked")].map((input) => input.value);
  const payload = {
    id: values.id || undefined,
    email: values.email,
    full_name: values.full_name || "",
    password: values.password,
    role: values.role || "student",
    is_active: boolValue(values.is_active),
    access_start: normalizeDate(values.access_start),
    access_end: normalizeDate(values.access_end),
    course_ids: courseIds,
  };

  if (!payload.id && !payload.password) {
    window.alert("Password is required for new users.");
    return;
  }

  await userAction(payload.id ? "updateUser" : "createUser", payload);
  clearUser();
});

clearUserForm.addEventListener("click", clearUser);

userAdminList.addEventListener("click", async (event) => {
  const editId = event.target.dataset.editUser;
  const toggleId = event.target.dataset.toggleUser;
  const resetId = event.target.dataset.resetUser;

  if (editId) {
    const user = userData.users.find((item) => item.id === editId);
    const profile = user.profile || {};
    setForm(userForm, {
      id: user.id,
      email: user.email,
      full_name: profile.full_name,
      role: profile.role || "student",
      is_active: String(profile.is_active !== false),
      access_start: profile.access_start ? profile.access_start.slice(0, 16) : "",
      access_end: profile.access_end ? profile.access_end.slice(0, 16) : "",
      password: "",
    });
    const allowed = new Set(user.course_access.map((item) => item.course_id));
    courseAccessList.querySelectorAll("input").forEach((input) => {
      input.checked = allowed.has(input.value);
    });
  }

  if (toggleId) {
    const user = userData.users.find((item) => item.id === toggleId);
    await userAction("setActive", { id: toggleId, is_active: !(user.profile?.is_active !== false) });
  }

  if (resetId) {
    const password = window.prompt("New password");
    if (password) await userAction("resetPassword", { id: resetId, password });
  }
});

(async function initAdminPortal() {
  try {
    adminClient = await window.DJAI_PORTAL.createPortalClient();
    adminSession = await window.DJAI_PORTAL.currentSession(adminClient);

    if (adminSession) {
      adminSummary.textContent = adminSession.user.email;
      toggleAdmin(true);
      await loadAdminData();
    } else {
      toggleAdmin(false);
    }
  } catch (error) {
    window.DJAI_PORTAL.setStatus(adminLoginStatus, error.message, "error");
  }
})();
