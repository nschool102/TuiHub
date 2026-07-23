// =========================================================================
// MODULE: QUẢN LÍ GIA ĐÌNH — finance.js
// Gộp từ: config.js (gốc) + script-withHealth.js (bản user cung cấp, có Health Check
// + layout 2 cột) + scriptThongKe.js (gốc). Bọc trong 1 IIFE để tránh đụng biến/hàm
// global với module Huyền học & Máy tính (vd applyTheme()/switchTab() trùng tên).
// =========================================================================
(function() {
'use strict';

// =========================================================================
// CẤU HÌNH APP
// =========================================================================
const CONFIG = {
    googleSheetId: '19Tsmkh53nPAqhTYy2DU5dSfYXJRAwyc9VI0VaeM3LMw',
    apiEndpoint: 'https://script.google.com/macros/s/AKfycbxC72RzXFo9yG8iP9FRgyjY7sYhH_ffHxR1qkK0u5GbwFnmODsZ0E2_M_Hl38328S3T/exec'
};

const CATEGORIES = {
    thu: {
        "Lương": ["Lương tháng", "Bổ sung lương", "Ứng lương", "Trực lễ tết", "Công tác phí", "Hoàn thuế"],
        "Thưởng": ["Bất thường", "Bổ sung thưởng", "Thưởng lễ tết", "Thưởng năm", "Thưởng quí"],
        "Phụ cấp": ["Mĩ phẩm", "Vệ sinh viên", "Đồng phục"],
        "Phúc lợi": ["HSG", "Phụ nữ", "Công đoàn", "Sinh nhật", "Thiếu nhi"],
        "Thu khác": ["Bảo hiểm refund"],
        "Bất thường": ["Tặng cho", "Trúng số"],
        "CON CỢP": ["Lương tháng", "Bổ sung lương", "Bổ sung thưởng", "Bóp cổ", "HSG", "Thiếu nhi"]
    },
    chi: {
        "Ăn uống": ["Ăn sáng", "Ăn trưa", "Ăn tối", "Đi chợ, Siêu thị", "Ăn vặt, Đồ ngọt"],
        "Chi tiêu thiết yếu": ["Điện", "Nước", "Internet", "Điện thoại", "Xăng", "Taxi, bus, xe công nghệ"],
        "Mua sắm & Cá nhân": ["Quần áo, Giày dép", "Phụ kiện", "Mĩ phẩm", "Đồ gia dụng", "Đồ chơi", "Sách, Văn phòng phẩm"],
        "Y tế & Sức khỏe": ["Khám, chữa bệnh", "Thuốc", "Thực phẩm chức năng"],
        "Giáo dục": ["Học phí", "Học thêm", "Quĩ lớp", "Lệ phí"],
        "Hưởng thụ": ["Coi phim", "Du lịch", "Quán cafe", "Nhà hàng"],
        "Đầu tư, tiết kiệm": ["Vàng", "Tiền mặt", "USDT", "Cho mượn"],
        "Chi khác": ["Từ thiện", "Biếu tặng", "Tiền tiêu vặt"]
    }
};

const PALETTE = ["#4CAF50", "#8BC34A", "#2196F3", "#E91E63", "#9C27B0", "#F44336", "#FF9800", "#FFEB3B"];

// Theme mặc định: Vàng (#FFC107) + Dark Mode bật sẵn
const DEFAULT_THEME_COLOR = "#FFC107";
const DEFAULT_DARK_MODE = true;

let db;
let charts = {};
let localFamilyData = [];
let localReminderData = [];
let isSyncing = false;
let notificationCheckInterval = null;
// Thêm vào cuối file, sau các biến hiện có
let diaryData = [];

// =========================================================================
// HÀM XỬ LÝ NGÀY THÁNG CHO VIỆT NAM (GMT+7)
// =========================================================================

// Lấy thời gian hiện tại theo GMT+7
function getVietnamNow() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() + (offset + 420) * 60000);
} // end function getVietnamNow

// Format ngày theo định dạng yyyy-mm-dd hh:mm:ss (GMT+7)
function formatVietnamDateTime(date) {
    if (!date) return '';
    
    let d;
    if (typeof date === 'string') {
        d = new Date(date);
    } else {
        d = new Date(date);
    }
    
    if (isNaN(d.getTime())) {
        console.log('⚠️ formatVietnamDateTime: Invalid date');
        return '';
    }
    
    // Điều chỉnh về GMT+7
    const offset = d.getTimezoneOffset();
    const vietnamTime = new Date(d.getTime() + (offset + 420) * 60000);
    
    const year = vietnamTime.getFullYear();
    const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
    const day = String(vietnamTime.getDate()).padStart(2, '0');
    const hours = String(vietnamTime.getHours()).padStart(2, '0');
    const minutes = String(vietnamTime.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
} // end function formatVietnamDateTime

// Format date chỉ lấy phần ngày (yyyy-mm-dd)
function formatDateOnly(d) {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
} // end function formatDateOnly

// Chuẩn hóa timestamp để so sánh dedup an toàn:
// - cắt bỏ giây nếu có (giữ tới phút: yyyy-mm-dd hh:mm)
// - trim khoảng trắng, bỏ ký tự T/Z nếu sót lại từ ISO string
function normalizeTimestampForCompare(ts) {
    if (!ts) return '';
    let s = String(ts).trim();
    s = s.replace('T', ' ').replace('Z', '');
    // Cắt giây nếu có dạng yyyy-mm-dd hh:mm:ss(.xxx)
    const match = s.match(/^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2})/);
    return match ? match[1] : s;
} // end function normalizeTimestampForCompare

// Chuyển bất kỳ giá trị ngày (ISO string "2025-04-22T17:00:00.000Z",
// "yyyy-mm-dd hh:mm", hoặc "yyyy-mm-dd") thành định dạng hiển thị dd-mm-yyyy.
// Trả về chuỗi gốc nếu không nhận diện được (để không làm mất dữ liệu khi hiển thị).
function formatDisplayDateDMY(value) {
    if (!value || value === "-") return value || "-";
    const str = String(value).trim();

    // Dạng yyyy-mm-dd hoặc yyyy-mm-ddThh:mm:ss... (ISO) hoặc yyyy-mm-dd hh:mm
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return `${day}-${month}-${year}`;
    }

    // Dạng dd/mm/yyyy đã có sẵn (ví dụ dữ liệu cũ) -> chuyển dấu / thành -
    const slashMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (slashMatch) {
        const [, day, month, year] = slashMatch;
        return `${day}-${month}-${year}`;
    }

    // Fallback: thử parse bằng Date(), nếu hợp lệ thì format lại
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    }

    return str;
} // end function formatDisplayDateDMY

// =========================================================================
// HÀM CHUYỂN ĐỔI SENTENCE CASE
// =========================================================================
function toSentenceCase(str) {
    if (!str || typeof str !== 'string') return str || '';
    if (str.trim() === '') return str;
    if (str === str.toUpperCase()) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
} // end function toSentenceCase

// =========================================================================
// THÔNG BÁO ĐẨY (PUSH NOTIFICATION)
// =========================================================================
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("Trình duyệt không hỗ trợ Notification");
        return;
    }
    
    if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Đã được cấp quyền thông báo");
                registerServiceWorker();
            } else {
                console.log("Từ chối quyền thông báo");
            }
        });
    } else if (Notification.permission === "granted") {
        registerServiceWorker();
    }
} // end function requestNotificationPermission

function registerServiceWorker() {
    // [HUB] Sửa đường dẫn cũ "/Tui/sw.js" (từ app Tui độc lập trước khi gộp) — giờ SW nằm ở
    // gốc Hub. Trong thực tế shell.js đã tự đăng ký "./sw.js" từ lúc mở app rồi nên hàm này
    // gần như luôn no-op (chỉ đăng ký lại đúng file, không hại gì), giữ lại cho an toàn vì
    // requestNotificationPermission() vẫn gọi tới hàm này.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('Service Worker đăng ký thành công:', reg);
            })
            .catch(err => {
                console.log('Lỗi đăng ký Service Worker:', err);
            });
    }
} // end function registerServiceWorker

function triggerPushNotification(title, body) {
    if (!("Notification" in window)) {
        console.log("Trình duyệt không hỗ trợ Notification");
        return;
    }
    
    if (Notification.permission === "granted") {
        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: title,
                    body: body,
                    icon: 'icon.png'
                });
            } else {
                new Notification(title, {
                    body: body,
                    icon: 'icon.png',
                    vibrate: [200, 100, 200]
                });
            }
        } catch(e) {
            console.log("Lỗi gửi thông báo:", e);
            try {
                new Notification(title, { body: body });
            } catch(e2) {
                console.log("Không thể gửi thông báo:", e2);
            }
        }
    } else {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                triggerPushNotification(title, body);
            }
        });
    }
} // end function triggerPushNotification
// end THÔNG BÁO ĐẨY

// =========================================================================
// THÔNG TIN ỨNG DỤNG - TỰ ĐỘNG CẬP NHẬT
// =========================================================================
async function loadAppInfoFromManifest() {
    try {
        const response = await fetch('/Tui/manifest.json');
        if (!response.ok) {
            throw new Error('Không tìm thấy manifest.json');
        }
        const manifest = await response.json();
        return {
            version: manifest.version || '1.0.0',
            name: manifest.name || 'TÔI - Quản lý tài chính',
            shortName: manifest.short_name || 'TÔI'
        };
    } catch (error) {
        console.log('Không thể tải manifest.json:', error.message);
        return {
            version: '1.0.0',
            name: 'TÔI - Quản lý tài chính',
            shortName: 'TÔI'
        };
    }
} // end function loadAppInfoFromManifest

function getBuildTime() {
    const scripts = document.getElementsByTagName('script');
    let buildTime = new Date();
    for (let script of scripts) {
        if (script.src && script.src.includes('script.js')) {
            const urlParams = new URLSearchParams(script.src.split('?')[1] || '');
            const timestamp = urlParams.get('v');
            if (timestamp) {
                buildTime = new Date(parseInt(timestamp));
            } else {
                buildTime = new Date();
            }
            break;
        }
    }
    return buildTime;
} // end function getBuildTime

function formatBuildTime(date) {
    if (!date || isNaN(date.getTime())) {
        return '--/--/---- --:--:--';
    }
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
} // end function formatBuildTime

let APP_CONFIG = {
    version: '1.0.0',
    name: 'TÔI - Quản lý tài chính',
    shortName: 'TÔI',
    buildDate: formatBuildTime(new Date())
};

async function initAppConfig() {
    const manifestInfo = await loadAppInfoFromManifest();
    APP_CONFIG.version = manifestInfo.version;
    APP_CONFIG.name = manifestInfo.name;
    APP_CONFIG.shortName = manifestInfo.shortName;
    const buildTime = getBuildTime();
    APP_CONFIG.buildDate = formatBuildTime(buildTime);
    updateAppInfo();
    console.log('✅ App config initialized:', APP_CONFIG);
} // end function initAppConfig

function openAppInfoModal() {
    const modal = document.getElementById('appInfoModal');
    if (modal) {
        modal.style.display = 'flex';
        updateAppInfo();
    }
} // end function openAppInfoModal

function closeAppInfoModal() {
    const modal = document.getElementById('appInfoModal');
    if (modal) {
        modal.style.display = 'none';
    }
} // end function closeAppInfoModal

function updateAppInfo() {
    const versionEl = document.getElementById('app-version');
    const buildDateEl = document.getElementById('app-build-date');
    const lastSyncEl = document.getElementById('app-last-sync');
    const totalTxEl = document.getElementById('app-total-transactions');
    const totalRemEl = document.getElementById('app-total-reminders');
    const totalFamilyEl = document.getElementById('app-total-family');
    const versionMiniEl = document.getElementById('app-version-mini');
    
    if (versionEl) versionEl.textContent = APP_CONFIG.version;
    if (versionMiniEl) versionMiniEl.textContent = APP_CONFIG.version;
    if (buildDateEl) buildDateEl.textContent = APP_CONFIG.buildDate;
    
    if (lastSyncEl) {
        const lastSyncTime = localStorage.getItem('lastSyncTime');
        if (lastSyncTime) {
            lastSyncEl.textContent = lastSyncTime;
        } else {
            lastSyncEl.textContent = 'Chưa đồng bộ';
        }
    }
    
    if (db && totalTxEl) {
        const tx = db.transaction('transactions', 'readonly');
        const store = tx.objectStore('transactions');
        const countRequest = store.count();
        countRequest.onsuccess = function(e) {
            totalTxEl.textContent = e.target.result || 0;
        };
        countRequest.onerror = function() {
            totalTxEl.textContent = '0';
        };
    }
    
    if (db && totalRemEl) {
        const tx = db.transaction('reminders', 'readonly');
        const store = tx.objectStore('reminders');
        const countRequest = store.count();
        countRequest.onsuccess = function(e) {
            totalRemEl.textContent = e.target.result || 0;
        };
        countRequest.onerror = function() {
            totalRemEl.textContent = '0';
        };
    }
    
    if (totalFamilyEl) {
        totalFamilyEl.textContent = localFamilyData ? localFamilyData.length : 0;
    }
} // end function updateAppInfo

function updateLastSyncTime() {
    const now = new Date();
    const timeString = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    localStorage.setItem('lastSyncTime', timeString);
    const lastSyncEl = document.getElementById('app-last-sync');
    if (lastSyncEl) {
        lastSyncEl.textContent = timeString;
    }
} // end function updateLastSyncTime
// end THÔNG TIN ỨNG DỤNG

// =========================================================================
// CẬP NHẬT TỔNG THU/CHI TRONG THÁNG - TAB THU/CHI
// =========================================================================
function updateSummaryTotals() {
    getAllTransactions(data => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        let totalThu = 0;
        let totalChi = 0;
        
        data.forEach(t => {
            const tDate = new Date(t.timestamp);
            if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
                if (t.amount > 0) {
                    totalThu += t.amount;
                } else {
                    totalChi += Math.abs(t.amount);
                }
            }
        });
        
        const thuEl = document.getElementById('total-thu-month');
        if (thuEl) {
            thuEl.textContent = formatVND(totalThu);
        }
        
        const chiEl = document.getElementById('total-chi-month');
        if (chiEl) {
            chiEl.textContent = formatVND(totalChi);
        }
    });
} // end function updateSummaryTotals
// end CẬP NHẬT TỔNG THU/CHI TRONG THÁNG

// =========================================================================
// KHỞI TẠO INDEXEDDB
// =========================================================================
function initDB() {
    const request = indexedDB.open("FamilyFinancePWA", 5);
    request.onupgradeneeded = function(e) {
        db = e.target.result;
        if (!db.objectStoreNames.contains("transactions")) {
            db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("settings")) {
            db.createObjectStore("settings", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("reminders")) {
            db.createObjectStore("reminders", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("diary")) {
            db.createObjectStore("diary", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("health")) {
            db.createObjectStore("health", { keyPath: "id", autoIncrement: true });
        }
    };
    request.onsuccess = function(e) {
        db = e.target.result;
        console.log('✅ IndexedDB opened successfully, version:', db.version);
        cleanupCorruptedReminders(() => {
            loadInitialSettings();
            requestNotificationPermission();
            startDailyReminderCheck();
        });
    };
    request.onerror = function(e) {
        console.error("Lỗi mở IndexedDB:", e.target.error);
    };
} // end function initDB
// end KHỞI TẠO INDEXEDDB

// =========================================================================
// KHỞI TẠO DOM EVENTS
// =========================================================================
function setupEventListeners() {
    // [HUB] "main-nav-tabs" cũ đã được thay bằng #hub-submenu của shell, không còn trong DOM module này.
    // switchTab(tabName) giờ được shell gọi trực tiếp qua HubModules.finance.switchTab().

    document.getElementById("chi-type").addEventListener("change", () => updateSubtypes('chi'));
    document.getElementById("thu-type").addEventListener("change", () => updateSubtypes('thu'));

    document.getElementById("form-chi").addEventListener("submit", (e) => saveTransaction(e, 'chi'));
    document.getElementById("form-thu").addEventListener("submit", (e) => saveTransaction(e, 'thu'));
    
    document.getElementById("form-diary").addEventListener("submit", (e) => saveDiaryEntry(e));
    
    // Thêm event cho button Lưu Health
    const btnHealthOnly = document.getElementById("btn-save-health-only");
    if (btnHealthOnly) {
        btnHealthOnly.addEventListener("click", saveHealthOnly);
    }
    
    setupDiaryPlaceToggle();
    setupStatTimeEvents();
    setupBloodPressureMask();
    
    document.getElementById("form-nhachen").addEventListener("submit", (e) => saveReminder(e));

    document.getElementById("chi-amount").addEventListener("input", (e) => formatCurrency(e.target));
    document.getElementById("thu-amount").addEventListener("input", (e) => formatCurrency(e.target));

    document.getElementById("chi-top-period").addEventListener("change", () => renderTopExpenses());
    // [HUB] "sec4-period" đã bị xóa cùng Section 4 (gộp vào Section 5) — gỡ listener tương ứng.

    document.getElementById("rem-frequency").addEventListener("change", toggleCustomReminderFields);

    document.getElementById("btn-verify-family").addEventListener("click", verifyFamilyAuth);

    document.getElementById("darkModeToggle").addEventListener("change", (e) => toggleDarkMode(e.target.checked));
    document.getElementById("setting-color").addEventListener("change", applyTheme);
    document.getElementById("btn-sync-data").addEventListener("click", syncAllDataFromSheet);
    document.getElementById("btn-reset-app").addEventListener("click", resetAppCompletely);

    document.getElementById("scrollTopBtn").addEventListener("click", scrollToTop);

    // ============================================================
    // FAMILY MODAL - ĐÓNG BẰNG NÚT X, CLICK OUTSIDE, ESC
    // ============================================================
    const btnCloseFamily = document.getElementById("btn-close-modal-family");
    if (btnCloseFamily) {
        btnCloseFamily.addEventListener("click", closeModal);
    }

    const familyModal = document.getElementById("familyModal");
    if (familyModal) {
        familyModal.addEventListener("click", function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }

    // ============================================================
    // APP INFO MODAL - MỞ, ĐÓNG, LÀM MỚI
    // ============================================================
    const btnAppInfo = document.getElementById("btn-app-info");
    if (btnAppInfo) {
        btnAppInfo.addEventListener("click", openAppInfoModal);
    }

    const btnCloseAppInfo = document.getElementById("btn-close-app-info");
    if (btnCloseAppInfo) {
        btnCloseAppInfo.addEventListener("click", closeAppInfoModal);
    }

    const appInfoModal = document.getElementById("appInfoModal");
    if (appInfoModal) {
        appInfoModal.addEventListener("click", function(e) {
            if (e.target === this) {
                closeAppInfoModal();
            }
        });
    }

    const btnRefreshAppInfo = document.getElementById("btn-refresh-app-info");
    if (btnRefreshAppInfo) {
        btnRefreshAppInfo.addEventListener("click", function() {
            updateAppInfo();
            this.textContent = "✅ Đã làm mới!";
            setTimeout(() => {
                this.textContent = "🔄 Làm mới";
            }, 1500);
        });
    }

    // ============================================================
    // ĐÓNG MODAL BẰNG PHÍM ESC
    // ============================================================
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
            const familyModal = document.getElementById("familyModal");
            if (familyModal && familyModal.style.display === "flex") {
                closeModal();
            }
            const appInfoModal = document.getElementById("appInfoModal");
            if (appInfoModal && appInfoModal.style.display === "flex") {
                closeAppInfoModal();
            }
        }
    });
} // end function setupEventListeners
// end KHỞI TẠO DOM EVENTS

// =========================================================================
// ĐIỀU HƯỚNG TABS
// =========================================================================
function switchTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.add("active");

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add("active");

    if (tabName === 'chi' || tabName === 'thongke') {
        renderChartsAndStats();
    }
    if (tabName === 'thongke') {
        runThongKeTheoKy(); // [HUB] Section 5: render lại với bộ lọc hiện tại mỗi lần mở tab
    }
    if (tabName === 'concai') {
        runConCaiTheoKy(); // [HUB] Tab Con cái: render lại với bộ lọc hiện tại mỗi lần mở tab
    }
    if (tabName === 'family') {
        checkFamilyTabAccess();
    }
    if (tabName === 'nhachen') {
        generateRemindersInterface();
    }
    if (tabName === 'diary') {
        renderDiaryHistory();
        initDiaryDateTime();
    }
} // end function switchTab
// end ĐIỀU HƯỚNG TABS

// =========================================================================
// HÀM TIỆN ÍCH
// =========================================================================
function formatCurrency(input) {
    let value = input.value.replace(/[^0-9.]/g, "");
    let parts = value.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    input.value = parts.join(".");
} // end function formatCurrency

function parseCurrency(str) {
    return str ? parseFloat(str.replace(/,/g, "")) : 0;
} // end function parseCurrency

function formatVND(num) {
    return num.toLocaleString('en-US') + " đ";
} // end function formatVND

function updateSubtypes(mode) {
    const typeSelect = document.getElementById(`${mode}-type`);
    const subtypeSelect = document.getElementById(`${mode}-subtype`);
    if (!typeSelect || !subtypeSelect) return;

    const selectedType = typeSelect.value;
    subtypeSelect.innerHTML = "";

    if (CATEGORIES[mode] && CATEGORIES[mode][selectedType]) {
        CATEGORIES[mode][selectedType].forEach(sub => {
            let opt = document.createElement("option");
            opt.value = sub;
            opt.textContent = sub;
            subtypeSelect.appendChild(opt);
        });
    }

    // [HUB] Chi + Type = "Giáo dục" -> hiện thêm select Đối tượng (NHÍM/VOI), ghi vào cột F
    if (mode === 'chi') {
        const giaoDucGroup = document.getElementById('chi-giaoduc-target-group');
        if (giaoDucGroup) {
            giaoDucGroup.style.display = (selectedType === 'Giáo dục') ? 'block' : 'none';
        }
    }
} // end function updateSubtypes

function initFormOptions() {
    ['chi', 'thu'].forEach(mode => {
        const typeSelect = document.getElementById(`${mode}-type`);
        if (!typeSelect) return;

        typeSelect.innerHTML = "";
        Object.keys(CATEGORIES[mode]).forEach(type => {
            let opt = document.createElement("option");
            opt.value = type;
            opt.textContent = type;
            typeSelect.appendChild(opt);
        });
        updateSubtypes(mode);

        const now = getVietnamNow();
        const dateInput = document.getElementById(`${mode}-date`);
        if (dateInput) {
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
    });
    initReminderDateOptions();
    initColorSettings();
    initDiaryDateTime();
} // end function initFormOptions

function initColorSettings() {
    const sColor = document.getElementById("setting-color");
    if (!sColor || sColor.children.length > 0) return;

    const textNames = ["Xanh Lá", "Xanh Bơ", "Xanh Dương", "Hồng", "Tím", "Đỏ", "Cam", "Vàng"];
    PALETTE.forEach((hex, i) => {
        let opt = document.createElement("option");
        opt.value = hex;
        opt.textContent = textNames[i];
        sColor.appendChild(opt);
    });
} // end function initColorSettings

function toggleCustomReminderFields() {
    const freq = document.getElementById("rem-frequency").value;
    const customBox = document.getElementById("custom-reminder-fields");
    if (customBox) {
        customBox.style.display = (freq === "CUSTOM") ? "block" : "none";
    }
} // end function toggleCustomReminderFields

function initReminderDateOptions() {
    const dSel = document.getElementById("rem-day");
    const mSel = document.getElementById("rem-month");
    const ySel = document.getElementById("rem-year");
    if (!dSel || !mSel || !ySel) return;

    dSel.innerHTML = "";
    mSel.innerHTML = "";
    ySel.innerHTML = "";

    for (let i = 1; i <= 31; i++) {
        dSel.innerHTML += `<option value="${i}">${String(i).padStart(2,'0')}</option>`;
    }
    for (let i = 1; i <= 12; i++) {
        mSel.innerHTML += `<option value="${i}">Tháng ${String(i).padStart(2,'0')}</option>`;
    }

    const currYear = new Date().getFullYear();
    for (let i = currYear; i <= currYear + 5; i++) {
        ySel.innerHTML += `<option value="${i}">Năm ${i}</option>`;
    }

    const today = new Date();
    dSel.value = today.getDate();
    mSel.value = today.getMonth() + 1;
    ySel.value = today.getFullYear();
} // end function initReminderDateOptions
// end HÀM TIỆN ÍCH

// =========================================================================
// XỬ LÝ GIAO DỊCH (TRANSACTIONS) - TAB THU / CHI
// =========================================================================
function saveTransaction(event, mode) {
    event.preventDefault();
    
    console.log('💾 saveTransaction - mode:', mode);

    const type = document.getElementById(`${mode}-type`).value;
    const subtype = document.getElementById(`${mode}-subtype`).value;
    let amount = parseCurrency(document.getElementById(`${mode}-amount`).value);
    const dateVal = document.getElementById(`${mode}-date`).value;
    const note = document.getElementById(`${mode}-note`).value;

    // [HUB] Cột F (GHI CHÚ 2): "CON CỢP" nếu tick checkbox (ưu tiên cao nhất, áp dụng mọi Type);
    // nếu không tick và Type = "Giáo dục" thì ghi NHÍM/VOI từ select.
    let note2 = '';
    if (mode === 'chi') {
        const conCopCheckbox = document.getElementById('chi-concop-checkbox');
        if (conCopCheckbox && conCopCheckbox.checked) {
            note2 = 'CON CỢP';
        } else if (type === 'Giáo dục') {
            const targetSelect = document.getElementById('chi-giaoduc-target');
            if (targetSelect) note2 = targetSelect.value;
        }
    }

    console.log('📝 Dữ liệu nhập:', { type, subtype, amount, dateVal, note, note2 });

    if (mode === 'chi') amount = -Math.abs(amount);
    if (mode === 'thu') amount = Math.abs(amount);

    const formattedNote = toSentenceCase(note);

    let date;
    if (dateVal) {
        date = new Date(dateVal);
    } else {
        date = new Date();
    }
    
    const timestamp = formatVietnamDateTime(date);
    console.log('📅 Timestamp:', timestamp);

    const transaction = {
        timestamp: timestamp,
        type: type,
        subtype: subtype,
        amount: amount,
        note: formattedNote,
        note2: note2,
        synced: 0
    };

    console.log('💾 Transaction object:', transaction);

    const tx = db.transaction("transactions", "readwrite");
    const store = tx.objectStore("transactions");
    const request = store.add(transaction);
    
    request.onsuccess = function(e) {
        console.log('✅ Đã lưu vào IndexedDB với id:', e.target.result);
        alert("Đã lưu giao dịch cục bộ!");
        document.getElementById(`form-${mode}`).reset();
        initFormOptions();
        renderChartsAndStats();
        
        console.log('🔄 Gọi syncToGoogleSheets...');
        syncToGoogleSheets();
    };
    
    request.onerror = function(e) {
        console.error('❌ Lỗi lưu IndexedDB:', e.target.error);
        alert("Lỗi lưu giao dịch: " + e.target.error);
    };
} // end function saveTransaction

// =========================================================================
// LẤY TẤT CẢ GIAO DỊCH TỪ INDEXEDDB
// =========================================================================
function getAllTransactions(callback) {
    if (!db) {
        console.log('❌ getAllTransactions: Chưa có database');
        callback([]);
        return;
    }
    
    const tx = db.transaction("transactions", "readonly");
    const store = tx.objectStore("transactions");
    const request = store.getAll();
    
    request.onsuccess = function(e) {
        const result = e.target.result || [];
        console.log('📊 getAllTransactions: Lấy được', result.length, 'transactions');
        callback(result);
    };
    
    request.onerror = function(e) {
        console.error('❌ getAllTransactions: Lỗi đọc', e.target.error);
        callback([]);
    };
} // end function getAllTransactions

// =========================================================================
// ĐỒNG BỘ GIAO DỊCH LÊN GOOGLE SHEET
// =========================================================================
function syncToGoogleSheets() {
    console.log('🔍 syncToGoogleSheets - Bắt đầu');
    
    if (!navigator.onLine) {
        console.log('❌ Offline - không thể sync');
        return;
    }
    
    if (isSyncing) {
        console.log('⏳ Đang sync, bỏ qua');
        return;
    }
    
    if (!CONFIG.apiEndpoint) {
        console.log('❌ Không có API endpoint');
        return;
    }

    if (!db) {
        console.log('❌ Chưa có database');
        return;
    }

    const tx = db.transaction("transactions", "readonly");
    const store = tx.objectStore("transactions");
    const request = store.getAll();
    
    request.onsuccess = function(e) {
        const transactions = e.target.result || [];
        console.log('📊 Tổng transactions trong IndexedDB:', transactions.length);
        
        const unsynced = transactions.filter(t => t.synced === 0);
        console.log('📊 Số transactions chưa sync:', unsynced.length);
        
        if (unsynced.length === 0) {
            console.log('📭 Không có giao dịch chưa sync');
            return;
        }

        console.log('📤 Dữ liệu gửi lên:', JSON.stringify(unsynced, null, 2));

        isSyncing = true;
        
        fetch(CONFIG.apiEndpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'syncTransactions',
                data: unsynced.map(t => ({
                    timestamp: t.timestamp,
                    type: t.type,
                    subtype: t.subtype,
                    amount: t.amount,
                    note: t.note || '',
                    note2: t.note2 || '' // [HUB] Bị sót trước đây — cột F (GHI CHÚ 2) không lên được Sheet
                }))
            })
        })
        .then(res => {
            console.log('📥 Response status:', res.status);
            return res.json();
        })
        .then(resData => {
            console.log('📥 Response từ server:', resData);
            
            if (resData.status === "success") {
                console.log('✅ Sync thành công! Số giao dịch đã sync:', resData.count || unsynced.length);
                
                const tx2 = db.transaction("transactions", "readwrite");
                const store2 = tx2.objectStore("transactions");
                
                unsynced.forEach(t => {
                    t.synced = 1;
                    store2.put(t);
                });
                
                tx2.oncomplete = function() {
                    console.log('✅ Đã cập nhật trạng thái synced trong IndexedDB');
                    renderChartsAndStats();
                };
                
                tx2.onerror = function(e) {
                    console.error('❌ Lỗi cập nhật trạng thái synced:', e.target.error);
                };
            } else {
                console.log('❌ Sync thất bại:', resData.message);
            }
            
            isSyncing = false;
        })
        .catch(err => {
            console.error('❌ Lỗi fetch:', err);
            isSyncing = false;
        });
    };
    
    request.onerror = function(e) {
        console.error('❌ Lỗi đọc IndexedDB:', e.target.error);
        isSyncing = false;
    };
} // end function syncToGoogleSheets
// end XỬ LÝ GIAO DỊCH (TRANSACTIONS)

// =========================================================================
// ĐỒ THỊ & THỐNG KÊ - TAB CHI / THỐNG KÊ
// =========================================================================
function renderPieChart(canvasId, labels, dataset, customColors = null) {
    if (charts[canvasId]) {
        charts[canvasId].destroy();
        delete charts[canvasId];
    }

    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    let total = dataset.reduce((a, b) => a + Math.abs(b), 0);
    let defaultColors = ['#4CAF50', '#F44336', '#FF9800', '#2196F3', '#9C27B0', '#E91E63'];
    let colors = customColors || defaultColors;

    charts[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: dataset,
                backgroundColor: colors
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 13, weight: 'bold' },
                        padding: 12,
                        generateLabels: function(chart) {
                            const original = Chart.overrides.pie.plugins.legend.labels.generateLabels(chart);
                            const bgColors = chart.data.datasets[0].backgroundColor;
                            original.forEach((item, i) => {
                                item.fontColor = getReadableLegendColor(bgColors[i]);
                                item.strokeStyle = bgColors[i];
                            });
                            return original;
                        }
                    }
                },
                datalabels: {
                    color: function(ctx) {
                        let c = ctx.dataset.backgroundColor[ctx.dataIndex];
                        return (c === '#FFEB3B' || c === '#8BC34A') ? '#111111' : '#ffffff';
                    },
                    font: { weight: 'bold', size: 12 },
                    anchor: 'center',
                    align: 'center',
                    formatter: function(value) {
                        if (total > 0 && (Math.abs(value) / total * 100) > 3) {
                            return (Math.abs(value) / total * 100).toFixed(1) + "%";
                        }
                        return '';
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ctx.label + ": " + Math.abs(ctx.raw).toLocaleString() +
                                   " (" + (total > 0 ? (Math.abs(ctx.raw) / total * 100).toFixed(1) + "%" : "0%") + ")";
                        }
                    }
                }
            }
        }
    });
} // end function renderPieChart

// [HUB] Biến thể Donut của renderPieChart (dùng cho Section 5: Thống kê theo kỳ)
function renderDoughnutChart(canvasId, labels, dataset, customColors = null) {
    if (charts[canvasId]) {
        charts[canvasId].destroy();
        delete charts[canvasId];
    }

    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    let total = dataset.reduce((a, b) => a + Math.abs(b), 0);
    let defaultColors = ['#4CAF50', '#F44336', '#FF9800', '#2196F3', '#9C27B0', '#E91E63'];
    let colors = customColors || defaultColors;

    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataset,
                backgroundColor: colors
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 13, weight: 'bold' },
                        padding: 12,
                        generateLabels: function(chart) {
                            const original = Chart.overrides.pie.plugins.legend.labels.generateLabels(chart);
                            const bgColors = chart.data.datasets[0].backgroundColor;
                            original.forEach((item, i) => {
                                item.fontColor = getReadableLegendColor(bgColors[i]);
                                item.strokeStyle = bgColors[i];
                            });
                            return original;
                        }
                    }
                },
                datalabels: {
                    color: function(ctx) {
                        let c = ctx.dataset.backgroundColor[ctx.dataIndex];
                        return (c === '#FFEB3B' || c === '#8BC34A') ? '#111111' : '#ffffff';
                    },
                    font: { weight: 'bold', size: 12 },
                    anchor: 'center',
                    align: 'center',
                    formatter: function(value) {
                        if (total > 0 && (Math.abs(value) / total * 100) > 3) {
                            return (Math.abs(value) / total * 100).toFixed(1) + "%";
                        }
                        return '';
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ctx.label + ": " + Math.abs(ctx.raw).toLocaleString() +
                                   " (" + (total > 0 ? (Math.abs(ctx.raw) / total * 100).toFixed(1) + "%" : "0%") + ")";
                        }
                    }
                }
            }
        }
    });
} // end function renderDoughnutChart

// [HUB] Biểu đồ "Các khoản Chi hàng tháng" — xu hướng CẢ NĂM (12 tháng), 4 series màu
// Điện/Nước/Ăn sáng/Đi chợ Siêu thị nhóm cột cạnh nhau theo từng tháng (đúng theo ảnh mẫu).
// Luôn vẽ theo namThongKe đang chọn, không phụ thuộc thangThongKe (vì đây là view cả năm).
function computeMonthlyExpenseSeries(data, year) {
    const dien = new Array(12).fill(0);
    const nuoc = new Array(12).fill(0);
    const anSang = new Array(12).fill(0);
    const dicho = new Array(12).fill(0);

    data.forEach(t => {
        if (t.amount >= 0) return;
        const abs = Math.abs(t.amount);

        // Điện/Nước: dò theo Ghi chú "T{m}.{year}" (khoản trả sau)
        if (matchesCategory(t.subtype, 'Điện') || matchesCategory(t.subtype, 'Nước')) {
            const m = extractBillingMonthFromNote(t.note, year);
            if (m) {
                if (matchesCategory(t.subtype, 'Điện')) dien[m - 1] += abs; else nuoc[m - 1] += abs;
            }
            return;
        }

        // Ăn sáng / Đi chợ Siêu thị: dò theo Timestamp phát sinh thật
        if (!t.timestamp || t.timestamp.length < 7) return;
        const ty = parseInt(t.timestamp.substring(0, 4), 10);
        const tm = parseInt(t.timestamp.substring(5, 7), 10);
        if (ty !== year) return;
        if (matchesCategory(t.subtype, 'Ăn sáng')) anSang[tm - 1] += abs;
        if (matchesCategory(t.subtype, 'Đi chợ, Siêu thị')) dicho[tm - 1] += abs;
    });

    return { dien, nuoc, anSang, dicho };
} // end function computeMonthlyExpenseSeries

function renderMonthlyExpenseTrendChart(canvasId, year, series) {
    if (charts[canvasId]) {
        charts[canvasId].destroy();
        delete charts[canvasId];
    }

    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    const labels = Array.from({ length: 12 }, (_, i) => (i + 1) + '/' + year);

    charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Điện', data: series.dien, backgroundColor: '#4285F4', borderRadius: 3 },
                { label: 'Nước', data: series.nuoc, backgroundColor: '#EA4335', borderRadius: 3 },
                { label: 'Ăn sáng', data: series.anSang, backgroundColor: '#FBBC04', borderRadius: 3 },
                { label: 'Đi chợ, Siêu thị', data: series.dicho, backgroundColor: '#34A853', borderRadius: 3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { font: { size: 11 }, boxWidth: 12, padding: 10 }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) { return ctx.dataset.label + ': ' + formatVND(ctx.raw); }
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { font: { size: 9 } } },
                x: { ticks: { font: { size: 9 } } }
            }
        }
    });
} // end function renderMonthlyExpenseTrendChart

function getReadableLegendColor(hexColor) {
    return hexColor || (document.getElementById('module-finance').getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333333');
} // end function getReadableLegendColor

function renderChartsAndStats() {
    getAllTransactions(data => {
        let totalThu = 0, totalChi = 0;

        let sortedData = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        let expList = sortedData.filter(t => t.amount < 0).slice(0, 20);
        let incList = sortedData.filter(t => t.amount > 0).slice(0, 20);

        const expContainer = document.getElementById("expense-history-container");
        if (expList.length && expContainer) {
            let htmlChi = `<table class="history-table"><tbody>`;
            expList.forEach(t => {
                let dStr = new Date(t.timestamp).toLocaleDateString('vi-VN');
                let contentStr = `${t.subtype} ${t.note ? `<br><small style="opacity:0.7;"><i>📝 ${t.note}</i></small>` : ''}`;
                htmlChi += `<tr><td>${dStr}</td><td>${t.type}</td><td>${contentStr}</td><td class="amount-col" style="color:var(--danger-color);">${formatVND(Math.abs(t.amount))}</td></tr>`;
            });
            htmlChi += `</tbody></table>`;
            expContainer.innerHTML = htmlChi;
        } else if (expContainer) {
            expContainer.innerHTML = "Chưa có khoản chi nào.";
        }

        const incContainer = document.getElementById("income-history-container");
        if (incList.length && incContainer) {
            let htmlThu = `<table class="history-table"><tbody>`;
            incList.forEach(t => {
                let dStr = new Date(t.timestamp).toLocaleDateString('vi-VN');
                let contentStr = `${t.subtype} ${t.note ? `<br><small style="opacity:0.7;"><i>📝 ${t.note}</i></small>` : ''}`;
                htmlThu += `<tr><td>${dStr}</td><td>${t.type}</td><td>${contentStr}</td><td class="amount-col" style="color:var(--success-color);">${formatVND(t.amount)}</td></tr>`;
            });
            htmlThu += `</tbody></table>`;
            incContainer.innerHTML = htmlThu;
        } else if (incContainer) {
            incContainer.innerHTML = "Chưa có khoản thu nào.";
        }

        data.forEach(t => {
            const amt = t.amount;
            if (amt > 0) {
                totalThu += amt;
            } else {
                totalChi += Math.abs(amt);
            }
        });

        // [HUB] Section 1/2/3/4 (cảnh báo cũ, Tổng quan Thu-Chi, Tỉ lệ MÌNH/CON CỢP, Báo cáo
        // định kỳ) đã bị loại bỏ khỏi tab Thống kê — thay bằng Section 5 (bên dưới). Chỉ giữ
        // lại phần chart-chi-overview vì đó là widget riêng của TAB CHI, không thuộc Thống kê.
        renderPieChart('chart-chi-overview', ['Tổng Thu', 'Tổng Chi'], [totalThu, totalChi]);
        renderTopExpenses();

        updateSummaryTotals();
    });
} // end function renderChartsAndStats

// [HUB] So khớp Type/Subtype không phân biệt hoa-thường & khoảng trắng thừa — dữ liệu thật
// trong Sheet không luôn nhất quán casing (vd "Đi chợ, siêu thị" vs "Đi chợ, Siêu thị"),
// so sánh "===" trực tiếp trước đây làm sót giao dịch, tính thiếu tiền trong biểu đồ/so sánh.
function matchesCategory(value, target) {
    return (value || '').toString().trim().toLowerCase() === target.toLowerCase();
}

// [HUB] Chuỗi tiêu đề theo kỳ đang chọn — 2 kiểu định dạng khác nhau tùy chỗ dùng.
function tkPeriodSuffixDotted(month, year) {
    return month === 0 ? `năm ${year}` : `T${month}.${year}`;
}
function tkPeriodTitleUpper(prefix, month, year) {
    return month === 0 ? `${prefix} NĂM ${year}` : `${prefix} THÁNG ${month}/${year}`;
}

// =========================================================================
// [HUB] SECTION 5: THỐNG KÊ THEO KỲ (chọn Tháng/Năm tự do) — theo yêu cầu mới
// =========================================================================

// Gắn 1 lần duy nhất lúc module khởi tạo: đổ options Năm + gắn nút submit.
// [HUB] Mặc định chọn THÁNG HIỆN TẠI (không phải "None") để mở tab là thấy ngay
// so sánh tháng này với tháng trước.
function initThongKeFilters() {
    const namSelect = document.getElementById('tk-nam');
    const thangSelect = document.getElementById('tk-thang');
    if (!namSelect || !thangSelect) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const years = [currentYear - 2, currentYear - 1, currentYear];
    namSelect.innerHTML = years.map(y =>
        `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
    ).join('');
    thangSelect.value = String(currentMonth);

    const btn = document.getElementById('tk-submit-btn');
    if (btn) btn.addEventListener('click', runThongKeTheoKy);
} // end function initThongKeFilters

// Điện/Nước là khoản trả sau: tiền tháng N phát sinh và được GHI CHÚ vào tháng N+1,
// nên dò theo Ghi chú (dạng "T{tháng}.{năm}", ví dụ "T6.2026") thay vì theo Timestamp.
function noteMatchesBillingPeriod(note, month, year) {
    if (!note) return false;
    if (month === 0) {
        // Cả năm: khớp bất kỳ nhãn T1..T12 của năm được chọn
        const re = new RegExp('T(1[0-2]|[1-9])\\.' + year + '(?!\\d)');
        return re.test(note);
    }
    const target = 'T' + month + '.' + year;
    return note.indexOf(target) !== -1;
} // end function noteMatchesBillingPeriod

// Trích tháng ghi trong Ghi chú (dạng "T{m}.{year}") của 1 năm cụ thể — dùng để dựng biểu đồ
// xu hướng cả năm cho Điện/Nước (mỗi giao dịch chỉ khớp đúng 1 tháng duy nhất trong năm đó).
function extractBillingMonthFromNote(note, year) {
    if (!note) return null;
    const re = new RegExp('T(1[0-2]|[1-9])\\.' + year + '(?!\\d)');
    const m = note.match(re);
    return m ? parseInt(m[1], 10) : null;
} // end function extractBillingMonthFromNote

// Các khoản còn lại dò theo thời gian phát sinh thật (cột Timestamp, dạng "yyyy-mm-dd hh:mm").
function timestampInPeriod(timestamp, month, year) {
    if (!timestamp || timestamp.length < 7) return false;
    const y = parseInt(timestamp.substring(0, 4), 10);
    const m = parseInt(timestamp.substring(5, 7), 10);
    if (y !== year) return false;
    if (month === 0) return true; // thangThongKe = None -> cả năm
    return m === month;
} // end function timestampInPeriod

function runThongKeTheoKy() {
    const thangEl = document.getElementById('tk-thang');
    const namEl = document.getElementById('tk-nam');
    if (!thangEl || !namEl || !namEl.value) return;

    const month = parseInt(thangEl.value, 10) || 0; // 0 = None (cả năm)
    const year = parseInt(namEl.value, 10);
    const suffix = tkPeriodSuffixDotted(month, year);

    getAllTransactions(data => {
        // ---- b.i Donut "Tỉ lệ Đóng góp": CON CỢP vs MÌNH (trong các khoản Thu) ----
        // ---- b.ii Donut "Tỉ lệ Thu Chi": Tổng Thu vs Tổng Chi ----
        let sumTiger = 0, sumOther = 0, totalThu = 0, totalChi = 0;

        data.forEach(t => {
            const amt = t.amount;
            const inPeriodByTime = timestampInPeriod(t.timestamp, month, year);

            if (amt > 0 && inPeriodByTime) {
                totalThu += amt;
                if (matchesCategory(t.type, 'CON CỢP')) sumTiger += amt; else sumOther += amt;
            } else if (amt < 0 && inPeriodByTime) {
                totalChi += Math.abs(amt);
            }
        });

        const contribTitleEl = document.getElementById('tk-contrib-title');
        if (contribTitleEl) contribTitleEl.textContent = `Tỉ lệ Đóng góp ${suffix}`;
        document.getElementById('tk-contrib-other').textContent = formatVND(sumOther);
        document.getElementById('tk-contrib-tiger').textContent = formatVND(sumTiger);
        renderDoughnutChart('tk-chart-contribution', ['MÌNH', 'CON CỢP'], [sumOther, sumTiger], ['#8BC34A', '#E91E63']);

        const thuchiTitleEl = document.getElementById('tk-thuchi-title');
        if (thuchiTitleEl) thuchiTitleEl.textContent = `Tỉ lệ Thu Chi ${suffix}`;
        document.getElementById('tk-thuchi-thu').textContent = formatVND(totalThu);
        document.getElementById('tk-thuchi-chi').textContent = formatVND(totalChi);
        renderDoughnutChart('tk-chart-thuchi', ['Tổng Thu', 'Tổng Chi'], [totalThu, totalChi], ['#4CAF50', '#F44336']);

        // ---- Bảng chi tiết Thu nhập MÌNH vs CON CỢP theo Subtype ----
        const incomeTitleEl = document.getElementById('tk-income-table-title');
        if (incomeTitleEl) incomeTitleEl.textContent = tkPeriodTitleUpper('THU NHẬP', month, year);
        const incomeWrap = document.getElementById('tk-income-table-wrap');
        if (incomeWrap) incomeWrap.innerHTML = buildIncomeBreakdownTable(data, month, year);

        // ---- b.iii Bar "Các khoản Chi hàng tháng": xu hướng CẢ NĂM đang chọn ----
        const yearLabelEl = document.getElementById('tk-monthly-year-label');
        if (yearLabelEl) yearLabelEl.textContent = year;
        const series = computeMonthlyExpenseSeries(data, year);
        renderMonthlyExpenseTrendChart('tk-chart-monthly', year, series);

        // ---- c. So sánh Tháng trước vs Tháng này (luôn theo tháng THỰC TẾ, không phụ thuộc bộ lọc) ----
        renderThongKeComparison(data);

        // ---- Bảng Thống kê Giáo dục (NHÍM/VOI) theo Subtype ----
        const giaoducTitleEl = document.getElementById('tk-giaoduc-title');
        if (giaoducTitleEl) giaoducTitleEl.textContent = tkPeriodTitleUpper('TIỀN HỌC', month, year);
        const giaoducWrap = document.getElementById('tk-giaoduc-table-wrap');
        if (giaoducWrap) giaoducWrap.innerHTML = buildGiaoDucTable(data, month, year);

        // ---- Bảng Thống kê CON CỢP (đã trả cho sinh hoạt chung) theo Subtype ----
        const concopTitleEl = document.getElementById('tk-concop-title');
        if (concopTitleEl) concopTitleEl.textContent = `Thống kê CON CỢP ${suffix}`;
        const concopWrap = document.getElementById('tk-concop-table-wrap');
        if (concopWrap) concopWrap.innerHTML = buildConCopExpenseTable(data, month, year);
    });
} // end function runThongKeTheoKy

// [HUB] Bảng "Thu nhập MÌNH vs CON CỢP" — liệt kê TỪNG giao dịch, nhưng GỘP lại thành 1 dòng
// nếu Subtype + Note trùng nhau (vd Lương tháng T6.2026 của MÌNH và CON CỢP hiện chung 1 hàng).
// Màu chữ đồng nhất: MÌNH = xanh lá (#8BC34A), CON CỢP = hồng (#E91E63), khớp màu chart.
function buildIncomeBreakdownTable(data, month, year) {
    const txs = data.filter(t => t.amount > 0 && timestampInPeriod(t.timestamp, month, year))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (txs.length === 0) {
        return '<p style="opacity:0.7; font-size:12.5px;">Không có dữ liệu thu nhập trong kỳ này.</p>';
    }

    const grouped = [];
    const keyToIndex = {};
    let totalMine = 0, totalTiger = 0;

    txs.forEach(t => {
        const isTiger = matchesCategory(t.type, 'CON CỢP');
        if (isTiger) totalTiger += t.amount; else totalMine += t.amount;

        const key = (t.subtype || '') + '||' + (t.note || '');
        if (keyToIndex.hasOwnProperty(key)) {
            const g = grouped[keyToIndex[key]];
            if (isTiger) g.tiger += t.amount; else g.mine += t.amount;
        } else {
            keyToIndex[key] = grouped.length;
            grouped.push({
                subtype: t.subtype || '',
                mine: isTiger ? 0 : t.amount,
                tiger: isTiger ? t.amount : 0,
                note: t.note || ''
            });
        }
    });

    const bodyRows = grouped.map(g => `<tr>
        <td>${g.subtype}</td>
        <td class="tk-mine-col">${g.mine > 0 ? formatVND(g.mine) : ''}</td>
        <td class="tk-tiger-col">${g.tiger > 0 ? formatVND(g.tiger) : ''}</td>
        <td class="tk-note-col">${g.note}</td>
    </tr>`).join('');

    return `<div style="overflow-x:auto;"><table class="tk-compare-table tk-detail-table">
        <thead><tr><th>SUBTYPE</th><th class="tk-mine-col">MÌNH</th><th class="tk-tiger-col">CON CỢP</th><th>NOTE</th></tr></thead>
        <tbody>
            <tr class="tk-total-row"><td></td><td>${formatVND(totalMine)}</td><td>${formatVND(totalTiger)}</td><td></td></tr>
            ${bodyRows}
        </tbody>
    </table></div>`;
} // end function buildIncomeBreakdownTable

// [HUB] Bảng "Tiền học" NHÍM/VOI — liệt kê TỪNG giao dịch Chi có Type = "Giáo dục" (không gộp
// theo Subtype), dòng đầu là tổng cột tô nổi bật, mỗi dòng sau kèm Ghi chú gốc (cột E).
function buildGiaoDucTable(data, month, year) {
    const rows = data.filter(t => t.amount < 0 && matchesCategory(t.type, 'Giáo dục') && timestampInPeriod(t.timestamp, month, year))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (rows.length === 0) {
        return '<p style="opacity:0.7; font-size:12.5px;">Không có dữ liệu tiền học trong kỳ này.</p>';
    }

    let totalNhim = 0, totalVoi = 0;
    const bodyRows = rows.map(t => {
        const target = (t.note2 || '').toString().trim().toUpperCase();
        const abs = Math.abs(t.amount);
        const isNhim = target === 'NHÍM';
        const isVoi = target === 'VOI';
        if (isNhim) totalNhim += abs;
        if (isVoi) totalVoi += abs;
        return `<tr>
            <td>${t.subtype || ''}</td>
            <td>${isNhim ? formatVND(abs) : ''}</td>
            <td>${isVoi ? formatVND(abs) : ''}</td>
            <td class="tk-note-col">${t.note || ''}</td>
        </tr>`;
    }).join('');

    return `<div style="overflow-x:auto;"><table class="tk-compare-table tk-detail-table">
        <thead><tr><th>SUBTYPE</th><th>NHÍM</th><th>VOI</th><th>NOTE</th></tr></thead>
        <tbody>
            <tr class="tk-total-row"><td></td><td>${formatVND(totalNhim)}</td><td>${formatVND(totalVoi)}</td><td></td></tr>
            ${bodyRows}
        </tbody>
    </table></div>`;
} // end function buildGiaoDucTable

// [HUB] Bảng "Thống kê Chi cho con cái" — GIỐNG bảng Tiền học nhưng KHÔNG giới hạn Type =
// "Giáo dục" nữa, lấy MỌI khoản Chi (mọi Type/Subtype) miễn Ghi chú 2 (cột F) = NHÍM hoặc VOI.
function buildKidsExpenseTable(data, month, year) {
    const rows = data.filter(t => {
        if (t.amount >= 0 || !timestampInPeriod(t.timestamp, month, year)) return false;
        const target = (t.note2 || '').toString().trim().toUpperCase();
        return target === 'NHÍM' || target === 'VOI';
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (rows.length === 0) {
        return '<p style="opacity:0.7; font-size:12.5px;">Không có khoản chi nào cho NHÍM/VOI trong kỳ này.</p>';
    }

    let totalNhim = 0, totalVoi = 0;
    const bodyRows = rows.map(t => {
        const target = (t.note2 || '').toString().trim().toUpperCase();
        const abs = Math.abs(t.amount);
        const isNhim = target === 'NHÍM';
        const isVoi = target === 'VOI';
        if (isNhim) totalNhim += abs;
        if (isVoi) totalVoi += abs;
        return `<tr>
            <td>${t.subtype || ''}</td>
            <td>${isNhim ? formatVND(abs) : ''}</td>
            <td>${isVoi ? formatVND(abs) : ''}</td>
            <td class="tk-note-col">${t.note || ''}</td>
        </tr>`;
    }).join('');

    return `<div style="overflow-x:auto;"><table class="tk-compare-table tk-detail-table">
        <thead><tr><th>SUBTYPE</th><th>NHÍM</th><th>VOI</th><th>NOTE</th></tr></thead>
        <tbody>
            <tr class="tk-total-row"><td></td><td>${formatVND(totalNhim)}</td><td>${formatVND(totalVoi)}</td><td></td></tr>
            ${bodyRows}
        </tbody>
    </table></div>`;
} // end function buildKidsExpenseTable

// [HUB] TAB CON CÁI (độc lập, tách khỏi Thống kê) — bộ lọc + render riêng.
function initConCaiFilters() {
    const namSelect = document.getElementById('cc-nam');
    const thangSelect = document.getElementById('cc-thang');
    if (!namSelect || !thangSelect) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const years = [currentYear - 2, currentYear - 1, currentYear];
    namSelect.innerHTML = years.map(y =>
        `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
    ).join('');
    thangSelect.value = String(currentMonth);

    const btn = document.getElementById('cc-submit-btn');
    if (btn) btn.addEventListener('click', runConCaiTheoKy);
} // end function initConCaiFilters

function runConCaiTheoKy() {
    const thangEl = document.getElementById('cc-thang');
    const namEl = document.getElementById('cc-nam');
    if (!thangEl || !namEl || !namEl.value) return;

    const month = parseInt(thangEl.value, 10) || 0; // 0 = None (cả năm)
    const year = parseInt(namEl.value, 10);

    getAllTransactions(data => {
        const titleEl = document.getElementById('cc-kids-title');
        if (titleEl) titleEl.textContent = tkPeriodTitleUpper('CHI CHO CON CÁI', month, year);
        const wrap = document.getElementById('cc-kids-table-wrap');
        if (wrap) wrap.innerHTML = buildKidsExpenseTable(data, month, year);
    });
} // end function runConCaiTheoKy

// [HUB] Bảng "Thống kê CON CỢP" — tổng các khoản Chi có cột F (GHI CHÚ 2) = "CON CỢP",
// group theo Subtype, kèm dòng tổng ở trên cùng.
function buildConCopExpenseTable(data, month, year) {
    const subtypeMap = {};
    data.forEach(t => {
        if (t.amount >= 0 || !timestampInPeriod(t.timestamp, month, year)) return;
        const target = (t.note2 || '').toString().trim().toUpperCase();
        if (target !== 'CON CỢP') return;
        const sub = (t.subtype || '(Không có)').trim();
        subtypeMap[sub] = (subtypeMap[sub] || 0) + Math.abs(t.amount);
    });

    const subtypes = Object.keys(subtypeMap);
    if (subtypes.length === 0) {
        return '<p style="opacity:0.7; font-size:12.5px;">Không có khoản chi nào được đánh dấu CON CỢP trong kỳ này.</p>';
    }

    let total = 0;
    subtypes.forEach(s => { total += subtypeMap[s]; });

    const rows = subtypes.map(s => `
        <tr><td>${s}</td><td>${formatVND(subtypeMap[s])}</td></tr>`).join('');

    return `<table class="tk-compare-table">
        <thead><tr><th>Subtype</th><th>Số tiền</th></tr></thead>
        <tbody>
            <tr style="font-weight:bold;"><td></td><td>${formatVND(total)}</td></tr>
            ${rows}
        </tbody>
    </table>`;
} // end function buildConCopExpenseTable

// [HUB] Luôn so sánh THÁNG THỰC TẾ hiện tại với tháng liền trước — KHÔNG phụ thuộc bộ lọc
// Tháng/Năm phía trên (đó là bộ lọc cho các phần khác của trang, riêng phần này cố định).
function renderThongKeComparison(data) {
    const container = document.getElementById('tk-comparison-results');
    if (!container) return;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) { prevMonth = 12; prevYear = year - 1; }

    // 5 hạng mục theo đúng yêu cầu — "Mua sắm & Cá nhân" là cả 1 Type (tổng mọi subtype con).
    const categories = [
        { label: 'Điện', match: t => matchesCategory(t.subtype, 'Điện'), byNote: true },
        { label: 'Nước', match: t => matchesCategory(t.subtype, 'Nước'), byNote: true },
        { label: 'Ăn sáng', match: t => matchesCategory(t.subtype, 'Ăn sáng'), byNote: false },
        { label: 'Đi chợ, Siêu thị', match: t => matchesCategory(t.subtype, 'Đi chợ, Siêu thị'), byNote: false },
        { label: 'Mua sắm & Cá nhân', match: t => matchesCategory(t.type, 'Mua sắm & Cá nhân'), byNote: false }
    ];

    const rows = [];
    let hasAlert = false;

    categories.forEach(cat => {
        let curSum = 0, prevSum = 0;
        data.forEach(t => {
            if (t.amount >= 0 || !cat.match(t)) return;
            const abs = Math.abs(t.amount);
            if (cat.byNote) {
                if (noteMatchesBillingPeriod(t.note, month, year)) curSum += abs;
                if (noteMatchesBillingPeriod(t.note, prevMonth, prevYear)) prevSum += abs;
            } else {
                if (timestampInPeriod(t.timestamp, month, year)) curSum += abs;
                if (timestampInPeriod(t.timestamp, prevMonth, prevYear)) prevSum += abs;
            }
        });

        // [HUB] Tháng này = 0đ thì bỏ qua hẳn — không liệt kê, không tính -100%.
        if (curSum === 0) return;

        const pctChange = prevSum > 0 ? ((curSum - prevSum) / prevSum * 100) : 100;
        const isOver30 = prevSum > 0 && pctChange > 30;
        if (isOver30) hasAlert = true;

        rows.push({ label: cat.label, curSum, prevSum, pctChange, isOver30 });
    });

    if (rows.length === 0) {
        container.innerHTML = '<p style="opacity:0.7; font-size:12.5px;">Chưa có khoản chi nào trong tháng này để so sánh.</p>';
        return;
    }

    const alertHtml = hasAlert
        ? '<div class="alert-box" style="margin-bottom:10px;">⚠️ Có hạng mục chi vượt 30% so với tháng trước!</div>'
        : '<p style="color:green; font-size:12.5px; margin-bottom:10px;">An toàn! Không có hạng mục nào vượt 30% so với tháng trước.</p>';

    const tableRows = rows.map(r => {
        const pctSign = r.pctChange >= 0 ? '+' : '';
        const pctStr = r.prevSum > 0 ? `${pctSign}${r.pctChange.toFixed(1)}%` : '—';
        const isSafeIncrease = !r.isOver30 && r.pctChange > 0;
        const rowClass = r.isOver30 ? ' class="tk-over-30"' : '';
        const pctCellClass = isSafeIncrease ? ' class="tk-safe-increase"' : '';
        const labelHtml = r.isOver30 ? `${r.label} ⚠️` : r.label;

        return `<tr${rowClass}>
            <td>${labelHtml}</td>
            <td>${formatVND(r.curSum)}</td>
            <td>${formatVND(r.prevSum)}</td>
            <td${pctCellClass}>${pctStr}</td>
        </tr>`;
    }).join('');

    container.innerHTML = alertHtml + `
        <table class="tk-compare-table">
            <thead>
                <tr><th></th><th>Tháng ${month}/${year}</th><th>Tháng ${prevMonth}/${prevYear}</th><th>%</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>`;
} // end function renderThongKeComparison

function renderTopExpenses() {
    const periodSelect = document.getElementById("chi-top-period");
    if (!periodSelect) return;

    const period = periodSelect.value;
    const now = new Date();

    getAllTransactions(data => {
        let filtered = data.filter(t => t.amount < 0).filter(t => {
            let d = new Date(t.timestamp);
            if (period === 'week') {
                return (now - d) <= 7 * 24 * 60 * 60 * 1000;
            }
            if (period === 'month') {
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }
            if (period === 'year') {
                return d.getFullYear() === now.getFullYear();
            }
            return true;
        });

        let groupedData = {};
        filtered.forEach(t => {
            let groupKey = `${t.type} (${t.subtype})`;
            if (!groupedData[groupKey]) groupedData[groupKey] = 0;
            groupedData[groupKey] += Math.abs(t.amount);
        });

        let sortedGroups = Object.keys(groupedData).map(key => {
            return { category: key, totalAmount: groupedData[key] };
        }).sort((a, b) => b.totalAmount - a.totalAmount);

        const container = document.getElementById("top-expenses-list");
        if (!container) return;

        if (sortedGroups.length === 0) {
            container.innerHTML = "<p>Không có dữ liệu chi tiêu.</p>";
            return;
        }

        let html = '';
        sortedGroups.slice(0, 5).forEach((g, i) => {
            let parts = g.category.match(/^(.*?)\s*\((.*?)\)$/);
            let type = parts ? parts[1] : g.category;
            let subtype = parts ? parts[2] : '--';

            html += `<div class="stat-row" style="display: grid; grid-template-columns: 30px 1fr 1fr 100px; gap: 8px; padding: 10px 4px; align-items: center;">
                <span style="font-weight: bold; color: var(--text-color); opacity: 0.5;">${i+1}</span>
                <span style="font-weight: 600; color: var(--theme-color);">${type}</span>
                <span style="color: var(--text-color); opacity: 0.7; font-size: 0.9rem;">${subtype}</span>
                <span style="font-weight: bold; color: var(--danger-color); text-align: right;">${formatVND(g.totalAmount)}</span>
            </div>`;
        });
        container.innerHTML = html;
    });
} // end function renderTopExpenses

// [HUB] renderSection4() đã bị xóa cùng Section 4 (gộp chức năng vào Section 5 bên dưới).
// end ĐỒ THỊ & THỐNG KÊ

// =========================================================================
// FAMILY - BẢO MẬT & HIỂN THỊ - TAB FAMILY
// =========================================================================
function checkFamilyTabAccess() {
    const isUnlocked = localStorage.getItem("family_unlocked") === "true";
    const authView = document.getElementById("family-auth-view");
    const mainView = document.getElementById("family-main-view");

    if (!authView || !mainView) return;

    if (isUnlocked) {
        authView.style.display = "none";
        mainView.style.display = "block";
        generateFamilyInterface();
    } else {
        authView.style.display = "block";
        mainView.style.display = "none";
    }
} // end function checkFamilyTabAccess

function verifyFamilyAuth() {
    const inputPass = document.getElementById("family-password").value;
    if (!inputPass.trim()) {
        alert("Vui lòng nhập mật khẩu!");
        return;
    }

    fetch(`${CONFIG.apiEndpoint}?action=checkResetPassword&password=${encodeURIComponent(inputPass.trim())}`)
        .then(res => res.json())
        .then(res => {
            if (res.status === "success" && res.match === true) {
                localStorage.setItem("family_unlocked", "true");
                checkFamilyTabAccess();
            } else {
                alert("Mật khẩu không khớp!");
            }
        })
        .catch(() => {
            alert("Không thể kết nối xác thực!");
        });
} // end function verifyFamilyAuth

function generateFamilyInterface() {
    const container = document.getElementById("family-buttons-container");
    if (!container) return;

    if (localFamilyData && localFamilyData.length > 0) {
        renderFamilyGrid(localFamilyData);
        return;
    }

    container.innerHTML = "<p style='color: #aaa; text-align: center;'>🔄 Đang tải dữ liệu...</p>";
    fetch(`${CONFIG.apiEndpoint}?action=getFamilyData`)
        .then(res => res.json())
        .then(res => {
            if (res.status === "success" && res.data) {
                localFamilyData = res.data;
                if (db) {
                    db.transaction("settings", "readwrite")
                      .objectStore("settings")
                      .put({ key: "family_data", value: res.data });
                }
                renderFamilyGrid(res.data);
            } else {
                container.innerHTML = "<p style='color: #aaa; text-align: center;'>📭 Chưa có dữ liệu.</p>";
            }
        })
        .catch(() => {
            container.innerHTML = "<p style='color: #f44336; text-align: center;'>❌ Lỗi kết nối!</p>";
        });
} // end function generateFamilyInterface

function renderFamilyGrid(members) {
    const container = document.getElementById("family-buttons-container");
    if (!container) return;

    container.innerHTML = "";

    let validMembers = 0;
    members.forEach(m => {
        const displayName = m.nickname && m.nickname !== "-" ? m.nickname : (m.fullname || "Thành viên");
        if (displayName.toUpperCase() === "NICKNAME") return;

        validMembers++;
        let btn = document.createElement("button");
        btn.className = "member-btn";
        btn.textContent = displayName;
        btn.onclick = () => showFamilyModal(m);
        container.appendChild(btn);
    });

    const totalFamilyEl = document.getElementById('app-total-family');
    if (totalFamilyEl) {
        totalFamilyEl.textContent = validMembers;
    }
} // end function renderFamilyGrid

function showFamilyModal(m) {
    const sanitizePhoneForTel = (val) => {
        if (!val || val === "-") return "";
        return String(val).replace(/[^\d+]/g, "");
    };

    const fields = [
        { l: "Biệt danh", v: m.nickname || "-" },
        { l: "Họ tên", v: m.fullname || "-" },
        { l: "Ngày sinh", v: formatDisplayDateDMY(m.dob) },
        { l: "Nơi sinh", v: m.noisinh || "-" },
        { l: "Địa chỉ", v: m.diachi || "-" },
        { l: "Điện thoại", v: m.dienthoai || "-", isPhone: true },
        { l: "CCCD: Số", v: m.cccd?.so || "-" },
        { l: "CCCD: Ngày cấp", v: formatDisplayDateDMY(m.cccd?.ngaycap) },
        { l: "CCCD: Ngày hết hạn", v: formatDisplayDateDMY(m.cccd?.ngayhethan) },
        { l: "CCCD: Nơi cấp", v: m.cccd?.noicap || "-" },
        { l: "Hộ chiếu: Số", v: m.hochieu?.so || "-" },
        { l: "Hộ chiếu: Ngày cấp", v: formatDisplayDateDMY(m.hochieu?.ngaycap) },
        { l: "Hộ chiếu: Ngày hết hạn", v: formatDisplayDateDMY(m.hochieu?.ngayhethan) },
        { l: "Hộ chiếu: Nơi cấp", v: m.hochieu?.noicap || "-" },
        { l: "Thẻ BHYT", v: m.bhyt || "-" },
        { l: "Mã số BHXH", v: m.bhxh || "-" },
        { l: "Mã số thuế", v: m.masothue || "-" },
        { l: "LLTP: Số", v: m.lltp?.so || "-" },
        { l: "LLTP: Ngày cấp", v: formatDisplayDateDMY(m.lltp?.ngaycap) },
        { l: "LLTP: Nơi cấp", v: m.lltp?.noicap || "-" }
    ];

    const detailsDiv = document.getElementById("modal-member-details");
    if (!detailsDiv) return;

    detailsDiv.innerHTML = "";
    let fullBlockText = "";
    let lastGroup = "";

    fields.forEach(f => {
        fullBlockText += `${f.l}: ${f.v}\n`;
        let currentGroup = "";
        let cleanLabel = f.l;

        if (f.l.startsWith("CCCD:")) {
            currentGroup = "CCCD";
            cleanLabel = f.l.replace("CCCD:", "").trim();
        } else if (f.l.startsWith("Hộ chiếu:")) {
            currentGroup = "Hộ chiếu";
            cleanLabel = f.l.replace("Hộ chiếu:", "").trim();
        } else if (f.l.startsWith("LLTP:")) {
            currentGroup = "Lí lịch tư pháp";
            cleanLabel = f.l.replace("LLTP:", "").trim();
        }

        if (currentGroup && currentGroup !== lastGroup) {
            let groupHeader = document.createElement("div");
            groupHeader.style = "margin-top:18px; margin-bottom:4px; padding:6px 8px; font-size:1.1rem; font-weight:bold; color:var(--theme-color); border-bottom:1px dashed var(--border-color);";
            groupHeader.textContent = currentGroup;
            detailsDiv.appendChild(groupHeader);
            lastGroup = currentGroup;
        }

        let row = document.createElement("div");
        row.className = "info-row";

        const telNumber = f.isPhone ? sanitizePhoneForTel(f.v) : "";
        const callBtnHtml = telNumber
            ? `<a href="tel:${telNumber}" class="btn-call-phone" title="Gọi ${f.v}" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;margin-left:8px;border-radius:50%;background:var(--theme-color);color:#000;text-decoration:none;font-size:0.9rem;vertical-align:middle;">📞</a>`
            : "";

        if (currentGroup) {
            row.innerHTML = `<div class="info-label" style="padding-left:15px; font-size:0.9rem;">- ${cleanLabel}</div><div class="info-value" style="padding-left:25px; font-weight:500;">${f.v}${callBtnHtml}</div>`;
        } else {
            if (!currentGroup) lastGroup = "";
            row.innerHTML = `<div class="info-label">${f.l}</div><div class="info-value">${f.v}${callBtnHtml}</div>`;
        }

        if (telNumber) {
            const callBtn = row.querySelector(".btn-call-phone");
            if (callBtn) {
                callBtn.onclick = (e) => {
                    e.stopPropagation();
                };
            }
        }

        row.onclick = () => {
            if (f.v !== "-") {
                navigator.clipboard.writeText(f.v).then(() => {
                    alert(`Đã copy: ${f.v}`);
                }).catch(() => {
                    const textArea = document.createElement('textarea');
                    textArea.value = f.v;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert(`Đã copy: ${f.v}`);
                });
            }
        };
        detailsDiv.appendChild(row);
    });

    document.getElementById("btn-copy-all").onclick = () => {
        navigator.clipboard.writeText(fullBlockText).then(() => {
            alert("Đã copy toàn bộ thông tin lí lịch!");
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = fullBlockText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert("Đã copy toàn bộ thông tin lí lịch!");
        });
    };

    const modal = document.getElementById("familyModal");
    if (modal) {
        modal.style.display = "flex";
    }
} // end function showFamilyModal

function closeModal() {
    const modal = document.getElementById("familyModal");
    if (modal) {
        modal.style.display = "none";
    }
} // end function closeModal
// end FAMILY - BẢO MẬT & HIỂN THỊ

// =========================================================================
// NHẮC HẸN - TAB NHẮC HẸN
// =========================================================================
const VALID_REMINDER_FREQUENCIES = ["ONCE", "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"];

function cleanupCorruptedReminders(callback) {
    if (!db || !db.objectStoreNames.contains("reminders")) {
        if (callback) callback();
        return;
    }

    const tx = db.transaction("reminders", "readwrite");
    const store = tx.objectStore("reminders");
    const request = store.getAll();

    request.onsuccess = function(e) {
        const list = e.target.result || [];
        let removedCount = 0;

        list.forEach(r => {
            if (isCorruptedReminder(r)) {
                store.delete(r.id);
                removedCount++;
            }
        });

        tx.oncomplete = function() {
            if (removedCount > 0) {
                console.log(`Đã tự động xóa ${removedCount} reminder bị hỏng.`);
            }
            if (callback) callback();
        };
        tx.onerror = function() {
            if (callback) callback();
        };
    };

    request.onerror = function(e) {
        console.error("Lỗi đọc reminders khi dọn dẹp:", e.target.error);
        if (callback) callback();
    };
} // end function cleanupCorruptedReminders

function isCorruptedReminder(r) {
    if (!r || typeof r !== 'object') return true;
    if (!r.content || typeof r.content !== 'string' || !r.content.trim()) return true;
    if (!VALID_REMINDER_FREQUENCIES.includes(r.frequency)) return true;
    if (!isValidDateOnlyString(r.startDate)) return true;
    if (r.nextReminderDate && !isValidDateOnlyString(r.nextReminderDate)) return true;
    return false;
} // end function isCorruptedReminder

function isValidDateOnlyString(str) {
    if (!str || typeof str !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const d = new Date(str);
    return !isNaN(d.getTime());
} // end function isValidDateOnlyString

function computeNextReminderDate(fromDateStr, frequency, everyValue, everyUnit) {
    const d = new Date(fromDateStr);
    d.setHours(0, 0, 0, 0);

    if (frequency === "DAILY") {
        d.setDate(d.getDate() + 1);
    } else if (frequency === "WEEKLY") {
        d.setDate(d.getDate() + 7);
    } else if (frequency === "MONTHLY") {
        d.setMonth(d.getMonth() + 1);
    } else if (frequency === "CUSTOM") {
        const n = parseInt(everyValue) || 1;
        if (everyUnit === "DAYS") d.setDate(d.getDate() + n);
        else if (everyUnit === "WEEKS") d.setDate(d.getDate() + (n * 7));
        else if (everyUnit === "MONTHS") d.setMonth(d.getMonth() + n);
    } else {
        return null;
    }

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
} // end function computeNextReminderDate

function saveReminder(event) {
    event.preventDefault();

    const content = document.getElementById("rem-content").value.trim();
    const day = document.getElementById("rem-day").value;
    const month = document.getElementById("rem-month").value;
    const year = document.getElementById("rem-year").value;
    const frequency = document.getElementById("rem-frequency").value;
    const everyVal = document.getElementById("rem-every-val").value;
    const everyUnit = document.getElementById("rem-every-unit").value;

    if (!content) {
        alert("Vui lòng nhập nội dung nhắc hẹn!");
        return;
    }

    if (frequency === "CUSTOM" && (!everyVal || parseInt(everyVal) < 1)) {
        alert("Vui lòng nhập số lượng hợp lệ cho tần suất tùy chỉnh!");
        return;
    }

    const formattedContent = toSentenceCase(content);
    const startDateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    const reminderItem = {
        content: formattedContent,
        startDate: startDateStr,
        frequency: frequency,
        everyValue: frequency === "CUSTOM" ? parseInt(everyVal) : null,
        everyUnit: frequency === "CUSTOM" ? everyUnit : null,
        nextReminderDate: startDateStr,
        lastTriggeredAt: "",
        synced: 0,
        status: "ENABLED"
    };

    console.log("Lưu reminder:", reminderItem);

    const tx = db.transaction("reminders", "readwrite");
    const store = tx.objectStore("reminders");
    const request = store.add(reminderItem);

    request.onsuccess = function(e) {
        console.log("Reminder đã lưu với id:", e.target.result);
        alert("Đã thêm nhắc hẹn cục bộ!");
        document.getElementById("form-nhachen").reset();
        toggleCustomReminderFields();
        initReminderDateOptions();
        generateRemindersInterface();
        syncRemindersToSheet();
    };

    request.onerror = function(e) {
        console.error("Lỗi lưu reminder:", e.target.error);
        alert("Lỗi lưu nhắc hẹn: " + e.target.error);
    };
} // end function saveReminder

function generateRemindersInterface() {
    const container = document.getElementById("reminder-list-container");
    if (!container) return;

    if (!db) {
        container.innerHTML = "Lỗi cơ sở dữ liệu.";
        return;
    }

    const tx = db.transaction("reminders", "readonly");
    const store = tx.objectStore("reminders");
    const request = store.getAll();

    request.onsuccess = function(e) {
        const list = e.target.result || [];
        localReminderData = list;
        renderRemindersList(list);
        checkAndTriggerReminders(list);
    };
    request.onerror = function(e) {
        container.innerHTML = "Lỗi đọc dữ liệu nhắc hẹn.";
        console.error("Lỗi đọc reminders:", e.target.error);
    };
} // end function generateRemindersInterface

function renderRemindersList(list) {
    const container = document.getElementById("reminder-list-container");
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = "<p style='color: #aaa; text-align: center;'>📭 Chưa có lịch nhắc hẹn nào.</p>";
        return;
    }

    const sortedList = [...list].sort((a, b) => {
        const aDate = a.nextReminderDate || a.startDate;
        const bDate = b.nextReminderDate || b.startDate;
        if (aDate < bDate) return -1;
        if (aDate > bDate) return 1;
        return 0;
    });

    // [HUB] Chỉ hiển thị 20 lịch nhắc gần nhất
    const totalCount = sortedList.length;
    const limitedList = sortedList.slice(0, 20);

    let html = `<table class="history-table"><thead><tr><th>Nội dung</th><th>Ngày nhắc tiếp theo</th><th>Tần suất</th><th>Trạng thái</th></tr></thead><tbody>`;

    limitedList.forEach(r => {
        let freqText = formatFrequencyLabel(r);

        let displayDateSource = r.nextReminderDate || r.startDate;
        let displayDate = formatDisplayDateDMY(displayDateSource);

        let statusColor = r.status === "ENABLED" ? "var(--success-color)" : "var(--danger-color)";
        let statusText = r.status === "ENABLED" ? "✅ Hoạt động" : "⛔ Tắt";

        const today = new Date();
        today.setHours(0,0,0,0);
        const remDate = new Date(displayDateSource);
        remDate.setHours(0,0,0,0);
        let isPast = remDate < today && r.frequency === "ONCE";

        html += `<tr style="${isPast ? 'opacity:0.5;' : ''}">
            <td style="font-weight:600; color:var(--theme-color);">${r.content}</td>
            <td>${displayDate} ${isPast ? '<span style="color:#999;font-size:0.8rem;">(đã qua)</span>' : ''}</td>
            <td><small class="theme-bg" style="padding:2px 6px; border-radius:4px; font-size:0.75rem;">${freqText}</small></td>
            <td style="color:${statusColor}; font-size:0.85rem;">${statusText}</td>
        </tr>`;
    });
    html += `</tbody></table>`;
    if (totalCount > 20) {
        html += `<p style="text-align: center; color: var(--stat-label-color); font-size: 0.8rem;">Hiển thị 20/ ${totalCount} lịch nhắc</p>`;
    }
    container.innerHTML = html;
} // end function renderRemindersList

function formatFrequencyLabel(r) {
    const freqMap = {
        'ONCE': 'Một lần',
        'DAILY': 'Hàng ngày',
        'WEEKLY': 'Hàng tuần',
        'MONTHLY': 'Hàng tháng'
    };
    if (r.frequency === "CUSTOM") {
        const unitMap = { 'DAYS': 'Ngày', 'WEEKS': 'Tuần', 'MONTHS': 'Tháng' };
        const unitText = unitMap[r.everyUnit] || r.everyUnit || '';
        return `Mỗi ${r.everyValue || 1} ${unitText}`;
    }
    return freqMap[r.frequency] || r.frequency || "ONCE";
} // end function formatFrequencyLabel

function checkAndTriggerReminders(reminders) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = formatDateOnly(today);
    const tomorrowStr = formatDateOnly(tomorrow);

    let hasChanges = false;

    reminders.forEach(r => {
        if (r.status === "DISABLED") return;

        const targetDateStr = r.nextReminderDate || r.startDate;
        if (!targetDateStr) return;

        const targetDate = new Date(targetDateStr);
        targetDate.setHours(0,0,0,0);

        if (r.frequency === "ONCE" && targetDate < today) return;

        const alreadyTriggeredToday = r.lastTriggeredAt && r.lastTriggeredAt.slice(0, 10) === todayStr;

        if (targetDateStr === tomorrowStr) {
            triggerPushNotification("🔔 NHẮC TRƯỚC 1 NGÀY", `Ngày mai bạn có hẹn: ${r.content}`);
        }

        if (targetDateStr === todayStr && !alreadyTriggeredToday) {
            triggerPushNotification("⏰ HÔM NAY CÓ HẸN", r.content);

            r.lastTriggeredAt = new Date().toISOString();
            r.synced = 0;
            hasChanges = true;

            if (r.frequency === "ONCE") {
                r.status = "DISABLED";
            } else {
                const nextDate = computeNextReminderDate(todayStr, r.frequency, r.everyValue, r.everyUnit);
                if (nextDate) r.nextReminderDate = nextDate;
            }

            updateReminderInDB(r);
        }
    });

    if (hasChanges) {
        renderRemindersList(reminders);
    }
} // end function checkAndTriggerReminders

function updateReminderInDB(reminderItem) {
    if (!db || !reminderItem.id) return;
    const tx = db.transaction("reminders", "readwrite");
    tx.objectStore("reminders").put(reminderItem);
    tx.oncomplete = function() {
        syncRemindersToSheet();
    };
} // end function updateReminderInDB

function startDailyReminderCheck() {
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
    }

    notificationCheckInterval = setInterval(() => {
        if (db) {
            const tx = db.transaction("reminders", "readonly");
            const store = tx.objectStore("reminders");
            const request = store.getAll();
            request.onsuccess = function(e) {
                const list = e.target.result || [];
                checkAndTriggerReminders(list);
            };
        }
    }, 30 * 60 * 1000);

    setTimeout(() => {
        generateRemindersInterface();
    }, 3000);
} // end function startDailyReminderCheck
// end NHẮC HẸN

// =========================================================================
// ĐỒNG BỘ NHẮC HẸN LÊN GOOGLE SHEET (REMINDERS)
// =========================================================================
function syncRemindersToSheet() {
    if (!navigator.onLine || !CONFIG.apiEndpoint) {
        console.log("Không thể sync: offline hoặc không có endpoint");
        return;
    }

    if (!db) {
        console.log("Chưa có database");
        return;
    }

    const tx = db.transaction("reminders", "readonly");
    const store = tx.objectStore("reminders");
    const request = store.getAll();

    request.onsuccess = function(e) {
        const list = e.target.result || [];
        const unsynced = list.filter(r => r.synced === 0);

        console.log("Số lượng reminder chưa sync:", unsynced.length);

        if (unsynced.length === 0) return;

        const dataToSend = unsynced.map(r => ({
            content: r.content || "",
            frequency: encodeFrequencyForSheet(r),
            startDate: r.startDate || "",
            status: r.status || "ENABLED",
            nextReminderDate: r.nextReminderDate || r.startDate || "",
            lastTriggeredAt: r.lastTriggeredAt || ""
        }));

        console.log("Dữ liệu gửi lên server:", JSON.stringify(dataToSend));

        fetch(CONFIG.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'syncReminders',
                data: dataToSend
            })
        })
        .then(res => {
            console.log("Response status:", res.status);
            return res.json();
        })
        .then(resData => {
            console.log("Response data:", resData);
            if (resData.status === "success") {
                const tx2 = db.transaction("reminders", "readwrite");
                const store2 = tx2.objectStore("reminders");
                unsynced.forEach(r => {
                    r.synced = 1;
                    store2.put(r);
                });
                console.log("Đã đánh dấu reminders đã sync");
            } else {
                console.error("Lỗi sync reminders:", resData.message);
            }
        })
        .catch(err => {
            console.error("Lỗi fetch syncReminders:", err);
        });
    };

    request.onerror = function(e) {
        console.error("Lỗi đọc reminders từ IndexedDB:", e.target.error);
    };
} // end function syncRemindersToSheet

function encodeFrequencyForSheet(r) {
    if (r.frequency === "CUSTOM") {
        return `CUSTOM:${r.everyValue || 1}:${r.everyUnit || 'DAYS'}`;
    }
    return r.frequency || "ONCE";
} // end function encodeFrequencyForSheet

function decodeFrequencyFromSheet(rawFrequency) {
    if (rawFrequency && rawFrequency.toString().startsWith("CUSTOM:")) {
        const parts = rawFrequency.toString().split(":");
        return {
            frequency: "CUSTOM",
            everyValue: parseInt(parts[1]) || 1,
            everyUnit: parts[2] || "DAYS"
        };
    }
    return { frequency: rawFrequency || "ONCE", everyValue: null, everyUnit: null };
} // end function decodeFrequencyFromSheet
// end ĐỒNG BỘ NHẮC HẸN LÊN GOOGLE SHEET

// =========================================================================
// NHẬT KÍ - TAB DIARY
// =========================================================================

function formatDiaryDateTime(date) {
    if (!date) return '';
    
    let d;
    if (typeof date === 'string') {
        d = new Date(date);
    } else {
        d = new Date(date);
    }
    
    if (isNaN(d.getTime())) {
        console.log('⚠️ formatDiaryDateTime: Invalid date');
        return '';
    }
    
    const offset = d.getTimezoneOffset();
    const vietnamTime = new Date(d.getTime() + (offset + 420) * 60000);
    
    const day = String(vietnamTime.getDate()).padStart(2, '0');
    const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
    const year = vietnamTime.getFullYear();
    const hours = String(vietnamTime.getHours()).padStart(2, '0');
    const minutes = String(vietnamTime.getMinutes()).padStart(2, '0');
    const seconds = String(vietnamTime.getSeconds()).padStart(2, '0');
    
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
} // end function formatDiaryDateTime

function getDiaryEntries(callback) {
    if (!db) {
        console.log('❌ getDiaryEntries: Chưa có database');
        callback([]);
        return;
    }
    
    const tx = db.transaction("diary", "readonly");
    const store = tx.objectStore("diary");
    const request = store.getAll();
    
    request.onsuccess = function(e) {
        const result = e.target.result || [];
        console.log('📊 getDiaryEntries: Lấy được', result.length, 'entries');
        callback(result);
    };
    
    request.onerror = function(e) {
        console.error('❌ getDiaryEntries: Lỗi đọc', e.target.error);
        callback([]);
    };
} // end function getDiaryEntries

// Lưu chỉ health check (không lưu diary)
function saveHealthOnly() {
    console.log('💾 saveHealthOnly - Bắt đầu');
    
    // Lấy giá trị từ form
    let datetimeVal = document.getElementById('diary-datetime').value;
    const weight = parseFloat(document.getElementById('diary-weight').value.replace(',', '.'));
    const bloodPressure = document.getElementById('diary-blood-pressure').value.trim();
    const heartRate = parseInt(document.getElementById('diary-heart-rate').value);
    const dau = document.getElementById('diary-dau').checked;
    
    // Kiểm tra có dữ liệu health không
    if (isNaN(weight) && !bloodPressure && isNaN(heartRate) && !dau) {
        alert('Vui lòng nhập ít nhất một thông tin health (cân nặng, huyết áp, nhịp tim hoặc dâu)!');
        return;
    }
    
    // Validate
    if (!isNaN(weight) && (weight <= 0 || weight > 300)) {
        alert('Vui lòng nhập cân nặng hợp lệ (0-300 kg)!');
        return;
    }
    
    if (bloodPressure && !/^\d{2,3}\/\d{2}$/.test(bloodPressure)) {
        alert('Huyết áp không đúng định dạng! Vui lòng nhập theo dạng ###/## (ví dụ: 120/80)');
        return;
    }
    
    if (!isNaN(heartRate) && (heartRate < 30 || heartRate > 200)) {
        alert('Vui lòng nhập nhịp tim hợp lệ (30-200 bpm)!');
        return;
    }
    
    // Xử lý datetime
    let date;
    if (datetimeVal) {
        date = new Date(datetimeVal);
    } else {
        date = new Date();
    }
    
    // Format datetime cho health: dd/mm/yyyy hh:mm
    const healthDateTime = formatHealthDateTime(date);
    console.log('📅 Health Datetime:', healthDateTime);
    
    // Kiểm tra db
    if (!db) {
        console.error('❌ Database chưa được khởi tạo');
        alert('Lỗi: Database chưa sẵn sàng. Vui lòng tải lại trang!');
        return;
    }
    
    // Kiểm tra object store health
    if (!db.objectStoreNames.contains("health")) {
        console.error('❌ Health store not found in database');
        alert('Lỗi: Object store health không tồn tại. Vui lòng tải lại trang!');
        return;
    }
    
    const healthEntry = {
        datetime: healthDateTime,
        weight: isNaN(weight) ? null : weight,
        bloodPressure: bloodPressure || '',
        heartRate: heartRate || 0,
        dau: dau || false,
        nextDauPrediction: '',
        synced: 0,
        diaryId: null
    };
    
    console.log('💾 Health entry:', healthEntry);
    
    const tx = db.transaction("health", "readwrite");
    const store = tx.objectStore("health");
    const request = store.add(healthEntry);
    
    request.onsuccess = function(e) {
        console.log('✅ Đã lưu health check vào IndexedDB với id:', e.target.result);
        alert("Đã lưu health check cục bộ!");
        // Reset chỉ các field health
        document.getElementById('diary-weight').value = '';
        document.getElementById('diary-blood-pressure').value = '';
        document.getElementById('diary-heart-rate').value = '';
        document.getElementById('diary-dau').checked = false;
        syncHealthToSheet();
    };
    
    request.onerror = function(e) {
        console.error('❌ Lỗi lưu health check:', e.target.error);
        alert("Lỗi lưu health check: " + e.target.error);
    };
} // end function saveHealthOnly

// Đồng bộ health check lên Google Sheet
function syncHealthToSheet() {
    console.log('🔍 syncHealthToSheet - Bắt đầu');
    
    if (!navigator.onLine) {
        console.log('❌ Offline - không thể sync health');
        return;
    }
    
    if (!CONFIG.apiEndpoint) {
        console.log('❌ Không có API endpoint');
        return;
    }
    
    if (!db) {
        console.log('❌ Chưa có database');
        return;
    }
    
    const tx = db.transaction("health", "readonly");
    const store = tx.objectStore("health");
    const request = store.getAll();
    
    request.onsuccess = function(e) {
        const entries = e.target.result || [];
        const unsynced = entries.filter(t => t.synced === 0);
        console.log('📊 Số health check chưa sync:', unsynced.length);
        
        if (unsynced.length === 0) {
            console.log('📭 Không có health check chưa sync');
            return;
        }
        
        // Log dữ liệu để debug
        console.log('📤 Dữ liệu health gửi lên:', JSON.stringify(unsynced, null, 2));
        
        fetch(CONFIG.apiEndpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'syncHealth',
                data: unsynced.map(t => ({
                    datetime: t.datetime,
                    weight: (t.weight === null || t.weight === undefined || isNaN(t.weight)) ? '' : t.weight,
                    bloodPressure: t.bloodPressure,
                    heartRate: t.heartRate,
                    dau: t.dau,
                    nextDauPrediction: t.nextDauPrediction || ''
                }))
            })
        })
        .then(res => {
            console.log('📥 Response status:', res.status);
            return res.json();
        })
        .then(resData => {
            console.log('📥 Response từ server:', resData);
            
            if (resData.status === "success") {
                console.log('✅ Sync health thành công!');
                
                const tx2 = db.transaction("health", "readwrite");
                const store2 = tx2.objectStore("health");
                
                unsynced.forEach(t => {
                    t.synced = 1;
                    store2.put(t);
                });
                
                tx2.oncomplete = function() {
                    console.log('✅ Đã cập nhật trạng thái synced cho health');
                };
            } else {
                console.log('❌ Sync health thất bại:', resData.message);
            }
        })
        .catch(err => {
            console.error('❌ Lỗi fetch health:', err);
        });
    };
    
    request.onerror = function(e) {
        console.error('❌ Lỗi đọc IndexedDB health:', e.target.error);
    };
} // end function syncHealthToSheet

// Lưu nhật kí vào IndexedDB và sync lên sheet
function saveDiaryEntry(event) {
    event.preventDefault();
    
    console.log('💾 saveDiaryEntry - Bắt đầu');
    
    // Lấy giá trị từ form
    let datetimeVal = document.getElementById('diary-datetime').value;
    const placeSelect = document.getElementById('diary-place');
    const place = placeSelect.value;
    let detail = document.getElementById('diary-detail').value.trim();
    
    // Lấy giá trị Health Check
    const weight = parseFloat(document.getElementById('diary-weight').value.replace(',', '.'));
    const bloodPressure = document.getElementById('diary-blood-pressure').value.trim();
    const heartRate = parseInt(document.getElementById('diary-heart-rate').value);
    const dau = document.getElementById('diary-dau').checked;
    
    // Xử lý Custom place
    let finalPlace = place;
    if (place === 'Custom') {
        const customPlace = document.getElementById('diary-custom-place').value.trim();
        if (!customPlace) {
            alert('Vui lòng nhập địa điểm!');
            return;
        }
        finalPlace = customPlace;
    }
    
    // Xử lý datetime
    let date;
    if (datetimeVal) {
        date = new Date(datetimeVal);
    } else {
        date = new Date();
    }
    
    // Format datetime cho diary: dd-mm-yyyy HH:mm:ss
    const formattedDateTime = formatDiaryDateTime(date);
    console.log('📅 Datetime:', formattedDateTime);
    
    // Kiểm tra có dữ liệu health không
    const hasHealthData = !isNaN(weight) || bloodPressure || !isNaN(heartRate) || dau;
    
    // Validate health nếu có dữ liệu
    if (hasHealthData) {
        // Validate cân nặng (nếu có nhập)
        if (!isNaN(weight) && (weight <= 0 || weight > 300)) {
            alert('Vui lòng nhập cân nặng hợp lệ (0-300 kg)!');
            return;
        }
        
        // Validate huyết áp format ###/## (nếu có nhập)
        if (bloodPressure && !/^\d{2,3}\/\d{2}$/.test(bloodPressure)) {
            alert('Huyết áp không đúng định dạng! Vui lòng nhập theo dạng ###/## (ví dụ: 120/80)');
            return;
        }
        
        // Validate nhịp tim (nếu có nhập)
        if (!isNaN(heartRate) && (heartRate < 30 || heartRate > 200)) {
            alert('Vui lòng nhập nhịp tim hợp lệ (30-200 bpm)!');
            return;
        }
    }
    
    // Tạo diary entry
    const diaryEntry = {
        datetime: formattedDateTime,
        place: finalPlace,
        detail: detail || '',
        // Lưu health data vào diary để hiển thị (nếu có)
        weight: isNaN(weight) ? null : weight,
        bloodPressure: bloodPressure || '',
        heartRate: heartRate || 0,
        dau: dau || false,
        synced: 0
    };
    
    console.log('💾 Diary entry:', diaryEntry);
    
    // Kiểm tra db
    if (!db) {
        console.error('❌ Database chưa được khởi tạo');
        alert('Lỗi: Database chưa sẵn sàng. Vui lòng tải lại trang!');
        return;
    }
    
    // LƯU DIARY
    const tx1 = db.transaction("diary", "readwrite");
    const diaryStore = tx1.objectStore("diary");
    const diaryRequest = diaryStore.add(diaryEntry);
    
    diaryRequest.onsuccess = function(e) {
        const diaryId = e.target.result;
        console.log('✅ Đã lưu diary vào IndexedDB với id:', diaryId);
        
        // CHỈ LƯU HEALTH KHI CÓ DỮ LIỆU HEALTH (cân nặng, huyết áp, nhịp tim hoặc dâu)
        if (hasHealthData) {
            const healthDateTime = formatHealthDateTime(date);
            
            const healthEntry = {
                datetime: healthDateTime,
                weight: isNaN(weight) ? null : weight,
                bloodPressure: bloodPressure || '',
                heartRate: heartRate || 0,
                dau: dau || false,
                nextDauPrediction: '',
                synced: 0,
                diaryId: diaryId
            };
            
            console.log('💾 Health entry (từ diary):', healthEntry);
            
            // Lưu vào health store
            const tx2 = db.transaction("health", "readwrite");
            const healthStore = tx2.objectStore("health");
            const healthRequest = healthStore.add(healthEntry);
            
            healthRequest.onsuccess = function() {
                console.log('✅ Đã lưu health check vào IndexedDB');
            };
            
            healthRequest.onerror = function(e) {
                console.error('❌ Lỗi lưu health check:', e.target.error);
            };
            
            tx2.oncomplete = function() {
                console.log('✅ Health transaction completed');
                syncHealthToSheet();
            };
            
            tx2.onerror = function(e) {
                console.error('❌ Health transaction error:', e.target.error);
            };
        } else {
            console.log('ℹ️ Không có dữ liệu health, bỏ qua lưu health check');
        }
        
        tx1.oncomplete = function() {
            console.log('✅ Diary transaction completed');
            alert("Đã lưu nhật kí cục bộ!");
            document.getElementById('form-diary').reset();
            document.getElementById('diary-custom-place-group').style.display = 'none';
            renderDiaryHistory();
            syncDiaryToSheet();
        };
    };
    
    diaryRequest.onerror = function(e) {
        console.error('❌ Lỗi lưu diary:', e.target.error);
        alert("Lỗi lưu nhật kí: " + e.target.error);
    };
} // end function saveDiaryEntry

// Hiển thị lịch sử nhật kí
function renderDiaryHistory() {
    const container = document.getElementById('diary-history-container');
    if (!container) return;
    
    getDiaryEntries(entries => {
        if (entries.length === 0) {
            container.innerHTML = '<p style="color: #aaa; text-align: center;">📭 Chưa có nhật kí nào.</p>';
            return;
        }
        
        // Sắp xếp theo datetime mới nhất trước
        const sorted = [...entries].sort((a, b) => {
            const aDate = a.datetime.split(' ')[0].split('-').reverse().join('-') + ' ' + (a.datetime.split(' ')[1] || '');
            const bDate = b.datetime.split(' ')[0].split('-').reverse().join('-') + ' ' + (b.datetime.split(' ')[1] || '');
            return bDate.localeCompare(aDate);
        });
        
        let html = `<table class="history-table"><thead><tr>
            <th>Ngày giờ</th>
            <th>Địa điểm</th>
            <th>Chi tiết</th>
            <th>🩺 Health</th>
        </tr></thead><tbody>`;
        
        sorted.slice(0, 20).forEach(entry => {  // [HUB] 20 bản ghi gần nhất (trước là 50)
            // Tạo health info nếu có
            let healthInfo = '';
            if (entry.weight || entry.bloodPressure || entry.heartRate || entry.dau !== undefined) {
                const dauText = entry.dau ? '✅' : '';
                healthInfo = `<span style="font-size:0.75rem; color:var(--stat-label-color);">
                    ${entry.weight ? '⚖️' + entry.weight + 'kg' : ''}
                    ${entry.bloodPressure ? ' 🩸' + entry.bloodPressure : ''}
                    ${entry.heartRate ? ' 💓' + entry.heartRate : ''}
                    ${dauText ? ' 🌸' + dauText : ''}
                </span>`;
            }
            
            html += `<tr>
                <td style="white-space: nowrap; font-size: 0.85rem;">${entry.datetime}</td>
                <td><span style="font-weight: 500; color: var(--theme-color);">${entry.place}</span></td>
                <td>${entry.detail || ''}</td>
                <td>${healthInfo}</td>
            </tr>`;
        });
        
        html += `</tbody></table>`;
        if (sorted.length > 20) {
            html += `<p style="text-align: center; color: var(--stat-label-color); font-size: 0.8rem;">Hiển thị 20/ ${sorted.length} bản ghi</p>`;
        }
        container.innerHTML = html;
    });
} // end function renderDiaryHistory

// Format datetime cho health: dd/mm/yyyy hh:mm (24h)
function formatHealthDateTime(date) {
    if (!date) return '';
    
    let d;
    if (typeof date === 'string') {
        d = new Date(date);
    } else {
        d = new Date(date);
    }
    
    if (isNaN(d.getTime())) {
        console.log('⚠️ formatHealthDateTime: Invalid date');
        return '';
    }
    
    // Điều chỉnh về GMT+7
    const offset = d.getTimezoneOffset();
    const vietnamTime = new Date(d.getTime() + (offset + 420) * 60000);
    
    const day = String(vietnamTime.getDate()).padStart(2, '0');
    const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
    const year = vietnamTime.getFullYear();
    const hours = String(vietnamTime.getHours()).padStart(2, '0');
    const minutes = String(vietnamTime.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
} // end function formatHealthDateTime

// Thêm vào setupEventListeners() hoặc sau khi DOM load
function setupBloodPressureMask() {
    const bpInput = document.getElementById('diary-blood-pressure');
    if (!bpInput) return;
    
    bpInput.addEventListener('input', function(e) {
        // Chỉ cho phép số và dấu /
        let value = this.value.replace(/[^0-9/]/g, '');
        
        // Giới hạn độ dài
        if (value.length > 7) {
            value = value.slice(0, 7);
        }
        
        // Tự động thêm dấu / sau 3 số
        if (value.length === 3 && !value.includes('/')) {
            value = value + '/';
        }
        
        // Nếu đã có / thì chỉ cho phép 2 số sau /
        if (value.includes('/')) {
            const parts = value.split('/');
            if (parts[0].length > 3) {
                parts[0] = parts[0].slice(0, 3);
            }
            if (parts[1] && parts[1].length > 2) {
                parts[1] = parts[1].slice(0, 2);
            }
            value = parts.join('/');
        }
        
        this.value = value;
    });
    
    // Xử lý paste
    bpInput.addEventListener('paste', function(e) {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const clean = pasted.replace(/[^0-9/]/g, '');
        if (clean) {
            // Tự động format
            let value = clean;
            if (value.length >= 3 && !value.includes('/')) {
                value = value.slice(0, 3) + '/' + value.slice(3);
            }
            this.value = value.slice(0, 7);
        }
    });
} // end function setupBloodPressureMask

function syncDiaryToSheet() {
    console.log('🔍 syncDiaryToSheet - Bắt đầu');
    
    if (!navigator.onLine) {
        console.log('❌ Offline - không thể sync diary');
        return;
    }
    
    if (!CONFIG.apiEndpoint) {
        console.log('❌ Không có API endpoint');
        return;
    }
    
    if (!db) {
        console.log('❌ Chưa có database');
        return;
    }
    
    const tx = db.transaction("diary", "readonly");
    const store = tx.objectStore("diary");
    const request = store.getAll();
    
    request.onsuccess = function(e) {
        const entries = e.target.result || [];
        const unsynced = entries.filter(t => t.synced === 0);
        console.log('📊 Số nhật kí chưa sync:', unsynced.length);
        
        if (unsynced.length === 0) {
            console.log('📭 Không có nhật kí chưa sync');
            return;
        }
        
        fetch(CONFIG.apiEndpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'syncDiary',
                data: unsynced.map(t => ({
                    datetime: t.datetime,
                    place: t.place,
                    detail: t.detail
                }))
            })
        })
        .then(res => {
            console.log('📥 Response status:', res.status);
            return res.json();
        })
        .then(resData => {
            console.log('📥 Response từ server:', resData);
            
            if (resData.status === "success") {
                console.log('✅ Sync diary thành công!');
                
                const tx2 = db.transaction("diary", "readwrite");
                const store2 = tx2.objectStore("diary");
                
                unsynced.forEach(t => {
                    t.synced = 1;
                    store2.put(t);
                });
                
                tx2.oncomplete = function() {
                    console.log('✅ Đã cập nhật trạng thái synced cho diary');
                };
            } else {
                console.log('❌ Sync diary thất bại:', resData.message);
            }
        })
        .catch(err => {
            console.error('❌ Lỗi fetch diary:', err);
        });
    };
    
    request.onerror = function(e) {
        console.error('❌ Lỗi đọc IndexedDB diary:', e.target.error);
    };
} // end function syncDiaryToSheet

function setupDiaryPlaceToggle() {
    const placeSelect = document.getElementById('diary-place');
    const customGroup = document.getElementById('diary-custom-place-group');
    
    if (placeSelect && customGroup) {
        placeSelect.addEventListener('change', function() {
            if (this.value === 'Custom') {
                customGroup.style.display = 'block';
            } else {
                customGroup.style.display = 'none';
            }
        });
    }
} // end function setupDiaryPlaceToggle

function initDiaryDateTime() {
    const now = getVietnamNow();
    const datetimeInput = document.getElementById('diary-datetime');
    if (datetimeInput) {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        datetimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
} // end function initDiaryDateTime
// end NHẬT KÍ

// =========================================================================
// CÀI ĐẶT GIAO DIỆN (THEMES) - TAB SETTINGS
// =========================================================================
function toggleDarkMode(enable) {
    document.getElementById('module-finance').setAttribute('data-theme', enable ? 'dark' : 'light');
    localStorage.setItem('darkMode', enable ? 'true' : 'false');

    const colorInput = document.getElementById("setting-color");
    if (colorInput) {
        const slider = document.querySelector('.slider');
        if (slider) {
            slider.style.backgroundColor = enable ? colorInput.value : '#ccc';
        }
    }
} // end function toggleDarkMode

function applyTheme(overrideColor) {
    const themeColor = overrideColor || document.getElementById("setting-color")?.value || DEFAULT_THEME_COLOR;
    const root = document.getElementById('module-finance');
    root.style.setProperty('--theme-color', themeColor.toLowerCase());
    root.classList.toggle("theme-yellow", /yellow|#ffc107|#ffeb3b/i.test(themeColor));

    let r = parseInt(themeColor.slice(1,3), 16);
    let g = parseInt(themeColor.slice(3,5), 16);
    let b = parseInt(themeColor.slice(5,7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    root.style.setProperty('--text-on-theme', brightness > 150 ? '#111111' : '#ffffff');

    localStorage.setItem('themeColor', themeColor);
} // end function applyTheme

function loadTheme() {
    const savedDark = localStorage.getItem('darkMode');
    const isDark = savedDark !== null ? savedDark === 'true' : DEFAULT_DARK_MODE;

    document.getElementById('module-finance').setAttribute('data-theme', isDark ? 'dark' : 'light');
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.checked = isDark;

    let savedColor = localStorage.getItem('themeColor') || DEFAULT_THEME_COLOR;
    const colorSelect = document.getElementById("setting-color");
    if (colorSelect) {
        colorSelect.value = savedColor;
    }
    applyTheme();
} // end function loadTheme
// end CÀI ĐẶT GIAO DIỆN (THEMES)

// =========================================================================
// ĐỒNG BỘ TOÀN DIỆN - TAB SETTINGS
// =========================================================================
function syncAllDataFromSheet() {
    if (!navigator.onLine) {
        alert("Thiết bị đang ngoại tuyến! Vui lòng kết nối mạng để đồng bộ.");
        return;
    }

    const syncBtn = document.getElementById("btn-sync-data");
    const originalText = syncBtn.innerHTML;
    syncBtn.disabled = true;
    syncBtn.innerHTML = "⏳ Đang đồng bộ...";
    syncBtn.style.opacity = "0.7";

    getAllTransactions(localTransactions => {
        const pushTransactions = () => new Promise(resolve => {
            const unsyncedTx = localTransactions.filter(t => t.synced === 0);
            if (unsyncedTx.length === 0 || !CONFIG.apiEndpoint) {
                resolve();
                return;
            }
            fetch(CONFIG.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'syncTransactions',
                    data: unsyncedTx.map(t => ({
                        timestamp: t.timestamp,
                        type: t.type,
                        subtype: t.subtype,
                        amount: t.amount,
                        note: t.note,
                        note2: t.note2 || '' // [HUB] Bị sót trước đây — cột F (GHI CHÚ 2) không lên được Sheet
                    }))
                })
            })
            .then(res => res.json())
            .then(resData => {
                if (resData.status === "success") {
                    const tx = db.transaction("transactions", "readwrite");
                    const store = tx.objectStore("transactions");
                    unsyncedTx.forEach(t => {
                        t.synced = 1;
                        store.put(t);
                    });
                }
                resolve();
            })
            .catch(() => resolve());
        });

        const pushReminders = () => new Promise(resolve => {
            const tx = db.transaction("reminders", "readonly");
            const store = tx.objectStore("reminders");
            const req = store.getAll();
            req.onsuccess = function(e) {
                const list = e.target.result || [];
                const unsyncedRem = list.filter(r => r.synced === 0);
                if (unsyncedRem.length === 0 || !CONFIG.apiEndpoint) {
                    resolve();
                    return;
                }
                fetch(CONFIG.apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'syncReminders',
                        data: unsyncedRem.map(r => ({
                            content: r.content || "",
                            frequency: encodeFrequencyForSheet(r),
                            startDate: r.startDate || "",
                            status: r.status || "ENABLED",
                            nextReminderDate: r.nextReminderDate || r.startDate || "",
                            lastTriggeredAt: r.lastTriggeredAt || ""
                        }))
                    })
                })
                .then(res => res.json())
                .then(resData => {
                    if (resData.status === "success") {
                        const tx2 = db.transaction("reminders", "readwrite");
                        const store2 = tx2.objectStore("reminders");
                        unsyncedRem.forEach(r => {
                            r.synced = 1;
                            store2.put(r);
                        });
                    }
                    resolve();
                })
                .catch(() => resolve());
            };
            req.onerror = () => resolve();
        });

        const pushDiary = () => new Promise(resolve => {
            if (!db) {
                resolve();
                return;
            }
            const tx = db.transaction("diary", "readonly");
            const store = tx.objectStore("diary");
            const req = store.getAll();
            req.onsuccess = function(e) {
                const list = e.target.result || [];
                const unsyncedDiary = list.filter(r => r.synced === 0);
                console.log('📊 Số diary chưa sync:', unsyncedDiary.length);
                
                if (unsyncedDiary.length === 0 || !CONFIG.apiEndpoint) {
                    resolve();
                    return;
                }
                fetch(CONFIG.apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'syncDiary',
                        data: unsyncedDiary.map(r => ({
                            datetime: r.datetime || "",
                            place: r.place || "",
                            detail: r.detail || ""
                        }))
                    })
                })
                .then(res => res.json())
                .then(resData => {
                    if (resData.status === "success") {
                        const tx2 = db.transaction("diary", "readwrite");
                        const store2 = tx2.objectStore("diary");
                        unsyncedDiary.forEach(r => {
                            r.synced = 1;
                            store2.put(r);
                        });
                        console.log('✅ Đã đánh dấu diary đã sync');
                    }
                    resolve();
                })
                .catch(() => resolve());
            };
            req.onerror = () => resolve();
        });

        const downloadData = () => {
            fetch(`${CONFIG.apiEndpoint}?action=getAllAppData`)
                .then(res => res.json())
                .then(resData => {
                    if (resData.status === "success" && resData.data) {
                        const serverFamily = resData.data.family || [];
                        const serverTransactions = resData.data.transactions || [];
                        const serverReminders = resData.data.reminders || [];
                        const serverDiary = resData.data.diary || [];

                        localFamilyData = serverFamily;
                        if (db) {
                            db.transaction("settings", "readwrite")
                              .objectStore("settings")
                              .put({ key: "family_data", value: serverFamily });
                        }

                        if (db && serverTransactions.length > 0) {
                            const tx = db.transaction("transactions", "readwrite");
                            const store = tx.objectStore("transactions");
                            serverTransactions.forEach(sTx => {
                                const isDuplicate = localTransactions.some(lTx =>
                                    normalizeTimestampForCompare(lTx.timestamp) === normalizeTimestampForCompare(sTx.timestamp) &&
                                    parseFloat(lTx.amount) === parseFloat(sTx.amount) &&
                                    lTx.subtype === sTx.subtype
                                );
                                if (!isDuplicate) {
                                    sTx.synced = 1;
                                    store.add(sTx);
                                }
                            });
                        }

                        if (db && serverReminders.length > 0) {
                            const tx = db.transaction("reminders", "readwrite");
                            const store = tx.objectStore("reminders");

                            const getExisting = store.getAll();
                            getExisting.onsuccess = function(e) {
                                const existingList = e.target.result || [];

                                serverReminders.forEach(sRem => {
                                    const isDuplicate = existingList.some(lRem =>
                                        normalizeTimestampForCompare(lRem.startDate) === normalizeTimestampForCompare(sRem.startDate) &&
                                        lRem.content === sRem.content
                                    );
                                    if (!isDuplicate) {
                                        const decoded = decodeFrequencyFromSheet(sRem.frequency);
                                        store.add({
                                            content: sRem.content,
                                            startDate: sRem.startDate,
                                            frequency: decoded.frequency,
                                            everyValue: decoded.everyValue,
                                            everyUnit: decoded.everyUnit,
                                            status: sRem.status || "ENABLED",
                                            nextReminderDate: sRem.nextReminderDate || sRem.startDate,
                                            lastTriggeredAt: sRem.lastTriggeredAt || "",
                                            synced: 1
                                        });
                                    }
                                });
                            };
                        }

                        if (db && serverDiary.length > 0) {
                            const tx = db.transaction("diary", "readwrite");
                            const store = tx.objectStore("diary");

                            const getExisting = store.getAll();
                            getExisting.onsuccess = function(e) {
                                const existingList = e.target.result || [];
                                let addedCount = 0;

                                serverDiary.forEach(sDiary => {
                                    const isDuplicate = existingList.some(lDiary =>
                                        lDiary.datetime === sDiary.datetime &&
                                        lDiary.place === sDiary.place
                                    );
                                    if (!isDuplicate) {
                                        store.add({
                                            datetime: sDiary.datetime,
                                            place: sDiary.place,
                                            detail: sDiary.detail || "",
                                            synced: 1
                                        });
                                        addedCount++;
                                    }
                                });
                                
                                if (addedCount > 0) {
                                    console.log('✅ Đã thêm ' + addedCount + ' diary entries từ server');
                                }
                            };
                        }

                        updateLastSyncTime();

                        const now = new Date();
                        const timeString = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        const statusEl = document.getElementById("sync-status");
                        if (statusEl) statusEl.innerHTML = `Last sync: ${timeString}`;
                        if (db) {
                            db.transaction("settings", "readwrite")
                              .objectStore("settings")
                              .put({ key: "last_sync_time", value: timeString });
                        }

                        alert("✅ Đồng bộ thành công!");
                    } else {
                        alert("⚠️ Đồng bộ xong nhưng định dạng dữ liệu không đúng.");
                    }
                })
                .catch(err => {
                    console.error("Sync error:", err);
                    alert("❌ Lỗi kết nối! Không thể tải dữ liệu từ Google Sheet xuống.");
                })
                .finally(() => {
                    syncBtn.disabled = false;
                    syncBtn.innerHTML = originalText;
                    syncBtn.style.opacity = "1";
                    initFormOptions();
                    renderChartsAndStats();
                    generateRemindersInterface();
                    renderDiaryHistory();
                    updateAppInfo();
                    updateSummaryTotals();
                });
        };

        Promise.all([pushTransactions(), pushReminders(), pushDiary()]).then(downloadData);
    });
} // end function syncAllDataFromSheet
// end ĐỒNG BỘ TOÀN DIỆN

// =========================================================================
// RESET APP - TAB SETTINGS
// =========================================================================
function resetAppCompletely() {
    if (!confirm("⚠️ Bạn có chắc chắn muốn xóa toàn bộ lịch sử thiết bị không?\nHành động này không thể hoàn tác!")) return;

    let mask = document.createElement('div');
    mask.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;justify-content:center;align-items:center;";

    let box = document.createElement('div');
    box.className = "card";
    box.style = "width:90%;max-width:320px;padding:20px;text-align:center;background:#1e1e1e;color:#e0e0e0;border-radius:14px;";
    box.innerHTML = `
        <h3 style="margin-top:0;color:#f44336;">🔒 Xác Thực Xóa App</h3>
        <p style="font-size:13px;opacity:0.8;">Vui lòng nhập mật khẩu xác nhận định danh:</p>
        <input type="password" id="secure-reset-pass" style="text-align:center;margin-bottom:15px;width:100%;padding:10px;border-radius:8px;border:1px solid #444;background:#0d0d0d;color:#e0e0e0;" placeholder="••••••••">
        <div style="display:flex;gap:10px;">
            <button id="btn-cancel-reset" style="background:#555;color:#fff;flex:1;border:none;border-radius:8px;padding:10px;cursor:pointer;">Hủy</button>
            <button id="btn-confirm-reset" style="background:#f44336;color:#fff;flex:1;border:none;border-radius:8px;padding:10px;cursor:pointer;">Xóa Sạch</button>
        </div>
    `;
    mask.appendChild(box);
    document.body.appendChild(mask);
    document.getElementById("secure-reset-pass").focus();

    document.getElementById("btn-cancel-reset").onclick = () => mask.remove();
    document.getElementById("btn-confirm-reset").onclick = () => {
        const passVal = document.getElementById("secure-reset-pass").value;
        if (!passVal.trim()) {
            alert("Vui lòng không để trống mật khẩu!");
            return;
        }

        // [HUB] Cho người dùng biết lệnh đang chạy trong lúc chờ xác thực (fetch có thể mất
        // vài giây, trước đây nút không có phản ứng gì khiến người dùng tưởng bị treo).
        const confirmBtn = document.getElementById("btn-confirm-reset");
        const cancelBtn = document.getElementById("btn-cancel-reset");
        const originalConfirmText = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        confirmBtn.innerHTML = "⏳ Đang xác thực...";

        fetch(`${CONFIG.apiEndpoint}?action=checkResetPassword&password=${encodeURIComponent(passVal.trim())}`)
            .then(res => res.json())
            .then(res => {
                if (res.status === "success" && res.match === true) {
                    confirmBtn.innerHTML = "⏳ Đang xóa dữ liệu...";
                    mask.remove();
                    localStorage.clear();
                    if (window.indexedDB) {
                        indexedDB.deleteDatabase("FamilyFinancePWA");
                    }
                    if (notificationCheckInterval) {
                        clearInterval(notificationCheckInterval);
                    }
                    alert("🗑️ Đã xóa sạch dữ liệu thiết bị và đặt lại ứng dụng thành công!");
                    window.location.reload(true);
                } else {
                    confirmBtn.disabled = false;
                    cancelBtn.disabled = false;
                    confirmBtn.innerHTML = originalConfirmText;
                    alert("❌ Mật khẩu xác nhận không chính xác!");
                }
            })
            .catch(() => {
                confirmBtn.disabled = false;
                cancelBtn.disabled = false;
                confirmBtn.innerHTML = originalConfirmText;
                alert("Lỗi kết nối đến máy chủ xác thực!");
            });
    };
} // end function resetAppCompletely
// end RESET APP

// =========================================================================
// SCROLL TO TOP
// =========================================================================
window.onscroll = function() {
    const btn = document.getElementById("scrollTopBtn");
    if (btn) {
        btn.style.display = (document.body.scrollTop > 250 || document.documentElement.scrollTop > 250) ? "flex" : "none";
    }
};

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
} // end function scrollToTop
// end SCROLL TO TOP

// =========================================================================
// LOAD INITIAL SETTINGS
// =========================================================================
function loadInitialSettings() {
    if (!db) return;

    // Kiểm tra object stores
    console.log('📦 Object stores in database:', Array.from(db.objectStoreNames));
    
    // Kiểm tra health store
    if (!db.objectStoreNames.contains("health")) {
        console.error('❌ Health store not found!');
        // Thử tạo lại bằng cách tăng version
        try {
            const currentVersion = db.version;
            const newVersion = currentVersion + 1;
            db.close();
            
            const newRequest = indexedDB.open("FamilyFinancePWA", newVersion);
            newRequest.onupgradeneeded = function(e) {
                const newDb = e.target.result;
                if (!newDb.objectStoreNames.contains("health")) {
                    newDb.createObjectStore("health", { keyPath: "id", autoIncrement: true });
                    console.log('✅ Created health store on version ' + newVersion);
                }
                if (!newDb.objectStoreNames.contains("diary")) {
                    newDb.createObjectStore("diary", { keyPath: "id", autoIncrement: true });
                    console.log('✅ Created diary store on version ' + newVersion);
                }
                // Đảm bảo các store khác cũng tồn tại
                if (!newDb.objectStoreNames.contains("transactions")) {
                    newDb.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
                }
                if (!newDb.objectStoreNames.contains("settings")) {
                    newDb.createObjectStore("settings", { keyPath: "key" });
                }
                if (!newDb.objectStoreNames.contains("reminders")) {
                    newDb.createObjectStore("reminders", { keyPath: "id", autoIncrement: true });
                }
            };
            newRequest.onsuccess = function(e) {
                db = e.target.result;
                console.log('✅ Reopened database with health store, version:', db.version);
                continueLoadSettings();
            };
            newRequest.onerror = function(e) {
                console.error('❌ Failed to reopen database:', e.target.error);
                // Fallback: load bình thường
                continueLoadSettings();
            };
            return;
        } catch(err) {
            console.error('❌ Cannot recreate stores:', err);
            continueLoadSettings();
        }
    }
    
    // Nếu health store tồn tại, tiếp tục load
    continueLoadSettings();
} // end function loadInitialSettings

// Hàm tiếp tục load settings sau khi đã có db
function continueLoadSettings() {
    if (!db) {
        console.error('❌ continueLoadSettings: Database not available');
        // Thử load lại sau 1 giây
        setTimeout(() => {
            if (db) {
                continueLoadSettings();
            } else {
                console.error('❌ Still no database after retry');
            }
        }, 1000);
        return;
    }
    
    // Kiểm tra settings store
    if (!db.objectStoreNames.contains("settings")) {
        console.error('❌ Settings store not found!');
        // Tạo settings store
        try {
            const currentVersion = db.version;
            const newVersion = currentVersion + 1;
            db.close();
            
            const newRequest = indexedDB.open("FamilyFinancePWA", newVersion);
            newRequest.onupgradeneeded = function(e) {
                const newDb = e.target.result;
                if (!newDb.objectStoreNames.contains("settings")) {
                    newDb.createObjectStore("settings", { keyPath: "key" });
                    console.log('✅ Created settings store on version ' + newVersion);
                }
            };
            newRequest.onsuccess = function(e) {
                db = e.target.result;
                console.log('✅ Reopened with settings store');
                // Gọi lại chính nó
                continueLoadSettings();
            };
            newRequest.onerror = function(e) {
                console.error('❌ Failed to create settings store:', e.target.error);
                // Vẫn thử load với transaction fallback
                fallbackLoadSettings();
            };
            return;
        } catch(err) {
            console.error('❌ Cannot create settings store:', err);
            fallbackLoadSettings();
            return;
        }
    }
    
    // Load settings từ store
    try {
        const tx = db.transaction("settings", "readonly");
        const store = tx.objectStore("settings");
        const request = store.getAll();

        request.onsuccess = function(e) {
            const results = e.target.result || [];

            const savedFamily = results.find(item => item.key === "family_data");
            if (savedFamily) {
                localFamilyData = savedFamily.value;
            }

            const lastSync = results.find(item => item.key === "last_sync_time");
            const statusEl = document.getElementById("sync-status");
            if (lastSync && statusEl) {
                statusEl.innerHTML = `Last sync: ${lastSync.value}`;
            }

            loadTheme();
            initFormOptions();
            renderChartsAndStats();
            generateRemindersInterface();
            renderDiaryHistory();
            updateSummaryTotals();

            initAppConfig().then(() => {
                updateAppInfo();
            });
        };

        request.onerror = function(e) {
            console.error("Lỗi load settings:", e.target.error);
            fallbackLoadSettings();
        };
    } catch(err) {
        console.error("Lỗi transaction settings:", err);
        fallbackLoadSettings();
    }
} // end function continueLoadSettings

// Fallback khi không thể load settings
function fallbackLoadSettings() {
    console.log('🔄 Using fallback load settings');
    loadTheme();
    initFormOptions();
    renderChartsAndStats();
    generateRemindersInterface();
    renderDiaryHistory();
    updateSummaryTotals();
    initAppConfig().then(() => {
        updateAppInfo();
    });
} // end function fallbackLoadSettings
// end LOAD INITIAL SETTINGS

// =========================================================================
// KHỞI TẠO APP
// =========================================================================
// [HUB] Khởi tạo module được expose qua HubModules.finance.init(), shell.js gọi lazy khi user mở module lần đầu.
function financeModuleInit() {
    setupEventListeners();
    initDB();
    initThongKeFilters(); // [HUB] Section 5: gắn 1 lần duy nhất, không phụ thuộc IndexedDB
    initConCaiFilters();  // [HUB] Tab Con cái: gắn 1 lần duy nhất
}

window.addEventListener('online', () => {
    syncToGoogleSheets();
    syncRemindersToSheet();
    syncDiaryToSheet();
    syncHealthToSheet();
});
// end KHỞI TẠO APP

// =========================================================================
// THỐNG KÊ THỜI GIAN - MODAL TRONG TAB NHẬT KÍ
// =========================================================================

// Mở modal thống kê thời gian
function openStatTimeModal() {
    const modal = document.getElementById('statTimeModal');
    if (modal) {
        modal.style.display = 'flex';
        renderStatTime();
    }
} // end function openStatTimeModal

// Đóng modal thống kê thời gian
function closeStatTimeModal() {
    const modal = document.getElementById('statTimeModal');
    if (modal) {
        modal.style.display = 'none';
    }
} // end function closeStatTimeModal

// Render thống kê thời gian
function renderStatTime() {
    const periodSelect = document.getElementById('stat-time-period');
    if (!periodSelect) return;
    
    const period = periodSelect.value;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    if (!db) {
        console.log('❌ renderStatTime: Chưa có database');
        return;
    }
    
    const tx = db.transaction("diary", "readonly");
    const store = tx.objectStore("diary");
    const request = store.getAll();
    
    request.onsuccess = function(e) {
        const entries = e.target.result || [];
        console.log('📊 renderStatTime: Lấy được', entries.length, 'diary entries');
        
        let filtered = entries.filter(entry => {
            if (!entry.datetime) return false;
            
            const parts = entry.datetime.split(' ');
            if (parts.length < 1) return false;
            
            const dateParts = parts[0].split('-');
            if (dateParts.length !== 3) return false;
            
            const day = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1;
            const year = parseInt(dateParts[2]);
            
            if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
            
            if (period === 'month') {
                return month === currentMonth && year === currentYear;
            } else if (period === 'year') {
                return year === currentYear;
            }
            return true;
        });
        
        console.log('📊 renderStatTime: Sau khi lọc:', filtered.length, 'entries');
        
        let nhaMinh = 0;
        let nhaMe = 0;
        let noiKhac = 0;
        let placeCount = {};
        
        filtered.forEach(entry => {
            const place = entry.place || '';
            const normalizedPlace = place.trim().toLowerCase();
            
            if (normalizedPlace === 'nhà mình' || normalizedPlace === 'nha minh') {
                nhaMinh++;
            } else if (normalizedPlace === 'nhà mẹ' || normalizedPlace === 'nha me') {
                nhaMe++;
            } else if (place && place.trim() !== '') {
                noiKhac++;
            }
            
            if (place && place.trim() !== '') {
                placeCount[place] = (placeCount[place] || 0) + 1;
            }
        });
        
        document.getElementById('stat-nhaminh').textContent = nhaMinh;
        document.getElementById('stat-nhame').textContent = nhaMe;
        document.getElementById('stat-noikhac').textContent = noiKhac;
        document.getElementById('stat-total').textContent = (nhaMinh + nhaMe + noiKhac) + ' ngày';
        
        renderStatBarChart('chart-stat-bar', placeCount);
        renderStatPieChart('chart-stat-pie', nhaMinh, nhaMe, noiKhac);
    };
    
    request.onerror = function(e) {
        console.error('❌ renderStatTime: Lỗi đọc diary', e.target.error);
    };
} // end function renderStatTime

// Vẽ biểu đồ cột cho modal thống kê
function renderStatBarChart(canvasId, data) {
    if (charts[canvasId]) {
        charts[canvasId].destroy();
        delete charts[canvasId];
    }
    
    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) return;
    
    const ctx = canvasEl.getContext('2d');
    
    const sortedData = Object.entries(data)
        .filter(([key, value]) => value > 0 && key.trim() !== '')
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sortedData.map(item => item[0]);
    const values = sortedData.map(item => item[1]);
    
    const colors = labels.map(label => {
        const normalized = label.trim().toLowerCase();
        if (normalized === 'nhà mình' || normalized === 'nha minh') {
            return '#FFC107';
        } else if (normalized === 'nhà mẹ' || normalized === 'nha me') {
            return '#4CAF50';
        } else {
            return '#FF9800';
        }
    });
    
    charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Số ngày',
                data: values,
                backgroundColor: colors,
                borderColor: colors.map(c => c),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 10 },
                    anchor: 'end',
                    align: 'end',
                    formatter: function(value) {
                        return value > 0 ? value : '';
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { size: 10 }
                    }
                },
                x: {
                    ticks: {
                        font: { size: 9 },
                        maxRotation: 30,
                        minRotation: 30
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
} // end function renderStatBarChart

// Vẽ biểu đồ tròn cho modal thống kê
function renderStatPieChart(canvasId, nhaMinh, nhaMe, noiKhac) {
    if (charts[canvasId]) {
        charts[canvasId].destroy();
        delete charts[canvasId];
    }
    
    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) return;
    
    const ctx = canvasEl.getContext('2d');
    const total = nhaMinh + nhaMe + noiKhac;
    
    charts[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['🏠 Nhà mình', '🏡 Nhà mẹ', '🌍 Nơi khác'],
            datasets: [{
                data: [nhaMinh, nhaMe, noiKhac],
                backgroundColor: ['#FFC107', '#4CAF50', '#FF9800']
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: { size: 11 },
                        padding: 10
                    }
                },
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 11 },
                    anchor: 'center',
                    align: 'center',
                    formatter: function(value) {
                        if (total > 0 && (value / total * 100) > 5) {
                            return (value / total * 100).toFixed(1) + '%';
                        }
                        return '';
                    }
                }
            }
        }
    });
} // end function renderStatPieChart

// Setup events cho modal thống kê thời gian
function setupStatTimeEvents() {
    const btnStatTime = document.getElementById('btn-stat-time');
    if (btnStatTime) {
        btnStatTime.addEventListener('click', openStatTimeModal);
    }
    
    const btnClose = document.getElementById('btn-close-stat-time');
    if (btnClose) {
        btnClose.addEventListener('click', closeStatTimeModal);
    }
    
    const modal = document.getElementById('statTimeModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeStatTimeModal();
            }
        });
    }
    
    const periodSelect = document.getElementById('stat-time-period');
    if (periodSelect) {
        periodSelect.addEventListener('change', renderStatTime);
    }
    
    const btnRefresh = document.getElementById('btn-refresh-stat');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', function() {
            renderStatTime();
            this.textContent = '✅ Đã làm mới!';
            setTimeout(() => {
                this.textContent = '🔄 Làm mới';
            }, 1500);
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('statTimeModal');
            if (modal && modal.style.display === 'flex') {
                closeStatTimeModal();
            }
        }
    });
} // end function setupStatTimeEvents

// end THỐNG KÊ THỜI GIAN

// [HUB] Expose API cho shell.js gọi + cho module Settings toàn app tái sử dụng
// logic theme/đồng bộ/reset/app-info gốc của Tui (tránh viết lại từ đầu).
window.HubModules.finance = {
    init: financeModuleInit,
    switchTab: switchTab,
    toggleDarkMode: toggleDarkMode,
    applyTheme: applyTheme,
    loadTheme: loadTheme,
    syncAllDataFromSheet: syncAllDataFromSheet,
    resetAppCompletely: resetAppCompletely,
    openAppInfoModal: openAppInfoModal,
    closeAppInfoModal: closeAppInfoModal,
    updateAppInfo: updateAppInfo
};

})();
