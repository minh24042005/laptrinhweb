(function () {
    "use strict";

    const state = {
        students: [],
        searchTerm: ""
    };

    const $ = (selector) => document.querySelector(selector);
    const api = window.StudentApi;

    function getValue(item, keys, fallback = "") {
        for (const key of keys) {
            if (item && item[key] !== undefined && item[key] !== null && item[key] !== "") {
                return item[key];
            }
        }
        return fallback;
    }

    function normalizeStudent(item) {
        return {
            maSV: String(getValue(item, ["maSV", "MaSV", "masv", "ma_sv", "ma_sinh_vien", "maSinhVien", "id"])).trim(),
            tenSV: String(getValue(item, ["tenSV", "TenSV", "tensv", "ten_sv", "ten_sinh_vien", "tenSinhVien", "hoTen", "name"])).trim(),
            ngaySinh: normalizeInputDate(getValue(item, ["ngaySinh", "NgaySinh", "ngaysinh", "ngay_sinh", "date_of_birth", "dob"])),
            gioiTinh: normalizeGender(getValue(item, ["gioiTinh", "GioiTinh", "gioitinh", "gioi_tinh", "gender"], "Nam")),
            lop: String(getValue(item, ["lop", "Lop", "class", "maLop", "ma_lop"], "")).trim()
        };
    }

    function extractStudents(payload) {
        const source = Array.isArray(payload)
            ? payload
            : payload.data || payload.students || payload.sinhVien || payload.sinhvien || payload.items || [];

        return Array.isArray(source) ? source.map(normalizeStudent).filter((student) => student.maSV) : [];
    }

    function normalizeInputDate(value) {
        if (!value) return "";
        const text = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
            const [day, month, year] = text.split("/");
            return `${year}-${month}-${day}`;
        }
        return text.slice(0, 10);
    }

    function formatDate(value) {
        if (!value) return "";
        const [year, month, day] = value.split("-");
        return year && month && day ? `${day}/${month}/${year}` : value;
    }

    function normalizeGender(value) {
        const text = String(value || "").trim().toLowerCase();
        if (["nu", "nữ", "female", "f", "0"].includes(text)) return "Nữ";
        return "Nam";
    }

    function removeAccents(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")
            .toLowerCase();
    }

    function getFilteredStudents() {
        const keyword = removeAccents(state.searchTerm.trim());
        if (!keyword) return state.students;

        return state.students.filter((student) => {
            const haystack = removeAccents(`${student.maSV} ${student.tenSV}`);
            return haystack.includes(keyword);
        });
    }

    function renderStudents() {
        const tbody = $("#studentTableBody");
        const students = getFilteredStudents();

        if (!students.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">Không có sinh viên phù hợp</td>
                </tr>
            `;
            renderStats();
            return;
        }

        tbody.innerHTML = students.map((student) => `
            <tr>
                <td><span class="student-code">${api.escapeHtml(student.maSV)}</span></td>
                <td>${api.escapeHtml(student.tenSV)}</td>
                <td>${api.escapeHtml(formatDate(student.ngaySinh))}</td>
                <td>
                    <span class="gender-pill ${student.gioiTinh === "Nữ" ? "female" : ""}">
                        ${api.escapeHtml(student.gioiTinh)}
                    </span>
                </td>
                <td>${api.escapeHtml(student.lop)}</td>
                <td class="text-center">
                    <button class="btn btn-outline-primary btn-sm btn-icon js-edit" type="button" data-id="${api.escapeHtml(student.maSV)}" title="Sửa">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm btn-icon js-delete ms-1" type="button" data-id="${api.escapeHtml(student.maSV)}" title="Xóa">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join("");

        renderStats();
    }

    function renderStats() {
        const students = state.students;
        const classCount = new Set(students.map((student) => student.lop).filter(Boolean)).size;

        $("#statTotal").textContent = students.length;
        $("#statMale").textContent = students.filter((student) => student.gioiTinh === "Nam").length;
        $("#statFemale").textContent = students.filter((student) => student.gioiTinh === "Nữ").length;
        $("#statClass").textContent = classCount;
    }

    function setTableLoading() {
        $("#studentTableBody").innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang tải dữ liệu...
                </td>
            </tr>
        `;
    }

    async function loadStudents() {
        setTableLoading();

        try {
            const payload = await api.request(api.endpoints.listStudents);
            state.students = extractStudents(payload);
            renderStudents();
        } catch (error) {
            state.students = [];
            renderStudents();
            api.showToast(error.message || "Không tải được danh sách sinh viên", "error");
        }
    }

    function openAddModal() {
        $("#studentForm").reset();
        $("#formAction").value = "add";
        $("#originalMaSV").value = "";
        $("#maSV").disabled = false;
        $("#gtNam").checked = true;
        $("#modalTitle").textContent = "Thêm sinh viên";
        new bootstrap.Modal($("#studentModal")).show();
    }

    function openEditModal(maSV) {
        const student = state.students.find((item) => item.maSV === maSV);
        if (!student) {
            api.showToast("Không tìm thấy sinh viên cần sửa", "warning");
            return;
        }

        $("#formAction").value = "edit";
        $("#originalMaSV").value = student.maSV;
        $("#maSV").value = student.maSV;
        $("#maSV").disabled = false;
        $("#tenSV").value = student.tenSV;
        $("#ngaySinh").value = student.ngaySinh;
        $("#lop").value = student.lop;
        $("#gtNam").checked = student.gioiTinh === "Nam";
        $("#gtNu").checked = student.gioiTinh === "Nữ";
        $("#modalTitle").textContent = "Sửa sinh viên";
        new bootstrap.Modal($("#studentModal")).show();
    }

    function getFormStudent() {
        return {
            maSV: $("#maSV").value.trim(),
            tenSV: $("#tenSV").value.trim(),
            ngaySinh: $("#ngaySinh").value,
            gioiTinh: document.querySelector("input[name='gioiTinh']:checked").value,
            lop: $("#lop").value.trim()
        };
    }

    function buildStudentPayload(student, action, originalMaSV) {
        return {
            action,
            maSV: student.maSV,
            masv: student.maSV,
            ma_sv: student.maSV,
            maSinhVien: student.maSV,
            tenSV: student.tenSV,
            tensv: student.tenSV,
            ten_sv: student.tenSV,
            tenSinhVien: student.tenSV,
            ngaySinh: student.ngaySinh,
            ngaysinh: student.ngaySinh,
            ngay_sinh: student.ngaySinh,
            gioiTinh: student.gioiTinh,
            gioitinh: student.gioiTinh,
            gioi_tinh: student.gioiTinh,
            lop: student.lop,
            maLop: student.lop,
            oldMaSV: originalMaSV || student.maSV,
            originalMaSV: originalMaSV || student.maSV,
            id: originalMaSV || student.maSV
        };
    }

    function validateStudent(student) {
        if (!student.maSV || !student.tenSV || !student.ngaySinh || !student.lop) {
            return "Vui lòng nhập đầy đủ thông tin sinh viên";
        }

        if (student.maSV.length < 3) {
            return "Mã sinh viên cần có ít nhất 3 ký tự";
        }

        return "";
    }

    async function handleSaveStudent(event) {
        event.preventDefault();

        const action = $("#formAction").value;
        const originalMaSV = $("#originalMaSV").value;
        const student = getFormStudent();
        const validationMessage = validateStudent(student);

        if (validationMessage) {
            api.showToast(validationMessage, "warning");
            return;
        }

        const button = $("#btnSave");
        api.setButtonLoading(button, true, "Đang lưu");

        try {
            if (action === "add") {
                await api.request(api.endpoints.addStudent, {
                    method: "POST",
                    body: buildStudentPayload(student, "add", originalMaSV)
                });
                api.showToast("Đã thêm sinh viên");
            } else {
                await api.request(api.endpoints.updateStudent, {
                    method: "POST",
                    body: buildStudentPayload(student, "update", originalMaSV)
                });
                api.showToast("Đã cập nhật sinh viên");
            }

            bootstrap.Modal.getInstance($("#studentModal")).hide();
            await loadStudents();
        } catch (error) {
            api.showToast(error.message || "Không lưu được sinh viên", "error");
        } finally {
            api.setButtonLoading(button, false);
        }
    }

    async function deleteStudent(maSV) {
        const student = state.students.find((item) => item.maSV === maSV);
        const label = student ? `${student.maSV} - ${student.tenSV}` : maSV;

        if (!confirm(`Xóa sinh viên ${label}?`)) {
            return;
        }

        try {
            await api.request(api.endpoints.deleteStudent, {
                method: "POST",
                body: {
                    action: "delete",
                    maSV,
                    masv: maSV,
                    ma_sv: maSV,
                    id: maSV
                }
            });

            api.showToast("Đã xóa sinh viên");
            await loadStudents();
        } catch (error) {
            api.showToast(error.message || "Không xóa được sinh viên", "error");
        }
    }

    function initStudentManager() {
        $("#btnOpenAdd").addEventListener("click", openAddModal);
        $("#btnReload").addEventListener("click", loadStudents);
        $("#studentForm").addEventListener("submit", handleSaveStudent);
        $("#txtSearch").addEventListener("input", (event) => {
            state.searchTerm = event.target.value;
            renderStudents();
        });
        $("#btnResetSearch").addEventListener("click", () => {
            state.searchTerm = "";
            $("#txtSearch").value = "";
            renderStudents();
        });
        $("#studentTableBody").addEventListener("click", (event) => {
            const editButton = event.target.closest(".js-edit");
            const deleteButton = event.target.closest(".js-delete");

            if (editButton) {
                openEditModal(editButton.dataset.id);
            }

            if (deleteButton) {
                deleteStudent(deleteButton.dataset.id);
            }
        });
    }

    window.StudentManager = {
        loadStudents,
        openAddModal,
        openEditModal
    };

    document.addEventListener("DOMContentLoaded", initStudentManager);
})();
