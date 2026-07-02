(function () {
    "use strict";

    const DEFAULT_API_BASE = "http://localhost/Project_1/Backend/api";
    const STORAGE_KEYS = {
        apiBase: "student_manager_api_base",
        session: "student_manager_admin_session"
    };

    const endpointCandidates = {
        login: ["login.php", "auth/login.php", "admin/login.php", "users/login.php", "login"],
        register: ["register.php", "auth/register.php", "admin/register.php", "users/register.php", "register"],
        logout: ["logout.php", "auth/logout.php", "logout"],
        listStudents: [
            "students.php",
            "sinhvien.php",
            "student.php",
            "students/read.php",
            "sinhvien/read.php",
            "students",
            "sinhvien"
        ],
        addStudent: [
            "students.php?action=add",
            "sinhvien.php?action=add",
            "student.php?action=add",
            "students/create.php",
            "sinhvien/create.php",
            "add_student.php",
            "add_sinhvien.php"
        ],
        updateStudent: [
            "students.php?action=update",
            "sinhvien.php?action=update",
            "student.php?action=update",
            "students/update.php",
            "sinhvien/update.php",
            "update_student.php",
            "edit_student.php",
            "update_sinhvien.php"
        ],
        deleteStudent: [
            "students.php?action=delete",
            "sinhvien.php?action=delete",
            "student.php?action=delete",
            "students/delete.php",
            "sinhvien/delete.php",
            "delete_student.php",
            "delete_sinhvien.php"
        ]
    };

    const $ = (selector) => document.querySelector(selector);

    function normalizeBaseUrl(value) {
        return (value || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
    }

    function getApiBaseUrl() {
        const inputValue = $("#apiBaseUrl") ? $("#apiBaseUrl").value : "";
        return normalizeBaseUrl(inputValue || localStorage.getItem(STORAGE_KEYS.apiBase) || DEFAULT_API_BASE);
    }

    function saveApiBaseUrl(value) {
        localStorage.setItem(STORAGE_KEYS.apiBase, normalizeBaseUrl(value));
    }

    function buildUrl(path) {
        const normalizedPath = String(path).replace(/^\/+/, "");
        return `${getApiBaseUrl()}/${normalizedPath}`;
    }

    function toFormBody(data) {
        const body = new URLSearchParams();
        Object.entries(data || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                body.append(key, value);
            }
        });
        return body;
    }

    function getSession() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null");
        } catch (error) {
            return null;
        }
    }

    function setSession(session) {
        localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    }

    function clearSession() {
        localStorage.removeItem(STORAGE_KEYS.session);
    }

    function getAuthHeaders() {
        const session = getSession();
        return session && session.token ? { Authorization: `Bearer ${session.token}` } : {};
    }

    function getMessage(payload, fallback) {
        if (!payload) return fallback;
        return payload.message || payload.error || payload.msg || payload.thongBao || fallback;
    }

    async function parseResponse(response) {
        const text = await response.text();
        if (!text) return {};

        try {
            return JSON.parse(text);
        } catch (error) {
            return { raw: text, success: /^(ok|success|true|1)$/i.test(text.trim()) };
        }
    }

    function responseLooksSuccessful(payload) {
        if (!payload || Object.keys(payload).length === 0) return true;
        if (payload.success === false || payload.status === false || payload.ok === false) return false;
        if (typeof payload.status === "string" && ["error", "failed", "fail"].includes(payload.status.toLowerCase())) {
            return false;
        }
        return true;
    }

    async function apiRequest(candidates, options = {}) {
        const paths = Array.isArray(candidates) ? candidates : [candidates];
        const method = options.method || "GET";
        const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
        const fetchOptions = {
            method,
            headers,
            credentials: "include"
        };

        if (options.body) {
            fetchOptions.body = options.body instanceof URLSearchParams ? options.body : toFormBody(options.body);
            fetchOptions.headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
        }

        let lastError = null;

        for (const path of paths) {
            try {
                const response = await fetch(buildUrl(path), fetchOptions);
                const payload = await parseResponse(response);

                if (response.ok && responseLooksSuccessful(payload)) {
                    return payload;
                }

                const message = getMessage(payload, `Yêu cầu thất bại (${response.status})`);
                const shouldTryNext = [404, 405].includes(response.status);
                lastError = new Error(message);

                if (!shouldTryNext) {
                    throw lastError;
                }
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error("Không kết nối được backend");
    }

    function showToast(message, type = "success") {
        const container = $("#toastContainer");
        if (!container || !window.bootstrap) {
            alert(message);
            return;
        }

        const tone = type === "error" ? "danger" : type;
        const toast = document.createElement("div");
        toast.className = `toast align-items-center text-bg-${tone} border-0`;
        toast.setAttribute("role", "alert");
        toast.setAttribute("aria-live", "assertive");
        toast.setAttribute("aria-atomic", "true");
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${escapeHtml(message)}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Đóng"></button>
            </div>
        `;

        container.appendChild(toast);
        const instance = new bootstrap.Toast(toast, { delay: 3200 });
        toast.addEventListener("hidden.bs.toast", () => toast.remove());
        instance.show();
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function setButtonLoading(button, isLoading, loadingText) {
        if (!button) return;
        if (isLoading) {
            button.dataset.originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${loadingText || "Đang xử lý"}`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }

    function showApp(session) {
        $("#loginSection").style.display = "none";
        $("#mainSection").style.display = "block";
        $("#adminName").textContent = session?.name || session?.username || "Admin";
        if (window.StudentManager) {
            window.StudentManager.loadStudents();
        }
    }

    function showLogin() {
        $("#loginSection").style.display = "grid";
        $("#mainSection").style.display = "none";
    }

    async function handleLogin(event) {
        event.preventDefault();

        const username = $("#username").value.trim();
        const password = $("#password").value;
        const apiBaseUrl = getApiBaseUrl();
        const button = $("#btnLogin");

        if (!username || !password) {
            showToast("Vui lòng nhập đủ tài khoản và mật khẩu", "warning");
            return;
        }

        saveApiBaseUrl(apiBaseUrl);
        setButtonLoading(button, true, "Đang đăng nhập");

        try {
            const payload = await apiRequest(endpointCandidates.login, {
                method: "POST",
                body: {
                    username,
                    password,
                    tenDangNhap: username,
                    matKhau: password
                }
            });

            const account = payload.user || payload.admin || payload.data || payload;
            const session = {
                username,
                name: account.name || account.fullname || account.hoTen || account.username || username,
                token: payload.token || account.token || ""
            };

            setSession(session);
            showToast("Đăng nhập thành công");
            showApp(session);
        } catch (error) {
            showToast(error.message || "Đăng nhập thất bại", "error");
        } finally {
            setButtonLoading(button, false);
        }
    }

    async function handleRegister(event) {
        event.preventDefault();

        const username = $("#registerUsername").value.trim();
        const password = $("#registerPassword").value;
        const confirm = $("#registerConfirm").value;
        const button = $("#btnRegister");

        if (password !== confirm) {
            showToast("Mật khẩu nhập lại chưa khớp", "warning");
            return;
        }

        saveApiBaseUrl(getApiBaseUrl());
        setButtonLoading(button, true, "Đang đăng ký");

        try {
            await apiRequest(endpointCandidates.register, {
                method: "POST",
                body: {
                    username,
                    password,
                    tenDangNhap: username,
                    matKhau: password
                }
            });

            $("#username").value = username;
            $("#password").value = "";
            bootstrap.Modal.getInstance($("#registerModal")).hide();
            showToast("Tạo tài khoản thành công");
        } catch (error) {
            showToast(error.message || "Đăng ký thất bại", "error");
        } finally {
            setButtonLoading(button, false);
        }
    }

    async function handleLogout() {
        try {
            await apiRequest(endpointCandidates.logout, { method: "POST" });
        } catch (error) {
            // Vẫn xóa phiên ở frontend nếu backend logout không phản hồi.
        }

        clearSession();
        showLogin();
        showToast("Đã đăng xuất");
    }

    function initAuth() {
        const savedBase = localStorage.getItem(STORAGE_KEYS.apiBase) || DEFAULT_API_BASE;
        $("#apiBaseUrl").value = savedBase;

        $("#loginForm").addEventListener("submit", handleLogin);
        $("#registerForm").addEventListener("submit", handleRegister);
        $("#btnLogout").addEventListener("click", handleLogout);
        $("#btnOpenRegister").addEventListener("click", () => {
            saveApiBaseUrl(getApiBaseUrl());
            $("#registerForm").reset();
            new bootstrap.Modal($("#registerModal")).show();
        });

        const session = getSession();
        if (session) {
            showApp(session);
        } else {
            showLogin();
        }
    }

    window.StudentApi = {
        endpoints: endpointCandidates,
        request: apiRequest,
        showToast,
        escapeHtml,
        setButtonLoading
    };

    document.addEventListener("DOMContentLoaded", initAuth);
})();
