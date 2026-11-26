// ==================== GLOBAL VARIABLES ====================
  var currentUser = null;
  var userRole = 'Public';
  var config = null;
  var currentShieldYear = null; // Will be set to most recent year with data
  var shieldSchoolsUnits = [];
  var currentCalendarMonth = new Date().getMonth();
  var currentCalendarYear = new Date().getFullYear();
  
  // Auto-refresh settings
  var autoRefreshInterval = null;
  var autoRefreshSeconds = 60; // Refresh every 60 seconds
  var autoRefreshEnabled = true;
  var currentPage = 'dashboard';

  // ==================== INITIALIZATION ====================
  document.addEventListener('DOMContentLoaded', function() { 
    initializeApp(); 
  });

function initializeApp() {
    showLoading();
    var s = reconApi.getSession();
    var wantGuest = new URLSearchParams(window.location.search).get('guest') === 'true';
    function useGuest() {
      currentUser = null; userRole = 'Public';
      reconApi.post('guest', []).then(function(j) {
        if (j.ok) reconApi.setSession({ token: j.data.token, user: j.data.user });
      }).catch(function() {}).then(function() { loadConfigAndStart(); });
    }
    if (wantGuest) { reconApi.clearSession(); try { history.replaceState({}, document.title, location.pathname + location.hash); } catch(e) {} useGuest(); return; }
    if (!s || !s.token) { useGuest(); return; }
    if (s.user && s.user.role === 'Guest') { currentUser = null; userRole = 'Public'; loadConfigAndStart(); return; }
    reconApi.call('me', []).then(function(u) {
      currentUser = u; userRole = u.role;
      s.user = u; reconApi.setSession(s);
      loadConfigAndStart();
    }, function(err) {
      if (err && err.code) return; // AUTH/MUST_CHANGE handled by api.js (redirects)
      currentUser = s.user; userRole = s.user.role; // offline: trust stored session
      loadConfigAndStart();
    });
  }

  
// ==================== AUTO-REFRESH ====================
  function startAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    
    if (autoRefreshEnabled) {
      autoRefreshInterval = setInterval(function() {
        console.log('Auto-refreshing page: ' + currentPage);
        refreshCurrentPage(true); // Pass true to indicate auto-refresh
      }, autoRefreshSeconds * 1000);
      
      updateRefreshIndicator(true);
    }
  }
  
  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
    updateRefreshIndicator(false);
  }
  
  function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    if (autoRefreshEnabled) {
      startAutoRefresh();
      showToast('Auto-refresh enabled', 'success');
    } else {
      stopAutoRefresh();
      showToast('Auto-refresh disabled', 'info');
    }
  }
  
  function updateRefreshIndicator(active) {
    var indicator = document.getElementById('refreshIndicator');
    if (indicator) {
      indicator.className = active ? 'refresh-indicator active' : 'refresh-indicator';
      indicator.title = active ? 'Auto-refresh ON (every ' + autoRefreshSeconds + 's) - Click to disable' : 'Auto-refresh OFF - Click to enable';
    }
  }
  
  // Subtle corner spinner for auto-refresh (non-intrusive)
  function showCornerSpinner() {
    var el = document.getElementById('cornerSpinner');
    if (el) el.classList.add('active');
  }

  function hideCornerSpinner() {
    var el = document.getElementById('cornerSpinner');
    if (el) el.classList.remove('active');
  }
  
  function refreshCurrentPage(isAutoRefresh) {
    // Show corner spinner for auto-refresh, full overlay for manual
    if (isAutoRefresh) {
      showCornerSpinner();
    }
    
    switch(currentPage) {
      case 'dashboard':
        loadDashboard(isAutoRefresh);
        break;
      case 'cadets':
        loadCadets(isAutoRefresh);
        break;
      case 'star-exams':
        loadStarExams(isAutoRefresh);
        break;
      case 'shield':
        loadShieldCompetition(isAutoRefresh);
        break;
      case 'courses':
        loadCourses(isAutoRefresh);
        break;
      case 'resources':
        loadResources(isAutoRefresh);
        break;
      case 'announcements':
        loadAnnouncements(isAutoRefresh);
        break;
      case 'reviews':
        loadReviews(isAutoRefresh);
        break;
      case 'calendar':
        loadCalendar(isAutoRefresh);
        break;
      case 'users':
        if (isAdmin()) loadUsers(isAutoRefresh);
        break;
      default:
        loadDashboard(isAutoRefresh);
    }
  }
  
  function manualRefresh() {
    showLoading();
    refreshCurrentPage(false); // false = not auto-refresh, use full overlay
    showToast('Data refreshed', 'success');
  }

  function loadConfigAndStart() {
    google.script.run
      .withSuccessHandler(function(cfg) {
        config = cfg || { battalions: [], cadetRanks: [], officerRanks: [], roles: [], shieldCategories: [], starLevels: [] };
        finishInit();
      })
      .withFailureHandler(function(err) {
        console.error('Config error:', err);
        config = { battalions: [], cadetRanks: [], officerRanks: [], roles: [], shieldCategories: [], starLevels: [] };
        finishInit();
      })
      .getConfiguration();
  }

  function finishInit() {
    updateUIForRole();
    setupNavigation();
    currentPage = 'dashboard';
    loadDashboard();
    
    // Start auto-refresh
    startAutoRefresh();
    
    var app = document.getElementById('app');
    if (app) app.classList.add('loaded');
    hideLoading();
  }

  // ==================== UI ROLE MANAGEMENT ====================
  function updateUIForRole() {
    var userNameEl = document.getElementById('currentUserName');
    var userRoleEl = document.getElementById('currentUserRole');
    var loginBtn = document.getElementById('loginBtn');
    var logoutBtn = document.getElementById('logoutBtn');
    var logoutBtnHeader = document.getElementById('logoutBtnHeader');
    var guestBanner = document.getElementById('guestBanner');
    
    if (currentUser) {
      if (userNameEl) userNameEl.textContent = currentUser.firstName + ' ' + currentUser.lastName;
      if (userRoleEl) userRoleEl.textContent = currentUser.role;
      if (loginBtn) loginBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'inline-flex';
      if (logoutBtnHeader) logoutBtnHeader.style.display = 'inline-flex';
      if (guestBanner) guestBanner.classList.remove('show');
    } else {
      if (userNameEl) userNameEl.textContent = 'Guest';
      if (userRoleEl) userRoleEl.textContent = 'View Only';
      if (loginBtn) loginBtn.style.display = 'inline-flex';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (logoutBtnHeader) logoutBtnHeader.style.display = 'none';
      if (guestBanner) guestBanner.classList.add('show');
    }
    
    var adminElements = document.querySelectorAll('.admin-only');
    for (var i = 0; i < adminElements.length; i++) {
      adminElements[i].style.display = isAdmin() ? '' : 'none';
    }
    
    // Show admin-instructor-only elements (cadets stats, cadets tab) for Admin, Super Admin, and Instructor
    var adminInstructorElements = document.querySelectorAll('.admin-instructor-only');
    for (var i = 0; i < adminInstructorElements.length; i++) {
      adminInstructorElements[i].style.display = isStaff() ? '' : 'none';
    }
    
    // Hide dashboard stats for non-admin users (Guest, Instructor, User)
    var statsGrid = document.getElementById('statsGrid');
    if (statsGrid) statsGrid.style.display = isStaff() ? '' : 'none';
    
    var userNav = document.querySelector('[data-page="users"]');
    if (userNav) userNav.style.display = isAdmin() ? '' : 'none';
    
    // Show Cadets tab only for logged-in users
    var cadetsNav = document.querySelector('[data-page="cadets"]');
    if (cadetsNav) cadetsNav.style.display = isStaff() ? '' : 'none';
    
    // Show Star Exams tab only for logged-in users
    var starExamsNav = document.querySelector('[data-page="star-exams"]');
    if (starExamsNav) starExamsNav.style.display = isLoggedIn() ? '' : 'none';
    
    // Show logged-in-only elements for any authenticated user
    var loggedInElements = document.querySelectorAll('.logged-in-only');
    for (var i = 0; i < loggedInElements.length; i++) {
      loggedInElements[i].style.display = isLoggedIn() ? '' : 'none';
    }
    
    var shieldBtn = document.getElementById('btnAddShieldResult');
    if (shieldBtn) shieldBtn.style.display = (isAdmin() || userRole === 'Instructor' || userRole === 'Battalion Commander') ? 'inline-flex' : 'none';
    if (window.reconUiRole) window.reconUiRole();
  }

  function isLoggedIn() { return currentUser !== null && userRole !== 'Public'; }
  function isSuperAdmin() { return userRole === 'Super Admin'; }
  function isAdmin() { return userRole === 'Admin' || userRole === 'Super Admin'; }
  function isInstructor() { return userRole === 'Instructor' || userRole === 'Admin' || userRole === 'Super Admin'; }
  // Unit Officer / Battalion Commander see their own scope read-only (server enforces scope)
  function isStaff() { return isInstructor() || userRole === 'Battalion Commander' || userRole === 'Unit Officer'; }

  // ==================== NAVIGATION ====================
  function setupNavigation() {
    var navItems = document.querySelectorAll('.nav-item[data-page]');
    for (var i = 0; i < navItems.length; i++) {
      navItems[i].addEventListener('click', function() {
        var page = this.getAttribute('data-page');
        navigateTo(page);
      });
    }
  }

  function navigateTo(page) {
    // Check permission for cadets page - only admins and instructors
    if (page === 'shield-import' && !isAdmin()) {
      showToast('Access denied. Only Admins can import results.', 'error');
      return;
    }
    if (page === 'competitions' && !(window.reconCompAllowed && window.reconCompAllowed())) {
      showToast('Access denied. Competitions is for Judges and Admins.', 'error');
      return;
    }
    if (page === 'roll' && !(window.reconRollAllowed && window.reconRollAllowed())) {
      showToast('Access denied. Registration is for Unit Officers, Battalion Commanders and Admins.', 'error');
      return;
    }
    if ((page === 'cadets' || page === 'reports') && !isStaff()) {
      showToast('Access denied. Your role cannot open this page.', 'error');
      return;
    }
    
    // Check permission for star exams page - logged-in users only
    if (page === 'star-exams' && !isLoggedIn()) {
      showToast('Please log in to access Star Examinations.', 'error');
      return;
    }
    
    var navItems = document.querySelectorAll('.nav-item');
    for (var i = 0; i < navItems.length; i++) {
      navItems[i].classList.remove('active');
    }
    var navItem = document.querySelector('[data-page="' + page + '"]');
    if (navItem) navItem.classList.add('active');
    
    var titles = { 
      'dashboard': 'Dashboard', 
      'cadets': 'Cadet Records', 
      'star-exams': 'Star Exams', 
      'shield': 'Shield Competition', 
      'courses': 'Courses', 
      'resources': 'Resources',
      'announcements': 'Announcements',
      'reviews': 'Views & Reviews',
      'calendar': 'Calendar', 
      'users': 'User Management',
      'reports': 'Reports',
      'shield-import': 'Import Shield results',
      'roll': 'Platoon registration',
      'competitions': 'Competitions'
    };
    var titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[page] || page;
    
    var pages = document.querySelectorAll('.page');
    for (var j = 0; j < pages.length; j++) {
      pages[j].classList.remove('active');
    }
    var pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');
    
    // Track current page for auto-refresh
    currentPage = page;
    
    loadPageData(page);
    
    // Restart auto-refresh timer when navigating
    if (autoRefreshEnabled) {
      startAutoRefresh();
    }
    
    var sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth < 768) {
      sidebar.classList.remove('open');
    }
  }

  function loadPageData(page, isAutoRefresh) {
  if (!isAutoRefresh) {
    showLoading();
  }
  // ... rest of the function stays the same
    switch(page) {
      case 'dashboard': loadDashboard(); break;
      case 'cadets': loadCadets(); break;
      case 'star-exams': initStarExamTabs(); loadStarExams(); break;
      case 'shield': loadShieldCompetition(); break;
      case 'courses': loadCourses(); break;
      case 'resources': loadResources(); break;
      case 'announcements': loadAnnouncements(); break;
      case 'reviews': loadReviews(); break;
      case 'calendar': loadCalendar(); break;
      case 'reports': if (window.loadReports) window.loadReports(); break;
      case 'shield-import': if (window.loadShieldImport) window.loadShieldImport(); break;
      case 'roll': if (window.loadRoll) window.loadRoll(); break;
      case 'competitions': if (window.loadCompetitions) window.loadCompetitions(); break;
      case 'users': 
        if (isAdmin()) { loadUsers(); } else { hideLoading(); }
        break;
      default: hideLoading();
    }
  }

  // ==================== GLOBAL SEARCH ====================
  var searchTimeout = null;
  var lastSearchQuery = '';
  
  function handleSearchKeyup(event) {
    var query = document.getElementById('globalSearch').value.trim();
    
    // Close on Escape
    if (event.key === 'Escape') {
      hideSearchResults();
      document.getElementById('globalSearch').blur();
      return;
    }
    
    // Search on Enter
    if (event.key === 'Enter') {
      performGlobalSearch();
      return;
    }
    
    // Debounce auto-search
    clearTimeout(searchTimeout);
    if (query.length >= 2) {
      searchTimeout = setTimeout(function() {
        performGlobalSearch();
      }, 300);
    } else if (query.length === 0) {
      hideSearchResults();
    }
  }
  
  function performGlobalSearch() {
    var query = document.getElementById('globalSearch').value.trim();
    var dropdown = document.getElementById('searchResults');
    
    if (query.length < 2) {
      hideSearchResults();
      return;
    }
    
    if (query === lastSearchQuery) {
      return; // Avoid duplicate searches
    }
    lastSearchQuery = query;
    
    // Show loading state
    dropdown.innerHTML = '<div class="search-loading"><i class="fas fa-spinner"></i> Searching...</div>';
    dropdown.classList.add('show');
    
    google.script.run
      .withSuccessHandler(function(results) {
        displaySearchResults(results, query);
      })
      .withFailureHandler(function(err) {
        dropdown.innerHTML = '<div class="search-no-results"><i class="fas fa-exclamation-circle"></i>Error searching. Please try again.</div>';
      })
      .globalSearch(query);
  }
  
  function displaySearchResults(results, query) {
    var dropdown = document.getElementById('searchResults');
    
    // Check for results (cadets only count for admin/instructor)
    var hasCadets = isInstructor() && results.cadets && results.cadets.length > 0;
    var hasCourses = results.courses && results.courses.length > 0;
    var hasAnnouncements = results.announcements && results.announcements.length > 0;
    var hasEvents = results.events && results.events.length > 0;
    var hasShield = results.shield && results.shield.length > 0;
    
    if (!results || (!hasCadets && !hasCourses && !hasAnnouncements && !hasEvents && !hasShield)) {
      dropdown.innerHTML = '<div class="search-no-results"><i class="fas fa-search"></i>No results found for "' + escapeHtml(query) + '"</div>';
      dropdown.classList.add('show');
      return;
    }
    
    var html = '';
    
    // Cadets
    if (results.cadets && results.cadets.length > 0) {
      html += '<div class="search-category"><i class="fas fa-users"></i>Cadets (' + results.cadets.length + ')</div>';
      for (var i = 0; i < Math.min(results.cadets.length, 5); i++) {
        var c = results.cadets[i];
        html += '<div class="search-result-item" onclick="goToSearchResult(\'cadets\', \'' + (c.id || '') + '\')">' +
          '<div class="search-result-title">' + escapeHtml((c.rank || '') + ' ' + (c.surname || '') + ', ' + (c.first_name || '')) + '</div>' +
          '<div class="search-result-meta">' +
            '<span><i class="fas fa-id-badge"></i> ' + escapeHtml(c.regimental_number || 'N/A') + '</span>' +
            '<span><i class="fas fa-building"></i> ' + escapeHtml(c.battalion || 'N/A') + '</span>' +
          '</div></div>';
      }
      if (results.cadets.length > 5) {
        html += '<div class="search-result-item" onclick="goToSearchResult(\'cadets\')"><em>View all ' + results.cadets.length + ' cadets...</em></div>';
      }
    }
    
    // Courses
    if (results.courses && results.courses.length > 0) {
      html += '<div class="search-category"><i class="fas fa-graduation-cap"></i>Courses (' + results.courses.length + ')</div>';
      for (var j = 0; j < Math.min(results.courses.length, 5); j++) {
        var course = results.courses[j];
        html += '<div class="search-result-item" onclick="goToSearchResult(\'courses\', \'' + (course.id || '') + '\')">' +
          '<div class="search-result-title">' + escapeHtml(course.course_name || course.name || '') + '</div>' +
          '<div class="search-result-meta">' +
            '<span><i class="fas fa-map-marker-alt"></i> ' + escapeHtml(course.location || 'TBD') + '</span>' +
            '<span class="badge badge-' + (course.status === 'Open' ? 'success' : 'secondary') + '">' + escapeHtml(course.status || '') + '</span>' +
          '</div></div>';
      }
    }
    
    // Announcements
    if (results.announcements && results.announcements.length > 0) {
      html += '<div class="search-category"><i class="fas fa-bullhorn"></i>Announcements (' + results.announcements.length + ')</div>';
      for (var k = 0; k < Math.min(results.announcements.length, 3); k++) {
        var ann = results.announcements[k];
        html += '<div class="search-result-item" onclick="goToSearchResult(\'announcements\')">' +
          '<div class="search-result-title">' + escapeHtml(ann.title || '') + '</div>' +
          '<div class="search-result-meta">' +
            '<span><i class="fas fa-tag"></i> ' + escapeHtml(ann.category || 'General') + '</span>' +
          '</div></div>';
      }
    }
    
    // Events
    if (results.events && results.events.length > 0) {
      html += '<div class="search-category"><i class="fas fa-calendar"></i>Events (' + results.events.length + ')</div>';
      for (var m = 0; m < Math.min(results.events.length, 3); m++) {
        var evt = results.events[m];
        html += '<div class="search-result-item" onclick="goToSearchResult(\'calendar\')">' +
          '<div class="search-result-title">' + escapeHtml(evt.title || evt.event_name || '') + '</div>' +
          '<div class="search-result-meta">' +
            '<span><i class="fas fa-clock"></i> ' + escapeHtml(evt.event_date || '') + '</span>' +
            '<span><i class="fas fa-map-marker-alt"></i> ' + escapeHtml(evt.location || 'TBD') + '</span>' +
          '</div></div>';
      }
    }
    
    // Shield Results
    if (results.shield && results.shield.length > 0) {
      html += '<div class="search-category"><i class="fas fa-trophy"></i>Shield Results (' + results.shield.length + ')</div>';
      for (var n = 0; n < Math.min(results.shield.length, 3); n++) {
        var sr = results.shield[n];
        html += '<div class="search-result-item" onclick="goToSearchResult(\'shield\')">' +
          '<div class="search-result-title">' + escapeHtml(sr.school_unit || '') + '</div>' +
          '<div class="search-result-meta">' +
            '<span><i class="fas fa-award"></i> ' + escapeHtml(sr.category || '') + '</span>' +
            '<span><i class="fas fa-star"></i> ' + (sr.score || 0) + ' pts</span>' +
          '</div></div>';
      }
    }
    
    dropdown.innerHTML = html;
    dropdown.classList.add('show');
  }
  
  function goToSearchResult(page, id) {
    hideSearchResults();
    document.getElementById('globalSearch').value = '';
    lastSearchQuery = '';
    
    navigateTo(page);
    
    // If there's an ID, we could highlight or scroll to that item
    // For now, just navigate to the page
  }
  
  function showSearchResults() {
    var query = document.getElementById('globalSearch').value.trim();
    if (query.length >= 2 && lastSearchQuery === query) {
      document.getElementById('searchResults').classList.add('show');
    }
  }
  
  function hideSearchResults() {
    document.getElementById('searchResults').classList.remove('show');
  }
  
  // Close search results when clicking outside
  document.addEventListener('click', function(event) {
    var searchContainer = document.querySelector('.search-container');
    if (searchContainer && !searchContainer.contains(event.target)) {
      hideSearchResults();
    }
  });

  // ==================== UTILITY FUNCTIONS ====================
  function showLoading() { 
    var el = document.getElementById('loadingOverlay');
    if (el) el.classList.add('active'); 
  }
  
function hideLoading() { 
  var el = document.getElementById('loadingOverlay');
  if (el) el.classList.remove('active');
  hideCornerSpinner(); // Also hide corner spinner
}

  function openModal(modalId) { 
    var el = document.getElementById(modalId || 'modal');
    if (el) el.classList.add('active'); 
  }
  
  function closeModal(modalId) { 
    var el = document.getElementById(modalId || 'modal');
    if (el) el.classList.remove('active'); 
  }

  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span>' + escapeHtml(message) + '</span><button onclick="this.parentElement.remove()">&times;</button>';
    container.appendChild(toast);
    
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() { 
      toast.classList.remove('show'); 
      setTimeout(function() { toast.remove(); }, 300);
    }, 4000);
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function formatDate(date) {
    if (!date) return '-';
    var d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }

function redirectToLogin() { window.location.href = 'login.html'; }


function logout() {
    var t = null; try { t = localStorage.getItem('reconPushToken'); } catch(e) {}
    var done = function() { reconApi.clearSession(); window.location.href = 'login.html'; };
    if (t) { reconApi.call('notifUnregisterDevice', [t]).then(done, done); } else { done(); }
  }

  
  // Force guest mode - clears any stored user data
  function forceGuestMode() {
    currentUser = null;
    userRole = 'Public';
    try {
      
      sessionStorage.clear();
    } catch(e) {}
    updateUIForRole();
  }
  
  // Expose forceGuestMode globally
  window.forceGuestMode = forceGuestMode;

  // ==================== DASHBOARD ====================
  function loadDashboard(isAutoRefresh) {
    if (!isAutoRefresh) showLoading();
    if (isAutoRefresh) showCornerSpinner();
    // Load stats
    google.script.run
      .withSuccessHandler(function(stats) {
        var totalEl = document.getElementById('statTotalCadets') || document.getElementById('totalCadets');
        var activeEl = document.getElementById('statActiveCadets') || document.getElementById('activeCadets');
        var passEl = document.getElementById('statPassRate') || document.getElementById('passRate');
        var coursesEl = document.getElementById('statOpenCourses') || document.getElementById('openCourses');
        
        if (totalEl) totalEl.textContent = (stats && stats.totalCadets) || 0;
        if (activeEl) activeEl.textContent = (stats && stats.activeCadets) || 0;
        if (passEl) passEl.textContent = ((stats && stats.passRate) || 0) + '%';
        if (coursesEl) coursesEl.textContent = (stats && stats.openCourses) || 0;
      })
      .withFailureHandler(function(err) { console.error('Stats error:', err); })
      .getDashboardStats();

    // Load Shield Competition Leaderboard
    // Competition spans academic year (e.g., 2025-2026)
    // First get available years, then load the most recent one
    google.script.run
      .withSuccessHandler(function(data) {
        console.log('Shield data received:', data);
        console.log('Selected year:', data ? data.selectedYear : 'no data');
        console.log('Years available:', data ? data.years : 'no data');
        console.log('Leaderboard count:', data && data.leaderboard ? data.leaderboard.length : 0);
        if (data && data.leaderboard && data.leaderboard.length > 0) {
          console.log('First leaderboard entry:', data.leaderboard[0]);
        }
        
        var container = document.getElementById('dashboardShieldLeaderboard');
        var leaderBanner = document.getElementById('shieldLeaderBanner');
        var leaderSchoolName = document.getElementById('leaderSchoolName');
        var leaderSchoolScore = document.getElementById('leaderSchoolScore');
        var yearEl = document.getElementById('dashboardShieldYear');
        
        if (!container) return;
        
        // Use the selected year from the response (only if there's actual data)
        var competitionYear = data.selectedYear;
        var hasYearsWithData = data.years && data.years.length > 0;
        
        console.log('Has years with data:', hasYearsWithData, 'Competition year:', competitionYear);
        
        // Display as academic year format (e.g., "2025-2026")
        if (yearEl && competitionYear) {
          yearEl.textContent = competitionYear + '-' + (parseInt(competitionYear, 10) + 1);
        }
        
        if (!data || !data.leaderboard || data.leaderboard.length === 0) {
          // Hide leader banner if no results
          if (leaderBanner) leaderBanner.style.display = 'none';
          container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><h3>No Results Yet</h3><p>Shield Competition results will appear here</p></div>';
          return;
        }
        
        var leaderboard = data.leaderboard;
        
        // Update Leader Banner with top school
        if (leaderBanner && leaderboard.length > 0) {
          var leader = leaderboard[0];
          leaderBanner.style.display = 'flex';
          if (leaderSchoolName) {
            leaderSchoolName.textContent = leader.school_unit || 'Unknown';
          }
          if (leaderSchoolScore) {
            leaderSchoolScore.textContent = (parseFloat(leader.total_score) || 0).toFixed(2) + ' points';
          }
        }
        
        var html = '<div class="shield-podium">';
        
        // Top 3 podium display with category mini-breakdown
        for (var i = 0; i < Math.min(3, leaderboard.length); i++) {
          var entry = leaderboard[i];
          var placeClass = i === 0 ? 'podium-1st' : i === 1 ? 'podium-2nd' : 'podium-3rd';
          var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
          var rankLabel = i === 0 ? '1st Place' : i === 1 ? '2nd Place' : '3rd Place';
          
          // Build mini category breakdown with icons
          var catBreakdown = '<div class="podium-categories">' +
            '<div class="podium-cat" title="Public Speaking"><i class="fas fa-microphone"></i><span>' + (entry.public_speaking || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Orienteering"><i class="fas fa-compass"></i><span>' + (entry.orienteering || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Small Bore Shooting"><i class="fas fa-bullseye"></i><span>' + (entry.small_bore_shooting || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Drill"><i class="fas fa-users"></i><span>' + (entry.drill || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Military Knowledge"><i class="fas fa-brain"></i><span>' + (entry.military_knowledge || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Platoon Records"><i class="fas fa-clipboard-list"></i><span>' + (entry.platoon_records || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Campcraft"><i class="fas fa-campground"></i><span>' + (entry.campcraft || 0).toFixed(0) + '</span></div>' +
            '</div>';
          
          html += '<div class="podium-place ' + placeClass + '">' +
            '<div class="podium-medal">' + medal + '</div>' +
            '<div class="podium-rank">' + rankLabel + '</div>' +
            '<div class="podium-school">' + escapeHtml(entry.school_unit || '') + '</div>' +
            (entry.platoon_number ? '<div class="podium-platoon">Platoon ' + escapeHtml(entry.platoon_number) + '</div>' : '') +
            '<div class="podium-score">' + (parseFloat(entry.total_score) || 0).toFixed(2) + ' pts</div>' +
            catBreakdown +
            '</div>';
        }
        html += '</div>';
        
        // Show 4th-10th place if available
        if (leaderboard.length > 3) {
          html += '<div class="shield-other-ranks">';
          for (var j = 3; j < Math.min(10, leaderboard.length); j++) {
            var e = leaderboard[j];
            html += '<div class="shield-rank-item">' +
              '<div class="shield-rank-number">' + (j + 1) + '</div>' +
              '<div class="shield-rank-info"><h4>' + escapeHtml(e.school_unit || '') + '</h4>' +
              (e.platoon_number ? '<p>Platoon ' + escapeHtml(e.platoon_number) + '</p>' : '') + '</div>' +
              '<div class="shield-rank-score">' + (parseFloat(e.total_score) || 0).toFixed(2) + '</div></div>';
          }
          html += '</div>';
        }
        
        container.innerHTML = html;
      })
      .withFailureHandler(function(err) { 
        console.error('Shield error:', err);
        var container = document.getElementById('dashboardShieldLeaderboard');
        var leaderBanner = document.getElementById('shieldLeaderBanner');
        if (leaderBanner) leaderBanner.style.display = 'none';
        if (container) container.innerHTML = '<p class="text-muted">Unable to load Shield results</p>';
      })
      .getShieldDataFast('auto'); // Pass 'auto' to get the most recent year with data

    // Load announcements
    google.script.run
      .withSuccessHandler(function(announcements) {
        var container = document.getElementById('dashboardAnnouncements') || document.getElementById('announcementsPreview');
        if (!container) return;
        
        if (!announcements || announcements.length === 0) {
          container.innerHTML = '<p class="text-muted">No announcements</p>';
        } else {
          var html = '';
          var count = Math.min(announcements.length, 3);
          for (var i = 0; i < count; i++) {
            var a = announcements[i];
            var title = a.title || '';
            var content = a.content || '';
            var priority = (a.priority || 'medium').toLowerCase();
            var startDate = a.start_date || a.startdate || '';
            html += '<div class="announcement-card ' + priority + '">' +
              '<h4>' + escapeHtml(title) + '</h4>' +
              '<p>' + escapeHtml(content.substring(0,100)) + (content.length > 100 ? '...' : '') + '</p>' +
              '<span class="announcement-meta">' + formatDate(startDate) + '</span></div>';
          }
          container.innerHTML = html;
        }
        hideLoading();
      })
      .withFailureHandler(function(err) { 
        console.error('Announcements error:', err); 
        hideLoading();
      })
      .getActiveAnnouncements();

    // Load Star Exam leaderboard preview (logged-in users only)
    if (isLoggedIn()) {
    google.script.run
      .withSuccessHandler(function(leaderboard) {
        var container = document.getElementById('leaderboardPreview');
        if (!container) return;
        
        if (!leaderboard || leaderboard.length === 0) {
          container.innerHTML = '<p class="text-muted">No exam results yet</p>';
        } else {
          var html = '';
          var count = Math.min(leaderboard.length, 5);
          for (var i = 0; i < count; i++) {
            var e = leaderboard[i];
            var rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            html += '<div class="leaderboard-item">' +
              '<div class="rank ' + rankClass + '">' + (i+1) + '</div>' +
              '<div class="leaderboard-info"><h4>' + escapeHtml(e.cadet_name || '') + '</h4>' +
              '<p>' + escapeHtml(e.exam_type || '') + '</p></div>' +
              '<div class="leaderboard-score">' + (parseFloat(e.total_score) || 0).toFixed(2) + '</div></div>';
          }
          container.innerHTML = html;
        }
      })
      .withFailureHandler(function(err) { console.error('Leaderboard error:', err); })
      .getStarLeaderboard('all');
    }
  }

  // ==================== CADETS ====================
  function loadCadets(isAutoRefresh) {
    // Permission check - only admins and instructors can load cadets
    if (!isInstructor()) {
      console.log('loadCadets blocked - user is not admin/instructor');
      return;
    }
    
    if (!isAutoRefresh) showLoading();
    if (isAutoRefresh) showCornerSpinner();
    google.script.run
      .withSuccessHandler(function(cadets) {
        var tbody = document.getElementById('cadetsTableBody');
        if (!tbody) { hideLoading(); return; }
        
        console.log('loadCadets received:', cadets ? cadets.length : 0, 'cadets');
        if (cadets && cadets.length > 0) {
          console.log('First cadet keys:', Object.keys(cadets[0]));
        }
        
        if (!cadets || cadets.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No cadets found</td></tr>';
          hideLoading();
          return;
        }
        
        var html = '';
        for (var i = 0; i < cadets.length; i++) {
          var c = cadets[i];
          var regNum = c.regimental_number || '';
          var rank = c.rank || '';
          var surname = c.surname || '';
          var firstName = c.first_name || '';
          var battalion = c.battalion || '';
          var unit = c.unit || '';
          var status = c.status || 'Active';
          var id = c.id || '';
          
          var statusClass = status === 'Active' ? 'success' : 'warning';
          var statusBadge = '<span class="badge badge-' + statusClass + '">' + escapeHtml(status) + '</span>';
          
          var actions = isAdmin() ?
            '<button class="btn btn-sm btn-outline" onclick="editCadet(\'' + id + '\')"><i class="fas fa-edit"></i></button> ' +
            '<button class="btn btn-sm btn-danger" onclick="deleteCadet(\'' + id + '\')"><i class="fas fa-trash"></i></button>' :
            '<button class="btn btn-sm btn-outline" onclick="viewCadet(\'' + id + '\')"><i class="fas fa-eye"></i></button>';
          
          html += '<tr>' +
            '<td>' + escapeHtml(regNum) + '</td>' +
            '<td>' + escapeHtml(rank) + '</td>' +
            '<td>' + escapeHtml(surname + ', ' + firstName) + '</td>' +
            '<td>' + escapeHtml(battalion) + '</td>' +
            '<td>' + escapeHtml(unit) + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td>' + actions + '</td></tr>';
        }
        tbody.innerHTML = html;
        hideLoading();
      })
      .withFailureHandler(function(err) {
        console.error('Load cadets error:', err);
        showToast('Error loading cadets: ' + (err.message || err), 'error');
        hideLoading();
      })
      .getAllCadets();
  }

  function showAddCadetModal() {
    document.getElementById('cadetModalTitle').textContent = 'Add Cadet';
    document.getElementById('cadetForm').reset();
    document.getElementById('cadetId').value = '';
    populateCadetDropdowns();
    openModal('cadetModal');
  }

  function populateCadetDropdowns() {
    var battalionSelect = document.getElementById('cadetBattalion');
    if (battalionSelect && config && config.battalions) {
      var bHtml = '<option value="">Select Battalion</option>';
      for (var i = 0; i < config.battalions.length; i++) {
        bHtml += '<option value="' + config.battalions[i] + '">' + config.battalions[i] + '</option>';
      }
      battalionSelect.innerHTML = bHtml;
    }
    
    var rankSelect = document.getElementById('cadetRank');
    if (rankSelect && config && config.cadetRanks) {
      var rHtml = '<option value="">Select Rank</option>';
      for (var j = 0; j < config.cadetRanks.length; j++) {
        rHtml += '<option value="' + config.cadetRanks[j] + '">' + config.cadetRanks[j] + '</option>';
      }
      rankSelect.innerHTML = rHtml;
    }
  }

  function editCadet(cadetId) {
    showLoading();
    google.script.run
      .withSuccessHandler(function(cadet) {
        if (!cadet) {
          showToast('Cadet not found', 'error');
          hideLoading();
          return;
        }
        
        document.getElementById('cadetModalTitle').textContent = 'Edit Cadet';
        populateCadetDropdowns();
        document.getElementById('cadetId').value = cadet.id || '';
        document.getElementById('cadetRegNumber').value = cadet.regimental_number || '';
        document.getElementById('cadetRank').value = cadet.rank || '';
        document.getElementById('cadetSurname').value = cadet.surname || '';
        document.getElementById('cadetFirstName').value = cadet.first_name || '';
        document.getElementById('cadetBattalion').value = cadet.battalion || '';
        document.getElementById('cadetUnit').value = cadet.unit || '';
        document.getElementById('cadetStatus').value = cadet.status || 'Active';
        
        openModal('cadetModal');
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error loading cadet: ' + (err.message || err), 'error');
        hideLoading();
      })
      .getCadetById(cadetId);
  }

  function saveCadet() {
    var cadetId = document.getElementById('cadetId').value;
    var cadetData = {
      regimentalNumber: document.getElementById('cadetRegNumber').value,
      rank: document.getElementById('cadetRank').value,
      surname: document.getElementById('cadetSurname').value,
      firstName: document.getElementById('cadetFirstName').value,
      battalion: document.getElementById('cadetBattalion').value,
      unit: document.getElementById('cadetUnit').value,
      status: document.getElementById('cadetStatus').value
    };
    
    if (!cadetData.regimentalNumber || !cadetData.surname || !cadetData.firstName) {
      showToast('Please fill in required fields', 'error');
      return;
    }
    
    showLoading();
    
    if (cadetId) {
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Cadet updated successfully', 'success');
            closeModal('cadetModal');
            loadCadets();
          } else {
            showToast(result.message || 'Error updating cadet', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .updateCadet(cadetId, cadetData);
    } else {
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Cadet added successfully', 'success');
            closeModal('cadetModal');
            loadCadets();
          } else {
            showToast(result.message || 'Error adding cadet', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .addCadet(cadetData);
    }
  }

  function deleteCadet(cadetId) {
    if (!confirm('Are you sure you want to delete this cadet?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Cadet deleted successfully', 'success');
          loadCadets();
        } else {
          showToast(result.message || 'Error deleting cadet', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteCadet(cadetId);
  }

  function viewCadet(cadetId) {
    showLoading();
    google.script.run
      .withSuccessHandler(function(cadet) {
        if (!cadet) {
          showToast('Cadet not found', 'error');
          hideLoading();
          return;
        }
        
        var content = '<div class="cadet-details">' +
          '<p><strong>Regimental Number:</strong> ' + escapeHtml(cadet.regimental_number || '') + '</p>' +
          '<p><strong>Rank:</strong> ' + escapeHtml(cadet.rank || '') + '</p>' +
          '<p><strong>Name:</strong> ' + escapeHtml((cadet.surname || '') + ', ' + (cadet.first_name || '')) + '</p>' +
          '<p><strong>Battalion:</strong> ' + escapeHtml(cadet.battalion || '') + '</p>' +
          '<p><strong>Unit:</strong> ' + escapeHtml(cadet.unit || '') + '</p>' +
          '<p><strong>Status:</strong> ' + escapeHtml(cadet.status || '') + '</p>' +
          '</div>';
        
        document.getElementById('modalTitle').textContent = 'Cadet Details';
        document.getElementById('modalBody').innerHTML = content;
        openModal('modal');
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .getCadetById(cadetId);
  }

  // ==================== STAR EXAMS ====================
  var starExamFullData = [];
  
  function loadStarExams(isAutoRefresh) {
    if (!isAutoRefresh) showLoading();
    if (isAutoRefresh) showCornerSpinner();
    google.script.run
      .withSuccessHandler(function(leaderboard) {
        var tbody = document.getElementById('starLeaderboardBody');
        if (!tbody) { hideLoading(); return; }
        
        if (!leaderboard || leaderboard.length === 0) {
          starExamFullData = [];
          tbody.innerHTML = '<tr><td colspan="13" class="text-center text-muted">No exam results found</td></tr>';
          updateStarFilterCount(0, 0);
          hideLoading();
          return;
        }
        
        starExamFullData = leaderboard;
        applyStarFilters();
        renderStarDashboard();
        hideLoading();
      })
      .withFailureHandler(function(err) {
        console.error('Load star exams error:', err);
        hideLoading();
      })
      .getStarLeaderboard('all');
  }
  
  function applyStarFilters() {
    var levelFilter = document.getElementById('starFilterLevel').value;
    var subjectFilter = document.getElementById('starFilterSubject').value;
    var statusFilter = document.getElementById('starFilterStatus').value;
    var searchQuery = (document.getElementById('starSearchInput').value || '').toLowerCase().trim();
    
    var filtered = starExamFullData.filter(function(e) {
      // Star level filter
      if (levelFilter !== 'all' && (e.exam_type || '') !== levelFilter) return false;
      
      // Status filter
      if (statusFilter !== 'all' && (e.status || '') !== statusFilter) return false;
      
      // Subject filter — show only cadets who passed/failed that specific subject
      if (subjectFilter !== 'all') {
        var subjKey = subjectFilter.toLowerCase();
        var subjVal = e[subjKey] || '';
        // Show cadets who have this subject (passed it)
        if (subjVal !== 'P') return false;
      }
      
      // Search
      if (searchQuery) {
        var haystack = [
          e.cadet_name || '',
          e.regimental_number || '',
          e.battalion || '',
          e.unit || '',
          e.exam_type || ''
        ].join(' ').toLowerCase();
        if (haystack.indexOf(searchQuery) < 0) return false;
      }
      
      return true;
    });
    
    renderStarExamRows(filtered);
    updateStarFilterCount(filtered.length, starExamFullData.length);
  }
  
  function renderStarExamRows(data) {
    var tbody = document.getElementById('starLeaderboardBody');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="13" class="text-center text-muted">No results match your filters</td></tr>';
      return;
    }
    
    function subjBadge(val) {
      if (val === 'P') return '<span class="subj-pass" title="Pass">✓</span>';
      return '<span class="subj-none" title="Not passed">-</span>';
    }
    
    var html = '';
    for (var i = 0; i < data.length; i++) {
      var e = data[i];
      var rankClass = i === 0 ? 'rank-1st' : i === 1 ? 'rank-2nd' : i === 2 ? 'rank-3rd' : '';
      var isStar3 = (e.exam_type || '').indexOf('3') >= 0;
      
      var statusClass = 'danger';
      if (e.status === 'Pass') statusClass = 'success';
      else if (e.status === 'Partial') statusClass = 'warning';
      var statusLabel = e.status === 'Pass' ? 'Complete' : e.status === 'Fail' ? 'Incomplete' : (e.status || '');
      
      var adminBtns = isAdmin() ? 
        '<td class="actions-cell">' +
        '<button class="btn btn-outline btn-sm" onclick="editStarExam(\'' + e.id + '\')" title="Edit"><i class="fas fa-edit"></i></button> ' +
        '<button class="btn btn-danger btn-sm" onclick="deleteStarExam(\'' + e.id + '\')" title="Delete"><i class="fas fa-trash"></i></button>' +
        '</td>' : '<td></td>';
      
      html += '<tr class="' + rankClass + '">' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + escapeHtml(e.regimental_number || '') + '</td>' +
        '<td>' + escapeHtml(e.cadet_name || '') + '</td>' +
        '<td>' + escapeHtml(e.battalion || '') + '</td>' +
        '<td><span class="star-type-badge">' + escapeHtml(e.exam_type || '') + '</span></td>' +
        '<td class="text-center">' + subjBadge(e.dr) + '</td>' +
        '<td class="text-center">' + subjBadge(e.umc) + '</td>' +
        '<td class="text-center">' + (isStar3 ? '<span class="subj-na">n/a</span>' : subjBadge(e.saa)) + '</td>' +
        '<td class="text-center">' + subjBadge(e.fc) + '</td>' +
        '<td class="text-center">' + subjBadge(e.at) + '</td>' +
        '<td>' + (e.total_score || 0) + '</td>' +
        '<td><span class="badge badge-' + statusClass + '">' + escapeHtml(statusLabel) + '</span></td>' +
        adminBtns +
        '</tr>';
    }
    tbody.innerHTML = html;
  }
  
  function updateStarFilterCount(shown, total) {
    var countEl = document.getElementById('starFilterCount');
    if (!countEl) return;
    if (shown === total) {
      countEl.textContent = total + ' results';
    } else {
      countEl.textContent = shown + ' of ' + total;
    }
  }
  
  function clearStarFilters() {
    document.getElementById('starFilterLevel').value = 'all';
    document.getElementById('starFilterSubject').value = 'all';
    document.getElementById('starFilterStatus').value = 'all';
    document.getElementById('starSearchInput').value = '';
    applyStarFilters();
  }
  
  // ==================== STAR EXAM TABS & DASHBOARD ====================
  
  var currentStarTab = 'leaderboard';
  
  function switchStarTab(tab) {
    // Dashboard only for logged-in users (Admin, Instructor, User)
    if (tab === 'dashboard' && !isLoggedIn()) {
      showToast('Please log in to access the Star Exams Dashboard.', 'error');
      return;
    }
    
    currentStarTab = tab;
    document.getElementById('starDashboardView').style.display = tab === 'dashboard' ? 'block' : 'none';
    document.getElementById('starLeaderboardView').style.display = tab === 'leaderboard' ? 'block' : 'none';
    document.getElementById('starTabDashboard').classList.toggle('active', tab === 'dashboard');
    document.getElementById('starTabLeaderboard').classList.toggle('active', tab === 'leaderboard');
    
    if (tab === 'dashboard') {
      renderStarDashboard();
    }
  }
  
  function initStarExamTabs() {
    var dashTab = document.getElementById('starTabDashboard');
    if (dashTab) {
      if (isLoggedIn()) {
        dashTab.style.display = '';
        // Default to dashboard for logged-in users
        switchStarTab('dashboard');
      } else {
        dashTab.style.display = 'none';
        switchStarTab('leaderboard');
      }
    }
  }
  
  function renderStarDashboard() {
    var data = starExamFullData;
    if (!data || data.length === 0) return;
    
    // Summary counts
    var total = data.length;
    var passCount = 0, partialCount = 0, failCount = 0;
    
    // By star level
    var byLevel = {};
    // By battalion
    var byBn = {};
    // Subject totals
    var subjTotals = { DR: 0, UMC: 0, SAA: 0, FC: 0, AT: 0 };
    var subjEligible = { DR: 0, UMC: 0, SAA: 0, FC: 0, AT: 0 };
    // Subject by star level
    var subjByLevel = {};
    // Matrix: battalion × star level
    var matrix = {};
    var allLevels = [];
    var allBns = [];
    
    for (var i = 0; i < data.length; i++) {
      var e = data[i];
      var st = e.status || '';
      if (st === 'Pass') passCount++;
      else if (st === 'Partial') partialCount++;
      else failCount++;
      
      var level = e.exam_type || 'Unknown';
      var bn = e.battalion || 'Unknown';
      
      // By level
      if (!byLevel[level]) byLevel[level] = { total: 0, pass: 0, partial: 0, fail: 0 };
      byLevel[level].total++;
      if (st === 'Pass') byLevel[level].pass++;
      else if (st === 'Partial') byLevel[level].partial++;
      else byLevel[level].fail++;
      
      // By battalion
      if (!byBn[bn]) byBn[bn] = { total: 0, pass: 0, partial: 0, fail: 0 };
      byBn[bn].total++;
      if (st === 'Pass') byBn[bn].pass++;
      else if (st === 'Partial') byBn[bn].partial++;
      else byBn[bn].fail++;
      
      // Subjects
      var isStar3 = level.indexOf('3') >= 0;
      var subjects = ['DR', 'UMC', 'SAA', 'FC', 'AT'];
      if (!subjByLevel[level]) subjByLevel[level] = {};
      for (var s = 0; s < subjects.length; s++) {
        var subj = subjects[s];
        if (subj === 'SAA' && isStar3) continue;
        subjEligible[subj]++;
        if (!subjByLevel[level][subj]) subjByLevel[level][subj] = { pass: 0, total: 0 };
        subjByLevel[level][subj].total++;
        if (e[subj.toLowerCase()] === 'P') {
          subjTotals[subj]++;
          subjByLevel[level][subj].pass++;
        }
      }
      
      // Matrix
      if (!matrix[bn]) matrix[bn] = {};
      if (!matrix[bn][level]) matrix[bn][level] = { total: 0, pass: 0 };
      matrix[bn][level].total++;
      if (st === 'Pass') matrix[bn][level].pass++;
      
      if (allLevels.indexOf(level) < 0) allLevels.push(level);
      if (allBns.indexOf(bn) < 0) allBns.push(bn);
    }
    
    // Sort
    allLevels.sort();
    allBns.sort();
    
    // Update summary cards
    document.getElementById('starTotalCadets').textContent = total;
    document.getElementById('starTotalPass').textContent = passCount;
    document.getElementById('starTotalPartial').textContent = partialCount;
    document.getElementById('starTotalFail').textContent = failCount;
    document.getElementById('starPassRate').textContent = total > 0 ? Math.round((passCount / total) * 100) + '%' : '0%';
    
    // Star Level Breakdown
    renderStarLevelChart(byLevel, allLevels);
    
    // Battalion Breakdown
    renderBattalionChart(byBn, allBns);
    
    // Subject Pass Rates (overall rings)
    renderSubjectChart(subjTotals, subjEligible);
    
    // Subject Pass Rates by Star Level (heatmap table)
    renderSubjectByLevel(subjByLevel, allLevels);
    
    // Pass Rate by Star Level
    renderPassRateByLevel(byLevel, allLevels);
    
    // Matrix Table
    renderStarMatrix(matrix, allLevels, allBns);
  }
  
  function renderStarLevelChart(byLevel, levels) {
    var container = document.getElementById('starLevelBreakdown');
    var html = '';
    
    for (var i = 0; i < levels.length; i++) {
      var lv = levels[i];
      var d = byLevel[lv];
      var passRate = d.total > 0 ? Math.round((d.pass / d.total) * 100) : 0;
      var partialRate = d.total > 0 ? Math.round((d.partial / d.total) * 100) : 0;
      var failRate = d.total > 0 ? Math.round((d.fail / d.total) * 100) : 0;
      
      html += '<div class="star-bar-row">' +
        '<div class="star-bar-label"><span class="star-type-badge">' + escapeHtml(lv) + '</span></div>' +
        '<div class="star-bar-track">' +
          '<div class="star-bar-fill bar-pass" style="width:' + passRate + '%" title="Complete: ' + d.pass + '"></div>' +
          '<div class="star-bar-fill bar-partial" style="width:' + partialRate + '%" title="Partial: ' + d.partial + '"></div>' +
          '<div class="star-bar-fill bar-fail" style="width:' + failRate + '%" title="Incomplete: ' + d.fail + '"></div>' +
        '</div>' +
        '<div class="star-bar-nums">' +
          '<span class="num-pass">' + d.pass + '</span> / ' +
          '<span class="num-total">' + d.total + '</span>' +
        '</div>' +
      '</div>';
    }
    
    html += '<div class="star-chart-legend">' +
      '<span class="legend-item"><span class="legend-dot dot-pass"></span> Complete</span>' +
      '<span class="legend-item"><span class="legend-dot dot-partial"></span> Partial</span>' +
      '<span class="legend-item"><span class="legend-dot dot-fail"></span> Incomplete</span>' +
    '</div>';
    
    container.innerHTML = html;
  }
  
  function renderBattalionChart(byBn, bns) {
    var container = document.getElementById('starBattalionBreakdown');
    var html = '';
    
    // Sort by total descending
    bns.sort(function(a, b) { return byBn[b].total - byBn[a].total; });
    
    var maxTotal = 0;
    for (var i = 0; i < bns.length; i++) {
      if (byBn[bns[i]].total > maxTotal) maxTotal = byBn[bns[i]].total;
    }
    
    for (var i = 0; i < bns.length; i++) {
      var bn = bns[i];
      var d = byBn[bn];
      var passRate = d.total > 0 ? Math.round((d.pass / d.total) * 100) : 0;
      var partialRate = d.total > 0 ? Math.round((d.partial / d.total) * 100) : 0;
      var failRate = d.total > 0 ? Math.round((d.fail / d.total) * 100) : 0;
      var barWidth = maxTotal > 0 ? Math.round((d.total / maxTotal) * 100) : 0;
      
      html += '<div class="star-bar-row">' +
        '<div class="star-bar-label"><strong>' + escapeHtml(bn) + '</strong></div>' +
        '<div class="star-bar-track">' +
          '<div class="star-bar-fill bar-pass" style="width:' + passRate + '%" title="Complete: ' + d.pass + '"></div>' +
          '<div class="star-bar-fill bar-partial" style="width:' + partialRate + '%" title="Partial: ' + d.partial + '"></div>' +
          '<div class="star-bar-fill bar-fail" style="width:' + failRate + '%" title="Incomplete: ' + d.fail + '"></div>' +
        '</div>' +
        '<div class="star-bar-nums">' +
          '<span class="num-pass">' + d.pass + '</span> / ' +
          '<span class="num-total">' + d.total + '</span>' +
          ' <small>(' + passRate + '%)</small>' +
        '</div>' +
      '</div>';
    }
    
    container.innerHTML = html;
  }
  
  function renderSubjectChart(totals, eligible) {
    var container = document.getElementById('starSubjectRates');
    var subjects = [
      { key: 'DR', name: 'Drill', icon: 'fas fa-walking' },
      { key: 'UMC', name: 'Use of Map and Compass', icon: 'fas fa-compass' },
      { key: 'SAA', name: 'Skill At Arms', icon: 'fas fa-crosshairs' },
      { key: 'FC', name: 'Field Craft', icon: 'fas fa-campground' },
      { key: 'AT', name: 'Adventure Training', icon: 'fas fa-hiking' }
    ];
    
    var html = '<div class="subject-rates-grid">';
    for (var i = 0; i < subjects.length; i++) {
      var s = subjects[i];
      var passed = totals[s.key] || 0;
      var total = eligible[s.key] || 0;
      var rate = total > 0 ? Math.round((passed / total) * 100) : 0;
      
      html += '<div class="subject-rate-card">' +
        '<div class="subject-rate-header">' +
          '<i class="' + s.icon + '"></i>' +
          '<span class="subject-rate-code">' + s.key + '</span>' +
        '</div>' +
        '<div class="subject-rate-name">' + s.name + '</div>' +
        '<div class="subject-rate-ring">' +
          '<svg viewBox="0 0 36 36" class="subject-ring-svg">' +
            '<path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>' +
            '<path class="ring-fill" stroke-dasharray="' + rate + ', 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>' +
          '</svg>' +
          '<span class="ring-pct">' + rate + '%</span>' +
        '</div>' +
        '<div class="subject-rate-detail">' + passed + ' / ' + total + ' complete</div>' +
      '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }
  
  function renderSubjectByLevel(subjByLevel, levels) {
    var container = document.getElementById('starSubjectByLevel');
    if (!container) return;
    
    var subjects = [
      { key: 'DR', name: 'Drill' },
      { key: 'UMC', name: 'Use of Map and Compass' },
      { key: 'SAA', name: 'Skill At Arms' },
      { key: 'FC', name: 'Field Craft' },
      { key: 'AT', name: 'Adventure Training' }
    ];
    
    var html = '<div class="table-responsive"><table class="table star-matrix-table">';
    
    // Header
    html += '<thead><tr><th>Subject</th>';
    for (var l = 0; l < levels.length; l++) {
      html += '<th class="text-center">' + escapeHtml(levels[l]) + '</th>';
    }
    html += '<th class="text-center"><strong>Overall</strong></th></tr></thead><tbody>';
    
    // Subject rows
    for (var s = 0; s < subjects.length; s++) {
      var subj = subjects[s];
      var overallPass = 0, overallTotal = 0;
      
      html += '<tr><td><strong>' + subj.key + '</strong> <small class="text-muted">' + subj.name + '</small></td>';
      
      for (var l = 0; l < levels.length; l++) {
        var lv = levels[l];
        var isStar3 = lv.indexOf('3') >= 0;
        
        if (subj.key === 'SAA' && isStar3) {
          html += '<td class="text-center"><span class="text-muted">n/a</span></td>';
          continue;
        }
        
        var cell = (subjByLevel[lv] && subjByLevel[lv][subj.key]) ? subjByLevel[lv][subj.key] : { pass: 0, total: 0 };
        overallPass += cell.pass;
        overallTotal += cell.total;
        
        if (cell.total === 0) {
          html += '<td class="text-center text-muted">-</td>';
        } else {
          var pct = Math.round((cell.pass / cell.total) * 100);
          var cls = pct >= 75 ? 'matrix-perfect' : pct >= 50 ? 'matrix-good' : pct > 0 ? 'matrix-low' : 'matrix-none';
          html += '<td class="text-center"><span class="matrix-cell ' + cls + '">' + pct + '%</span>' +
            '<div class="matrix-sub">' + cell.pass + '/' + cell.total + '</div></td>';
        }
      }
      
      // Overall column
      var oPct = overallTotal > 0 ? Math.round((overallPass / overallTotal) * 100) : 0;
      var oCls = oPct >= 75 ? 'matrix-perfect' : oPct >= 50 ? 'matrix-good' : oPct > 0 ? 'matrix-low' : 'matrix-none';
      html += '<td class="text-center"><span class="matrix-cell ' + oCls + '"><strong>' + oPct + '%</strong></span>' +
        '<div class="matrix-sub">' + overallPass + '/' + overallTotal + '</div></td></tr>';
    }
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
  }
  
  function renderPassRateByLevel(byLevel, levels) {
    var container = document.getElementById('starPassRateByLevel');
    if (!container) return;
    
    var html = '<div class="pass-rate-level-grid">';
    
    for (var i = 0; i < levels.length; i++) {
      var lv = levels[i];
      var d = byLevel[lv];
      var passRate = d.total > 0 ? Math.round((d.pass / d.total) * 100) : 0;
      var partialRate = d.total > 0 ? Math.round(((d.pass + d.partial) / d.total) * 100) : 0;
      
      // Color based on pass rate
      var ringColor = passRate >= 75 ? '#22c55e' : passRate >= 50 ? '#f59e0b' : passRate > 0 ? '#ef4444' : '#d1d5db';
      
      html += '<div class="pass-rate-level-card">' +
        '<div class="pass-rate-level-title">' + escapeHtml(lv) + '</div>' +
        '<div class="subject-rate-ring">' +
          '<svg viewBox="0 0 36 36" class="subject-ring-svg">' +
            '<path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>' +
            '<path class="ring-fill" style="stroke:' + ringColor + '" stroke-dasharray="' + passRate + ', 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>' +
          '</svg>' +
          '<span class="ring-pct">' + passRate + '%</span>' +
        '</div>' +
        '<div class="pass-rate-level-stats">' +
          '<span class="prl-pass"><i class="fas fa-check-circle"></i> ' + d.pass + '</span>' +
          '<span class="prl-partial"><i class="fas fa-adjust"></i> ' + d.partial + '</span>' +
          '<span class="prl-fail"><i class="fas fa-times-circle"></i> ' + d.fail + '</span>' +
        '</div>' +
        '<div class="subject-rate-detail">' + d.total + ' cadets</div>' +
      '</div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
  }
  
  function renderStarMatrix(matrix, levels, bns) {
    var thead = document.getElementById('starMatrixHead');
    var tbody = document.getElementById('starMatrixBody');
    
    // Header row
    var hhtml = '<tr><th>Battalion</th>';
    for (var l = 0; l < levels.length; l++) {
      hhtml += '<th class="text-center">' + escapeHtml(levels[l]) + '</th>';
    }
    hhtml += '<th class="text-center"><strong>Total</strong></th></tr>';
    thead.innerHTML = hhtml;
    
    // Data rows
    var bhtml = '';
    var colTotals = {};
    var grandTotal = 0, grandPass = 0;
    
    for (var b = 0; b < bns.length; b++) {
      var bn = bns[b];
      var rowTotal = 0, rowPass = 0;
      bhtml += '<tr><td><strong>' + escapeHtml(bn) + '</strong></td>';
      
      for (var l = 0; l < levels.length; l++) {
        var lv = levels[l];
        if (!colTotals[lv]) colTotals[lv] = { total: 0, pass: 0 };
        
        var cell = (matrix[bn] && matrix[bn][lv]) ? matrix[bn][lv] : { total: 0, pass: 0 };
        colTotals[lv].total += cell.total;
        colTotals[lv].pass += cell.pass;
        rowTotal += cell.total;
        rowPass += cell.pass;
        
        if (cell.total === 0) {
          bhtml += '<td class="text-center text-muted">-</td>';
        } else {
          var cellPct = Math.round((cell.pass / cell.total) * 100);
          var cellClass = cellPct === 100 ? 'matrix-perfect' : cellPct >= 50 ? 'matrix-good' : cellPct > 0 ? 'matrix-low' : 'matrix-none';
          bhtml += '<td class="text-center"><span class="matrix-cell ' + cellClass + '">' + 
            cell.pass + '/' + cell.total + '</span></td>';
        }
      }
      
      grandTotal += rowTotal;
      grandPass += rowPass;
      var rowPct = rowTotal > 0 ? Math.round((rowPass / rowTotal) * 100) : 0;
      bhtml += '<td class="text-center"><strong>' + rowPass + '/' + rowTotal + '</strong> <small>(' + rowPct + '%)</small></td></tr>';
    }
    
    // Footer totals
    bhtml += '<tr class="matrix-footer"><td><strong>Total</strong></td>';
    for (var l = 0; l < levels.length; l++) {
      var ct = colTotals[levels[l]] || { total: 0, pass: 0 };
      var ctPct = ct.total > 0 ? Math.round((ct.pass / ct.total) * 100) : 0;
      bhtml += '<td class="text-center"><strong>' + ct.pass + '/' + ct.total + '</strong></td>';
    }
    var gPct = grandTotal > 0 ? Math.round((grandPass / grandTotal) * 100) : 0;
    bhtml += '<td class="text-center"><strong>' + grandPass + '/' + grandTotal + '</strong> <small>(' + gPct + '%)</small></td></tr>';
    
    tbody.innerHTML = bhtml;
  }

  function showAddExamModal() {
    document.getElementById('examModalTitle').textContent = 'Add Star Exam Result';
    document.getElementById('examForm').reset();
    document.getElementById('examId').value = '';
    toggleExamSubjects();
    openModal('examModal');
  }
  
  function editStarExam(examId) {
    showLoading();
    google.script.run
      .withSuccessHandler(function(exam) {
        if (!exam) {
          showToast('Exam result not found', 'error');
          hideLoading();
          return;
        }
        
        document.getElementById('examModalTitle').textContent = 'Edit Star Exam Result';
        document.getElementById('examId').value = exam.id || '';
        document.getElementById('examCadetId').value = exam.cadet_id || exam.regimental_number || '';
        document.getElementById('examType').value = exam.exam_type || '';
        document.getElementById('examScore').value = exam.total_score || exam.score || '';
        document.getElementById('examiner').value = exam.examiner || '';
        document.getElementById('examStatus').value = exam.status || 'Pending';
        
        if (exam.exam_date) {
          var ed = new Date(exam.exam_date);
          if (!isNaN(ed.getTime())) {
            document.getElementById('examDate').value = ed.toISOString().split('T')[0];
          }
        }
        
        // Populate subject checkboxes
        toggleExamSubjects();
        if (exam.component_scores) {
          var cs = typeof exam.component_scores === 'string' ? JSON.parse(exam.component_scores) : exam.component_scores;
          document.getElementById('examDR').checked = (cs.DR === 'P');
          document.getElementById('examUMC').checked = (cs.UMC === 'P');
          document.getElementById('examSAA').checked = (cs.SAA === 'P');
          document.getElementById('examFC').checked = (cs.FC === 'P');
          document.getElementById('examAT').checked = (cs.AT === 'P');
        }
        
        openModal('examModal');
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error loading exam: ' + (err.message || err), 'error');
        hideLoading();
      })
      .getStarExamById(examId);
  }
  
  function deleteStarExam(examId) {
    if (!confirm('Are you sure you want to delete this exam result? This action cannot be undone.')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Exam result deleted successfully', 'success');
          loadStarExams();
        } else {
          showToast(result.message || 'Error deleting exam result', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteStarExam(examId);
  }

  function saveExam() {
    var examId = document.getElementById('examId').value;
    
    // Build component scores from checkboxes
    var componentScores = {};
    var examType = document.getElementById('examType').value;
    var starTypes = ['Star 1', 'Star 2', 'Star 3', 'Star 4', 'Master Cadet'];
    if (starTypes.indexOf(examType) >= 0) {
      componentScores.DR = document.getElementById('examDR').checked ? 'P' : '';
      componentScores.UMC = document.getElementById('examUMC').checked ? 'P' : '';
      if (examType !== 'Star 3') {
        componentScores.SAA = document.getElementById('examSAA').checked ? 'P' : '';
      }
      componentScores.FC = document.getElementById('examFC').checked ? 'P' : '';
      componentScores.AT = document.getElementById('examAT').checked ? 'P' : '';
      
      // Auto-calculate score as percentage of passed subjects
      var totalSubjects = examType === 'Star 3' ? 4 : 5;
      var passedCount = 0;
      if (componentScores.DR === 'P') passedCount++;
      if (componentScores.UMC === 'P') passedCount++;
      if (componentScores.SAA === 'P') passedCount++;
      if (componentScores.FC === 'P') passedCount++;
      if (componentScores.AT === 'P') passedCount++;
      
      var autoScore = Math.round((passedCount / totalSubjects) * 100);
      if (!document.getElementById('examScore').value) {
        document.getElementById('examScore').value = autoScore;
      }
      
      // Auto-set status — 100 = Pass
      if (passedCount === totalSubjects) {
        document.getElementById('examStatus').value = 'Pass';
      }
    }
    
    var examData = {
      cadetId: document.getElementById('examCadetId').value,
      examType: examType,
      examDate: document.getElementById('examDate').value,
      examiner: document.getElementById('examiner').value,
      score: document.getElementById('examScore').value,
      status: document.getElementById('examStatus').value,
      componentScores: componentScores
    };
    
    if (!examData.cadetId || !examData.examType || !examData.examDate) {
      showToast('Please fill in required fields', 'error');
      return;
    }
    
    showLoading();
    
    if (examId) {
      // Update existing exam
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Exam updated successfully', 'success');
            closeModal('examModal');
            loadStarExams();
          } else {
            showToast(result.message || 'Error updating exam', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .updateStarExam(examId, examData);
    } else {
      // Add new exam
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Exam added successfully', 'success');
            closeModal('examModal');
            loadStarExams();
          } else {
            showToast(result.message || 'Error adding exam', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .addExam(examData);
    }
  }

  function toggleExamSubjects() {
    var examType = document.getElementById('examType').value;
    var subjectsGroup = document.getElementById('examSubjectsGroup');
    var saaGroup = document.getElementById('examSAAGroup');
    
    var starTypes = ['Star 1', 'Star 2', 'Star 3', 'Star 4', 'Master Cadet'];
    if (starTypes.indexOf(examType) >= 0) {
      subjectsGroup.style.display = 'block';
      // Hide SAA for Star 3
      if (saaGroup) saaGroup.style.display = examType === 'Star 3' ? 'none' : 'flex';
    } else {
      subjectsGroup.style.display = 'none';
    }
  }
  
  function showStarExamImportModal() {
    document.getElementById('importProgress').style.display = 'none';
    document.getElementById('importResultSummary').style.display = 'none';
    document.getElementById('importResultSummary').innerHTML = '';
    document.getElementById('runImportBtn').disabled = false;
    switchImportMethod('ttcf');
    openModal('starExamImportModal');
  }
  
  var currentImportMethod = 'ttcf';
  
  function switchImportMethod(method) {
    currentImportMethod = method;
    
    document.getElementById('importMethodTTCF').style.display = method === 'ttcf' ? 'block' : 'none';
    document.getElementById('importMethodManual').style.display = method === 'manual' ? 'block' : 'none';
    
    document.getElementById('importTabTTCF').classList.toggle('active', method === 'ttcf');
    document.getElementById('importTabManual').classList.toggle('active', method === 'manual');
    
    document.getElementById('runImportBtnLabel').textContent = method === 'ttcf' ? 'Run TTCF Import' : 'Run Import Sheet';
    
    // Reset progress
    document.getElementById('importProgress').style.display = 'none';
    document.getElementById('importResultSummary').style.display = 'none';
  }
  
  function createStarExamImportSheet() {
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        hideLoading();
        if (result.success) {
          showToast(result.message, 'success');
        } else {
          showToast(result.message || 'Error creating template', 'error');
        }
      })
      .withFailureHandler(function(err) {
        hideLoading();
        showToast('Error: ' + (err.message || err), 'error');
      })
      .createStarExamImportTemplate();
  }
  
  function runStarExamImport() {
    var methodLabel = currentImportMethod === 'ttcf' ? 'STAR_1, STAR_2, STAR_3 sheets' : '"Star Exam Import" sheet';
    
    if (!confirm('This will import all rows from ' + methodLabel + '. Duplicates (same REG NO + Star Level) will be skipped.\n\nContinue?')) return;
    
    var progressDiv = document.getElementById('importProgress');
    var progressBar = document.getElementById('importProgressBar');
    var progressText = document.getElementById('importProgressText');
    var resultDiv = document.getElementById('importResultSummary');
    var importBtn = document.getElementById('runImportBtn');
    
    progressDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    importBtn.disabled = true;
    progressBar.style.width = '10%';
    progressText.textContent = 'Reading ' + (currentImportMethod === 'ttcf' ? 'TTCF sheets' : 'import sheet') + '...';
    
    var runner = google.script.run
      .withSuccessHandler(function(result) {
        progressBar.style.width = '100%';
        importBtn.disabled = false;
        
        if (result.success) {
          progressText.textContent = 'Import complete!';
          resultDiv.style.display = 'block';
          
          var sheetsInfo = result.sheetsProcessed ? 
            '<div class="import-sheets-processed"><strong>Sheets processed:</strong> ' + result.sheetsProcessed.join(', ') + '</div>' : '';
          
          resultDiv.innerHTML = '<div class="import-result-success">' +
            '<h4><i class="fas fa-check-circle"></i> Import Complete</h4>' +
            sheetsInfo +
            '<div class="import-stats">' +
            '<div class="import-stat"><span class="stat-num">' + result.totalRows + '</span><span class="stat-label">Total Rows</span></div>' +
            '<div class="import-stat"><span class="stat-num">' + result.imported + '</span><span class="stat-label">Imported</span></div>' +
            '<div class="import-stat"><span class="stat-num">' + result.skipped + '</span><span class="stat-label">Skipped</span></div>' +
            '<div class="import-stat"><span class="stat-num">' + result.errors + '</span><span class="stat-label">Errors</span></div>' +
            '</div>' +
            (result.errorDetails && result.errorDetails.length > 0 ? 
              '<div class="import-errors"><p><strong>Errors:</strong></p><ul>' + 
              result.errorDetails.slice(0, 10).map(function(e) { return '<li>' + e + '</li>'; }).join('') +
              (result.errorDetails.length > 10 ? '<li>...and ' + (result.errorDetails.length - 10) + ' more</li>' : '') +
              '</ul></div>' : '') +
            '</div>';
          
          showToast('Imported ' + result.imported + ' star exam results', 'success');
          loadStarExams();
        } else {
          progressText.textContent = 'Import failed';
          resultDiv.style.display = 'block';
          resultDiv.innerHTML = '<div class="import-result-error"><i class="fas fa-exclamation-triangle"></i> ' + 
            (result.message || 'Unknown error') + '</div>';
          showToast(result.message || 'Import failed', 'error');
        }
      })
      .withFailureHandler(function(err) {
        progressBar.style.width = '0%';
        progressText.textContent = 'Import failed';
        importBtn.disabled = false;
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div class="import-result-error"><i class="fas fa-exclamation-triangle"></i> ' + 
          (err.message || 'Unknown error') + '</div>';
        showToast('Import error: ' + (err.message || err), 'error');
      });
    
    if (currentImportMethod === 'ttcf') {
      runner.importFromTTCFSheets();
    } else {
      runner.importStarExamResults();
    }
  }

  // ==================== SHIELD COMPETITION ====================
  var currentShieldCategoryFilter = 'all';
  
  function filterShieldByCategory(category) {
    currentShieldCategoryFilter = category;
    
    // Update dropdown
    var filterSelect = document.getElementById('shieldCategoryFilter');
    if (filterSelect) {
      filterSelect.value = category;
    }
    
    // Update category tag active states
    var tags = document.querySelectorAll('.shield-categories-legend .category-tag');
    tags.forEach(function(tag) {
      var tagCategory = tag.getAttribute('data-category');
      if (category === 'all') {
        tag.classList.remove('active');
      } else if (tagCategory === category) {
        tag.classList.add('active');
      } else {
        tag.classList.remove('active');
      }
    });
    
    // Show/hide Orienteering detailed results table
    var orienteeringTable = document.getElementById('orienteeringDetailedResults');
    if (orienteeringTable) {
      if (category === 'Orienteering' && isAdmin()) {
        orienteeringTable.style.display = 'block';
        loadOrienteeringResults();
      } else {
        orienteeringTable.style.display = 'none';
      }
    }
    
    // Reload data with filter
    loadShieldCompetition();
  }
  
  // Handle category change in Shield modal - redirect to Orienteering form
  function handleShieldCategoryChange(category) {
    if (category === 'Orienteering') {
      closeModal('shieldResultModal');
      showOrienteeringModal();
    }
  }

        
  function loadIndividualShieldResults() {
    var tbody = document.getElementById('shieldResultsBody');
    if (!tbody) return;
    
    google.script.run
      .withSuccessHandler(function(results) {
        if (!results || results.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No individual results found</td></tr>';
          return;
        }
        
        // Filter by category if filter is active
        var filteredResults = results;
        if (currentShieldCategoryFilter && currentShieldCategoryFilter !== 'all') {
          filteredResults = results.filter(function(r) {
            return r.category === currentShieldCategoryFilter;
          });
        }
        
        if (filteredResults.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No results for "' + currentShieldCategoryFilter + '"</td></tr>';
          return;
        }
        
        var html = '';
        for (var i = 0; i < filteredResults.length; i++) {
          var r = filteredResults[i];
          html += '<tr>' +
            '<td>' + escapeHtml(r.school_unit || '') + '</td>' +
            '<td>' + escapeHtml(r.category || '') + '</td>' +
            '<td><strong>' + (parseFloat(r.score) || 0) + '</strong></td>' +
            '<td>' + escapeHtml(r.platoon_number || '-') + '</td>' +
            '<td>' + escapeHtml(r.cadet_name || '-') + '</td>' +
            '<td class="actions-cell">' +
              '<button class="btn btn-outline btn-sm" onclick="editShieldScore(\'' + r.id + '\')" title="Edit"><i class="fas fa-edit"></i></button> ' +
              '<button class="btn btn-danger btn-sm" onclick="deleteShieldScore(\'' + r.id + '\')" title="Delete"><i class="fas fa-trash"></i></button>' +
            '</td></tr>';
        }
        tbody.innerHTML = html;
      })
      .withFailureHandler(function(err) {
        console.error('Load individual results error:', err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading results</td></tr>';
      })
      .getIndividualShieldResults(currentShieldYear || new Date().getFullYear());
  }
  
  function formatScore(score) {
    if (!score || score === 0) return '<span class="score-empty">-</span>';
    return '<span class="score-value">' + parseFloat(score) + '</span>';
  }
  
  function renderCategoryWinners(leaderboard) {
    var container = document.getElementById('categoryWinnersGrid');
    if (!container || !leaderboard || leaderboard.length === 0) {
      if (container) container.innerHTML = '<p class="text-muted">No results available</p>';
      return;
    }
    
    var categories = [
      { key: 'public_speaking', name: 'Public Speaking', icon: 'fa-microphone' },
      { key: 'orienteering', name: 'Orienteering', icon: 'fa-compass' },
      { key: 'small_bore_shooting', name: 'Small Bore Shooting', icon: 'fa-bullseye' },
      { key: 'drill', name: 'Drill', icon: 'fa-users' },
      { key: 'military_knowledge', name: 'Military Knowledge', icon: 'fa-brain' },
      { key: 'platoon_records', name: 'Platoon Records', icon: 'fa-clipboard-list' },
      { key: 'campcraft', name: 'Campcraft', icon: 'fa-campground' }
    ];
    
    var html = '';
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      
      // Find top scorer in this category
      var topScore = 0;
      var topSchool = '';
      var topPlatoon = '';
      
      for (var j = 0; j < leaderboard.length; j++) {
        var entry = leaderboard[j];
        var score = parseFloat(entry[cat.key]) || 0;
        if (score > topScore) {
          topScore = score;
          topSchool = entry.school_unit || '';
          topPlatoon = entry.platoon_number || '';
        }
      }
      
      html += '<div class="category-winner-card">' +
        '<div class="category-winner-icon"><i class="fas ' + cat.icon + '"></i></div>' +
        '<div class="category-winner-info">' +
        '<h4>' + cat.name + '</h4>' +
        (topScore > 0 ? 
          '<p class="winner-school">' + escapeHtml(topSchool) + '</p>' +
          (topPlatoon ? '<p class="winner-platoon">Platoon ' + escapeHtml(topPlatoon) + '</p>' : '') +
          '<p class="winner-score">' + topScore + ' pts</p>' 
          : '<p class="text-muted">No results yet</p>') +
        '</div></div>';
    }
    
    container.innerHTML = html;
  }

  function changeShieldYear(year) {
    currentShieldYear = parseInt(year, 10);
    loadShieldCompetition();
  }

  function showAddResultModal() {
    document.getElementById('shieldResultModalTitle').textContent = 'Add Shield Result';
    document.getElementById('shieldResultForm').reset();
    document.getElementById('shieldResultId').value = '';
    
    // Populate year dropdown with academic years
    var yearSelect = document.getElementById('shieldYear');
    if (yearSelect) {
      var currentCalYear = new Date().getFullYear();
      var defaultYear = currentShieldYear || currentCalYear;
      var yearsHtml = '<option value="">Select Year</option>';
      
      // Show current year and a few previous years (academic year format)
      for (var y = currentCalYear; y >= currentCalYear - 5; y--) {
        var academicYear = y + '-' + (y + 1);
        var selected = (y === defaultYear) ? ' selected' : '';
        yearsHtml += '<option value="' + y + '"' + selected + '>' + academicYear + '</option>';
      }
      yearSelect.innerHTML = yearsHtml;
    }
    
    // Populate school dropdown
    populateShieldSchoolDropdown();
    
    openModal('shieldResultModal');
  }
  
  function populateShieldSchoolDropdown() {
    var schoolSelect = document.getElementById('shieldSchool');
    if (!schoolSelect) return;
    
    // If schools already cached, use them
    if (shieldSchoolsUnits && shieldSchoolsUnits.length > 0) {
      renderSchoolOptions(schoolSelect, shieldSchoolsUnits);
      return;
    }
    
    // Otherwise load from server
    schoolSelect.innerHTML = '<option value="">Loading schools...</option>';
    google.script.run
      .withSuccessHandler(function(schools) {
        shieldSchoolsUnits = schools || [];
        schoolsData = schools || [];
        renderSchoolOptions(schoolSelect, schools);
      })
      .withFailureHandler(function(err) {
        console.error('Error loading schools:', err);
        schoolSelect.innerHTML = '<option value="">Error loading schools</option>';
      })
      .getAllSchoolsUnits();
  }
  
  function renderSchoolOptions(selectEl, schools) {
    var sHtml = '<option value="">Select School/Unit</option>';
    for (var i = 0; i < schools.length; i++) {
      var s = schools[i];
      var name = s.school_unit_name || s.school_unit || s.name || '';
      if (name) {
        sHtml += '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
      }
    }
    selectEl.innerHTML = sHtml;
  }
  
  function editShieldScore(resultId) {
    if (!resultId || resultId === '' || resultId === 'undefined') {
      showToast('Invalid result ID. Please run "Repair Shield Results IDs" from the spreadsheet menu.', 'error');
      return;
    }
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (!result) {
          showToast('Result not found. The ID may be missing. Run "RECON Tools > Repair Shield Results IDs" in the spreadsheet.', 'error');
          hideLoading();
          return;
        }
        
        document.getElementById('shieldResultModalTitle').textContent = 'Edit Shield Result';
        document.getElementById('shieldResultId').value = result.id || '';
        
        // Populate year dropdown
        var yearSelect = document.getElementById('shieldYear');
        if (yearSelect) {
          var currentCalYear = new Date().getFullYear();
          var yearsHtml = '<option value="">Select Year</option>';
          for (var y = currentCalYear; y >= currentCalYear - 10; y--) {
            var academicYear = y + '-' + (y + 1);
            yearsHtml += '<option value="' + y + '">' + academicYear + '</option>';
          }
          yearSelect.innerHTML = yearsHtml;
          yearSelect.value = result.competition_year || '';
        }
        
        // Populate and set school dropdown
        populateShieldSchoolDropdown();
        document.getElementById('shieldSchool').value = result.school_unit || '';
        
        // Set other fields
        document.getElementById('shieldCategory').value = result.category || '';
        document.getElementById('shieldPlatoon').value = result.platoon_number || '';
        document.getElementById('shieldScore').value = result.score || '';
        document.getElementById('shieldCadetName').value = result.cadet_name || '';
        document.getElementById('shieldRegNumber').value = result.regimental_number || '';
        
        openModal('shieldResultModal');
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error loading result: ' + (err.message || err), 'error');
        hideLoading();
      })
      .getShieldResultById(resultId);
  }
  
  function deleteShieldScore(resultId) {
    if (!confirm('Are you sure you want to delete this score? This action cannot be undone.')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Score deleted successfully', 'success');
          loadShieldCompetition();
        } else {
          showToast(result.message || 'Error deleting score', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteShieldResult(resultId);
  }

  function saveShieldResult() {
    var resultId = document.getElementById('shieldResultId').value;
    var resultData = {
      competitionYear: document.getElementById('shieldYear').value,
      category: document.getElementById('shieldCategory').value,
      schoolUnit: document.getElementById('shieldSchool').value,
      platoonNumber: document.getElementById('shieldPlatoon').value,
      score: parseFloat(document.getElementById('shieldScore').value),
      cadetName: document.getElementById('shieldCadetName').value,
      regimentalNumber: document.getElementById('shieldRegNumber').value
    };
    
    if (!resultData.competitionYear || !resultData.category || !resultData.schoolUnit || !resultData.score) {
      showToast('Please fill in required fields (Year, Category, School, Score)', 'error');
      return;
    }
    
    showLoading();
    
    if (resultId) {
      // Update existing result
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Result updated successfully', 'success');
            closeModal('shieldResultModal');
            loadShieldCompetition();
          } else {
            showToast(result.message || 'Error updating result', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .updateShieldResult(resultId, resultData);
    } else {
      // Add new result
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Result added successfully', 'success');
            closeModal('shieldResultModal');
            loadShieldCompetition();
          } else {
            showToast(result.message || 'Error adding result', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .addShieldResult(resultData);
    }
  }

  // ==================== ORIENTEERING ====================
  
  function showOrienteeringModal(resultId) {
    document.getElementById('orienteeringModalTitle').innerHTML = '<i class="fas fa-compass"></i> ' + (resultId ? 'Edit' : 'Add') + ' Orienteering Result';
    document.getElementById('orienteeringForm').reset();
    document.getElementById('orienteeringId').value = '';
    document.getElementById('orienteeringResultId').value = resultId || '';
    
    // Populate year dropdown
    var yearSelect = document.getElementById('orienteeringYear');
    var currentCalYear = new Date().getFullYear();
    var defaultYear = currentShieldYear || currentCalYear;
    var yearsHtml = '<option value="">Select Year</option>';
    for (var y = currentCalYear; y >= currentCalYear - 5; y--) {
      var academicYear = y + '-' + (y + 1);
      var selected = (y === defaultYear) ? ' selected' : '';
      yearsHtml += '<option value="' + y + '"' + selected + '>' + academicYear + '</option>';
    }
    yearSelect.innerHTML = yearsHtml;
    
    // Populate battalion dropdown
    var battalionSelect = document.getElementById('orienteeringBattalion');
    if (config && config.battalions) {
      var batHtml = '<option value="">Select Battalion</option>';
      for (var b = 0; b < config.battalions.length; b++) {
        batHtml += '<option value="' + config.battalions[b] + '">' + config.battalions[b] + '</option>';
      }
      battalionSelect.innerHTML = batHtml;
    }
    
    // Populate school dropdown - load from server if not cached
    var schoolSelect = document.getElementById('orienteeringSchool');
    schoolSelect.innerHTML = '<option value="">Loading schools...</option>';
    
    google.script.run
      .withSuccessHandler(function(schools) {
        shieldSchoolsUnits = schools || [];
        schoolsData = schools || [];
        var schoolHtml = '<option value="">Select School/Unit</option>';
        for (var s = 0; s < schools.length; s++) {
          var school = schools[s];
          var schoolName = school.school_unit_name || school.school_unit || school.name || school.school_name || school;
          schoolHtml += '<option value="' + escapeHtml(schoolName) + '">' + escapeHtml(schoolName) + '</option>';
        }
        schoolSelect.innerHTML = schoolHtml;
      })
      .withFailureHandler(function(err) {
        console.error('Error loading schools:', err);
        schoolSelect.innerHTML = '<option value="">Error loading schools</option>';
      })
      .getAllSchoolsUnits();
    
    // Populate rank dropdown
    var rankSelect = document.getElementById('orienteeringRank');
    if (config && config.cadetRanks) {
      var rankHtml = '<option value="">Select Rank</option>';
      for (var r = 0; r < config.cadetRanks.length; r++) {
        rankHtml += '<option value="' + config.cadetRanks[r] + '">' + config.cadetRanks[r] + '</option>';
      }
      rankSelect.innerHTML = rankHtml;
    }
    
    // Reset scoring fields with new structure
    document.getElementById('orienteeringMarkersFound').value = 0;
    document.getElementById('orienteeringMarkersScore').value = 0;
    document.getElementById('orienteeringTimeScore').value = 30; // Default to max
    document.getElementById('orienteeringMinutesBehind').value = 0;
    document.getElementById('orienteeringGridRefs').value = 0;
    document.getElementById('orienteeringGridScore').value = 0;
    document.getElementById('orienteeringTotalPoints').value = 0;
    
    // If editing, load existing data
    if (resultId) {
      loadOrienteeringResultForEdit(resultId);
    }
    
    openModal('orienteeringModal');
  }
  
  function loadOrienteeringResultForEdit(resultId) {
    google.script.run
      .withSuccessHandler(function(result) {
        if (result) {
          document.getElementById('orienteeringYear').value = result.competition_year || '';
          document.getElementById('orienteeringBattalion').value = result.battalion || '';
          document.getElementById('orienteeringSchool').value = result.school_unit || '';
          document.getElementById('orienteeringPlatoon').value = result.platoon_number || '';
          document.getElementById('orienteeringRegNo').value = result.regimental_number || '';
          document.getElementById('orienteeringRank').value = result.rank || '';
          document.getElementById('orienteeringSurname').value = result.surname || '';
          document.getElementById('orienteeringFirstName').value = result.first_name || '';
          document.getElementById('orienteeringTimeStart').value = result.time_start || '';
          document.getElementById('orienteeringTimeFinished').value = result.time_finished || '';
          document.getElementById('orienteeringTotalTime').value = result.total_time || '';
          
          // New scoring fields
          var markersFound = parseInt(result.markers_found) || 0;
          document.getElementById('orienteeringMarkersFound').value = markersFound;
          document.getElementById('orienteeringMarkersScore').value = markersFound * 8;
          document.getElementById('orienteeringTimeScore').value = result.time_score || 0;
          document.getElementById('orienteeringGridRefs').value = result.grid_refs || 0;
          document.getElementById('orienteeringGridScore').value = result.grid_refs || 0;
          document.getElementById('orienteeringTotalPoints').value = result.total_points || 0;
          
          // Calculate minutes behind for display (reverse calculation)
          var timeScore = parseInt(result.time_score) || 0;
          var minutesBehind = timeScore > 0 ? (30 - timeScore) * 5 : 0;
          document.getElementById('orienteeringMinutesBehind').value = minutesBehind;
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error loading result: ' + err.message, 'error');
      })
      .getOrienteeringResultById(resultId);
  }
  
  function calculateOrienteeringTime() {
    var startTime = document.getElementById('orienteeringTimeStart').value;
    var finishTime = document.getElementById('orienteeringTimeFinished').value;
    
    if (startTime && finishTime) {
      var start = new Date('2000-01-01T' + startTime);
      var finish = new Date('2000-01-01T' + finishTime);
      var diff = finish - start;
      
      if (diff < 0) {
        // Crossed midnight
        diff += 24 * 60 * 60 * 1000;
      }
      
      var hours = Math.floor(diff / (1000 * 60 * 60));
      var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      var seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      var totalTime = '';
      if (hours > 0) totalTime += hours + 'h ';
      totalTime += minutes + 'm ' + seconds + 's';
      
      document.getElementById('orienteeringTotalTime').value = totalTime;
    }
  }
  
  function calculateTimeScoreFromMinutes() {
    var minutesBehind = parseInt(document.getElementById('orienteeringMinutesBehind').value) || 0;
    // Fastest team gets 30 pts, -1 pt per 5 minutes behind
    var timeScore = Math.max(0, 30 - Math.floor(minutesBehind / 5));
    document.getElementById('orienteeringTimeScore').value = timeScore;
    calculateOrienteeringTotal();
  }
  
  function calculateOrienteeringTotal() {
    // Control Markers: 6 markers × 8 pts each = max 48
    var markersFound = parseInt(document.getElementById('orienteeringMarkersFound').value) || 0;
    markersFound = Math.min(Math.max(0, markersFound), 6); // Clamp 0-6
    var markersScore = markersFound * 8;
    document.getElementById('orienteeringMarkersFound').value = markersFound;
    document.getElementById('orienteeringMarkersScore').value = markersScore;
    
    // Time Score: max 30
    var timeScore = parseInt(document.getElementById('orienteeringTimeScore').value) || 0;
    timeScore = Math.min(Math.max(0, timeScore), 30); // Clamp 0-30
    document.getElementById('orienteeringTimeScore').value = timeScore;
    
    // Grid References: 1 pt each, max 22
    var gridRefs = parseInt(document.getElementById('orienteeringGridRefs').value) || 0;
    gridRefs = Math.min(Math.max(0, gridRefs), 22); // Clamp 0-22
    var gridScore = gridRefs; // 1 pt per grid ref
    document.getElementById('orienteeringGridRefs').value = gridRefs;
    document.getElementById('orienteeringGridScore').value = gridScore;
    
    // Total = Markers (48) + Time (30) + Grid Refs (22) = 100
    var total = markersScore + timeScore + gridScore;
    total = Math.min(total, 100); // Cap at 100
    
    document.getElementById('orienteeringTotalPoints').value = total;
  }
  
  function saveOrienteeringResult() {
    var resultId = document.getElementById('orienteeringResultId').value;
    
    var markersFound = parseInt(document.getElementById('orienteeringMarkersFound').value) || 0;
    var markersScore = markersFound * 8;
    var timeScore = parseInt(document.getElementById('orienteeringTimeScore').value) || 0;
    var gridRefs = parseInt(document.getElementById('orienteeringGridRefs').value) || 0;
    var gridScore = gridRefs;
    var totalPoints = markersScore + timeScore + gridScore;
    
    var resultData = {
      competitionYear: document.getElementById('orienteeringYear').value,
      battalion: document.getElementById('orienteeringBattalion').value,
      schoolUnit: document.getElementById('orienteeringSchool').value,
      platoonNumber: document.getElementById('orienteeringPlatoon').value,
      regimentalNumber: document.getElementById('orienteeringRegNo').value,
      rank: document.getElementById('orienteeringRank').value,
      surname: document.getElementById('orienteeringSurname').value,
      firstName: document.getElementById('orienteeringFirstName').value,
      timeStart: document.getElementById('orienteeringTimeStart').value,
      timeFinished: document.getElementById('orienteeringTimeFinished').value,
      totalTime: document.getElementById('orienteeringTotalTime').value,
      markersFound: markersFound,
      markersScore: markersScore,
      timeScore: timeScore,
      gridRefs: gridRefs,
      gridScore: gridScore,
      totalPoints: totalPoints,
      category: 'Orienteering'
    };
    
    // Validation
    if (!resultData.competitionYear || !resultData.schoolUnit || !resultData.regimentalNumber || !resultData.surname) {
      showToast('Please fill in required fields (Year, School/Unit, Reg No., Surname)', 'error');
      return;
    }
    
    showLoading();
    
    if (resultId) {
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Orienteering result updated successfully', 'success');
            closeModal('orienteeringModal');
            loadOrienteeringResults();
            loadShieldCompetition();
          } else {
            showToast(result.message || 'Error updating result', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .updateOrienteeringResult(resultId, resultData);
    } else {
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Orienteering result added successfully', 'success');
            closeModal('orienteeringModal');
            loadOrienteeringResults();
            loadShieldCompetition();
          } else {
            showToast(result.message || 'Error adding result', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .addOrienteeringResult(resultData);
    }
  }
  
  function loadOrienteeringResults() {
    var tbody = document.getElementById('orienteeringResultsBody');
    if (!tbody) return;
    
    google.script.run
      .withSuccessHandler(function(results) {
        if (!results || results.length === 0) {
          tbody.innerHTML = '<tr><td colspan="13" class="text-center text-muted">No orienteering results found for this year</td></tr>';
          return;
        }
        
        var html = '';
        for (var i = 0; i < results.length; i++) {
          var r = results[i];
          var name = (r.surname || '') + ', ' + (r.first_name || '');
          
          // Calculate scores for display
          var markersFound = parseInt(r.markers_found) || 0;
          var markersScore = markersFound * 8;
          var timeScore = parseInt(r.time_score) || 0;
          var gridRefs = parseInt(r.grid_refs) || 0;
          var totalPoints = parseInt(r.total_points) || (markersScore + timeScore + gridRefs);
          
          html += '<tr>' +
            '<td>' + escapeHtml(r.school_unit || '') + '<br><small>' + escapeHtml(r.platoon_number || '-') + '</small></td>' +
            '<td>' + escapeHtml(r.battalion || '-') + '</td>' +
            '<td>' + escapeHtml(r.regimental_number || '-') + '</td>' +
            '<td>' + escapeHtml(r.rank || '-') + '</td>' +
            '<td>' + escapeHtml(name) + '</td>' +
            '<td>' + escapeHtml(r.time_start || '-') + '</td>' +
            '<td>' + escapeHtml(r.time_finished || '-') + '</td>' +
            '<td>' + escapeHtml(r.total_time || '-') + '</td>' +
            '<td><span class="marker-badge">' + markersFound + '×8=' + markersScore + '</span></td>' +
            '<td>' + timeScore + '</td>' +
            '<td>' + gridRefs + '</td>' +
            '<td class="score-total"><strong>' + totalPoints + '</strong></td>' +
            '<td class="actions-cell">' +
              '<button class="btn btn-outline btn-sm" onclick="editOrienteeringResult(\'' + r.id + '\')" title="Edit"><i class="fas fa-edit"></i></button> ' +
              '<button class="btn btn-danger btn-sm" onclick="deleteOrienteeringResult(\'' + r.id + '\')" title="Delete"><i class="fas fa-trash"></i></button>' +
            '</td></tr>';
        }
        tbody.innerHTML = html;
      })
      .withFailureHandler(function(err) {
        console.error('Load orienteering results error:', err);
        tbody.innerHTML = '<tr><td colspan="13" class="text-center text-danger">Error loading results</td></tr>';
      })
      .getOrienteeringResults(currentShieldYear || new Date().getFullYear());
  }
  
  function editOrienteeringResult(resultId) {
    showOrienteeringModal(resultId);
  }
  
  function deleteOrienteeringResult(resultId) {
    if (!confirm('Are you sure you want to delete this orienteering result? This action cannot be undone.')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Orienteering result deleted successfully', 'success');
          loadOrienteeringResults();
          loadShieldCompetition();
        } else {
          showToast(result.message || 'Error deleting result', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteOrienteeringResult(resultId);
  }

  // ==================== COURSES ====================
  var allRegistrations = [];
  var userRegistrations = {}; // Map of courseId -> registration status
  
  function loadCourses(isAutoRefresh) {
    if (!isAutoRefresh) showLoading();
    if (isAutoRefresh) showCornerSpinner();
    // If user is logged in and not admin, first get their registrations
    if (isLoggedIn() && currentUser && currentUser.id) {
      console.log('Loading registrations for user:', currentUser.id);
      google.script.run
        .withSuccessHandler(function(registrations) {
          // Build a map of user's registrations by course ID
          userRegistrations = {};
          console.log('Raw registrations received:', registrations);
          if (registrations && registrations.length > 0) {
            for (var i = 0; i < registrations.length; i++) {
              var reg = registrations[i];
              console.log('Registration:', reg.course_id, '=', reg.status);
              userRegistrations[String(reg.course_id)] = reg.status || 'Pending';
            }
          }
          console.log('User registrations map:', userRegistrations);
          // Now load courses with registration info
          loadCoursesData();
        })
        .withFailureHandler(function(err) {
          console.error('Load user registrations error:', err);
          loadCoursesData();
        })
        .getUserRegistrations(currentUser.id);
    } else {
      console.log('Not logged in or no user id, skipping registration load');
      loadCoursesData();
    }
  }
  
  function loadCoursesData() {
    google.script.run
      .withSuccessHandler(function(courses) {
        var container = document.getElementById('coursesGrid');
        if (!container) { hideLoading(); return; }
        
        // Store courses for filter dropdown
        populateCourseFilter(courses);
        
        if (!courses || courses.length === 0) {
          container.innerHTML = '<div class="empty-state"><i class="fas fa-graduation-cap"></i><h3>No Courses Available</h3><p>Check back later for upcoming courses.</p></div>';
          hideLoading();
          return;
        }
        
        var html = '';
        for (var i = 0; i < courses.length; i++) {
          var c = courses[i];
          var name = c.course_name || '';
          var code = c.course_code || '';
          var status = c.status || 'Open';
          var statusClass = status === 'Open' ? 'success' : status === 'Closed' ? 'danger' : 'warning';
          var detailsUrl = c.details_url || c.document_url || '';
          var materialsUrl = c.materials_url || '';
          var regCount = c.registration_count || 0;
          var approvedCount = c.approved_count || 0;
          var maxParticipants = c.max_participants || 20;
          
          // Debug: Log all course fields to see what's coming from backend
          console.log('Course data:', name, {
            details_url: c.details_url,
            document_url: c.document_url,
            materials_url: c.materials_url,
            all_keys: Object.keys(c)
          });
          
          // Check if user has already registered for this course
          var userRegStatus = userRegistrations[String(c.id)];
          console.log('Course', c.id, name, '- User reg status:', userRegStatus, '- Details URL:', detailsUrl, '- Materials URL:', materialsUrl);
          
          // Registration button/status logic - Show status for ALL logged in users (including admin for their own view)
          var registerBtn = '';
          if (userRegStatus) {
            // User already registered - show their status with user-friendly labels
            var regStatusClass = userRegStatus === 'Approved' ? 'success' : 
                                 userRegStatus === 'Denied' ? 'danger' : 'warning';
            var regStatusIcon = userRegStatus === 'Approved' ? 'fa-check-circle' : 
                                userRegStatus === 'Denied' ? 'fa-times-circle' : 'fa-clock';
            // Display user-friendly labels: Pending→Submitted, Approved→Registered, Denied→Rejected
            var displayStatus = userRegStatus === 'Approved' ? 'Registered' : 
                                userRegStatus === 'Denied' ? 'Rejected' : 'Submitted';
            registerBtn = '<span class="registration-status status-' + regStatusClass + '">' +
              '<i class="fas ' + regStatusIcon + '"></i> ' + displayStatus + '</span>';
          } else if (!isAdmin()) {
            // Not registered and not admin - show register button
            if (status === 'Open') {
              if (isLoggedIn()) {
                registerBtn = '<button class="btn btn-primary btn-sm" onclick="registerForCourse(\'' + c.id + '\',\'' + escapeHtml(name) + '\')"><i class="fas fa-user-plus"></i> Register</button>';
              } else {
                registerBtn = '<button class="btn btn-outline btn-sm" onclick="redirectToLogin()"><i class="fas fa-sign-in-alt"></i> Login to Register</button>';
              }
            }
          }
          
          // Course Details link - available to ALL logged-in users (not guests)
          var detailsLink = '';
          if (detailsUrl && isLoggedIn()) {
            detailsLink = '<a href="' + escapeHtml(detailsUrl) + '" target="_blank" class="btn btn-outline btn-sm" title="View course details">' +
              '<i class="fas fa-info-circle"></i> Course Details</a> ';
          }
          
          // Course Materials link - only for approved/registered users and admins
          var materialsLink = '';
          if (materialsUrl) {
            if (isAdmin() || userRegStatus === 'Approved') {
              materialsLink = '<a href="' + escapeHtml(materialsUrl) + '" target="_blank" class="btn btn-success btn-sm" title="Download course materials">' +
                '<i class="fas fa-download"></i> Course Materials</a> ';
            } else if (userRegStatus === 'Pending') {
              materialsLink = '<span class="btn btn-outline btn-sm disabled" title="Available after approval">' +
                '<i class="fas fa-lock"></i> Materials (Pending)</span> ';
            }
          }
          
          // Admin buttons
          var adminBtns = isAdmin() ? 
            '<button class="btn btn-outline btn-sm" onclick="editCourse(\'' + c.id + '\')"><i class="fas fa-edit"></i></button> ' +
            '<button class="btn btn-danger btn-sm" onclick="deleteCourse(\'' + c.id + '\')"><i class="fas fa-trash"></i></button>' : '';
          
          // Registration count badge for admin
          var regBadge = isAdmin() ? 
            '<span class="registration-badge" title="' + approvedCount + ' approved / ' + regCount + ' total registrations">' +
            '<i class="fas fa-users"></i> ' + approvedCount + '/' + maxParticipants + '</span>' : '';
          
          html += '<div class="card course-card">' +
            '<div class="card-header"><h3>' + escapeHtml(name) + '</h3>' +
            '<div class="card-badges"><span class="badge badge-' + statusClass + '">' + escapeHtml(status) + '</span>' + regBadge + '</div></div>' +
            '<div class="card-body">' +
            (code ? '<p><strong>Code:</strong> ' + escapeHtml(code) + '</p>' : '') +
            (c.start_date || c.end_date ? '<p><strong>Dates:</strong> ' + formatDate(c.start_date) + ' - ' + formatDate(c.end_date) + '</p>' : '') +
            '<p><strong>Location:</strong> ' + escapeHtml(c.location || 'TBA') + '</p>' +
            (c.instructor ? '<p><strong>Instructor:</strong> ' + escapeHtml(c.instructor) + '</p>' : '') +
            (c.description ? '<p>' + escapeHtml(c.description) + '</p>' : '') +
            '</div>' +
            '<div class="card-footer">' + detailsLink + materialsLink + registerBtn + ' ' + adminBtns + '</div></div>';
        }
        container.innerHTML = html;
        
        // Load My Registrations section for logged-in non-admin users
        if (isLoggedIn() && !isAdmin()) {
          loadMyRegistrations(courses);
        } else {
          var myRegsCard = document.getElementById('myRegistrationsCard');
          if (myRegsCard) {
            myRegsCard.style.display = 'none';
          }
        }
        
        hideLoading();
      })
      .withFailureHandler(function(err) {
        console.error('Load courses error:', err);
        hideLoading();
      })
      .getAllCourses();
  }
  
  function loadMyRegistrations(courses) {
    var container = document.getElementById('myRegistrations');
    var card = document.getElementById('myRegistrationsCard');
    if (!container) return;
    
    // Show the My Registrations card
    if (card) card.style.display = '';
    
    // Create course lookup
    var courseLookup = {};
    if (courses) {
      for (var i = 0; i < courses.length; i++) {
        courseLookup[String(courses[i].id)] = courses[i];
      }
    }
    
    // Get user's registrations from the userRegistrations map
    var regKeys = Object.keys(userRegistrations);
    if (regKeys.length === 0) {
      container.innerHTML = '<p class="text-muted">You have not registered for any courses yet.</p>';
      return;
    }
    
    var html = '<div class="table-responsive"><table class="table"><thead><tr>' +
      '<th>Course</th><th>Status</th><th>Details</th><th>Materials</th></tr></thead><tbody>';
    
    for (var j = 0; j < regKeys.length; j++) {
      var courseId = regKeys[j];
      var status = userRegistrations[courseId];
      var course = courseLookup[courseId] || {};
      var courseName = course.course_name || 'Unknown Course';
      var detailsUrl = course.details_url || course.document_url || '';
      var materialsUrl = course.materials_url || '';
      
      // Status display
      var statusClass = status === 'Approved' ? 'success' : status === 'Denied' ? 'danger' : 'warning';
      var displayStatus = status === 'Approved' ? 'Registered' : status === 'Denied' ? 'Rejected' : 'Submitted';
      
      // Course Details link - available to all registered users
      var detailsLink = '';
      if (detailsUrl) {
        detailsLink = '<a href="' + escapeHtml(detailsUrl) + '" target="_blank" class="btn btn-outline btn-sm">' +
          '<i class="fas fa-info-circle"></i> View</a>';
      } else {
        detailsLink = '<span class="text-muted">-</span>';
      }
      
      // Materials link - only for approved registrations
      var materialsLink = '';
      if (materialsUrl && status === 'Approved') {
        materialsLink = '<a href="' + escapeHtml(materialsUrl) + '" target="_blank" class="btn btn-success btn-sm">' +
          '<i class="fas fa-download"></i> Download</a>';
      } else if (materialsUrl && status === 'Pending') {
        materialsLink = '<span class="text-muted"><i class="fas fa-lock"></i> Pending</span>';
      } else if (!materialsUrl && status === 'Approved') {
        materialsLink = '<span class="text-muted">Not available</span>';
      } else {
        materialsLink = '<span class="text-muted">-</span>';
      }
      
      html += '<tr>' +
        '<td><strong>' + escapeHtml(courseName) + '</strong></td>' +
        '<td><span class="badge badge-' + statusClass + '">' + displayStatus + '</span></td>' +
        '<td>' + detailsLink + '</td>' +
        '<td>' + materialsLink + '</td></tr>';
    }
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
  }
  
  function populateCourseFilter(courses) {
    var select = document.getElementById('regFilterCourse');
    if (!select || !courses) return;
    
    var html = '<option value="">All Courses</option>';
    for (var i = 0; i < courses.length; i++) {
      var c = courses[i];
      html += '<option value="' + c.id + '">' + escapeHtml(c.course_name || '') + '</option>';
    }
    select.innerHTML = html;
  }

  function showAddCourseModal() {
    document.getElementById('courseModalTitle').textContent = 'Add Course';
    document.getElementById('courseForm').reset();
    document.getElementById('courseId').value = '';
    openModal('courseModal');
  }

  function editCourse(courseId) {
    showLoading();
    google.script.run
      .withSuccessHandler(function(course) {
        if (!course) {
          showToast('Course not found', 'error');
          hideLoading();
          return;
        }
        
        document.getElementById('courseModalTitle').textContent = 'Edit Course';
        document.getElementById('courseId').value = course.id || '';
        document.getElementById('courseName').value = course.course_name || '';
        document.getElementById('courseCode').value = course.course_code || '';
        document.getElementById('courseCategory').value = course.category || 'Basic Training';
        document.getElementById('courseDescription').value = course.description || '';
        document.getElementById('courseInstructor').value = course.instructor || '';
        document.getElementById('courseDetailsUrl').value = course.details_url || course.document_url || '';
        document.getElementById('courseMaterialsUrl').value = course.materials_url || '';
        document.getElementById('coursePrerequisites').value = course.prerequisites || '';
        
        var startDate = course.start_date ? new Date(course.start_date) : null;
        var endDate = course.end_date ? new Date(course.end_date) : null;
        if (startDate && !isNaN(startDate.getTime())) {
          document.getElementById('courseStartDate').value = startDate.toISOString().split('T')[0];
        }
        if (endDate && !isNaN(endDate.getTime())) {
          document.getElementById('courseEndDate').value = endDate.toISOString().split('T')[0];
        }
        
        document.getElementById('courseLocation').value = course.location || '';
        document.getElementById('courseMaxParticipants').value = course.max_participants || 20;
        document.getElementById('courseStatus').value = course.status || 'Open';
        
        openModal('courseModal');
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error loading course: ' + (err.message || err), 'error');
        hideLoading();
      })
      .getCourseById(courseId);
  }

  function saveCourse() {
    var courseId = document.getElementById('courseId').value;
    var courseData = {
      courseName: document.getElementById('courseName').value,
      courseCode: document.getElementById('courseCode').value,
      category: document.getElementById('courseCategory').value,
      description: document.getElementById('courseDescription').value,
      instructor: document.getElementById('courseInstructor').value,
      startDate: document.getElementById('courseStartDate').value,
      endDate: document.getElementById('courseEndDate').value,
      location: document.getElementById('courseLocation').value,
      maxParticipants: parseInt(document.getElementById('courseMaxParticipants').value, 10) || 20,
      detailsUrl: document.getElementById('courseDetailsUrl').value,
      materialsUrl: document.getElementById('courseMaterialsUrl').value,
      prerequisites: document.getElementById('coursePrerequisites').value,
      status: document.getElementById('courseStatus').value
    };
    
    if (!courseData.courseName) {
      showToast('Please enter a course name', 'error');
      return;
    }
    
    showLoading();
    
    if (courseId) {
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Course updated successfully', 'success');
            closeModal('courseModal');
            loadCourses();
          } else {
            showToast(result.message || 'Error updating course', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .updateCourse(courseId, courseData);
    } else {
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Course added successfully', 'success');
            closeModal('courseModal');
            loadCourses();
          } else {
            showToast(result.message || 'Error adding course', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .addCourse(courseData);
    }
  }

  function deleteCourse(courseId) {
    if (!confirm('Are you sure you want to delete this course?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Course deleted successfully', 'success');
          loadCourses();
        } else {
          showToast(result.message || 'Error deleting course', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteCourse(courseId);
  }

  function registerForCourse(courseId, courseName) {
    if (!isLoggedIn()) {
      redirectToLogin();
      return;
    }
    
    if (!confirm('Register for ' + courseName + '?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast(result.message || 'Registration submitted! Awaiting approval.', 'success');
          loadCourses(); // Refresh to update counts
        } else {
          showToast(result.message || 'Registration failed', 'error');
        }
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .registerForCourse(courseId, currentUser.id, currentUser.firstName + ' ' + currentUser.lastName, currentUser.email);
  }
  
  // ==================== COURSE REGISTRATIONS (Admin) ====================
  function showCourseRegistrations() {
    var panel = document.getElementById('courseRegistrationsPanel');
    if (panel) {
      panel.style.display = 'block';
      loadCourseRegistrations();
    }
  }
  
  function hideCourseRegistrations() {
    var panel = document.getElementById('courseRegistrationsPanel');
    if (panel) panel.style.display = 'none';
  }
  
  function loadCourseRegistrations() {
    google.script.run
      .withSuccessHandler(function(registrations) {
        allRegistrations = registrations || [];
        renderRegistrations(allRegistrations);
      })
      .withFailureHandler(function(err) {
        console.error('Load registrations error:', err);
        showToast('Error loading registrations', 'error');
      })
      .getAllCourseRegistrations();
  }
  
  function filterRegistrations() {
    var courseFilter = document.getElementById('regFilterCourse').value;
    var statusFilter = document.getElementById('regFilterStatus').value;
    
    var filtered = allRegistrations.filter(function(reg) {
      var matchCourse = !courseFilter || reg.course_id === courseFilter;
      var matchStatus = !statusFilter || reg.status === statusFilter;
      return matchCourse && matchStatus;
    });
    
    renderRegistrations(filtered);
  }
  
  function renderRegistrations(registrations) {
    var tbody = document.getElementById('registrationsTableBody');
    if (!tbody) return;
    
    if (!registrations || registrations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No registrations found</td></tr>';
      return;
    }
    
    var html = '';
    for (var i = 0; i < registrations.length; i++) {
      var reg = registrations[i];
      var status = reg.status || 'Pending';
      var statusClass = status === 'Approved' ? 'success' : status === 'Denied' ? 'danger' : 'warning';
      // Display user-friendly labels: Pending→Submitted, Approved→Registered, Denied→Rejected
      var displayStatus = status === 'Approved' ? 'Registered' : 
                          status === 'Denied' ? 'Rejected' : 'Submitted';
      
      // Get registrant name - try multiple possible field names
      var registrantName = reg.user_name || reg.name || reg.applicant_name || reg.full_name || 'Unknown';
      var registrantEmail = reg.user_email || reg.email || '';
      var regDate = reg.registration_date || reg.date || reg.created_date || '';
      
      var actions = '';
      if (status === 'Pending') {
        actions = '<button class="btn btn-success btn-sm" onclick="approveRegistration(\'' + reg.id + '\')" title="Approve"><i class="fas fa-check"></i></button> ' +
                  '<button class="btn btn-danger btn-sm" onclick="denyRegistration(\'' + reg.id + '\')" title="Deny"><i class="fas fa-times"></i></button>';
      } else {
        actions = '<button class="btn btn-outline btn-sm" onclick="deleteRegistration(\'' + reg.id + '\')" title="Delete"><i class="fas fa-trash"></i></button>';
      }
      
      html += '<tr>' +
        '<td>' + escapeHtml(reg.course_name || reg.course_code || 'Unknown Course') + '</td>' +
        '<td><strong>' + escapeHtml(registrantName) + '</strong></td>' +
        '<td>' + escapeHtml(registrantEmail) + '</td>' +
        '<td>' + formatDate(regDate) + '</td>' +
        '<td><span class="badge badge-' + statusClass + '">' + escapeHtml(displayStatus) + '</span></td>' +
        '<td>' + actions + '</td></tr>';
    }
    tbody.innerHTML = html;
  }
  
  function approveRegistration(regId) {
    if (!confirm('Approve this registration?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          if (result.courseClosed) {
            showToast('Registration approved. Course automatically closed (max capacity reached).', 'success');
          } else {
            showToast('Registration approved', 'success');
          }
          loadCourseRegistrations();
          loadCourses(); // Refresh counts and status
        } else {
          showToast(result.message || 'Error approving registration', 'error');
        }
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .approveRegistration(regId);
  }
  
  function denyRegistration(regId) {
    if (!confirm('Deny this registration?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          if (result.courseReopened) {
            showToast('Registration denied. Course re-opened (capacity now available).', 'success');
          } else {
            showToast('Registration denied', 'success');
          }
          loadCourseRegistrations();
          loadCourses(); // Refresh counts and status
        } else {
          showToast(result.message || 'Error denying registration', 'error');
        }
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .denyRegistration(regId);
  }
  
  function deleteRegistration(regId) {
    if (!confirm('Delete this registration record?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          if (result.courseReopened) {
            showToast('Registration deleted. Course re-opened (capacity now available).', 'success');
          } else {
            showToast('Registration deleted', 'success');
          }
          loadCourseRegistrations();
          loadCourses(); // Refresh counts and status
        } else {
          showToast(result.message || 'Error deleting registration', 'error');
        }
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteRegistration(regId);
  }

  // ==================== RESOURCES (SYLLABI & MANUALS) ====================
  var currentResourceFilter = 'all';
  
  function loadResources(isAutoRefresh) {
    if (!isAutoRefresh) showLoading();
    if (isAutoRefresh) showCornerSpinner();
    // Load all resource types
    loadSyllabi();
    loadManuals();
    loadOrders();
    loadPolicies();
  }
  
  function filterResources(filter) {
    currentResourceFilter = filter;
    
    // Update tab active states
    var tabs = document.querySelectorAll('.resource-tab');
    tabs.forEach(function(tab) {
      tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide sections based on filter
    var syllabiSection = document.getElementById('syllabiSection');
    var manualsSection = document.getElementById('manualsSection');
    var ordersSection = document.getElementById('ordersSection');
    var policiesSection = document.getElementById('policiesSection');
    
    if (filter === 'all') {
      if (syllabiSection) syllabiSection.style.display = 'block';
      if (manualsSection) manualsSection.style.display = 'block';
      if (ordersSection) ordersSection.style.display = 'block';
      if (policiesSection) policiesSection.style.display = 'block';
    } else if (filter === 'syllabi') {
      if (syllabiSection) syllabiSection.style.display = 'block';
      if (manualsSection) manualsSection.style.display = 'none';
      if (ordersSection) ordersSection.style.display = 'none';
      if (policiesSection) policiesSection.style.display = 'none';
    } else if (filter === 'manuals') {
      if (syllabiSection) syllabiSection.style.display = 'none';
      if (manualsSection) manualsSection.style.display = 'block';
      if (ordersSection) ordersSection.style.display = 'none';
      if (policiesSection) policiesSection.style.display = 'none';
    } else if (filter === 'orders') {
      if (syllabiSection) syllabiSection.style.display = 'none';
      if (manualsSection) manualsSection.style.display = 'none';
      if (ordersSection) ordersSection.style.display = 'block';
      if (policiesSection) policiesSection.style.display = 'none';
    } else if (filter === 'policies') {
      if (syllabiSection) syllabiSection.style.display = 'none';
      if (manualsSection) manualsSection.style.display = 'none';
      if (ordersSection) ordersSection.style.display = 'none';
      if (policiesSection) policiesSection.style.display = 'block';
    }
  }

  // ==================== SYLLABI ====================
  function loadSyllabi() {
    google.script.run
      .withSuccessHandler(function(data) {
        var container = document.getElementById('syllabiGrid') || document.getElementById('syllabiList');
        if (!container) { hideLoading(); return; }
        
        if (!data || data.length === 0) {
          container.innerHTML = '<div class="empty-state"><i class="fas fa-book"></i><h3>No Syllabi Available</h3></div>';
          hideLoading();
          return;
        }
        
        var html = '<div class="document-list">';
        for (var i = 0; i < data.length; i++) {
          var s = data[i];
          var fileUrl = s.file_url || '';
          var downloadBtn = fileUrl ? 
            (isLoggedIn() ?
              '<a href="' + fileUrl + '" target="_blank" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download</a>' :
              '<button class="btn btn-outline btn-sm" onclick="redirectToLogin()"><i class="fas fa-lock"></i> Login</button>') : '';
          var deleteBtn = isAdmin() ? ' <button class="btn btn-danger btn-sm" onclick="deleteSyllabus(\'' + s.id + '\')"><i class="fas fa-trash"></i></button>' : '';
          
          html += '<div class="document-item">' +
            '<div class="document-icon"><i class="fas fa-book"></i></div>' +
            '<div class="document-info"><h4>' + escapeHtml(s.title || '') + '</h4>' +
            '<p>' + escapeHtml(s.star_level || '') + (s.category ? ' | ' + escapeHtml(s.category) : '') + '</p></div>' +
            '<div class="document-actions">' + downloadBtn + deleteBtn + '</div></div>';
        }
        html += '</div>';
        container.innerHTML = html;
        hideLoading();
      })
      .withFailureHandler(function(err) {
        console.error('Load syllabi error:', err);
        hideLoading();
      })
      .getAllSyllabi();
  }

  function showAddSyllabusModal() {
    document.getElementById('syllabusForm').reset();
    openModal('syllabusModal');
  }

  function saveSyllabus() {
    var syllabusData = {
      title: document.getElementById('syllabusTitle').value,
      category: document.getElementById('syllabusCategory').value,
      starLevel: document.getElementById('syllabusStarLevel').value,
      description: document.getElementById('syllabusDescription').value,
      fileUrl: document.getElementById('syllabusFileUrl').value,
      version: document.getElementById('syllabusVersion').value
    };
    
    if (!syllabusData.title) {
      showToast('Please enter a title', 'error');
      return;
    }
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Syllabus added successfully', 'success');
          closeModal('syllabusModal');
          loadSyllabi();
        } else {
          showToast(result.message || 'Error adding syllabus', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .addSyllabus(syllabusData);
  }

  function deleteSyllabus(syllabusId) {
    if (!confirm('Delete this syllabus?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Syllabus deleted', 'success');
          loadSyllabi();
        } else {
          showToast(result.message || 'Error', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteSyllabus(syllabusId);
  }

  // ==================== MANUALS ====================
  function loadManuals() {
    google.script.run
      .withSuccessHandler(function(data) {
        var container = document.getElementById('manualsGrid') || document.getElementById('manualsList');
        if (!container) { hideLoading(); return; }
        
        if (!data || data.length === 0) {
          container.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><h3>No Manuals Available</h3></div>';
          hideLoading();
          return;
        }
        
        var html = '<div class="document-list">';
        for (var i = 0; i < data.length; i++) {
          var m = data[i];
          var fileUrl = m.file_url || '';
          var downloadBtn = fileUrl ? 
            (isLoggedIn() ?
              '<a href="' + fileUrl + '" target="_blank" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download</a>' :
              '<button class="btn btn-outline btn-sm" onclick="redirectToLogin()"><i class="fas fa-lock"></i> Login</button>') : '';
          var deleteBtn = isAdmin() ? ' <button class="btn btn-danger btn-sm" onclick="deleteManual(\'' + m.id + '\')"><i class="fas fa-trash"></i></button>' : '';
          
          html += '<div class="document-item">' +
            '<div class="document-icon"><i class="fas fa-file-pdf"></i></div>' +
            '<div class="document-info"><h4>' + escapeHtml(m.title || '') + '</h4>' +
            '<p>' + escapeHtml(m.category || '') + '</p></div>' +
            '<div class="document-actions">' + downloadBtn + deleteBtn + '</div></div>';
        }
        html += '</div>';
        container.innerHTML = html;
        hideLoading();
      })
      .withFailureHandler(function(err) {
        console.error('Load manuals error:', err);
        hideLoading();
      })
      .getAllManuals();
  }

  function showAddManualModal() {
    document.getElementById('manualForm').reset();
    openModal('manualModal');
  }

  function saveManual() {
    var manualData = {
      title: document.getElementById('manualTitle').value,
      category: document.getElementById('manualCategory').value,
      description: document.getElementById('manualDescription').value,
      fileUrl: document.getElementById('manualFileUrl').value,
      version: document.getElementById('manualVersion').value
    };
    
    if (!manualData.title) {
      showToast('Please enter a title', 'error');
      return;
    }
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Manual added successfully', 'success');
          closeModal('manualModal');
          loadManuals();
        } else {
          showToast(result.message || 'Error adding manual', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .addManual(manualData);
  }

  function deleteManual(manualId) {
    if (!confirm('Delete this manual?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Manual deleted', 'success');
          loadManuals();
        } else {
          showToast(result.message || 'Error', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteManual(manualId);
  }

  // ==================== ORDERS ====================
  function loadOrders() {
    google.script.run
      .withSuccessHandler(function(data) {
        var container = document.getElementById('ordersGrid');
        if (!container) { hideLoading(); return; }
        
        if (!data || data.length === 0) {
          container.innerHTML = '<div class="empty-state"><i class="fas fa-gavel"></i><h3>No Orders Available</h3></div>';
          hideLoading();
          return;
        }
        
        var html = '<div class="document-list">';
        for (var i = 0; i < data.length; i++) {
          var o = data[i];
          var fileUrl = o.file_url || '';
          var downloadBtn = fileUrl ? 
            (isLoggedIn() ?
              '<a href="' + fileUrl + '" target="_blank" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download</a>' :
              '<button class="btn btn-outline btn-sm" onclick="redirectToLogin()"><i class="fas fa-lock"></i> Login</button>') : '';
          var deleteBtn = isAdmin() ? ' <button class="btn btn-danger btn-sm" onclick="deleteOrder(\'' + o.id + '\')"><i class="fas fa-trash"></i></button>' : '';
          
          var subtitle = [];
          if (o.order_type) subtitle.push(escapeHtml(o.order_type));
          if (o.reference_number) subtitle.push(escapeHtml(o.reference_number));
          if (o.issued_by) subtitle.push('Issued by: ' + escapeHtml(o.issued_by));
          
          html += '<div class="document-item">' +
            '<div class="document-icon"><i class="fas fa-gavel"></i></div>' +
            '<div class="document-info"><h4>' + escapeHtml(o.title || '') + '</h4>' +
            '<p>' + subtitle.join(' | ') + '</p></div>' +
            '<div class="document-actions">' + downloadBtn + deleteBtn + '</div></div>';
        }
        html += '</div>';
        container.innerHTML = html;
        hideLoading();
      })
      .withFailureHandler(function(err) {
        console.error('Load orders error:', err);
        hideLoading();
      })
      .getAllOrders();
  }

  function showAddOrderModal() {
    document.getElementById('orderForm').reset();
    openModal('orderModal');
  }

  function saveOrder() {
    var orderData = {
      title: document.getElementById('orderTitle').value,
      orderType: document.getElementById('orderType').value,
      refNumber: document.getElementById('orderRefNumber').value,
      effectiveDate: document.getElementById('orderEffectiveDate').value,
      issuedBy: document.getElementById('orderIssuedBy').value,
      description: document.getElementById('orderDescription').value,
      fileUrl: document.getElementById('orderFileUrl').value
    };
    
    if (!orderData.title) {
      showToast('Please enter a title', 'error');
      return;
    }
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Order added successfully', 'success');
          closeModal('orderModal');
          loadOrders();
        } else {
          showToast(result.message || 'Error adding order', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .addOrder(orderData);
  }

  function deleteOrder(orderId) {
    if (!confirm('Delete this order?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Order deleted', 'success');
          loadOrders();
        } else {
          showToast(result.message || 'Error', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteOrder(orderId);
  }

  // ==================== POLICIES ====================
  function loadPolicies() {
    google.script.run
      .withSuccessHandler(function(data) {
        var container = document.getElementById('policiesGrid');
        if (!container) { hideLoading(); return; }
        
        if (!data || data.length === 0) {
          container.innerHTML = '<div class="empty-state"><i class="fas fa-shield-alt"></i><h3>No Policies Available</h3></div>';
          hideLoading();
          return;
        }
        
        var html = '<div class="document-list">';
        for (var i = 0; i < data.length; i++) {
          var p = data[i];
          var fileUrl = p.file_url || '';
          var downloadBtn = fileUrl ? 
            (isLoggedIn() ?
              '<a href="' + fileUrl + '" target="_blank" class="btn btn-primary btn-sm"><i class="fas fa-download"></i> Download</a>' :
              '<button class="btn btn-outline btn-sm" onclick="redirectToLogin()"><i class="fas fa-lock"></i> Login</button>') : '';
          var deleteBtn = isAdmin() ? ' <button class="btn btn-danger btn-sm" onclick="deletePolicy(\'' + p.id + '\')"><i class="fas fa-trash"></i></button>' : '';
          
          var subtitle = [];
          if (p.category) subtitle.push(escapeHtml(p.category));
          if (p.reference_number) subtitle.push(escapeHtml(p.reference_number));
          if (p.status && p.status !== 'Active') subtitle.push('<span style="color:#f59e0b;">' + escapeHtml(p.status) + '</span>');
          
          html += '<div class="document-item">' +
            '<div class="document-icon"><i class="fas fa-shield-alt"></i></div>' +
            '<div class="document-info"><h4>' + escapeHtml(p.title || '') + '</h4>' +
            '<p>' + subtitle.join(' | ') + '</p></div>' +
            '<div class="document-actions">' + downloadBtn + deleteBtn + '</div></div>';
        }
        html += '</div>';
        container.innerHTML = html;
        hideLoading();
      })
      .withFailureHandler(function(err) {
        console.error('Load policies error:', err);
        hideLoading();
      })
      .getAllPolicies();
  }

  function showAddPolicyModal() {
    document.getElementById('policyForm').reset();
    openModal('policyModal');
  }

  function savePolicy() {
    var policyData = {
      title: document.getElementById('policyTitle').value,
      category: document.getElementById('policyCategory').value,
      refNumber: document.getElementById('policyRefNumber').value,
      effectiveDate: document.getElementById('policyEffectiveDate').value,
      status: document.getElementById('policyStatus').value,
      description: document.getElementById('policyDescription').value,
      fileUrl: document.getElementById('policyFileUrl').value
    };
    
    if (!policyData.title) {
      showToast('Please enter a title', 'error');
      return;
    }
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Policy added successfully', 'success');
          closeModal('policyModal');
          loadPolicies();
        } else {
          showToast(result.message || 'Error adding policy', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .addPolicy(policyData);
  }

  function deletePolicy(policyId) {
    if (!confirm('Delete this policy?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Policy deleted', 'success');
          loadPolicies();
        } else {
          showToast(result.message || 'Error', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deletePolicy(policyId);
  }

  // ==================== ANNOUNCEMENTS ====================
  function loadAnnouncements(isAutoRefresh) {
    if (!isAutoRefresh) showLoading();
    if (isAutoRefresh) showCornerSpinner();
    google.script.run
      .withSuccessHandler(function(data) {
        var container = document.getElementById('announcementsList');
        if (!container) { hideLoading(); return; }
        
        if (!data || data.length === 0) {
          container.innerHTML = '<div class="empty-state"><i class="fas fa-bullhorn"></i><h3>No Announcements</h3></div>';
          hideLoading();
          return;
        }
        
        var html = '';
        for (var i = 0; i < data.length; i++) {
          var a = data[i];
          var priority = (a.priority || 'medium').toLowerCase();
          var adminBtns = isAdmin() ? 
            '<div class="announcement-admin-actions">' +
            '<button class="btn btn-outline btn-sm" onclick="editAnnouncement(\'' + a.id + '\')" title="Edit"><i class="fas fa-edit"></i></button> ' +
            '<button class="btn btn-danger btn-sm" onclick="deleteAnnouncement(\'' + a.id + '\')" title="Delete"><i class="fas fa-trash"></i></button>' +
            '</div>' : '';
          
          html += '<div class="announcement-card ' + priority + '">' +
            '<div class="announcement-header">' +
            '<h4>' + escapeHtml(a.title || '') + '</h4>' +
            adminBtns +
            '</div>' +
            '<p>' + escapeHtml(a.content || '') + '</p>' +
            '<div class="announcement-meta">' +
            '<span><i class="fas fa-calendar"></i> ' + formatDate(a.start_date) + ' - ' + formatDate(a.end_date) + '</span>' +
            (a.target_audience ? ' <span><i class="fas fa-users"></i> ' + escapeHtml(a.target_audience) + '</span>' : '') +
            (a.category ? ' <span><i class="fas fa-tag"></i> ' + escapeHtml(a.category) + '</span>' : '') +
            '</div></div>';
        }
        container.innerHTML = html;
        hideLoading();
      })
      .withFailureHandler(function(err) {
        console.error('Load announcements error:', err);
        hideLoading();
      })
      .getAllAnnouncements();
  }

  function showAddAnnouncementModal() {
    document.getElementById('announcementModalTitle').textContent = 'New Announcement';
    document.getElementById('announcementForm').reset();
    document.getElementById('announcementId').value = '';
    var today = new Date().toISOString().split('T')[0];
    var nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.getElementById('announcementStartDate').value = today;
    document.getElementById('announcementEndDate').value = nextWeek;
    openModal('announcementModal');
  }
  
  function editAnnouncement(announcementId) {
    showLoading();
    google.script.run
      .withSuccessHandler(function(announcement) {
        if (!announcement) {
          showToast('Announcement not found', 'error');
          hideLoading();
          return;
        }
        
        document.getElementById('announcementModalTitle').textContent = 'Edit Announcement';
        document.getElementById('announcementId').value = announcement.id || '';
        document.getElementById('announcementTitle').value = announcement.title || '';
        document.getElementById('announcementContent').value = announcement.content || '';
        document.getElementById('announcementCategory').value = announcement.category || 'General';
        document.getElementById('announcementPriority').value = announcement.priority || 'Medium';
        document.getElementById('announcementAudience').value = announcement.target_audience || 'All';
        
        if (announcement.start_date) {
          var sd = new Date(announcement.start_date);
          if (!isNaN(sd.getTime())) {
            document.getElementById('announcementStartDate').value = sd.toISOString().split('T')[0];
          }
        }
        if (announcement.end_date) {
          var ed = new Date(announcement.end_date);
          if (!isNaN(ed.getTime())) {
            document.getElementById('announcementEndDate').value = ed.toISOString().split('T')[0];
          }
        }
        
        openModal('announcementModal');
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error loading announcement: ' + (err.message || err), 'error');
        hideLoading();
      })
      .getAnnouncementById(announcementId);
  }

  function saveAnnouncement() {
    var announcementId = document.getElementById('announcementId').value;
    var announcementData = {
      title: document.getElementById('announcementTitle').value,
      content: document.getElementById('announcementContent').value,
      category: document.getElementById('announcementCategory').value,
      priority: document.getElementById('announcementPriority').value,
      targetAudience: document.getElementById('announcementAudience').value,
      startDate: document.getElementById('announcementStartDate').value,
      endDate: document.getElementById('announcementEndDate').value
    };
    
    if (!announcementData.title || !announcementData.content) {
      showToast('Please fill in required fields', 'error');
      return;
    }
    
    showLoading();
    
    if (announcementId) {
      // Update existing
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Announcement updated successfully', 'success');
            closeModal('announcementModal');
            loadAnnouncements();
          } else {
            showToast(result.message || 'Error updating announcement', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .updateAnnouncement(announcementId, announcementData);
    } else {
      // Create new
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Announcement posted successfully', 'success');
            closeModal('announcementModal');
            loadAnnouncements();
          } else {
            showToast(result.message || 'Error posting announcement', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .addAnnouncement(announcementData);
    }
  }
  
  function deleteAnnouncement(announcementId) {
    if (!confirm('Delete this announcement?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Announcement deleted', 'success');
          loadAnnouncements();
        } else {
          showToast(result.message || 'Error deleting announcement', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteAnnouncement(announcementId);
  }

  // ==================== VIEWS & REVIEWS ====================
  function loadReviews(isAutoRefresh) {
    if (!isAutoRefresh) showLoading();
    if (isAutoRefresh) showCornerSpinner();
    google.script.run
      .withSuccessHandler(function(data) {
        var container = document.getElementById('reviewsList');
        if (!container) { hideLoading(); return; }
        
        if (!data || data.length === 0) {
          container.innerHTML = '<div class="empty-state"><i class="fas fa-quote-left"></i><h3>No Reviews Yet</h3><p>Views and reviews will appear here.</p></div>';
          hideLoading();
          return;
        }
        
        // Sort by date (newest first), then by featured
        data.sort(function(a, b) {
          if (a.featured === 'Yes' && b.featured !== 'Yes') return -1;
          if (b.featured === 'Yes' && a.featured !== 'Yes') return 1;
          var dateA = a.date ? new Date(a.date) : new Date(0);
          var dateB = b.date ? new Date(b.date) : new Date(0);
          return dateB - dateA;
        });
        
        var html = '<div class="reviews-container">';
        
        for (var i = 0; i < data.length; i++) {
          var r = data[i];
          var quote = r.quote || r.content || '';
          var author = r.author || r.source || 'Unknown';
          var type = r.type || 'Quote';
          var url = r.url || r.external_url || '';
          var imageUrl = r.image_url || '';
          var date = r.date ? formatDate(r.date) : '';
          var featured = r.featured === 'Yes';
          
          var typeIcon = 'fa-quote-left';
          if (type === 'News Article') typeIcon = 'fa-newspaper';
          else if (type === 'Social Media') typeIcon = 'fa-share-alt';
          else if (type === 'Press Release') typeIcon = 'fa-file-alt';
          else if (type === 'Testimonial') typeIcon = 'fa-user';
          
          var adminBtns = isAdmin() ? 
            '<div class="review-admin-actions">' +
            '<button class="btn btn-outline btn-sm" onclick="editReview(\'' + r.id + '\')" title="Edit"><i class="fas fa-edit"></i></button> ' +
            '<button class="btn btn-danger btn-sm" onclick="deleteReview(\'' + r.id + '\')" title="Delete"><i class="fas fa-trash"></i></button>' +
            '</div>' : '';
          
          html += '<div class="review-card' + (featured ? ' featured' : '') + '">' +
            (imageUrl ? '<div class="review-image"><img src="' + escapeHtml(imageUrl) + '" alt="Review image" onerror="this.parentElement.style.display=\'none\'"></div>' : '') +
            '<div class="review-content">' +
            '<div class="review-type"><i class="fas ' + typeIcon + '"></i> ' + escapeHtml(type) + (featured ? ' <span class="badge badge-success">Featured</span>' : '') + '</div>' +
            '<blockquote class="review-quote">"' + escapeHtml(quote) + '"</blockquote>' +
            '<div class="review-meta">' +
            '<span class="review-author"><i class="fas fa-user"></i> ' + escapeHtml(author) + '</span>' +
            (date ? '<span class="review-date"><i class="fas fa-calendar"></i> ' + date + '</span>' : '') +
            '</div>' +
            (url ? '<a href="' + escapeHtml(url) + '" target="_blank" class="btn btn-outline btn-sm review-link"><i class="fas fa-external-link-alt"></i> Read Full Article</a>' : '') +
            adminBtns +
            '</div></div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
        hideLoading();
      })
      .withFailureHandler(function(err) {
        console.error('Load reviews error:', err);
        var container = document.getElementById('reviewsList');
        if (container) container.innerHTML = '<p class="text-danger">Error loading reviews</p>';
        hideLoading();
      })
      .getAllReviews();
  }
  
  function showAddReviewModal() {
    document.getElementById('reviewModalTitle').textContent = 'Add View/Review';
    document.getElementById('reviewForm').reset();
    document.getElementById('reviewId').value = '';
    openModal('reviewModal');
  }
  
  function editReview(reviewId) {
    showLoading();
    google.script.run
      .withSuccessHandler(function(review) {
        if (!review) {
          showToast('Review not found', 'error');
          hideLoading();
          return;
        }
        
        document.getElementById('reviewModalTitle').textContent = 'Edit View/Review';
        document.getElementById('reviewId').value = review.id || '';
        document.getElementById('reviewType').value = review.type || 'Quote';
        document.getElementById('reviewQuote').value = review.quote || review.content || '';
        document.getElementById('reviewAuthor').value = review.author || review.source || '';
        document.getElementById('reviewUrl').value = review.url || review.external_url || '';
        document.getElementById('reviewImageUrl').value = review.image_url || '';
        document.getElementById('reviewFeatured').value = review.featured || 'No';
        
        if (review.date) {
          var d = new Date(review.date);
          if (!isNaN(d.getTime())) {
            document.getElementById('reviewDate').value = d.toISOString().split('T')[0];
          }
        }
        
        openModal('reviewModal');
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error loading review: ' + (err.message || err), 'error');
        hideLoading();
      })
      .getReviewById(reviewId);
  }
  
  function saveReview() {
    var reviewId = document.getElementById('reviewId').value;
    var reviewData = {
      type: document.getElementById('reviewType').value,
      quote: document.getElementById('reviewQuote').value,
      author: document.getElementById('reviewAuthor').value,
      date: document.getElementById('reviewDate').value,
      url: document.getElementById('reviewUrl').value,
      imageUrl: document.getElementById('reviewImageUrl').value,
      featured: document.getElementById('reviewFeatured').value
    };
    
    if (!reviewData.quote || !reviewData.author) {
      showToast('Please enter quote and author/source', 'error');
      return;
    }
    
    showLoading();
    
    if (reviewId) {
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Review updated successfully', 'success');
            closeModal('reviewModal');
            loadReviews();
          } else {
            showToast(result.message || 'Error updating review', 'error');
          }
          hideLoading();
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .updateReview(reviewId, reviewData);
    } else {
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Review added successfully', 'success');
            closeModal('reviewModal');
            loadReviews();
          } else {
            showToast(result.message || 'Error adding review', 'error');
          }
          hideLoading();
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .addReview(reviewData);
    }
  }
  
  function deleteReview(reviewId) {
    if (!confirm('Delete this review?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Review deleted successfully', 'success');
          loadReviews();
        } else {
          showToast(result.message || 'Error deleting review', 'error');
        }
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteReview(reviewId);
  }

  // ==================== CALENDAR / EVENTS ====================
  // ==================== CALENDAR - INTERACTIVE ====================
  
  // Store calendar events globally
  var calendarEvents = [];
  var selectedCalendarDate = null;

  function loadCalendar(isAutoRefresh) {
    if (!isAutoRefresh) showLoading();
    if (isAutoRefresh) showCornerSpinner();
    
    // Load events for the current month, then render calendar
    google.script.run
      .withSuccessHandler(function(events) {
        calendarEvents = events || [];
        renderCalendarWithEvents();
        loadUpcomingEvents();
        hideLoading();
        hideCornerSpinner();
      })
      .withFailureHandler(function(err) {
        console.error('Load calendar events error:', err);
        calendarEvents = [];
        renderCalendarWithEvents();
        loadUpcomingEvents();
        hideLoading();
        hideCornerSpinner();
      })
      .getEventsForMonth(currentCalendarYear, currentCalendarMonth);
  }

  function renderCalendarWithEvents() {
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    var monthYearEl = document.getElementById('currentMonthYear');
    if (monthYearEl) monthYearEl.textContent = monthNames[currentCalendarMonth] + ' ' + currentCalendarYear;
    
    var calendarDays = document.getElementById('calendarDays');
    if (!calendarDays) return;
    
    var firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();
    var daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
    var today = new Date();
    
    // Create a map of events by day
    var eventsByDay = {};
    for (var e = 0; e < calendarEvents.length; e++) {
      var evt = calendarEvents[e];
      var evtDate = new Date(evt.start_date);
      if (!isNaN(evtDate.getTime())) {
        var dayNum = evtDate.getDate();
        if (!eventsByDay[dayNum]) {
          eventsByDay[dayNum] = [];
        }
        eventsByDay[dayNum].push(evt);
      }
    }
    
    var html = '';
    
    // Empty cells before first day
    for (var i = 0; i < firstDay; i++) {
      html += '<div class="calendar-day empty"></div>';
    }
    
    // Render each day
    for (var day = 1; day <= daysInMonth; day++) {
      var isToday = (day === today.getDate() && currentCalendarMonth === today.getMonth() && currentCalendarYear === today.getFullYear());
      var isSelected = (selectedCalendarDate && selectedCalendarDate.day === day && selectedCalendarDate.month === currentCalendarMonth && selectedCalendarDate.year === currentCalendarYear);
      var dayEvents = eventsByDay[day] || [];
      var hasEvents = dayEvents.length > 0;
      
      var classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (isSelected) classes += ' selected';
      if (hasEvents) classes += ' has-events';
      
      html += '<div class="' + classes + '" onclick="selectCalendarDate(' + day + ')" data-day="' + day + '">';
      html += '<span class="day-number">' + day + '</span>';
      
      // Show event indicators
      if (hasEvents) {
        html += '<div class="calendar-event-indicators">';
        var maxIndicators = Math.min(dayEvents.length, 3);
        for (var ei = 0; ei < maxIndicators; ei++) {
          var evtType = dayEvents[ei].event_type || '';
          var indicatorClass = getEventTypeClass(evtType);
          html += '<div class="calendar-event-dot ' + indicatorClass + '"></div>';
        }
        if (dayEvents.length > 3) {
          html += '<span class="more-events">+' + (dayEvents.length - 3) + '</span>';
        }
        html += '</div>';
      }
      
      html += '</div>';
    }
    
    calendarDays.innerHTML = html;
  }

  function getEventTypeClass(eventType) {
    var type = (eventType || '').toLowerCase();
    if (type.indexOf('training') >= 0 || type.indexOf('course') >= 0) return 'event-training';
    if (type.indexOf('parade') >= 0 || type.indexOf('ceremony') >= 0) return 'event-parade';
    if (type.indexOf('competition') >= 0 || type.indexOf('shield') >= 0) return 'event-competition';
    if (type.indexOf('meeting') >= 0) return 'event-meeting';
    if (type.indexOf('camp') >= 0) return 'event-camp';
    return 'event-default';
  }

  function selectCalendarDate(day) {
    selectedCalendarDate = {
      day: day,
      month: currentCalendarMonth,
      year: currentCalendarYear
    };
    
    renderCalendarWithEvents();
    showEventsForDate(day, currentCalendarMonth, currentCalendarYear);
  }

  function showEventsForDate(day, month, year) {
    var dateEvents = [];
    for (var i = 0; i < calendarEvents.length; i++) {
      var evt = calendarEvents[i];
      var evtDate = new Date(evt.start_date);
      if (!isNaN(evtDate.getTime()) && evtDate.getDate() === day && evtDate.getMonth() === month && evtDate.getFullYear() === year) {
        dateEvents.push(evt);
      }
    }
    
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var dateStr = monthNames[month] + ' ' + day + ', ' + year;
    
    if (dateEvents.length === 0) {
      document.getElementById('modalTitle').textContent = dateStr;
      var noEventsHtml = '<div class="text-center text-muted" style="padding: 30px;">' +
        '<i class="fas fa-calendar-day" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>' +
        '<p>No events scheduled for this date</p>';
      if (isAdmin()) {
        noEventsHtml += '<button class="btn btn-primary" onclick="addEventForSelectedDate()"><i class="fas fa-plus"></i> Add Event</button>';
      }
      noEventsHtml += '</div>';
      document.getElementById('modalBody').innerHTML = noEventsHtml;
      openModal('modal');
    } else if (dateEvents.length === 1) {
      showEventDetails(dateEvents[0]);
    } else {
      document.getElementById('modalTitle').textContent = dateStr + ' - ' + dateEvents.length + ' Events';
      var html = '<div class="date-events-list">';
      for (var j = 0; j < dateEvents.length; j++) {
        var e = dateEvents[j];
        var evtIdx = -1;
        for (var k = 0; k < calendarEvents.length; k++) {
          if (calendarEvents[k].id === e.id) { evtIdx = k; break; }
        }
        html += '<div class="date-event-item" onclick="showEventDetailsByIndex(' + evtIdx + ')">' +
          '<div class="date-event-type"><span class="badge badge-' + getEventBadgeClass(e.event_type) + '">' + escapeHtml(e.event_type || 'Event') + '</span></div>' +
          '<div class="date-event-info"><h4>' + escapeHtml(e.title || '') + '</h4>' +
          '<p><i class="fas fa-clock"></i> ' + eventTimeLabel(e) + (e.location ? ' &bull; <i class="fas fa-map-marker-alt"></i> ' + escapeHtml(e.location) : '') + '</p></div>' +
          '<i class="fas fa-chevron-right" style="color:#ccc;"></i></div>';
      }
      html += '</div>';
      document.getElementById('modalBody').innerHTML = html;
      openModal('modal');
    }
  }

  function showEventDetailsByIndex(idx) {
    if (idx >= 0 && idx < calendarEvents.length) {
      showEventDetails(calendarEvents[idx]);
    }
  }

  function addEventForSelectedDate() {
    closeModal('modal');
    if (selectedCalendarDate) {
      showAddEventModalForDate(selectedCalendarDate.year, selectedCalendarDate.month, selectedCalendarDate.day);
    } else {
      showAddEventModal();
    }
  }

  function showEventDetails(event) {
    if (!event) return;
    
    // Store the current event for action buttons
    window.currentViewingEvent = event;
    
    var startDate = new Date(event.start_date);
    var endDate = event.end_date ? new Date(event.end_date) : null;
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    var dateStr = dayNames[startDate.getDay()] + ', ' + monthNames[startDate.getMonth()] + ' ' + startDate.getDate() + ', ' + startDate.getFullYear();
    
    document.getElementById('modalTitle').textContent = 'Event Details';
    
    var html = '<div class="event-details-view">';
    html += '<div class="event-details-header" style="text-align:center;padding-bottom:20px;border-bottom:1px solid var(--border);">';
    html += '<span class="badge badge-' + getEventBadgeClass(event.event_type) + '">' + escapeHtml(event.event_type || 'Event') + '</span>';
    html += '<h2 style="margin:10px 0 0;font-size:22px;">' + escapeHtml(event.title || 'Untitled Event') + '</h2>';
    html += '</div>';
    
    html += '<div class="event-details-body" style="margin-top:20px;">';
    html += '<div class="event-detail-row" style="display:flex;gap:15px;align-items:flex-start;"><i class="fas fa-calendar" style="color:var(--primary);width:20px;margin-top:3px;"></i><div><strong style="font-size:11px;color:#888;text-transform:uppercase;">Date</strong><p style="margin:3px 0 0;">' + dateStr + '</p></div></div>';
    html += '<div class="event-detail-row" style="display:flex;gap:15px;align-items:flex-start;margin-top:15px;"><i class="fas fa-clock" style="color:var(--primary);width:20px;margin-top:3px;"></i><div><strong style="font-size:11px;color:#888;text-transform:uppercase;">Time</strong><p style="margin:3px 0 0;">' + eventTimeLabel(event) + '</p></div></div>';
    
    if (event.location) {
      html += '<div class="event-detail-row" style="display:flex;gap:15px;align-items:flex-start;margin-top:15px;"><i class="fas fa-map-marker-alt" style="color:var(--primary);width:20px;margin-top:3px;"></i><div><strong style="font-size:11px;color:#888;text-transform:uppercase;">Location</strong><p style="margin:3px 0 0;">' + escapeHtml(event.location) + '</p></div></div>';
    }
    
    if (event.description) {
      html += '<div class="event-detail-row" style="display:flex;gap:15px;align-items:flex-start;margin-top:15px;"><i class="fas fa-info-circle" style="color:var(--primary);width:20px;margin-top:3px;"></i><div><strong style="font-size:11px;color:#888;text-transform:uppercase;">Description</strong><p style="margin:3px 0 0;">' + escapeHtml(event.description) + '</p></div></div>';
    }
    
    html += '</div>';
    
    if (isAdmin()) {
      html += '<div class="event-details-actions" style="margin-top:25px;padding-top:20px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:center;">';
      html += '<button class="btn btn-outline" onclick="editCurrentViewingEvent()"><i class="fas fa-edit"></i> Edit</button>';
      html += '<button class="btn btn-danger" onclick="deleteCurrentViewingEvent()"><i class="fas fa-trash"></i> Delete</button>';
      html += '</div>';
    }
    
    html += '</div>';
    
    document.getElementById('modalBody').innerHTML = html;
    openModal('modal');
  }

  function editCurrentViewingEvent() {
    if (window.currentViewingEvent && window.currentViewingEvent.id) {
      closeModal('modal');
      editEvent(window.currentViewingEvent.id);
    }
  }

  function deleteCurrentViewingEvent() {
    if (window.currentViewingEvent && window.currentViewingEvent.id) {
      closeModal('modal');
      deleteEvent(window.currentViewingEvent.id);
    }
  }

  function fmt12(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    if (!m) return '';
    var h = parseInt(m[1], 10), ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + m[2] + ' ' + ap;
  }
  function eventTimeLabel(e) {
    if (e && e.start_time) return fmt12(e.start_time) + (e.end_time ? ' \u2013 ' + fmt12(e.end_time) : '');
    return formatEventTime(e && e.start_date);   // legacy events with a time inside the date
  }
  function toggleEventAllDay() {
    var all = document.getElementById('eventAllDay').checked;
    var a = document.getElementById('eventStartTime'), b = document.getElementById('eventEndTime');
    a.disabled = all; b.disabled = all;
    if (all) { a.value = ''; b.value = ''; }
    document.getElementById('eventTimeRow').style.opacity = all ? '.5' : '1';
  }
  window.toggleEventAllDay = toggleEventAllDay;

  function formatEventTime(dateStr) {
    if (!dateStr) return 'All Day';
    var date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'All Day';
    var hours = date.getHours();
    var minutes = date.getMinutes();
    if (hours === 0 && minutes === 0) return 'All Day';
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return hours + ':' + minutes + ' ' + ampm;
  }

  function getEventBadgeClass(eventType) {
    var type = (eventType || '').toLowerCase();
    if (type.indexOf('training') >= 0 || type.indexOf('course') >= 0) return 'primary';
    if (type.indexOf('parade') >= 0 || type.indexOf('ceremony') >= 0) return 'warning';
    if (type.indexOf('competition') >= 0 || type.indexOf('shield') >= 0) return 'success';
    if (type.indexOf('meeting') >= 0) return 'info';
    if (type.indexOf('camp') >= 0) return 'secondary';
    return 'secondary';
  }

  function showAddEventModalForDate(year, month, day) {
    document.getElementById('eventModalTitle').textContent = 'Add Event';
    document.getElementById('eventForm').reset();
    toggleEventAllDay();
    document.getElementById('eventId').value = '';
    
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    var startDateInput = document.getElementById('eventStartDate');
    if (startDateInput) startDateInput.value = dateStr;
    
    openModal('eventModal');
  }


  /**
   * Refresh just the dashboard shield leaderboard (for use after team operations)
   */
  function loadDashboardShieldLeaderboard() {
    google.script.run
      .withSuccessHandler(function(data) {
        var container = document.getElementById('dashboardShieldLeaderboard');
        var leaderBanner = document.getElementById('shieldLeaderBanner');
        var leaderSchoolName = document.getElementById('leaderSchoolName');
        var leaderSchoolScore = document.getElementById('leaderSchoolScore');
        var yearEl = document.getElementById('dashboardShieldYear');
        
        if (!container) return;
        
        var competitionYear = data.selectedYear;
        
        if (yearEl && competitionYear) {
          yearEl.textContent = competitionYear + '-' + (parseInt(competitionYear, 10) + 1);
        }
        
        if (!data || !data.leaderboard || data.leaderboard.length === 0) {
          if (leaderBanner) leaderBanner.style.display = 'none';
          container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><h3>No Results Yet</h3><p>Shield Competition results will appear here</p></div>';
          return;
        }
        
        var leaderboard = data.leaderboard;
        
        // Update Leader Banner with top school
        if (leaderBanner && leaderboard.length > 0) {
          var leader = leaderboard[0];
          leaderBanner.style.display = 'flex';
          if (leaderSchoolName) leaderSchoolName.textContent = leader.school_unit || 'Unknown';
          if (leaderSchoolScore) leaderSchoolScore.textContent = (parseFloat(leader.total_score) || 0).toFixed(2) + ' points';
        }
        
        var html = '<div class="shield-podium">';
        
        // Top 3 podium display
        for (var i = 0; i < Math.min(3, leaderboard.length); i++) {
          var entry = leaderboard[i];
          var placeClass = i === 0 ? 'podium-1st' : i === 1 ? 'podium-2nd' : 'podium-3rd';
          var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
          var rankLabel = i === 0 ? '1st Place' : i === 1 ? '2nd Place' : '3rd Place';
          
          var catBreakdown = '<div class="podium-categories">' +
            '<div class="podium-cat" title="Public Speaking"><i class="fas fa-microphone"></i><span>' + (entry.public_speaking || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Orienteering"><i class="fas fa-compass"></i><span>' + (entry.orienteering || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Small Bore Shooting"><i class="fas fa-bullseye"></i><span>' + (entry.small_bore_shooting || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Drill"><i class="fas fa-users"></i><span>' + (entry.drill || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Military Knowledge"><i class="fas fa-brain"></i><span>' + (entry.military_knowledge || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Platoon Records"><i class="fas fa-clipboard-list"></i><span>' + (entry.platoon_records || 0).toFixed(0) + '</span></div>' +
            '<div class="podium-cat" title="Campcraft"><i class="fas fa-campground"></i><span>' + (entry.campcraft || 0).toFixed(0) + '</span></div>' +
            '</div>';
          
          html += '<div class="podium-place ' + placeClass + '">' +
            '<div class="podium-medal">' + medal + '</div>' +
            '<div class="podium-rank">' + rankLabel + '</div>' +
            '<div class="podium-school">' + escapeHtml(entry.school_unit || '') + '</div>' +
            (entry.platoon_number ? '<div class="podium-platoon">Platoon ' + escapeHtml(entry.platoon_number) + '</div>' : '') +
            '<div class="podium-score">' + (parseFloat(entry.total_score) || 0).toFixed(2) + ' pts</div>' +
            catBreakdown +
            '</div>';
        }
        html += '</div>';
        
        // Show 4th-10th place
        if (leaderboard.length > 3) {
          html += '<div class="shield-other-ranks">';
          for (var j = 3; j < Math.min(10, leaderboard.length); j++) {
            var e = leaderboard[j];
            html += '<div class="shield-rank-item">' +
              '<div class="shield-rank-number">' + (j + 1) + '</div>' +
              '<div class="shield-rank-info"><h4>' + escapeHtml(e.school_unit || '') + '</h4>' +
              (e.platoon_number ? '<p>Platoon ' + escapeHtml(e.platoon_number) + '</p>' : '') + '</div>' +
              '<div class="shield-rank-score">' + (parseFloat(e.total_score) || 0).toFixed(2) + '</div></div>';
          }
          html += '</div>';
        }
        
        container.innerHTML = html;
        console.log('Dashboard leaderboard refreshed');
      })
      .withFailureHandler(function(err) { 
        console.error('Refresh shield leaderboard error:', err);
      })
      .getShieldDataFast(currentShieldYear || 'auto');
  }

  function loadUpcomingEvents() {
    google.script.run
      .withSuccessHandler(function(events) {
        var cardsContainer = document.getElementById('upcomingEventsCards');
        if (!cardsContainer) return;
        
        if (!events || events.length === 0) {
          cardsContainer.innerHTML = '<div class="no-upcoming-events"><i class="fas fa-calendar-check"></i><p>No upcoming events</p></div>';
          return;
        }
        
        var cardsHtml = '';
        var count = Math.min(events.length, 10);
        var today = new Date();
        today.setHours(0,0,0,0);
        
        for (var i = 0; i < count; i++) {
          var e = events[i];
          var startDate = new Date(e.start_date);
          var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          var month = months[startDate.getMonth()];
          var day = startDate.getDate();
          var year = startDate.getFullYear();
          var monthIndex = startDate.getMonth();
          var eventId = e.id || '';
          
          // Calculate days until event
          var eventDate = new Date(startDate);
          eventDate.setHours(0,0,0,0);
          var diffTime = eventDate - today;
          var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          var urgencyClass = '';
          var urgencyLabel = '';
          if (diffDays === 0) {
            urgencyClass = 'event-card-today';
            urgencyLabel = '<span class="event-card-urgency today"><i class="fas fa-bolt"></i> Today</span>';
          } else if (diffDays === 1) {
            urgencyClass = 'event-card-tomorrow';
            urgencyLabel = '<span class="event-card-urgency tomorrow"><i class="fas fa-clock"></i> Tomorrow</span>';
          } else if (diffDays <= 7) {
            urgencyClass = 'event-card-thisweek';
            urgencyLabel = '<span class="event-card-urgency thisweek"><i class="fas fa-calendar-day"></i> ' + diffDays + ' days</span>';
          } else {
            urgencyClass = 'event-card-later';
            urgencyLabel = '<span class="event-card-urgency later"><i class="fas fa-calendar"></i> ' + diffDays + ' days</span>';
          }
          
          // Event type icon
          var typeIcon = 'fa-calendar-alt';
          var eventType = (e.event_type || '').toLowerCase();
          if (eventType.indexOf('drill') >= 0 || eventType.indexOf('parade') >= 0) typeIcon = 'fa-users';
          else if (eventType.indexOf('training') >= 0 || eventType.indexOf('course') >= 0) typeIcon = 'fa-graduation-cap';
          else if (eventType.indexOf('competition') >= 0 || eventType.indexOf('shield') >= 0) typeIcon = 'fa-trophy';
          else if (eventType.indexOf('camp') >= 0) typeIcon = 'fa-campground';
          else if (eventType.indexOf('meeting') >= 0) typeIcon = 'fa-handshake';
          else if (eventType.indexOf('exam') >= 0 || eventType.indexOf('test') >= 0) typeIcon = 'fa-file-alt';
          else if (eventType.indexOf('sport') >= 0 || eventType.indexOf('fitness') >= 0) typeIcon = 'fa-running';
          else if (eventType.indexOf('ceremon') >= 0) typeIcon = 'fa-award';
          
          // End date info
          var endDateHtml = '';
          if (e.end_date) {
            var endDate = new Date(e.end_date);
            if (endDate.toDateString() !== startDate.toDateString()) {
              endDateHtml = '<span class="event-card-enddate"><i class="fas fa-arrow-right"></i> ' + 
                months[endDate.getMonth()] + ' ' + endDate.getDate() + '</span>';
            }
          }
          
          // Admin edit/delete buttons
          var adminBtns = isAdmin() ? 
            '<div class="event-card-actions">' +
            '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); editEvent(\'' + eventId + '\')" title="Edit"><i class="fas fa-edit"></i></button>' +
            '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteEvent(\'' + eventId + '\')" title="Delete"><i class="fas fa-trash"></i></button>' +
            '</div>' : '';
          
          cardsHtml += '<div class="event-card ' + urgencyClass + '" onclick="navigateToEventDate(' + year + ',' + monthIndex + ',' + day + ',\'' + eventId + '\')">' +
            '<div class="event-card-date-strip">' +
            '<span class="event-card-day-name">' + days[startDate.getDay()] + '</span>' +
            '<span class="event-card-day-num">' + day + '</span>' +
            '<span class="event-card-month">' + month + ' ' + year + '</span>' +
            '</div>' +
            '<div class="event-card-body">' +
            '<div class="event-card-top">' +
            '<span class="event-card-type"><i class="fas ' + typeIcon + '"></i> ' + escapeHtml(e.event_type || 'Event') + '</span>' +
            urgencyLabel +
            '</div>' +
            '<h4 class="event-card-title">' + escapeHtml(e.title || 'Untitled Event') + '</h4>' +
            '<p class="event-card-location"><i class="fas fa-clock"></i> ' + eventTimeLabel(e) + '</p>' +
            (e.location ? '<p class="event-card-location"><i class="fas fa-map-marker-alt"></i> ' + escapeHtml(e.location) + '</p>' : '') +
            (e.description ? '<p class="event-card-desc">' + escapeHtml(e.description).substring(0, 100) + (e.description.length > 100 ? '...' : '') + '</p>' : '') +
            endDateHtml +
            adminBtns +
            '</div>' +
            '</div>';
        }
        
        cardsContainer.innerHTML = cardsHtml;
      })
      .withFailureHandler(function(err) {
        console.error('Load events error:', err);
      })
      .getUpcomingEvents(30);
  }

  function navigateToEventDate(year, month, day, eventId) {
    currentCalendarYear = year;
    currentCalendarMonth = month;
    
    selectedCalendarDate = {
      day: day,
      month: month,
      year: year
    };
    
    google.script.run
      .withSuccessHandler(function(events) {
        calendarEvents = events || [];
        renderCalendarWithEvents();
        
        var calendarEl = document.getElementById('calendarDays');
        if (calendarEl) {
          calendarEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        setTimeout(function() {
          var selectedDay = document.querySelector('.calendar-day.selected');
          if (selectedDay) {
            selectedDay.classList.add('pulse-highlight');
            setTimeout(function() {
              selectedDay.classList.remove('pulse-highlight');
            }, 1500);
          }
        }, 300);
        
        // Find and show the specific event
        if (eventId) {
          for (var i = 0; i < calendarEvents.length; i++) {
            if (calendarEvents[i].id === eventId) {
              showEventDetails(calendarEvents[i]);
              break;
            }
          }
        } else {
          showEventsForDate(day, month, year);
        }
      })
      .withFailureHandler(function(err) {
        console.error('Load calendar events error:', err);
      })
      .getEventsForMonth(year, month);
  }

  function prevMonth() {
    currentCalendarMonth--;
    if (currentCalendarMonth < 0) {
      currentCalendarMonth = 11;
      currentCalendarYear--;
    }
    selectedCalendarDate = null;
    loadCalendar();
  }

  function nextMonth() {
    currentCalendarMonth++;
    if (currentCalendarMonth > 11) {
      currentCalendarMonth = 0;
      currentCalendarYear++;
    }
    selectedCalendarDate = null;
    loadCalendar();
  }


    function showAddEventModal() {
    document.getElementById('eventModalTitle').textContent = 'Add Event';
    document.getElementById('eventForm').reset();
    toggleEventAllDay();
    document.getElementById('eventId').value = '';
    openModal('eventModal');
  }
  
  function editEvent(eventId) {
    showLoading();
    google.script.run
      .withSuccessHandler(function(event) {
        if (!event) {
          showToast('Event not found', 'error');
          hideLoading();
          return;
        }
        
        document.getElementById('eventModalTitle').textContent = 'Edit Event';
        document.getElementById('eventId').value = event.id || '';
        document.getElementById('eventTitle').value = event.title || '';
        document.getElementById('eventDescription').value = event.description || '';
        document.getElementById('eventType').value = event.event_type || 'General';
        document.getElementById('eventLocation').value = event.location || '';
        
        if (event.start_date) {
          var sd = new Date(event.start_date);
          if (!isNaN(sd.getTime())) {
            document.getElementById('eventStartDate').value = sd.toISOString().split('T')[0];
          }
        }
        if (event.end_date) {
          var ed = new Date(event.end_date);
          if (!isNaN(ed.getTime())) {
            document.getElementById('eventEndDate').value = ed.toISOString().split('T')[0];
          }
        }
        
        document.getElementById('eventStartTime').value = event.start_time || '';
        document.getElementById('eventEndTime').value = event.end_time || '';
        document.getElementById('eventAllDay').checked = !event.start_time;
        toggleEventAllDay();
        openModal('eventModal');
        hideLoading();
      })
      .withFailureHandler(function(err) {
        showToast('Error loading event: ' + (err.message || err), 'error');
        hideLoading();
      })
      .getEventById(eventId);
  }

  function saveEvent() {
    var eventId = document.getElementById('eventId').value;
    var eventData = {
      title: document.getElementById('eventTitle').value,
      description: document.getElementById('eventDescription').value,
      eventType: document.getElementById('eventType').value,
      startDate: document.getElementById('eventStartDate').value,
      endDate: document.getElementById('eventEndDate').value,
      startTime: document.getElementById('eventAllDay').checked ? '' : document.getElementById('eventStartTime').value,
      endTime: document.getElementById('eventAllDay').checked ? '' : document.getElementById('eventEndTime').value,
      location: document.getElementById('eventLocation').value
    };
    if (eventData.endTime && !eventData.startTime) {
      showToast('Add a start time, or clear the end time.', 'error');
      return;
    }
    
    if (!eventData.title || !eventData.startDate) {
      showToast('Please fill in required fields', 'error');
      return;
    }
    
    showLoading();
    
    if (eventId) {
      // Update existing
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Event updated successfully', 'success');
            closeModal('eventModal');
            loadCalendar();
          } else {
            showToast(result.message || 'Error updating event', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .updateEvent(eventId, eventData);
    } else {
      // Create new
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showToast('Event added successfully', 'success');
            closeModal('eventModal');
            loadCalendar();
          } else {
            showToast(result.message || 'Error adding event', 'error');
            hideLoading();
          }
        })
        .withFailureHandler(function(err) {
          showToast('Error: ' + (err.message || err), 'error');
          hideLoading();
        })
        .addEvent(eventData);
    }
  }
  
  function deleteEvent(eventId) {
    if (!confirm('Delete this event?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Event deleted', 'success');
          loadCalendar();
        } else {
          showToast(result.message || 'Error deleting event', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteEvent(eventId);
  }

  // ==================== USER MANAGEMENT ====================
  function loadUsers(isAutoRefresh) {
    if (!isAutoRefresh) showLoading();
    if (isAutoRefresh) showCornerSpinner();
    if (!isAdmin()) { hideLoading(); return; }
    var addBtn = document.getElementById('addUserBtn'); if (addBtn) addBtn.style.display = isSuperAdmin() ? '' : 'none';
    
    google.script.run
      .withSuccessHandler(function(users) {
        var tbody = document.getElementById('usersTableBody');
        if (!tbody) { hideLoading(); return; }
        
        if (!users || users.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No users found</td></tr>';
          hideLoading();
          return;
        }
        
        // Sort: Pending first, then by date
        users.sort(function(a, b) {
          if (a.status === 'Pending' && b.status !== 'Pending') return -1;
          if (b.status === 'Pending' && a.status !== 'Pending') return 1;
          return 0;
        });
        
        var html = '';
        for (var i = 0; i < users.length; i++) {
          var u = users[i];
          var statusClass = u.status === 'Active' ? 'success' : u.status === 'Pending' ? 'warning' : 'danger';
          var statusBadge = '<span class="badge badge-' + statusClass + '">' + escapeHtml(u.status || '') + '</span>';
          
          var actions = '';
          if (u.status === 'Pending') {
            actions += '<button class="btn btn-sm btn-success" onclick="approveUser(\'' + u.id + '\')" title="Approve Registration"><i class="fas fa-check"></i> Approve</button> ';
            actions += '<button class="btn btn-sm btn-danger" onclick="denyUser(\'' + u.id + '\')" title="Deny Registration"><i class="fas fa-times"></i> Deny</button> ';
          } else {
            actions += '<button class="btn btn-sm btn-outline" onclick="editUserRole(\'' + u.id + '\',\'' + escapeHtml(u.role || '') + '\')" title="Change Role"><i class="fas fa-user-cog"></i></button> ';
            if (isAdmin()) { actions += '<button class="btn btn-sm btn-warning" onclick="resetUserPassword(\'' + u.id + '\',\'' + escapeHtml((u.firstName || '') + ' ' + (u.lastName || '')) + '\')" title="Reset Password"><i class="fas fa-key"></i></button> '; }
            actions += '<button class="btn btn-sm btn-danger" onclick="deleteUser(\'' + u.id + '\')" title="Delete User"><i class="fas fa-trash"></i></button>';
          }
          
          // Highlight pending rows
          var rowClass = u.status === 'Pending' ? ' class="pending-row"' : '';
          
          html += '<tr' + rowClass + '>' +
            '<td><strong>' + escapeHtml(u.regimentalNumber || '-') + '</strong></td>' +
            '<td>' + escapeHtml((u.firstName || '') + ' ' + (u.lastName || '')) + '</td>' +
            '<td>' + escapeHtml(u.email || '') + '</td>' +
            '<td>' + escapeHtml(u.battalion || '-') + '</td>' +
            '<td>' + escapeHtml(u.unit || '-') + '</td>' +
            '<td><span class="badge badge-' + (u.accountType === 'Adult' ? 'info' : 'secondary') + '">' + escapeHtml(u.accountType || (u.role === 'Cadet' ? 'Cadet' : 'Adult')) + '</span></td>' +
            '<td>' + escapeHtml(u.role || '') + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td class="actions-cell">' + actions + '</td></tr>';
        }
        tbody.innerHTML = html;
        hideLoading();
      })
      .withFailureHandler(function(err) {
        console.error('Load users error:', err);
        hideLoading();
      })
      .getAllUsers();
  }

  // ---- Super Admin: create a user directly ----
  var ADD_USER_ROLES = { Cadet: ['Cadet'], Adult: ['Instructor', 'Unit Officer', 'Battalion Commander', 'Judge', 'Admin', 'Super Admin'] };
  function openAddUser() {
    if (!isSuperAdmin()) { showToast('Only a Super Admin can create users', 'error'); return; }
    var old = document.getElementById('auModal'); if (old) old.remove();
    var o = document.createElement('div'); o.id = 'auModal'; o.className = 'modal-overlay active';
    o.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="modal-header"><h3>Add user</h3><button class="modal-close" id="auX" aria-label="Close">&times;</button></div>' +
      '<div class="modal-body" id="auBody">' +
      '<div class="form-group"><label>Account type</label><select id="auType" class="form-control"><option value="Adult">Adult (officer, instructor, judge, admin)</option><option value="Cadet">Cadet</option></select></div>' +
      '<div class="form-group"><label>Role</label><select id="auRole" class="form-control"></select></div>' +
      '<div class="form-group"><label>First name</label><input id="auFirst" class="form-control"></div>' +
      '<div class="form-group"><label>Last name</label><input id="auLast" class="form-control"></div>' +
      '<div class="form-group"><label>Email</label><input id="auEmail" type="email" class="form-control"></div>' +
      '<div class="form-group"><label>Battalion <span class="text-muted">(required for Battalion Commander and Unit Officer)</span></label><input id="auBn" class="form-control" placeholder="e.g. 5TTCF"></div>' +
      '<div class="form-group"><label>Unit <span class="text-muted">(required for Unit Officer)</span></label><input id="auUnit" class="form-control"></div>' +
      '<div class="form-group" id="auRegWrap"><label>Regimental number <span class="text-muted">(cadets, optional)</span></label><input id="auReg" class="form-control"></div>' +
      '<p class="text-muted">A temporary password is created, shown here and emailed to the person. They must change it at first sign-in.</p></div>' +
      '<div class="modal-footer"><button class="btn btn-outline" id="auCancel">Cancel</button><button class="btn btn-primary" id="auSave"><i class="fas fa-user-plus"></i> Create user</button></div></div>';
    document.body.appendChild(o);
    function fillRoles() { var t = document.getElementById('auType').value; document.getElementById('auRole').innerHTML = ADD_USER_ROLES[t].map(function (r) { return '<option>' + r + '</option>'; }).join(''); document.getElementById('auRegWrap').style.display = t === 'Cadet' ? '' : 'none'; }
    document.getElementById('auType').onchange = fillRoles; fillRoles();
    function close() { o.remove(); }
    document.getElementById('auX').onclick = close; document.getElementById('auCancel').onclick = close;
    document.getElementById('auSave').onclick = function () {
      var btn = this, d = { accountType: document.getElementById('auType').value, role: document.getElementById('auRole').value, firstName: document.getElementById('auFirst').value, lastName: document.getElementById('auLast').value,
        email: document.getElementById('auEmail').value, battalion: document.getElementById('auBn').value, unit: document.getElementById('auUnit').value, regimentalNumber: document.getElementById('auReg').value };
      btn.disabled = true;
      google.script.run.withSuccessHandler(function (r) {
        btn.disabled = false;
        if (!r || !r.success) { showToast((r && r.message) || 'Could not create user', 'error'); return; }
        document.getElementById('auBody').innerHTML = '<p><b>' + escapeHtml(d.firstName + ' ' + d.lastName) + '</b> (' + escapeHtml(r.role) + ', ' + escapeHtml(r.accountType) + ')</p><p>' + escapeHtml(r.message) + '</p><p>Temporary password: <code id="auTemp" style="font-size:18px">' + escapeHtml(r.tempPassword) + '</code></p>';
        document.getElementById('auSave').style.display = 'none'; document.getElementById('auCancel').textContent = 'Done';
        showToast('User created', 'success'); loadUsers(true);
      }).withFailureHandler(function (e) { btn.disabled = false; showToast('Error: ' + (e.message || e), 'error'); }).createUser(d);
    };
  }
  window.openAddUser = openAddUser;

  function approveUser(userId) {
    if (!confirm('Approve this user registration? They will be granted access to the system and their cadet record will be activated.')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('User approved successfully! Cadet record activated.', 'success');
          loadUsers();
        } else {
          showToast(result.message || 'Error approving user', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .approveUser(userId);
  }
  
  function denyUser(userId) {
    if (!confirm('Deny this user registration? They will not be able to access the system.')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('Registration denied', 'success');
          loadUsers();
        } else {
          showToast(result.message || 'Error denying user', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .denyUser(userId);
  }

  function editUserRole(userId, currentRole) {
    var curType = currentRole === 'Cadet' || currentRole === 'User' ? 'Cadet' : (currentRole === 'Guest' ? 'Guest' : 'Adult');
    var sup = isSuperAdmin();
    var BY_TYPE = { Cadet: ['Cadet'], Adult: ['Instructor', 'Unit Officer', 'Battalion Commander', 'Judge'].concat(sup ? ['Admin', 'Super Admin'] : []), Guest: ['Guest'] };
    var old = document.getElementById('urModal'); if (old) old.remove();
    var o = document.createElement('div'); o.id = 'urModal'; o.className = 'modal-overlay active';
    o.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="modal-header"><h3>Change role</h3><button class="modal-close" id="urX" aria-label="Close">&times;</button></div><div class="modal-body">' +
      '<div class="form-group"><label>Account type</label><select id="urType" class="form-control"'  + '><option>Adult</option><option>Cadet</option>' + (curType === 'Guest' ? '<option>Guest</option>' : '') + '</select>' + '</div>' +
      '<div class="form-group"><label>Role</label><select id="urRole" class="form-control"></select></div></div>' +
      '<div class="modal-footer"><button class="btn btn-outline" id="urCancel">Cancel</button><button class="btn btn-primary" id="urSave">Save</button></div></div>';
    document.body.appendChild(o);
    var typeEl = document.getElementById('urType'), roleEl = document.getElementById('urRole');
    typeEl.value = curType;
    function fill() {
      var list = BY_TYPE[typeEl.value] || [];
      if (typeEl.value === curType && list.indexOf(currentRole === 'User' ? 'Cadet' : currentRole) < 0 && currentRole) list = list.concat([currentRole]);   // keep a role the viewer cannot assign visible
      roleEl.innerHTML = list.map(function (r) { return '<option>' + r + '</option>'; }).join('');
      roleEl.value = typeEl.value === curType ? (currentRole === 'User' ? 'Cadet' : currentRole) : list[0];
    }
    typeEl.onchange = fill; fill();
    function close() { o.remove(); }
    document.getElementById('urX').onclick = close; document.getElementById('urCancel').onclick = close;
    document.getElementById('urSave').onclick = function () {
      var newRole = roleEl.value;
      if (!newRole || newRole === currentRole) { close(); return; }
      close(); showLoading();
      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) { showToast('Role updated', 'success'); loadUsers(); }
          else { showToast(result.message || 'Error', 'error'); hideLoading(); }
        })
        .withFailureHandler(function(err) { showToast('Error: ' + (err.message || err), 'error'); hideLoading(); })
        .updateUserRole(userId, newRole);
    };
  }

  function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          showToast('User deleted', 'success');
          loadUsers();
        } else {
          showToast(result.message || 'Error', 'error');
          hideLoading();
        }
      })
      .withFailureHandler(function(err) {
        showToast('Error: ' + (err.message || err), 'error');
        hideLoading();
      })
      .deleteUser(userId);
  }
  
  // Reset user password (Super Admin only)
  function resetUserPassword(userId, userName) {
    if (!isAdmin()) {
      showToast('Only Admins can reset passwords', 'error');
      return;
    }
    if (!confirm('Reset password for ' + userName + '?')) return;
    
    showLoading();
    google.script.run
      .withSuccessHandler(function(result) {
        hideLoading();
        if (result.success) {
          showToast('Password reset successful', 'success');
          alert('New temporary password for ' + userName + ':\n\n' + result.tempPassword + '\n\nShare it securely. The user must choose a new password at next sign-in.');
        } else {
          showToast(result.message || 'Error', 'error');
        }
      })
      .withFailureHandler(function(err) {
        hideLoading();
        showToast('Error: ' + (err.message || err), 'error');
      })
      .resetUserPassword(userId);
  }

  // ============================================
// SHIELD COMPETITION JAVASCRIPT FUNCTIONS
// ADD THESE FUNCTIONS TO THE END OF YOUR JavaScript.html
// ============================================

// Global state for Shield Competition
var currentShieldCategory = 'overview';
var currentOrienteeringView = 'team-leaderboard';
var shieldData = null;
var orienteeringTeams = [];
var orienteeringIndividuals = [];
var schoolsData = [];

// ============================================
// TAB NAVIGATION
// ============================================

function switchShieldCategory(category) {
  // Update tab buttons
  document.querySelectorAll('.shield-tab').forEach(function(tab) {
    tab.classList.remove('active');
    if (tab.dataset.category === category) {
      tab.classList.add('active');
    }
  });
  
  // Update panels
  document.querySelectorAll('.shield-panel').forEach(function(panel) {
    panel.classList.remove('active');
  });
  
  var targetPanel = document.getElementById('shield-' + category);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }
  
  currentShieldCategory = category;
  
  // Load category-specific data
  loadCategoryData(category);
  
  // Update add button visibility based on user role
  updateCategoryAddButtons(category);
}

function switchOrienteeringView(view) {
  // Update subtab buttons
  document.querySelectorAll('.orienteering-subtabs .subtab').forEach(function(tab) {
    tab.classList.remove('active');
    if (tab.dataset.view === view) {
      tab.classList.add('active');
    }
  });
  
  // Update views
  document.querySelectorAll('.orienteering-view').forEach(function(v) {
    v.classList.remove('active');
  });
  
  var targetView = document.getElementById('orienteering-' + view);
  if (targetView) {
    targetView.classList.add('active');
  }
  
  currentOrienteeringView = view;
}



// ============================================
// RENDERING FUNCTIONS
// ============================================

function renderShieldOverview(data) {
  // Category Breakdown
  var categoryBreakdown = document.getElementById('categoryBreakdown');
  if (categoryBreakdown) {
    var categories = [
      { key: 'public_speaking', name: 'Public Speaking', icon: 'microphone', tab: 'public-speaking' },
      { key: 'orienteering', name: 'Orienteering', icon: 'compass', tab: 'orienteering' },
      { key: 'small_bore_shooting', name: 'Small Bore Shooting', icon: 'crosshairs', tab: 'small-bore' },
      { key: 'drill', name: 'Drill', icon: 'users', tab: 'drill' },
      { key: 'military_knowledge', name: 'Military Knowledge', icon: 'book', tab: 'military-knowledge' },
      { key: 'platoon_records', name: 'Platoon Records', icon: 'clipboard-list', tab: 'platoon-records' },
      { key: 'campcraft', name: 'Campcraft', icon: 'campground', tab: 'campcraft' }
    ];
    
    var html = '';
    categories.forEach(function(cat) {
      // Find leader for this category
      var leader = null;
      var leaderScore = 0;
      if (data.leaderboard) {
        data.leaderboard.forEach(function(entry) {
          var score = entry[cat.key] || 0;
          if (score > leaderScore) {
            leaderScore = score;
            leader = entry.school_unit;
          }
        });
      }
      
      html += '<div class="category-item" onclick="switchShieldCategory(\'' + cat.tab + '\')">' +
        '<i class="fas fa-' + cat.icon + '"></i>' +
        '<span class="category-name">' + cat.name + '</span>' +
        '<span class="category-leader">' + (leader || 'TBD') + '</span>' +
        '<span class="category-entries">' + (leaderScore > 0 ? leaderScore + ' pts' : '-') + '</span>' +
        '</div>';
    });
    categoryBreakdown.innerHTML = html;
  }
  
  // School / Platoon Full Leaderboard
  renderSchoolPlatoonLeaderboard(data);
}

function renderSchoolPlatoonLeaderboard(data) {
  var tbody = document.getElementById('schoolPlatoonLeaderboardBody');
  if (!tbody || !data || !data.leaderboard) return;
  
  var leaderboard = data.leaderboard.slice(); // Copy array
  
  if (leaderboard.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted" style="padding: 24px;">No results yet for this competition year</td></tr>';
    return;
  }
  
  // Store for filtering
  window._schoolPlatoonData = leaderboard;
  
  buildSchoolPlatoonRows(leaderboard);
}

function buildSchoolPlatoonRows(leaderboard) {
  var tbody = document.getElementById('schoolPlatoonLeaderboardBody');
  if (!tbody) return;
  
  var html = '';
  
  leaderboard.forEach(function(entry, index) {
    var total = parseFloat(entry.total_score) || 0;
    var ps = parseFloat(entry.public_speaking) || 0;
    var ori = parseFloat(entry.orienteering) || 0;
    var sbs = parseFloat(entry.small_bore_shooting) || 0;
    var drl = parseFloat(entry.drill) || 0;
    var mk = parseFloat(entry.military_knowledge) || 0;
    var pr = parseFloat(entry.platoon_records) || 0;
    var cc = parseFloat(entry.campcraft) || 0;
    
    // Row highlight for top 3
    var rowClass = '';
    if (index === 0) rowClass = 'rank-gold';
    else if (index === 1) rowClass = 'rank-silver';
    else if (index === 2) rowClass = 'rank-bronze';
    
    // Rank - just position number
    var rankDisplay = '<span class="rank-num">' + (index + 1) + '</span>';
    
    // Helper to show score or dash
    function scoreCell(val) {
      if (val > 0) return '<td class="col-cat score-cell">' + val + '</td>';
      return '<td class="col-cat score-cell score-empty">-</td>';
    }
    
    html += '<tr class="spl-row ' + rowClass + '">' +
      '<td class="col-rank">' + rankDisplay + '</td>' +
      '<td class="col-school"><span class="spl-school-name">' + escapeHtml(entry.school_unit || 'Unknown') + '</span></td>' +
      '<td class="col-platoon"><span class="spl-platoon-badge">' + escapeHtml(entry.platoon_number || '-') + '</span></td>' +
      scoreCell(ps) +
      scoreCell(ori) +
      scoreCell(sbs) +
      scoreCell(drl) +
      scoreCell(mk) +
      scoreCell(pr) +
      scoreCell(cc) +
      '<td class="col-total"><strong>' + total.toFixed(2) + '</strong></td>' +
      '</tr>';
  });
  
  tbody.innerHTML = html;
}

function filterSchoolLeaderboard() {
  var searchInput = document.getElementById('schoolLeaderboardSearch');
  if (!searchInput || !window._schoolPlatoonData) return;
  
  var query = searchInput.value.toLowerCase().trim();
  
  if (!query) {
    buildSchoolPlatoonRows(window._schoolPlatoonData);
    return;
  }
  
  var filtered = window._schoolPlatoonData.filter(function(entry) {
    var school = (entry.school_unit || '').toLowerCase();
    var platoon = (entry.platoon_number || '').toString().toLowerCase();
    return school.indexOf(query) >= 0 || platoon.indexOf(query) >= 0;
  });
  
  buildSchoolPlatoonRows(filtered);
}

function renderCategoryLeaderboard(categoryId, categoryName) {
  var containerMap = {
    'public-speaking': 'publicSpeakingLeaderboard',
    'small-bore': 'smallBoreLeaderboard',
    'drill': 'drillLeaderboard',
    'military-knowledge': 'milKnowledgeLeaderboard',
    'platoon-records': 'platoonRecordsLeaderboard',
    'campcraft': 'campcraftLeaderboard'
  };
  
  var container = document.getElementById(containerMap[categoryId]);
  if (!container) return;
  
  // Get category key for data lookup
  var categoryKey = categoryId.replace(/-/g, '_');
  
  // Build results from leaderboard data
  var results = [];
  if (shieldData && shieldData.leaderboard) {
    shieldData.leaderboard.forEach(function(entry) {
      var score = entry[categoryKey] || 0;
      if (score > 0) {
        results.push({
          school_unit: entry.school_unit,
          platoon_number: entry.platoon_number,
          score: score
        });
      }
    });
  }
  
  // Sort by score descending
  results.sort(function(a, b) { return b.score - a.score; });
  
  if (results.length === 0) {
    container.innerHTML = '<p class="no-data">No results yet for this category</p>';
    return;
  }
  
  var html = '<div class="table-responsive table-responsive-sticky"><table class="data-table">' +
    '<thead><tr>' +
    '<th>Position</th>' +
    '<th>School/Unit</th>' +
    '<th>Platoon</th>' +
    '<th>Score</th>' +
    '</tr></thead><tbody>';
  
  results.forEach(function(result, index) {
    var positionBadge = getPositionBadge(index + 1);
    html += '<tr>' +
      '<td>' + positionBadge + '</td>' +
      '<td>' + (result.school_unit || '-') + '</td>' +
      '<td>' + (result.platoon_number || '-') + '</td>' +
      '<td><strong>' + (result.score || 0) + '</strong></td>' +
      '</tr>';
  });
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
}


/**
 * Check if team has a status note (disqualified, absent, etc.)
 * Returns object with hasStatus and statusType
 */
function getTeamStatusFromNotes(notes) {
  if (!notes) return { hasStatus: false, statusType: null, statusClass: null };
  
  var notesLower = notes.toLowerCase();
  
  if (notesLower.indexOf('disqualif') >= 0 || notesLower.indexOf('dq') >= 0) {
    return { hasStatus: true, statusType: 'Disqualified', statusClass: 'status-disqualified' };
  }
  if (notesLower.indexOf('absent') >= 0 || notesLower.indexOf('no show') >= 0 || notesLower.indexOf('no-show') >= 0) {
    return { hasStatus: true, statusType: 'Absent', statusClass: 'status-absent' };
  }
  if (notesLower.indexOf('withdraw') >= 0) {
    return { hasStatus: true, statusType: 'Withdrawn', statusClass: 'status-withdrawn' };
  }
  if (notesLower.indexOf('penalt') >= 0 || notesLower.indexOf('penalty') >= 0) {
    return { hasStatus: true, statusType: 'Penalty', statusClass: 'status-penalty' };
  }
  
  return { hasStatus: false, statusType: null, statusClass: null };
}

function renderOrienteeringTeamLeaderboard() {
  var tbody = document.getElementById('orienteeringTeamLeaderboardBody');
  if (!tbody) return;
  
  if (orienteeringTeams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="no-data">No teams registered yet</td></tr>';
    return;
  }
  
  // Sort by total score descending
  var sortedTeams = orienteeringTeams.slice().sort(function(a, b) {
    return (b.totalScore || 0) - (a.totalScore || 0);
  });
  
  var html = '';
  sortedTeams.forEach(function(team, index) {
    var position = index + 1;
    var teamStatus = getTeamStatusFromNotes(team.notes);
    var statusBadge = '';
    var rowClass = '';
    
    // Show status badge to admins only
    if (teamStatus.hasStatus && isAdmin()) {
      statusBadge = '<span class="team-status-badge ' + teamStatus.statusClass + '" title="See notes: ' + (team.notes || '').replace(/"/g, "&quot;") + '">' +
        '<i class="fas fa-exclamation-triangle"></i> ' + teamStatus.statusType + '</span>';
      rowClass = ' class="status-row ' + teamStatus.statusClass + '-row"';
    }
    
    html += '<tr' + rowClass + '>' +
      '<td>' + position + '</td>' +
      '<td>' + (team.teamName || 'Team ' + (index + 1)) + statusBadge + '</td>' +
      '<td>' + (team.battalion || '-') + '</td>' +
      '<td>' + (team.schoolUnit || '-') + '</td>' +
      '<td>' + (team.markersScore || 0) + '</td>' +
      '<td>' + (team.timeScore || 0) + '</td>' +
      '<td>' + (team.gridScore || 0) + '</td>' +
      '<td>' + (team.equipmentScore || 0) + '</td>' +
      '<td><strong>' + (team.totalScore || 0) + '</strong></td>' +
      '</tr>';
  });
  
  tbody.innerHTML = html;
}

function renderOrienteeringIndividuals() {
  var tbody = document.getElementById('orienteeringIndividualBody');
  if (!tbody) return;
  
  if (orienteeringIndividuals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="no-data">No individual scores yet</td></tr>';
    return;
  }
  
  var html = '';
  orienteeringIndividuals.forEach(function(indiv) {
    var adminUser = isAdmin();
    html += '<tr>' +
      '<td>' + (indiv.regNo || '-') + '</td>' +
      '<td>' + (indiv.rank || '-') + '</td>' +
      '<td>' + (indiv.surname || '') + ' ' + (indiv.firstName || '') + '</td>' +
      '<td>' + (indiv.battalion || '-') + '</td>' +
      '<td>' + (indiv.schoolUnit || '-') + '</td>' +
      '<td>' + (indiv.totalTime || '-') + '</td>' +
      '<td>' + (indiv.markersFound || 0) + '</td>' +
      '<td>' + (indiv.gridRefs || 0) + '</td>' +
      '<td><strong>' + (indiv.totalPoints || 0) + '</strong></td>' +
      '<td class="actions">' +
      (isAdmin ? '<button class="btn btn-sm btn-icon" onclick="editOrienteeringIndividual(\'' + indiv.id + '\')" title="Edit"><i class="fas fa-edit"></i></button>' : '-') +
      '</td></tr>';
  });
  
  tbody.innerHTML = html;
}

function renderTeamManagement() {
  var container = document.getElementById('teamManagementContainer');
  if (!container) return;
  
  if (orienteeringTeams.length === 0) {
    container.innerHTML = '<p class="no-data">No teams created yet. Click "Add Team" to create one.</p>';
    return;
  }
  
  var html = '';
  orienteeringTeams.forEach(function(team) {
    var membersHtml = '';
    if (team.members && team.members.length > 0) {
      team.members.forEach(function(m, i) {
        membersHtml += '<div class="member-row">' +
          '<span class="member-num">' + (i + 1) + '.</span>' +
          '<span>' + (m.rank || '') + ' ' + (m.surname || '') + ' ' + (m.firstName || '') + '</span>' +
          '<span class="reg-no">(' + (m.regNo || '-') + ')</span>' +
          '</div>';
      });
    }
    
    var teamStatus = getTeamStatusFromNotes(team.notes);
    var statusBadge = '';
    var cardClass = 'team-management-card';
    
    // Show status badge to admins only
    if (teamStatus.hasStatus && isAdmin()) {
      statusBadge = '<div class="team-status-alert ' + teamStatus.statusClass + '">' +
        '<i class="fas fa-exclamation-triangle"></i> ' + teamStatus.statusType + ' - See Notes</div>';
      cardClass += ' ' + teamStatus.statusClass + '-card';
    }
    
    html += '<div class="' + cardClass + '">' +
      statusBadge +
      '<div class="team-header">' +
      '<h4>' + (team.teamName || 'Unnamed Team') + '</h4>' +
      '<span class="team-score">' + (team.totalScore || 0) + ' pts</span>' +
      '</div>' +
      '<div class="team-info">' +
      '<span><i class="fas fa-building"></i> ' + (team.battalion || '-') + '</span>' +
      '<span><i class="fas fa-school"></i> ' + (team.schoolUnit || '-') + '</span>' +
      '<span><i class="fas fa-hashtag"></i> Platoon ' + (team.platoonNumber || '-') + '</span>' +
      '</div>' +
      '<div class="team-members-list">' +
      '<h5>Members:</h5>' +
      membersHtml +
      '</div>' +
      '<div class="team-actions">' +
      '<button class="btn btn-sm btn-secondary" onclick="editOrienteeringTeam(\'' + team.id + '\')">' +
      '<i class="fas fa-edit"></i> Edit</button>' +
      '<button class="btn btn-sm btn-info" onclick="viewTeamNote(\'' + team.id + '\')" ' + (team.notes ? '' : 'disabled title="No notes available"') + '>' +
      '<i class="fas fa-sticky-note"></i> View Note</button>' +
      '<button class="btn btn-sm btn-danger" onclick="deleteOrienteeringTeam(\'' + team.id + '\')">' +
      '<i class="fas fa-trash"></i> Delete</button>' +
      '</div></div>';
  });
  
  container.innerHTML = html;
}


  // ==================== TEAM SEARCH FUNCTIONS ====================
  var teamSearchTimeout = null;
  var lastTeamSearchQuery = '';
  
  function filterTeams(query) {
    query = query.trim().toLowerCase();
    var clearBtn = document.getElementById('teamSearchClear');
    var resultsDiv = document.getElementById('teamSearchResults');
    
    // Show/hide clear button
    if (clearBtn) {
      clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
    }
    
    // Debounce the search
    clearTimeout(teamSearchTimeout);
    
    if (query.length === 0) {
      hideTeamSearchResults();
      renderTeamManagement(); // Show all teams
      return;
    }
    
    teamSearchTimeout = setTimeout(function() {
      performTeamSearch(query);
    }, 150);
  }
  
  function performTeamSearch(query) {
    if (!orienteeringTeams || orienteeringTeams.length === 0) {
      hideTeamSearchResults();
      return;
    }
    
    // Filter teams based on query
    var matchedTeams = orienteeringTeams.filter(function(team) {
      var teamName = (team.teamName || '').toLowerCase();
      var schoolUnit = (team.schoolUnit || '').toLowerCase();
      var battalion = (team.battalion || '').toLowerCase();
      var platoon = String(team.platoonNumber || '').toLowerCase();
      
      return teamName.indexOf(query) >= 0 || 
             schoolUnit.indexOf(query) >= 0 || 
             battalion.indexOf(query) >= 0 ||
             platoon.indexOf(query) >= 0;
    });
    
    displayTeamSearchResults(matchedTeams, query);
  }
  
  function displayTeamSearchResults(teams, query) {
    var resultsDiv = document.getElementById('teamSearchResults');
    if (!resultsDiv) return;
    
    if (teams.length === 0) {
      resultsDiv.innerHTML = '<div class="team-search-no-results">' +
        '<i class="fas fa-search"></i> No teams found matching "' + escapeHtml(query) + '"</div>';
      resultsDiv.classList.add('show');
      return;
    }
    
    var html = '<div class="team-search-header">' +
      '<span><i class="fas fa-users"></i> ' + teams.length + ' team' + (teams.length !== 1 ? 's' : '') + ' found</span>' +
      '<button class="team-search-close" onclick="hideTeamSearchResults()"><i class="fas fa-times"></i></button>' +
      '</div>';
    
    teams.forEach(function(team) {
      var teamStatus = getTeamStatusFromNotes(team.notes);
      var statusBadge = '';
      if (teamStatus.hasStatus) {
        statusBadge = '<span class="team-result-status ' + teamStatus.statusClass + '">' + teamStatus.statusType + '</span>';
      }
      
      html += '<div class="team-search-result-item" onclick="selectTeamFromSearch(\'' + team.id + '\')">' +
        '<div class="team-result-main">' +
          '<span class="team-result-name">' + escapeHtml(team.teamName || 'Unnamed Team') + '</span>' +
          statusBadge +
        '</div>' +
        '<div class="team-result-meta">' +
          '<span><i class="fas fa-building"></i> ' + escapeHtml(team.battalion || '-') + '</span>' +
          '<span><i class="fas fa-school"></i> ' + escapeHtml(team.schoolUnit || '-') + '</span>' +
          '<span><i class="fas fa-trophy"></i> ' + (team.totalScore || 0) + ' pts</span>' +
        '</div>' +
      '</div>';
    });
    
    resultsDiv.innerHTML = html;
    resultsDiv.classList.add('show');
    lastTeamSearchQuery = query;
  }
  
  function selectTeamFromSearch(teamId) {
    hideTeamSearchResults();
    clearTeamSearch();
    editOrienteeringTeam(teamId);
  }
  
  function showTeamSearchResults() {
    var query = document.getElementById('teamSearchInput').value.trim();
    if (query.length > 0 && lastTeamSearchQuery === query.toLowerCase()) {
      document.getElementById('teamSearchResults').classList.add('show');
    }
  }
  
  function hideTeamSearchResults() {
    var resultsDiv = document.getElementById('teamSearchResults');
    if (resultsDiv) {
      resultsDiv.classList.remove('show');
    }
  }
  
  function clearTeamSearch() {
    var input = document.getElementById('teamSearchInput');
    var clearBtn = document.getElementById('teamSearchClear');
    
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    
    hideTeamSearchResults();
    lastTeamSearchQuery = '';
    renderTeamManagement(); // Show all teams again
  }
  
  // Close search results when clicking outside
  document.addEventListener('click', function(e) {
    var searchContainer = document.querySelector('.team-search-container');
    if (searchContainer && !searchContainer.contains(e.target)) {
      hideTeamSearchResults();
    }
  });

function getPositionBadge(position) {
  var badges = {
    1: '<span class="position-badge gold"><i class="fas fa-medal"></i> 1st</span>',
    2: '<span class="position-badge silver"><i class="fas fa-medal"></i> 2nd</span>',
    3: '<span class="position-badge bronze"><i class="fas fa-medal"></i> 3rd</span>'
  };
  return badges[position] || '<span class="position-badge">' + position + '</span>';
}

// ============================================
// MODAL HANDLERS
// ============================================

function showCategoryResultModal(category) {
  document.getElementById('categoryResultCategory').value = category;
  document.getElementById('categoryResultModalTitle').innerHTML = '<i class="fas fa-plus"></i> Add ' + category + ' Result';
  document.getElementById('categoryResultForm').reset();
  document.getElementById('categoryResultId').value = '';
  document.getElementById('categoryResultModal').classList.add('active');
}

function closeCategoryResultModal() {
  document.getElementById('categoryResultModal').classList.remove('active');
}

function showOrienteeringTeamModal() {
  document.getElementById('orienteeringTeamModalTitle').innerHTML = '<i class="fas fa-users"></i> Create Orienteering Team';
  document.getElementById('orienteeringTeamForm').reset();
  document.getElementById('orienteeringTeamId').value = '';
  document.getElementById('teamTotalScore').textContent = '0';
  document.getElementById('markersScoreDisplay').textContent = '0';
  document.getElementById('teamTimeScore').value = '0';  // Start with 0, calculate when scores are added
  document.getElementById('teamEquipment').value = '0';
  
  // Set default year to current school year
  var teamYearSelect = document.getElementById('teamYear');
  if (teamYearSelect) {
    var schoolYear = currentShieldYear || getCurrentSchoolYearClient();
    teamYearSelect.value = schoolYear;
  }
  
  // Reset dropdowns
  var battalionSelect = document.getElementById('teamBattalion');
  var schoolSelect = document.getElementById('teamSchoolUnit');
  if (battalionSelect) battalionSelect.value = '';
  if (schoolSelect) schoolSelect.innerHTML = '<option value="">Select School/Unit</option>';
  
  // Load schools data if not already loaded
  if (!schoolsData || schoolsData.length === 0) {
    google.script.run
      .withSuccessHandler(function(schools) {
        schoolsData = schools || [];
        shieldSchoolsUnits = schools || [];
        console.log('Loaded ' + schoolsData.length + ' schools for team modal');
      })
      .withFailureHandler(function(err) {
        console.error('Error loading schools:', err);
      })
      .getAllSchoolsUnits();
  }
  
  document.getElementById('orienteeringTeamModal').classList.add('active');
}

function closeOrienteeringTeamModal() {
  document.getElementById('orienteeringTeamModal').classList.remove('active');
}

function closeOrienteeringIndividualModal() {
  document.getElementById('orienteeringIndividualModal').classList.remove('active');
}

function showAddShieldResultModal() {
  // Use the category result modal for overview
  showCategoryResultModal('Public Speaking');
}

function showOrienteeringTeamsView() {
  switchOrienteeringView('team-leaderboard');
}

// ============================================
// DROPDOWN FILTERS
// ============================================

function filterSchoolsByBattalion(prefix) {
  var battalionSelect = document.getElementById(prefix + 'Battalion');
  var schoolSelect = document.getElementById(prefix + 'SchoolUnit');
  var platoonSelect = document.getElementById(prefix + 'Platoon');
  
  if (!battalionSelect || !schoolSelect) return;
  
  var selectedBattalion = battalionSelect.value;
  
  // Clear school and platoon dropdowns
  schoolSelect.innerHTML = '<option value="">Select School/Unit</option>';
  if (platoonSelect) {
    platoonSelect.innerHTML = '<option value="">Select Platoon</option>';
  }
  
  if (!selectedBattalion) return;
  
  // If schools not loaded, load them first
  if (!schoolsData || schoolsData.length === 0) {
    schoolSelect.innerHTML = '<option value="">Loading schools...</option>';
    google.script.run
      .withSuccessHandler(function(schools) {
        schoolsData = schools || [];
        shieldSchoolsUnits = schools || [];
        console.log('Loaded ' + schoolsData.length + ' schools');
        populateSchoolDropdown(schoolSelect, selectedBattalion);
      })
      .withFailureHandler(function(err) {
        console.error('Error loading schools:', err);
        schoolSelect.innerHTML = '<option value="">Error loading schools</option>';
      })
      .getAllSchoolsUnits();
    return;
  }
  
  populateSchoolDropdown(schoolSelect, selectedBattalion);
}

function populateSchoolDropdown(schoolSelect, selectedBattalion) {
  schoolSelect.innerHTML = '<option value="">Select School/Unit</option>';
  
  // Filter schools by battalion
  var filteredSchools = schoolsData.filter(function(s) {
    return s.battalion === selectedBattalion;
  });
  
  console.log('Filtered schools for ' + selectedBattalion + ': ' + filteredSchools.length);
  
  filteredSchools.forEach(function(school) {
    var option = document.createElement('option');
    var schoolName = school.school_unit_name || school.school_unit || school.schoolName || school.school_name || '';
    if (schoolName) {
      option.value = schoolName;
      option.textContent = schoolName;
      schoolSelect.appendChild(option);
    }
  });
}

function filterPlatoonsBySchool(prefix) {
  var schoolSelect = document.getElementById(prefix + 'SchoolUnit');
  var platoonSelect = document.getElementById(prefix + 'Platoon');
  
  if (!schoolSelect || !platoonSelect) return;
  
  var selectedSchool = schoolSelect.value;
  
  platoonSelect.innerHTML = '<option value="">Select Platoon</option>';
  
  if (!selectedSchool) return;
  
  // Add platoons 1-8
  for (var i = 1; i <= 8; i++) {
    var option = document.createElement('option');
    option.value = i;
    option.textContent = 'Platoon ' + i;
    platoonSelect.appendChild(option);
  }
}

// ============================================
// SCORE CALCULATIONS
// ============================================

function calculateTeamTime() {
  var startTime = document.getElementById('teamTimeStart').value;
  var endTime = document.getElementById('teamTimeFinished').value;
  
  if (!startTime || !endTime) return;
  
  var start = new Date('2000-01-01T' + startTime);
  var end = new Date('2000-01-01T' + endTime);
  var diffMs = end - start;
  
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000; // Handle crossing midnight
  }
  
  var totalMinutes = diffMs / (1000 * 60);
  var hours = Math.floor(totalMinutes / 60);
  var minutes = Math.floor(totalMinutes % 60);
  var seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  
  // Format total time as H:MM:SS
  var totalTimeStr = hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  document.getElementById('teamTotalTime').value = totalTimeStr;
  
  // Calculate time score
  // Full 30 pts if completed within 1:15:00 (75 minutes)
  // Deduct 1 pt for every 5 minutes over 75 minutes
  var baselineMinutes = 75; // 1 hour 15 minutes
  var timeScore = 30;
  
  if (totalMinutes > baselineMinutes) {
    var minutesOver = totalMinutes - baselineMinutes;
    var deduction = Math.floor(minutesOver / 5);
    timeScore = Math.max(0, 30 - deduction);
  }
  
  document.getElementById('teamTimeScore').value = timeScore;
  calculateTeamTotal();
}

function calculateTeamTotal() {
  var markers = parseInt(document.getElementById('teamMarkersFound').value) || 0;
  var timeScore = parseInt(document.getElementById('teamTimeScore').value) || 0;
  var gridRefs = parseInt(document.getElementById('teamGridRefs').value) || 0;
  var equipment = parseInt(document.getElementById('teamEquipment').value) || 0;
  
  // Clamp values to max
  markers = Math.min(Math.max(0, markers), 6);
  timeScore = Math.min(Math.max(0, timeScore), 30);
  gridRefs = Math.min(Math.max(0, gridRefs), 17);  // Max 17 pts (changed from 22)
  equipment = Math.min(Math.max(0, equipment), 5);  // Max 5 pts
  
  var markersScore = markers * 8; // 6 markers × 8 pts = 48 max
  var total = markersScore + timeScore + gridRefs + equipment;
  
  document.getElementById('markersScoreDisplay').textContent = markersScore;
  document.getElementById('teamTotalScore').textContent = total;
}

function calculateIndivTime() {
  var startTime = document.getElementById('indivTimeStart').value;
  var endTime = document.getElementById('indivTimeFinished').value;
  
  if (startTime && endTime) {
    var start = new Date('2000-01-01T' + startTime);
    var end = new Date('2000-01-01T' + endTime);
    var diff = (end - start) / 1000 / 60;
    if (diff < 0) diff += 24 * 60;
    
    var hours = Math.floor(diff / 60);
    var minutes = Math.floor(diff % 60);
    var totalTimeEl = document.getElementById('indivTotalTime');
    if (totalTimeEl) {
      totalTimeEl.value = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    }
  }
}

function calculateIndivTotal() {
  var markers = parseInt(document.getElementById('indivMarkers').value) || 0;
  var timeScore = parseInt(document.getElementById('indivTimeScore').value) || 0;
  var gridRefs = parseInt(document.getElementById('indivGridRefs').value) || 0;
  
  var total = (markers * 8) + timeScore + gridRefs;
  document.getElementById('indivTotalScore').textContent = total;
}

// ============================================
// SAVE FUNCTIONS
// ============================================

function saveCategoryResult() {
  var form = document.getElementById('categoryResultForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  var resultData = {
    id: document.getElementById('categoryResultId').value,
    category: document.getElementById('categoryResultCategory').value,
    competitionYear: document.getElementById('categoryYear').value,
    position: document.getElementById('categoryPosition').value,
    battalion: document.getElementById('categoryBattalion').value,
    schoolUnit: document.getElementById('categorySchoolUnit').value,
    platoonNumber: document.getElementById('categoryPlatoon').value,
    score: document.getElementById('categoryScore').value,
    regimentalNumber: document.getElementById('categoryRegNo').value,
    rank: document.getElementById('categoryRank').value,
    cadetName: document.getElementById('categoryCadetName').value,
    notes: document.getElementById('categoryNotes').value
  };
  
  showLoading();
  
  var action = resultData.id ? 'updateShieldResult' : 'addShieldResult';
  
  google.script.run
    .withSuccessHandler(function(result) {
      hideLoading();
      if (result.success) {
        showToast('Result saved successfully!', 'success');
        closeCategoryResultModal();
        loadShieldCompetition();
      } else {
        showToast('Error: ' + result.message, 'error');
      }
    })
    .withFailureHandler(function(error) {
      hideLoading();
      showToast('Error saving result: ' + error.message, 'error');
    })
    [action](resultData);
}

function saveOrienteeringTeam() {
  var form = document.getElementById('orienteeringTeamForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  // Collect team data
  var teamData = {
    id: document.getElementById('orienteeringTeamId').value,
    competitionYear: document.getElementById('teamYear').value,
    teamName: document.getElementById('teamName').value,
    battalion: document.getElementById('teamBattalion').value,
    schoolUnit: document.getElementById('teamSchoolUnit').value,
    platoonNumber: document.getElementById('teamPlatoon').value,
    timeStart: document.getElementById('teamTimeStart').value,
    timeFinished: document.getElementById('teamTimeFinished').value,
    totalTime: document.getElementById('teamTotalTime').value,
    markersFound: parseInt(document.getElementById('teamMarkersFound').value) || 0,
    timeScore: parseInt(document.getElementById('teamTimeScore').value) || 0,
    gridRefs: parseInt(document.getElementById('teamGridRefs').value) || 0,
    equipment: parseInt(document.getElementById('teamEquipment').value) || 0,
    notes: document.getElementById('teamNotes').value,
    members: [
      {
        regNo: document.getElementById('member1RegNo').value,
        rank: document.getElementById('member1Rank').value,
        surname: document.getElementById('member1Surname').value,
        firstName: document.getElementById('member1FirstName').value
      },
      {
        regNo: document.getElementById('member2RegNo').value,
        rank: document.getElementById('member2Rank').value,
        surname: document.getElementById('member2Surname').value,
        firstName: document.getElementById('member2FirstName').value
      },
      {
        regNo: document.getElementById('member3RegNo').value,
        rank: document.getElementById('member3Rank').value,
        surname: document.getElementById('member3Surname').value,
        firstName: document.getElementById('member3FirstName').value
      }
    ]
  };
  
  // Auto-generate team name if empty
  if (!teamData.teamName) {
    teamData.teamName = teamData.schoolUnit + ' - Platoon ' + teamData.platoonNumber;
  }
  
  // Debug logging
  console.log('Saving team with notes:', teamData.notes);
  console.log('Full teamData:', JSON.stringify(teamData));
  
  // Calculate total score
  teamData.markersScore = teamData.markersFound * 8;
  teamData.gridScore = Math.min(teamData.gridRefs, 17);  // Max 17 pts
  teamData.equipmentScore = Math.min(teamData.equipment, 5);  // Max 5 pts
  teamData.totalScore = teamData.markersScore + teamData.timeScore + teamData.gridScore + teamData.equipmentScore;
  
  showLoading();
  
  var action = teamData.id ? 'updateOrienteeringTeam' : 'addOrienteeringTeam';
  
  google.script.run
    .withSuccessHandler(function(result) {
      hideLoading();
      if (result.success) {
        showToast('Team saved successfully!', 'success');
        closeOrienteeringTeamModal();
        loadOrienteeringTeams(teamData.competitionYear);
        // Refresh dashboard leaderboard to show updated scores
        loadDashboardShieldLeaderboard();
        // Refresh shield data if on shield page
        if (currentPage === 'shield') {
          loadShieldData();
        }
      } else {
        showToast('Error: ' + result.message, 'error');
      }
    })
    .withFailureHandler(function(error) {
      hideLoading();
      showToast('Error saving team: ' + error.message, 'error');
    })
    [action](teamData);
}

// ============================================
// EDIT/DELETE FUNCTIONS
// ============================================

function editOrienteeringTeam(teamId) {
  var team = orienteeringTeams.find(function(t) { return t.id === teamId; });
  if (!team) return;
  
  document.getElementById('orienteeringTeamId').value = team.id;
  document.getElementById('teamYear').value = team.competitionYear;
  document.getElementById('teamName').value = team.teamName || '';
  document.getElementById('teamBattalion').value = team.battalion;
  
  filterSchoolsByBattalion('team');
  setTimeout(function() {
    document.getElementById('teamSchoolUnit').value = team.schoolUnit;
    filterPlatoonsBySchool('team');
    setTimeout(function() {
      document.getElementById('teamPlatoon').value = team.platoonNumber;
    }, 100);
  }, 100);
  
  document.getElementById('teamTimeStart').value = team.timeStart || '';
  document.getElementById('teamTimeFinished').value = team.timeFinished || '';
  document.getElementById('teamTotalTime').value = team.totalTime || '';
  document.getElementById('teamMarkersFound').value = team.markersFound || 0;
  document.getElementById('teamTimeScore').value = team.timeScore || 0;
  document.getElementById('teamGridRefs').value = team.gridRefs || 0;
  document.getElementById('teamEquipment').value = team.equipment || 0;
  console.log('Editing team - notes from data:', team.notes);
  console.log('Full team data:', JSON.stringify(team));
  document.getElementById('teamNotes').value = team.notes || '';
  
  // Populate members
  if (team.members && team.members.length >= 3) {
    for (var i = 0; i < 3; i++) {
      var m = team.members[i] || {};
      document.getElementById('member' + (i+1) + 'RegNo').value = m.regNo || '';
      document.getElementById('member' + (i+1) + 'Rank').value = m.rank || '';
      document.getElementById('member' + (i+1) + 'Surname').value = m.surname || '';
      document.getElementById('member' + (i+1) + 'FirstName').value = m.firstName || '';
    }
  }
  
  calculateTeamTotal();
  
  document.getElementById('orienteeringTeamModalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Orienteering Team';
  document.getElementById('orienteeringTeamModal').classList.add('active');
}

function deleteOrienteeringTeam(teamId) {
  if (!confirm('Are you sure you want to delete this team and all its member scores?')) return;
  
  showLoading();
  
  google.script.run
    .withSuccessHandler(function(result) {
      hideLoading();
      if (result.success) {
        showToast('Team deleted successfully', 'success');
        var yearSelect = document.getElementById('shieldYearSelect');
        var year = yearSelect ? yearSelect.value : new Date().getFullYear();
        loadOrienteeringTeams(year);
        // Also refresh dashboard leaderboard
        loadDashboardShieldLeaderboard();
        // Refresh shield data if on shield page
        if (currentPage === 'shield') {
          loadShieldData();
        }
      } else {
        showToast('Error: ' + result.message, 'error');
      }
    })
    .withFailureHandler(function(error) {
      hideLoading();
      showToast('Error deleting team: ' + error.message, 'error');
    })
    .deleteOrienteeringTeam(teamId);
}

/**
 * View team note in a popup modal
 */
function viewTeamNote(teamId) {
  // Local escapeHtml function
  function escapeHtmlLocal(text) {
    if (text === null || text === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }
  
  var team = orienteeringTeams.find(function(t) { return t.id === teamId; });
  if (!team) {
    alert('Team not found');
    return;
  }
  
  var teamName = team.teamName || 'Unknown Team';
  var notes = team.notes || 'No notes available for this team.';
  
  // Check if team has a status
  var teamStatus = getTeamStatusFromNotes(notes);
  var statusHtml = '';
  if (teamStatus.hasStatus) {
    statusHtml = '<div class="note-status-badge ' + teamStatus.statusClass + '">' +
      '<i class="fas fa-exclamation-triangle"></i> ' + teamStatus.statusType + '</div>';
  }
  
  // Create modal HTML using the correct modal-overlay structure
  var modalHtml = '<div id="teamNoteModal" class="modal-overlay active">' +
    '<div class="modal" style="max-width: 500px;">' +
    '<div class="modal-header">' +
    '<h3><i class="fas fa-sticky-note"></i> Team Notes</h3>' +
    '<button class="modal-close" onclick="closeTeamNoteModal()">&times;</button>' +
    '</div>' +
    '<div class="modal-body">' +
    '<div class="team-note-header">' +
    '<strong>' + escapeHtmlLocal(teamName) + '</strong>' +
    statusHtml +
    '</div>' +
    '<div class="team-note-content">' +
    '<p>' + escapeHtmlLocal(notes) + '</p>' +
    '</div>' +
    '</div>' +
    '<div class="modal-footer">' +
    '<button class="btn btn-secondary" onclick="closeTeamNoteModal()">Close</button>' +
    '<button class="btn btn-primary" onclick="closeTeamNoteModal(); editOrienteeringTeam(\'' + teamId + '\');">' +
    '<i class="fas fa-edit"></i> Edit Team</button>' +
    '</div>' +
    '</div>' +
    '</div>';
  
  // Add modal to page
  var existingModal = document.getElementById('teamNoteModal');
  if (existingModal) {
    existingModal.remove();
  }
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Close team note modal
 */
function closeTeamNoteModal() {
  var modal = document.getElementById('teamNoteModal');
  if (modal) {
    modal.remove();
  }
}

function editOrienteeringIndividual(indivId) {
  var indiv = orienteeringIndividuals.find(function(i) { return i.id === indivId; });
  if (!indiv) return;
  
  document.getElementById('orienteeringIndividualId').value = indiv.id;
  document.getElementById('indivRegNo').value = indiv.regNo || '';
  document.getElementById('indivName').value = (indiv.rank || '') + ' ' + (indiv.surname || '') + ' ' + (indiv.firstName || '');
  document.getElementById('indivTimeStart').value = indiv.timeStart || '';
  document.getElementById('indivTimeFinished').value = indiv.timeFinished || '';
  document.getElementById('indivMarkers').value = indiv.markersFound || 0;
  document.getElementById('indivTimeScore').value = indiv.timeScore || 0;
  document.getElementById('indivGridRefs').value = indiv.gridRefs || 0;
  
  calculateIndivTotal();
  
  document.getElementById('orienteeringIndividualModal').classList.add('active');
}

function saveOrienteeringIndividual() {
  var indivData = {
    id: document.getElementById('orienteeringIndividualId').value,
    timeStart: document.getElementById('indivTimeStart').value,
    timeFinished: document.getElementById('indivTimeFinished').value,
    markersFound: parseInt(document.getElementById('indivMarkers').value) || 0,
    timeScore: parseInt(document.getElementById('indivTimeScore').value) || 0,
    gridRefs: parseInt(document.getElementById('indivGridRefs').value) || 0
  };
  
  // Calculate scores
  indivData.markersScore = indivData.markersFound * 8;
  indivData.gridScore = indivData.gridRefs;
  indivData.totalPoints = indivData.markersScore + indivData.timeScore + indivData.gridScore;
  
  showLoading();
  
  google.script.run
    .withSuccessHandler(function(result) {
      hideLoading();
      if (result.success) {
        showToast('Score updated successfully', 'success');
        closeOrienteeringIndividualModal();
        var yearSelect = document.getElementById('shieldYearSelect');
        var year = yearSelect ? yearSelect.value : new Date().getFullYear();
        loadOrienteeringTeams(year);
      } else {
        showToast('Error: ' + result.message, 'error');
      }
    })
    .withFailureHandler(function(error) {
      hideLoading();
      showToast('Error updating score: ' + error.message, 'error');
    })
    .updateOrienteeringResult(indivData.id, indivData);
}

// ============================================
// UI HELPERS
// ============================================

function updateCategoryAddButtons(category) {
var adminUser = isAdmin();  
  // Hide all add buttons first
  var addButtons = [
    'addShieldBtn', 'addPublicSpeakingBtn', 'addSmallBoreBtn', 'addDrillBtn',
    'addMilKnowledgeBtn', 'addPlatoonRecordsBtn', 'addCampcraftBtn', 
    'addOrienteeringTeamBtn', 'teamManagementTab'
  ];
  
  addButtons.forEach(function(id) {
    var btn = document.getElementById(id);
    if (btn) btn.style.display = 'none';
  });
  
  if (!adminUser) return;
  
  // Show relevant button based on category
  var buttonMap = {
    'overview': 'addShieldBtn',
    'public-speaking': 'addPublicSpeakingBtn',
    'small-bore': 'addSmallBoreBtn',
    'drill': 'addDrillBtn',
    'military-knowledge': 'addMilKnowledgeBtn',
    'platoon-records': 'addPlatoonRecordsBtn',
    'campcraft': 'addCampcraftBtn',
    'orienteering': 'addOrienteeringTeamBtn'
  };
  
  var buttonId = buttonMap[category];
  if (buttonId) {
    var btn = document.getElementById(buttonId);
    if (btn) btn.style.display = 'inline-flex';
  }
  
  // Show team management tab for orienteering
  if (category === 'orienteering') {
    var teamTab = document.getElementById('teamManagementTab');
    if (teamTab) teamTab.style.display = 'inline-flex';
  }
}

// ============================================================
// SHIELD COMPETITION - CONSOLIDATED FIX
// ============================================================
// 
// INSTRUCTIONS:
// 1. In your JavaScript.html, DELETE all of these functions (search and remove each one):
//    - loadShieldCompetition (you have 2 copies - delete BOTH)
//    - loadCategoryData
//    - loadOrienteeringTeams
//    - loadSchoolsForDropdowns
//    - formatSchoolYear
//    - loadShieldData
//    - getCurrentSchoolYearClient
//
// 2. Then paste ALL the code below into your JavaScript.html
//    (inside the <script> tags, near other Shield-related functions)
//
// 3. Save and redeploy
// ============================================================

// Global variables for Shield (add near top of script if not already there)
var currentShieldYear = null;
var shieldSchoolsUnits = [];
var shieldData = null;
var orienteeringTeams = [];
var orienteeringIndividuals = [];
var schoolsData = [];

/**
 * Format year as school year (e.g., 2025 -> "2025-2026")
 */
function formatSchoolYear(year) {
  var y = parseInt(year, 10);
  return y + '-' + (y + 1);
}

/**
 * Get current school year on client side
 * School year runs September to July
 */
function getCurrentSchoolYearClient() {
  var now = new Date();
  var month = now.getMonth() + 1;
  var year = now.getFullYear();
  return month < 9 ? year - 1 : year;
}

/**
 * Called when year dropdown changes
 */
function loadShieldData() {
  var yearSelect = document.getElementById('shieldYearSelect');
  if (yearSelect) {
    currentShieldYear = parseInt(yearSelect.value, 10);
  }
  loadShieldCompetition();
}

/**
 * Main function to load Shield Competition data
 * THIS IS THE ONLY loadShieldCompetition FUNCTION YOU SHOULD HAVE
 */
function loadShieldCompetition(isAutoRefresh) {
  if (!isAutoRefresh) showLoading();
  if (isAutoRefresh) showCornerSpinner();
  
  google.script.run
    .withSuccessHandler(function(data) {
      console.log('Shield data received:', data);
      
      // Store data globally
      shieldData = data;
      shieldSchoolsUnits = data.schools || [];
      schoolsData = data.schools || [];
      
      // Update currentShieldYear from response
      if (data.selectedYear) {
        currentShieldYear = parseInt(data.selectedYear, 10);
      }
      
      // Populate year dropdown with school year format (e.g., "2025-2026")
      var yearSelect = document.getElementById('shieldYearSelect');
      if (yearSelect && data.years && data.years.length > 0) {
        var yHtml = '';
        for (var i = 0; i < data.years.length; i++) {
          var y = data.years[i];
          var displayYear = formatSchoolYear(y);
          var selected = (y == currentShieldYear) ? ' selected' : '';
          yHtml += '<option value="' + y + '"' + selected + '>' + displayYear + '</option>';
        }
        yearSelect.innerHTML = yHtml;
      }
      
      // Update main leaderboard table
      var tbody = document.getElementById('leaderboardBody');
      if (tbody) {
        if (!data.leaderboard || data.leaderboard.length === 0) {
          var displayYear = formatSchoolYear(currentShieldYear);
          tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No results yet for ' + displayYear + '</td></tr>';
        } else {
          var html = '';
          for (var j = 0; j < data.leaderboard.length; j++) {
            var e = data.leaderboard[j];
            var rankClass = j === 0 ? 'rank-1st' : j === 1 ? 'rank-2nd' : j === 2 ? 'rank-3rd' : '';
            var medal = j === 0 ? '🥇' : j === 1 ? '🥈' : j === 2 ? '🥉' : (j + 1);
            
            html += '<tr class="' + rankClass + '">' +
              '<td class="rank-cell">' + medal + '</td>' +
              '<td>' + escapeHtml(e.school_unit || '') + '</td>' +
              '<td>' + escapeHtml(e.platoon_number || '-') + '</td>' +
              '<td class="score-cell"><strong>' + (e.total_score || 0) + '</strong></td>' +
              '</tr>';
          }
          tbody.innerHTML = html;
        }
      }
      
      // Update category counts
      if (data.categoryCounts) {
        updateCategoryCounts(data.categoryCounts);
      }
      
      // Render category winners if function exists
      if (typeof renderCategoryWinners === 'function') {
        renderCategoryWinners(data.leaderboard || []);
      }
      
      // Render overview if function exists
      if (typeof renderShieldOverview === 'function') {
        renderShieldOverview(data);
      }
      
      // Show/hide admin button
      var addBtn = document.getElementById('btnAddShieldResult');
      if (addBtn) {
        addBtn.style.display = isAdmin() ? 'inline-flex' : 'none';
      }
      
      // Load individual results for admin
      if (isAdmin() && typeof loadIndividualShieldResults === 'function') {
        loadIndividualShieldResults();
      }
      
      // Load orienteering teams
      if (typeof loadOrienteeringTeams === 'function') {
        loadOrienteeringTeams(currentShieldYear);
      }
      
      hideLoading();
    })
    .withFailureHandler(function(err) {
      console.error('Load shield error:', err);
      hideLoading();
      showToast('Error loading Shield data: ' + (err.message || err), 'error');
    })
    .getShieldDataFast(currentShieldYear || 'auto');
}

/**
 * Update category count badges
 */
function updateCategoryCounts(categoryCounts) {
  if (!categoryCounts) return;
  
  var categoryIdMap = {
    'Public Speaking': 'count-public-speaking',
    'Orienteering': 'count-orienteering',
    'Small Bore Shooting': 'count-small-bore-shooting',
    'Drill': 'count-drill',
    'Military Knowledge': 'count-military-knowledge',
    'Platoon Records': 'count-platoon-records',
    'Campcraft': 'count-campcraft'
  };
  
  for (var category in categoryIdMap) {
    if (categoryIdMap.hasOwnProperty(category)) {
      var elementId = categoryIdMap[category];
      var countEl = document.getElementById(elementId);
      if (countEl) {
        var count = categoryCounts[category] || 0;
        countEl.textContent = count;
      }
    }
  }
}

/**
 * Load category-specific data
 */
function loadCategoryData(category) {
  var year = currentShieldYear || getCurrentSchoolYearClient();
  
  if (category === 'overview') {
    if (shieldData) {
      if (typeof renderShieldOverview === 'function') {
        renderShieldOverview(shieldData);
      }
    }
    return;
  }
  
  if (category === 'orienteering') {
    loadOrienteeringTeams(year);
    return;
  }
  
  // Load specific category results
  var categoryMap = {
    'public-speaking': 'Public Speaking',
    'small-bore': 'Small Bore Shooting',
    'drill': 'Drill',
    'military-knowledge': 'Military Knowledge',
    'platoon-records': 'Platoon Records',
    'campcraft': 'Campcraft'
  };
  
  var categoryName = categoryMap[category];
  if (categoryName && shieldData) {
    if (typeof renderCategoryLeaderboard === 'function') {
      renderCategoryLeaderboard(category, categoryName);
    }
  }
}

/**
 * Load orienteering teams data
 */
function loadOrienteeringTeams(year) {
  year = year || currentShieldYear || getCurrentSchoolYearClient();
  console.log('Loading orienteering teams for year:', year);
  
  google.script.run
    .withSuccessHandler(function(data) {
      orienteeringTeams = data.teams || [];
      orienteeringIndividuals = data.individuals || [];
      console.log('Loaded ' + orienteeringTeams.length + ' teams for year ' + year);
      
      // Debug: Log notes for each team
      orienteeringTeams.forEach(function(t, idx) {
        console.log('Team ' + idx + ' (' + t.id + '): notes = "' + (t.notes || '') + '"');
      });
      
      if (typeof renderOrienteeringTeamLeaderboard === 'function') {
        renderOrienteeringTeamLeaderboard();
      }
      if (typeof renderOrienteeringIndividuals === 'function') {
        renderOrienteeringIndividuals();
      }
      if (typeof renderTeamManagement === 'function') {
        renderTeamManagement();
      }
    })
    .withFailureHandler(function(error) {
      console.error('Error loading orienteering data:', error);
    })
    .getOrienteeringTeamsWithMembers(year);
}

/**
 * Load schools for dropdowns
 */

/**
 * Debug function - load ALL teams without year filter
 */
function loadAllOrienteeringTeams() {
  console.log('Loading ALL orienteering teams (no year filter)...');
  
  google.script.run
    .withSuccessHandler(function(teams) {
      console.log('Loaded ' + teams.length + ' total teams');
      console.log('Teams:', teams);
      
      if (teams.length > 0) {
        orienteeringTeams = teams;
        renderOrienteeringTeamLeaderboard();
        showToast('Loaded ' + teams.length + ' teams (all years)', 'success');
      } else {
        showToast('No teams found in sheet', 'warning');
      }
    })
    .withFailureHandler(function(error) {
      console.error('Error loading all teams:', error);
      showToast('Error: ' + error.message, 'error');
    })
    .getAllOrienteeringTeams();
}

function loadSchoolsForDropdowns() {
  google.script.run
    .withSuccessHandler(function(data) {
      schoolsData = data || [];
    })
    .withFailureHandler(function(error) {
      console.error('Error loading schools:', error);
    })
    .getAllSchoolsUnits();
}

/**
 * Open category modal to show results for a specific category
 */
function openCategoryModal(categoryName) {
  var modal = document.getElementById('categoryResultsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'categoryResultsModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = 
      '<div class="modal modal-lg">' +
        '<div class="modal-header">' +
          '<h3 id="categoryModalTitle"><i class="fas fa-list"></i> Category Results</h3>' +
          '<button class="modal-close" onclick="closeCategoryModal()">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div id="categoryResultsContent"><p class="text-muted">Loading...</p></div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-secondary" onclick="closeCategoryModal()">Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
  }
  
  var titleEl = document.getElementById('categoryModalTitle');
  var displayYear = formatSchoolYear(currentShieldYear || getCurrentSchoolYearClient());
  if (titleEl) {
    titleEl.innerHTML = '<i class="fas fa-trophy"></i> ' + escapeHtml(categoryName) + ' - ' + displayYear;
  }
  
  var contentEl = document.getElementById('categoryResultsContent');
  if (contentEl) {
    contentEl.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading results...</p>';
  }
  
  modal.classList.add('active');
  
  var year = currentShieldYear || getCurrentSchoolYearClient();
  
  google.script.run
    .withSuccessHandler(function(results) {
      renderCategoryResultsModal(categoryName, results);
    })
    .withFailureHandler(function(err) {
      if (contentEl) {
        contentEl.innerHTML = '<p class="text-danger"><i class="fas fa-exclamation-triangle"></i> Error loading results: ' + escapeHtml(err.message || 'Unknown error') + '</p>';
      }
    })
    .getShieldResultsByCategory(categoryName, year);
}

/**
 * Close category modal
 */
function closeCategoryModal() {
  var modal = document.getElementById('categoryResultsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Render category results in modal
 */
function renderCategoryResultsModal(categoryName, results) {
  var contentEl = document.getElementById('categoryResultsContent');
  if (!contentEl) return;
  
  if (!results || results.length === 0) {
    contentEl.innerHTML = 
      '<div class="empty-state" style="text-align:center;padding:40px;">' +
        '<i class="fas fa-inbox" style="font-size:3rem;color:#ccc;margin-bottom:15px;display:block;"></i>' +
        '<p class="text-muted">No results yet for ' + escapeHtml(categoryName) + '</p>' +
      '</div>';
    return;
  }
  
  var html = '<table class="table"><thead><tr>';
  html += '<th style="width:50px;">#</th>';
  html += '<th>School/Unit</th>';
  html += '<th>Platoon</th>';
  html += '<th>Cadet</th>';
  html += '<th style="width:80px;">Score</th>';
  html += '</tr></thead><tbody>';
  
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var rankClass = i === 0 ? 'rank-1st' : i === 1 ? 'rank-2nd' : i === 2 ? 'rank-3rd' : '';
    var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    
    var cadetDisplay = r.cadet_name || '';
    if (r.rank && cadetDisplay) {
      cadetDisplay = r.rank + ' ' + cadetDisplay;
    }
    
    html += '<tr class="' + rankClass + '">';
    html += '<td>' + medal + '</td>';
    html += '<td>' + escapeHtml(r.school_unit || '-') + '</td>';
    html += '<td>' + escapeHtml(r.platoon_number || '-') + '</td>';
    html += '<td>' + escapeHtml(cadetDisplay || '-') + '</td>';
    html += '<td><strong>' + (parseFloat(r.score) || 0) + '</strong></td>';
    html += '</tr>';
  }
  
  html += '</tbody></table>';
  contentEl.innerHTML = html;
}

// Subtle corner spinner for auto-refresh (non-intrusive)
function showCornerSpinner() {
  var el = document.getElementById('cornerSpinner');
  if (el) el.classList.add('active');
}

function hideCornerSpinner() {
  var el = document.getElementById('cornerSpinner');
  if (el) el.classList.remove('active');
}

// expose for modules (notify.js / ui.js / api.js)
window.navigateTo = navigateTo; window.toggleSidebar = toggleSidebar; window.showToast = showToast;
window.showLoading = showLoading; window.hideLoading = hideLoading; window.refreshCurrentPage = refreshCurrentPage;
