import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// === KONFIGURASI SUPABASE ===
const supabaseUrl = "https://olkrpfrhnsqlyvwegurk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sa3JwZnJobnNxbHl2d2VndXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyNTQ2MzksImV4cCI6MjA3MzgzMDYzOX0.Dz0CniltePbznfB4hUhcb4lov6IH0p2uvxt4ZdTZyBA";
const supabase = createClient(supabaseUrl, supabaseKey);

// === STATE ===
let donations = [];
let targetAmount = 50000000;
let milestoneId = null;
let isLoading = false;
let isAdminLoggedIn = false;
let currentAdminUsername = '';

// === ADMIN LOGIN SYSTEM (SIMPLIFIED) ===

// Initialize admin table with simple password
async function initializeAdminTable() {
    try {
        // Check if admin exists, if not create default
        const { data: existingAdmin } = await supabase
            .from('admin_users')
            .select('*')
            .eq('username', 'admin')
            .single();

        if (!existingAdmin) {
            const { error: insertError } = await supabase
                .from('admin_users')
                .insert([
                    { 
                        username: 'admin', 
                        password: 'ggm2025',  // Plain text for now
                        created_at: new Date().toISOString()
                    }
                ]);

            if (insertError) {
                console.log('Admin table might not exist, using localStorage fallback');
                initializeLocalAdmin();
            } else {
                console.log('Default admin created: admin / ggm2025');
            }
        }
    } catch (error) {
        console.log('Using localStorage fallback for admin');
        initializeLocalAdmin();
    }
}

// Fallback to localStorage if Supabase admin table fails
function initializeLocalAdmin() {
    const adminData = localStorage.getItem('ggm_admin_data');
    if (!adminData) {
        localStorage.setItem('ggm_admin_data', JSON.stringify([
            { username: 'admin', password: 'ggm2025' }
        ]));
        console.log('Local admin initialized: admin / ggm2025');
    }
}

// Check admin login status on page load
function checkAdminSession() {
    const adminSession = localStorage.getItem('ggm_admin_session');
    if (adminSession) {
        try {
            const session = JSON.parse(adminSession);
            const now = new Date().getTime();
            
            // Session expires after 24 hours
            if (now - session.loginTime < 24 * 60 * 60 * 1000) {
                isAdminLoggedIn = true;
                currentAdminUsername = session.username;
                showAdminStatus(true);
                return true;
            } else {
                localStorage.removeItem('ggm_admin_session');
            }
        } catch (error) {
            localStorage.removeItem('ggm_admin_session');
        }
    }
    return false;
}

// Show/hide admin status indicator
function showAdminStatus(show) {
    const statusEl = document.getElementById('adminStatus');
    const usernameEl = document.getElementById('adminUsername');
    
    if (show) {
        usernameEl.textContent = currentAdminUsername;
        statusEl.style.display = 'block';
        statusEl.style.animation = 'fadeIn 0.3s ease';
    } else {
        statusEl.style.display = 'none';
    }
}

// Check if user should login or go directly to admin panel
function checkAdminLogin() {
    if (isAdminLoggedIn) {
        toggleAdmin();
    } else {
        showLoginModal();
    }
}
window.checkAdminLogin = checkAdminLogin;

// Show login modal
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Focus on username input
    setTimeout(() => {
        document.getElementById('loginUsername').focus();
    }, 300);
}

// Close login modal
function closeLogin() {
    const modal = document.getElementById('loginModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Clear form
    document.getElementById('loginForm').reset();
    hideLoginError();
}
window.closeLogin = closeLogin;

// Show login error
function showLoginError(message) {
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Hide login error
function hideLoginError() {
    const errorEl = document.getElementById('loginError');
    errorEl.style.display = 'none';
}

// Toggle password visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('loginPassword');
    const toggleIcon = document.getElementById('passwordToggleIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.textContent = '👁️';
    } else {
        passwordInput.type = 'password';
        toggleIcon.textContent = '👁️';
    }
}
window.togglePasswordVisibility = togglePasswordVisibility;

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const loginBtn = document.getElementById('loginBtn');
    
    if (!username || !password) {
        showLoginError('Username dan password harus diisi!');
        return;
    }
    
    // Show loading
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span>⏳</span> Memverifikasi...';
    hideLoginError();
    
    try {
        const isValid = await validateAdmin(username, password);
        
        if (isValid) {
            // Login successful
            isAdminLoggedIn = true;
            currentAdminUsername = username;
            
            // Save session
            localStorage.setItem('ggm_admin_session', JSON.stringify({
                username: username,
                loginTime: new Date().getTime()
            }));
            
            showNotification(`Selamat datang, ${username}!`, 'success');
            closeLogin();
            showAdminStatus(true);
            
            // Open admin panel
            setTimeout(() => {
                toggleAdmin();
            }, 500);
            
        } else {
            showLoginError('Username atau password salah!');
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('Terjadi kesalahan saat login. Silakan coba lagi.');
    }
    
    // Reset button
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<span>🔓</span> Login';
});

// Validate admin credentials (SIMPLIFIED - NO HASHING)
async function validateAdmin(username, password) {
    try {
        console.log(`Trying to validate: ${username} / ${password}`);
        
        // Try Supabase first
        const { data: admin, error } = await supabase
            .from('admin_users')
            .select('*')
            .eq('username', username)
            .eq('password', password)  // Plain text comparison
            .single();

        console.log('Supabase result:', admin, error);

        if (admin && !error) {
            console.log('Login successful via Supabase');
            return true;
        }

        // Fallback to localStorage
        const adminData = localStorage.getItem('ggm_admin_data');
        if (adminData) {
            const admins = JSON.parse(adminData);
            const foundAdmin = admins.find(admin => 
                admin.username === username && admin.password === password
            );
            
            if (foundAdmin) {
                console.log('Login successful via localStorage');
                return true;
            }
        }

        // Ultimate fallback - hardcoded credentials
        if (username === 'admin' && password === 'ggm2025') {
            console.log('Login successful via hardcoded credentials');
            return true;
        }

        console.log('Login failed');
        return false;
        
    } catch (error) {
        console.error('Validation error:', error);
        
        // Ultimate fallback - default credentials
        if (username === 'admin' && password === 'ggm2025') {
            console.log('Login successful via emergency fallback');
            return true;
        }
        
        return false;
    }
}

// Admin logout
function adminLogout() {
    if (confirm('Yakin ingin logout dari admin panel?')) {
        isAdminLoggedIn = false;
        currentAdminUsername = '';
        localStorage.removeItem('ggm_admin_session');
        showAdminStatus(false);
        
        // Close admin panel if open
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel.classList.contains('active')) {
            toggleAdmin();
        }
        
        showNotification('Logout berhasil!', 'info');
    }
}
window.adminLogout = adminLogout;

// Change password functionality
function changePassword() {
    const modal = document.getElementById('changePasswordModal');
    modal.classList.add('active');
}
window.changePassword = changePassword;

function closeChangePassword() {
    const modal = document.getElementById('changePasswordModal');
    modal.classList.remove('active');
    document.getElementById('changePasswordForm').reset();
    
    const errorEl = document.getElementById('changePasswordError');
    errorEl.style.display = 'none';
}
window.closeChangePassword = closeChangePassword;

// Handle change password form
document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorEl = document.getElementById('changePasswordError');
    
    // Validation
    if (newPassword.length < 6) {
        errorEl.textContent = 'Password baru minimal 6 karakter!';
        errorEl.style.display = 'block';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorEl.textContent = 'Password baru tidak cocok!';
        errorEl.style.display = 'block';
        return;
    }
    
    try {
        // Verify old password
        const isValidOld = await validateAdmin(currentAdminUsername, oldPassword);
        if (!isValidOld) {
            errorEl.textContent = 'Password lama salah!';
            errorEl.style.display = 'block';
            return;
        }
        
        // Update password
        const { error } = await supabase
            .from('admin_users')
            .update({ password: newPassword })  // Plain text
            .eq('username', currentAdminUsername);
        
        if (error) {
            // Fallback to localStorage
            const adminData = localStorage.getItem('ggm_admin_data');
            if (adminData) {
                const admins = JSON.parse(adminData);
                const adminIndex = admins.findIndex(admin => admin.username === currentAdminUsername);
                if (adminIndex !== -1) {
                    admins[adminIndex].password = newPassword;
                    localStorage.setItem('ggm_admin_data', JSON.stringify(admins));
                }
            }
        }
        
        showNotification('Password berhasil diubah!', 'success');
        closeChangePassword();
        
    } catch (error) {
        console.error('Change password error:', error);
        errorEl.textContent = 'Terjadi kesalahan saat mengubah password!';
        errorEl.style.display = 'block';
    }
});

// === REST OF THE ORIGINAL CODE (Unchanged) ===

// Enhanced animations
const animateNumber = (element, start, end, duration = 2000) => {
    const range = end - start;
    const minTimer = 50;
    const stepTime = Math.abs(Math.floor(duration / range));
    const timer = Math.max(stepTime, minTimer);
    const startTime = new Date().getTime();
    const endTime = startTime + duration;
    
    const run = () => {
        const now = new Date().getTime();
        const remaining = Math.max((endTime - now) / duration, 0);
        const value = Math.round(end - (remaining * range));
        
        if (element.id === 'progressPercentage') {
            element.textContent = value + '%';
        } else {
            element.textContent = formatCurrency(value);
        }
        
        if (value === end) {
            clearInterval(timer);
        }
    };
    
    const timer_id = setInterval(run, timer);
    run();
};

const showLoadingState = (show = true) => {
    const elements = ['currentAmount', 'targetAmount', 'remainingAmount', 'progressPercentage'];
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.opacity = show ? '0.5' : '1';
            if (show) {
                element.style.animation = 'pulse 1.5s ease-in-out infinite';
            } else {
                element.style.animation = '';
            }
        }
    });
};

// Load data from Supabase
async function loadDataSupabase() {
    try {
        showLoadingState(true);
        isLoading = true;

        // Load milestone
        const { data: milestone, error: milestoneError } = await supabase
            .from("milestones")
            .select("*")
            .order("created_at", { ascending: true })
            .limit(1)
            .single();

        if (milestoneError) {
            console.error("Milestone error:", milestoneError);
            showNotification("Error loading milestone data", "error");
            return;
        }

        milestoneId = milestone.id;
        const oldTarget = targetAmount;
        targetAmount = milestone.target_amount;

        // Load donations
        const { data: donationData, error: donationError } = await supabase
            .from("donations")
            .select("*")
            .eq("milestone_id", milestoneId)
            .order("created_at", { ascending: false });

        if (donationError) {
            console.error("Donations error:", donationError);
            showNotification("Error loading donations data", "error");
            return;
        }

        donations = donationData.map(d => ({
            name: d.donor_name,
            amount: Number(d.amount),
            note: d.note,
            timestamp: d.created_at,
            id: d.id
        }));

        await updateDisplay();
        renderDonations();
        showLoadingState(false);
        isLoading = false;

        // Show notification if target was updated
        if (oldTarget !== targetAmount && oldTarget !== 50000000) {
            showNotification("Target dana telah diperbarui!", "success");
        }

    } catch (error) {
        console.error("Load data error:", error);
        showNotification("Terjadi kesalahan saat memuat data", "error");
        showLoadingState(false);
        isLoading = false;
    }
}

// Notification system (unchanged - keeping original code)
function showNotification(message, type = "info") {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 5000;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 15px 20px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1);
        animation: slideIn 0.3s ease;
        max-width: 350px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || icons.info;
}

function getNotificationColor(type) {
    const colors = {
        success: 'linear-gradient(135deg, #28a745, #20c997)',
        error: 'linear-gradient(135deg, #dc3545, #c82333)',
        warning: 'linear-gradient(135deg, #ffc107, #fd7e14)',
        info: 'linear-gradient(135deg, #17a2b8, #6f42c1)'
    };
    return colors[type] || colors.info;
}

// Add notification CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 0.8; }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        margin-left: auto;
        padding: 0 5px;
    }
`;
document.head.appendChild(style);

// Toggle admin panel (with login protection)
function toggleAdmin() {
    if (!isAdminLoggedIn) {
        showLoginModal();
        return;
    }

    const panel = document.getElementById("adminPanel");
    panel.classList.toggle("active");
    
    if (panel.classList.contains("active")) {
        document.getElementById('adminPanelUsername').textContent = currentAdminUsername;
        renderAdminDonations();
        document.body.style.overflow = 'hidden';
        panel.style.animation = 'fadeIn 0.3s ease';
    } else {
        document.body.style.overflow = '';
    }
}
window.toggleAdmin = toggleAdmin;

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
    }).format(amount);
}

// Update display with enhanced animations
async function updateDisplay() {
    const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
    const percentage = Math.round((totalDonations / targetAmount) * 100);
    const remaining = Math.max(0, targetAmount - totalDonations);

    const currentAmountEl = document.getElementById("currentAmount");
    const remainingAmountEl = document.getElementById("remainingAmount");
    const progressPercentageEl = document.getElementById("progressPercentage");
    const progressBarEl = document.getElementById("progressBar");
    const progressStatusEl = document.getElementById("progressStatus");

    const currentCurrent = parseFloat(currentAmountEl.textContent.replace(/[^\d]/g, '')) || 0;
    const currentRemaining = parseFloat(remainingAmountEl.textContent.replace(/[^\d]/g, '')) || targetAmount;
    const currentPercentage = parseInt(progressPercentageEl.textContent.replace('%', '')) || 0;

    animateNumber(currentAmountEl, currentCurrent, totalDonations);
    animateNumber(remainingAmountEl, currentRemaining, remaining);
    animateNumber(progressPercentageEl, currentPercentage, percentage);

    document.getElementById("targetAmount").textContent = formatCurrency(targetAmount);

    setTimeout(() => {
        progressBarEl.style.width = Math.min(percentage, 100) + "%";
    }, 500);

    let statusMessage = getProgressStatusMessage(percentage, totalDonations, targetAmount);
    if (progressStatusEl) {
        setTimeout(() => {
            progressStatusEl.textContent = statusMessage;
            progressStatusEl.style.animation = 'fadeIn 0.5s ease';
        }, 1000);
    }

    const donationsCountEl = document.getElementById("donationsCount");
    if (donationsCountEl) {
        const count = donations.length;
        donationsCountEl.textContent = `${count} Donasi`;
    }

    if (percentage >= 100 && currentPercentage < 100) {
        setTimeout(() => {
            celebrate();
            showNotification("🎉 Target tercapai! Terima kasih atas dukungan Anda!", "success");
        }, 2000);
    }
}

function getProgressStatusMessage(percentage, current, target) {
    if (percentage >= 100) {
        return "🎉 Target tercapai! Terima kasih atas dukungan luar biasa!";
    } else if (percentage >= 90) {
        return "🔥 Hampir sampai! Sedikit lagi target tercapai!";
    } else if (percentage >= 75) {
        return "💪 Luar biasa! Mari bersama mencapai target!";
    } else if (percentage >= 50) {
        return "📈 Progres bagus! Terus semangat bersama!";
    } else if (percentage >= 25) {
        return "🌱 Awal yang baik! Mari terus berkontribusi!";
    } else if (percentage > 0) {
        return "✨ Langkah pertama yang berarti! Mari bergabung!";
    } else {
        return "Mari bersama memulai perjalanan berkat ini!";
    }
}

// Enhanced celebration
function celebrate() {
    const celebration = document.getElementById("celebration");
    celebration.style.display = "block";
    
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
    
    for (let i = 0; i < 80; i++) {
        setTimeout(() => {
            const confetti = document.createElement("div");
            confetti.className = "confetti";
            confetti.style.cssText = `
                left: ${Math.random() * 100}%;
                background-color: ${colors[Math.floor(Math.random() * colors.length)]};
                animation-delay: ${Math.random() * 2}s;
                animation-duration: ${3 + Math.random() * 2}s;
                width: ${8 + Math.random() * 8}px;
                height: ${8 + Math.random() * 8}px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            `;
            celebration.appendChild(confetti);
            
            setTimeout(() => {
                if (confetti.parentNode) confetti.parentNode.removeChild(confetti);
            }, 5000);
        }, i * 50);
    }
    
    setTimeout(() => {
        celebration.style.display = "none";
    }, 6000);
}

// Render donations with enhanced UI
function renderDonations() {
    const container = document.getElementById("donationsList");
    if (donations.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; opacity: 0.7;">
                <div style="font-size: 3rem; margin-bottom: 20px;">📝</div>
                <p style="font-size: 1.1rem; color: #c0c0c0;">Belum ada taburan</p>
                <p style="font-size: 0.9rem; color: #a0a0a0; margin-top: 10px;">Mari menjadi yang pertama berkontribusi!</p>
            </div>
        `;
        return;
    }

    const sorted = [...donations].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    container.innerHTML = sorted
        .map((donation, index) => {
            const timeAgo = getTimeAgo(donation.timestamp);
            const isRecent = isRecentDonation(donation.timestamp);
            
            return `
                <div class="donation-item ${isRecent ? 'recent-donation' : ''}" style="animation: fadeInUp 0.6s ease ${index * 0.1}s both;">
                    <div class="donation-info">
                        <div class="donation-amount">${formatCurrency(donation.amount)}</div>
                        <div class="donation-meta">
                            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap; margin-bottom: 5px;">
                                <span style="display: flex; align-items: center; gap: 5px;">
                                    👤 <strong>${donation.name || "Anonim"}</strong>
                                </span>
                                <span style="display: flex; align-items: center; gap: 5px;">
                                    🕐 ${timeAgo}
                                </span>
                                ${isRecent ? '<span style="background: linear-gradient(135deg, #28a745, #20c997); padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600;">BARU</span>' : ''}
                            </div>
                            ${donation.note ? `<div style="margin-top: 8px; display: flex; align-items: flex-start; gap: 5px;"><span>💬</span><em style="opacity: 0.9;">${donation.note}</em></div>` : ''}
                        </div>
                    </div>
                    <div class="donation-actions">
                        <button class="btn-view" onclick="viewDetail(${index})" title="Lihat Detail">
                            Detail
                        </button>
                    </div>
                </div>
            `;
        })
        .join("");

    const recentStyle = document.createElement('style');
    recentStyle.textContent = `
        .recent-donation {
            border-color: rgba(40, 167, 69, 0.3) !important;
            background: rgba(40, 167, 69, 0.05) !important;
            box-shadow: 0 0 20px rgba(40, 167, 69, 0.2) !important;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    
    if (!document.getElementById('recent-donation-style')) {
        recentStyle.id = 'recent-donation-style';
        document.head.appendChild(recentStyle);
    }
}

// Utility functions
function getTimeAgo(timestamp) {
    const now = new Date();
    const donationTime = new Date(timestamp);
    const diffMs = now - donationTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 30) return `${diffDays} hari lalu`;
    
    return donationTime.toLocaleDateString("id-ID", { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: "Asia/Jakarta" 
    });
}

function isRecentDonation(timestamp) {
    const now = new Date();
    const donationTime = new Date(timestamp);
    const diffHours = (now - donationTime) / 3600000;
    return diffHours < 24;
}

// View donation detail
function viewDetail(index) {
    const donation = donations[index];
    const modal = document.getElementById("detailModal");
    const content = document.getElementById("modalContent");
    
    const donationDate = new Date(donation.timestamp);
    const timeAgo = getTimeAgo(donation.timestamp);
    
    content.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 4rem; margin-bottom: 15px;">💝</div>
            <h2 style="font-family: 'Playfair Display', serif; color: #212529; margin-bottom: 10px;">Detail Donasi</h2>
            <div style="width: 60px; height: 3px; background: linear-gradient(135deg, #212529, #495057); margin: 0 auto; border-radius: 2px;"></div>
        </div>
        
        <div style="background: linear-gradient(135deg, rgba(0,0,0,0.02), rgba(0,0,0,0.05)); padding: 25px; border-radius: 15px; margin-bottom: 20px;">
            <div style="display: grid; gap: 20px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 1.5rem;">👤</span>
                    <div>
                        <div style="font-size: 0.9rem; color: #6c757d; margin-bottom: 5px;">Donatur</div>
                        <div style="font-weight: 600; font-size: 1.1rem;">${donation.name || "Anonim"}</div>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 1.5rem;">💰</span>
                    <div>
                        <div style="font-size: 0.9rem; color: #6c757d; margin-bottom: 5px;">Jumlah Donasi</div>
                        <div style="font-weight: 700; font-size: 1.3rem; color: #28a745;">${formatCurrency(donation.amount)}</div>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 1.5rem;">📅</span>
                    <div>
                        <div style="font-size: 0.9rem; color: #6c757d; margin-bottom: 5px;">Waktu Donasi</div>
                        <div style="font-weight: 600;">${donationDate.toLocaleDateString("id-ID", { 
                            weekday: 'long',
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            timeZone: "Asia/Jakarta" 
                        })}</div>
                        <div style="font-size: 0.9rem; color: #6c757d;">${donationDate.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} • ${timeAgo}</div>
                    </div>
                </div>
                
                ${donation.note ? `
                    <div style="display: flex; align-items: flex-start; gap: 15px;">
                        <span style="font-size: 1.5rem;">💭</span>
                        <div style="flex: 1;">
                            <div style="font-size: 0.9rem; color: #6c757d; margin-bottom: 5px;">Catatan</div>
                            <div style="font-style: italic; line-height: 1.6; background: rgba(0,0,0,0.02); padding: 15px; border-radius: 10px; border-left: 4px solid #17a2b8;">"${donation.note}"</div>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, rgba(40,167,69,0.1), rgba(32,201,151,0.1)); border-radius: 10px; border: 1px solid rgba(40,167,69,0.2);">
            <div style="font-size: 1.5rem; margin-bottom: 10px;">🙏</div>
            <p style="color: #28a745; font-weight: 600; margin: 0;">Terima kasih atas kontribusi yang luar biasa!</p>
        </div>
    `;
    
    modal.style.display = "block";
    modal.style.animation = 'fadeIn 0.3s ease';
}
window.viewDetail = viewDetail;

function closeModal() {
    const modal = document.getElementById("detailModal");
    modal.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
        modal.style.display = "none";
    }, 300);
}
window.closeModal = closeModal;

// Render admin donations (protected function)
function renderAdminDonations() {
    if (!isAdminLoggedIn) {
        showNotification("Akses ditolak! Silakan login terlebih dahulu.", "error");
        return;
    }

    const container = document.getElementById("adminDonationsList");
    if (!container) return;

    if (donations.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">Belum ada donasi untuk dikelola</p>';
        return;
    }

    const sorted = [...donations].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    container.innerHTML = sorted
        .map((donation, index) => `
            <div class="admin-donation-item" style="background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.1); padding: 15px; border-radius: 10px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 5px;">${formatCurrency(donation.amount)} - ${donation.name || "Anonim"}</div>
                        <div style="font-size: 0.8rem; color: #6c757d;">
                            ${new Date(donation.timestamp).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                            ${donation.note ? `<br><em>"${donation.note}"</em>` : ''}
                        </div>
                    </div>
                    <button class="btn-delete" onclick="deleteDonation('${donation.id}')" style="padding: 5px 10px; font-size: 0.8rem;">
                        Hapus
                    </button>
                </div>
            </div>
        `)
        .join("");
}

// Delete donation (protected function)
async function deleteDonation(donationId) {
    if (!isAdminLoggedIn) {
        showNotification("Akses ditolak! Silakan login terlebih dahulu.", "error");
        return;
    }

    if (!confirm("Yakin ingin menghapus donasi ini?")) return;

    try {
        const { error } = await supabase
            .from("donations")
            .delete()
            .eq("id", donationId);

        if (error) {
            console.error("Delete error:", error);
            showNotification("Gagal menghapus donasi!", "error");
            return;
        }

        showNotification("Donasi berhasil dihapus", "success");
        await loadDataSupabase();
        renderAdminDonations();
    } catch (error) {
        console.error("Delete donation error:", error);
        showNotification("Terjadi kesalahan saat menghapus donasi", "error");
    }
}
window.deleteDonation = deleteDonation;

// Format input donation
const donationInput = document.getElementById("donationAmount");
if (donationInput) {
    donationInput.addEventListener("input", function(e) {
        let value = e.target.value.replace(/\D/g, "");
        if (value) {
            e.target.dataset.raw = value; 
            e.target.value = "Rp " + new Intl.NumberFormat("id-ID").format(value);
        } else {
            e.target.dataset.raw = "";
            e.target.value = "";
        }
    });
}

// Add donation (protected function)
const donationForm = document.getElementById("donationForm");
if (donationForm) {
    donationForm.addEventListener("submit", async e => {
        e.preventDefault();
        
        if (!isAdminLoggedIn) {
            showNotification("Akses ditolak! Silakan login terlebih dahulu.", "error");
            return;
        }
        
        if (isLoading) {
            showNotification("Sedang memproses, mohon tunggu...", "warning");
            return;
        }

        const donor = document.getElementById("donorName").value.trim() || null;
        const rawAmount = donationInput.dataset.raw || "0";
        const amount = Number(rawAmount);
        const note = document.getElementById("donationNote").value.trim() || null;

        if (!amount || amount <= 0) {
            showNotification("Jumlah donasi tidak valid!", "error");
            return;
        }

        if (amount > 1000000000) {
            showNotification("Jumlah donasi terlalu besar!", "error");
            return;
        }

        try {
            isLoading = true;
            showNotification("Menambahkan donasi...", "info");

            const { error } = await supabase.from("donations").insert([
                { milestone_id: milestoneId, donor_name: donor, amount, note }
            ]);

            if (error) {
                console.error("Insert error:", error);
                showNotification("Gagal menambahkan donasi!", "error");
                return;
            }

            donationForm.reset();
            donationInput.dataset.raw = "";
            
            await loadDataSupabase();
            
            showNotification(`Donasi ${formatCurrency(amount)} berhasil ditambahkan!`, "success");
            
            setTimeout(() => {
                toggleAdmin();
            }, 2000);

        } catch (error) {
            console.error("Add donation error:", error);
            showNotification("Terjadi kesalahan saat menambahkan donasi", "error");
        } finally {
            isLoading = false;
        }
    });
}

// Format input target
const targetInput = document.getElementById("newTarget");
if (targetInput) {
    targetInput.addEventListener("input", function(e) {
        let value = e.target.value.replace(/\D/g, "");
        if (value) {
            e.target.dataset.raw = value; 
            e.target.value = "Rp " + new Intl.NumberFormat("id-ID").format(value);
        } else {
            e.target.dataset.raw = "";
            e.target.value = "";
        }
    });
}

// Update target (protected function)
async function updateTarget() {
    if (!isAdminLoggedIn) {
        showNotification("Akses ditolak! Silakan login terlebih dahulu.", "error");
        return;
    }

    if (isLoading) {
        showNotification("Sedang memproses, mohon tunggu...", "warning");
        return;
    }

    const rawValue = targetInput.dataset.raw || "";
    const newTarget = Number(rawValue);

    if (!newTarget || newTarget <= 0) {
        showNotification("Target tidak valid!", "error");
        return;
    }

    if (newTarget > 10000000000) {
        showNotification("Target terlalu besar!", "error");
        return;
    }

    if (!milestoneId) {
        showNotification("Milestone belum ditemukan!", "error");
        return;
    }

    try {
        isLoading = true;
        showNotification("Mengupdate target...", "info");

        const { error } = await supabase
            .from("milestones")
            .update({ target_amount: newTarget })
            .eq("id", milestoneId);

        if (error) {
            console.error("Update target error:", error);
            showNotification("Gagal update target!", "error");
            return;
        }

        targetAmount = newTarget;
        targetInput.dataset.raw = "";
        targetInput.value = "";
        
        await loadDataSupabase();
        showNotification(`Target berhasil diperbarui menjadi ${formatCurrency(newTarget)}!`, "success");

    } catch (error) {
        console.error("Update target error:", error);
        showNotification("Terjadi kesalahan saat mengupdate target", "error");
    } finally {
        isLoading = false;
    }
}
window.updateTarget = updateTarget;

// Reset data (protected function)
async function resetTarget() {
    if (!isAdminLoggedIn) {
        showNotification("Akses ditolak! Silakan login terlebih dahulu.", "error");
        return;
    }

    if (!confirm("⚠️ PERINGATAN!\n\nIni akan menghapus SEMUA data donasi dan reset target ke nilai default.\n\nApakah Anda yakin ingin melanjutkan?\n\nTindakan ini TIDAK DAPAT DIBATALKAN!")) {
        return;
    }

    if (!confirm("Konfirmasi sekali lagi: Yakin ingin menghapus semua data?")) {
        return;
    }

    try {
        isLoading = true;
        showNotification("Mereset semua data...", "warning");

        const { error: deleteError } = await supabase
            .from("donations")
            .delete()
            .eq("milestone_id", milestoneId);

        if (deleteError) {
            console.error("Delete donations error:", deleteError);
            showNotification("Gagal menghapus donasi!", "error");
            return;
        }

        const { error: updateError } = await supabase
            .from("milestones")
            .update({ target_amount: 50000000 })
            .eq("id", milestoneId);

        if (updateError) {
            console.error("Reset target error:", updateError);
            showNotification("Gagal reset target!", "error");
            return;
        }

        await loadDataSupabase();
        
        showNotification("✅ Semua data berhasil direset!", "success");
        
        setTimeout(() => {
            toggleAdmin();
        }, 2000);

    } catch (error) {
        console.error("Reset data error:", error);
        showNotification("Terjadi kesalahan saat mereset data", "error");
    } finally {
        isLoading = false;
    }
}
window.resetTarget = resetTarget;

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const adminPanel = document.getElementById('adminPanel');
        const detailModal = document.getElementById('detailModal');
        const loginModal = document.getElementById('loginModal');
        const changePasswordModal = document.getElementById('changePasswordModal');
        
        if (changePasswordModal && changePasswordModal.classList.contains('active')) {
            closeChangePassword();
        } else if (loginModal && loginModal.classList.contains('active')) {
            closeLogin();
        } else if (adminPanel && adminPanel.classList.contains('active')) {
            toggleAdmin();
        } else if (detailModal && detailModal.style.display === 'block') {
            closeModal();
        }
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        checkAdminLogin();
    }
});

// Auto refresh data
let refreshInterval;

function startAutoRefresh() {
    refreshInterval = setInterval(async () => {
        if (!isLoading && 
            !document.getElementById('adminPanel').classList.contains('active') &&
            !document.getElementById('loginModal').classList.contains('active')) {
            await loadDataSupabase();
        }
    }, 30000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
}

// Visibility change handler
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        startAutoRefresh();
        setTimeout(loadDataSupabase, 1000);
    }
});

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing GGM Fundraising App with Admin Login...');
    
    showNotification("Memuat data penggalangan dana...", "info");
    
    // Initialize admin system
    await initializeAdminTable();
    
    // Check admin session
    checkAdminSession();
    
    // Load data
    await loadDataSupabase();
    startAutoRefresh();
    
    document.documentElement.style.scrollBehavior = 'smooth';
    
    console.log('✅ App initialized successfully!');
});

// Window load event
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
    
    const progressBar = document.getElementById('progressBar');
    if (progressBar && progressBar.style.width === '0%') {
        setTimeout(() => {
            progressBar.style.transition = 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
        }, 500);
    }
});

// Error handling
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    showNotification("Terjadi kesalahan pada aplikasi", "error");
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    showNotification("Terjadi kesalahan koneksi", "error");
});

// Export functions for global access
window.loadDataSupabase = loadDataSupabase;

