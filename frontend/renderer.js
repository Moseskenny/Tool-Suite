const { ipcRenderer } = require('electron');

// --- Welcome Page Function ---
function enterApp(tool) {
    const welcomePage = document.getElementById('welcome-page');
    const appContainer = document.querySelector('.app-container');
    const welcomeLogo = document.querySelector('.welcome-logo');
    
    // Get logo center position for circle origin
    const logoRect = welcomeLogo.getBoundingClientRect();
    const centerX = logoRect.left + logoRect.width / 2;
    const centerY = logoRect.top + logoRect.height / 2;
    
    // Create expanding circle overlay
    const circle = document.createElement('div');
    circle.className = 'circle-reveal';
    circle.style.left = `${centerX}px`;
    circle.style.top = `${centerY}px`;
    
    // Calculate scale to cover entire screen from logo center
    const maxX = Math.max(centerX, window.innerWidth - centerX);
    const maxY = Math.max(centerY, window.innerHeight - centerY);
    const maxDist = Math.sqrt(maxX * maxX + maxY * maxY);
    const scaleNeeded = Math.ceil(maxDist / 50) + 2; // 50 is initial radius (100px/2), +2 buffer
    
    circle.style.transform = `translate(-50%, -50%) scale(0)`;
    document.body.appendChild(circle);
    
    // Animate circle expanding to cover screen
    circle.animate([
        { transform: `translate(-50%, -50%) scale(0)` },
        { transform: `translate(-50%, -50%) scale(${scaleNeeded})` }
    ], {
        duration: 1800,
        easing: 'cubic-bezier(0.42, 0, 0.58, 1)',
        fill: 'forwards'
    });
    
    // Fade out welcome elements as circle expands
    const welcomeElements = [
        welcomeLogo,
        document.querySelector('.welcome-title'),
        document.querySelector('.welcome-tagline'),
        document.querySelector('.welcome-tools'),
        document.querySelector('.welcome-cta'),
        document.querySelector('.welcome-version')
    ];
    
    welcomeElements.forEach((el, index) => {
        if (el) {
            el.animate([
                { opacity: 1 },
                { opacity: 0, offset: 0.5 },
                { opacity: 0 }
            ], {
                duration: 1200,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                fill: 'forwards'
            });
        }
    });
    
    // Find sidebar logo for later
    const sidebarLogo = document.querySelector('.logo-icon');
    
    // Show main app as circle expands
    setTimeout(() => {
        // App container fades in behind the circle
        appContainer.style.display = 'flex';
        appContainer.classList.add('visible');
        appContainer.style.opacity = '1';
        
        // Sidebar logo pop
        if (sidebarLogo) {
            sidebarLogo.style.opacity = '0';
            sidebarLogo.style.transform = 'scale(0.5)';
            setTimeout(() => {
                sidebarLogo.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
                sidebarLogo.style.opacity = '1';
                sidebarLogo.style.transform = 'scale(1)';
            }, 200);
        }
        
        // Sidebar items stagger
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach((btn, index) => {
            btn.style.opacity = '0';
            btn.style.transform = 'translateX(-15px)';
            setTimeout(() => {
                btn.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
                btn.style.opacity = '1';
                btn.style.transform = 'translateX(0)';
            }, 300 + (index * 90));
        });
        
        // Sidebar footer
        setTimeout(() => {
            const sidebarFooter = document.querySelector('.sidebar-footer');
            if (sidebarFooter) {
                sidebarFooter.classList.add('content-bounce-slow');
                setTimeout(() => sidebarFooter.classList.remove('content-bounce-slow'), 800);
            }
        }, 1000);
        
        // Auto-select compress as default tool on first load
        // This will handle header + content fade in together
        setTimeout(() => {
            selectTool(tool || 'compress');
            if (__pendingOnboarding) {
                __pendingOnboarding = false;
                setTimeout(() => showOnboarding(), 600);
            }
        }, 1200);
    }, 1000);
    
    // Remove circle and hide welcome at 1600ms
    setTimeout(() => {
        circle.animate([
            { opacity: 1 },
            { opacity: 0 }
        ], {
            duration: 400,
            fill: 'forwards'
        });
        
        setTimeout(() => {
            circle.remove();
            welcomePage.classList.add('hidden');
            welcomePage.style.display = 'none';
        }, 350);
    }, 1300);
}

// --- Window Controls ---
document.getElementById('win-min').addEventListener('click', () => ipcRenderer.send('window-minimize'));
document.getElementById('win-max').addEventListener('click', () => ipcRenderer.send('window-maximize'));
document.getElementById('win-close').addEventListener('click', () => ipcRenderer.send('window-close'));

let selectedTool = null;
let selectedFiles = [];
let selectedFolderPath = null;

const CONVERSION_MAP = {
    '.pdf': ['docx', 'txt', 'jpg', 'png'],
    '.docx': ['pdf', 'txt'],
    '.txt': ['pdf', 'docx'],
    '.md': ['pdf', 'docx'],
    '.html': ['pdf'],
    '.jpg': ['pdf', 'png', 'jpeg', 'webp'],
    '.jpeg': ['pdf', 'png', 'webp'],
    '.png': ['pdf', 'jpg', 'jpeg', 'webp']
};

const FORMAT_LABELS = {
    pdf: 'PDF', docx: 'DOCX', txt: 'TXT', md: 'MD',
    jpg: 'JPG', jpeg: 'JPEG', png: 'PNG', webp: 'WEBP',
    pptx: 'PPTX', html: 'HTML'
};

const FORMAT_COLORS = {
    pdf: '#e74c3c', docx: '#2980b9', txt: '#7f8c8d',
    jpg: '#27ae60', png: '#2ecc71', webp: '#1abc9c',
    pptx: '#e67e22', html: '#3498db', md: '#9b59b6'
};

let selectedFormat = null;

function selectTool(tool) {
    if (selectedTool === tool) return;

    const contentArea = document.querySelector('.content-area');
    const header = document.querySelector('.workspace-header');
    const activeBtn = document.getElementById(`btn-${tool}`);

    // Exit - header and content fade out
    if (header) header.classList.add('animate-out');
    if (contentArea) contentArea.classList.add('animate-out');

    setTimeout(() => {
        // Remove exit animations
        if (contentArea) {
            contentArea.classList.remove('animate-out');
            contentArea.style.opacity = '';
            contentArea.style.transform = '';
        }
        if (header) {
            header.classList.remove('animate-out');
            header.style.opacity = '';
            header.style.transform = '';
        }

        selectedTool = tool;
        selectedFiles = [];
        selectedFolderPath = null;
        document.getElementById('process-btn').innerText = 'Process Task';
        document.getElementById('expense-mapping-ui').style.display = 'none';
        document.getElementById('expense-file-name').style.display = 'none';

        // Button pop effect
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.transform = '';
        });
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
            activeBtn.style.transform = 'scale(1.06)';
            setTimeout(() => {
                activeBtn.style.transform = 'scale(1)';
            }, 350);
        }

        const titles = { compress: "Image Compressor", organize: "File Organizer", convert: "Doc Converter", expense: "Expense Analysis", recorder: "Screen Recorder", pdftool: "PDF Toolkit" };
        document.getElementById('tool-title').innerText = titles[tool];
        document.getElementById('tool-description').innerText = (tool === 'organize') ? "Click below to select a folder to organize." : (tool === 'recorder') ? "Click Start Recording to begin." : (tool === 'pdftool') ? "Select files to merge or split." : (tool === 'expense') ? "Click to select a CSV file" : "Click to select file.";

        document.getElementById('compressor-controls').style.display = 'none';
        document.getElementById('converter-setup').style.display = 'none';
        document.getElementById('converter-result').style.display = 'none';
        document.getElementById('recorder-controls').style.display = 'none';
        document.getElementById('pdftool-controls').style.display = 'none';
        document.getElementById('drop-zone').style.display = 'block';
        document.getElementById('action-bar').style.display = 'none';
        document.getElementById('download-btn').style.display = 'none';
        document.getElementById('preview-section').innerHTML = ''; 
        
        if(tool === 'compress') document.getElementById('compressor-controls').style.display = 'block';
        if(tool === 'convert') {
            document.getElementById('converter-setup').style.display = 'none';
            document.getElementById('converter-result').style.display = 'none';
            document.getElementById('conv-step2-grid').innerHTML = '';
            document.getElementById('conv-step2-name').textContent = '';
            document.getElementById('conv-step2-meta').textContent = '';
            selectedFormat = null;
        }
        if(tool === 'recorder') {
            document.getElementById('recorder-controls').style.display = 'block';
            document.getElementById('drop-zone').style.display = 'none';
        }
        if(tool === 'pdftool') document.getElementById('pdftool-controls').style.display = 'block';

        // Enter - bouncy animation immediately (No double fade)
        if (header) {
            header.classList.add('content-bounce');
            setTimeout(() => header.classList.remove('content-bounce'), 600);
        }
        
        if (contentArea) {
            // Add bouncy animation to content elements (staggered)
            const dropZone = document.getElementById('drop-zone');
            const compressorControls = document.getElementById('compressor-controls');
            const converterSetup = document.getElementById('converter-setup');
            const converterResult = document.getElementById('converter-result');
            const recorderControls = document.getElementById('recorder-controls');
            const pdftoolControls = document.getElementById('pdftool-controls');
            const previewSection = document.getElementById('preview-section');
            const actionBar = document.getElementById('action-bar');
            
            // First batch - drop zone or tool UI
            if (dropZone) {
                dropZone.classList.add('content-bounce');
                setTimeout(() => dropZone.classList.remove('content-bounce'), 600);
            }
            if (compressorControls) {
                compressorControls.classList.add('content-bounce');
                setTimeout(() => compressorControls.classList.remove('content-bounce'), 600);
            }
            if (converterSetup) {
                converterSetup.classList.add('content-bounce');
                setTimeout(() => converterSetup.classList.remove('content-bounce'), 600);
            }
            if (converterResult) {
                converterResult.classList.add('content-bounce');
                setTimeout(() => converterResult.classList.remove('content-bounce'), 600);
            }
            if (recorderControls) {
                recorderControls.classList.add('content-bounce');
                setTimeout(() => recorderControls.classList.remove('content-bounce'), 600);
            }
            if (pdftoolControls) {
                pdftoolControls.classList.add('content-bounce');
                setTimeout(() => pdftoolControls.classList.remove('content-bounce'), 600);
            }
            
            // Second batch - preview section (if has content)
            setTimeout(() => {
                if (previewSection && previewSection.innerHTML.trim()) {
                    previewSection.classList.add('content-bounce');
                    setTimeout(() => previewSection.classList.remove('content-bounce'), 600);
                }
            }, 100);
            
            // Third batch - action bar + Support the Dev link (slower bounce)
            setTimeout(() => {
                if (actionBar && actionBar.style.display !== 'none') {
                    actionBar.classList.add('content-bounce');
                    setTimeout(() => actionBar.classList.remove('content-bounce'), 600);
                }
                // Add slower bounce to "Support the Dev" link
                const supportLink = document.querySelector('.workspace .sidebar-footer .support-link');
                if (supportLink) {
                    supportLink.classList.add('content-bounce-slow');
                    setTimeout(() => supportLink.classList.remove('content-bounce-slow'), 800);
                }
            }, 160);
        }

    }, 200); 
}

document.getElementById('drop-zone').addEventListener('click', async () => {
    if (!selectedTool) return showToast("Please select a tool first!", "#ef4444");
    if (selectedTool === 'organize') {
        selectedFolderPath = await ipcRenderer.invoke('select-folder');
        if (selectedFolderPath) {
            document.getElementById('action-bar').style.display = 'block';
        }
    } else if (selectedTool === 'recorder') {
        // Screen recorder doesn't need files - do nothing
    } else if (selectedTool === 'pdftool') {
        document.getElementById('file-input').click();
    } else {
        document.getElementById('file-input').click();
    }
});

document.getElementById('file-input').addEventListener('change', (e) => {
    selectedFiles = e.target.files;
    if (selectedFiles.length === 0) return;

    const file = selectedFiles[0];
    const ext = "." + file.name.split('.').pop().toLowerCase();

    document.getElementById('action-bar').style.display = 'block';

    if (selectedTool === 'convert') {
        document.getElementById('action-bar').style.display = 'none';
        showConverterStep2(ext);
        fetchConverterFileInfo(selectedFiles);
    }
    if (selectedTool === 'compress') {
        // Show image and hide placeholder
        document.getElementById('original-preview').classList.add('visible');
        document.getElementById('original-preview-box').classList.add('hidden');
        document.getElementById('original-preview').src = URL.createObjectURL(file);
        
        const originalSizeBytes = file.size;
        const originalSizeMB = (originalSizeBytes / (1024 * 1024)).toFixed(2);
        document.getElementById('original-size').innerText = `~${originalSizeMB} MB`;
        updateCompressPreview();
    }
    if (selectedTool === 'expense') {
        document.getElementById('expense-file-name').textContent = '📄 ' + file.name;
        document.getElementById('expense-file-name').style.display = 'inline-flex';
    }
    if (selectedTool === 'pdftool') {
        for (let f of selectedFiles) {
            if (f.name.toLowerCase().endsWith('.pdf')) {
                pdfFiles.push(f);
            }
        }
        updatePdfFileList();
        showToast(`${selectedFiles.length} PDF file(s) added`);
    }
});

function populateFormatGrid(ext) {
    const badge = document.getElementById('conv-step2-source');
    const grid = document.getElementById('conv-step2-grid');
    const extUpper = ext.replace('.', '').toUpperCase();
    badge.innerText = extUpper;
    selectedFormat = null;

    const targets = CONVERSION_MAP[ext] || [];
    grid.innerHTML = '';

    if (targets.length === 0) {
        grid.innerHTML = `<span style="color: var(--text-dim); padding: 10px;">No conversions available</span>`;
        showToast("Unrecognized file type", "#ef4444");
        return;
    }

    targets.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'format-option';
        btn.dataset.format = t;
        btn.innerHTML = `<span class="format-option-label">${FORMAT_LABELS[t] || t.toUpperCase()}</span>`;
        btn.style.setProperty('--format-color', FORMAT_COLORS[t] || '#f59e0b');
        btn.onclick = () => selectTargetFormat(t);
        grid.appendChild(btn);
    });

    selectTargetFormat(targets[0]);
}

function selectTargetFormat(format) {
    selectedFormat = format;
    document.querySelectorAll('.format-option').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.format === format);
    });
}

async function fetchConverterFileInfo(files) {
    const nameSpan = document.getElementById('conv-step2-name');
    const metaSpan = document.getElementById('conv-step2-meta');

    if (files.length === 0) { infoDiv.style.display = 'none'; return; }

    const file = files[0];
    nameSpan.textContent = file.name;

    const formData = new FormData();
    for (let f of files) formData.append("files", f);

    try {
        const resp = await fetch("http://127.0.0.1:8000/analyze-conversion", { method: "POST", body: formData });
        const data = await resp.json();
        if (data.status === 'success' && data.files && data.files[0]) {
            const info = data.files[0];
            const parts = [];
            const sizeKB = (info.size / 1024).toFixed(1);
            const sizeMB = (info.size / (1024 * 1024)).toFixed(2);
            parts.push(info.size > 1048576 ? `${sizeMB} MB` : `${sizeKB} KB`);
            if (info.pages) parts.push(`${info.pages} pages`);
            if (info.dimensions) parts.push(info.dimensions);
            if (info.paragraphs) parts.push(`${info.paragraphs} paragraphs`);
            if (info.lines) parts.push(`${info.lines} lines`);
            metaSpan.textContent = parts.join(' · ');
        }
    } catch (e) {
        metaSpan.textContent = '';
    }

}

function showConverterStep2(ext) {
    document.getElementById('drop-zone').style.display = 'none';
    document.getElementById('converter-setup').style.display = 'block';
    document.getElementById('converter-result').style.display = 'none';
    document.getElementById('action-bar').style.display = 'none';
    document.getElementById('conv-download-btn').style.display = 'none';
    populateFormatGrid(ext);
}

function showConverterStep3(data) {
    document.getElementById('converter-setup').style.display = 'none';
    document.getElementById('converter-result').style.display = 'block';

    const statusEl = document.getElementById('conv-result-status');
    const detailsEl = document.getElementById('conv-result-details');

    const fileName = selectedFiles[0].name;
    const ext = "." + fileName.split('.').pop().toLowerCase();
    const targetExt = selectedFormat;
    const outputName = fileName.replace(new RegExp('\\' + ext.replace('.', '\\.') + '$'), '') + '.' + targetExt;

    statusEl.innerHTML = `
        <div style="text-align: center; padding: 10px 0 5px;">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 14px;">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p style="font-size: 1.25rem; font-weight: 700; color: #10b981; margin-bottom: 4px;">Conversion Complete</p>
        </div>
    `;

    detailsEl.innerHTML = `
        <div class="elegant-card" style="margin: 16px 0; padding: 24px; text-align: center; border-radius: 14px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap;">
                <span class="format-badge" style="background: var(--badge-bg, var(--accent)); color: white; padding: 8px 18px; border-radius: 8px; font-weight: 600; font-size: 0.9rem;">${ext.replace('.', '').toUpperCase()}</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                <span class="format-badge" style="background: var(--badge-bg, var(--accent)); color: white; padding: 8px 18px; border-radius: 8px; font-weight: 600; font-size: 0.9rem;">${targetExt.toUpperCase()}</span>
            </div>
            <p style="color: var(--text-dim); font-size: 0.85rem; margin-top: 14px; word-break: break-all;">${fileName}<br><span style="color: var(--accent); font-weight: 600;">→</span> ${outputName}</p>
            <p style="color: var(--text-dim); font-size: 0.85rem; margin-top: 8px;">${data.message || 'Conversion successful'}</p>
        </div>
        <p style="color: var(--text-dim); font-size: 0.9rem; text-align: center; margin-top: 6px;">
            Choose where to save your converted file
        </p>
    `;

    document.getElementById('conv-download-btn').style.display = 'inline-flex';
}

function converterBackToStep1() {
    document.getElementById('converter-setup').style.display = 'none';
    document.getElementById('converter-result').style.display = 'none';
    document.getElementById('drop-zone').style.display = 'block';
    document.getElementById('action-bar').style.display = 'none';
    selectedFiles = [];
    selectedFormat = null;
}

function converterBackToStep2() {
    document.getElementById('converter-result').style.display = 'none';
    document.getElementById('converter-setup').style.display = 'block';
}

function converterConvertAnother() {
    converterBackToStep1();
}

async function processFiles() {
    toggleLoading(true);
    const previewArea = document.getElementById('preview-section');
    const processBtn = document.getElementById('process-btn');
    const originalText = processBtn.innerText;
    
    processBtn.innerText = "Processing...";
    processBtn.classList.add('btn-loading');

    try {
        if (selectedTool === 'organize' && selectedFolderPath) {
            const resp = await fetch("http://127.0.0.1:8000/organize-local", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: selectedFolderPath })
            });
            const data = await resp.json();
            showToast("Folders Organized!");
            previewArea.innerHTML = `<p style="color:#10b981; font-weight:bold; text-align:center;">${data.message}</p>`;
        } 
        else if (selectedTool === 'convert') {
            if (!selectedFormat) { showToast("Please select a target format", "#ef4444"); toggleLoading(false); return; }

            document.getElementById('loading-bar').style.width = '0%';
            window.__converting = true;

            const percentText = document.createElement('div');
            percentText.id = 'progress-percent';
            percentText.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:10002;font-size:0.75rem;font-weight:600;color:var(--accent,#6c5ce7);background:var(--bg-card,#1a1a2e);padding:2px 12px;border-radius:8px;pointer-events:none;';
            document.body.appendChild(percentText);

            const formData = new FormData();
            for (let f of selectedFiles) formData.append("files", f);
            formData.append("target_format", selectedFormat);

            const progressInterval = setInterval(async () => {
                try {
                    const pr = await fetch("http://127.0.0.1:8000/convert-progress");
                    const pd = await pr.json();
                    if (pd.status === 'processing') {
                        const pct = pd.percent || 0;
                        document.getElementById('loading-bar').style.width = pct + '%';
                        percentText.textContent = pct + '%';
                    }
                } catch (e) {}
            }, 300);

            const resp = await fetch("http://127.0.0.1:8000/process-convert", { method: "POST", body: formData });
            clearInterval(progressInterval);

            const data = await resp.json();
            document.getElementById('loading-bar').style.width = '100%';
            percentText.textContent = '100%';

            setTimeout(() => {
                document.getElementById('loading-bar').style.width = '0%';
                const pt = document.getElementById('progress-percent');
                if (pt) pt.remove();
            }, 800);

            if (data.status === 'error' || data.error) {
                showToast(data.message || data.error || "Conversion failed", "#ef4444");
                toggleLoading(false);
                return;
            }
            showConverterStep3(data);
        } 
        else if (selectedTool === 'compress') {
            const formData = new FormData();
            for (let f of selectedFiles) formData.append("files", f);
            formData.append("quality", document.getElementById('quality-slider').value);
            const resp = await fetch("http://127.0.0.1:8000/process-compress", { method: "POST", body: formData });
            const data = await resp.json();
            previewArea.innerHTML = `<p style="color:#10b981; font-weight:bold; text-align:center;">${data.message}</p>`;
            document.getElementById('download-btn').style.display = 'inline-block';
        }
        else if (selectedTool === 'expense') {
            if (selectedFiles.length === 0) {
                showToast("Please select a CSV file first!", "#ef4444");
                toggleLoading(false);
                return;
            }
            const formData = new FormData();
            formData.append("file", selectedFiles[0]);
            formData.append("price", 0.0);
            formData.append("is_splitwise", false);
            
            const resp = await fetch("http://127.0.0.1:8000/analyze", { method: "POST", body: formData });
            const data = await resp.json();
            
            if (data.requires_mapping) {
                toggleLoading(false);
                showColumnMapping(data.columns, selectedFiles[0].name);
                return;
            }

            if (data.error) {
                showToast(data.error, "#ef4444");
                toggleLoading(false);
                return;
            }
            
            showToast("Analysis Complete!");
            renderExpenseResults(data, previewArea);
        }
    } catch (err) {
        showToast("Backend connection error!", "#ef4444");
    } finally {
        if (selectedTool !== 'convert') {
            toggleLoading(false);
        }
        processBtn.innerText = "Done!";
        setTimeout(() => {
            processBtn.innerText = originalText;
            processBtn.classList.remove('btn-loading');
        }, 2000);
    }
}

// --- Expense Manual Mapping ---
let pendingMappingFile = null;

window.showColumnMapping = function(columns, filename) {
    pendingMappingFile = filename;
    const mapUi = document.getElementById('expense-mapping-ui');
    mapUi.style.display = 'block';

    const selects = ['map-date', 'map-desc', 'map-amt'];
    selects.forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '<option value="">— Select column —</option>';
        columns.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col;
            opt.textContent = col;
            sel.appendChild(opt);
        });
    });

    document.getElementById('preview-section').innerHTML = '';
    document.getElementById('action-bar').style.display = 'none';
};

window.applyColumnMapping = async function() {
    const dateCol = document.getElementById('map-date').value;
    const descCol = document.getElementById('map-desc').value;
    const amtCol = document.getElementById('map-amt').value;

    if (!dateCol || !descCol || !amtCol) {
        showToast("Please map all three columns", "#ef4444");
        return;
    }

    const formData = new FormData();
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0] || selectedFiles[0];
    formData.append("file", file);
    formData.append("price", 0.0);
    formData.append("is_splitwise", false);
    formData.append("date_col", dateCol);
    formData.append("desc_col", descCol);
    formData.append("amt_col", amtCol);

    document.getElementById('expense-mapping-ui').style.display = 'none';
    toggleLoading(true);

    try {
        const resp = await fetch("http://127.0.0.1:8000/analyze-manual", { method: "POST", body: formData });
        const data = await resp.json();

        if (data.error) {
            showToast(data.error, "#ef4444");
            toggleLoading(false);
            return;
        }

        showToast("Analysis Complete!");
        renderExpenseResults(data, document.getElementById('preview-section'));
    } catch (e) {
        showToast("Backend connection error!", "#ef4444");
    }
    toggleLoading(false);
};

window.showMappingError = function() {
    document.getElementById('expense-mapping-ui').style.display = 'none';
    showToast("Upload a cleaner CSV file with clear column names", "#ef4444");
};

function renderExpenseResults(data, previewArea) {
    const chartHtml = data.prediction.chart_img
        ? `<img src="${data.prediction.chart_img}" style="width: 100%; max-width: 450px; margin: 20px auto; display: block;">`
        : ``;
    const reportFilename = data.report_name;

    previewArea.innerHTML = `
        <div class="elegant-card" style="text-align: center; margin-top: 20px;">
            <h3 style="color: var(--accent); margin-bottom: 20px;">Analysis Results</h3>
            
            <div class="expense-summary" style="display: flex; justify-content: space-around; background: var(--glass-bg); backdrop-filter: var(--glass-blur); padding: 20px; border-radius: 16px; margin-bottom: 20px; border: 1px solid var(--glass-border);">
                <p style="font-size: 1.1rem; color: var(--text-dim);">Daily Burn: <strong style="color: var(--text-main); font-size: 1.3rem;">${data.prediction.currency}${data.prediction.burn_rate}</strong></p>
                <p style="font-size: 1.1rem; color: var(--text-dim);">Projected EOM: <strong style="color: var(--text-main); font-size: 1.3rem;">${data.prediction.currency}${data.prediction.projected}</strong></p>
            </div>
            
            ${chartHtml}

            <div style="background: var(--glass-bg); backdrop-filter: var(--glass-blur); padding: 25px; border-radius: 16px; margin: 20px 0; text-align: left; border: 1px solid var(--glass-border);">
                <h4 style="margin-bottom: 15px; color: var(--text-dim);">Want to buy something? Check if it's affordable:</h4>
                <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                    <input type="text" id="wish-item" placeholder="Item Name (e.g. PS5)" class="expense-input" style="flex: 1; padding: 15px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--bg-card); color: var(--text-main); outline: none;">
                    <input type="number" id="wish-price" placeholder="Price" class="expense-input" style="flex: 1; padding: 15px; border-radius: 12px; border: 1px solid var(--glass-border); background: var(--bg-card); color: var(--text-main); outline: none;">
                    <button onclick="calculateAffordability(${data.prediction.projected}, '${data.prediction.currency}')" class="btn-primary" style="margin-top: 0;">Analyze</button>
                </div>
                <div id="afford-result" style="font-size: 1.05rem; line-height: 1.5; color: var(--text-main);"></div>
            </div>

            <a href="http://127.0.0.1:8000/download-report/${reportFilename}" target="_blank" class="btn-primary" style="display: inline-block; text-decoration: none;">Download PDF Report</a>
        </div>
    `;
}

// --- Onboarding ---
const ONBOARDING_STEPS = [
    {
        title: "Welcome to ToolSuite",
        desc: "Your all-in-one, privacy-first desktop toolkit. Every tool runs 100% locally on your machine — no cloud, no tracking, no data leaving your computer.",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        content: `
            <div class="onboarding-tools-grid">
                <div class="onboarding-tool-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><div><strong>Image Compressor</strong><span>Reduce image sizes without losing quality</span></div></div>
                <div class="onboarding-tool-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg><div><strong>File Organizer</strong><span>Auto-sort files into smart folders</span></div></div>
                <div class="onboarding-tool-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><div><strong>Doc Converter</strong><span>Convert between PDF, DOCX, TXT, and more</span></div></div>
                <div class="onboarding-tool-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg><div><strong>Expense Analysis</strong><span>Smart spending insights from your CSV bank data</span></div></div>
                <div class="onboarding-tool-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg><div><strong>Screen Recorder</strong><span>Record your screen in crisp quality</span></div></div>
                <div class="onboarding-tool-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><polyline points="14 2 14 8 20 8"/></svg><div><strong>PDF Toolkit</strong><span>Merge, split, and analyze PDF files</span></div></div>
            </div>
        `
    },
    {
        title: "Designed for Speed & Privacy",
        desc: "No sign-ups. No servers. Every file stays on your computer. Switch between tools from the sidebar and process files with a single click.",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
        content: `
            <ul style="text-align: left; color: var(--text-dim); font-size: 0.9rem; line-height: 2; list-style: none; padding: 0;">
                <li>🔒 <strong style="color: var(--text-main);">100% Offline</strong> — No internet needed</li>
                <li>🎨 <strong style="color: var(--text-main);">Dark & Light Themes</strong> — Toggle from the sidebar</li>
                <li>⚡ <strong style="color: var(--text-main);">Batch Processing</strong> — Handle multiple files at once</li>
            </ul>
        `
    },
    {
        title: "You're All Set!",
        desc: "Pick a tool from the sidebar and start working. Need help? Click the <strong>?</strong> icon in the sidebar anytime.",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        content: `
            <p style="font-size: 1rem; color: var(--text-main); margin: 20px 0;">
                Ready to take control of your files?
            </p>
            <label style="display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--text-dim); font-size: 0.85rem; cursor: pointer; margin-top: 10px;">
                <input type="checkbox" id="onboarding-dont-show" style="accent-color: var(--accent);">
                Don't show this again
            </label>
        `
    }
];

let onboardingStep = 0;

window.showOnboarding = function() {
    onboardingStep = 0;
    document.getElementById('onboarding-overlay').classList.add('active');
    renderOnboardingStep();
};

window.hideOnboarding = function() {
    document.getElementById('onboarding-overlay').classList.remove('active');
    const dontShow = document.getElementById('onboarding-dont-show');
    if (dontShow && dontShow.checked) {
        localStorage.setItem('onboarding_seen', 'true');
    }
};

window.nextOnboardingStep = function() {
    if (onboardingStep < ONBOARDING_STEPS.length - 1) {
        onboardingStep++;
        renderOnboardingStep();
    } else {
        hideOnboarding();
    }
};

window.prevOnboardingStep = function() {
    if (onboardingStep > 0) {
        onboardingStep--;
        renderOnboardingStep();
    }
};

function renderOnboardingStep() {
    const step = ONBOARDING_STEPS[onboardingStep];
    const total = ONBOARDING_STEPS.length;

    document.getElementById('onboarding-icon').innerHTML = step.icon;
    document.getElementById('onboarding-title').textContent = step.title;
    document.getElementById('onboarding-desc').innerHTML = step.desc;
    document.getElementById('onboarding-content').innerHTML = step.content;

    const dots = document.getElementById('onboarding-dots');
    dots.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const dot = document.createElement('span');
        dot.className = 'onboarding-dot' + (i === onboardingStep ? ' active' : '');
        dots.appendChild(dot);
    }

    document.getElementById('onboarding-prev').style.display = onboardingStep === 0 ? 'none' : 'inline-block';
    document.getElementById('onboarding-next').textContent = onboardingStep === total - 1 ? '✨ Get Started' : 'Next →';

    const skipBtn = document.getElementById('onboarding-skip');
    skipBtn.style.display = onboardingStep === total - 1 ? 'none' : 'inline-block';
}

// Show onboarding on first app entry
let __pendingOnboarding = !localStorage.getItem('onboarding_seen');

// Interactive Affordability Math
window.calculateAffordability = (projectedSpend, currency) => {
    const itemName = document.getElementById('wish-item').value || 'this item';
    const itemPrice = parseFloat(document.getElementById('wish-price').value);
    const resultDiv = document.getElementById('afford-result');

    if (!itemPrice || itemPrice <= 0) {
        resultDiv.innerHTML = `<span style="color: #ef4444;">Please enter a valid price to analyze.</span>`;
        return;
    }

    const threshold = projectedSpend * 0.30;

    if (itemPrice > threshold) {
        resultDiv.innerHTML = `⚠️ <strong style="color: #ef4444;">Risky Purchase</strong>: <br>
        <span style="color: #94a3b8;">${currency}${itemPrice} for <b>${itemName}</b> is quite high compared to your usual monthly spending trend (${currency}${projectedSpend}). Consider saving up first!</span>`;
    } else {
        resultDiv.innerHTML = `✅ <strong style="color: #10b981;">Affordable</strong>: <br>
        <span style="color: #94a3b8;">${currency}${itemPrice} for <b>${itemName}</b> fits comfortably within your current spending habits. Go for it!</span>`;
    }
};

// Save Logic for Convert & Compress
document.getElementById('download-btn').addEventListener('click', async () => {
    const dest = await ipcRenderer.invoke('select-folder');
    if (dest) {
        const endpoint = (selectedTool === 'convert') ? "/export-converted" : "/export-images";
        const resp = await fetch(`http://127.0.0.1:8000${endpoint}`, {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ destination: dest })
        });
        const data = await resp.json();
        if (data.status === 'error') {
            showToast(data.message || "Failed to save files", "#ef4444");
        } else {
            showToast("Successfully Saved!");
            shell.openPath(dest);
        }
        setTimeout(() => selectTool(selectedTool), 1000);
    }
});

// Converter step 3 download handler
document.getElementById('conv-download-btn').addEventListener('click', async () => {
    const dest = await ipcRenderer.invoke('select-folder');
    if (!dest) return;
    toggleLoading(true);
    try {
        const resp = await fetch("http://127.0.0.1:8000/export-converted", {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ destination: dest })
        });
        const data = await resp.json();
        if (data.status === 'error') {
            showToast(data.message || "Failed to save files", "#ef4444");
        } else {
            const fileList = data.files ? data.files.join(', ') : '';
            showToast(fileList ? `Saved: ${fileList}` : "Successfully saved!");
            shell.openPath(dest);
            setTimeout(() => selectTool(selectedTool), 1000);
        }
    } catch (err) {
        showToast("Save failed: " + err.message, "#ef4444");
    }
    toggleLoading(false);
});

function toggleLoading(show) { document.getElementById('loading-bar').style.width = show ? '100%' : '0%'; }
function showToast(msg, color="#10b981") {
    const t = document.getElementById('toast');
    t.innerText = msg; 
    t.style.background = color;
    t.classList.remove('error', 'shake');
    if (color === "#ef4444") {
        t.classList.add('error');
    }
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// --- SLIDER DEBOUNCE LOGIC (FIXED) ---
async function updateCompressPreview() {
    if (selectedFiles.length === 0) return;
    const quality = document.getElementById('quality-slider').value;
    const formData = new FormData();
    formData.append("file", selectedFiles[0]);
    formData.append("quality", quality);
    const resp = await fetch("http://127.0.0.1:8000/compress-preview", { method: "POST", body: formData });
    const data = await resp.json();
    
    // Show compressed image and hide placeholder
    document.getElementById('compressed-preview').classList.add('visible');
    document.getElementById('compressed-preview-box').classList.add('hidden');
    document.getElementById('compressed-preview').src = data.preview_url;
    
    const sizeBytes = data.estimated_size;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    document.getElementById('estimated-size').innerText = `~${sizeMB} MB`;
}

const qualitySlider = document.getElementById('quality-slider');
const qualityValText = document.getElementById('quality-val');
let previewDebounce;    

const { shell } = require('electron');

document.getElementById('github-btn').addEventListener('click', (e) => {
    e.preventDefault();
    shell.openExternal('https://github.com/Moseskenny/Tool-Suite'); 
});

// --- Theme Toggle ---
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('toolsuite-theme', next);
    document.getElementById('theme-toggle').innerHTML = next === 'light' ? '☀️' : '🌙';
}

const savedTheme = localStorage.getItem('toolsuite-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
document.addEventListener('DOMContentLoaded', () => {
    const tb = document.getElementById('theme-toggle');
    if (tb) tb.innerHTML = savedTheme === 'light' ? '☀️' : '🌙';
});

// --- Right-click context menu ---
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  ipcRenderer.send('show-context-menu');
});

// --- Keyboard shortcuts ---
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        if (selectedTool && selectedTool !== 'organize' && selectedTool !== 'recorder') {
            document.getElementById('file-input').click();
        }
    }
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        const convBtn = document.querySelector('.btn-convert');
        if (convBtn && convBtn.closest('#converter-setup') && convBtn.closest('#converter-setup').style.display !== 'none') {
            convBtn.click();
        } else {
            const btn = document.getElementById('process-btn');
            if (btn && btn.style.display !== 'none') btn.click();
        }
    }
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const convDlBtn = document.getElementById('conv-download-btn');
        if (convDlBtn && convDlBtn.style.display !== 'none') {
            convDlBtn.click();
        } else {
            const btn = document.getElementById('download-btn');
            if (btn && btn.style.display !== 'none') btn.click();
        }
    }
});

qualitySlider.addEventListener('input', (e) => {
    qualityValText.innerText = `${e.target.value}%`; 
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(() => {
        updateCompressPreview(); 
    }, 300); 
});

let currentPdfMode = 'merge';
let pdfFiles = [];

function selectPdfMode(mode) {
    currentPdfMode = mode;
    document.getElementById('merge-mode-btn').classList.toggle('active', mode === 'merge');
    document.getElementById('split-mode-btn').classList.toggle('active', mode === 'split');
    pdfFiles = [];
    updatePdfFileList();
    
    document.getElementById('split-options').style.display = (mode === 'split') ? 'block' : 'none';
    document.getElementById('analyze-result').style.display = 'none';
    document.getElementById('split-input-area').style.display = 'none';
}

function updatePdfFileList() {
    const list = document.getElementById('pdf-list');
    const clearActions = document.getElementById('pdf-list-actions');
    const actionBar = document.getElementById('action-bar');

    if (pdfFiles.length > 0) {
        clearActions.style.display = 'block';
        actionBar.style.display = 'block';
    } else {
        clearActions.style.display = 'none';
        actionBar.style.display = 'none';
    }

    if (currentPdfMode === 'merge') {
        list.innerHTML = pdfFiles.map((f, i) => `
            <div class="pdf-item" draggable="true" data-index="${i}" ondragstart="handleDragStart(event)" ondragover="handleDragOver(event)" ondrop="handleDrop(event)" ondragenter="handleDragEnter(event)" ondragleave="handleDragLeave(event)">
                <span class="drag-handle">☰</span>
                <span class="pdf-name">${f.name}</span>
                <button onclick="removePdfFile(${i})">×</button>
            </div>
        `).join('');
        if (pdfFiles.length > 0) {
            document.getElementById('process-btn').innerText = 'Merge PDFs';
        }
    } else {
        list.innerHTML = pdfFiles.length > 0 ? `<div class="pdf-item"><span>${pdfFiles[0].name}</span><button onclick="removePdfFile(0)">×</button></div>` : '';
        if (pdfFiles.length > 0) {
            document.getElementById('process-btn').innerText = 'Split PDF';
        }
    }
}

let draggedIndex = null;

function handleDragStart(e) {
    draggedIndex = parseInt(e.target.dataset.index);
    e.target.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDragEnter(e) {
    e.preventDefault();
    if (e.target.classList.contains('pdf-item') && !e.target.classList.contains('dragging')) {
        e.target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    if (e.target.classList.contains('pdf-item')) {
        e.target.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const dropTarget = e.target.closest('.pdf-item');
    if (dropTarget && draggedIndex !== null) {
        const dropIndex = parseInt(dropTarget.dataset.index);
        if (draggedIndex !== dropIndex) {
            const item = pdfFiles.splice(draggedIndex, 1)[0];
            pdfFiles.splice(dropIndex, 0, item);
            updatePdfFileList();
        }
    }
    draggedIndex = null;
}

function removePdfFile(index) {
    pdfFiles.splice(index, 1);
    updatePdfFileList();
}

function clearAllPdfFiles() {
    pdfFiles = [];
    updatePdfFileList();
    document.getElementById('pdf-list-actions').style.display = 'none';
    document.getElementById('action-bar').style.display = 'none';
    showToast("Files cleared");
}

async function analyzePdf() {
    if (pdfFiles.length !== 1) {
        showToast("Select exactly 1 PDF file first", "#ef4444");
        return;
    }
    
    toggleLoading(true);
    
    try {
        const formData = new FormData();
        formData.append("file", pdfFiles[0]);
        
        const resp = await fetch("http://127.0.0.1:8000/pdf-toolkit/analyze", { method: "POST", body: formData });
        const data = await resp.json();
        
        if (data.error) {
            showToast(data.error, "#ef4444");
        } else {
            document.getElementById('analyze-result').style.display = 'block';
            document.getElementById('analyze-result').innerHTML = `<p style="color: #94a3b8;">This PDF has <strong style="color: white;">${data.total_pages}</strong> pages</p>`;
            document.getElementById('split-page-input').value = Math.ceil(data.total_pages / 2);
            document.getElementById('split-page-input').max = data.total_pages;
            document.getElementById('split-input-area').style.display = 'block';
            showToast("PDF analyzed", "#10b981");
        }
    } catch (err) {
        showToast("Analyze failed", "#ef4444");
    }
    
    toggleLoading(false);
}

async function processPdfToolkit() {
    toggleLoading(true);
    
    try {
        if (currentPdfMode === 'merge') {
            if (pdfFiles.length < 2) {
                showToast("Select at least 2 PDF files", "#ef4444");
                toggleLoading(false);
                return;
            }
            
            const formData = new FormData();
            pdfFiles.forEach(f => formData.append("files", f));
            
            const resp = await fetch("http://127.0.0.1:8000/pdf-toolkit/merge", { method: "POST", body: formData });
            const data = await resp.json();
            
            if (data.error) {
                showToast(data.error, "#ef4444");
            } else {
                document.getElementById('preview-section').innerHTML = `
                    <div class="elegant-card" style="text-align: center; margin-top: 20px;">
                        <h3 style="color: #10b981;">PDFs Merged!</h3>
                        <p style="color: #94a3b8;">${data.message}</p>
                        <button class="btn-primary" onclick="saveMergedPdf('${data.filename}')">Save PDF</button>
                    </div>
                `;
                showToast("PDFs merged successfully", "#10b981");
            }
        } else {
            if (pdfFiles.length !== 1) {
                showToast("Select exactly 1 PDF file", "#ef4444");
                toggleLoading(false);
                return;
            }
            
            const splitAt = parseInt(document.getElementById('split-page-input').value) || 1;
            
            const formData = new FormData();
            formData.append("file", pdfFiles[0]);
            formData.append("split_at_page", splitAt);
            
            const resp = await fetch("http://127.0.0.1:8000/pdf-toolkit/split", { method: "POST", body: formData });
            const data = await resp.json();
            
            if (data.error) {
                showToast(data.error, "#ef4444");
            } else {
                document.getElementById('preview-section').innerHTML = `
                    <div class="elegant-card" style="text-align: center; margin-top: 20px;">
                        <h3 style="color: #10b981;">PDF Split!</h3>
                        <p style="color: #94a3b8;">${data.message}</p>
                        <button class="btn-primary" onclick="saveSplitPdfs()">Save Both Parts</button>
                    </div>
                `;
                showToast("PDF split successfully", "#10b981");
            }
        }
    } catch (err) {
        showToast("PDF operation failed", "#ef4444");
    }
    
    toggleLoading(false);
}

async function saveMergedPdf(filename) {
    const result = await ipcRenderer.invoke('save-file', { defaultPath: filename });
    if (result && result.success) {
        await fetch("http://127.0.0.1:8000/pdf-toolkit/save-merged", {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ destination: result.path })
        });
        showToast("PDF saved!");
        shell.showItemInFolder(result.path);
    }
}

async function saveSplitPdfs() {
    const result = await ipcRenderer.invoke('select-folder');
    if (result) {
        await fetch("http://127.0.0.1:8000/pdf-toolkit/save-split", {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ destination: result })
        });
        showToast("PDFs saved!");
        shell.openPath(result);
    }
}

document.getElementById('process-btn').onclick = function() {
    if (selectedTool === 'pdftool') {
        processPdfToolkit();
    } else {
        processFiles();
    }
};

let mediaRecorder = null;
let recordedChunks = [];
let currentRecordingData = null;
let recordingStartTime = null;
let recordingTimerInterval = null;

function updateRecordingUI(isRecording) {
    const recordBtn = document.getElementById('record-btn');
    const stopBtn = document.getElementById('stop-btn');
    const statusIndicator = document.getElementById('recorder-status-indicator');
    const preview = document.getElementById('recorder-preview');
    
    if (isRecording) {
        recordBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        statusIndicator.classList.add('recording');
        statusIndicator.classList.remove('ready');
        preview.classList.add('recording');
        
        // Start timer
        recordingStartTime = Date.now();
        recordingTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            document.getElementById('recorder-duration').textContent = `${minutes}:${seconds}`;
        }, 1000);
    } else {
        recordBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
        statusIndicator.classList.remove('recording');
        statusIndicator.classList.add('ready');
        preview.classList.remove('recording');
        
        // Stop timer
        if (recordingTimerInterval) {
            clearInterval(recordingTimerInterval);
            recordingTimerInterval = null;
        }
        document.getElementById('recorder-duration').textContent = '00:00';
    }
}

async function startRecording() {
    try {
        const sources = await ipcRenderer.invoke('get-screen-sources');
        
        if (!sources || sources.length === 0) {
            showToast("No screens found", "#ef4444");
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sources[0].id,
                    minWidth: 1280,
                    maxWidth: 1920,
                    minHeight: 720,
                    maxHeight: 1080
                }
            }
        });

        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9'
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.start(1000);
        
        updateRecordingUI(true);
        showToast("Recording started", "#10b981");
    } catch (err) {
        showToast("Failed to start recording: " + err.message, "#ef4444");
    }
}

async function stopRecording() {
    try {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            showToast("No recording in progress", "#ef4444");
            return;
        }

        const recordingData = await new Promise((resolve) => {
            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                resolve(blob);
            };
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        });

        const arrayBuffer = await recordingData.arrayBuffer();
        const result = await ipcRenderer.invoke('save-temp-recording', arrayBuffer);
        
        updateRecordingUI(false);
        
        if (result.error) {
            showToast(result.error, "#ef4444");
            return;
        }
        
        const videoUrl = URL.createObjectURL(recordingData);
        
        document.getElementById('preview-section').innerHTML = `
            <div class="elegant-card" style="text-align: center; margin-top: 20px;">
                <h3 style="color: #10b981; margin-bottom: 15px;">Recording Saved!</h3>
                <div class="recorder-thumbnail">
                    <video src="${videoUrl}" controls style="width: 100%; max-width: 400px; border-radius: 12px;"></video>
                </div>
                <p style="color: #94a3b8; margin: 15px 0;">${result.filename}</p>
                <button class="btn-primary" onclick="saveRecording()">Save Recording</button>
            </div>
        `;
        showToast("Recording saved", "#10b981");
    } catch (err) {
        showToast("Failed to stop recording: " + err.message, "#ef4444");
    }
}

async function saveRecording() {
    const result = await ipcRenderer.invoke('save-recording', 'recording.webm');
    if (result.error) {
        showToast(result.error, "#ef4444");
    } else {
        showToast("Recording saved!");
        if (result.path) shell.showItemInFolder(result.path);
    }
}