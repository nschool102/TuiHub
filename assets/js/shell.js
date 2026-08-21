// =========================================================================
// TUI HUB — SHELL: điều hướng navbar cấp 1 (module) + cấp 2 (submenu)
// Mỗi module (finance / huyenhoc / calculator) tự đăng ký vào window.HubModules
// với { init(), switchTab(key) }. Shell KHÔNG biết logic bên trong module.
// =========================================================================

window.HubModules = window.HubModules || {};

const HUB_NAV = [
    {
        key: 'finance', label: 'Gia đình', icon: '💰',
        subs: [
            { key: 'chi', label: 'Chi' },
            { key: 'thu', label: 'Thu' },
            { key: 'diary', label: 'Nhật kí' },
            { key: 'thongke', label: 'Thống kê' },
            { key: 'concai', label: 'Con cái' },
            { key: 'family', label: 'Family' },
            { key: 'nhachen', label: 'Nhắc hẹn' }
        ]
    },
    {
        key: 'huyenhoc', label: 'Huyền học', icon: '🔮',
        subs: [
            { key: 'maihoa', label: 'Mai Hoa' },
            { key: 'fullcustom', label: 'Full custom' },
            { key: 'tarot', label: 'Tarot' },
            { key: 'decision', label: 'Decision' }
        ]
    },
    {
        key: 'calculator', label: 'Máy tính lười', icon: '🧮',
        subs: [
            { key: '0', label: 'Cơ bản' },
            { key: '1', label: 'Tính %' },
            { key: '2', label: 'Tỉ lệ' },
            { key: '3', label: 'Lãi suất' },
            { key: '4', label: 'Trúng số' },
            { key: '5', label: 'Thời gian' },
            { key: '6', label: 'Nhà cửa' },
            { key: '7', label: 'Chia tiền' },
            { key: '8', label: 'Mua sắm' },
            { key: '9', label: 'Đổi đơn vị' }
        ]
    },
    {
        key: 'settings', label: 'Settings', icon: '⚙️',
        subs: []
    }
];

const HubState = {
    activeModule: null,
    activeSub: {},      // key: moduleKey -> subKey đang mở, để nhớ lại khi quay lại module
    initedModules: {}   // key: moduleKey -> đã init() chưa (lazy, chỉ chạy 1 lần)
};

function hubFindNav(moduleKey) {
    return HUB_NAV.find(m => m.key === moduleKey);
}

function hubRenderBottomNav() {
    const nav = document.getElementById('hub-bottomnav');
    nav.innerHTML = '';
    HUB_NAV.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'hub-navitem';
        btn.dataset.module = m.key;
        btn.innerHTML = `<span class="hub-navicon">${m.icon}</span><span class="hub-navlabel">${m.label}</span>`;
        btn.addEventListener('click', () => hubOpenModule(m.key));
        nav.appendChild(btn);
    });
} // end function hubRenderBottomNav

function hubRenderSubmenu(moduleKey) {
    const wrap = document.getElementById('hub-submenu');
    const m = hubFindNav(moduleKey);
    wrap.innerHTML = '';
    if (!m || !m.subs.length) {
        wrap.style.display = 'none';
        return;
    }
    wrap.style.display = 'flex';
    m.subs.forEach(s => {
        const chip = document.createElement('button');
        chip.className = 'hub-subitem';
        chip.dataset.sub = s.key;
        chip.textContent = s.label;
        chip.addEventListener('click', () => hubOpenSub(moduleKey, s.key));
        wrap.appendChild(chip);
    });
} // end function hubRenderSubmenu

function hubSetTopbar(moduleKey, subLabel) {
    const m = hubFindNav(moduleKey);
    document.getElementById('hub-title-icon').textContent = m ? m.icon : '';
    document.getElementById('hub-title-text').textContent = m ? m.label : '';
    document.getElementById('hub-title-sub').textContent = subLabel || '';
} // end function hubSetTopbar

function hubOpenModule(moduleKey) {
    if (HubState.activeModule === moduleKey) return;
    HubState.activeModule = moduleKey;

    // ẩn/hiện container module (mỗi module là 1 div#module-<key>.app-module)
    document.querySelectorAll('.app-module').forEach(el => el.classList.remove('active'));
    const container = document.getElementById('module-' + moduleKey);
    if (container) container.classList.add('active');

    // active state cho nav cấp 1
    document.querySelectorAll('.hub-navitem').forEach(el => {
        el.classList.toggle('active', el.dataset.module === moduleKey);
    });

    hubRenderSubmenu(moduleKey);

    // lazy init: chỉ init() module lần đầu mở
    if (!HubState.initedModules[moduleKey] && window.HubModules[moduleKey] && window.HubModules[moduleKey].init) {
        window.HubModules[moduleKey].init();
        HubState.initedModules[moduleKey] = true;
    }

    const m = hubFindNav(moduleKey);
    if (m && m.subs.length) {
        const rememberedSub = HubState.activeSub[moduleKey] || m.subs[0].key;
        hubOpenSub(moduleKey, rememberedSub);
    } else {
        hubSetTopbar(moduleKey, '');
    }
} // end function hubOpenModule

function hubOpenSub(moduleKey, subKey) {
    HubState.activeSub[moduleKey] = subKey;

    document.querySelectorAll('#hub-submenu .hub-subitem').forEach(el => {
        el.classList.toggle('active', el.dataset.sub === subKey);
    });

    const m = hubFindNav(moduleKey);
    const subDef = m && m.subs.find(s => s.key === subKey);
    hubSetTopbar(moduleKey, subDef ? subDef.label : '');

    // giao việc chuyển tab cho chính module đó xử lý (mỗi module tự biết cách hiện đúng panel)
    if (window.HubModules[moduleKey] && window.HubModules[moduleKey].switchTab) {
        window.HubModules[moduleKey].switchTab(subKey);
    }
} // end function hubOpenSub

function hubApplySavedTheme() {
    const savedDark = localStorage.getItem('darkMode');
    const isDark = savedDark !== null ? savedDark === 'true' : true;
    const accent = localStorage.getItem('unified-accent') || localStorage.getItem('themeColor') || '#ffc107';
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.documentElement.style.setProperty('--hub-accent', accent);
} // end function hubApplySavedTheme

function hubRegisterServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            reg.update();
            setInterval(() => reg.update(), 60000);
        }).catch(err => console.log('SW lỗi:', err));
    }
} // end function hubRegisterServiceWorker

document.addEventListener('DOMContentLoaded', () => {
    hubApplySavedTheme();
    hubRenderBottomNav();
    hubRegisterServiceWorker();
    hubOpenModule('finance'); // module mặc định khi mở app
});
