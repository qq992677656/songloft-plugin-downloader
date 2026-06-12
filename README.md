# Songloft 歌曲下载插件

将用户自有网络存储（NAS、WebDAV、Subsonic 等）中的歌曲下载到 Songloft 服务端本地。

## 使用场景

Songloft 通过 WebDAV、Subsonic 等插件可以接入用户自己的网络音乐库。这些歌曲以 `remote` 类型存储在数据库中，播放时服务端从用户的网络存储实时拉取音频流。

本插件的作用是将这些**来自用户自有网络存储**的歌曲下载到服务端本地 `music_path` 目录，转为 `local` 类型。适用场景：

- 家里的 NAS 通过 WebDAV 挂载，希望将歌曲固化到 Songloft 服务端，脱离对 NAS 在线的依赖
- Subsonic 服务器上的音乐库，希望迁移到 Songloft 本地管理
- 网络存储不稳定或带宽有限，想避免每次播放都远程拉取

> **本插件仅适用于用户自有的本地网络资源**（WebDAV、Subsonic、SMB 等），不支持也不应用于第三方音乐平台的歌曲下载。

### 典型流程

```
用户的 NAS / WebDAV / Subsonic
        │
   (音源插件导入)
        │
        ▼
Songloft 数据库（type=remote, url 指向用户自有存储）
        │
  (歌曲下载插件)
        │
        ▼
Songloft 服务端 music_path 本地目录（type=local）
```

### 示例

假设你通过 DAV 插件挂载了家里 NAS 的 WebDAV 共享（`http://192.168.1.100:5005/dav/music`），导入了一批歌曲：

| 字段 | 值 |
|------|-----|
| title | 夜曲 |
| artist | 周杰伦 |
| album | 十一月的萧邦 |
| type | remote |
| plugin_entry_path | dav |
| source_data | `{"configName":"家庭NAS","path":"/music/周杰伦/夜曲.flac"}` |

使用本插件下载后（路径模板 `{artist}-{album}/{title}`）：

| 字段 | 值 |
|------|-----|
| type | **local** |
| file_path | `/data/music/周杰伦-十一月的萧邦/夜曲.flac` |
| plugin_entry_path | *(已清空)* |
| source_data | *(已清空)* |

歌曲文件已存储在服务端本地，不再依赖 NAS 在线。

又如通过 Subsonic 插件接入了另一台 Songloft/Navidrome 服务器（`http://192.168.1.200:4533`），想把歌曲迁移到本机：

| 字段 | 下载前 | 下载后 |
|------|--------|--------|
| type | remote | **local** |
| plugin_entry_path | subsonic | *(清空)* |
| file_path | *(空)* | `/data/music/Adele-25/Hello.mp3` |

## 安装

从 Songloft 插件市场安装，或手动构建：

```bash
cd jsplugins-src/songloft-plugin-downloader
pnpm install
pnpm run build
# 产物：dist/song-downloader.jsplugin.zip
```

将 zip 文件上传到 Songloft 的「JS 插件」管理页面即可。

## 使用说明

1. 打开插件页面，页面会列出数据库中所有 `remote` 类型的歌曲
2. **设置**（页面顶部）：
   - **路径模板**：控制下载后的目录结构，默认 `{artist}-{album}/{title}`
     - 支持占位符：`{title}`（必填）、`{artist}`、`{album}`、`{year}`、`{genre}`
     - 示例：`{artist}/{album}/{title}` → `周杰伦/十一月的萧邦/夜曲.flac`
   - **嵌入元数据**：是否将标题、艺术家、专辑、封面等写入音频文件标签（MP3/FLAC）
3. 勾选要下载的歌曲，点击「下载选中」
4. 批量下载时页面显示进度条和成功/失败计数

## 所需权限

| 权限 | 用途 |
|------|------|
| `storage` | 存储插件设置（路径模板、元数据开关） |
| `songs.read` | 读取歌曲列表 |
| `songs.write` | 下载后更新歌曲类型和路径 |

## 注意事项

- 下载目标目录固定为服务端的 `music_path`（通过 Songloft 设置页配置的音乐目录）
- 下载后歌曲变为 `local` 类型，原有的插件来源信息会被清除
- 如果服务端已有该歌曲的透明缓存，下载时会直接复制缓存文件，无需重新拉取
- 仅支持 `remote` 类型歌曲，`local` 和 `radio` 类型不可下载
- M4A/OGG 格式的元数据嵌入暂不支持，会自动跳过（不影响下载本身）

## 开发

```bash
pnpm install
pnpm run dev   # 开发模式（热重载）
pnpm run build # 构建生产版本
```

## License

Apache-2.0
