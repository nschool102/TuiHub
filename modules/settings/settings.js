// =========================================================================
// MODULE: SETTINGS — settings.js
// [HUB] Giao diện đã HỢP NHẤT: 1 công tắc Dark/Light + 1 màu chủ đạo áp dụng
// cho toàn app (Gia đình + Huyền học cùng lúc), không còn tách riêng theo
// từng module như trước. Đồng bộ/reset/app-info vẫn tái dùng logic gốc của
// module Gia đình qua window.HubModules.finance — không viết lại logic đó.
// =========================================================================
(function() {
'use strict';

const ACCENT_PALETTE = [
    { hex: '#FFC107', name: '🟡 Vàng (mặc định)' },
    { hex: '#4CAF50', name: '🟢 Xanh lá' },
    { hex: '#2196F3', name: '🔵 Xanh dương' },
    { hex: '#E91E63', name: '🌸 Hồng' },
    { hex: '#9C27B0', name: '🟣 Tím' },
    { hex: '#F44336', name: '🔴 Đỏ' },
    { hex: '#FF9800', name: '🟠 Cam' },
    { hex: '#00BCD4', name: '🩵 Xanh ngọc' }
];

function getSavedAccent() {
    return localStorage.getItem('unified-accent') || localStorage.getItem('themeColor') || '#FFC107';
}

function getSavedDark() {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? saved === 'true' : true;
}

// [HUB] Áp dụng đồng thời cho cả module Gia đình lẫn Huyền học — đây là điểm
// DUY NHẤT điều khiển giao diện toàn app, thay cho 2 hệ thống theme riêng biệt trước đây.
function applyUnifiedAppearance(isDark, accentHex) {
    const mode = isDark ? 'dark' : 'light';

    if (window.HubModules.finance) {
        window.HubModules.finance.toggleDarkMode(isDark);
        window.HubModules.finance.applyTheme(accentHex);
    }
    if (window.HubModules.huyenhoc) {
        window.HubModules.huyenhoc.applyUnifiedTheme(mode, accentHex);
    }

    localStorage.setItem('unified-accent', accentHex);
}

function renderAppearanceControls() {
    const darkToggle = document.getElementById('settings-dark-toggle');
    const colorSelect = document.getElementById('settings-accent-color');
    if (!darkToggle || !colorSelect) return;

    colorSelect.innerHTML = ACCENT_PALETTE.map(c => `<option value="${c.hex}">${c.name}</option>`).join('');

    const isDark = getSavedDark();
    const accent = getSavedAccent();
    darkToggle.checked = isDark;
    colorSelect.value = accent;

    // Đồng bộ 1 lần lúc mở Settings, phòng trường hợp 2 module đang lệch nhau từ trước.
    applyUnifiedAppearance(isDark, accent);

    darkToggle.addEventListener('change', () => {
        applyUnifiedAppearance(darkToggle.checked, colorSelect.value);
    });
    colorSelect.addEventListener('change', () => {
        applyUnifiedAppearance(darkToggle.checked, colorSelect.value);
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
        // (xóa luôn theme hợp nhất + theme cũ của Huyền học vì cùng chung localStorage)
        // + xóa IndexedDB + reload.
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
    renderAppearanceControls();
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
