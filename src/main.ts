/// <reference types="@songloft/plugin-sdk" />
import { jsonResponse, createRouter, parseQuery } from '@songloft/plugin-sdk';

const router = createRouter();
const DEFAULT_TEMPLATE = 'downloads/{artist}-{album}/{title}';

router.get('/api/settings', async () => {
    const template = (await songloft.storage.get('path_template') as string) || DEFAULT_TEMPLATE;
    const embedMetadata = (await songloft.storage.get('embed_metadata')) ?? true;
    const downloadInterval = (await songloft.storage.get('download_interval')) as number ?? 0;
    const autoDownload = (await songloft.storage.get('auto_download')) ?? false;
    return jsonResponse({ path_template: template, embed_metadata: embedMetadata, download_interval: downloadInterval, auto_download: autoDownload });
});

router.post('/api/settings', async (req) => {
    const body = JSON.parse(req.body);
    if (body.path_template !== undefined) {
        await songloft.storage.set('path_template', body.path_template);
    }
    if (body.embed_metadata !== undefined) {
        await songloft.storage.set('embed_metadata', body.embed_metadata);
    }
    if (body.download_interval !== undefined) {
        await songloft.storage.set('download_interval', body.download_interval);
    }
    if (body.auto_download !== undefined) {
        await songloft.storage.set('auto_download', body.auto_download);
        await syncAutoDownloadConfig();
    }
    return jsonResponse({ ok: true });
});

router.get('/api/songs', async (req) => {
    const q = parseQuery(req.query);
    const limit = parseInt(q.limit || '50');
    const offset = parseInt(q.offset || '0');
    const songs = await songloft.songs.list({ limit, offset });
    const remoteSongs = songs.filter((s: any) => s.type === 'remote');
    return jsonResponse({ songs: remoteSongs, total: remoteSongs.length });
});

router.post('/api/download', async (req) => {
    const { song_id } = JSON.parse(req.body);
    const template = (await songloft.storage.get('path_template') as string) || DEFAULT_TEMPLATE;
    const embedMetadata = (await songloft.storage.get('embed_metadata')) ?? true;

    const result = await songloft.songs.download(song_id, {
        path_template: template,
        embed_metadata: embedMetadata as boolean,
    });
    return jsonResponse(result);
});

interface BatchResult {
    song_id: number;
    path?: string;
    status: string;
    error?: string;
}

let batchTask: { results: BatchResult[]; current: number; total: number; done: boolean } | null = null;

router.post('/api/download-batch', async (req) => {
    const { song_ids } = JSON.parse(req.body) as { song_ids: number[] };
    if (!song_ids || song_ids.length === 0) {
        return jsonResponse({ error: 'song_ids is required' }, 400);
    }

    const template = (await songloft.storage.get('path_template') as string) || DEFAULT_TEMPLATE;
    const embedMetadata = (await songloft.storage.get('embed_metadata')) ?? true;
    const downloadInterval = (await songloft.storage.get('download_interval')) as number ?? 0;

    batchTask = { results: [], current: 0, total: song_ids.length, done: false };

    (async () => {
        for (let i = 0; i < song_ids.length; i++) {
            if (!batchTask) break;
            const id = song_ids[i];
            batchTask.current++;
            try {
                const result = await songloft.songs.download(id, {
                    path_template: template,
                    embed_metadata: embedMetadata as boolean,
                });
                batchTask.results.push({ song_id: id, ...result });
            } catch (e: any) {
                batchTask.results.push({ song_id: id, status: 'failed', error: e.message });
            }
            // 添加下载间隔（如果不是最后一首）
            if (i < song_ids.length - 1 && downloadInterval > 0) {
                await new Promise(resolve => setTimeout(resolve, downloadInterval * 1000));
            }
        }
        if (batchTask) batchTask.done = true;
    })();

    return jsonResponse({ started: true, total: song_ids.length });
});

router.get('/api/download-batch/progress', async () => {
    if (!batchTask) {
        return jsonResponse({ active: false });
    }
    const success = batchTask.results.filter(r => r.status === 'ok').length;
    const failed = batchTask.results.filter(r => r.status === 'failed').length;
    return jsonResponse({
        active: true,
        current: batchTask.current,
        total: batchTask.total,
        done: batchTask.done,
        success,
        failed,
        results: batchTask.results,
    });
});

router.post('/api/download-batch/clear', async () => {
    batchTask = null;
    return jsonResponse({ ok: true });
});

async function syncAutoDownloadConfig() {
    const template = (await songloft.storage.get('path_template') as string) || DEFAULT_TEMPLATE;
    const embedMetadata = (await songloft.storage.get('embed_metadata')) ?? true;
    const autoDownload = (await songloft.storage.get('auto_download')) ?? false;
    await (songloft.songs as any).setAutoDownload({
        enabled: !!autoDownload,
        path_template: template,
        embed_metadata: !!embedMetadata,
    });
}

globalThis.onInit = async () => {
    await syncAutoDownloadConfig();
};

globalThis.onHTTPRequest = async (req: HTTPRequest) => router.handle(req);
