const { ipcRenderer } = require('electron');

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
    if (selectedTool === tool) return; // Don't animate if clicking the same tool

    const contentArea = document.querySelector('.content-area');
    const header = document.querySelector('.workspace-header');

    // 1. Trigger the "Liquid Out" animation
    contentArea.classList.add('animate-out');
    header.classList.add('animate-out');

    // 2. Wait exactly 250ms for it to disappear, then swap the data
    setTimeout(() => {
        selectedTool = tool;
        selectedFiles = [];
        selectedFolderPath = null;

        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`btn-${tool}`).classList.add('active');

        const titles = { compress: "Image Compressor", organize: "File Organizer", convert: "Doc Converter", expense: "Expense Analysis" };
        document.getElementById('tool-title').innerText = titles[tool];
        document.getElementById('tool-description').innerText = (tool === 'organize') ? "Click below to select a folder to organize." : "Drop your files to begin.";

        // Hide everything
        document.getElementById('compressor-controls').style.display = 'none';
        document.getElementById('converter-controls').style.display = 'none';
        document.getElementById('action-bar').style.display = 'none';
        document.getElementById('download-btn').style.display = 'none';
        document.getElementById('preview-section').innerHTML = ""; 
        
        // Show selected tool
        if(tool === 'compress') document.getElementById('compressor-controls').style.display = 'block';
        if(tool === 'convert') document.getElementById('converter-controls').style.display = 'block';

        // 3. Remove the 'out' state and force the browser to reset
        contentArea.classList.remove('animate-out');
        header.classList.remove('animate-out');
        void contentArea.offsetWidth; // MAGIC TRICK: Forces DOM to acknowledge reset

        // 4. Trigger the "Spring In" animation
        contentArea.classList.add('animate-in');
        header.classList.add('animate-in');

        // 5. Clean up the classes after the 600ms spring animation finishes
        setTimeout(() => {
            contentArea.classList.remove('animate-in');
            header.classList.remove('animate-in');
        }, 600);

    }, 250); 
}

document.getElementById('drop-zone').addEventListener('click', async () => {
    if (!selectedTool) return showToast("Please select a tool first!", "#ef4444");
    if (selectedTool === 'organize') {
        selectedFolderPath = await ipcRenderer.invoke('select-folder');
        if (selectedFolderPath) {
            document.getElementById('tool-description').innerText = `Selected Folder: ${selectedFolderPath}`;
            document.getElementById('action-bar').style.display = 'block';
        }
    } else {
        document.getElementById('file-input').click();
    }
});

document.getElementById('file-input').addEventListener('change', (e) => {
    selectedFiles = e.target.files;
    if (selectedFiles.length === 0) return;

    const file = selectedFiles[0];
    const ext = "." + file.name.split('.').pop().toLowerCase();

    document.getElementById('tool-description').innerText = `${selectedFiles.length} file(s) loaded.`;
    document.getElementById('action-bar').style.display = 'block';

    if (selectedTool === 'convert') populateConverterDropdown(ext);
    if (selectedTool === 'compress') {
        document.getElementById('original-preview').src = URL.createObjectURL(file);
        updateCompressPreview();
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
            const formData = new FormData();
            formData.append("file", selectedFiles[0]);
            formData.append("price", 0.0);
            formData.append("is_splitwise", false);
            
            const resp = await fetch("http://127.0.0.1:8000/analyze", { method: "POST", body: formData });
            const data = await resp.json();
            
            showToast("Analysis Complete!");
            const chartHtml = data.prediction.chart_img ? `<img src="${data.prediction.chart_img}" style="width: 100%; max-width: 450px; margin: 20px auto; display: block;">` : ``;
            const reportFilename = data.pdf_url.split(/[/\\]/).pop();

            previewArea.innerHTML = `
                <div class="elegant-card" style="text-align: center; margin-top: 20px;">
                    <h3 style="color: #ff7eb3; margin-bottom: 20px;">📊 Analysis Results</h3>
                    
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

                    <a href="http://127.0.0.1:8000/download-report/${reportFilename}" target="_blank" class="btn-primary" style="display: inline-block; text-decoration: none;">📄 Download PDF Report</a>
                </div>
            `;
        }
    } catch (err) {
        showToast("Backend connection error!", "#ef4444");
    } finally {
        toggleLoading(false);
        processBtn.innerText = "Done! ✨";
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
    t.innerText = msg; t.style.background = color; t.classList.add('show');
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
    document.getElementById('compressed-preview').src = data.preview_url;
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