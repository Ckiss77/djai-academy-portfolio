const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const logoutButton = document.getElementById("logoutButton");
const studentSummary = document.getElementById("studentSummary");
const courseGrid = document.getElementById("courseGrid");
const lessonLayout = document.getElementById("lessonLayout");
const lessonList = document.getElementById("lessonList");
const documentList = document.getElementById("documentList");
const videoFrame = document.getElementById("videoFrame");
const activeCourseCategory = document.getElementById("activeCourseCategory");
const activeCourseTitle = document.getElementById("activeCourseTitle");
const activeCourseDescription = document.getElementById("activeCourseDescription");

let portalClient;
let portalSession;
let portalData = { categories: [], courses: [], videos: [], documents: [] };

function showApp(isLoggedIn) {
  loginView.classList.toggle("is-hidden", isLoggedIn);
  appView.classList.toggle("is-hidden", !isLoggedIn);
}

function categoryName(categoryId) {
  return portalData.categories.find((item) => item.id === categoryId)?.name || "DJAI Course";
}

function renderCourses() {
  courseGrid.innerHTML = "";

  if (!portalData.courses.length) {
    courseGrid.innerHTML = '<div class="portal-panel">ยังไม่มีคอร์สที่เปิดสิทธิ์ให้บัญชีนี้</div>';
    lessonLayout.classList.add("is-hidden");
    return;
  }

  portalData.courses.forEach((course) => {
    const card = document.createElement("button");
    card.className = "portal-card";
    card.type = "button";
    card.innerHTML = `
      <small>${categoryName(course.category_id)}</small>
      <h3>${course.title}</h3>
      <p>${course.description || ""}</p>
    `;
    card.addEventListener("click", () => renderCourse(course.id));
    courseGrid.appendChild(card);
  });

  renderCourse(portalData.courses[0].id);
}

function renderCourse(courseId) {
  const course = portalData.courses.find((item) => item.id === courseId);
  if (!course) return;

  document.querySelectorAll(".portal-card").forEach((card) => {
    card.classList.toggle("active", card.querySelector("h3")?.textContent === course.title);
  });

  lessonLayout.classList.remove("is-hidden");
  activeCourseCategory.textContent = categoryName(course.category_id);
  activeCourseTitle.textContent = course.title;
  activeCourseDescription.textContent = course.description || "";

  const videos = portalData.videos.filter((video) => video.course_id === course.id);
  const documents = portalData.documents.filter((documentItem) => documentItem.course_id === course.id);

  lessonList.innerHTML = "";
  videos.forEach((video, index) => {
    const button = document.createElement("button");
    button.className = "lesson-button";
    button.type = "button";
    button.textContent = video.title;
    button.addEventListener("click", () => renderVideo(video, button));
    lessonList.appendChild(button);
    if (index === 0) renderVideo(video, button);
  });

  if (!videos.length) {
    videoFrame.innerHTML = "";
    lessonList.innerHTML = '<div class="admin-item">ยังไม่มีวิดีโอในคอร์สนี้</div>';
  }

  documentList.innerHTML = "";
  documents.forEach((documentItem) => {
    const button = document.createElement("button");
    button.className = "document-button";
    button.type = "button";
    button.textContent = documentItem.title;
    button.addEventListener("click", () => downloadDocument(documentItem.id));
    documentList.appendChild(button);
  });

  if (!documents.length) {
    documentList.innerHTML = '<div class="admin-item">ยังไม่มีเอกสารประกอบคอร์สนี้</div>';
  }
}

function renderVideo(video, activeButton) {
  document.querySelectorAll(".lesson-button").forEach((button) => button.classList.remove("active"));
  activeButton?.classList.add("active");
  videoFrame.innerHTML = `<iframe src="${window.DJAI_PORTAL.youtubeEmbedUrl(video.youtube_url)}" title="${video.title}" allowfullscreen></iframe>`;
}

async function loadStudentData() {
  const response = await fetch("/.netlify/functions/student-courses", {
    headers: window.DJAI_PORTAL.authHeaders(portalSession),
  });
  const payload = await response.json();

  if (!response.ok) throw new Error(payload.message || "Could not load courses.");

  portalData = payload;
  studentSummary.textContent = `${payload.profile.full_name || payload.profile.email} | ${payload.profile.email}`;
  renderCourses();
}

async function downloadDocument(documentId) {
  const response = await fetch("/.netlify/functions/download-document", {
    method: "POST",
    headers: window.DJAI_PORTAL.authHeaders(portalSession),
    body: JSON.stringify({ document_id: documentId }),
  });
  const payload = await response.json();

  if (!response.ok) {
    window.alert(payload.message || "Cannot download this document.");
    return;
  }

  const link = document.createElement("a");
  link.href = payload.signedUrl;
  link.download = payload.fileName || "course-document";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  window.DJAI_PORTAL.setStatus(loginStatus, "Signing in...");

  const form = new FormData(loginForm);
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");

  const { data, error } = await portalClient.auth.signInWithPassword({ email, password });

  if (error) {
    window.DJAI_PORTAL.setStatus(loginStatus, error.message, "error");
    return;
  }

  portalSession = data.session;
  showApp(true);
  await loadStudentData();
});

logoutButton.addEventListener("click", async () => {
  await portalClient.auth.signOut();
  portalSession = null;
  showApp(false);
});

(async function initLearningPortal() {
  try {
    portalClient = await window.DJAI_PORTAL.createPortalClient();
    portalSession = await window.DJAI_PORTAL.currentSession(portalClient);

    if (portalSession) {
      showApp(true);
      await loadStudentData();
    } else {
      showApp(false);
    }
  } catch (error) {
    window.DJAI_PORTAL.setStatus(loginStatus, error.message, "error");
  }
})();
