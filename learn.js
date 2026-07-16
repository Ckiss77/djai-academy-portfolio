const $ = (selector) => document.querySelector(selector);

const ui = {
  loginView: $("#loginView"), appView: $("#appView"), loginForm: $("#loginForm"),
  loginStatus: $("#loginStatus"), logoutButton: $("#logoutButton"), studentSummary: $("#studentSummary"),
  courseGrid: $("#courseGrid"), libraryView: $("#libraryView"), lessonLayout: $("#lessonLayout"),
  lessonList: $("#lessonList"), documentList: $("#documentList"), videoFrame: $("#videoFrame"),
  courseSearch: $("#courseSearch"), categoryFilter: $("#categoryFilter"), backToLibrary: $("#backToLibrary"),
  activeCourseCategory: $("#activeCourseCategory"), activeCourseTitle: $("#activeCourseTitle"),
  activeCourseDescription: $("#activeCourseDescription"), activeCourseMeta: $("#activeCourseMeta"),
  activeLessonNumber: $("#activeLessonNumber"), activeLessonTitle: $("#activeLessonTitle"),
  activeLessonDescription: $("#activeLessonDescription"), portalToast: $("#portalToast"),
  courseCount: $("#courseCount"), lessonCount: $("#lessonCount"), documentCount: $("#documentCount"),
};

let portalClient;
let portalSession;
let activeCourseId = null;
let portalData = { categories: [], courses: [], videos: [], documents: [] };

function refreshIcons() {
  window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
}

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = String(value ?? "");
  return node.innerHTML;
}

function showToast(message, type = "") {
  ui.portalToast.textContent = message;
  ui.portalToast.className = `portal-toast show ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => ui.portalToast.classList.remove("show"), 3200);
}

function setBusy(button, busy, busyLabel) {
  if (!button) return;
  if (busy) button.dataset.label = button.innerHTML;
  button.disabled = busy;
  button.innerHTML = busy ? `<span class="button-spinner"></span>${busyLabel}` : button.dataset.label;
  refreshIcons();
}

function showApp(isLoggedIn) {
  ui.loginView.classList.toggle("is-hidden", isLoggedIn);
  ui.appView.classList.toggle("is-hidden", !isLoggedIn);
  ui.logoutButton.classList.toggle("is-hidden", !isLoggedIn);
}

function categoryName(categoryId) {
  return portalData.categories.find((item) => item.id === categoryId)?.name || "DJAI Course";
}

function categoryOptions() {
  ui.categoryFilter.innerHTML = '<option value="">ทุกหมวดหมู่</option>' + portalData.categories
    .filter((category) => portalData.courses.some((course) => course.category_id === category.id))
    .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
    .join("");
}

function updateSummary() {
  ui.courseCount.textContent = portalData.courses.length;
  ui.lessonCount.textContent = portalData.videos.length;
  ui.documentCount.textContent = portalData.documents.length;
}

function courseThumbnail(course) {
  if (course.thumbnail_url) {
    return `<img src="${escapeHtml(course.thumbnail_url)}" alt="" loading="lazy" />`;
  }
  return `<div class="course-art"><span>DJ<span>AI</span></span><i data-lucide="sparkles"></i></div>`;
}

function renderCourses() {
  const query = ui.courseSearch.value.trim().toLowerCase();
  const categoryId = ui.categoryFilter.value;
  const courses = portalData.courses.filter((course) => {
    const matchesText = `${course.title} ${course.description || ""}`.toLowerCase().includes(query);
    return matchesText && (!categoryId || course.category_id === categoryId);
  });

  if (!portalData.courses.length) {
    ui.courseGrid.innerHTML = `
      <div class="portal-empty">
        <span class="empty-icon"><i data-lucide="book-open-check"></i></span>
        <h3>ยังไม่มีคอร์สในบัญชีนี้</h3>
        <p>เมื่อผู้ดูแลเพิ่มสิทธิ์ คอร์สของคุณจะแสดงที่หน้านี้โดยอัตโนมัติ</p>
        <a class="btn btn-secondary" href="mailto:admin@djaiacademy.com"><i data-lucide="mail"></i> ติดต่อผู้ดูแล</a>
      </div>`;
    refreshIcons();
    return;
  }

  if (!courses.length) {
    ui.courseGrid.innerHTML = `<div class="portal-empty compact"><i data-lucide="search-x"></i><h3>ไม่พบคอร์สที่ค้นหา</h3><p>ลองเปลี่ยนคำค้นหาหรือหมวดหมู่</p></div>`;
    refreshIcons();
    return;
  }

  ui.courseGrid.innerHTML = courses.map((course) => {
    const videos = portalData.videos.filter((item) => item.course_id === course.id);
    const documents = portalData.documents.filter((item) => item.course_id === course.id);
    return `
      <article class="course-card" data-course-id="${course.id}">
        <button class="course-cover" type="button" aria-label="เปิดคอร์ส ${escapeHtml(course.title)}">${courseThumbnail(course)}<span class="play-chip"><i data-lucide="play"></i></span></button>
        <div class="course-card-body">
          <span class="course-category">${escapeHtml(categoryName(course.category_id))}</span>
          <h3>${escapeHtml(course.title)}</h3>
          <p>${escapeHtml(course.description || "พร้อมเริ่มเรียนกับ DJAI Academy")}</p>
          <div class="course-card-footer">
            <span><i data-lucide="list-video"></i>${videos.length} บทเรียน</span>
            <span><i data-lucide="files"></i>${documents.length} เอกสาร</span>
          </div>
        </div>
      </article>`;
  }).join("");
  refreshIcons();
}

function showLibrary() {
  activeCourseId = null;
  ui.libraryView.classList.remove("is-hidden");
  ui.lessonLayout.classList.add("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectSidebarTab(name) {
  document.querySelectorAll("[data-lesson-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.lessonTab === name));
  document.querySelectorAll(".sidebar-panel").forEach((panel) => panel.classList.remove("active"));
  $(`#${name}SidebarPanel`)?.classList.add("active");
}

function renderCourse(courseId) {
  const course = portalData.courses.find((item) => item.id === courseId);
  if (!course) return;
  activeCourseId = courseId;
  ui.libraryView.classList.add("is-hidden");
  ui.lessonLayout.classList.remove("is-hidden");
  ui.activeCourseCategory.textContent = categoryName(course.category_id);
  ui.activeCourseTitle.textContent = course.title;
  ui.activeCourseDescription.textContent = course.description || "";

  const videos = portalData.videos.filter((video) => video.course_id === course.id);
  const documents = portalData.documents.filter((documentItem) => documentItem.course_id === course.id);
  ui.activeCourseMeta.textContent = `${videos.length} บทเรียน · ${documents.length} เอกสาร`;

  ui.lessonList.innerHTML = videos.length ? videos.map((video, index) => `
    <button class="lesson-button${index === 0 ? " active" : ""}" data-video-id="${video.id}" type="button">
      <span class="lesson-number">${String(index + 1).padStart(2, "0")}</span>
      <span><strong>${escapeHtml(video.title)}</strong><small>${escapeHtml(video.description || "วิดีโอบทเรียน")}</small></span>
      <i data-lucide="play"></i>
    </button>`).join("") : `<div class="sidebar-empty"><i data-lucide="video-off"></i><p>ยังไม่มีวิดีโอในคอร์สนี้</p></div>`;

  ui.documentList.innerHTML = documents.length ? documents.map((documentItem) => `
    <button class="document-button" data-document-id="${documentItem.id}" type="button">
      <span class="document-icon"><i data-lucide="file-text"></i></span>
      <span><strong>${escapeHtml(documentItem.title)}</strong><small>${escapeHtml(documentItem.file_name || "เอกสารประกอบ")}</small></span>
      <i data-lucide="download"></i>
    </button>`).join("") : `<div class="sidebar-empty"><i data-lucide="file-x"></i><p>ยังไม่มีเอกสารประกอบ</p></div>`;

  if (videos.length) renderVideo(videos[0], 0);
  else {
    ui.videoFrame.innerHTML = `<div class="video-placeholder"><i data-lucide="video-off"></i><span>ยังไม่มีวิดีโอในคอร์สนี้</span></div>`;
    ui.activeLessonNumber.textContent = "บทเรียน";
    ui.activeLessonTitle.textContent = "ยังไม่มีเนื้อหา";
    ui.activeLessonDescription.textContent = "";
  }
  selectSidebarTab("lessons");
  refreshIcons();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderVideo(video, index) {
  document.querySelectorAll(".lesson-button").forEach((button) => button.classList.toggle("active", button.dataset.videoId === video.id));
  const embedUrl = window.DJAI_PORTAL.youtubeEmbedUrl(video.youtube_url);
  ui.videoFrame.innerHTML = `<iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(video.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  ui.activeLessonNumber.textContent = `บทเรียนที่ ${index + 1}`;
  ui.activeLessonTitle.textContent = video.title;
  ui.activeLessonDescription.textContent = video.description || "";
}

async function loadStudentData() {
  ui.courseGrid.innerHTML = `<div class="course-skeleton"></div><div class="course-skeleton"></div><div class="course-skeleton"></div>`;
  const response = await fetch("/.netlify/functions/student-courses", { headers: window.DJAI_PORTAL.authHeaders(portalSession) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "ไม่สามารถโหลดคอร์สได้");
  portalData = payload;
  const displayName = payload.profile.full_name || payload.profile.email?.split("@")[0] || "ผู้เรียน";
  ui.studentSummary.textContent = `${displayName} · ${payload.profile.email}`;
  updateSummary();
  categoryOptions();
  renderCourses();
}

async function downloadDocument(documentId, button) {
  setBusy(button, true, "กำลังเตรียมไฟล์");
  try {
    const response = await fetch("/.netlify/functions/download-document", {
      method: "POST", headers: window.DJAI_PORTAL.authHeaders(portalSession), body: JSON.stringify({ document_id: documentId }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "ไม่สามารถดาวน์โหลดเอกสารได้");
    window.open(payload.signedUrl, "_blank", "noopener");
    showToast("เริ่มดาวน์โหลดเอกสารแล้ว", "ok");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(button, false);
  }
}

ui.courseGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-course-id]");
  if (card) renderCourse(card.dataset.courseId);
});

ui.lessonList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-video-id]");
  if (!button) return;
  const videos = portalData.videos.filter((video) => video.course_id === activeCourseId);
  const index = videos.findIndex((video) => video.id === button.dataset.videoId);
  if (index >= 0) renderVideo(videos[index], index);
});

ui.documentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-document-id]");
  if (button) downloadDocument(button.dataset.documentId, button);
});

ui.courseSearch.addEventListener("input", renderCourses);
ui.categoryFilter.addEventListener("change", renderCourses);
ui.backToLibrary.addEventListener("click", showLibrary);
document.querySelectorAll("[data-lesson-tab]").forEach((tab) => tab.addEventListener("click", () => selectSidebarTab(tab.dataset.lessonTab)));

ui.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = ui.loginForm.querySelector("[type=submit]");
  window.DJAI_PORTAL.setStatus(ui.loginStatus, "");
  setBusy(button, true, "กำลังเข้าสู่ระบบ");
  const form = new FormData(ui.loginForm);
  try {
    const { data, error } = await portalClient.auth.signInWithPassword({ email: String(form.get("email") || "").trim(), password: String(form.get("password") || "") });
    if (error) throw error;
    portalSession = data.session;
    showApp(true);
    await loadStudentData();
  } catch (error) {
    window.DJAI_PORTAL.setStatus(ui.loginStatus, error.message || "เข้าสู่ระบบไม่สำเร็จ", "error");
  } finally {
    setBusy(button, false);
  }
});

ui.logoutButton.addEventListener("click", async () => {
  await portalClient.auth.signOut();
  portalSession = null;
  showApp(false);
  showLibrary();
});

(async function initLearningPortal() {
  refreshIcons();
  try {
    portalClient = await window.DJAI_PORTAL.createPortalClient();
    portalSession = await window.DJAI_PORTAL.currentSession(portalClient);
    showApp(Boolean(portalSession));
    if (portalSession) await loadStudentData();
  } catch (error) {
    showApp(false);
    window.DJAI_PORTAL.setStatus(ui.loginStatus, error.message || "ระบบยังไม่พร้อมใช้งาน", "error");
  }
})();
