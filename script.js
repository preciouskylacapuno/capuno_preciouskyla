// ------------------- Supabase Setup -------------------
const SUPABASE_URL = 'https://rkofwwpugihunpefzian.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrb2Z3d3B1Z2lodW5wZWZ6aWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzY1MjUsImV4cCI6MjA4OTM1MjUyNX0.iaVsukYdpQHNqOYR4mUk8UE9-aZKORZBjD5q9BOJoNI';
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_EMAIL = 'jcesperanza@neu.edu.ph';

// ------------------- Visitor/Admin Toggle (Login Page Only) -------------------
const visitorBtn = document.getElementById('visitorBtn');
const adminBtn = document.getElementById('adminBtn');

if (visitorBtn && adminBtn) {
    visitorBtn.addEventListener('click', () => {
        visitorBtn.classList.add('active');
        adminBtn.classList.remove('active');
        document.querySelectorAll('.visitor-field').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.admin-field').forEach(el => el.classList.add('hidden'));
    });

    adminBtn.addEventListener('click', () => {
        adminBtn.classList.add('active');
        visitorBtn.classList.remove('active');
        document.querySelectorAll('.admin-field').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.visitor-field').forEach(el => el.classList.add('hidden'));
    });
}

// ------------------- Handle OAuth Redirect -------------------
async function handleOAuthRedirect() {
    const { data, error } = await supabaseClient.auth.getSessionFromUrl();
    if (data?.session) {
        checkUserRole(data.session.user.email);
    }
}

// ------------------- Google Login Button -------------------
const googleBtn = document.getElementById('googleLogin');
if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
        if (error) alert("Login failed: " + error.message);
    });
}

// ------------------- Check User Role & Redirect -------------------
async function checkUserRole(email) {
    if (!email) return;

    if (email === ADMIN_EMAIL) {
        // Redirect to dashboard if currently on the login page
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            window.location.href = 'dashboard.html';
        } else {
            // If already on dashboard, load the data
            loadDashboardStats();
        }
    } else {
        alert("Welcome to NEU Library!");
    }
}

// ------------------- Visitor Log Submission -------------------
const logBtn = document.getElementById('logBtn');
if (logBtn) {
    logBtn.addEventListener('click', async () => {
        const fullName = document.getElementById('fullName').value;
        const idNum = document.getElementById('idNum')?.value || "";
        const reason = document.getElementById('reason').value;
        const college = document.getElementById('college')?.value;
        const userType = document.getElementById('userType')?.value;

        if (!fullName || !idNum || !reason || !college || !userType) {
            alert("Please fill in all fields");
            return;
        }

        const { error } = await supabaseClient
            .from('visitor_logs')
            .insert([{
                full_name: fullName,
                id_number: idNum,
                reason: reason,
                college: college,
                user_type: userType,
                is_employee: (userType === "Teacher" || userType === "Staff"),
                visit_date: new Date().toISOString()
            }]);

        if (error) alert("Failed to log visitor");
        else alert("Visitor logged successfully!");
    });
}

// ------------------- Dashboard Logic (Admin Only) -------------------
let trafficChart, reasonChart, collegeChart;

async function loadDashboardStats() {
    const selectedCollege = document.getElementById('collegeFilter')?.value;
    const selectedReason = document.getElementById('reasonFilter')?.value;

    let query = supabaseClient.from('visitor_logs').select('*');

    // Apply Real-time filters from the dashboard UI
    if (selectedCollege) query = query.eq('college', selectedCollege);
    if (selectedReason) query = query.eq('reason', selectedReason);

    const { data, error } = await query;
    if (error) { console.error(error); return; }

    // 1. Update Stats Cards
    document.getElementById('totalCount').innerText = data.length.toLocaleString();
    document.getElementById('employeeCount').innerText = data.filter(d => d.is_employee).length;

    // Find Top College
    const collegeCounts = data.reduce((acc, log) => {
        acc[log.college] = (acc[log.college] || 0) + 1;
        return acc;
    }, {});
    const top = Object.keys(collegeCounts).reduce((a, b) => collegeCounts[a] > collegeCounts[b] ? a : b, "--");
    document.getElementById('topCollege').innerText = top;

    // 2. Render Visuals
    renderDashboardCharts(data);
    loadTableData(data);
}

function renderDashboardCharts(logs) {
    const teal = '#4bc0c0';
    const neuBlue = '#0044aa';

    // Helper to group data for charts
    const groupBy = (arr, key) => arr.reduce((acc, obj) => {
        acc[obj[key]] = (acc[obj[key]] || 0) + 1;
        return acc;
    }, {});

    const reasons = groupBy(logs, 'reason');
    const colleges = groupBy(logs, 'college');

    // Traffic Chart (Line)
    const ctx1 = document.getElementById('trafficChart')?.getContext('2d');
    if (ctx1) {
        if (trafficChart) trafficChart.destroy();
        trafficChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{ label: 'Visitors', data: [120, 190, 150, 280, 320, 110, 90], borderColor: teal, tension: 0.4, fill: true, backgroundColor: 'rgba(75, 192, 192, 0.1)' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Reason Chart (Donut)
    const ctx2 = document.getElementById('reasonDonutChart')?.getContext('2d');
    if (ctx2) {
        if (reasonChart) reasonChart.destroy();
        reasonChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: Object.keys(reasons),
                datasets: [{ data: Object.values(reasons), backgroundColor: [teal, '#36a2eb', '#ffce56', '#9966ff'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function loadTableData(logs) {
    const tbody = document.getElementById('liveTableBody');
    if (!tbody) return;
    tbody.innerHTML = logs.slice(0, 10).map(log => `
        <tr>
            <td>${new Date(log.visit_date).toLocaleString()}</td>
            <td>${log.id_number}</td>
            <td>${log.full_name}</td>
            <td>${log.college}</td>
            <td>${log.reason}</td>
        </tr>
    `).join('');
}

// ------------------- Admin Dashboard Event Listeners -------------------
document.getElementById('collegeFilter')?.addEventListener('change', loadDashboardStats);
document.getElementById('reasonFilter')?.addEventListener('change', loadDashboardStats);
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
});

// ------------------- Initialization -------------------
handleOAuthRedirect().then(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) checkUserRole(session.user.email);
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) checkUserRole(session.user.email);
});