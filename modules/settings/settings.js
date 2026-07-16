// =========================================================================
// MODULE: SETTINGS — settings.js
// Không viết lại logic theme/sync/reset/app-info — chỉ tạo UI mới rồi gọi
// thẳng các hàm đã expose sẵn ở window.HubModules.finance / .huyenhoc.
// Với các control gốc (setting-color, theme-selector...) vẫn còn tồn tại ẩn
// trong DOM của module gốc, ta đồng bộ giá trị vào đó trước khi gọi hàm áp
// dụng, để hàm gốc đọc đúng giá trị (chúng vốn tự đọc value từ đúng id đó).
// =========================================================================
(function() {
'use strict';

const FINANCE_PALETTE = [
    { hex: '#FFC107', name: 'Vàng (mặc định)' },
    { hex: '#4CAF50', name: 'Xanh lá' },
    { hex: '#8BC34A', name: 'Xanh lá nhạt' },
    { hex: '#2196F3', name: 'Xanh dương' },
    { hex: '#E91E63', name: 'Hồng' },
    { hex: '#9C27B0', name: 'Tím' },
    { hex: '#F44336', name: 'Đỏ' },
    { hex: '#FF9800', name: 'Cam' },
    { hex: '#FFEB3B', name: 'Vàng chanh' }
];

function syncHiddenControl(id, value, isCheckbox) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isCheckbox) el.checked = value; else el.value = value;
}

// ---------- a. Thay đổi giao diện ----------

// [HUB] 1 công tắc Dark/Light DUY NHẤT áp dụng cho cả module Gia đình lẫn Huyền học
// (trước đây mỗi module có 1 công tắc/dropdown riêng gây dư thừa và dễ lệch nhau).
function renderUnifiedDarkToggle() {
    const toggle = document.getElementById('settings-dark-toggle');
    if (!toggle) return;

    const savedDark = localStorage.getItem('darkMode');
    const isDark = savedDark !== null ? savedDark === 'true' : true;
    toggle.checked = isDark;

    // Đồng bộ 1 lần lúc mở Settings, phòng trường hợp 2 module đang lệch trạng thái
    // từ trước (vd Gia đình đang dark nhưng Huyền học đang light).
    applyUnifiedDarkMode(isDark, /*silent*/ true);

    toggle.addEventListener('change', () => applyUnifiedDarkMode(toggle.checked, false));
}

function applyUnifiedDarkMode(isDark, silent) {
    syncHiddenControl('darkModeToggle', isDark, true);
    if (window.HubModules.finance) window.HubModules.finance.toggleDarkMode(isDark);

    syncHiddenControl('mode-selector', isDark ? 'dark' : 'light', false);
    if (window.HubModules.huyenhoc) window.HubModules.huyenhoc.applyTheme();
}

function renderFinanceThemeControls() {
    const colorSelect = document.getElementById('settings-finance-color');
    if (!colorSelect) return;

    colorSelect.innerHTML = FINANCE_PALETTE.map(c => `<option value="${c.hex}">${c.name}</option>`).join('');
    colorSelect.value = localStorage.getItem('themeColor') || '#FFC107';

    colorSelect.addEventListener('change', () => {
        syncHiddenControl('setting-color', colorSelect.value, false);
        if (window.HubModules.finance) window.HubModules.finance.applyTheme();
    });
}

function renderHuyenhocThemeControls() {
    const themeSelect = document.getElementById('settings-huyenhoc-theme');
    if (!themeSelect) return;

    const themes = (window.HubModules.huyenhoc && window.HubModules.huyenhoc.themes) || {};
    themeSelect.innerHTML = Object.keys(themes).map(key => `<option value="${key}">${themes[key].name}</option>`).join('');
    themeSelect.value = localStorage.getItem('user-theme') || 'xanhla';

    themeSelect.addEventListener('change', () => {
        syncHiddenControl('theme-selector', themeSelect.value, false);
        if (window.HubModules.huyenhoc) window.HubModules.huyenhoc.applyTheme();
    });
}

// ---------- b. Đồng bộ dữ liệu ----------
function wireSyncButton() {
    const btn = document.getElementById('settings-btn-sync');
    if (btn) {
        btn.addEventListener('click', () => {
            if (window.HubModules.finance && window.HubModules.finance.syncAllDataFromSheet) {
                window.HubModules.finance.syncAllDataFromSheet();
            }
        });
    }
    // "sync-status" gốc nằm ẩn trong module Gia đình — soi thay đổi rồi phản chiếu
    // sang khung hiển thị của Settings bằng MutationObserver (không cần sửa script.js gốc).
    const originalStatus = document.getElementById('sync-status');
    const displayStatus = document.getElementById('settings-sync-status');
    if (originalStatus && displayStatus && window.MutationObserver) {
        displayStatus.innerHTML = originalStatus.innerHTML;
        const observer = new MutationObserver(() => {
            displayStatus.innerHTML = originalStatus.innerHTML;
        });
        observer.observe(originalStatus, { childList: true, characterData: true, subtree: true });
    }
}

// ---------- c. Xóa dữ liệu và Đặt lại App ----------
function wireResetButton() {
    const btn = document.getElementById('settings-btn-reset');
    if (!btn) return;
    btn.addEventListener('click', () => {
        // resetAppCompletely() gốc đã tự xây dialog xác thực mật khẩu + localStorage.clear()
        // (xóa luôn theme đã lưu của Huyền học vì cùng chung localStorage) + xóa IndexedDB + reload.
        if (window.HubModules.finance && window.HubModules.finance.resetAppCompletely) {
            window.HubModules.finance.resetAppCompletely();
        }
    });
}

// ---------- d. Thông tin ứng dụng ----------
function wireAppInfoButton() {
    const openBtn = document.getElementById('settings-btn-appinfo');
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            if (window.HubModules.finance && window.HubModules.finance.openAppInfoModal) {
                window.HubModules.finance.openAppInfoModal();
            }
        });
    }
    const closeBtn = document.getElementById('btn-close-app-info');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (window.HubModules.finance) window.HubModules.finance.closeAppInfoModal();
        });
    }
    const refreshBtn = document.getElementById('btn-refresh-app-info');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (window.HubModules.finance) window.HubModules.finance.updateAppInfo();
        });
    }
    const modal = document.getElementById('appInfoModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal && window.HubModules.finance) {
                window.HubModules.finance.closeAppInfoModal();
            }
        });
    }
}

function settingsModuleInit() {
    renderUnifiedDarkToggle();
    renderFinanceThemeControls();
    renderHuyenhocThemeControls();
    wireSyncButton();
    wireResetButton();
    wireAppInfoButton();
}

// [HUB] Settings không có submenu con nên switchTab là no-op (giữ để đồng nhất API).
window.HubModules.settings = {
    init: settingsModuleInit,
    switchTab: function() {}
};

})();
