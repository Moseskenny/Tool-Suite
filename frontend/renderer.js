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
        setTimeout(() => selectTool( tool ||'compress'), 1200);
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
    '.pdf': ['docx'], '.docx': ['pdf'], '.txt': ['pdf', 'docx'], '.md': ['pdf', 'docx'],
    '.jpg': ['pdf', 'png', 'webp'], '.jpeg': ['pdf', 'png', 'webp'], '.png': ['pdf', 'jpg', 'webp']
};

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
        document.getElementById('converter-controls').style.display = 'none';
        document.getElementById('recorder-controls').style.display = 'none';
        document.getElementById('pdftool-controls').style.display = 'none';
        document.getElementById('drop-zone').style.display = 'block';
        document.getElementById('action-bar').style.display = 'none';
        document.getElementById('download-btn').style.display = 'none';
        document.getElementById('preview-section').innerHTML = ''; 
        
        if(tool === 'compress') document.getElementById('compressor-controls').style.display = 'block';
        if(tool === 'convert') document.getElementById('converter-controls').style.display = 'block';
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
            const converterControls = document.getElementById('converter-controls');
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
            if (converterControls) {
                converterControls.classList.add('content-bounce');
                setTimeout(() => converterControls.classList.remove('content-bounce'), 600);
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

    if (selectedTool === 'convert') populateConverterDropdown(ext);
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

function populateConverterDropdown(ext) {
    const badge = document.getElementById('detected-ext');
    const select = document.getElementById('target-format');
    badge.innerText = ext.replace('.', '').toUpperCase();
    select.innerHTML = ""; 

    const targets = CONVERSION_MAP[ext] || [];
    if (targets.length > 0) {
        targets.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t; opt.innerText = `Convert to ${t.toUpperCase()}`;
            select.appendChild(opt);
        });
    } else {
        select.innerHTML = `<option>No conversions available</option>`;
        showToast("Unrecognized file type", "#ef4444");
    }
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
            const formData = new FormData();
            for (let f of selectedFiles) formData.append("files", f);
            formData.append("target_format", document.getElementById('target-format').value);
            const resp = await fetch("http://127.0.0.1:8000/process-convert", { method: "POST", body: formData });
            const data = await resp.json();
            previewArea.innerHTML = `<p style="color:#10b981; font-weight:bold; text-align:center;">${data.message}</p>`;
            document.getElementById('download-btn').style.display = 'inline-block';
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
            
            if (data.error) {
                showToast(data.error, "#ef4444");
                toggleLoading(false);
                return;
            }
            
            showToast("Analysis Complete!");
            const chartHtml = data.prediction.chart_img ? `<img src="${data.prediction.chart_img}" style="width: 100%; max-width: 450px; margin: 20px auto; display: block;">` : ``;
            const reportFilename = data.report_name;

            previewArea.innerHTML = `
                <div class="elegant-card" style="text-align: center; margin-top: 20px;">
                    <h3 style="color: var(--accent); margin-bottom: 20px;">Analysis Results</h3>
                    
                    <div style="display: flex; justify-content: space-around; background: rgba(0,0,0,0.2); padding: 20px; border-radius: 16px; margin-bottom: 20px;">
                        <p style="font-size: 1.1rem; color: #94a3b8;">Daily Burn: <strong style="color: white; font-size: 1.3rem;">${data.prediction.currency}${data.prediction.burn_rate}</strong></p>
                        <p style="font-size: 1.1rem; color: #94a3b8;">Projected EOM: <strong style="color: white; font-size: 1.3rem;">${data.prediction.currency}${data.prediction.projected}</strong></p>
                    </div>
                    
                    ${chartHtml}

                    <div style="background: rgba(0,0,0,0.2); padding: 25px; border-radius: 16px; margin: 20px 0; text-align: left;">
                        <h4 style="margin-bottom: 15px; color: #94a3b8;">Want to buy something? Check if it's affordable:</h4>
                        <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                            <input type="text" id="wish-item" placeholder="Item Name (e.g. PS5)" style="flex: 1; padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: white; outline: none;">
                            <input type="number" id="wish-price" placeholder="Price" style="flex: 1; padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: white; outline: none;">
                            <button onclick="calculateAffordability(${data.prediction.projected}, '${data.prediction.currency}')" class="btn-primary" style="margin-top: 0;">Analyze</button>
                        </div>
                        <div id="afford-result" style="font-size: 1.05rem; line-height: 1.5;"></div>
                    </div>

                    <a href="http://127.0.0.1:8000/download-report/${reportFilename}" target="_blank" class="btn-primary" style="display: inline-block; text-decoration: none;">Download PDF Report</a>
                </div>
            `;
        }
    } catch (err) {
        showToast("Backend connection error!", "#ef4444");
    } finally {
        toggleLoading(false);
        processBtn.innerText = "Done!";
        setTimeout(() => {
            processBtn.innerText = originalText;
            processBtn.classList.remove('btn-loading');
        }, 2000);
    }
}

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
        await fetch(`http://127.0.0.1:8000${endpoint}`, {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ destination: dest })
        });
        showToast("Successfully Saved!");
        setTimeout(() => selectTool(selectedTool), 1000);
    }
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
    // This opens their default web browser to your repo
    shell.openExternal('https://github.com/Moseskenny/Tool-Suite'); 
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
    if (currentPdfMode === 'merge') {
        list.innerHTML = pdfFiles.map((f, i) => `
            <div class="pdf-item" draggable="true" data-index="${i}" ondragstart="handleDragStart(event)" ondragover="handleDragOver(event)" ondrop="handleDrop(event)" ondragenter="handleDragEnter(event)" ondragleave="handleDragLeave(event)">
                <span class="drag-handle">☰</span>
                <span class="pdf-name">${f.name}</span>
                <button onclick="removePdfFile(${i})">×</button>
            </div>
        `).join('');
        if (pdfFiles.length > 0) {
            document.getElementById('action-bar').style.display = 'block';
            document.getElementById('process-btn').innerText = 'Merge PDFs';
        }
    } else {
        list.innerHTML = pdfFiles.length > 0 ? `<div class="pdf-item"><span>${pdfFiles[0].name}</span><button onclick="removePdfFile(0)">×</button></div>` : '';
        if (pdfFiles.length > 0) {
            document.getElementById('action-bar').style.display = 'block';
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
    }
}