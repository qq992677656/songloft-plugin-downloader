const P = window.SongloftPlugin;
const $ = s => document.querySelector(s);

let songs = [];
let selected = new Set();
let dlStatus = {};

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function showSnackbar(msg, type) {
    const el = $('#snackbar');
    el.textContent = msg;
    el.className = 'snackbar show' + (type ? ' ' + type : '');
    setTimeout(() => { el.className = 'snackbar'; }, 3000);
}

async function loadSettings() {
    const r = await P.apiGet('/api/settings');
    if (r) {
        $('#tpl').value = r.path_template || '';
        $('#embed').checked = r.embed_metadata !== false;
        $('#interval').value = r.download_interval ?? 0;
    }
}

async function saveSettings() {
    await P.apiPost('/api/settings', {
        path_template: $('#tpl').value,
        embed_metadata: $('#embed').checked,
        download_interval: parseInt($('#interval').value) || 0,
    });
}

async function loadSongs() {
    const r = await P.apiGet('/api/songs?limit=500&offset=0');
    songs = r && r.songs ? r.songs : [];
    selected.clear();
    render();
}

function render() {
    const tbody = $('#tbody');
    if (songs.length === 0) {
        tbody.innerHTML = '';
        $('#empty').style.display = '';
        updateSelInfo();
        return;
    }
    $('#empty').style.display = 'none';
    tbody.innerHTML = songs.map(s => {
        const src = s.plugin_entry_path || 'URL';
        const st = dlStatus[s.id];
        const stHtml = st
            ? (st.status === 'ok'
                ? '<span class="status-ok">已下载</span>'
                : '<span class="status-fail">失败</span>')
            : '';
        return `<tr data-id="${s.id}">
      <td><input type="checkbox" class="cb row-cb" data-id="${s.id}" ${selected.has(s.id) ? 'checked' : ''}></td>
      <td class="song-title">${esc(s.title)}</td>
      <td class="song-artist">${esc(s.artist || '')}</td>
      <td class="song-album">${esc(s.album || '')}</td>
      <td><span class="song-source">${esc(src)}</span></td>
      <td>${stHtml}</td>
    </tr>`;
    }).join('');
    document.querySelectorAll('.row-cb').forEach(cb => {
        cb.addEventListener('change', e => {
            const id = parseInt(e.target.dataset.id);
            e.target.checked ? selected.add(id) : selected.delete(id);
            updateSelInfo();
        });
    });
    updateSelInfo();
}

function updateSelInfo() {
    $('#sel-info').textContent = `已选 ${selected.size} 首`;
    $('#btn-dl').disabled = selected.size === 0;
    $('#cb-all').checked = songs.length > 0 && selected.size === songs.length;
}

// Header checkbox
$('#cb-all').addEventListener('change', e => {
    if (e.target.checked) songs.forEach(s => selected.add(s.id));
    else selected.clear();
    render();
});

// Select all button
$('#btn-sel-all').addEventListener('click', () => {
    if (selected.size === songs.length) selected.clear();
    else songs.forEach(s => selected.add(s.id));
    render();
});

// Refresh
$('#btn-refresh').addEventListener('click', () => {
    dlStatus = {};
    loadSongs();
});

// Settings auto-save
$('#tpl').addEventListener('change', saveSettings);
$('#embed').addEventListener('change', saveSettings);
$('#interval').addEventListener('change', saveSettings);

// Download
$('#btn-dl').addEventListener('click', async () => {
    if (selected.size === 0) return;
    const ids = [...selected];
    await saveSettings();

    await P.apiPost('/api/download-batch/clear');
    await P.apiPost('/api/download-batch', { song_ids: ids });

    const prog = $('#progress');
    prog.classList.add('active');

    const poll = setInterval(async () => {
        const r = await P.apiGet('/api/download-batch/progress');
        if (!r || !r.active) { clearInterval(poll); return; }
        const pct = r.total > 0 ? (r.current / r.total * 100) : 0;
        $('#prog-bar').style.width = pct + '%';
        $('#prog-num').textContent = r.current + '/' + r.total;
        $('#prog-ok').textContent = r.success;
        $('#prog-fail').textContent = r.failed;

        if (r.results) r.results.forEach(res => { dlStatus[res.song_id] = res; });
        render();

        if (r.done) {
            clearInterval(poll);
            showSnackbar(`下载完成：${r.success} 成功，${r.failed} 失败`, r.failed > 0 ? 'error' : 'success');
            setTimeout(() => {
                prog.classList.remove('active');
                selected.clear();
                loadSongs();
            }, 2000);
        }
    }, 800);
});

loadSettings();
loadSongs();
