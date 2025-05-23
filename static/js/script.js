/**
 * script.js
 * Frontend logic for the Unknown Code Creator application.
 */
document.addEventListener('DOMContentLoaded', async () => {

    // --- Configuration ---
    const API_BASE_URL = 'https://unknown-code-create.duckdns.org'; // Use HTTPS and your domain
    const SUPABASE_URL = 'https://qcrkovvvvbavgnzwvbpk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcmtvdnZ2dmJhdmduend2YnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDU4MDMsImV4cCI6MjA2MDcyMTgwM30.XyeCRGKfy8Yx5DY0HKLFn7s4NDjWHScMpE1jnXb16Uw';
    const SELECTED_SESSION_ID_KEY = 'unknownCodeCreator_selectedSessionId';
    const MONACO_CDN_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min';

    // --- Get DOM Elements ---
    // (Keep all element selections)
    const uploadForm = document.getElementById('upload-form');
    const projectZipInput = document.getElementById('project-zip-input');
    const uploadButtonLabel = document.querySelector('.file-upload-label');
    const uploadButtonLabelText = uploadButtonLabel?.querySelector('span:last-of-type');
    const uploadConfirmButton = uploadForm?.querySelector('button[type="submit"]');
    const fileList = document.getElementById('file-list');
    const fileStatus = document.getElementById('file-status');
    const timelineLog = document.getElementById('timeline-log');
    const requestInput = document.getElementById('request-input');
    const requestButton = document.getElementById('request-button');
    const haltButton = document.getElementById('halt-button');
    const generationResultsDiv = document.getElementById('generation-results');
    const summaryDisplay = document.getElementById('summary-display');
    const instructionsDisplay = document.getElementById('instructions-display');
    const generatedFilesDisplay = document.getElementById('generated-files-display');
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const chatSendButton = document.getElementById('chat-send-button');
    const errorDisplay = document.getElementById('error-display');
    const errorDisplayText = errorDisplay?.querySelector('.message-text');
    const loadingIndicator = document.getElementById('loading-indicator');
    const sessionIdDisplay = document.getElementById('session-id-display');
    const fileDetailOverlay = document.getElementById('file-detail-overlay');
    const fileDetailSection = document.getElementById('file-detail-section');
    const detailFileName = document.getElementById('detail-file-name');
    const detailFileSummary = document.getElementById('detail-file-summary');
    const editorContainer = document.getElementById('editor-container');
    const editorFallback = document.getElementById('editor-fallback');
    const closeDetailButton = document.getElementById('close-detail-button');
    const saveDetailButton = document.getElementById('save-detail-button');
    const outputFileList = document.getElementById('output-file-list');
    const outputListStatus = document.getElementById('output-file-status');
    const downloadAllButton = document.getElementById('download-all-button');
    const downloadChangedButton = document.getElementById('download-changed-button');
    const chatPlaceholder = document.querySelector('#chat-window .chat-placeholder');
    const startScratchButton = document.getElementById('start-scratch-button');
    const startPythonButton = document.getElementById('start-python-button');
    const startWebButton = document.getElementById('start-web-button');
    const authSection = document.getElementById('auth-section');
    const loggedOutView = document.getElementById('logged-out-view');
    const loggedInView = document.getElementById('logged-in-view');
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = loginForm?.querySelector('button[type="submit"]');
    const signupButton = document.getElementById('signup-button');
    const logoutButton = document.getElementById('logout-button');
    const userEmailDisplay = document.getElementById('user-email-display');
    const authErrorDisplay = document.getElementById('auth-error');
    const projectActionsSection = document.getElementById('project-actions-section');
    const userSessionsSection = document.getElementById('user-sessions-section');
    const userSessionList = document.getElementById('user-session-list');
    const sessionListStatus = document.getElementById('session-list-status');
    const timelineSection = document.getElementById('timeline-section');
    const sessionActionsSection = document.getElementById('session-actions-section');
    const noSessionActivePlaceholder = document.getElementById('no-session-active');
    const sessionContentArea = document.getElementById('session-content-area');

    // --- State Variables ---
    let currentSessionId = null;
    let currentFiles = {};
    let monacoEditor = null;
    let currentEditingFile = null;
    let hasUnsavedChanges = false;
    let supabaseClient = null;
    let currentUser = null;
    let userSessions = [];
    let librariesReady = { supabase: false, monacoLoader: false, marked: false, hljs: false };

    // --- Monaco Editor Base Environment ---
    // Define getWorker - this needs to be global
    window.MonacoEnvironment = { /* ... same as before ... */
         getWorkerUrl: function (moduleId, label) { let workerPath; if (label === 'json') { workerPath = 'vs/language/json/json.worker.js'; } else if (label === 'css' || label === 'scss' || label === 'less') { workerPath = 'vs/language/css/css.worker.js'; } else if (label === 'html' || label === 'handlebars' || label === 'razor') { workerPath = 'vs/language/html/html.worker.js'; } else if (label === 'typescript' || label === 'javascript') { workerPath = 'vs/language/typescript/ts.worker.js'; } else { workerPath = 'vs/editor/editor.worker.js'; } return `${MONACO_CDN_BASE}/${workerPath}`; }
    };

    // --- Utility Functions ---
    function showError(message, isSevere = false) { /* ... Full implementation ... */ const targetElement = errorDisplayText || errorDisplay; targetElement.textContent = message; errorDisplay.style.display = 'flex'; console.error("Error:", message); if (!isSevere) { setTimeout(() => { const currentText = errorDisplayText ? errorDisplayText.textContent : errorDisplay.textContent; if (currentText === message && errorDisplay) { errorDisplay.style.display = 'none'; } }, 8000); } }
    function clearError() { /* ... Full implementation ... */ if (errorDisplay) { errorDisplay.style.display = 'none'; if (errorDisplayText) { errorDisplayText.textContent = ''; } else { errorDisplay.textContent = ''; } } }
    function showLoading(isLoading) { /* ... Full implementation ... */ if (loadingIndicator) { loadingIndicator.style.display = isLoading ? 'inline-flex' : 'none'; } if (saveDetailButton && isLoading) saveDetailButton.disabled = true; if (uploadConfirmButton && isLoading) uploadConfirmButton.disabled = true; enableSessionControls(); }
    function isLoading() { /* ... Full implementation ... */ return loadingIndicator?.style.display !== 'none'; }
    function disableSessionControls() { /* ... Full implementation ... */ if(requestInput)requestInput.disabled = true; if(requestButton)requestButton.disabled = true; if(chatInput)chatInput.disabled = true; if(chatSendButton)chatSendButton.disabled = true; if(haltButton)haltButton.disabled = true; if(downloadAllButton)downloadAllButton.disabled = true; if(downloadChangedButton)downloadChangedButton.disabled = true; if (outputFileList) { outputFileList.style.pointerEvents = 'none'; outputFileList.style.opacity = 0.7; } if (saveDetailButton) saveDetailButton.disabled = true; if(uploadConfirmButton)uploadConfirmButton.disabled = true; if (uploadButtonLabel) {uploadButtonLabel.style.pointerEvents = 'none'; uploadButtonLabel.style.opacity = 0.7;} if(startScratchButton)startScratchButton.disabled = true; if(startPythonButton)startPythonButton.disabled = true; if(startWebButton)startWebButton.disabled = true; }
    function enableSessionControls() { /* ... Full implementation ... */ const isLoggedIn = !!currentUser; const isSessionActive = isLoggedIn && !!currentSessionId; const appIsLoading = isLoading(); const canEnableProjectActions = isLoggedIn && !appIsLoading && librariesReady.supabase; const canEnableSessionActions = isSessionActive && !appIsLoading && librariesReady.supabase; if (uploadButtonLabel) {uploadButtonLabel.style.pointerEvents = canEnableProjectActions ? 'auto' : 'none'; uploadButtonLabel.style.opacity = canEnableProjectActions ? 1.0 : 0.7;} if (uploadConfirmButton && projectZipInput) { uploadConfirmButton.disabled = !canEnableProjectActions || projectZipInput.files.length === 0; } if(startScratchButton)startScratchButton.disabled = !canEnableProjectActions; if(startPythonButton)startPythonButton.disabled = !canEnableProjectActions; if(startWebButton)startWebButton.disabled = !canEnableProjectActions; if(requestInput)requestInput.disabled = !canEnableSessionActions; if(requestButton)requestButton.disabled = !canEnableSessionActions; if(chatInput)chatInput.disabled = !canEnableSessionActions; if(chatSendButton)chatSendButton.disabled = !canEnableSessionActions; if(haltButton)haltButton.disabled = !canEnableSessionActions; if(downloadAllButton)downloadAllButton.disabled = !canEnableSessionActions; if(downloadChangedButton)downloadChangedButton.disabled = !canEnableSessionActions; if (outputFileList) { outputFileList.style.pointerEvents = canEnableSessionActions ? 'auto' : 'none'; outputFileList.style.opacity = canEnableSessionActions ? 1.0 : 0.7; } if (saveDetailButton) { saveDetailButton.disabled = !canEnableSessionActions || !hasUnsavedChanges || !librariesReady.monacoLoader; } }
    function clearSessionDisplay() { /* ... Full implementation ... */ if (sessionIdDisplay) sessionIdDisplay.textContent = ''; if (outputFileList) outputFileList.innerHTML = ''; if (outputListStatus) outputListStatus.textContent = 'Select or create a session.'; if (timelineLog) timelineLog.innerHTML = ''; if (chatWindow) chatWindow.innerHTML = ''; if (chatPlaceholder) chatPlaceholder.style.display = 'flex'; if (generationResultsDiv) generationResultsDiv.style.display = 'none'; if (summaryDisplay) summaryDisplay.innerHTML = ''; if (instructionsDisplay) instructionsDisplay.innerHTML = ''; if (generatedFilesDisplay) generatedFilesDisplay.innerHTML = ''; if (requestInput) requestInput.value = ''; }
    function clearSessionState() { /* ... Full implementation ... */ console.log("Clearing session state."); currentSessionId = null; currentFiles = {}; currentEditingFile = null; hasUnsavedChanges = false; localStorage.removeItem(SELECTED_SESSION_ID_KEY); clearSessionDisplay(); updateUIBasedOnSessionState(false); if (fileDetailOverlay?.style.display !== 'none') { closeFileDetailModal(true); } }
    function updateUIBasedOnAuthState(user) { /* ... Full implementation ... */ currentUser = user ? { id: user.id, email: user.email } : null; console.log("Auth State Update:", currentUser); if (currentUser) { if(loggedOutView)loggedOutView.style.display = 'none'; if(loggedInView)loggedInView.style.display = 'block'; if(userEmailDisplay)userEmailDisplay.textContent = currentUser.email; if(projectActionsSection)projectActionsSection.style.display = 'block'; if(userSessionsSection)userSessionsSection.style.display = 'block'; if(noSessionActivePlaceholder)noSessionActivePlaceholder.style.display = 'block'; if(sessionContentArea)sessionContentArea.style.display = 'none'; if(timelineSection)timelineSection.style.display = 'none'; if(sessionActionsSection)sessionActionsSection.style.display = 'none'; fetchUserSessions(); } else { if(loggedOutView)loggedOutView.style.display = 'block'; if(loggedInView)loggedInView.style.display = 'none'; if(userEmailDisplay)userEmailDisplay.textContent = ''; if(authErrorDisplay)authErrorDisplay.style.display = 'none'; if(projectActionsSection)projectActionsSection.style.display = 'none'; if(userSessionsSection)userSessionsSection.style.display = 'none'; if(timelineSection)timelineSection.style.display = 'none'; if(sessionActionsSection)sessionActionsSection.style.display = 'none'; if(sessionContentArea)sessionContentArea.style.display = 'none'; if(noSessionActivePlaceholder)noSessionActivePlaceholder.style.display = 'block'; clearSessionState(); userSessions = []; displayUserSessions(); } enableSessionControls(); }
    function updateUIBasedOnSessionState(isActive) { /* ... Full implementation ... */ console.log("Session State Update:", isActive, "ID:", currentSessionId); const showContent = isActive && !!currentUser && !!currentSessionId; if(noSessionActivePlaceholder)noSessionActivePlaceholder.style.display = showContent ? 'none' : 'block'; if(sessionContentArea)sessionContentArea.style.display = showContent ? 'flex' : 'none'; if(timelineSection)timelineSection.style.display = showContent ? 'block' : 'none'; if(sessionActionsSection)sessionActionsSection.style.display = showContent ? 'block' : 'none'; if(currentUser && !currentSessionId && noSessionActivePlaceholder) { noSessionActivePlaceholder.style.display = 'block'; } highlightActiveSessionInList(isActive ? currentSessionId : null); enableSessionControls(); }
    function highlightActiveSessionInList(activeSessionId) { /* ... Full implementation ... */ if (!userSessionList) return; const items = userSessionList.querySelectorAll('li'); items.forEach(item => { item.classList.toggle('active-session', item.dataset.sessionId === activeSessionId); }); }
    function escapeHtml(unsafe) { /* ... Full implementation ... */ if (unsafe === null || unsafe === undefined) return ''; if (typeof unsafe !== 'string') unsafe = String(unsafe); return unsafe.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, "&quot").replace(/'/g, "'"); }
    function parseMarkdown(text) { /* Check added */ if (!librariesReady.marked) { console.warn("Marked.js unavailable for parseMarkdown."); return '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>'; } if (!librariesReady.hljs) console.warn("Highlight.js unavailable for parseMarkdown."); try { marked.setOptions({ breaks: true, gfm: true, highlight: function(code, lang) { if (librariesReady.hljs) { const language = hljs.getLanguage(lang) ? lang : 'plaintext'; try { return hljs.highlight(code, { language: language, ignoreIllegals: true }).value; } catch (e) { console.error("HLJS error:", e); return hljs.highlight(code, { language: 'plaintext', ignoreIllegals: true }).value; } } else { return escapeHtml(code); } }}); return marked.parse(text); } catch (e) { console.error("Marked error:", e); } return '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>'; }
    function getIconForFile(filename) { /* ... Full implementation ... */ const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase() : ''; const iconMap = { js: 'javascript', py: 'code', css: 'css', html: 'html', htm: 'html', json: 'data_object', md: 'markdown', zip: 'folder_zip', rar: 'folder_zip', '7z': 'folder_zip', tar: 'folder_zip', gz: 'folder_zip', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'svg', bmp: 'image', webp: 'image', ico: 'image', txt: 'description', log: 'receipt_long', ini: 'settings', cfg: 'settings', toml: 'settings', sh: 'terminal', bash: 'terminal', ps1: 'terminal', cmd: 'terminal', bat: 'terminal', java: 'code', class: 'code', ts: 'code', tsx: 'code', jsx: 'code', c: 'code', cpp: 'code', h: 'code', cs: 'code', rb: 'code', php: 'php', sql: 'database', yaml: 'data_object', yml: 'data_object', xml: 'xml', pdf: 'picture_as_pdf', doc: 'word', docx: 'word', xls: 'excel', xlsx: 'excel', ppt: 'powerpoint', pptx: 'powerpoint', odt: 'word', ods: 'excel', odp: 'powerpoint', mp3: 'audio_file', wav: 'audio_file', ogg: 'audio_file', flac: 'audio_file', aac: 'audio_file', mp4: 'video_file', avi: 'video_file', mov: 'video_file', mkv: 'video_file', webm: 'video_file', exe: 'executable', app: 'executable', dmg: 'executable', iso: 'album', bin: 'memory', dll: 'memory', env: 'key', gitignore: 'folder_managed', dockerfile: 'deployed_code', license: 'policy', authors: 'groups', contributing: 'handshake', readme: 'info', }; return iconMap[ext] || 'draft'; }
    function getMonacoLanguageId(filename) { /* ... Full implementation ... */ if (typeof filename !== 'string') return 'plaintext'; const lastDot = filename.lastIndexOf('.'); if (lastDot === -1 || lastDot === filename.length - 1) return 'plaintext'; const ext = filename.substring(lastDot + 1).toLowerCase(); const langMap = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', css: 'css', scss: 'scss', less: 'less', html: 'html', htm: 'html', xml: 'xml', json: 'json', md: 'markdown', java: 'java', c: 'c', cpp: 'cpp', h: 'cpp', cs: 'csharp', rb: 'ruby', php: 'php', sql: 'sql', yaml: 'yaml', yml: 'yaml', sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell', ini: 'ini', cfg: 'ini', dockerfile: 'dockerfile', bat: 'bat', cmd: 'bat', log: 'plaintext', txt: 'plaintext', gitignore: 'plaintext' }; return langMap[ext] || 'plaintext'; }
    function addTimelineEvent(event) { /* ... Full implementation ... */ if (!timelineLog) return; const li = document.createElement('li'); li.classList.add('timeline-event-item'); const timestamp = new Date(event?.timestamp || Date.now()).toLocaleString(); let details = ''; let iconName = 'info'; let colorAttr = ''; try { const eventType = event?.type || 'unknown'; const eventData = event?.data || {}; switch (eventType) { case 'project_uploaded': details = `Uploaded: ${eventData.filename || '?'} (${eventData.file_count || 0} files)`; iconName = 'upload_file'; break; case 'project_started_template': details = `Started new from template: ${eventData.template || '?'}`; iconName = 'post_add'; break; case 'project_started_scratch': details = `Started blank project. Reason: ${eventData.reason || '?'}`; iconName = 'add_circle'; break; case 'session_reloaded': details = `Reloaded session: ${eventData.session_id?.substring(0,8) || '?'}`; iconName = 'history'; break; case 'change_request_start': details = `AI Request: ${eventData.user_request?.substring(0, 60) || '?'}...`; iconName = 'pending_actions'; break; case 'change_request_success': details = `AI Success: ${eventData.summary || '?'}`; iconName = 'task_alt'; break; case 'change_request_save_failed': details = `Warning: AI changes failed to save.`; iconName = 'warning'; colorAttr = 'warning'; break; case 'file_update_saved': details = `Saved changes: ${eventData.file_path || '?'}`; iconName = 'save'; break; case 'summarize_request': details = `Summarize: ${eventData.file_path || '?'}`; iconName = 'description'; break; case 'summarize_success': details = `Summarized: ${eventData.file_path || '?'}`; iconName = 'description'; break; case 'chat_message_sent': details = `Chat Sent: ${eventData.user_message?.substring(0, 60) || ''}...`; iconName = 'send'; break; case 'chat_message_received': details = `Chat Received: ${eventData.assistant_response?.substring(0, 60) || ''}...`; iconName = 'chat'; break; case 'download_request_all': details = 'Download All'; iconName = 'folder_zip'; break; case 'download_request_changed': details = 'Download Changed'; iconName = 'difference'; break; case 'download_success': details = `Download OK (Type: ${eventData.type || '?'})`; iconName = 'download_done'; break; case 'download_info': details = `Download Info (${eventData.type || '?'}): ${eventData.message || '?'}`; iconName = 'info'; break; case 'process_halted': details = `HALTED: ${eventData.reason || '?'}`; iconName = 'pan_tool'; colorAttr = 'error'; break; case 'upload_error': case 'start_new_error': case 'change_request_error': case 'summarize_error': case 'chat_error': case 'download_error': case 'gemini_pro_blocked': case 'gemini_flash_blocked': case 'security_warning': case 'session_reload_error': case 'file_update_error': details = `ERROR (${eventType}): ${eventData.error || eventData.reason || JSON.stringify(eventData)}`; iconName = 'error'; colorAttr = 'error'; break; default: details = `${eventType}: ${JSON.stringify(eventData)}`; iconName = 'help'; } } catch (e) { console.error("Timeline error:", e); details = `${event?.type || '?'}: Error display`; iconName = 'question_mark'; colorAttr = 'error'; } const maxLen = 150; const truncated = details.length > maxLen ? details.substring(0, maxLen) + '...' : details; if (colorAttr) li.dataset.eventColor = colorAttr; li.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">${iconName}</span><div><span>${timestamp}</span><strong>${escapeHtml((event?.type || 'EVENT').replace(/_/g, ' ').toUpperCase())}</strong>: ${escapeHtml(truncated)}</div>`; timelineLog.prepend(li); }
    function addChatMessage(role, message) { /* ... Full implementation including parseMarkdown call ... */ if (!chatWindow) return; if (chatPlaceholder) chatPlaceholder.style.display = 'none'; const messageDiv = document.createElement('div'); messageDiv.classList.add('chat-message', role === 'user' ? 'user-message' : 'assistant-message'); let formattedMessage = (role === 'assistant') ? parseMarkdown(message) : escapeHtml(message); messageDiv.innerHTML = `<strong>${role === 'user' ? 'You' : 'Unknown AI Assistant'}</strong> <div class="message-content ${role === 'assistant' ? 'markdown-content' : ''}">${formattedMessage}</div>`; chatWindow.appendChild(messageDiv); chatWindow.scrollTop = chatWindow.scrollHeight; }
    function displayOutputFiles(files) { /* ... Full implementation ... */ if (!outputFileList || !outputListStatus) return; outputFileList.innerHTML = ''; currentFiles = files || {}; const filePaths = Object.keys(currentFiles).sort(); if (filePaths.length === 0) { outputListStatus.textContent = currentSessionId ? 'Project is empty.' : 'Select or create a session.'; return; } outputListStatus.textContent = `${filePaths.length} files. Click view/edit.`; filePaths.forEach(filePath => { const li = document.createElement('li'); li.dataset.filePath = filePath; li.innerHTML = `<span class="material-symbols-outlined">${getIconForFile(filePath)}</span> <span>${escapeHtml(filePath)}</span>`; li.addEventListener('click', () => handleFileClick(filePath)); outputFileList.appendChild(li); }); }
    function displayGeneratedCode(generatedFiles) { /* Check added */ if (!generatedFilesDisplay) return; generatedFilesDisplay.innerHTML = ''; if (!generatedFiles || generatedFiles.length === 0) { generatedFilesDisplay.innerHTML = '<p><i>No files generated/updated.</i></p>'; return; } generatedFiles.forEach(fileData => { const panel = document.createElement('div'); panel.classList.add('result-section'); const filePath = fileData.file_path || fileData.filePath || '?'; const content = fileData.new_content ?? fileData.content ?? ''; const isNew = fileData.content !== undefined && fileData.new_content === undefined; const isUpdate = fileData.new_content !== undefined; let statusIcon = 'edit_note', statusText = 'Updated:', statusColor = 'var(--md-sys-color-secondary)'; if (isNew) { statusIcon = 'add_circle'; statusText = 'New:'; statusColor = 'var(--md-sys-color-primary)'; } else if (!isUpdate && !isNew) { statusIcon = 'code'; statusText = 'Modified:'; } const lang = getMonacoLanguageId(filePath).split('-')[0]; panel.innerHTML = `<h4><span class="material-symbols-outlined" style="color:${statusColor}; vertical-align: bottom;">${statusIcon}</span> ${statusText} <span class="filepath">${escapeHtml(filePath)}</span></h4><pre class="hljs"><code class="language-${lang}">${escapeHtml(content)}</code></pre>`; generatedFilesDisplay.appendChild(panel); const codeBlock = panel.querySelector('pre code'); if (codeBlock && librariesReady.hljs) { try { hljs.highlightElement(codeBlock); } catch (e) { console.error(`HLJS err gen code ${filePath}:`, e); } } else if (codeBlock && !librariesReady.hljs) { console.warn("Highlight.js unavailable for generated code display."); } }); }
    function logEventLocally(userId, sessionId, type, data) { /* ... Full implementation ... */ const event = { timestamp: new Date().toISOString(), type: type, data: data }; if (userId) event.userId = userId; if (sessionId) event.sessionId = sessionId; addTimelineEvent(event); }

    // --- Auth Functions ---
    async function handleLogin(e) { /* Check added */ e.preventDefault(); if (!librariesReady.supabase || !supabaseClient) { showError("Auth service not ready.", true); return; } const email = emailInput?.value; const password = passwordInput?.value; if (!email || !password) { showError("Email/Password required.", false); return; } showLoading(true); if(authErrorDisplay){authErrorDisplay.textContent=''; authErrorDisplay.style.display='none';} try { const { error } = await supabaseClient.auth.signInWithPassword({ email, password }); if (error) throw error; console.log('Login successful'); if(passwordInput) passwordInput.value = ''; } catch (error) { console.error('Login Error:', error); if(authErrorDisplay){authErrorDisplay.textContent=`Login failed: ${error.message || '?'}`; authErrorDisplay.style.display='flex';} } finally { showLoading(false); } }
    async function handleSignup() { /* Check added */ if (!librariesReady.supabase || !supabaseClient) { showError("Auth service not ready.", true); return; } const email = emailInput?.value; const password = passwordInput?.value; if (!email || !password) { if(authErrorDisplay){authErrorDisplay.textContent='Email & Password required.'; authErrorDisplay.style.display='flex';} return; } showLoading(true); if(authErrorDisplay){authErrorDisplay.textContent=''; authErrorDisplay.style.display='none';} try { const { error } = await supabaseClient.auth.signUp({ email, password }); if (error) throw error; alert('Signup successful! Check email (if enabled).'); if(passwordInput) passwordInput.value = ''; } catch (error) { console.error('Signup Error:', error); if(authErrorDisplay){authErrorDisplay.textContent=`Signup failed: ${error.message || '?'}`; authErrorDisplay.style.display='flex';} } finally { showLoading(false); } }
    async function handleLogout() { /* Check added */ if (!librariesReady.supabase || !supabaseClient) { showError("Auth service not ready.", true); return; } showLoading(true); try { const { error } = await supabaseClient.auth.signOut(); if (error) throw error; console.log('Logout successful'); } catch (error) { console.error('Logout Error:', error); showError(`Logout failed: ${error.message || '?'}`); } finally { showLoading(false); } }

    // --- API Fetch Wrapper ---
    async function fetchWithAuth(endpoint, options = {}) {
        if (!librariesReady.supabase || !supabaseClient) {
            throw new Error("Authentication service is unavailable for API requests.");
        }
        // *** Use URL constructor for robust URL joining ***
        const url = new URL(endpoint, API_BASE_URL).toString();
        console.log(`fetchWithAuth requesting: ${url}`); // Log the final URL

        let headers = { ...options.headers };
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

        if (sessionError) { console.error("Error getting Supabase session:", sessionError); }
        if (session?.access_token) { headers['Authorization'] = `Bearer ${session.access_token}`; }
        else if (!endpoint.startsWith('/static/')) { console.warn(`API call to ${endpoint} without auth token.`); }

        if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
            try { JSON.parse(options.body); headers['Content-Type'] = 'application/json'; } catch (e) {}
        }

        try {
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) {
                let errorData = { error: `HTTP ${response.status}: ${response.statusText}`, status: response.status };
                try { const jsonError = await response.json(); errorData = { ...errorData, ...jsonError }; }
                catch (e) { try { errorData.details = await response.text(); } catch (textErr) { errorData.details = "Could not read error body."; } }
                console.error(`API Error (${endpoint}):`, response.status, errorData);
                throw new Error(errorData.error || errorData.message || `Request failed: ${response.status}`);
            }
            const contentType = response.headers.get("content-type");
            if (contentType?.includes("application/json")) { return await response.json(); }
            else { console.warn(`API Success (${endpoint}) - Non-JSON: ${contentType}`); return response; }
        } catch (error) { console.error(`Fetch failed for ${endpoint}:`, error); throw new Error(`Network/API error (${endpoint}): ${error.message}`); }
    }

    // --- Session Management ---
    async function fetchUserSessions() { /* Check added */ if (!currentUser || !librariesReady.supabase) { userSessions = []; displayUserSessions(); return; } if(!sessionListStatus || !userSessionList) return; sessionListStatus.textContent = 'Loading...'; sessionListStatus.style.color='inherit'; sessionListStatus.style.display = 'block'; userSessionList.innerHTML = ''; try { const data = await fetchWithAuth('/list_sessions'); if (!Array.isArray(data)) { throw new Error("Invalid session data format."); } userSessions = data || []; displayUserSessions(); } catch (error) { console.error("Fetch sessions err:", error); sessionListStatus.textContent = `Error: ${error.message}`; sessionListStatus.style.color = 'var(--md-sys-color-error)'; userSessions = []; displayUserSessions(); } }
    function displayUserSessions() { /* ... Full implementation ... */ if (!userSessionList || !sessionListStatus) return; userSessionList.innerHTML = ''; if (!currentUser) { sessionListStatus.textContent = 'Log in first.'; sessionListStatus.style.color = 'var(--md-sys-color-secondary)'; sessionListStatus.style.display = 'block'; return; } if (userSessions.length === 0) { sessionListStatus.textContent = 'No sessions yet.'; sessionListStatus.style.color = 'var(--md-sys-color-secondary)'; sessionListStatus.style.display = 'block'; } else { sessionListStatus.style.display = 'none'; userSessions.forEach(session => { const li = document.createElement('li'); li.dataset.sessionId = session.session_id; const date = session.created_at ? new Date(session.created_at).toLocaleString() : '?'; const sessionName = session.name || `Session ${session.session_id.substring(0, 8)}`; li.innerHTML = `<span class="session-name">${escapeHtml(sessionName)}</span><span class="session-date">${date}</span>`; li.title = `ID: ${session.session_id}\nCreated: ${date}`; li.addEventListener('click', () => loadSession(session.session_id)); userSessionList.appendChild(li); }); highlightActiveSessionInList(currentSessionId); } }
    async function loadSession(sessionId) { /* Check added */ if (isLoading() || !currentUser || !librariesReady.supabase || currentSessionId === sessionId) return; console.log(`Loading session: ${sessionId}`); clearError(); showLoading(true); clearSessionState(); currentSessionId = sessionId; updateUIBasedOnSessionState(true); if (sessionIdDisplay) sessionIdDisplay.textContent = `Loading Session: ${sessionId.substring(0, 8)}...`; try { await fetchAndDisplaySessionData(sessionId); localStorage.setItem(SELECTED_SESSION_ID_KEY, sessionId); if (sessionIdDisplay) sessionIdDisplay.textContent = `Active Session: ${sessionId.substring(0, 8)}...`; console.log(`Loaded session: ${sessionId}`); } catch (error) { showError(`Failed to load session: ${error.message}`, true); } finally { showLoading(false); } }

    // --- Core Application Logic ---
    async function handleUploadSubmit(e) { /* Check added */ e.preventDefault(); if (!currentUser || !librariesReady.supabase) { showError("Log in first."); return; } if (!projectZipInput?.files?.[0]) { showError("No file selected."); return; } clearError(); showLoading(true); if(fileStatus) fileStatus.textContent = 'Uploading...'; const formData = new FormData(uploadForm); try { const data = await fetchWithAuth('/upload', { method: 'POST', body: formData }); if (!data || typeof data !== 'object' || !data.session_id) { throw new Error(data?.error || "Invalid upload response."); } const newId = data.session_id; logEventLocally(currentUser.id, newId, "project_uploaded", { fname: projectZipInput.files[0]?.name, count: data.files?.length }); await fetchUserSessions(); await loadSession(newId); if(fileStatus) fileStatus.textContent = `Loaded: ${escapeHtml(projectZipInput.files[0]?.name || '?')}`; } catch (error) { console.error('Upload Err:', error); showError(`Upload failed: ${error.message || '?'}`, true); if(fileStatus) fileStatus.textContent = 'Upload failed.'; } finally { showLoading(false); if(uploadForm) uploadForm.reset(); if(uploadButtonLabelText) uploadButtonLabelText.textContent = 'Upload Project (.zip)'; if(uploadConfirmButton){ uploadConfirmButton.classList.add('hidden'); uploadConfirmButton.disabled = true;} } }
    async function handleStartNew(templateName = null) { /* Check added */ if (!currentUser || !librariesReady.supabase) { showError("Log in first."); return; } if (currentSessionId && !confirm("Unload current session?")) return; clearError(); showLoading(true); if(fileStatus) fileStatus.textContent = 'Starting...'; clearSessionState(); updateUIBasedOnSessionState(false); try { const data = await fetchWithAuth('/start_new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_name: templateName }) }); if (!data || typeof data !== 'object' || !data.session_id) { throw new Error(data?.error || "Invalid start new response."); } const newId = data.session_id; const isTmpl = data.message?.toLowerCase().includes('template'); const logType = isTmpl ? 'proj_start_tmpl' : 'proj_start_scratch'; const logData = isTmpl ? { tmpl: templateName } : { reason: templateName ? `Tmpl '${templateName}' NF` : "No template" }; logEventLocally(currentUser.id, newId, logType, logData); await fetchUserSessions(); await loadSession(newId); if(fileStatus) fileStatus.textContent = `New project started.`; } catch (error) { console.error('Start New Err:', error); showError(`Start failed: ${error.message || '?'}`, true); if(fileStatus) fileStatus.textContent = 'Start failed.'; clearSessionState(); updateUIBasedOnSessionState(false); } finally { showLoading(false); } }
    async function handleRequestChange() { /* Check added */ if (!currentUser || !currentSessionId || !librariesReady.supabase) { showError('Log in and select session.'); return; } if (!requestInput) return; const text = requestInput.value.trim(); if (!text) { showError('Enter description.'); return; } clearError(); showLoading(true); if(generationResultsDiv) generationResultsDiv.style.display = 'none'; logEventLocally(currentUser.id, currentSessionId, "req_start", { req: text }); try { const data = await fetchWithAuth('/request_change', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: currentSessionId, request_text: text }) }); if (!data || typeof data !== 'object' || data.error) { throw new Error(data?.error || "Invalid AI response."); } if(generationResultsDiv) generationResultsDiv.style.display = 'block'; const summary = data.summary || '?'; const instructions = data.instructions || '?'; if(summaryDisplay) summaryDisplay.innerHTML = `<h4><span class="material-symbols-outlined">summarize</span> Summary</h4><div class="markdown-content">${parseMarkdown(summary)}</div>`; if(instructionsDisplay) instructionsDisplay.innerHTML = `<h4><span class="material-symbols-outlined">integration_instructions</span> Instructions</h4><div class="markdown-content">${parseMarkdown(instructions)}</div>`; displayGeneratedCode(data.generated_files || []); await fetchAndDisplaySessionData(currentSessionId); logEventLocally(currentUser.id, currentSessionId, "req_success", { summary: summary.substring(0,100) }); requestInput.value = ''; } catch (error) { console.error('AI Err:', error); showError(`AI failed: ${error.message}`); logEventLocally(currentUser.id, currentSessionId, "req_error", { error: error.message }); if(generationResultsDiv) generationResultsDiv.style.display = 'block'; if(summaryDisplay) summaryDisplay.innerHTML = `<div class="error-message">...Failed: ${escapeHtml(error.message)}</div>`; if(instructionsDisplay) instructionsDisplay.innerHTML = ''; if(generatedFilesDisplay) generatedFilesDisplay.innerHTML = ''; } finally { showLoading(false); } }
    async function sendChatMessageAction() { /* Check added */ if (isLoading() || !currentUser || !currentSessionId || !librariesReady.supabase || !chatInput) return; const msg = chatInput.value.trim(); if (!msg) return; addChatMessage('user', msg); logEventLocally(currentUser.id, currentSessionId, "chat_sent", { msg: msg }); chatInput.value = ''; clearError(); showLoading(true); try { const data = await fetchWithAuth('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: currentSessionId, message: msg }) }); if (!data || typeof data !== 'object' || data.error) { throw new Error(data?.error || "Invalid chat response."); } addChatMessage('assistant', data.response); logEventLocally(currentUser.id, currentSessionId, "chat_recv", { resp: data.response?.substring(0,100) }); } catch (error) { console.error('Chat Err:', error); addChatMessage('assistant', `Error: ${error.message}`); logEventLocally(currentUser.id, currentSessionId, "chat_error", { error: error.message }); } finally { showLoading(false); chatInput.focus(); } }

    // --- Monaco Editor Logic ---
    /** Initializes or updates the Monaco Editor instance. */
    function setupMonacoEditor(filePath, fileContent) {
        // Check if essential DOM elements exist
        if (!editorContainer || !editorFallback) {
            console.error("Monaco Editor DOM elements missing.");
            return;
        }
        // Check if Monaco loader ('require') is ready
        if (!librariesReady.monacoLoader || typeof require === 'undefined') {
            console.error("Monaco Loader (require) unavailable.");
            showError("Code editor features unavailable (loader missing).", true);
            editorContainer.innerHTML = ''; // Clear editor area
            editorFallback.textContent = `Error: Editor loader failed for ${escapeHtml(filePath)}.`;
            editorFallback.style.display = 'block';
            return;
        }

        // Show loading state
        editorContainer.innerHTML = '';
        editorFallback.textContent = 'Loading Editor...';
        editorFallback.style.display = 'block';

        // Load the main editor module using require
        require(['vs/editor/editor.main'], function (monacoInstance) {
            if (!editorContainer) return; // Check if container still exists

            // Robust check for the loaded monaco object
            if (typeof monacoInstance === 'undefined' || typeof monacoInstance.editor === 'undefined') {
                console.error("Monaco main object invalid after require.");
                showError("Code editor module failed load.", true);
                editorFallback.textContent = `Error: Editor core failed for ${escapeHtml(filePath)}. Check network.`;
                editorFallback.style.display = 'block';
                return;
            }

            // Successfully loaded main module, hide fallback
            editorFallback.style.display = 'none';
            console.log("Monaco main module loaded via require.");

            try {
                const language = getMonacoLanguageId(filePath);

                // Dispose previous editor instance if exists
                if (monacoEditor) {
                    monacoEditor.dispose();
                    monacoEditor = null;
                    console.log("Disposed old editor instance.");
                }

                // Create new editor instance
                monacoEditor = monacoInstance.editor.create(editorContainer, {
                    value: fileContent,
                    language: language,
                    theme: 'vs-dark',
                    automaticLayout: true,
                    fontSize: 14,
                    minimap: { enabled: true },
                    wordWrap: 'on',
                    scrollBeyondLastLine: false
                });

                // Add listeners
                monacoEditor.getModel()?.onDidChangeContent(() => {
                    if (!isLoading()) { // Avoid marking changed during initial load/update
                        hasUnsavedChanges = true;
                        enableSessionControls();
                    }
                });
                monacoEditor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
                    if (saveDetailButton && !saveDetailButton.disabled) {
                        handleSaveFile();
                    }
                });

                console.log(`Monaco editor created for: ${filePath}`);
                hasUnsavedChanges = false; // Reset flag
                enableSessionControls(); // Update save button state
                if (monacoEditor) monacoEditor.focus();

            } catch (error) {
                console.error("Monaco setup/update error inside require:", error);
                showError("Code editor failed to initialize or update.", true);
                editorFallback.textContent = `Error: Editor init failed for ${escapeHtml(filePath)}.`;
                editorFallback.style.display = 'block';
                if (monacoEditor) { try { monacoEditor.dispose(); } catch (e) {} } monacoEditor = null;
            }
        }, function (err) { // Error callback for require itself
            console.error("RequireJS failed to load Monaco editor module:", err);
            showError("Editor core module failed load (network/path?).", true);
            if (editorFallback) {
                editorFallback.textContent = `Error: Could not load editor module for ${escapeHtml(filePath)}. Check network/console.`;
                editorFallback.style.display = 'block';
            }
        });
    }
    async function handleFileClick(filePath) { /* Check added */ if (isLoading() || !currentUser || !currentSessionId || !(filePath in currentFiles)) return; if (hasUnsavedChanges && currentEditingFile && currentEditingFile !== filePath) { if (!confirm("Discard unsaved changes?")) return; } clearError(); currentEditingFile = filePath; if(detailFileName) detailFileName.textContent = filePath; if(detailFileSummary) detailFileSummary.innerHTML = '<p><i>Loading...</i></p>'; if(editorFallback) editorFallback.style.display='block'; if(editorFallback) editorFallback.textContent = 'Loading Editor...'; const fileContent = currentFiles[filePath] ?? "# Error: Content missing."; if(fileDetailOverlay) fileDetailOverlay.style.display = 'flex'; setupMonacoEditor(filePath, fileContent); showLoading(true); try { logEventLocally(currentUser.id, currentSessionId, "summary_req", { path: filePath }); const data = await fetchWithAuth('/summarize_file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: currentSessionId, file_path: filePath }) }); if (!data || typeof data !== 'object' || data.error) { throw new Error(data?.error || "Invalid summary response."); } if(detailFileSummary) detailFileSummary.innerHTML = `<div class="markdown-content">${parseMarkdown(data.summary || "No summary.")}</div>`; logEventLocally(currentUser.id, currentSessionId, "summary_ok", { path: filePath }); } catch(error) { console.error("Summary err:", error); if(detailFileSummary) detailFileSummary.innerHTML = `<p class="error-message">Summary failed: ${escapeHtml(error.message)}</p>`; logEventLocally(currentUser.id, currentSessionId, "summary_err", { path: filePath, error: error.message }); } finally { showLoading(false); if (monacoEditor) { monacoEditor.updateOptions({ readOnly: isLoading() }); } enableSessionControls(); } }
    async function handleSaveFile() { /* Check added */ if (!monacoEditor || !currentUser || !currentSessionId || !currentEditingFile || !hasUnsavedChanges || isLoading() || !librariesReady.supabase) return; const newContent = monacoEditor.getValue(); clearError(); showLoading(true); saveDetailButton.disabled = true; try { const data = await fetchWithAuth('/update_file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: currentSessionId, file_path: currentEditingFile, new_content: newContent }) }); if (!data || typeof data !== 'object' || data.error) { throw new Error(data?.error || "Invalid save response."); } currentFiles[currentEditingFile] = newContent; hasUnsavedChanges = false; enableSessionControls(); logEventLocally(currentUser.id, currentSessionId, "file_saved", { path: currentEditingFile }); showError("File saved.", false); } catch (error) { console.error("Save Err:", error); showError(`Save failed: ${error.message}`, true); logEventLocally(currentUser.id, currentSessionId, "save_error", { path: currentEditingFile, error: error.message }); enableSessionControls(); } finally { showLoading(false); } }
    function closeFileDetailModal(force = false) { /* Check added */ if (!fileDetailOverlay) return; if (!force && hasUnsavedChanges) { if (!confirm("Unsaved changes. Close?")) return; } fileDetailOverlay.style.display = 'none'; currentEditingFile = null; hasUnsavedChanges = false; if (monacoEditor) { try { monacoEditor.dispose(); monacoEditor = null; if(editorContainer) editorContainer.innerHTML=''; if(editorFallback) editorFallback.style.display='none'; } catch(e) { console.error("Monaco dispose err:", e); } } enableSessionControls(); }

    // --- Other Action Handlers ---
    async function handleHalt() { /* Check added */ if (isLoading() || !currentUser || !currentSessionId || !librariesReady.supabase) return; if (!confirm("Log HALT event?")) return; const reason = "User halt"; clearError(); showLoading(true); logEventLocally(currentUser.id, currentSessionId, "halted", { reason: reason }); try { const data = await fetchWithAuth('/halt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: currentSessionId, reason: reason }) }); if (!data || typeof data !== 'object' || data.error) { throw new Error(data?.error || "Invalid halt response."); } if(outputListStatus) { const originalStatus = outputListStatus.textContent; outputListStatus.textContent = data.message || 'Halt logged.'; setTimeout(()=> { if(currentSessionId && outputListStatus?.textContent === (data.message || 'Halt event logged successfully.')) { const count = Object.keys(currentFiles).length; outputListStatus.textContent = count > 0 ? `${count} files. Click view/edit.` : 'Project empty.'; } }, 3000); } } catch (error) { console.error('Halt Err:', error); showError(`Halt log failed: ${error.message}`); } finally { showLoading(false); } }
    async function handleDownload(type) { /* Check added */ if (isLoading() || !currentUser || !currentSessionId || !librariesReady.supabase) { showError("Log in and select session."); return; } clearError(); logEventLocally(currentUser.id, currentSessionId, type === 'all' ? 'dl_all' : 'dl_chg', {}); showLoading(true); const url = `${API_BASE_URL}/download/${currentSessionId}?type=${type}`; try { const { data: { session }, error: sessErr } = await supabaseClient.auth.getSession(); if (sessErr || !session?.access_token) { throw new Error(sessErr?.message || "Auth token missing."); } const headers = { 'Authorization': `Bearer ${session.access_token}` }; const response = await fetch(url, { headers }); if (!response.ok) { let msg = `DL failed: ${response.status}`; try { const data = await response.json(); msg = data.error || data.message || msg; } catch(e){} throw new Error(msg); } const ctype = response.headers.get("content-type"); if (ctype?.includes("json")) { const data = await response.json(); showError(data.message || "No changes?"); logEventLocally(currentUser.id, currentSessionId, 'dl_info', { type: type, msg: data.message }); } else if (ctype?.includes("application/zip") || ctype?.includes("octet-stream")) { const blob = await response.blob(); const dlUrl = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.style.display = 'none'; a.href = dlUrl; const disp = response.headers.get('content-disposition'); let fname = `${currentSessionId}_${type}.zip`; if (disp?.includes('attachment')) { const m= /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disp); if(m?.[1]) fname=m[1].replace(/['"]/g, ''); } a.download = fname; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(dlUrl); a.remove(); logEventLocally(currentUser.id, currentSessionId, 'dl_ok', { type: type, filename: fname }); } else { throw new Error(`Bad type: ${ctype}`); } } catch (error) { console.error(`DL Error (${type}):`, error); showError(`DL failed: ${error.message}`); logEventLocally(currentUser.id, currentSessionId, 'dl_err', { type: type, error: error.message }); } finally { showLoading(false); } }

    /** Fetches and displays data for a specific session ID. */
    async function fetchAndDisplaySessionData(sessionId) { /* Check added */ if (!sessionId || !currentUser || !librariesReady.supabase) { updateUIBasedOnSessionState(false); return; } currentSessionId = sessionId; if (sessionIdDisplay) sessionIdDisplay.textContent = `Session: ${sessionId.substring(0, 8)}...`; try { const data = await fetchWithAuth(`/session_data/${sessionId}`); if (!data || typeof data !== 'object' || data.error) { throw new Error(data?.error || "Invalid session data."); } currentFiles = data.files || {}; displayOutputFiles(currentFiles); if(timelineLog) timelineLog.innerHTML = ''; (data.timeline || []).forEach(addTimelineEvent); if(chatWindow) chatWindow.innerHTML = ''; const chatLogs = data.chat_log || []; if (chatPlaceholder) chatPlaceholder.style.display = chatLogs.length > 0 ? 'none' : 'flex'; chatLogs.forEach(msg => {if(msg && msg.role && msg.content) addChatMessage(msg.role, msg.content); else console.warn("Invalid chat msg:", msg);}); if (chatWindow && chatWindow.scrollHeight > chatWindow.clientHeight) { chatWindow.scrollTop = chatWindow.scrollHeight; } updateUIBasedOnSessionState(true); } catch (error) { console.error('Fetch session error:', error); logEventLocally(currentUser?.id, sessionId, "reload_err", { error: error.message }); showError(`Load failed: ${error.message}`, true); localStorage.removeItem(SELECTED_SESSION_ID_KEY); currentSessionId = null; clearSessionState(); updateUIBasedOnSessionState(false); fetchUserSessions(); throw error; } }

    // --- Initialization ---
    /** Polls until required libraries are loaded or timeout occurs. */
    function waitForLibraries(timeout = 15000) { /* ... Same implementation ... */ return new Promise((resolve, reject) => { const checkInterval = 250; let elapsedTime = 0; console.log("Waiting for libraries..."); const intervalId = setInterval(() => { librariesReady.supabase = typeof window.supabase === 'object' && typeof window.supabase.createClient === 'function'; librariesReady.marked = typeof window.marked === 'function'; librariesReady.hljs = typeof window.hljs !== 'undefined'; librariesReady.monacoLoader = typeof window.require === 'function'; const essentialLibsReady = librariesReady.supabase && librariesReady.monacoLoader; const allLibsChecked = essentialLibsReady && librariesReady.marked && librariesReady.hljs; if (allLibsChecked) { console.log("All libraries loaded."); clearInterval(intervalId); resolve(); } else if (elapsedTime >= timeout) { clearInterval(intervalId); console.error("Timeout waiting for libraries.", librariesReady); let missing = []; if (!librariesReady.supabase) missing.push("Supabase"); if (!librariesReady.monacoLoader) missing.push("Monaco Loader"); if (!librariesReady.marked) missing.push("Marked"); if (!librariesReady.hljs) missing.push("HighlightJS"); const errMsg = `Critical Error: Failed libs (${missing.join(', ')}). Refresh/check network.`; showError(errMsg, true); if (!essentialLibsReady) { reject(new Error(`Timeout: Critical libraries failed: ${missing.join(', ')}`)); } else { console.warn("Proceeding with missing non-essential libs."); resolve(); } } else { elapsedTime += checkInterval; } }, checkInterval); }); }

    /** Initializes the application. */
    async function initializeApp() {
        console.log("Initializing App...");
        if (loginButton) loginButton.disabled = true; if (signupButton) signupButton.disabled = true;
        disableSessionControls(); updateUIBasedOnAuthState(null); updateUIBasedOnSessionState(false);
        if(uploadConfirmButton) { uploadConfirmButton.classList.add('hidden'); uploadConfirmButton.disabled = true; }

        try { await waitForLibraries(); } catch (error) { console.error("Init stopped: library timeout:", error); return; } // Stop if critical libs failed

        // Configure Monaco require path only if loader is ready
        if (librariesReady.monacoLoader && typeof require === 'function') {
            try {
                require.config({ paths: { 'vs': `${MONACO_CDN_BASE}/vs` }});
                console.log("Monaco require path configured.");
            } catch(e) { console.error("Error configuring Monaco require path:", e); showError("Failed to configure editor paths.", true); librariesReady.monacoLoader = false; } // Mark as failed
        } else { console.warn("Cannot configure Monaco path - loader not ready."); }

        // Initialize Supabase Client (if library loaded)
        if (librariesReady.supabase) {
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { console.error("Supabase config missing!"); showError("Auth config missing.", true); return; }
            try { supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); console.log("Supabase client initialized."); if(loginButton) loginButton.disabled = false; if(signupButton) signupButton.disabled = false; } catch (error) { console.error("Supabase init error:", error); showError("Auth service failed.", true); return; }
        } else { console.error("Supabase library failed check. Auth disabled."); return; } // Stop if Supabase failed

        // Setup Auth Listener (only if supabaseClient is valid)
        if (supabaseClient) {
            supabaseClient.auth.onAuthStateChange(async (event, session) => { /* ... Same logic ... */ console.log('Auth State Change:', event, session?.user?.email); const user = session?.user ?? null; const previousUserId = currentUser?.id; updateUIBasedOnAuthState(user); if (user && (!previousUserId || previousUserId !== user.id)) { const lastSelectedId = localStorage.getItem(SELECTED_SESSION_ID_KEY); if (lastSelectedId) { console.log("Try reload last session:", lastSelectedId); setTimeout(async () => { const isValid = userSessions.some(s => s.session_id === lastSelectedId); if (isValid) { await loadSession(lastSelectedId); } else { console.log("Last session invalid."); localStorage.removeItem(SELECTED_SESSION_ID_KEY); updateUIBasedOnSessionState(false); } }, 200); } else { updateUIBasedOnSessionState(false); } } else if (event === 'SIGNED_OUT') { console.log("User signed out."); } });
            // Check initial auth state
            try { const { data: { session } } = await supabaseClient.auth.getSession(); console.log("Initial session check ok."); updateUIBasedOnAuthState(session?.user ?? null); } catch (error) { console.error("Error initial session check:", error); updateUIBasedOnAuthState(null); }
        }

        console.log("Initialization complete.");
    }

    // --- Add Event Listeners ---
    // (Keep all event listeners - unchanged)
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupButton) signupButton.addEventListener('click', handleSignup);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    if (uploadForm) uploadForm.addEventListener('submit', handleUploadSubmit);
    if (startScratchButton) startScratchButton.addEventListener('click', () => handleStartNew(null));
    if (startPythonButton) startPythonButton.addEventListener('click', () => handleStartNew(startPythonButton.dataset.template));
    if (startWebButton) startWebButton.addEventListener('click', () => handleStartNew(startWebButton.dataset.template));
    if (requestButton) requestButton.addEventListener('click', handleRequestChange);
    if (chatSendButton) chatSendButton.addEventListener('click', sendChatMessageAction);
    if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessageAction(); } });
    if (haltButton) haltButton.addEventListener('click', handleHalt);
    if (downloadAllButton) downloadAllButton.addEventListener('click', () => handleDownload('all'));
    if (downloadChangedButton) downloadChangedButton.addEventListener('click', () => handleDownload('changed'));
    if (saveDetailButton) saveDetailButton.addEventListener('click', handleSaveFile);
    if (closeDetailButton) closeDetailButton.addEventListener('click', () => closeFileDetailModal());
    if (fileDetailOverlay) fileDetailOverlay.addEventListener('click', (e) => { if (e.target === fileDetailOverlay) closeFileDetailModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && fileDetailOverlay?.style.display !== 'none') closeFileDetailModal(); });
    if (projectZipInput && uploadButtonLabelText && uploadConfirmButton) { projectZipInput.addEventListener('change', () => { if (projectZipInput.files.length > 0) { const filename = projectZipInput.files[0].name; if (uploadButtonLabelText) { uploadButtonLabelText.textContent = escapeHtml(filename); } if (uploadConfirmButton) { uploadConfirmButton.classList.remove('hidden'); uploadConfirmButton.disabled = isLoading() || !currentUser; } } else { if (uploadButtonLabelText) { uploadButtonLabelText.textContent = 'Upload Project (.zip)'; } if (uploadConfirmButton) { uploadConfirmButton.classList.add('hidden'); uploadConfirmButton.disabled = true; } } }); }


    // --- Start the Application ---
    initializeApp(); // Call the main init function

}); // End of DOMContentLoaded