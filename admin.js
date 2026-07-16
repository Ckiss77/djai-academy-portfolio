const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ui = {
  loginView: $("#adminLoginView"), appView: $("#adminAppView"), loginForm: $("#adminLoginForm"),
  loginStatus: $("#adminLoginStatus"), status: $("#adminStatus"), summary: $("#adminSummary"),
  avatar: $("#adminAvatar"), logout: $("#adminLogoutButton"), toast: $("#portalToast"),
  categoryForm: $("#categoryForm"), courseForm: $("#courseForm"), videoForm: $("#videoForm"),
  documentForm: $("#documentForm"), userForm: $("#userForm"), clearUserForm: $("#clearUserForm"),
  courseList: $("#courseAdminList"), categoryList: $("#categoryAdminList"), contentList: $("#contentAdminList"),
  userList: $("#userAdminList"), accessList: $("#courseAccessList"), recentCourses: $("#recentCourseList"),
  courseSearch: $("#adminCourseSearch"), userSearch: $("#adminUserSearch"), contentFilter: $("#contentCourseFilter"),
};

let adminClient;
let adminSession;
let courseData = { categories: [], courses: [], videos: [], documents: [] };
let userData = { users: [], courses: [] };

function refreshIcons() { window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } }); }
function escapeHtml(value) { const node = document.createElement("div"); node.textContent = String(value ?? ""); return node.innerHTML; }
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
function boolValue(value) { return value === true || value === "true"; }
function normalizeDate(value) { return value ? new Date(value).toISOString() : null; }
function slugify(value) { return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function formatDate(value) { return value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(value)) : "ไม่จำกัด"; }

function showToast(message, type = "ok") {
  ui.toast.textContent = message;
  ui.toast.className = `portal-toast show ${type}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => ui.toast.classList.remove("show"), 3200);
}

function setBusy(button, busy, label = "กำลังบันทึก") {
  if (!button) return;
  if (busy) button.dataset.label = button.innerHTML;
  button.disabled = busy;
  button.innerHTML = busy ? `<span class="button-spinner"></span>${label}` : button.dataset.label;
  refreshIcons();
}

function toggleAdmin(isLoggedIn) {
  ui.loginView.classList.toggle("is-hidden", isLoggedIn);
  ui.appView.classList.toggle("is-hidden", !isLoggedIn);
  ui.logout.classList.toggle("is-hidden", !isLoggedIn);
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...window.DJAI_PORTAL.authHeaders(adminSession), ...(options.headers || {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "ไม่สามารถดำเนินการได้");
  return payload;
}

async function courseAction(action, payload, successMessage) {
  const result = await api("/.netlify/functions/admin-courses", { method: "POST", body: JSON.stringify({ action, payload }) });
  courseData = result.data;
  renderAdmin();
  showToast(successMessage);
}

async function userAction(action, payload, successMessage) {
  const result = await api("/.netlify/functions/admin-users", { method: "POST", body: JSON.stringify({ action, payload }) });
  userData = result.data;
  renderUsers();
  renderMetrics();
  showToast(successMessage);
}

async function loadAdminData() {
  window.DJAI_PORTAL.setStatus(ui.status, "กำลังโหลดข้อมูล...");
  const [courses, users] = await Promise.all([api("/.netlify/functions/admin-courses"), api("/.netlify/functions/admin-users")]);
  courseData = courses;
  userData = users;
  renderAdmin();
  window.DJAI_PORTAL.setStatus(ui.status, "ข้อมูลเป็นปัจจุบัน", "ok");
  setTimeout(() => window.DJAI_PORTAL.setStatus(ui.status, ""), 2200);
}

function renderMetrics() {
  $("#metricCourses").textContent = courseData.courses.length;
  $("#metricVideos").textContent = courseData.videos.length;
  $("#metricDocuments").textContent = courseData.documents.length;
  $("#metricUsers").textContent = userData.users.length;
  ui.recentCourses.innerHTML = courseData.courses.slice(0, 4).map((course) => `
    <div class="compact-row"><span class="status-dot ${course.is_published ? "published" : "draft"}"></span><div><strong>${escapeHtml(course.title)}</strong><small>${course.is_published ? "เผยแพร่แล้ว" : "ฉบับร่าง"}</small></div><span>${courseData.videos.filter((v) => v.course_id === course.id).length} วิดีโอ</span></div>`).join("") || `<div class="list-empty">ยังไม่มีคอร์สในระบบ</div>`;
}

function fillSelects() {
  const categories = '<option value="">ไม่ระบุหมวดหมู่</option>' + courseData.categories.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  ui.courseForm.elements.category_id.innerHTML = categories;
  const courses = courseData.courses.map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join("");
  ui.videoForm.elements.course_id.innerHTML = courses;
  ui.documentForm.elements.course_id.innerHTML = courses;
  const previousFilter = ui.contentFilter.value;
  ui.contentFilter.innerHTML = '<option value="">ทุกคอร์ส</option>' + courses;
  if ([...ui.contentFilter.options].some((option) => option.value === previousFilter)) ui.contentFilter.value = previousFilter;
  ui.accessList.innerHTML = courseData.courses.map((course) => `<label><input type="checkbox" value="${course.id}" /><span><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(courseData.categories.find((category) => category.id === course.category_id)?.name || "ไม่ระบุหมวดหมู่")}</small></span></label>`).join("") || `<div class="list-empty">สร้างคอร์สก่อนกำหนดสิทธิ์</div>`;
}

function renderCategories() {
  ui.categoryList.innerHTML = courseData.categories.map((category) => `<span class="category-chip"><i data-lucide="folder"></i>${escapeHtml(category.name)}<button data-delete-category="${category.id}" type="button" title="ลบหมวดหมู่"><i data-lucide="x"></i></button></span>`).join("") || `<p class="list-empty">ยังไม่มีหมวดหมู่</p>`;
}

function renderCourses() {
  const query = ui.courseSearch.value.trim().toLowerCase();
  const courses = courseData.courses.filter((course) => `${course.title} ${course.description || ""}`.toLowerCase().includes(query));
  $("#courseListSummary").textContent = `${courseData.courses.length} คอร์ส · ${courseData.courses.filter((course) => course.is_published).length} เผยแพร่`;
  ui.courseList.innerHTML = courses.map((course) => {
    const category = courseData.categories.find((item) => item.id === course.category_id);
    const videos = courseData.videos.filter((item) => item.course_id === course.id).length;
    const docs = courseData.documents.filter((item) => item.course_id === course.id).length;
    return `<article class="admin-list-item"><span class="list-item-icon"><i data-lucide="book-open"></i></span><div class="list-item-main"><div><strong>${escapeHtml(course.title)}</strong><span class="status-pill ${course.is_published ? "published" : "draft"}">${course.is_published ? "เผยแพร่" : "ฉบับร่าง"}</span></div><p>${escapeHtml(category?.name || "ไม่ระบุหมวดหมู่")} · ${videos} วิดีโอ · ${docs} เอกสาร</p></div><div class="row-actions"><button data-edit-course="${course.id}" type="button" title="แก้ไข"><i data-lucide="pencil"></i></button><button class="danger" data-delete-course="${course.id}" type="button" title="ลบ"><i data-lucide="trash-2"></i></button></div></article>`;
  }).join("") || `<div class="list-empty"><i data-lucide="book-dashed"></i><strong>${query ? "ไม่พบคอร์สที่ค้นหา" : "ยังไม่มีคอร์ส"}</strong><p>${query ? "ลองใช้คำค้นหาอื่น" : "กดปุ่มสร้างคอร์สเพื่อเริ่มต้น"}</p></div>`;
}

function renderContent() {
  const selectedCourse = ui.contentFilter.value;
  const courses = courseData.courses.filter((course) => !selectedCourse || course.id === selectedCourse);
  ui.contentList.innerHTML = courses.map((course) => {
    const videos = courseData.videos.filter((item) => item.course_id === course.id);
    const docs = courseData.documents.filter((item) => item.course_id === course.id);
    return `<section class="content-group"><div class="content-group-title"><div><strong>${escapeHtml(course.title)}</strong><small>${videos.length} วิดีโอ · ${docs.length} เอกสาร</small></div></div><div class="content-rows">
      ${videos.map((video, index) => `<div class="content-row"><span class="content-type video"><i data-lucide="play"></i></span><div><strong>${index + 1}. ${escapeHtml(video.title)}</strong><small>วิดีโอ YouTube</small></div><div class="row-actions"><button data-edit-video="${video.id}" type="button" title="แก้ไข"><i data-lucide="pencil"></i></button><button class="danger" data-delete-video="${video.id}" type="button" title="ลบ"><i data-lucide="trash-2"></i></button></div></div>`).join("")}
      ${docs.map((doc) => `<div class="content-row"><span class="content-type document"><i data-lucide="file-text"></i></span><div><strong>${escapeHtml(doc.title)}</strong><small>${escapeHtml(doc.file_name || "เอกสาร")}</small></div><div class="row-actions"><button class="danger" data-delete-document="${doc.id}" type="button" title="ลบ"><i data-lucide="trash-2"></i></button></div></div>`).join("")}
      ${!videos.length && !docs.length ? '<div class="list-empty compact">ยังไม่มีเนื้อหาในคอร์สนี้</div>' : ""}
    </div></section>`;
  }).join("") || `<div class="list-empty"><i data-lucide="list-video"></i><strong>ยังไม่มีเนื้อหา</strong><p>สร้างคอร์สก่อนเพิ่มวิดีโอและเอกสาร</p></div>`;
}

function renderUsers() {
  const query = ui.userSearch.value.trim().toLowerCase();
  const users = userData.users.filter((user) => `${user.email} ${user.profile?.full_name || ""}`.toLowerCase().includes(query));
  $("#userListSummary").textContent = `${userData.users.length} บัญชี · ${userData.users.filter((user) => user.profile?.is_active !== false).length} ใช้งาน`;
  ui.userList.innerHTML = users.map((user) => {
    const profile = user.profile || {};
    const allowed = user.course_access.length;
    return `<article class="admin-list-item user-item"><span class="user-avatar">${escapeHtml((profile.full_name || user.email || "U").charAt(0).toUpperCase())}</span><div class="list-item-main"><div><strong>${escapeHtml(profile.full_name || user.email)}</strong><span class="status-pill ${profile.is_active !== false ? "published" : "inactive"}">${profile.is_active !== false ? "ใช้งาน" : "ระงับ"}</span></div><p>${escapeHtml(user.email)} · ${profile.role || "student"}</p><small>${allowed} คอร์ส · สิ้นสุด ${formatDate(profile.access_end)}</small></div><div class="row-actions"><button data-edit-user="${user.id}" type="button" title="แก้ไข"><i data-lucide="pencil"></i></button><button data-toggle-user="${user.id}" type="button" title="${profile.is_active !== false ? "ระงับ" : "เปิดใช้งาน"}"><i data-lucide="${profile.is_active !== false ? "user-x" : "user-check"}"></i></button><button data-reset-user="${user.id}" type="button" title="เปลี่ยนรหัสผ่าน"><i data-lucide="key-round"></i></button></div></article>`;
  }).join("") || `<div class="list-empty"><i data-lucide="users"></i><strong>${query ? "ไม่พบผู้ใช้" : "ยังไม่มีผู้ใช้"}</strong></div>`;
  refreshIcons();
}

function renderAdmin() {
  fillSelects(); renderMetrics(); renderCategories(); renderCourses(); renderContent(); renderUsers(); refreshIcons();
}

function setForm(form, values) { Object.entries(values).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value ?? ""; }); }
function clearForm(form) { form.reset(); if (form.elements.id) form.elements.id.value = ""; }
function clearUser() { clearForm(ui.userForm); ui.accessList.querySelectorAll("input").forEach((input) => { input.checked = false; }); }

const pageMeta = {
  overview: ["ภาพรวมระบบ", "ตรวจสอบคอร์ส เนื้อหา และผู้ใช้งานทั้งหมด"],
  courses: ["จัดการคอร์ส", "สร้างและจัดระเบียบหลักสูตรของ DJAI Academy"],
  content: ["จัดการเนื้อหา", "เพิ่มวิดีโอและเอกสารประกอบในแต่ละคอร์ส"],
  users: ["จัดการผู้เรียน", "ควบคุมบัญชี สิทธิ์ และช่วงเวลาการเข้าใช้"],
};

function switchTab(name) {
  $$("[data-admin-tab]").forEach((button) => button.classList.toggle("active", button.dataset.adminTab === name));
  $$(".admin-panel").forEach((panel) => panel.classList.remove("active"));
  $(`#${name}Panel`)?.classList.add("active");
  $("#adminPageTitle").textContent = pageMeta[name][0];
  $("#adminPageDescription").textContent = pageMeta[name][1];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$('[data-admin-tab]').forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.adminTab)));
$$('[data-go-tab]').forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.goTab)));
$$('[data-open-form]').forEach((button) => button.addEventListener("click", () => { const details = $(`#${button.dataset.openForm}`); if (details) { details.open = true; details.scrollIntoView({ behavior: "smooth", block: "start" }); } }));
$$('[data-clear-form]').forEach((button) => button.addEventListener("click", () => clearForm($(`#${button.dataset.clearForm}`))));
ui.courseSearch.addEventListener("input", renderCourses);
ui.userSearch.addEventListener("input", renderUsers);
ui.contentFilter.addEventListener("change", renderContent);
ui.documentForm.elements.file.addEventListener("change", () => { $("#selectedFileName").textContent = ui.documentForm.elements.file.files[0]?.name || "ยังไม่ได้เลือกไฟล์"; });

ui.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const button = ui.loginForm.querySelector("[type=submit]"); setBusy(button, true, "กำลังเข้าสู่ระบบ"); window.DJAI_PORTAL.setStatus(ui.loginStatus, "");
  const values = formObject(ui.loginForm);
  try {
    const { data, error } = await adminClient.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
    if (error) throw error;
    adminSession = data.session; ui.summary.textContent = adminSession.user.email; ui.avatar.textContent = adminSession.user.email.charAt(0).toUpperCase(); toggleAdmin(true); await loadAdminData();
  } catch (error) { window.DJAI_PORTAL.setStatus(ui.loginStatus, error.message || "เข้าสู่ระบบไม่สำเร็จ", "error"); }
  finally { setBusy(button, false); }
});

ui.logout.addEventListener("click", async () => { await adminClient.auth.signOut(); adminSession = null; toggleAdmin(false); });

ui.categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; setBusy(button, true);
  try { const v = formObject(ui.categoryForm); await courseAction("upsertCategory", { id: v.id || undefined, name: v.name, slug: v.slug || slugify(v.name), description: v.description || "" }, "บันทึกหมวดหมู่แล้ว"); clearForm(ui.categoryForm); }
  catch (error) { showToast(error.message, "error"); } finally { setBusy(button, false); }
});

ui.courseForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; setBusy(button, true);
  try { const v = formObject(ui.courseForm); await courseAction("upsertCourse", { id: v.id || undefined, category_id: v.category_id || null, title: v.title, slug: v.slug || slugify(v.title), description: v.description || "", thumbnail_url: v.thumbnail_url || "", is_published: boolValue(v.is_published), sort_order: Number(v.sort_order || 0) }, "บันทึกคอร์สแล้ว"); clearForm(ui.courseForm); }
  catch (error) { showToast(error.message, "error"); } finally { setBusy(button, false); }
});

ui.videoForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; setBusy(button, true);
  try { const v = formObject(ui.videoForm); await courseAction("upsertVideo", { id: v.id || undefined, course_id: v.course_id, title: v.title, youtube_url: v.youtube_url, description: v.description || "", sort_order: Number(v.sort_order || 0) }, "บันทึกวิดีโอแล้ว"); clearForm(ui.videoForm); }
  catch (error) { showToast(error.message, "error"); } finally { setBusy(button, false); }
});

ui.documentForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; const v = formObject(ui.documentForm); const file = ui.documentForm.elements.file.files[0]; if (!file) return;
  setBusy(button, true, "กำลังอัปโหลด");
  try {
    const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    await courseAction("uploadDocument", { course_id: v.course_id, title: v.title, sort_order: Number(v.sort_order || 0), file_name: file.name, content_type: file.type || "application/octet-stream", base64 }, "อัปโหลดเอกสารแล้ว");
    clearForm(ui.documentForm); $("#selectedFileName").textContent = "ยังไม่ได้เลือกไฟล์";
  } catch (error) { showToast(error.message, "error"); } finally { setBusy(button, false); }
});

ui.courseList.addEventListener("click", async (event) => {
  const editId = event.target.closest("[data-edit-course]")?.dataset.editCourse;
  const deleteId = event.target.closest("[data-delete-course]")?.dataset.deleteCourse;
  if (editId) { const course = courseData.courses.find((item) => item.id === editId); setForm(ui.courseForm, { ...course, is_published: String(course.is_published) }); $("#courseFormCard").open = true; $("#courseFormCard").scrollIntoView({ behavior: "smooth" }); }
  if (deleteId && confirm("ลบคอร์สนี้และเนื้อหาที่เกี่ยวข้องใช่หรือไม่?")) { try { await courseAction("deleteCourse", { id: deleteId }, "ลบคอร์สแล้ว"); } catch (error) { showToast(error.message, "error"); } }
});

ui.categoryList.addEventListener("click", async (event) => { const id = event.target.closest("[data-delete-category]")?.dataset.deleteCategory; if (id && confirm("ลบหมวดหมู่นี้ใช่หรือไม่?")) { try { await courseAction("deleteCategory", { id }, "ลบหมวดหมู่แล้ว"); } catch (error) { showToast(error.message, "error"); } } });

ui.contentList.addEventListener("click", async (event) => {
  const editVideo = event.target.closest("[data-edit-video]")?.dataset.editVideo;
  const deleteVideo = event.target.closest("[data-delete-video]")?.dataset.deleteVideo;
  const deleteDocument = event.target.closest("[data-delete-document]")?.dataset.deleteDocument;
  if (editVideo) { const video = courseData.videos.find((item) => item.id === editVideo); setForm(ui.videoForm, video); ui.videoForm.scrollIntoView({ behavior: "smooth" }); }
  try {
    if (deleteVideo && confirm("ลบวิดีโอนี้ใช่หรือไม่?")) await courseAction("deleteVideo", { id: deleteVideo }, "ลบวิดีโอแล้ว");
    if (deleteDocument && confirm("ลบเอกสารนี้ใช่หรือไม่?")) await courseAction("deleteDocument", { id: deleteDocument }, "ลบเอกสารแล้ว");
  } catch (error) { showToast(error.message, "error"); }
});

ui.userForm.addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; const v = formObject(ui.userForm); const courseIds = [...ui.accessList.querySelectorAll("input:checked")].map((input) => input.value);
  const payload = { id: v.id || undefined, email: v.email, full_name: v.full_name || "", password: v.password, role: v.role || "student", is_active: boolValue(v.is_active), access_start: normalizeDate(v.access_start), access_end: normalizeDate(v.access_end), course_ids: courseIds };
  if (!payload.id && !payload.password) { showToast("กรุณากำหนดรหัสผ่านสำหรับผู้ใช้ใหม่", "error"); return; }
  setBusy(button, true);
  try { await userAction(payload.id ? "updateUser" : "createUser", payload, payload.id ? "อัปเดตผู้ใช้แล้ว" : "สร้างผู้ใช้แล้ว"); clearUser(); }
  catch (error) { showToast(error.message, "error"); } finally { setBusy(button, false); }
});

ui.clearUserForm.addEventListener("click", clearUser);
ui.userList.addEventListener("click", async (event) => {
  const editId = event.target.closest("[data-edit-user]")?.dataset.editUser;
  const toggleId = event.target.closest("[data-toggle-user]")?.dataset.toggleUser;
  const resetId = event.target.closest("[data-reset-user]")?.dataset.resetUser;
  if (editId) {
    const user = userData.users.find((item) => item.id === editId); const profile = user.profile || {};
    setForm(ui.userForm, { id: user.id, email: user.email, full_name: profile.full_name, role: profile.role || "student", is_active: String(profile.is_active !== false), access_start: profile.access_start ? profile.access_start.slice(0, 16) : "", access_end: profile.access_end ? profile.access_end.slice(0, 16) : "", password: "" });
    const allowed = new Set(user.course_access.map((item) => item.course_id)); ui.accessList.querySelectorAll("input").forEach((input) => { input.checked = allowed.has(input.value); }); $("#userFormCard").open = true; $("#userFormCard").scrollIntoView({ behavior: "smooth" });
  }
  try {
    if (toggleId) { const user = userData.users.find((item) => item.id === toggleId); await userAction("setActive", { id: toggleId, is_active: !(user.profile?.is_active !== false) }, "อัปเดตสถานะแล้ว"); }
    if (resetId) { const password = prompt("กำหนดรหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"); if (password) await userAction("resetPassword", { id: resetId, password }, "เปลี่ยนรหัสผ่านแล้ว"); }
  } catch (error) { showToast(error.message, "error"); }
});

(async function initAdminPortal() {
  refreshIcons();
  try {
    adminClient = await window.DJAI_PORTAL.createPortalClient(); adminSession = await window.DJAI_PORTAL.currentSession(adminClient); toggleAdmin(Boolean(adminSession));
    if (adminSession) { ui.summary.textContent = adminSession.user.email; ui.avatar.textContent = adminSession.user.email.charAt(0).toUpperCase(); await loadAdminData(); }
  } catch (error) { toggleAdmin(false); window.DJAI_PORTAL.setStatus(ui.loginStatus, error.message || "ระบบยังไม่พร้อมใช้งาน", "error"); }
})();
