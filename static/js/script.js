/**
 * script.js
 * Frontend logic for the Unknown Code Creator application.
 * Handles UI interactions, API calls, session management, Monaco Editor, and Supabase Auth.
 *
 * Rewritten for improved readability.
 */
document.addEventListener('DOMContentLoaded', async () => {

    // --- Configuration ---
    const API_BASE_URL = 'http://84.8.146.168'; // <<< ENSURE THIS MATCHES YOUR FLASK SERVER PORT
    const SUPABASE_URL = 'https://qcrkovvvvbavgnzwvbpk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcmtvdnZ2dmJhdmduend2YnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDU4MDMsImV4cCI6MjA2MDcyMTgwM30.XyeCRGKfy8Yx5DY0HKLFn7s4NDjWHScMpE1jnXb16Uw';
    const SELECTED_SESSION_ID_KEY = 'unknownCodeCreator_selectedSessionId';

    // --- Get DOM Elements ---
    // Ensure null checks for robustness in case HTML structure changes
    const uploadForm = document.getElementById('upload-form');
    const projectZipInput = document.getElementById('project-zip-input');
    const uploadButtonLabel = document.querySelector('.file-upload-label');
    const uploadButtonLabelText = uploadButtonLabel?.querySelector('span:last-of-type');
    const uploadConfirmButton = uploadForm?.querySelector('button[type="submit"]');
    const fileList = document.getElementById('file-list'); // For initial file list display (optional)
    const fileStatus = document.getElementById('file-status'); // Status under upload/new project actions
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
    const fileDetailSection = document.getElementById('file-detail-section'); // Not directly used?
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
    let currentFiles = {}; // Holds the latest state of files for the active session
    let monacoEditor = null; // Holds the Monaco Editor instance
    let currentEditingFile = null; // Holds the path of the file being edited
    let hasUnsavedChanges = false; // Track unsaved changes in editor
    let supabaseClient = null; // Use different name from global to avoid potential conflicts
    let currentUser = null; // Store user auth state { id: ..., email: ... } or null
    let userSessions = []; // Store list of user's sessions [{session_id: ..., name: ..., created_at: ...}]
    // Flags set by waitForLibraries
    let librariesReady = {
        supabase: false,
        monacoLoader: false,
        marked: false,
        hljs: false
    };

    // --- Monaco Editor Base Configuration ---
    // Defines how Monaco loads its web workers. Crucial when using CDN.
    window.MonacoEnvironment = {
        getWorkerUrl: function (moduleId, label) {
            let workerPath;
            if (label === 'json') {
                workerPath = 'vs/language/json/json.worker.js';
            } else if (label === 'css' || label === 'scss' || label === 'less') {
                workerPath = 'vs/language/css/css.worker.js';
            } else if (label === 'html' || label === 'handlebars' || label === 'razor') {
                workerPath = 'vs/language/html/html.worker.js';
            } else if (label === 'typescript' || label === 'javascript') {
                workerPath = 'vs/language/typescript/ts.worker.js';
            } else {
                workerPath = 'vs/editor/editor.worker.js'; // Default worker
            }
            // Construct the full CDN path for the worker
            return `https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/${workerPath}`;
        }
    };

    // --- Utility Functions ---

    /**
     * Displays an error message banner.
     * @param {string} message - The error message to display.
     * @param {boolean} [isSevere=false] - If true, the message persists until cleared manually.
     */
    function showError(message, isSevere = false) {
        if (!errorDisplay) return;

        const target = errorDisplayText || errorDisplay;
        target.textContent = message;
        errorDisplay.style.display = 'flex';
        console.error("Error:", message);

        if (!isSevere) {
            setTimeout(() => {
                // Check if the message is still the same before hiding
                const currentMessage = errorDisplayText ? errorDisplayText.textContent : errorDisplay?.textContent;
                if (currentMessage === message && errorDisplay) {
                    errorDisplay.style.display = 'none';
                }
            }, 8000); // Hide after 8 seconds
        }
    }

    /** Clears the error message banner. */
    function clearError() {
        if (errorDisplay) {
            errorDisplay.style.display = 'none';
            if (errorDisplayText) {
                errorDisplayText.textContent = '';
            } else {
                errorDisplay.textContent = '';
            }
        }
    }

    /**
     * Shows or hides the main loading indicator.
     * @param {boolean} isLoading - True to show the loader, false to hide it.
     */
    function showLoading(isLoading) {
        if (loadingIndicator) {
            loadingIndicator.style.display = isLoading ? 'inline-flex' : 'none';
        }

        // Disable specific buttons during loading
        if (saveDetailButton && isLoading) {
            saveDetailButton.disabled = true;
        }
        if (uploadConfirmButton && isLoading) {
            uploadConfirmButton.disabled = true;
        }

        // Always re-evaluate general control states after loading state changes
        enableSessionControls();
    }

    /** Checks if the main loading indicator is visible. */
    function isLoading() {
        return loadingIndicator?.style.display !== 'none';
    }

    /** Disables controls requiring an active session or login. */
    function disableSessionControls() {
        if (requestInput) requestInput.disabled = true;
        if (requestButton) requestButton.disabled = true;
        if (chatInput) chatInput.disabled = true;
        if (chatSendButton) chatSendButton.disabled = true;
        if (haltButton) haltButton.disabled = true;
        if (downloadAllButton) downloadAllButton.disabled = true;
        if (downloadChangedButton) downloadChangedButton.disabled = true;
        if (outputFileList) {
            outputFileList.style.pointerEvents = 'none';
            outputFileList.style.opacity = 0.7;
        }
        if (saveDetailButton) saveDetailButton.disabled = true;
        if (uploadConfirmButton) uploadConfirmButton.disabled = true;
        if (uploadButtonLabel) {
            uploadButtonLabel.style.pointerEvents = 'none';
            uploadButtonLabel.style.opacity = 0.7;
        }
        if (startScratchButton) startScratchButton.disabled = true;
        if (startPythonButton) startPythonButton.disabled = true;
        if (startWebButton) startWebButton.disabled = true;
    }

    /** Enables controls based on login status, active session, and loading state. */
    function enableSessionControls() {
        const isLoggedIn = !!currentUser;
        const isSessionActive = isLoggedIn && !!currentSessionId;
        const appIsLoading = isLoading();

        // Project actions require login & Supabase library ready & not loading
        const canEnableProjectActions = isLoggedIn && !appIsLoading && librariesReady.supabase;
        // Session actions require session active & Supabase library ready & not loading
        const canEnableSessionActions = isSessionActive && !appIsLoading && librariesReady.supabase;

        // Project Creation / Upload Controls
        if (uploadButtonLabel) {
            uploadButtonLabel.style.pointerEvents = canEnableProjectActions ? 'auto' : 'none';
            uploadButtonLabel.style.opacity = canEnableProjectActions ? 1.0 : 0.7;
        }
        if (uploadConfirmButton && projectZipInput) {
            uploadConfirmButton.disabled = !canEnableProjectActions || projectZipInput.files.length === 0;
        }
        if (startScratchButton) startScratchButton.disabled = !canEnableProjectActions;
        if (startPythonButton) startPythonButton.disabled = !canEnableProjectActions;
        if (startWebButton) startWebButton.disabled = !canEnableProjectActions;

        // Session Interaction Controls
        if (requestInput) requestInput.disabled = !canEnableSessionActions;
        if (requestButton) requestButton.disabled = !canEnableSessionActions;
        if (chatInput) chatInput.disabled = !canEnableSessionActions;
        if (chatSendButton) chatSendButton.disabled = !canEnableSessionActions;
        if (haltButton) haltButton.disabled = !canEnableSessionActions;
        if (downloadAllButton) downloadAllButton.disabled = !canEnableSessionActions;
        if (downloadChangedButton) downloadChangedButton.disabled = !canEnableSessionActions;
        if (outputFileList) {
            outputFileList.style.pointerEvents = canEnableSessionActions ? 'auto' : 'none';
            outputFileList.style.opacity = canEnableSessionActions ? 1.0 : 0.7;
        }
        // Save button requires session actions, unsaved changes, AND monaco loader ready
        if (saveDetailButton) {
            saveDetailButton.disabled = !canEnableSessionActions || !hasUnsavedChanges || !librariesReady.monacoLoader;
        }
    }

    /** Clears session-specific UI elements like file list, timeline, chat. */
    function clearSessionDisplay() {
        if (sessionIdDisplay) sessionIdDisplay.textContent = '';
        if (outputFileList) outputFileList.innerHTML = '';
        if (outputListStatus) outputListStatus.textContent = 'Select or create a session.';
        if (timelineLog) timelineLog.innerHTML = '';
        if (chatWindow) chatWindow.innerHTML = '';
        if (chatPlaceholder) chatPlaceholder.style.display = 'flex'; // Show placeholder
        if (generationResultsDiv) generationResultsDiv.style.display = 'none';
        if (summaryDisplay) summaryDisplay.innerHTML = '';
        if (instructionsDisplay) instructionsDisplay.innerHTML = '';
        if (generatedFilesDisplay) generatedFilesDisplay.innerHTML = '';
        if (requestInput) requestInput.value = '';
    }

    /** Clears current session state variables and related UI. */
    function clearSessionState() {
        console.log("Clearing session state.");
        currentSessionId = null;
        currentFiles = {};
        currentEditingFile = null;
        hasUnsavedChanges = false;
        localStorage.removeItem(SELECTED_SESSION_ID_KEY); // Clear selected session from storage

        clearSessionDisplay(); // Clear UI elements
        updateUIBasedOnSessionState(false); // Hide session content areas

        // Force close the editor modal if it's open
        if (fileDetailOverlay?.style.display !== 'none') {
            closeFileDetailModal(true);
        }
    }

    /**
     * Updates the UI based on whether a user is logged in.
     * @param {object|null} user - The Supabase user object or null if logged out.
     */
    function updateUIBasedOnAuthState(user) {
        currentUser = user ? { id: user.id, email: user.email } : null;
        console.log("Auth State Update:", currentUser);

        if (currentUser) {
            // Logged In View
            if (loggedOutView) loggedOutView.style.display = 'none';
            if (loggedInView) loggedInView.style.display = 'block';
            if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
            if (projectActionsSection) projectActionsSection.style.display = 'block';
            if (userSessionsSection) userSessionsSection.style.display = 'block';

            // Initially hide session content until a session is loaded
            if (noSessionActivePlaceholder) noSessionActivePlaceholder.style.display = 'block';
            if (sessionContentArea) sessionContentArea.style.display = 'none';
            if (timelineSection) timelineSection.style.display = 'none';
            if (sessionActionsSection) sessionActionsSection.style.display = 'none';

            fetchUserSessions(); // Fetch sessions for the logged-in user

        } else {
            // Logged Out View
            if (loggedOutView) loggedOutView.style.display = 'block';
            if (loggedInView) loggedInView.style.display = 'none';
            if (userEmailDisplay) userEmailDisplay.textContent = '';
            if (authErrorDisplay) authErrorDisplay.style.display = 'none'; // Hide auth errors
            if (projectActionsSection) projectActionsSection.style.display = 'none';
            if (userSessionsSection) userSessionsSection.style.display = 'none';
            if (timelineSection) timelineSection.style.display = 'none';
            if (sessionActionsSection) sessionActionsSection.style.display = 'none';
            if (sessionContentArea) sessionContentArea.style.display = 'none';
            if (noSessionActivePlaceholder) noSessionActivePlaceholder.style.display = 'block'; // Show placeholder

            clearSessionState(); // Clear any active session data on logout
            userSessions = [];
            displayUserSessions(); // Clear session list UI
        }

        enableSessionControls(); // Update control states based on new auth status
    }

    /**
     * Updates UI based on whether a session is currently active/loaded.
     * @param {boolean} isActive - True if a session is active, false otherwise.
     */
    function updateUIBasedOnSessionState(isActive) {
        console.log("Session State Update:", isActive, "ID:", currentSessionId);
        const showContent = isActive && !!currentUser && !!currentSessionId;

        if (noSessionActivePlaceholder) {
            noSessionActivePlaceholder.style.display = showContent ? 'none' : 'block';
        }
        if (sessionContentArea) {
            sessionContentArea.style.display = showContent ? 'flex' : 'none';
        }
        if (timelineSection) {
            timelineSection.style.display = showContent ? 'block' : 'none';
        }
        if (sessionActionsSection) {
            sessionActionsSection.style.display = showContent ? 'block' : 'none';
        }

        // Ensure placeholder shows if logged in but no session is active
        if (currentUser && !currentSessionId && noSessionActivePlaceholder) {
            noSessionActivePlaceholder.style.display = 'block';
        }

        highlightActiveSessionInList(isActive ? currentSessionId : null);
        enableSessionControls(); // Re-evaluate controls
    }

    /**
     * Adds/removes 'active-session' class to list items in the user session list.
     * @param {string|null} activeSessionId - The ID of the session to highlight, or null.
     */
    function highlightActiveSessionInList(activeSessionId) {
        if (!userSessionList) return;

        const items = userSessionList.querySelectorAll('li');
        items.forEach(item => {
            item.classList.toggle('active-session', item.dataset.sessionId === activeSessionId);
        });
    }

    /**
     * Basic HTML escaping function.
     * @param {*} unsafe - The value to escape.
     * @returns {string} The escaped string.
     */
    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        if (typeof unsafe !== 'string') unsafe = String(unsafe);
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Parses markdown text using Marked.js and highlights code blocks using Highlight.js.
     * Falls back to basic escaping if libraries are not ready.
     * @param {string} text - The markdown text to parse.
     * @returns {string} The resulting HTML string.
     */
    function parseMarkdown(text) {
        if (!librariesReady.marked) {
            console.warn("Marked.js unavailable for parseMarkdown.");
            // Basic fallback: escape HTML and replace newlines with <br>
            return '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
        }

        try {
            marked.setOptions({
                breaks: true, // Convert single line breaks to <br>
                gfm: true,    // Enable GitHub Flavored Markdown
                highlight: function(code, lang) {
                    if (librariesReady.hljs) {
                        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                        try {
                            return hljs.highlight(code, { language: language, ignoreIllegals: true }).value;
                        } catch (e) {
                            console.error("Highlight.js error during markdown parsing:", e);
                            // Fallback to plaintext highlighting on error
                            return hljs.highlight(code, { language: 'plaintext', ignoreIllegals: true }).value;
                        }
                    } else {
                        console.warn("Highlight.js unavailable for markdown code highlighting.");
                        // Fallback: escape the code block content
                        return escapeHtml(code);
                    }
                }
            });
            return marked.parse(text);
        } catch (e) {
            console.error("Marked.js parsing error:", e);
            // Fallback on Marked error
            return '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
        }
    }

    /**
     * Gets a suitable Material Icon name based on a file extension.
     * @param {string} filename - The name of the file.
     * @returns {string} The Material Icon name (e.g., 'javascript', 'code', 'image').
     */
    function getIconForFile(filename) {
        const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase() : '';
        const iconMap = {
            // Code & Scripts
            js: 'javascript', py: 'code', ts: 'code', tsx: 'code', jsx: 'code',
            java: 'code', class: 'code', c: 'code', cpp: 'code', h: 'code', cs: 'code',
            rb: 'code', php: 'php', sh: 'terminal', bash: 'terminal', ps1: 'terminal',
            cmd: 'terminal', bat: 'terminal',
            // Styles & Markup
            css: 'css', scss: 'css', less: 'css', html: 'html', htm: 'html', xml: 'xml',
            // Data & Config
            json: 'data_object', yaml: 'data_object', yml: 'data_object',
            toml: 'settings', ini: 'settings', cfg: 'settings', env: 'key',
            sql: 'database',
            // Documents & Text
            md: 'markdown', txt: 'description', log: 'receipt_long',
            pdf: 'picture_as_pdf', doc: 'word', docx: 'word', odt: 'word',
            // Spreadsheets
            xls: 'excel', xlsx: 'excel', ods: 'excel',
            // Presentations
            ppt: 'powerpoint', pptx: 'powerpoint', odp: 'powerpoint',
            // Archives
            zip: 'folder_zip', rar: 'folder_zip', '7z': 'folder_zip', tar: 'folder_zip', gz: 'folder_zip',
            // Images
            png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'svg',
            bmp: 'image', webp: 'image', ico: 'image',
            // Audio
            mp3: 'audio_file', wav: 'audio_file', ogg: 'audio_file', flac: 'audio_file', aac: 'audio_file',
            // Video
            mp4: 'video_file', avi: 'video_file', mov: 'video_file', mkv: 'video_file', webm: 'video_file',
            // Executables & System
            exe: 'executable', app: 'executable', dmg: 'executable', iso: 'album',
            bin: 'memory', dll: 'memory',
            // Git & Project Meta
            gitignore: 'folder_managed', dockerfile: 'deployed_code',
            license: 'policy', authors: 'groups', contributing: 'handshake', readme: 'info',
        };
        return iconMap[ext] || 'draft'; // Default icon
    }

    /**
     * Gets the Monaco Editor language ID based on a file extension.
     * @param {string} filename - The name of the file.
     * @returns {string} The Monaco language ID (e.g., 'javascript', 'python', 'plaintext').
     */
    function getMonacoLanguageId(filename) {
        if (typeof filename !== 'string') return 'plaintext';

        const lastDot = filename.lastIndexOf('.');
        // No extension or dot is the last character
        if (lastDot === -1 || lastDot === filename.length - 1) return 'plaintext';

        const ext = filename.substring(lastDot + 1).toLowerCase();
        const langMap = {
            js: 'javascript', jsx: 'javascript',
            ts: 'typescript', tsx: 'typescript',
            py: 'python',
            css: 'css', scss: 'scss', less: 'less',
            html: 'html', htm: 'html',
            xml: 'xml',
            json: 'json',
            md: 'markdown',
            java: 'java',
            c: 'c', cpp: 'cpp', h: 'cpp', // Often treat .h as cpp for highlighting
            cs: 'csharp',
            rb: 'ruby',
            php: 'php',
            sql: 'sql',
            yaml: 'yaml', yml: 'yaml',
            sh: 'shell', bash: 'shell', zsh: 'shell', // Group shell scripts
            ps1: 'powershell',
            ini: 'ini', cfg: 'ini', // Group ini-like configs
            dockerfile: 'dockerfile',
            bat: 'bat', cmd: 'bat', // Group windows batch
            log: 'plaintext', txt: 'plaintext', gitignore: 'plaintext' // Treat these as plain text
        };
        return langMap[ext] || 'plaintext'; // Default to plaintext
    }

    /**
     * Adds a formatted event entry to the timeline UI.
     * @param {object} event - The event object (should have timestamp, type, data).
     */
    function addTimelineEvent(event) {
        if (!timelineLog) return;

        const li = document.createElement('li');
        li.classList.add('timeline-event-item');

        const timestamp = new Date(event?.timestamp || Date.now()).toLocaleString();
        let details = '';
        let iconName = 'info'; // Default icon
        let colorAttr = '';    // Optional data attribute for styling (e.g., 'error', 'warning')

        try {
            const eventType = event?.type || 'unknown';
            const eventData = event?.data || {};

            switch (eventType) {
                case 'project_uploaded':
                    details = `Uploaded: ${eventData.filename || '?'} (${eventData.file_count || 0} files)`;
                    iconName = 'upload_file';
                    break;
                case 'project_started_template':
                    details = `Started new from template: ${eventData.template || '?'}`;
                    iconName = 'post_add';
                    break;
                case 'project_started_scratch':
                    details = `Started blank project. Reason: ${eventData.reason || '?'}`;
                    iconName = 'add_circle';
                    break;
                case 'session_reloaded':
                    details = `Reloaded session: ${eventData.session_id?.substring(0, 8) || '?'}`;
                    iconName = 'history';
                    break;
                case 'change_request_start':
                    details = `AI Request: ${eventData.user_request?.substring(0, 60) || '?'}...`;
                    iconName = 'pending_actions';
                    break;
                case 'change_request_success':
                    details = `AI Success: ${eventData.summary || '?'}`;
                    iconName = 'task_alt';
                    break;
                case 'change_request_save_failed':
                    details = `Warning: AI changes failed to save.`;
                    iconName = 'warning';
                    colorAttr = 'warning';
                    break;
                case 'file_update_saved':
                    details = `Saved changes: ${eventData.file_path || '?'}`;
                    iconName = 'save';
                    break;
                case 'summarize_request':
                    details = `Summarize: ${eventData.file_path || '?'}`;
                    iconName = 'description';
                    break;
                case 'summarize_success':
                    details = `Summarized: ${eventData.file_path || '?'}`;
                    iconName = 'description';
                    break;
                case 'chat_message_sent':
                    details = `Chat Sent: ${eventData.user_message?.substring(0, 60) || ''}...`;
                    iconName = 'send';
                    break;
                case 'chat_message_received':
                    details = `Chat Received: ${eventData.assistant_response?.substring(0, 60) || ''}...`;
                    iconName = 'chat';
                    break;
                case 'download_request_all':
                    details = 'Download All';
                    iconName = 'folder_zip';
                    break;
                case 'download_request_changed':
                    details = 'Download Changed';
                    iconName = 'difference';
                    break;
                case 'download_success':
                    details = `Download OK (Type: ${eventData.type || '?'})`;
                    iconName = 'download_done';
                    break;
                case 'download_info':
                    details = `Download Info (${eventData.type || '?'}): ${eventData.message || '?'}`;
                    iconName = 'info';
                    break;
                case 'process_halted':
                    details = `HALTED: ${eventData.reason || '?'}`;
                    iconName = 'pan_tool';
                    colorAttr = 'error';
                    break;
                // Grouping Error Types
                case 'upload_error':
                case 'start_new_error':
                case 'change_request_error':
                case 'summarize_error':
                case 'chat_error':
                case 'download_error':
                case 'gemini_pro_blocked':
                case 'gemini_flash_blocked':
                case 'security_warning':
                case 'session_reload_error':
                case 'file_update_error':
                    details = `ERROR (${eventType}): ${eventData.error || eventData.reason || JSON.stringify(eventData)}`;
                    iconName = 'error';
                    colorAttr = 'error';
                    break;
                default:
                    details = `${eventType}: ${JSON.stringify(eventData)}`;
                    iconName = 'help'; // Icon for unknown event types
            }
        } catch (e) {
            console.error("Error processing timeline event:", e, event);
            details = `${event?.type || '?'}: Error displaying event data.`;
            iconName = 'question_mark';
            colorAttr = 'error';
        }

        // Truncate long details for display
        const maxLen = 150;
        const truncatedDetails = details.length > maxLen ? details.substring(0, maxLen) + '...' : details;

        if (colorAttr) {
            li.dataset.eventColor = colorAttr; // Use data attribute for CSS styling
        }

        li.innerHTML = `
            <span class="material-symbols-outlined" aria-hidden="true">${iconName}</span>
            <div>
                <span>${timestamp}</span>
                <strong>${escapeHtml((event?.type || 'EVENT').replace(/_/g, ' ').toUpperCase())}</strong>:
                ${escapeHtml(truncatedDetails)}
            </div>
        `;

        // Prepend to show newest events first
        timelineLog.prepend(li);
    }

    /**
     * Adds a chat message (user or assistant) to the chat window UI.
     * @param {string} role - 'user' or 'assistant'.
     * @param {string} message - The message content (markdown supported for assistant).
     */
    function addChatMessage(role, message) {
        if (!chatWindow) return;

        // Hide the placeholder if it exists
        if (chatPlaceholder) {
            chatPlaceholder.style.display = 'none';
        }

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', role === 'user' ? 'user-message' : 'assistant-message');

        // Parse markdown only for assistant messages
        let formattedMessage = (role === 'assistant') ? parseMarkdown(message) : escapeHtml(message);

        messageDiv.innerHTML = `
            <strong>${role === 'user' ? 'You' : 'Unknown AI Assistant'}</strong>
            <div class="message-content ${role === 'assistant' ? 'markdown-content' : ''}">
                ${formattedMessage}
            </div>
        `;

        chatWindow.appendChild(messageDiv);
        // Scroll to the bottom to show the latest message
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    /**
     * Displays the current project files in the output file list UI.
     * @param {object} files - An object where keys are file paths and values are file content.
     */
    function displayOutputFiles(files) {
        if (!outputFileList || !outputListStatus) return;

        outputFileList.innerHTML = ''; // Clear previous list
        currentFiles = files || {}; // Update local cache
        const filePaths = Object.keys(currentFiles).sort(); // Get sorted list of paths

        if (filePaths.length === 0) {
            outputListStatus.textContent = currentSessionId ? 'Project is empty.' : 'Select or create a session.';
            return;
        }

        outputListStatus.textContent = `${filePaths.length} files. Click to view/edit.`;

        filePaths.forEach(filePath => {
            const li = document.createElement('li');
            li.dataset.filePath = filePath; // Store path for click handler
            li.innerHTML = `
                <span class="material-symbols-outlined">${getIconForFile(filePath)}</span>
                <span>${escapeHtml(filePath)}</span>
            `;
            li.addEventListener('click', () => handleFileClick(filePath));
            outputFileList.appendChild(li);
        });
    }

    /**
     * Displays AI-generated code changes/additions in the results area.
     * @param {Array<object>} generatedFiles - Array of file objects {file_path, new_content/content}.
     */
    function displayGeneratedCode(generatedFiles) {
        if (!generatedFilesDisplay) return;
        generatedFilesDisplay.innerHTML = ''; // Clear previous results

        if (!generatedFiles || generatedFiles.length === 0) {
            generatedFilesDisplay.innerHTML = '<p><i>No files generated or updated by the AI.</i></p>';
            return;
        }

        generatedFiles.forEach(fileData => {
            const panel = document.createElement('div');
            panel.classList.add('result-section');

            const filePath = fileData.file_path || fileData.filePath || '?';
            const content = fileData.new_content ?? fileData.content ?? ''; // Prefer new_content if available

            // Determine if the file is new or updated based on provided keys
            const isNew = fileData.content !== undefined && fileData.new_content === undefined; // Only 'content' key exists
            const isUpdate = fileData.new_content !== undefined; // 'new_content' key exists

            let statusIcon = 'edit_note';
            let statusText = 'Updated:';
            let statusColor = 'var(--md-sys-color-secondary)'; // Default color

            if (isNew) {
                statusIcon = 'add_circle';
                statusText = 'New:';
                statusColor = 'var(--md-sys-color-primary)';
            } else if (!isUpdate && !isNew) {
                // If neither key convention is met, assume modified (fallback)
                statusIcon = 'code';
                statusText = 'Modified:';
            }

            const lang = getMonacoLanguageId(filePath).split('-')[0]; // Get base language for highlighting

            panel.innerHTML = `
                <h4>
                    <span class="material-symbols-outlined" style="color:${statusColor}; vertical-align: bottom;">${statusIcon}</span>
                    ${statusText} <span class="filepath">${escapeHtml(filePath)}</span>
                </h4>
                <pre class="hljs"><code class="language-${lang}">${escapeHtml(content)}</code></pre>
            `;
            generatedFilesDisplay.appendChild(panel);

            // Apply syntax highlighting if hljs is available
            const codeBlock = panel.querySelector('pre code');
            if (codeBlock && librariesReady.hljs) {
                try {
                    hljs.highlightElement(codeBlock);
                } catch (e) {
                    console.error(`Highlight.js error on generated code for ${filePath}:`, e);
                }
            } else if (codeBlock && !librariesReady.hljs) {
                console.warn("Highlight.js unavailable for generated code display.");
            }
        });
    }

    /**
     * Logs an event locally to the timeline UI without sending it to the backend.
     * @param {string|null} userId - The current user's ID.
     * @param {string|null} sessionId - The current session ID.
     * @param {string} type - The event type string.
     * @param {object} data - The event data payload.
     */
    function logEventLocally(userId, sessionId, type, data) {
        const event = {
            timestamp: new Date().toISOString(),
            type: type,
            data: data
        };
        if (userId) event.userId = userId;
        if (sessionId) event.sessionId = sessionId;

        addTimelineEvent(event); // Add to the UI timeline
    }

    // --- Authentication Functions ---

    /** Handles the login form submission. */
    async function handleLogin(e) {
        e.preventDefault(); // Prevent default form submission

        if (!librariesReady.supabase || !supabaseClient) {
            showError("Authentication service is not ready. Please wait or refresh.", true);
            return;
        }

        const email = emailInput?.value;
        const password = passwordInput?.value;

        if (!email || !password) {
            showError("Email and password are required.", false);
            return;
        }

        showLoading(true);
        if (authErrorDisplay) { // Clear previous auth errors
            authErrorDisplay.textContent = '';
            authErrorDisplay.style.display = 'none';
        }

        try {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error; // Let catch block handle Supabase errors

            console.log('Login successful');
            if (passwordInput) passwordInput.value = ''; // Clear password field on success
            // Auth state change listener will handle UI updates

        } catch (error) {
            console.error('Login Error:', error);
            if (authErrorDisplay) {
                authErrorDisplay.textContent = `Login failed: ${error.message || 'Unknown error'}`;
                authErrorDisplay.style.display = 'flex';
            }
        } finally {
            showLoading(false);
        }
    }

    /** Handles the signup button click. */
    async function handleSignup() {
        if (!librariesReady.supabase || !supabaseClient) {
            showError("Authentication service is not ready. Please wait or refresh.", true);
            return;
        }

        const email = emailInput?.value;
        const password = passwordInput?.value;

        if (!email || !password) {
            if (authErrorDisplay) {
                authErrorDisplay.textContent = 'Please enter both email and password to sign up.';
                authErrorDisplay.style.display = 'flex';
            }
            return;
        }

        showLoading(true);
        if (authErrorDisplay) { // Clear previous auth errors
            authErrorDisplay.textContent = '';
            authErrorDisplay.style.display = 'none';
        }

        try {
            const { error } = await supabaseClient.auth.signUp({ email, password });
            if (error) throw error;

            // Use alert for now, replace with a better notification if needed
            alert('Signup successful! Please check your email for a confirmation link (if email confirmation is enabled).');
            if (passwordInput) passwordInput.value = ''; // Clear password field

        } catch (error) {
            console.error('Signup Error:', error);
            if (authErrorDisplay) {
                authErrorDisplay.textContent = `Signup failed: ${error.message || 'Unknown error'}`;
                authErrorDisplay.style.display = 'flex';
            }
        } finally {
            showLoading(false);
        }
    }

    /** Handles the logout button click. */
    async function handleLogout() {
        if (!librariesReady.supabase || !supabaseClient) {
            showError("Authentication service is not ready.", true);
            return;
        }

        showLoading(true);
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;

            console.log('Logout successful');
            // Auth state change listener handles UI updates and session clearing

        } catch (error) {
            console.error('Logout Error:', error);
            showError(`Logout failed: ${error.message || 'Unknown error'}`);
        } finally {
            showLoading(false);
        }
    }

    // --- API Fetch Wrapper ---

    /**
     * Wrapper for fetch requests to automatically include Supabase Auth token.
     * @param {string} endpoint - The API endpoint (e.g., '/upload').
     * @param {object} [options={}] - Standard fetch options (method, body, headers, etc.).
     * @returns {Promise<object|Response>} - Resolves with JSON data or the raw Response for non-JSON types.
     * @throws {Error} - Throws on network errors or non-ok HTTP responses.
     */
    async function fetchWithAuth(endpoint, options = {}) {
        if (!librariesReady.supabase || !supabaseClient) {
            throw new Error("Authentication service is unavailable for API requests.");
        }

        const url = `${API_BASE_URL}${endpoint}`;
        let headers = { ...options.headers }; // Copy existing headers

        // Get current Supabase session and add Authorization header if available
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

        if (sessionError) {
            console.error("Error getting Supabase session for API request:", sessionError);
            // Depending on the endpoint, you might want to throw an error here
            // or allow the request to proceed without auth for public endpoints.
        }

        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        } else if (!endpoint.startsWith('/static/')) { // Don't warn for static assets
            console.warn(`API call to ${endpoint} is being made without an authentication token.`);
        }

        // Automatically set Content-Type to application/json if body is a stringified JSON
        if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
            try {
                JSON.parse(options.body); // Check if it's valid JSON
                headers['Content-Type'] = 'application/json';
            } catch (e) {
                // Not JSON, leave Content-Type as is or let browser handle it
            }
        }

        try {
            const response = await fetch(url, { ...options, headers });

            if (!response.ok) {
                // Attempt to parse error details from the response body
                let errorData = {
                    error: `HTTP error ${response.status}: ${response.statusText}`,
                    status: response.status
                };
                try {
                    const jsonError = await response.json();
                    errorData = { ...errorData, ...jsonError }; // Merge JSON error details
                } catch (e) {
                    // If response is not JSON, try to get text
                    try {
                        errorData.details = await response.text();
                    } catch (textErr) {
                         errorData.details = "Could not read error response body.";
                    }
                }
                console.error(`API Error (${endpoint}):`, response.status, errorData);
                // Throw an error with the best message available
                throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
            }

            // Check content type to decide how to process the response
            const contentType = response.headers.get("content-type");
            if (contentType?.includes("application/json")) {
                return await response.json(); // Parse JSON response
            } else {
                // For non-JSON responses (like file downloads handled elsewhere), return the raw response
                console.warn(`API Success (${endpoint}) - Received non-JSON response: ${contentType}`);
                return response;
            }

        } catch (error) {
            // Catch network errors or errors thrown from non-ok response handling
            console.error(`Fetch failed for ${endpoint}:`, error);
            // Re-throw a more informative error
            throw new Error(`Network or API error calling ${endpoint}: ${error.message}`);
        }
    }


    // --- Session Management ---

    /** Fetches the list of sessions for the currently logged-in user. */
    async function fetchUserSessions() {
        if (!currentUser || !librariesReady.supabase) {
            userSessions = [];
            displayUserSessions(); // Update UI to show "Log in first" or empty state
            return;
        }

        if (!sessionListStatus || !userSessionList) return; // Ensure UI elements exist

        sessionListStatus.textContent = 'Loading sessions...';
        sessionListStatus.style.color = 'inherit';
        sessionListStatus.style.display = 'block';
        userSessionList.innerHTML = ''; // Clear previous list

        try {
            const data = await fetchWithAuth('/list_sessions'); // Assumes endpoint returns array of sessions
            if (!Array.isArray(data)) {
                // Handle cases where the API might return an object with a sessions key, etc.
                // For now, assume direct array response.
                throw new Error("Invalid session data format received from server.");
            }
            userSessions = data || []; // Store fetched sessions
            displayUserSessions(); // Update the UI list

        } catch (error) {
            console.error("Fetch user sessions error:", error);
            sessionListStatus.textContent = `Error loading sessions: ${error.message}`;
            sessionListStatus.style.color = 'var(--md-sys-color-error)'; // Use CSS variable for error color
            userSessions = [];
            displayUserSessions(); // Update UI to show error state
        }
    }

    /** Displays the fetched user sessions in the UI list. */
    function displayUserSessions() {
        if (!userSessionList || !sessionListStatus) return;

        userSessionList.innerHTML = ''; // Clear previous list

        if (!currentUser) {
            sessionListStatus.textContent = 'Log in to view sessions.';
            sessionListStatus.style.color = 'var(--md-sys-color-secondary)';
            sessionListStatus.style.display = 'block';
            return;
        }

        if (userSessions.length === 0) {
            sessionListStatus.textContent = 'No sessions found. Start a new project!';
            sessionListStatus.style.color = 'var(--md-sys-color-secondary)';
            sessionListStatus.style.display = 'block';
        } else {
            sessionListStatus.style.display = 'none'; // Hide status message when list has items
            userSessions.forEach(session => {
                const li = document.createElement('li');
                li.dataset.sessionId = session.session_id;

                const date = session.created_at ? new Date(session.created_at).toLocaleString() : 'Unknown date';
                // Use session name if available, otherwise generate one from ID
                const sessionName = session.name || `Session ${session.session_id.substring(0, 8)}`;

                li.innerHTML = `
                    <span class="session-name">${escapeHtml(sessionName)}</span>
                    <span class="session-date">${date}</span>
                `;
                li.title = `Session ID: ${session.session_id}\nCreated: ${date}`; // Tooltip for full ID/date

                li.addEventListener('click', () => loadSession(session.session_id));
                userSessionList.appendChild(li);
            });
            // Highlight the currently active session if there is one
            highlightActiveSessionInList(currentSessionId);
        }
    }

    /**
     * Loads and displays data for a specific session ID.
     * @param {string} sessionId - The ID of the session to load.
     */
    async function loadSession(sessionId) {
        // Prevent loading if already loading, not logged in, libraries not ready, or already on this session
        if (isLoading() || !currentUser || !librariesReady.supabase || currentSessionId === sessionId) {
            return;
        }

        console.log(`Attempting to load session: ${sessionId}`);
        clearError();
        showLoading(true);
        clearSessionState(); // Clear previous session state *before* loading new one

        currentSessionId = sessionId; // Set the new current ID immediately
        updateUIBasedOnSessionState(true); // Show session areas (will show loading state)

        if (sessionIdDisplay) {
            sessionIdDisplay.textContent = `Loading Session: ${sessionId.substring(0, 8)}...`;
        }

        try {
            // Fetch and display the actual session data (files, timeline, chat)
            await fetchAndDisplaySessionData(sessionId);

            // If successful, save this as the last selected session
            localStorage.setItem(SELECTED_SESSION_ID_KEY, sessionId);

            if (sessionIdDisplay) { // Update display after successful load
                sessionIdDisplay.textContent = `Active Session: ${sessionId.substring(0, 8)}...`;
            }
            console.log(`Successfully loaded session: ${sessionId}`);

        } catch (error) {
            // fetchAndDisplaySessionData already logs/shows error and clears state on failure
            showError(`Failed to load session ${sessionId.substring(0, 8)}: ${error.message}`, true);
            // No need to clear state here, fetchAndDisplaySessionData should handle it
            fetchUserSessions(); // Refresh session list in case the failed session needs removing visually
        } finally {
            showLoading(false);
            // enableSessionControls() is called within showLoading()
        }
    }

    // --- Core Application Logic ---

    /** Handles the project upload form submission. */
    async function handleUploadSubmit(e) {
        e.preventDefault(); // Prevent default form submission

        if (!currentUser || !librariesReady.supabase) {
            showError("Please log in first. Auth service may still be initializing.");
            return;
        }
        if (!projectZipInput?.files?.[0]) {
            showError("No project file (.zip) selected for upload.");
            return;
        }

        clearError();
        showLoading(true);
        if (fileStatus) fileStatus.textContent = 'Uploading project...';

        const formData = new FormData(uploadForm); // Create FormData from the form

        try {
            // Use fetchWithAuth to send the FormData
            const data = await fetchWithAuth('/upload', {
                method: 'POST',
                body: formData // FormData sets Content-Type automatically
            });

            // Check response structure (adjust based on actual API response)
            if (!data || typeof data !== 'object' || data.error) {
                throw new Error(data?.error || "Invalid response received from server after upload.");
            }
            const newSessionId = data.session_id;
            if (!newSessionId) {
                throw new Error("Server did not return a session ID after upload.");
            }

            // Log the upload event locally
            logEventLocally(
                currentUser.id,
                newSessionId,
                "project_uploaded",
                {
                    filename: projectZipInput.files[0]?.name,
                    file_count: data.files?.length // Assuming API returns file list/count
                }
            );

            // Refresh the session list and load the newly created session
            await fetchUserSessions();
            await loadSession(newSessionId); // This will handle UI updates

            if (fileStatus) {
                fileStatus.textContent = `Project '${escapeHtml(projectZipInput.files[0]?.name || '?')}' loaded successfully.`;
            }

        } catch (error) {
            console.error('Upload Error:', error);
            showError(`Project upload failed: ${error.message || 'Unknown error'}`, true);
            if (fileStatus) fileStatus.textContent = 'Upload failed.';
        } finally {
            showLoading(false);
            // Reset the form and button text after upload attempt
            if (uploadForm) uploadForm.reset();
            if (uploadButtonLabelText) uploadButtonLabelText.textContent = 'Upload Project (.zip)';
            if (uploadConfirmButton) {
                uploadConfirmButton.classList.add('hidden');
                uploadConfirmButton.disabled = true;
            }
        }
    }

    /**
     * Handles starting a new project, either blank or from a template.
     * @param {string|null} [templateName=null] - The name of the template to use, or null for a blank project.
     */
    async function handleStartNew(templateName = null) {
        if (!currentUser || !librariesReady.supabase) {
            showError("Please log in first. Auth service may still be initializing.");
            return;
        }

        // Confirm if a session is already active
        if (currentSessionId && !confirm("Starting a new project will unload the current session. Are you sure you want to continue?")) {
            return; // User cancelled
        }

        clearError();
        showLoading(true);
        if (fileStatus) fileStatus.textContent = templateName ? `Starting project from template '${templateName}'...` : 'Starting blank project...';

        clearSessionState(); // Clear any previous session state immediately
        updateUIBasedOnSessionState(false); // Update UI to reflect no active session

        try {
            const payload = { template_name: templateName };
            const data = await fetchWithAuth('/start_new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!data || typeof data !== 'object' || data.error) {
                throw new Error(data?.error || "Invalid response received when starting new project.");
            }
            const newSessionId = data.session_id;
            if (!newSessionId) {
                throw new Error("Server did not return a session ID after starting project.");
            }

            // Determine log type and data based on response/request
            // (This assumes the API response 'message' indicates template usage)
            const isTemplate = data.message?.toLowerCase().includes('template');
            const logType = isTemplate ? 'project_started_template' : 'project_started_scratch';
            const logData = isTemplate
                ? { template: templateName }
                : { reason: templateName ? `Template '${templateName}' not found or used` : "No template specified" };

            logEventLocally(currentUser.id, newSessionId, logType, logData);

            // Refresh session list and load the new session
            await fetchUserSessions();
            await loadSession(newSessionId);

            if (fileStatus) {
                fileStatus.textContent = `New project ${templateName ? `from template '${templateName}' ` : ''}started successfully.`;
            }

        } catch (error) {
            console.error('Start New Project Error:', error);
            showError(`Starting new project failed: ${error.message || 'Unknown error'}`, true);
            if (fileStatus) fileStatus.textContent = 'Starting project failed.';
            // Ensure UI is reset if starting failed
            clearSessionState();
            updateUIBasedOnSessionState(false);
        } finally {
            showLoading(false);
        }
    }

    /** Handles submitting a change request to the AI. */
    async function handleRequestChange() {
        if (!currentUser || !currentSessionId || !librariesReady.supabase) {
            showError('Please log in and select an active session first. Auth service may be initializing.');
            return;
        }

        const requestText = requestInput?.value?.trim();
        if (!requestText) {
            showError('Please enter a description of the changes you want the AI to make.');
            requestInput?.focus();
            return;
        }

        clearError();
        showLoading(true);
        if (generationResultsDiv) generationResultsDiv.style.display = 'none'; // Hide previous results

        logEventLocally(currentUser.id, currentSessionId, "change_request_start", { user_request: requestText });

        try {
            const payload = {
                session_id: currentSessionId,
                request_text: requestText
            };
            const data = await fetchWithAuth('/request_change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!data || typeof data !== 'object' || data.error) {
                throw new Error(data?.error || "Invalid response received from AI change request.");
            }

            // Display the results from the AI
            if (generationResultsDiv) generationResultsDiv.style.display = 'block';

            const summary = data.summary || 'No summary provided.';
            const instructions = data.instructions || 'No instructions provided.';

            if (summaryDisplay) {
                summaryDisplay.innerHTML = `
                    <h4><span class="material-symbols-outlined" style="vertical-align: bottom;">summarize</span> Summary</h4>
                    <div class="markdown-content">${parseMarkdown(summary)}</div>
                `;
            }
            if (instructionsDisplay) {
                instructionsDisplay.innerHTML = `
                    <h4><span class="material-symbols-outlined" style="vertical-align: bottom;">integration_instructions</span> Instructions</h4>
                    <div class="markdown-content">${parseMarkdown(instructions)}</div>
                `;
            }

            displayGeneratedCode(data.generated_files || []); // Display generated/updated files

            // Reload session data to reflect changes made by the AI on the backend
            await fetchAndDisplaySessionData(currentSessionId);

            logEventLocally(currentUser.id, currentSessionId, "change_request_success", { summary: summary.substring(0, 100) });

            if (requestInput) requestInput.value = ''; // Clear input field on success

        } catch (error) {
            console.error('AI Change Request Error:', error);
            showError(`AI request failed: ${error.message}`);
            logEventLocally(currentUser.id, currentSessionId, "change_request_error", { error: error.message });

            // Show error state in results area
            if (generationResultsDiv) generationResultsDiv.style.display = 'block';
            if (summaryDisplay) summaryDisplay.innerHTML = `<div class="error-message">Request failed: ${escapeHtml(error.message)}</div>`;
            if (instructionsDisplay) instructionsDisplay.innerHTML = '';
            if (generatedFilesDisplay) generatedFilesDisplay.innerHTML = '';
        } finally {
            showLoading(false);
        }
    }

    /** Sends a user message to the chat backend and displays the response. */
    async function sendChatMessageAction() {
        if (isLoading() || !currentUser || !currentSessionId || !librariesReady.supabase || !chatInput) {
            return; // Prevent sending if not ready
        }

        const userMessage = chatInput.value.trim();
        if (!userMessage) {
            return; // Don't send empty messages
        }

        // Add user message to UI immediately
        addChatMessage('user', userMessage);
        logEventLocally(currentUser.id, currentSessionId, "chat_message_sent", { user_message: userMessage });

        chatInput.value = ''; // Clear input field
        clearError();
        showLoading(true); // Show loading indicator while waiting for response

        try {
            const payload = {
                session_id: currentSessionId,
                message: userMessage
            };
            const data = await fetchWithAuth('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!data || typeof data !== 'object' || data.error) {
                throw new Error(data?.error || "Invalid response received from chat API.");
            }

            const assistantResponse = data.response || "Assistant did not provide a response.";
            addChatMessage('assistant', assistantResponse); // Display assistant's response
            logEventLocally(currentUser.id, currentSessionId, "chat_message_received", { assistant_response: assistantResponse.substring(0, 100) });

        } catch (error) {
            console.error('Chat Error:', error);
            // Display error message in the chat window
            addChatMessage('assistant', `Sorry, I encountered an error: ${error.message}`);
            logEventLocally(currentUser.id, currentSessionId, "chat_error", { error: error.message });
        } finally {
            showLoading(false);
            if (chatInput) chatInput.focus(); // Return focus to input field
        }
    }

    // --- Monaco Editor Logic ---

    /**
     * Initializes or updates the Monaco Editor instance.
     * @param {string} filePath - The path of the file being edited.
     * @param {string} fileContent - The initial content of the file.
     */
    function setupMonacoEditor(filePath, fileContent) {
        if (!editorContainer || !editorFallback) {
            console.error("Monaco Editor DOM elements (container or fallback) are missing.");
            showError("Cannot initialize code editor - UI elements missing.", true);
            return;
        }

        // Check if the Monaco loader (require) is available
        if (!librariesReady.monacoLoader || typeof require === 'undefined') {
            console.error("Monaco Editor loader (require.js) is not ready or not found.");
            showError("Code editor cannot initialize (loader not found). Please check network or refresh.", true);
            editorContainer.innerHTML = ''; // Clear container
            editorFallback.textContent = `Error: Editor loader failed. Cannot display ${escapeHtml(filePath)}.`;
            editorFallback.style.display = 'block'; // Show fallback
            return;
        }

        // Show loading state in fallback area
        editorContainer.innerHTML = ''; // Clear previous editor instance if any
        editorFallback.textContent = 'Loading Editor...';
        editorFallback.style.display = 'block';

        // Configure require path (redundant if already done in init, but safe)
        require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }});

        // Load the main editor module
        require(['vs/editor/editor.main'], function (monacoInstance) {
            // Check if container still exists (user might have closed modal quickly)
            if (!editorContainer) return;

            // Hide fallback message now that loading is attempted
            if (editorFallback) editorFallback.style.display = 'none';

            // Verify the loaded module
            if (typeof monacoInstance === 'undefined' || typeof monacoInstance.editor === 'undefined') {
                console.error("Monaco main module loaded but seems invalid or incomplete.");
                showError("Code editor module failed to load correctly.", true);
                if (editorFallback) {
                    editorFallback.textContent = `Error: Editor module failed for ${escapeHtml(filePath)}.`;
                    editorFallback.style.display = 'block';
                }
                return;
            }
            console.log("Monaco 'vs/editor/editor.main' module loaded successfully.");

            try {
                const language = getMonacoLanguageId(filePath);

                // Dispose of the previous editor instance if it exists
                if (monacoEditor) {
                    monacoEditor.dispose();
                    monacoEditor = null;
                    console.log("Disposed of previous Monaco editor instance.");
                }

                // Create the new editor instance
                monacoEditor = monacoInstance.editor.create(editorContainer, {
                    value: fileContent,
                    language: language,
                    theme: 'vs-dark', // Or 'vs-light'
                    automaticLayout: true, // Adjusts editor size on container resize
                    fontSize: 14,
                    minimap: { enabled: true },
                    wordWrap: 'on', // Wrap long lines
                    scrollBeyondLastLine: false, // Don't allow scrolling past the last line
                    readOnly: isLoading(), // Make read-only if app is busy
                });

                // Track changes to enable/disable save button
                monacoEditor.getModel()?.onDidChangeContent(() => {
                    if (!isLoading()) { // Don't mark as changed if loading caused content update
                         hasUnsavedChanges = true;
                         enableSessionControls(); // Update save button state
                    }
                });

                // Add Ctrl+S/Cmd+S shortcut for saving
                monacoEditor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
                    // Trigger save only if button is enabled
                    if (saveDetailButton && !saveDetailButton.disabled) {
                        handleSaveFile();
                    }
                });

                console.log(`Monaco editor created for: ${filePath} (Language: ${language})`);
                hasUnsavedChanges = false; // Reset unsaved changes flag
                enableSessionControls(); // Update save button state
                if (monacoEditor) monacoEditor.focus(); // Focus the editor

            } catch (error) {
                console.error("Error during Monaco editor creation:", error);
                showError("Failed to create the code editor instance.", true);
                if (editorFallback) {
                    editorFallback.textContent = `Error: Editor initialization failed for ${escapeHtml(filePath)}.`;
                    editorFallback.style.display = 'block';
                }
                // Clean up potentially partially created editor
                if (monacoEditor) {
                    try { monacoEditor.dispose(); } catch (e) { /* Ignore dispose error */ }
                    monacoEditor = null;
                }
            }
        }, function (err) {
            // Error handler for require(['vs/editor/editor.main'])
            console.error("RequireJS failed to load Monaco editor module:", err);
            showError("Failed to load core editor components. Check network connection.", true);
            if (editorFallback) {
                editorFallback.textContent = `Error: Could not load editor module for ${escapeHtml(filePath)}. Please check network and refresh.`;
                editorFallback.style.display = 'block';
            }
        });
    }

    /** Handles clicking on a file in the output list to open it in the editor modal. */
    async function handleFileClick(filePath) {
        // Basic checks
        if (isLoading() || !currentUser || !currentSessionId || !detailFileName || !detailFileSummary || !fileDetailOverlay) {
            console.warn("File click ignored: App busy, not logged in, session inactive, or UI elements missing.");
            return;
        }
        // Check if the file exists in our current state
        if (!(filePath in currentFiles)) {
             showError(`File '${filePath}' not found in current session data.`);
             return;
        }

        // Check for unsaved changes in the *currently open* editor (if any)
        if (hasUnsavedChanges && currentEditingFile && currentEditingFile !== filePath) {
            if (!confirm("You have unsaved changes in the current file. Discard changes and open the new file?")) {
                return; // User cancelled
            }
        }

        clearError();
        currentEditingFile = filePath; // Set the file being edited
        detailFileName.textContent = filePath; // Update modal title

        // Show loading state for summary and editor
        detailFileSummary.innerHTML = '<p><i>Loading file summary...</i></p>';
        fileDetailOverlay.style.display = 'flex'; // Show the modal
        showLoading(true); // Show global loading indicator

        // Get file content from local state
        const fileContent = currentFiles[filePath] ?? "# Error: File content not found in local state.";

        // Initialize the Monaco editor (will show its own loading message)
        // Do this *before* the async summary fetch to make editor appear faster
        setupMonacoEditor(filePath, fileContent);

        // --- Fetch File Summary Asynchronously ---
        try {
            logEventLocally(currentUser.id, currentSessionId, "summarize_request", { file_path: filePath });

            const payload = { session_id: currentSessionId, file_path: filePath };
            const data = await fetchWithAuth('/summarize_file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!data || typeof data !== 'object' || data.error) {
                throw new Error(data?.error || "Invalid response received for file summary.");
            }

            // Display the summary
            if (detailFileSummary) {
                detailFileSummary.innerHTML = `<div class="markdown-content">${parseMarkdown(data.summary || "No summary available.")}</div>`;
            }
            logEventLocally(currentUser.id, currentSessionId, "summarize_success", { file_path: filePath });

        } catch (error) {
            console.error(`Error fetching summary for ${filePath}:`, error);
            if (detailFileSummary) {
                detailFileSummary.innerHTML = `<p class="error-message">Could not load summary: ${escapeHtml(error.message)}</p>`;
            }
            logEventLocally(currentUser.id, currentSessionId, "summarize_error", { file_path: filePath, error: error.message });
            // Don't necessarily close the modal on summary error, user might still want to edit
        } finally {
            showLoading(false); // Hide global loading indicator (editor might still be loading internally)
            // Editor should be made editable now if it loaded successfully
             if (monacoEditor) {
                 monacoEditor.updateOptions({ readOnly: false });
             }
             enableSessionControls(); // Ensure save button state is correct
        }
    }

    /** Handles saving the content of the currently open file in the Monaco editor. */
    async function handleSaveFile() {
        // Check all conditions required for saving
        if (!monacoEditor || !currentUser || !currentSessionId || !currentEditingFile || !hasUnsavedChanges || isLoading() || !saveDetailButton) {
            console.warn("Save ignored: Editor not ready, not logged in, no session/file, no changes, app busy, or save button missing.");
            return;
        }

        const newContent = monacoEditor.getValue(); // Get current content from editor

        clearError();
        showLoading(true); // Show loading indicator during save
        saveDetailButton.disabled = true; // Disable save button immediately

        try {
            const payload = {
                session_id: currentSessionId,
                file_path: currentEditingFile,
                new_content: newContent
            };
            const data = await fetchWithAuth('/update_file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!data || typeof data !== 'object' || data.error) {
                throw new Error(data?.error || "Invalid response received after saving file.");
            }

            // --- Success ---
            // Update local cache with the saved content
            currentFiles[currentEditingFile] = newContent;
            hasUnsavedChanges = false; // Reset unsaved changes flag

            // Update UI state (re-enables save button if needed, though it should be disabled now)
            enableSessionControls();

            logEventLocally(currentUser.id, currentSessionId, "file_update_saved", { file_path: currentEditingFile });
            showError("File saved successfully.", false); // Show temporary success message

        } catch (error) {
            console.error(`Error saving file ${currentEditingFile}:`, error);
            showError(`Save failed: ${error.message}`, true); // Show persistent error
            logEventLocally(currentUser.id, currentSessionId, "file_update_error", { file_path: currentEditingFile, error: error.message });

            // Re-enable save button on failure so user can retry (if appropriate)
            // Check if still editing the same file and editor exists
            if (monacoEditor && currentEditingFile) {
                 enableSessionControls(); // This should re-enable based on hasUnsavedChanges
            }
        } finally {
            showLoading(false); // Hide loading indicator
            // enableSessionControls() is called within showLoading()
        }
    }

    /**
     * Closes the file detail/editor modal.
     * @param {boolean} [force=false] - If true, closes without prompting about unsaved changes.
     */
    function closeFileDetailModal(force = false) {
        if (!fileDetailOverlay) return;

        // Check for unsaved changes before closing, unless forced
        if (!force && hasUnsavedChanges) {
            if (!confirm("You have unsaved changes. Are you sure you want to close without saving?")) {
                return; // User cancelled closing
            }
        }

        fileDetailOverlay.style.display = 'none'; // Hide the modal
        currentEditingFile = null; // Clear the currently editing file path
        hasUnsavedChanges = false; // Reset unsaved changes flag

        // Dispose of the Monaco editor instance to free up resources
        if (monacoEditor) {
            try {
                monacoEditor.dispose();
                console.log("Monaco editor instance disposed on modal close.");
            } catch (e) {
                console.error("Error disposing Monaco editor:", e);
            } finally {
                 monacoEditor = null; // Ensure reference is cleared
                 // Clear editor container and hide fallback just in case
                 if(editorContainer) editorContainer.innerHTML = '';
                 if(editorFallback) editorFallback.style.display='none';
            }
        }

        enableSessionControls(); // Update control states (e.g., disable save button)
    }

    // --- Other Action Handlers ---

    /** Handles the "Halt" button click (logs a halt event). */
    async function handleHalt() {
        // Basic checks
        if (isLoading() || !currentUser || !currentSessionId) {
             console.warn("Halt ignored: App busy, not logged in, or no active session.");
             return;
        }

        // Confirm the action with the user
        if (!confirm("This will log a 'Halt' event for the current session. This is usually for stopping long-running AI processes (if applicable). Continue?")) {
            return;
        }

        const reason = "User initiated halt";
        clearError();
        showLoading(true);

        logEventLocally(currentUser.id, currentSessionId, "process_halted", { reason: reason });

        try {
            const payload = { session_id: currentSessionId, reason: reason };
            const data = await fetchWithAuth('/halt', { // Assuming a '/halt' endpoint exists
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!data || typeof data !== 'object' || data.error) {
                throw new Error(data?.error || "Invalid response from halt request.");
            }

            // Provide feedback to the user
            if (outputListStatus) {
                const originalStatus = outputListStatus.textContent; // Store original status
                outputListStatus.textContent = data.message || 'Halt event logged successfully.';
                // Optionally revert status message after a delay
                setTimeout(() => {
                    // Check if still in the same session before reverting
                    if (currentSessionId && outputListStatus && outputListStatus.textContent === (data.message || 'Halt event logged successfully.')) {
                         // Restore previous status (or default file count status)
                         const fileCount = Object.keys(currentFiles).length;
                         outputListStatus.textContent = fileCount > 0 ? `${fileCount} files. Click to view/edit.` : 'Project is empty.';
                    }
                }, 3000); // Revert after 3 seconds
            }

        } catch (error) {
            console.error('Halt Error:', error);
            showError(`Failed to log halt event: ${error.message}`);
            // No local event log for halt failure, as the initial halt was logged locally already
        } finally {
            showLoading(false);
            // Potentially disable halt button temporarily or based on state? For now, just re-enable.
            enableSessionControls();
        }
    }

    /**
     * Handles downloading the project files as a zip archive.
     * @param {'all' | 'changed'} type - The type of download ('all' or 'changed').
     */
    async function handleDownload(type) {
        if (isLoading() || !currentUser || !currentSessionId) {
            showError("Please log in and select an active session to download.");
            return;
        }

        clearError();
        const logEventType = type === 'all' ? 'download_request_all' : 'download_request_changed';
        logEventLocally(currentUser.id, currentSessionId, logEventType, {});
        showLoading(true);

        const downloadUrl = `${API_BASE_URL}/download/${currentSessionId}?type=${type}`;

        try {
            // We need the auth token, but fetchWithAuth expects JSON or handles non-JSON differently.
            // It's safer to get the token manually and use raw fetch for blob/file download.
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
            if (sessionError) {
                throw new Error(`Could not get authentication session: ${sessionError.message}`);
            }
            if (!session?.access_token) {
                throw new Error("Authentication token not available for download.");
            }

            const headers = {
                'Authorization': `Bearer ${session.access_token}`
            };

            const response = await fetch(downloadUrl, { headers });

            if (!response.ok) {
                // Try to parse error message if response is JSON
                let errorMessage = `Download failed with status ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    // Response was not JSON, use status text
                    errorMessage = `${errorMessage}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const contentType = response.headers.get("content-type");

            // Handle potential info message (e.g., "no changed files")
            if (contentType?.includes("application/json")) {
                const data = await response.json();
                showError(data.message || "Download information received.", false); // Show as non-severe info
                logEventLocally(currentUser.id, currentSessionId, 'download_info', { type: type, message: data.message });

            }
            // Handle actual zip file download
            else if (contentType?.includes("application/zip") || contentType?.includes("octet-stream")) {
                const blob = await response.blob();

                // Create a temporary link to trigger the download
                const downloadLink = document.createElement('a');
                downloadLink.style.display = 'none';
                const objectUrl = window.URL.createObjectURL(blob);
                downloadLink.href = objectUrl;

                // Determine filename from Content-Disposition header or generate default
                const disposition = response.headers.get('content-disposition');
                let filename = `${currentSessionId}_${type}.zip`; // Default filename
                if (disposition?.includes('attachment')) {
                    const filenameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                    if (filenameMatch?.[1]) {
                        filename = filenameMatch[1].replace(/['"]/g, ''); // Remove quotes
                    }
                }
                downloadLink.download = filename;

                // Trigger the download
                document.body.appendChild(downloadLink);
                downloadLink.click();

                // Clean up
                window.URL.revokeObjectURL(objectUrl);
                document.body.removeChild(downloadLink);

                logEventLocally(currentUser.id, currentSessionId, 'download_success', { type: type, filename: filename });

            } else {
                // Handle unexpected content types
                throw new Error(`Unexpected content type received during download: ${contentType}`);
            }

        } catch (error) {
            console.error(`Download Error (${type}):`, error);
            showError(`Download failed: ${error.message}`);
            logEventLocally(currentUser.id, currentSessionId, 'download_error', { type: type, error: error.message });
        } finally {
            showLoading(false);
        }
    }

    /**
     * Fetches and displays all data (files, timeline, chat) for a specific session ID.
     * This is called by loadSession or can be used to refresh data.
     * @param {string} sessionId - The ID of the session to fetch data for.
     * @throws {Error} - Throws error if fetching fails, allowing caller (loadSession) to handle cleanup.
     */
    async function fetchAndDisplaySessionData(sessionId) {
        if (!sessionId || !currentUser || !librariesReady.supabase) {
            console.warn("fetchAndDisplaySessionData cancelled: Missing session ID, user, or Supabase.");
            updateUIBasedOnSessionState(false); // Ensure UI reflects inactive state
            return; // Or throw error? Returning for now.
        }

        // Update session ID display (might be redundant if called from loadSession)
        currentSessionId = sessionId;
        if (sessionIdDisplay) {
            sessionIdDisplay.textContent = `Session: ${sessionId.substring(0, 8)}...`;
        }

        try {
            const data = await fetchWithAuth(`/session_data/${sessionId}`); // Assumes endpoint returns all data

            if (!data || typeof data !== 'object' || data.error) {
                throw new Error(data?.error || "Invalid or incomplete session data received from server.");
            }

            // --- Update UI with fetched data ---

            // 1. Files
            currentFiles = data.files || {}; // Update local file cache
            displayOutputFiles(currentFiles); // Render file list

            // 2. Timeline
            if (timelineLog) {
                timelineLog.innerHTML = ''; // Clear previous timeline
                (data.timeline || []).forEach(addTimelineEvent); // Add events from fetched data
            }

            // 3. Chat Log
            if (chatWindow) {
                chatWindow.innerHTML = ''; // Clear previous chat messages
                const chatLogs = data.chat_log || [];

                // Show/hide placeholder based on chat history
                if (chatPlaceholder) {
                    chatPlaceholder.style.display = chatLogs.length > 0 ? 'none' : 'flex';
                }

                chatLogs.forEach(msg => {
                    if (msg && msg.role && msg.content) {
                         addChatMessage(msg.role, msg.content);
                    } else {
                        console.warn("Skipping invalid chat message structure:", msg);
                    }
                });

                // Scroll chat to bottom if needed
                if (chatWindow.scrollHeight > chatWindow.clientHeight) {
                    chatWindow.scrollTop = chatWindow.scrollHeight;
                }
            }

            // Mark session as fully loaded and active in the UI
            updateUIBasedOnSessionState(true);

        } catch (error) {
            console.error(`Error fetching data for session ${sessionId}:`, error);
            logEventLocally(currentUser?.id, sessionId, "session_reload_error", { error: error.message });

            // Critical error: Clear the potentially corrupted session state
            localStorage.removeItem(SELECTED_SESSION_ID_KEY); // Remove from storage
            clearSessionState(); // Clear variables and UI
            updateUIBasedOnSessionState(false); // Show inactive state

            // Re-throw the error so the caller (e.g., loadSession) knows it failed
            // and can handle further actions like refreshing the session list.
            throw error;
        }
    }


    // --- Initialization ---

    /**
     * Polls until required external libraries (Supabase, Monaco Loader) are loaded,
     * or a timeout occurs. Also checks for optional libraries (Marked, Highlight.js).
     * @param {number} [timeout=20000] - Maximum time to wait in milliseconds.
     * @returns {Promise<void>} - Resolves when essential libraries are ready, rejects on timeout.
     */
    function waitForLibraries(timeout = 20000) {
        return new Promise((resolve, reject) => {
            const checkInterval = 250; // Check every 250ms
            let elapsedTime = 0;

            console.log("Waiting for essential libraries (Supabase Client, Monaco Loader)...");

            const intervalId = setInterval(() => {
                // Check status of each library
                librariesReady.supabase = typeof window.supabase === 'object' && typeof window.supabase.createClient === 'function';
                librariesReady.monacoLoader = typeof window.require === 'function'; // AMD loader
                librariesReady.marked = typeof window.marked === 'function';
                librariesReady.hljs = typeof window.hljs !== 'undefined';

                const essentialLibsReady = librariesReady.supabase && librariesReady.monacoLoader;

                if (essentialLibsReady) {
                    clearInterval(intervalId);
                    console.log("Essential libraries loaded.");
                    // Log status of optional libraries
                    if (!librariesReady.marked) console.warn("Optional library Marked.js not found."); else console.log("Optional library Marked.js found.");
                    if (!librariesReady.hljs) console.warn("Optional library Highlight.js not found."); else console.log("Optional library Highlight.js found.");
                    resolve(); // Success
                } else if (elapsedTime >= timeout) {
                    clearInterval(intervalId);
                    console.error("Timeout waiting for essential libraries.", librariesReady);
                    let missing = [];
                    if (!librariesReady.supabase) missing.push("Supabase Client");
                    if (!librariesReady.monacoLoader) missing.push("Monaco Loader (require.js)");
                    const errorMessage = `Critical Error: Failed to load essential libraries (${missing.join(', ')}). The application might not function correctly. Please try refreshing the page.`;
                    showError(errorMessage, true); // Show persistent error
                    reject(new Error(`Timeout: Essential libraries failed to load: ${missing.join(', ')}`));
                } else {
                    elapsedTime += checkInterval;
                }
            }, checkInterval);
        });
    }

    /** Initializes the entire application: waits for libraries, sets up auth, loads initial state. */
    async function initializeApp() {
        console.log("Initializing Application...");

        // Initial UI state: Disable most controls until ready
        if (loginButton) loginButton.disabled = true;
        if (signupButton) signupButton.disabled = true;
        disableSessionControls(); // Disable session/project controls
        updateUIBasedOnAuthState(null); // Show logged-out view initially
        updateUIBasedOnSessionState(false); // Show no-session view initially
        if (uploadConfirmButton) {
            uploadConfirmButton.classList.add('hidden');
            uploadConfirmButton.disabled = true;
        }

        // 1. Wait for essential libraries
        try {
            await waitForLibraries();
            console.log("Library check passed.");
        } catch (error) {
            // Error already shown by waitForLibraries
            console.error("Initialization stopped: Critical libraries failed to load.", error);
            // Keep controls disabled, user needs to refresh.
            return; // Stop initialization
        }

        // 2. Configure Monaco require path (safe to do now)
        if (librariesReady.monacoLoader && typeof require === 'function') {
            try {
                require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' }});
                console.log("Monaco require.js path configured.");
            } catch (e) {
                console.error("Error configuring Monaco require.js path:", e);
                showError("Failed to configure code editor paths. Editor may not work.", true);
                librariesReady.monacoLoader = false; // Mark as not ready if config failed
            }
        } else {
            console.warn("Could not configure Monaco path - loader not ready (this shouldn't happen after waitForLibraries).");
        }

        // 3. Initialize Supabase Client
        if (librariesReady.supabase) {
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                console.error("Supabase URL or Anon Key is missing in configuration!");
                showError("Authentication configuration is missing. Cannot initialize auth.", true);
                return; // Stop initialization
            }
            try {
                // Use the globally available supabase object
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log("Supabase client initialized successfully.");
                // Enable login/signup now that client is ready
                if (loginButton) loginButton.disabled = false;
                if (signupButton) signupButton.disabled = false;
            } catch (error) {
                console.error("Supabase client initialization failed:", error);
                showError("Failed to initialize the authentication service.", true);
                return; // Stop initialization
            }
        } else {
            // This case should ideally not be reached if waitForLibraries worked, but handle defensively
            console.error("Supabase library failed check. Authentication will be disabled.");
            showError("Authentication library failed to load. Login/Signup disabled.", true);
            // Proceed without auth? Or stop? Stopping for safety.
            return;
        }

        // 4. Setup Supabase Auth State Change Listener
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log('Authentication State Change Detected:', event, session?.user?.email || '(No session)');
            const user = session?.user ?? null;
            const previousUserId = currentUser?.id; // Store previous user ID to detect actual login/logout

            // Update UI based on the new authentication state
            updateUIBasedOnAuthState(user);

            // If user logged in (and wasn't already logged in with the same ID)
            if (user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && (!previousUserId || previousUserId !== user.id)) {
                console.log(`User ${user.email} signed in or initial session loaded.`);
                // Try to reload the last selected session from local storage
                const lastSelectedId = localStorage.getItem(SELECTED_SESSION_ID_KEY);

                if (lastSelectedId) {
                    console.log("Found last selected session ID in storage:", lastSelectedId);
                    // Wait a moment for userSessions to potentially populate via fetchUserSessions
                    // triggered by updateUIBasedOnAuthState. A better approach might involve promises/events.
                    setTimeout(async () => {
                        // Check if the stored session ID is valid for *this* user
                        const isValidSessionForUser = userSessions.some(s => s.session_id === lastSelectedId);
                        if (isValidSessionForUser) {
                             console.log("Attempting to reload last valid session:", lastSelectedId);
                             await loadSession(lastSelectedId);
                        } else {
                             console.log("Last selected session ID is not valid for the current user or not found in list. Clearing.");
                             localStorage.removeItem(SELECTED_SESSION_ID_KEY);
                             updateUIBasedOnSessionState(false); // Ensure no session UI is shown
                        }
                    }, 500); // Delay might need adjustment
                } else {
                    console.log("No last selected session ID found in storage.");
                    updateUIBasedOnSessionState(false); // Ensure no session UI is shown
                }
            } else if (event === 'SIGNED_OUT') {
                console.log("User signed out.");
                // UI updates and session clearing are handled by updateUIBasedOnAuthState
            }
            // Other events like PASSWORD_RECOVERY, USER_UPDATED can be handled here if needed
        });

        // 5. Trigger Initial Session Check (listener above will handle the result)
        try {
            // This doesn't return the session directly here, but triggers the 'INITIAL_SESSION' event
            // in the listener if a valid session exists in storage.
            await supabaseClient.auth.getSession();
            console.log("Initial Supabase session check requested.");
        } catch (error) {
            // This usually indicates a problem contacting Supabase, not necessarily no session
            console.error("Error during initial Supabase session check:", error);
            // Ensure UI reflects logged-out state if check fails badly
            updateUIBasedOnAuthState(null);
        }

        console.log("Application initialization sequence complete.");
        // Controls will be enabled progressively by auth state changes and session loading.
    }

    // --- Add Event Listeners ---

    // Authentication
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupButton) signupButton.addEventListener('click', handleSignup);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);

    // Project Creation / Upload
    if (uploadForm) uploadForm.addEventListener('submit', handleUploadSubmit);
    if (startScratchButton) startScratchButton.addEventListener('click', () => handleStartNew(null));
    if (startPythonButton) startPythonButton.addEventListener('click', () => handleStartNew(startPythonButton.dataset.template)); // Assumes template name in data-template
    if (startWebButton) startWebButton.addEventListener('click', () => handleStartNew(startWebButton.dataset.template)); // Assumes template name in data-template

    // Session Actions
    if (requestButton) requestButton.addEventListener('click', handleRequestChange);
    if (chatSendButton) chatSendButton.addEventListener('click', sendChatMessageAction);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            // Send on Enter key, unless Shift+Enter is pressed (for newlines)
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevent default newline insertion
                sendChatMessageAction();
            }
        });
    }
    if (haltButton) haltButton.addEventListener('click', handleHalt);
    if (downloadAllButton) downloadAllButton.addEventListener('click', () => handleDownload('all'));
    if (downloadChangedButton) downloadChangedButton.addEventListener('click', () => handleDownload('changed'));

    // File Editor Modal
    if (saveDetailButton) saveDetailButton.addEventListener('click', handleSaveFile);
    if (closeDetailButton) closeDetailButton.addEventListener('click', () => closeFileDetailModal());
    // Close modal if clicking outside the content area
    if (fileDetailOverlay) {
        fileDetailOverlay.addEventListener('click', (e) => {
            if (e.target === fileDetailOverlay) { // Check if click was directly on the overlay background
                closeFileDetailModal();
            }
        });
    }
    // Close modal on Escape key press
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fileDetailOverlay?.style.display !== 'none') {
            closeFileDetailModal();
        }
    });

    // File Input Handling (Show filename and confirm button)
    if (projectZipInput && uploadButtonLabelText && uploadConfirmButton) {
        projectZipInput.addEventListener('change', () => {
            if (projectZipInput.files.length > 0) {
                const filename = projectZipInput.files[0].name;
                if (uploadButtonLabelText) {
                    uploadButtonLabelText.textContent = escapeHtml(filename);
                }
                if (uploadConfirmButton) {
                    uploadConfirmButton.classList.remove('hidden');
                    // Enable confirm button only if not loading and user is logged in
                    uploadConfirmButton.disabled = isLoading() || !currentUser;
                }
            } else {
                // No file selected
                if (uploadButtonLabelText) {
                    uploadButtonLabelText.textContent = 'Upload Project (.zip)';
                }
                if (uploadConfirmButton) {
                    uploadConfirmButton.classList.add('hidden');
                    uploadConfirmButton.disabled = true;
                }
            }
        });
    }


    // --- Start the Application ---
    initializeApp(); // Call the main initialization function

}); // End of DOMContentLoaded
